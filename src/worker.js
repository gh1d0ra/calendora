/* Calendora Worker — serves the app and a small JSON API backed by D1.
 *
 * Tables (created automatically on first request):
 *   config(key, value)              passcode hash, session signing key, session epoch
 *   board(id, data, version, ...)   the shared family board as one JSON document
 *   login_attempts(ip, ...)         failed passcode attempts, for rate limiting
 */

const SESSION_COOKIE = 'cal_session';
const SESSION_TTL = 60 * 60 * 24 * 365; // one year: a wall display should stay signed in
const PBKDF2_ITERATIONS = 100000;       // Workers' maximum for PBKDF2
const MAX_FAILS = 10;                   // failed passcode attempts …
const FAIL_WINDOW = 15 * 60;            // … per 15 minutes per IP
const MAX_BOARD_BYTES = 1900000;        // stay under D1's 2 MB value limit
const BOARD_ID = 'family';
const MAX_IMAGE_BYTES = 1800000;        // recipe photos are resized in the browser first
const VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const te = new TextEncoder();
const td = new TextDecoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const b64u = buf => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = s => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------------ database
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS board (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL)'),
  ]);
  schemaReady = true;
}
async function getConfig(db, key) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
async function setConfig(db, key, value) {
  await db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

// ------------------------------------------------------------------ passcode
async function hashPasscode(passcode, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', te.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return b64u(bits);
}
async function makePasscodeRecord(passcode) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64u(salt)}$${await hashPasscode(passcode, salt)}`;
}
async function checkPasscode(record, passcode) {
  const [kind, iters, salt, hash] = (record || '').split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) return false;
  return safeEqual(await hashPasscode(passcode, fromB64u(salt), Number(iters)), hash);
}
function validPasscode(p) { return typeof p === 'string' && p.length >= 4 && p.length <= 128; }

// ------------------------------------------------------------------ sessions
async function signingKey(db) {
  let raw = await getConfig(db, 'session_key');
  if (!raw) {
    await db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').bind('session_key', b64u(crypto.getRandomValues(new Uint8Array(32)))).run();
    raw = await getConfig(db, 'session_key');
  }
  return crypto.subtle.importKey('raw', fromB64u(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sessionEpoch(db) { return (await getConfig(db, 'session_epoch')) || '1'; }
async function makeSessionCookie(db) {
  const payload = `${await sessionEpoch(db)}:${Math.floor(Date.now() / 1000) + SESSION_TTL}`;
  const sig = await crypto.subtle.sign('HMAC', await signingKey(db), te.encode(payload));
  const token = `${b64u(te.encode(payload))}.${b64u(sig)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`;
}
const clearCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
async function isSignedIn(request, db) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!m) return false;
  const [p, s] = m[1].split('.');
  if (!p || !s) return false;
  let payload;
  try { payload = td.decode(fromB64u(p)); } catch (e) { return false; }
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await signingKey(db), fromB64u(s), te.encode(payload)); } catch (e) { return false; }
  if (!ok) return false;
  const [epoch, exp] = payload.split(':');
  return Number(exp) > Date.now() / 1000 && epoch === (await sessionEpoch(db));
}

// ------------------------------------------------------------------ rate limiting
const clientIp = request => request.headers.get('CF-Connecting-IP') || 'unknown';
async function tooManyFails(db, ip) {
  const row = await db.prepare('SELECT count, window_start FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (!row) return false;
  if (Date.now() / 1000 - row.window_start > FAIL_WINDOW) return false;
  return row.count >= MAX_FAILS;
}
async function recordFail(db, ip) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?)
    ON CONFLICT(ip) DO UPDATE SET
      count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`)
    .bind(ip, now, now, FAIL_WINDOW, now, FAIL_WINDOW, now).run();
}
const clearFails = (db, ip) => db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();


// ------------------------------------------------------------------ recipes
function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔',
    ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', eacute: 'é', egrave: 'è', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', reg: '®', copy: '©', trade: '™', middot: '·', bull: '•', frasl: '⁄' };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,8});/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
    return named[e] || named[e.toLowerCase()] || m;
  });
}
const cleanText = s => decodeEntities(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function findRecipeNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipeNode(n, depth + 1); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  return findRecipeNode(node['@graph'], depth + 1) || findRecipeNode(node.mainEntity, depth + 1) || null;
}
function recipeSteps(ins) {
  const out = [];
  const walk = x => {
    if (!x || out.length > 80) return;
    if (typeof x === 'string') { x.split(/\n+/).map(cleanText).filter(Boolean).forEach(v => out.push(v)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const t = x['@type'];
    if (t === 'HowToSection' || (Array.isArray(t) && t.includes('HowToSection'))) { if (x.name) out.push(`— ${cleanText(x.name)} —`); walk(x.itemListElement); return; }
    if (x.text) out.push(cleanText(x.text)); else if (x.name) out.push(cleanText(x.name));
  };
  walk(ins);
  return out.filter(Boolean);
}
function firstImage(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  return img.url || img.contentUrl || '';
}
function durationText(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m || (!m[1] && !m[2] && !m[3])) return '';
  const parts = [];
  if (m[1]) parts.push(`${m[1]} d`);
  if (m[2]) parts.push(`${m[2]} h`);
  if (m[3]) parts.push(`${m[3]} min`);
  return parts.join(' ');
}
function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = (html.match(re) || [])[0];
  if (!tag) return '';
  return cleanText((tag.match(/content=["']([^"']*)["']/i) || [])[1] || '');
}
function extractRecipe(html, pageUrl) {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const sc of scripts) {
    const body = sc.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    let data;
    try { data = JSON.parse(body); } catch (e) { continue; }
    const r = findRecipeNode(data);
    if (!r) continue;
    let image = firstImage(r.image);
    try { if (image) image = new URL(image, pageUrl).href; } catch (e) { image = ''; }
    const y = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
    return {
      found: true,
      title: cleanText(r.name) || metaContent(html, 'og:title'),
      image,
      servings: cleanText(y),
      time: durationText(r.totalTime) || durationText(r.cookTime) || '',
      ingredients: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : r.ingredients || []).map(cleanText).filter(Boolean).slice(0, 80),
      steps: recipeSteps(r.recipeInstructions).slice(0, 80),
      notes: cleanText(r.description).slice(0, 600),
    };
  }
  const title = metaContent(html, 'og:title') || cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  let image = metaContent(html, 'og:image');
  try { if (image) image = new URL(image, pageUrl).href; } catch (e) { image = ''; }
  return { found: false, title, image, servings: '', time: '', ingredients: [], steps: [], notes: '' };
}
function parseJsonLoose(text) {
  if (text && typeof text === 'object') return text;
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
const asStrList = v => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n+/) : []).map(x => cleanText(typeof x === 'string' ? x : x && (x.text || x.name))).filter(Boolean).slice(0, 80);


// ------------------------------------------------------------------ AnyList shopping-list sync (unofficial)
// AnyList has no public API. This speaks the same private protocol its apps use — protocol details
// learned from the MIT-licensed `anylist` library by codetheweb (https://github.com/codetheweb/anylist).
// Credentials come from Worker secrets ANYLIST_EMAIL / ANYLIST_PASSWORD; tokens are kept in D1.
const AL_BASE = 'https://www.anylist.com';
const td8 = new TextDecoder();
class ALError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

class PBReader {
  constructor(buf) { this.b = buf; this.p = 0; }
  eof() { return this.p >= this.b.length; }
  varint() { let r = 0, mul = 1, x; do { x = this.b[this.p++]; r += (x & 0x7f) * mul; mul *= 128; } while (x & 0x80 && this.p < this.b.length); return r; }
  bytes() { const n = this.varint(); const s = this.b.subarray(this.p, this.p + n); this.p += n; return s; }
  skip(wt) {
    if (wt === 0) this.varint();
    else if (wt === 1) this.p += 8;
    else if (wt === 2) { const n = this.varint(); this.p += n; }
    else if (wt === 5) this.p += 4;
    else throw new ALError('Unexpected data from AnyList');
  }
}
function pbFields(buf, handlers) {
  const r = new PBReader(buf);
  while (!r.eof()) {
    const t = r.varint(), f = Math.floor(t / 8), wt = t % 8;
    const h = handlers[f];
    if (h && wt === 2) h(r.bytes());
    else if (h && wt === 0) h(r.varint());
    else r.skip(wt);
  }
}
function alDecodeItem(buf) {
  const it = { id: '', name: '', checked: false, quantity: '' };
  pbFields(buf, {
    1: b => { it.id = td8.decode(b); }, 3: b => { it.listId = td8.decode(b); }, 4: b => { it.name = td8.decode(b); },
    5: b => { it.details = td8.decode(b); }, 6: v => { it.checked = !!v; },
    18: b => { if (!it.quantity) it.quantity = td8.decode(b); }, 21: b => pbFields(b, { 1: x => { it.quantity = td8.decode(x); } }),
  });
  return it;
}
function alDecodeLists(buf) { // PBUserDataResponse.shoppingListsResponse.newLists
  const lists = [];
  pbFields(buf, { 1: slr => pbFields(slr, { 1: sl => {
    const l = { id: '', name: '', items: [] };
    pbFields(sl, { 1: b => { l.id = td8.decode(b); }, 3: b => { l.name = td8.decode(b); }, 4: b => l.items.push(alDecodeItem(b)) });
    lists.push(l);
  } }) });
  return lists;
}
class PBWriter {
  constructor() { this.parts = []; this.len = 0; }
  push(a) { this.parts.push(a); this.len += a.length; }
  varint(n) { const o = []; while (n > 127) { o.push((n % 128) | 0x80); n = Math.floor(n / 128); } o.push(n); this.push(Uint8Array.from(o)); }
  str(f, s) { if (s === undefined || s === null) return; const b = te.encode(String(s)); this.varint(f * 8 + 2); this.varint(b.length); this.push(b); }
  bool(f, v) { this.varint(f * 8); this.varint(v ? 1 : 0); }
  msg(f, w) { const b = w.finish(); this.varint(f * 8 + 2); this.varint(b.length); this.push(b); }
  finish() { const out = new Uint8Array(this.len); let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; } return out; }
}
const alId = () => crypto.randomUUID().replace(/-/g, '');
function alEncodeOps(ops, userId) { // PBListOperationList
  const list = new PBWriter();
  for (const op of ops) {
    const meta = new PBWriter(); meta.str(1, alId()); meta.str(2, op.handler); if (userId) meta.str(3, userId);
    const o = new PBWriter(); o.msg(1, meta); o.str(2, op.listId); o.str(3, op.itemId); if (op.value !== undefined) o.str(4, op.value);
    if (op.item) { const it = new PBWriter(); it.str(1, op.item.id); it.str(3, op.item.listId); it.str(4, op.item.name); it.bool(6, !!op.item.checked); if (userId) it.str(12, userId); o.msg(6, it); }
    list.msg(1, o);
  }
  return list.finish();
}

async function alSaveTokens(db, t) { await setConfig(db, 'anylist_tokens', JSON.stringify(t)); }
async function alLogin(env, t) {
  const f = new FormData(); f.append('email', env.ANYLIST_EMAIL); f.append('password', env.ANYLIST_PASSWORD);
  const r = await fetch(`${AL_BASE}/auth/token`, { method: 'POST', body: f, headers: { 'X-AnyLeaf-API-Version': '3' } });
  if (r.status === 400 || r.status === 401) throw new ALError('AnyList did not accept the email or password', 'auth');
  if (!r.ok) throw new ALError(`AnyList sign-in failed (${r.status})`);
  const j = await r.json();
  t.access = j.access_token; t.refresh = j.refresh_token;
  try { const p = JSON.parse(td8.decode(fromB64u(t.access.split('.')[1]))); t.userId = p.sub || p.user_id || p.uid || ''; } catch (e) { t.userId = t.userId || ''; }
}
async function alRefresh(env, t) {
  const f = new FormData(); f.append('refresh_token', t.refresh || '');
  const r = await fetch(`${AL_BASE}/auth/token/refresh`, { method: 'POST', body: f, headers: { 'X-AnyLeaf-API-Version': '3' } });
  if (r.ok) { const j = await r.json(); t.access = j.access_token; t.refresh = j.refresh_token; } else await alLogin(env, t);
}
async function alTokens(db, env) {
  let t = {};
  try { t = JSON.parse((await getConfig(db, 'anylist_tokens')) || '{}') || {}; } catch (e) { t = {}; }
  if (t.email !== env.ANYLIST_EMAIL) t = { email: env.ANYLIST_EMAIL }; // credentials changed
  if (!t.clientId) t.clientId = alId();
  if (!t.access) { await alLogin(env, t); await alSaveTokens(db, t); }
  return t;
}
// multipart/form-data with one binary field, shaped like the official clients send it (no filename)
function alForm(name, bin) {
  const boundary = `----CalendoraBoundary${alId()}`;
  const head = te.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = te.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bin.length + tail.length);
  body.set(head, 0); body.set(bin, head.length); body.set(tail, head.length + bin.length);
  return { body, type: `multipart/form-data; boundary=${boundary}` };
}
async function alPost(db, env, t, path, makeBody) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const b = makeBody ? makeBody() : null;
    const headers = { 'X-AnyLeaf-API-Version': '3', 'X-AnyLeaf-Client-Identifier': t.clientId, authorization: `Bearer ${t.access}` };
    if (b) headers['Content-Type'] = b.type;
    const r = await fetch(`${AL_BASE}/${path}`, { method: 'POST', body: b ? b.body : undefined, headers });
    if (r.status === 401 && attempt === 0) { await alRefresh(env, t); await alSaveTokens(db, t); continue; }
    if (!r.ok) throw new ALError(`AnyList answered ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  throw new ALError('AnyList sign-in expired');
}

async function anylistSync(env, { force = false } = {}) {
  const db = env.DB;
  await ensureSchema(db);
  if (!env.ANYLIST_EMAIL || !env.ANYLIST_PASSWORD) return { skipped: 'not-configured' };
  const row = await db.prepare('SELECT data, version FROM board WHERE id = ?').bind(BOARD_ID).first();
  if (!row) return { skipped: 'no-board' };
  let board;
  try { board = JSON.parse(row.data); } catch (e) { return { skipped: 'bad-board' }; }
  const cfg = (board.settings && board.settings.anylist) || {};
  if (!cfg.on) return { skipped: 'off' };
  const now = Date.now();
  if (now - Number((await getConfig(db, 'anylist_lock')) || 0) < 60000) return { skipped: 'busy' };
  if (!force && now - Number((await getConfig(db, 'anylist_last')) || 0) < 8000) return { skipped: 'recent' };
  await setConfig(db, 'anylist_lock', String(now));
  let status;
  try {
    status = await anylistSyncOnce(db, env, board, row.version, cfg);
  } catch (e) {
    if (e.code === 'retry') status = null;
    else status = { ok: false, error: e.message || 'AnyList sync failed', at: Date.now() };
  } finally {
    await setConfig(db, 'anylist_lock', '0');
    await setConfig(db, 'anylist_last', String(Date.now()));
  }
  if (status) await setConfig(db, 'anylist_status', JSON.stringify(status));
  return status || { skipped: 'retry' };
}

async function anylistSyncOnce(db, env, board, version, cfg) {
  if (!Array.isArray(board.lists)) board.lists = [];
  const lists = board.lists;
  const t = await alTokens(db, env);
  const alists = alDecodeLists(await alPost(db, env, t, 'data/user-data/get'));
  const wantName = String(cfg.listName || 'Groceries').trim().toLowerCase();
  const al = alists.find(l => (l.name || '').trim().toLowerCase() === wantName);
  if (!al) throw new ALError(`No AnyList list called “${cfg.listName || 'Groceries'}”. Your lists: ${alists.map(l => l.name).join(', ') || 'none'}`);
  let cl = lists.find(l => l.id === cfg.listId) || lists.find(l => /grocer/i.test(l.name || '')) || lists.find(l => (l.name || '').trim().toLowerCase() === (al.name || '').trim().toLowerCase());
  let created = false;
  if (!cl) { cl = { id: `l${alId().slice(0, 12)}`, name: al.name || 'Groceries', emoji: '🛒', items: [] }; lists.unshift(cl); created = true; }
  cl.items = Array.isArray(cl.items) ? cl.items : [];

  let map = null;
  try { map = JSON.parse((await getConfig(db, 'anylist_map')) || 'null'); } catch (e) { map = null; }
  if (!map || map.cl !== cl.id || map.al !== al.id) map = { cl: cl.id, al: al.id, links: [], ignored: [] };
  const cById = new Map(cl.items.map(i => [i.id, i]));
  const aById = new Map(al.items.map(i => [i.id, i]));
  const ops = [], links = [], seenC = new Set(), seenA = new Set();
  let changed = created, pulled = 0;

  for (const L of map.links) {
    const c = cById.get(L.c), a = aById.get(L.a);
    if (c) seenC.add(c.id);
    if (a) seenA.add(a.id);
    if (!c && !a) continue;
    if (!c) { ops.push({ handler: 'remove-shopping-list-item', listId: al.id, itemId: a.id, item: { id: a.id, listId: al.id, name: a.name, checked: a.checked } }); continue; }
    if (!a) { cl.items = cl.items.filter(x => x.id !== c.id); changed = true; pulled++; continue; }
    let name = L.name, checked = L.checked;
    const cName = String(c.text || ''), cChk = !!c.done;
    if (a.name !== L.name) { name = a.name; if (cName !== a.name) { c.text = a.name; changed = true; pulled++; } }
    else if (cName !== L.name) { name = cName; ops.push({ handler: 'set-list-item-name', listId: al.id, itemId: a.id, value: cName }); }
    if (a.checked !== L.checked) { checked = a.checked; if (cChk !== a.checked) { c.done = a.checked; changed = true; pulled++; } }
    else if (cChk !== L.checked) { checked = cChk; ops.push({ handler: 'set-list-item-checked', listId: al.id, itemId: a.id, value: cChk ? 'y' : 'n' }); }
    links.push({ c: c.id, a: a.id, name, checked });
  }

  // New on the Calendora side: match an unlinked AnyList item with the same name, or add it to AnyList.
  const freeA = al.items.filter(a => !seenA.has(a.id));
  const used = new Set();
  for (const c of cl.items.filter(x => !seenC.has(x.id))) {
    const key = String(c.text || '').trim().toLowerCase();
    if (!key) continue;
    const a = freeA.find(x => !used.has(x.id) && (x.name || '').trim().toLowerCase() === key);
    if (a) {
      used.add(a.id);
      const checked = !!c.done && !!a.checked; // keep it on the list if either side still needs it
      if (!!c.done !== checked) { c.done = checked; changed = true; }
      if (a.checked !== checked) ops.push({ handler: 'set-list-item-checked', listId: al.id, itemId: a.id, value: checked ? 'y' : 'n' });
      links.push({ c: c.id, a: a.id, name: a.name, checked });
    } else {
      const id = alId();
      ops.push({ handler: 'add-shopping-list-item', listId: al.id, itemId: id, item: { id, listId: al.id, name: c.text, checked: !!c.done } });
      links.push({ c: c.id, a: id, name: c.text, checked: !!c.done });
    }
  }
  // New on the AnyList side: bring over items still to buy (crossed-off history stays in AnyList).
  const ignored = new Set(map.ignored || []);
  for (const a of freeA) {
    if (used.has(a.id) || !a.name) continue;
    if (a.checked) { ignored.add(a.id); continue; }
    ignored.delete(a.id);
    const id = `al${alId().slice(0, 12)}`;
    cl.items.unshift({ id, text: a.name, done: false });
    links.push({ c: id, a: a.id, name: a.name, checked: false });
    changed = true; pulled++;
  }

  if (changed) {
    const res = await db.prepare('UPDATE board SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
      .bind(JSON.stringify(board), Date.now(), BOARD_ID, version).run();
    if (!res.meta || res.meta.changes !== 1) throw new ALError('board changed', 'retry');
  }
  if (ops.length) {
    const bin = alEncodeOps(ops); // like the official clients, no user id
    await alPost(db, env, t, 'data/shopping-lists/update', () => alForm('operations', bin));
  }
  const validA = new Set(al.items.map(a => a.id));
  await setConfig(db, 'anylist_map', JSON.stringify({ cl: cl.id, al: al.id, links, ignored: [...ignored].filter(id => validA.has(id)) }));
  return { ok: true, at: Date.now(), listName: al.name, calendoraList: cl.name, pushed: ops.length, pulled, items: links.length };
}

// ------------------------------------------------------------------ API
async function readJson(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  try { return await request.json(); } catch (e) { return null; }
}

async function handleApi(request, env, url, ctx) {
  const db = env.DB;
  if (!db) return json({ error: 'Database is not configured' }, 500);
  await ensureSchema(db);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  if (path === '/api/session' && method === 'GET') {
    const configured = !!(await getConfig(db, 'passcode'));
    return json({ configured, signedIn: configured && (await isSignedIn(request, db)) });
  }

  if (path === '/api/setup' && method === 'POST') {
    const body = await readJson(request);
    if (!body || !validPasscode(body.passcode)) return json({ error: 'Choose a passcode of at least 4 characters' }, 400);
    const record = await makePasscodeRecord(body.passcode);
    const res = await db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').bind('passcode', record).run();
    if (!res.meta || res.meta.changes !== 1) return json({ error: 'A family passcode already exists' }, 409);
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(db) });
  }

  if (path === '/api/login' && method === 'POST') {
    const ip = clientIp(request);
    if (await tooManyFails(db, ip)) return json({ error: 'Too many tries — wait 15 minutes and try again' }, 429);
    const body = await readJson(request);
    const record = await getConfig(db, 'passcode');
    if (!record) return json({ error: 'No family passcode yet' }, 409);
    if (!body || typeof body.passcode !== 'string' || !(await checkPasscode(record, body.passcode))) {
      await recordFail(db, ip);
      return json({ error: 'That passcode is not right' }, 401);
    }
    await clearFails(db, ip);
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(db) });
  }

  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });

  // everything below needs a signed-in device
  if (!(await isSignedIn(request, db))) return json({ error: 'Not signed in' }, 401);

  if (path === '/api/logout-all' && method === 'POST') {
    await setConfig(db, 'session_epoch', String(Number(await sessionEpoch(db)) + 1));
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(db) }); // keep this device signed in
  }

  if (path === '/api/passcode' && method === 'POST') {
    const body = await readJson(request);
    if (!body || !validPasscode(body.next)) return json({ error: 'Choose a passcode of at least 4 characters' }, 400);
    if (!(await checkPasscode(await getConfig(db, 'passcode'), body.current || ''))) return json({ error: 'Current passcode is not right' }, 401);
    await setConfig(db, 'passcode', await makePasscodeRecord(body.next));
    await setConfig(db, 'session_epoch', String(Number(await sessionEpoch(db)) + 1));
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(db) });
  }

  if (path === '/api/board' && method === 'GET') {
    const row = await db.prepare('SELECT data, version, updated_at FROM board WHERE id = ?').bind(BOARD_ID).first();
    if (!row) return json({ version: 0, data: null });
    const since = Number(url.searchParams.get('since'));
    if (url.searchParams.has('since') && since === row.version) return json({ version: row.version, unchanged: true });
    return json({ version: row.version, updatedAt: row.updated_at, data: JSON.parse(row.data) });
  }

  if (path === '/api/board' && method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BOARD_BYTES) return json({ error: 'The family board is too large to save' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body.data !== 'object' || body.data === null || !Number.isInteger(body.baseVersion)) return json({ error: 'Invalid board' }, 400);
    const data = JSON.stringify(body.data);
    const now = Date.now();
    let res;
    if (body.baseVersion === 0) {
      res = await db.prepare('INSERT OR IGNORE INTO board (id, data, version, updated_at) VALUES (?, ?, 1, ?)').bind(BOARD_ID, data, now).run();
    } else {
      res = await db.prepare('UPDATE board SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(data, now, BOARD_ID, body.baseVersion).run();
    }
    if (res.meta && res.meta.changes === 1) {
      const al = body.data.settings && body.data.settings.anylist;
      if (al && al.on && env.ANYLIST_EMAIL && ctx && ctx.waitUntil) ctx.waitUntil(anylistSync(env).catch(() => {}));
      return json({ ok: true, version: body.baseVersion + 1, updatedAt: now });
    }
    // someone else saved first: send back what is on the server
    const row = await db.prepare('SELECT data, version, updated_at FROM board WHERE id = ?').bind(BOARD_ID).first();
    return json({ error: 'conflict', version: row ? row.version : 0, updatedAt: row ? row.updated_at : 0, data: row ? JSON.parse(row.data) : null }, 409);
  }

  if (path === '/api/anylist' && method === 'GET') {
    let status = null;
    try { status = JSON.parse((await getConfig(db, 'anylist_status')) || 'null'); } catch (e) { status = null; }
    return json({ configured: !!(env.ANYLIST_EMAIL && env.ANYLIST_PASSWORD), status });
  }
  if (path === '/api/anylist/sync' && method === 'POST') {
    const r = await anylistSync(env, { force: true });
    if (r && r.skipped === 'not-configured') return json({ error: 'Add the AnyList email and password on Cloudflare first' }, 400);
    if (r && r.skipped === 'off') return json({ error: 'Turn on AnyList sync first' }, 400);
    let status = null;
    try { status = JSON.parse((await getConfig(db, 'anylist_status')) || 'null'); } catch (e) { status = null; }
    return json({ result: r, status });
  }

  if (path === '/api/images' && method === 'POST') {
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ error: 'Only JPEG, PNG or WebP photos' }, 415);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return json({ error: 'Empty photo' }, 400);
    if (buf.byteLength > MAX_IMAGE_BYTES) return json({ error: 'That photo is too large' }, 413);
    const id = b64u(crypto.getRandomValues(new Uint8Array(12)));
    await db.prepare('INSERT INTO images (id, type, data, created_at) VALUES (?, ?, ?, ?)').bind(id, type, buf, Date.now()).run();
    return json({ id });
  }

  const imgMatch = path.match(/^\/api\/images\/([A-Za-z0-9_-]{8,40})$/);
  if (imgMatch && method === 'GET') {
    const row = await db.prepare('SELECT type, data FROM images WHERE id = ?').bind(imgMatch[1]).first();
    if (!row) return json({ error: 'Photo not found' }, 404);
    const data = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
    return new Response(data, { headers: { 'Content-Type': row.type, 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
  if (imgMatch && method === 'DELETE') {
    await db.prepare('DELETE FROM images WHERE id = ?').bind(imgMatch[1]).run();
    return json({ ok: true });
  }

  if (path === '/api/recipe-import' && method === 'POST') {
    const body = await readJson(request);
    let target;
    try { target = new URL(String((body && body.url) || '').trim()); } catch (e) { return json({ error: 'That link is not valid' }, 400); }
    if (!/^https?:$/.test(target.protocol)) return json({ error: 'The link must start with https://' }, 400);
    let r;
    try {
      r = await fetch(target.href, { redirect: 'follow', headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Calendora/1.0' } });
    } catch (e) { return json({ error: 'Could not reach that page' }, 502); }
    if (!r.ok) return json({ error: `That site answered ${r.status} — you can still save the link` }, 502);
    let html = await r.text();
    if (html.length > 3000000) html = html.slice(0, 3000000);
    return json({ url: target.href, ...extractRecipe(html, r.url || target.href) });
  }

  if (path === '/api/transcribe' && method === 'POST') {
    if (!env.AI) return json({ error: 'Photo transcription is not switched on for this Calendora' }, 501);
    const body = await readJson(request);
    const image = body && typeof body.image === 'string' ? body.image : '';
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json({ error: 'Send the photo as a JPEG, PNG or WebP' }, 400);
    if (image.length > MAX_IMAGE_BYTES * 1.4) return json({ error: 'That photo is too large' }, 413);
    const prompt = 'This photo shows a recipe (a cookbook page, recipe card, screenshot or handwritten note). Transcribe it faithfully. ' +
      'Reply with ONLY a JSON object with these keys: "title" (string), "servings" (string), "time" (string), ' +
      '"ingredients" (array of strings, one per ingredient line, keep quantities and units), "steps" (array of strings, one per step, in order), ' +
      '"notes" (string, anything else useful). Use "" or [] when something is not in the photo. Do not add anything that is not in the photo.';
    let out;
    try {
      out = await env.AI.run(VISION_MODEL, {
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }],
        max_tokens: 2048,
        temperature: 0.1,
      });
    } catch (e) { return json({ error: 'The photo reader is busy — try again in a minute' }, 502); }
    const text = out && (out.response !== undefined ? out.response : out.result ? out.result.response : out);
    const parsed = parseJsonLoose(text);
    if (!parsed) return json({ title: '', servings: '', time: '', ingredients: [], steps: [], notes: cleanText(typeof text === 'string' ? text : '').slice(0, 4000), partial: true });
    return json({
      title: cleanText(parsed.title).slice(0, 120),
      servings: cleanText(parsed.servings).slice(0, 60),
      time: cleanText(parsed.time).slice(0, 60),
      ingredients: asStrList(parsed.ingredients),
      steps: asStrList(parsed.steps),
      notes: cleanText(parsed.notes).slice(0, 2000),
    });
  }

  if (path === '/api/ical' && method === 'GET') {
    // Fetch a calendar feed (e.g. an iCloud "Public Calendar" link) on the family's behalf.
    // The link is looked up in the shared board, so only feeds the family added can be fetched.
    const id = url.searchParams.get('feed') || '';
    const row = await db.prepare('SELECT data FROM board WHERE id = ?').bind(BOARD_ID).first();
    let feeds = [];
    try { feeds = row ? (JSON.parse(row.data).icalFeeds || []) : []; } catch (e) { feeds = []; }
    const feed = Array.isArray(feeds) ? feeds.find(f => f && f.id === id) : null;
    if (!feed) return json({ error: 'Calendar not found' }, 404);
    let target = String(feed.url || '').trim().replace(/^webcals?:\/\//i, 'https://');
    let host = '';
    try { host = new URL(target).hostname; } catch (e) { return json({ error: 'That calendar link is not valid' }, 400); }
    if (!/^https?:\/\//i.test(target)) return json({ error: 'The link must start with webcal:// or https://' }, 400);
    if (host !== 'localhost') target = target.replace(/^http:\/\//i, 'https://');
    let r;
    try {
      r = await fetch(target, {
        headers: { Accept: 'text/calendar, text/plain, */*', 'User-Agent': 'Calendora/1.0' },
        redirect: 'follow',
        ...(url.searchParams.get('fresh') ? {} : { cf: { cacheTtl: 600, cacheEverything: true } }),
      });
    } catch (e) { return json({ error: 'Could not reach that calendar' }, 502); }
    if (r.status === 404 || r.status === 403) return json({ error: 'Calendar link not found — is Public Calendar still turned on?' }, 502);
    if (!r.ok) return json({ error: `The calendar server answered ${r.status}` }, 502);
    const text = await r.text();
    if (text.length > 10000000) return json({ error: 'That calendar is too large' }, 502);
    if (!text.includes('BEGIN:VCALENDAR')) return json({ error: 'That link is not a calendar feed' }, 502);
    return new Response(text, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env, url, ctx); }
      catch (e) { return json({ error: 'Server error' }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    if (env.DB && env.ANYLIST_EMAIL) ctx.waitUntil(anylistSync(env).catch(() => {}));
  },
};
