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
const BOARD_ID = 'family';               // the first family's id (its data predates multi-family support)
const MAX_FAMILIES_PER_IP_DAY = 3;      // new families per network per day
const MAX_IMAGES_PER_FAMILY = 400;
const INVITE_DAYS = 14;
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
    // Last good copy of each outside calendar, so every device can show it when Google or Apple can't be reached.
    db.prepare('CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
    // Families, the Google accounts in them, and invite links
    db.prepare('CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, passcode TEXT, epoch INTEGER NOT NULL DEFAULT 1, anylist TEXT, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS accounts (sub TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, family_id TEXT, role TEXT, created_at INTEGER NOT NULL, last_seen INTEGER)'),
    db.prepare('CREATE INDEX IF NOT EXISTS accounts_family ON accounts (family_id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, family_id TEXT NOT NULL, created_by TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, max_uses INTEGER NOT NULL DEFAULT 20)'),
  ]);
  // photos belong to a family
  const cols = await db.prepare('PRAGMA table_info(images)').all();
  if (!(cols.results || []).some(c => c.name === 'family_id')) await db.prepare(`ALTER TABLE images ADD COLUMN family_id TEXT NOT NULL DEFAULT '${BOARD_ID}'`).run();
  // The board that existed before families becomes family #1, keeping its passcode and signed-in devices.
  if (!(await db.prepare('SELECT 1 FROM families WHERE id = ?').bind(BOARD_ID).first())) {
    const hadBoard = await db.prepare('SELECT 1 FROM board WHERE id = ?').bind(BOARD_ID).first();
    const pass = await getConfig(db, 'passcode');
    if (hadBoard || pass) {
      await db.prepare('INSERT OR IGNORE INTO families (id, name, code, passcode, epoch, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(BOARD_ID, 'Our family', await newFamilyCode(db), pass, Number((await getConfig(db, 'session_epoch')) || 1), Date.now()).run();
    }
  }
  schemaReady = true;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
function randomCode(n) { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join(''); }
async function newFamilyCode(db) {
  for (let i = 0; i < 10; i++) { const c = randomCode(6); if (!(await db.prepare('SELECT 1 FROM families WHERE code = ?').bind(c).first())) return c; }
  return randomCode(8);
}
const famKey = (fid, k) => (fid === BOARD_ID ? k : `${fid}:${k}`); // family #1 keeps its existing config keys
async function getFamily(db, fid) { return fid ? db.prepare('SELECT * FROM families WHERE id = ?').bind(fid).first() : null; }
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
// Cookie payload: 2|familyId|googleSub|epoch|expires. A Google account has a sub; a tablet signed in with the
// family passcode has none. A Google account that hasn't created or joined a family yet has no familyId.
// Cookies from before families ("epoch:expires") belong to family #1's devices.
async function makeSessionCookie(db, fid, sub = '', epoch = 1) {
  const payload = `2|${fid || ''}|${sub || ''}|${epoch}|${Math.floor(Date.now() / 1000) + SESSION_TTL}`;
  const sig = await crypto.subtle.sign('HMAC', await signingKey(db), te.encode(payload));
  const token = `${b64u(te.encode(payload))}.${b64u(sig)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`;
}
const clearCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
async function readSession(request, db) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s) return null;
  let payload;
  try { payload = td.decode(fromB64u(p)); } catch (e) { return null; }
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await signingKey(db), fromB64u(s), te.encode(payload)); } catch (e) { return null; }
  if (!ok) return null;
  let fid, sub, epoch, exp;
  if (payload.startsWith('2|')) [, fid, sub, epoch, exp] = payload.split('|');
  else { [epoch, exp] = payload.split(':'); fid = BOARD_ID; sub = ''; }
  if (!(Number(exp) > Date.now() / 1000)) return null;
  const account = sub ? await db.prepare('SELECT * FROM accounts WHERE sub = ?').bind(sub).first() : null;
  if (sub && !account) return null;
  if (sub && (account.family_id || '') !== (fid || '')) return { sub, account, fid: '', family: null, stale: true }; // removed or moved: sign in again
  const family = fid ? await getFamily(db, fid) : null;
  if (fid && !family) return null;
  if (family && String(family.epoch) !== String(epoch)) return null; // "sign out all devices" was used
  return { fid: fid || '', sub: sub || '', account, family, device: !sub };
}
const isManager = sess => !!(sess && sess.account && (sess.account.role === 'owner' || sess.account.role === 'admin'));

// ------------------------------------------------------------------ Google sign-in (ID token check)
let googleKeys = null, googleKeysAt = 0;
async function googleKey(kid) {
  if (!googleKeys || Date.now() - googleKeysAt > 3600e3 || !googleKeys.find(k => k.kid === kid)) {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!r.ok) throw new Error('Google keys unavailable');
    googleKeys = (await r.json()).keys || []; googleKeysAt = Date.now();
  }
  return googleKeys.find(k => k.kid === kid) || null;
}
async function verifyGoogleToken(token, clientId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !clientId) return null;
  let head, body;
  try { head = JSON.parse(td.decode(fromB64u(parts[0]))); body = JSON.parse(td.decode(fromB64u(parts[1]))); } catch (e) { return null; }
  if (head.alg !== 'RS256') return null;
  const jwk = await googleKey(head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64u(parts[2]), te.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  const now = Date.now() / 1000;
  if (body.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(body.iss) || !(body.exp > now) || !body.sub) return null;
  if (body.email && body.email_verified === false) return null;
  return body;
}

// ------------------------------------------------------------------ per-family secrets (AnyList sign-in), AES-GCM
async function dataKey(db, env) {
  let raw = env.DATA_KEY || await getConfig(db, 'data_key');
  if (!raw) { await db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)').bind('data_key', b64u(crypto.getRandomValues(new Uint8Array(32)))).run(); raw = await getConfig(db, 'data_key'); }
  const bytes = /^[A-Za-z0-9_-]{43}$/.test(raw) ? fromB64u(raw) : new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(raw)));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function sealJson(db, env, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await dataKey(db, env), te.encode(JSON.stringify(obj)));
  return `g1.${b64u(iv)}.${b64u(ct)}`;
}
async function openJson(db, env, sealed) {
  if (!sealed) return null;
  try { const [, iv, ct] = sealed.split('.'); return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(iv) }, await dataKey(db, env), fromB64u(ct)))); } catch (e) { return null; }
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
    11: b => { it.category = td8.decode(b); }, 13: b => { it.categoryMatchId = td8.decode(b); },
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

// Each family's own AnyList sign-in: saved (encrypted) in Settings; family #1 can also use the Cloudflare secrets.
async function anylistCreds(db, env, fid) {
  const fam = await getFamily(db, fid);
  const c = fam ? await openJson(db, env, fam.anylist) : null;
  if (c && c.email && c.password) return c;
  if (fid === BOARD_ID && env.ANYLIST_EMAIL && env.ANYLIST_PASSWORD) return { email: env.ANYLIST_EMAIL, password: env.ANYLIST_PASSWORD, fromEnv: true };
  return null;
}
async function alSaveTokens(db, fid, t) { await setConfig(db, famKey(fid, 'anylist_tokens'), JSON.stringify(t)); }
async function alLogin(creds, t) {
  const f = new FormData(); f.append('email', creds.email); f.append('password', creds.password);
  const r = await fetch(`${AL_BASE}/auth/token`, { method: 'POST', body: f, headers: { 'X-AnyLeaf-API-Version': '3' } });
  if (r.status === 400 || r.status === 401) throw new ALError('AnyList did not accept the email or password', 'auth');
  if (!r.ok) throw new ALError(`AnyList sign-in failed (${r.status})`);
  const j = await r.json();
  t.access = j.access_token; t.refresh = j.refresh_token;
  try { const p = JSON.parse(td8.decode(fromB64u(t.access.split('.')[1]))); t.userId = p.sub || p.user_id || p.uid || ''; } catch (e) { t.userId = t.userId || ''; }
}
async function alRefresh(creds, t) {
  const f = new FormData(); f.append('refresh_token', t.refresh || '');
  const r = await fetch(`${AL_BASE}/auth/token/refresh`, { method: 'POST', body: f, headers: { 'X-AnyLeaf-API-Version': '3' } });
  if (r.ok) { const j = await r.json(); t.access = j.access_token; t.refresh = j.refresh_token; } else await alLogin(creds, t);
}
async function alTokens(db, fid, creds) {
  let t = {};
  try { t = JSON.parse((await getConfig(db, famKey(fid, 'anylist_tokens'))) || '{}') || {}; } catch (e) { t = {}; }
  if (t.email !== creds.email) t = { email: creds.email }; // credentials changed
  if (!t.clientId) t.clientId = alId();
  if (!t.access) { await alLogin(creds, t); await alSaveTokens(db, fid, t); }
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
async function alPost(db, fid, creds, t, path, makeBody) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const b = makeBody ? makeBody() : null;
    const headers = { 'X-AnyLeaf-API-Version': '3', 'X-AnyLeaf-Client-Identifier': t.clientId, authorization: `Bearer ${t.access}` };
    if (b) headers['Content-Type'] = b.type;
    const r = await fetch(`${AL_BASE}/${path}`, { method: 'POST', body: b ? b.body : undefined, headers });
    if (r.status === 401 && attempt === 0) { await alRefresh(creds, t); await alSaveTokens(db, fid, t); continue; }
    if (!r.ok) throw new ALError(`AnyList answered ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  throw new ALError('AnyList sign-in expired');
}

async function anylistSync(env, fid, { force = false } = {}) {
  const db = env.DB;
  await ensureSchema(db);
  const creds = await anylistCreds(db, env, fid);
  if (!creds) return { skipped: 'not-configured' };
  const K = k => famKey(fid, k);
  const row = await db.prepare('SELECT data, version FROM board WHERE id = ?').bind(fid).first();
  if (!row) return { skipped: 'no-board' };
  let board;
  try { board = JSON.parse(row.data); } catch (e) { return { skipped: 'bad-board' }; }
  const cfg = (board.settings && board.settings.anylist) || {};
  if (!cfg.on) return { skipped: 'off' };
  const now = Date.now();
  if (now - Number((await getConfig(db, K('anylist_lock'))) || 0) < 60000) return { skipped: 'busy' };
  if (!force && now - Number((await getConfig(db, K('anylist_last'))) || 0) < 8000) return { skipped: 'recent' };
  await setConfig(db, K('anylist_lock'), String(now));
  let status;
  try {
    status = await anylistSyncOnce(db, fid, creds, board, row.version, cfg);
  } catch (e) {
    if (e.code === 'retry') status = null;
    else status = { ok: false, error: e.message || 'AnyList sync failed', at: Date.now() };
  } finally {
    await setConfig(db, K('anylist_lock'), '0');
    await setConfig(db, K('anylist_last'), String(Date.now()));
  }
  if (status) await setConfig(db, K('anylist_status'), JSON.stringify(status));
  return status || { skipped: 'retry' };
}

async function anylistSyncOnce(db, fid, creds, board, version, cfg) {
  if (!Array.isArray(board.lists)) board.lists = [];
  const lists = board.lists;
  const t = await alTokens(db, fid, creds);
  const alists = alDecodeLists(await alPost(db, fid, creds, t, 'data/user-data/get'));
  const wantName = String(cfg.listName || 'Groceries').trim().toLowerCase();
  const al = alists.find(l => (l.name || '').trim().toLowerCase() === wantName);
  if (!al) throw new ALError(`No AnyList list called “${cfg.listName || 'Groceries'}”. Your lists: ${alists.map(l => l.name).join(', ') || 'none'}`);
  const shopId = board.settings && board.settings.shoppingListId;
  let cl = lists.find(l => l.id === cfg.listId) || lists.find(l => l.id === shopId) || lists.find(l => /grocer|need to buy|shopping/i.test(l.name || '')) || lists.find(l => (l.name || '').trim().toLowerCase() === (al.name || '').trim().toLowerCase());
  let created = false;
  if (!cl) { cl = { id: `l${alId().slice(0, 12)}`, name: 'Need to Buy', emoji: '🛒', items: [], split: true }; lists.unshift(cl); created = true; }
  cl.items = Array.isArray(cl.items) ? cl.items : [];

  let map = null;
  try { map = JSON.parse((await getConfig(db, famKey(fid, 'anylist_map'))) || 'null'); } catch (e) { map = null; }
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
    const alCat = a.categoryMatchId || a.category || '';
    if (alCat && c.alCat !== alCat) { c.alCat = alCat; changed = true; }
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
    const alCat = a.categoryMatchId || a.category || '';
    cl.items.unshift(alCat ? { id, text: a.name, done: false, alCat } : { id, text: a.name, done: false });
    links.push({ c: id, a: a.id, name: a.name, checked: false });
    changed = true; pulled++;
  }

  if (changed) {
    const res = await db.prepare('UPDATE board SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
      .bind(JSON.stringify(board), Date.now(), fid, version).run();
    if (!res.meta || res.meta.changes !== 1) throw new ALError('board changed', 'retry');
  }
  if (ops.length) {
    const bin = alEncodeOps(ops); // like the official clients, no user id
    await alPost(db, fid, creds, t, 'data/shopping-lists/update', () => alForm('operations', bin));
  }
  const validA = new Set(al.items.map(a => a.id));
  await setConfig(db, famKey(fid, 'anylist_map'), JSON.stringify({ cl: cl.id, al: al.id, links, ignored: [...ignored].filter(id => validA.has(id)) }));
  return { ok: true, at: Date.now(), listName: al.name, calendoraList: cl.name, pushed: ops.length, pulled, items: links.length };
}

// ------------------------------------------------------------------ API
// ---- RSS / Atom headlines
const DEFAULT_NEWS = [{ id: 'npr', name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' }, { id: 'bbcworld', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }];
function xmlText(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|laquo|raquo);/g, (_, n) => ({ ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»' })[n]).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
const xmlTag = (block, tag) => { const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block); return m ? m[1] : ''; };
// The article's picture, when the feed provides one (media:thumbnail / media:content / image enclosure / first <img>)
function feedImage(b) {
  const pick = re => { const m = re.exec(b); return m ? m[1].replace(/&amp;/g, '&') : ''; };
  const cands = [
    pick(/<media:thumbnail\b[^>]*?url=["']([^"']+)["']/i),
    pick(/<media:content\b(?=[^>]*(?:medium=["']image["']|type=["']image\/))[^>]*?url=["']([^"']+)["']/i),
    pick(/<media:content\b[^>]*?url=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i),
    pick(/<enclosure\b(?=[^>]*type=["']image\/)[^>]*?url=["']([^"']+)["']/i),
    pick(/<img\b[^>]*?src=["']([^"']+)["']/i) || pick(/&lt;img\b[^&]*?src=(?:&quot;|["'])([^"'&]+)/i),
  ];
  const u = cands.find(x => /^https:\/\//i.test(x)) || '';
  return u.length < 600 ? u : '';
}
function parseFeed(xml) {
  const feedTitle = xmlText(xmlTag(xml.replace(/<(item|entry)[\s>][\s\S]*$/i, ''), 'title'));
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    const title = xmlText(xmlTag(b, 'title'));
    let link = xmlText(xmlTag(b, 'link'));
    if (!link) { const m = /<link\b[^>]*?href=["']([^"']+)["'][^>]*>/i.exec(b); link = m ? m[1].replace(/&amp;/g, '&') : ''; }
    if (!/^https?:\/\//i.test(link)) { const g = xmlText(xmlTag(b, 'guid')); if (/^https?:\/\//i.test(g)) link = g; }
    const when = xmlText(xmlTag(b, 'pubDate') || xmlTag(b, 'published') || xmlTag(b, 'updated') || xmlTag(b, 'dc:date'));
    const t = Date.parse(when);
    return { title: title.slice(0, 220), link: /^https?:\/\//i.test(link) ? link : '', time: Number.isFinite(t) ? t : 0, feedTitle, image: feedImage(b) };
  }).filter(x => x.title);
}
async function readFeed(url, ctx) {
  const cache = caches.default, key = new Request(`https://news-cache-v2.calendora/${encodeURIComponent(url)}`);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit.json();
  let r;
  try { r = await fetch(url, { headers: { 'User-Agent': 'Calendora family calendar (RSS reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }, cf: { cacheTtl: 600 } }); }
  catch (e) { throw new Error('Could not reach that feed'); }
  if (!r.ok) throw new Error(`The feed answered ${r.status}`);
  const text = (await r.text()).slice(0, 3000000);
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text)) throw new Error('That link is not an RSS or Atom feed');
  const items = parseFeed(text);
  const res = new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=900' } });
  if (ctx) ctx.waitUntil(cache.put(key, res)); else await cache.put(key, res).catch(() => {});
  return items;
}
// One well-known passage per day for the ESV Verse of the Day (references only; text comes from Crossway's API)
const VERSE_REFS = ["Genesis 1:1", "Genesis 50:20", "Exodus 14:14", "Exodus 15:2", "Numbers 6:24-26", "Deuteronomy 6:5", "Deuteronomy 31:6", "Deuteronomy 31:8", "Joshua 1:9", "Joshua 24:15", "1 Samuel 16:7", "2 Samuel 22:31", "1 Chronicles 16:11", "1 Chronicles 16:34", "2 Chronicles 7:14", "Nehemiah 8:10", "Job 19:25", "Psalm 1:1-2", "Psalm 4:8", "Psalm 16:8", "Psalm 16:11", "Psalm 18:2", "Psalm 19:1", "Psalm 19:14", "Psalm 23:1", "Psalm 23:4", "Psalm 27:1", "Psalm 27:14", "Psalm 28:7", "Psalm 31:24", "Psalm 32:8", "Psalm 34:8", "Psalm 34:18", "Psalm 37:4", "Psalm 37:5", "Psalm 46:1", "Psalm 46:10", "Psalm 51:10", "Psalm 55:22", "Psalm 56:3", "Psalm 62:1-2", "Psalm 73:26", "Psalm 90:12", "Psalm 91:1-2", "Psalm 91:11", "Psalm 100:4-5", "Psalm 103:2-3", "Psalm 103:12", "Psalm 118:24", "Psalm 119:11", "Psalm 119:105", "Psalm 121:1-2", "Psalm 127:1", "Psalm 133:1", "Psalm 136:1", "Psalm 139:14", "Psalm 143:8", "Psalm 145:18", "Psalm 147:3", "Psalm 150:6", "Proverbs 3:5-6", "Proverbs 3:9", "Proverbs 4:23", "Proverbs 15:1", "Proverbs 16:3", "Proverbs 16:9", "Proverbs 17:17", "Proverbs 18:10", "Proverbs 22:6", "Proverbs 27:17", "Proverbs 31:25", "Ecclesiastes 3:1", "Ecclesiastes 4:9-10", "Isaiah 9:6", "Isaiah 26:3", "Isaiah 30:15", "Isaiah 40:8", "Isaiah 40:29", "Isaiah 40:31", "Isaiah 41:10", "Isaiah 43:2", "Isaiah 43:19", "Isaiah 53:5", "Isaiah 55:8-9", "Isaiah 58:11", "Jeremiah 17:7", "Jeremiah 29:11", "Jeremiah 31:3", "Jeremiah 33:3", "Lamentations 3:22-23", "Micah 6:8", "Nahum 1:7", "Habakkuk 3:19", "Zephaniah 3:17", "Matthew 5:9", "Matthew 5:14-16", "Matthew 6:33", "Matthew 6:34", "Matthew 7:7", "Matthew 11:28-29", "Matthew 19:26", "Matthew 22:37-39", "Matthew 28:19-20", "Mark 9:23", "Mark 10:27", "Mark 12:30", "Luke 1:37", "Luke 6:31", "Luke 6:38", "John 1:5", "John 3:16", "John 8:12", "John 10:10", "John 11:25", "John 13:34-35", "John 14:6", "John 14:27", "John 15:5", "John 15:13", "John 16:33", "Acts 1:8", "Acts 2:42", "Acts 20:35", "Romans 5:8", "Romans 8:1", "Romans 8:28", "Romans 8:38-39", "Romans 10:9", "Romans 12:2", "Romans 12:12", "Romans 15:13", "1 Corinthians 10:13", "1 Corinthians 13:4-7", "1 Corinthians 13:13", "1 Corinthians 15:58", "1 Corinthians 16:14", "2 Corinthians 4:16-18", "2 Corinthians 5:7", "2 Corinthians 5:17", "2 Corinthians 12:9", "Galatians 2:20", "Galatians 5:22-23", "Galatians 6:9", "Ephesians 2:8-9", "Ephesians 2:10", "Ephesians 3:20", "Ephesians 4:2", "Ephesians 4:32", "Ephesians 6:10", "Philippians 1:6", "Philippians 2:3-4", "Philippians 4:4", "Philippians 4:6-7", "Philippians 4:8", "Philippians 4:13", "Philippians 4:19", "Colossians 3:2", "Colossians 3:12", "Colossians 3:15", "Colossians 3:23", "1 Thessalonians 5:11", "1 Thessalonians 5:16-18", "2 Thessalonians 3:3", "1 Timothy 4:12", "2 Timothy 1:7", "2 Timothy 3:16-17", "Titus 3:5", "Hebrews 4:16", "Hebrews 10:23", "Hebrews 11:1", "Hebrews 12:1-2", "Hebrews 13:5", "Hebrews 13:8", "James 1:2-3", "James 1:5", "James 1:17", "James 1:19", "James 4:8", "1 Peter 3:15", "1 Peter 5:7", "2 Peter 3:9", "1 John 1:9", "1 John 3:1", "1 John 4:7", "1 John 4:18", "1 John 4:19", "Revelation 21:4", "Revelation 3:20"];
const gSnapPrefix = fid => (fid === BOARD_ID ? 'google:' : `g:${fid}:`); // family #1 keeps its existing copies
const SNAP_MAX = 1900000; // D1 keeps up to ~2 MB in one value
async function putSnapshot(db, key, data) {
  if (data.length > SNAP_MAX) return false;
  await db.prepare('INSERT INTO snapshots (key, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(key, data, Date.now()).run();
  return true;
}
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

  const origin = `${url.protocol}//${url.host}`;
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const ownerEmails = String(env.OWNER_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const familyOut = f => (f ? { id: f.id, name: f.name, code: f.code, hasPasscode: !!f.passcode } : null);
  const accountOut = a => (a ? { email: a.email, name: a.name, picture: a.picture, role: a.role } : null);
  const signIn = async (fid, sub) => {
    const fam = fid ? await getFamily(db, fid) : null;
    return makeSessionCookie(db, fid, sub, fam ? fam.epoch : 0);
  };
  const joinFamily = async (acc, fid, role) => {
    await db.prepare('UPDATE accounts SET family_id = ?, role = ? WHERE sub = ?').bind(fid, role, acc.sub).run();
    acc.family_id = fid; acc.role = role;
  };
  const useInvite = async (acc, code) => {
    const inv = code ? await db.prepare('SELECT * FROM invites WHERE code = ?').bind(String(code).trim().toUpperCase()).first() : null;
    if (!inv || inv.expires_at < Date.now() || inv.uses >= inv.max_uses || !(await getFamily(db, inv.family_id))) return { error: 'That invite has expired or was already used up — ask for a new one' };
    if (acc.family_id && acc.family_id !== inv.family_id) return { error: 'You’re already in another family. Leave it in Settings first, then open the invite again.' };
    if (acc.family_id !== inv.family_id) { await joinFamily(acc, inv.family_id, 'member'); await db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?').bind(inv.code).run(); }
    return { ok: true };
  };

  if (path === '/api/session' && method === 'GET') {
    const sess = await readSession(request, db);
    return json({
      configured: true, multi: true, googleClientId: clientId,
      signedIn: !!(sess && sess.fid), needsFamily: !!(sess && sess.sub && !sess.fid),
      family: familyOut(sess && sess.family), account: accountOut(sess && sess.account), device: !!(sess && sess.device),
    });
  }

  if (path === '/api/setup' && method === 'POST') return json({ error: 'Sign in with Google to create a family' }, 410);

  // Sign in with Google: verify the ID token, then sign in to the account's family (joining by invite if given).
  if (path === '/api/auth/google' && method === 'POST') {
    const ip = clientIp(request);
    if (await tooManyFails(db, ip)) return json({ error: 'Too many tries — wait 15 minutes and try again' }, 429);
    const body = await readJson(request);
    let g = null;
    try { g = await verifyGoogleToken(body && body.credential, clientId); } catch (e) { return json({ error: 'Google sign-in is unavailable right now — try again shortly' }, 502); }
    if (!g) { await recordFail(db, ip); return json({ error: 'Google sign-in could not be confirmed — try again' }, 401); }
    const now = Date.now();
    await db.prepare(`INSERT INTO accounts (sub, email, name, picture, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_seen = excluded.last_seen`)
      .bind(g.sub, g.email || '', g.name || g.email || '', g.picture || '', now, now).run();
    const acc = await db.prepare('SELECT * FROM accounts WHERE sub = ?').bind(g.sub).first();
    let note = '';
    if (body && body.invite) { const r = await useInvite(acc, body.invite); if (r.error) note = r.error; }
    // the people who run this Calendora (OWNER_EMAILS) own family #1
    if (!acc.family_id && ownerEmails.includes(String(acc.email).toLowerCase()) && (await getFamily(db, BOARD_ID))) await joinFamily(acc, BOARD_ID, 'owner');
    return json({ ok: true, needsFamily: !acc.family_id, note }, 200, { 'Set-Cookie': await signIn(acc.family_id || '', acc.sub) });
  }

  // Tablet sign-in with a family code + passcode (family #1's old screen sends only the passcode)
  if (path === '/api/login' && method === 'POST') {
    const ip = clientIp(request);
    if (await tooManyFails(db, ip)) return json({ error: 'Too many tries — wait 15 minutes and try again' }, 429);
    const body = await readJson(request);
    const code = String((body && body.family) || '').trim().toUpperCase();
    const fam = code ? await db.prepare('SELECT * FROM families WHERE code = ?').bind(code).first() : await getFamily(db, BOARD_ID);
    if (!fam || !fam.passcode || !body || typeof body.passcode !== 'string' || !(await checkPasscode(fam.passcode, body.passcode))) {
      await recordFail(db, ip);
      return json({ error: code || !body || !body.family ? 'That family code or passcode is not right' : 'That passcode is not right' }, 401);
    }
    await clearFails(db, ip);
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn(fam.id, '') });
  }

  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });

  const sess = await readSession(request, db);
  if (!sess) return json({ error: 'Not signed in' }, 401);

  // Google account without a family yet: create one, or join with an invite
  if (path === '/api/family/create' && method === 'POST') {
    if (!sess.account) return json({ error: 'Sign in with Google to create a family' }, 403);
    if (sess.account.family_id) return json({ error: 'You’re already in a family' }, 409);
    const ip = `new-family:${clientIp(request)}`;
    const row = await db.prepare('SELECT count, window_start FROM login_attempts WHERE ip = ?').bind(ip).first();
    if (row && Date.now() / 1000 - row.window_start < 86400 && row.count >= MAX_FAMILIES_PER_IP_DAY) return json({ error: 'Too many new families from this network today — try again tomorrow' }, 429);
    const body = await readJson(request);
    const name = String((body && body.name) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return json({ error: 'Give your family a name' }, 400);
    const fid = `f${b64u(crypto.getRandomValues(new Uint8Array(9)))}`;
    await db.prepare('INSERT INTO families (id, name, code, epoch, created_at) VALUES (?, ?, ?, 1, ?)').bind(fid, name, await newFamilyCode(db), Date.now()).run();
    await joinFamily(sess.account, fid, 'owner');
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?) ON CONFLICT(ip) DO UPDATE SET
      count = CASE WHEN ? - window_start > 86400 THEN 1 ELSE count + 1 END, window_start = CASE WHEN ? - window_start > 86400 THEN ? ELSE window_start END`).bind(ip, now, now, now, now).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn(fid, sess.sub) });
  }
  if (path === '/api/family/join' && method === 'POST') {
    if (!sess.account) return json({ error: 'Sign in with Google to join a family' }, 403);
    const body = await readJson(request);
    const code = String((body && body.code) || '').replace(/^.*[?&]invite=/, '').trim();
    const r = await useInvite(sess.account, code);
    if (r.error) return json({ error: r.error }, 400);
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn(sess.account.family_id, sess.sub) });
  }

  if (!sess.fid) return json({ error: 'Create or join a family first', needsFamily: true }, 403);
  const fid = sess.fid, fam = sess.family;
  if (sess.account) await db.prepare('UPDATE accounts SET last_seen = ? WHERE sub = ?').bind(Date.now(), sess.sub).run();

  // ---- family settings: people, invites, tablet passcode
  if (path === '/api/family' && method === 'GET') {
    const people = await db.prepare('SELECT sub, email, name, picture, role, last_seen FROM accounts WHERE family_id = ? ORDER BY created_at').bind(fid).all();
    const invites = isManager(sess) ? await db.prepare('SELECT code, created_at, expires_at, uses, max_uses FROM invites WHERE family_id = ? AND expires_at > ? ORDER BY created_at DESC').bind(fid, Date.now()).all() : { results: [] };
    return json({
      family: familyOut(fam), me: sess.sub || null, canManage: isManager(sess),
      people: (people.results || []).map(p => ({ id: p.sub, email: p.email, name: p.name, picture: p.picture, role: p.role, lastSeen: p.last_seen })),
      invites: (invites.results || []).map(i => ({ code: i.code, link: `${origin}/?invite=${i.code}`, expires: i.expires_at, uses: i.uses, maxUses: i.max_uses })),
    });
  }
  if (path.startsWith('/api/family/') && !isManager(sess) && path !== '/api/family/leave') return json({ error: 'Only the family’s owner or an admin can change this' }, 403);
  if (path === '/api/family/rename' && method === 'POST') {
    const body = await readJson(request);
    const name = String((body && body.name) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return json({ error: 'Give your family a name' }, 400);
    await db.prepare('UPDATE families SET name = ? WHERE id = ?').bind(name, fid).run();
    return json({ ok: true });
  }
  if (path === '/api/family/invite' && method === 'POST') {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM invites WHERE family_id = ? AND expires_at > ?').bind(fid, Date.now()).first();
    if (n && n.n >= 10) return json({ error: 'Too many open invites — remove one first' }, 429);
    const code = randomCode(10), now = Date.now();
    await db.prepare('INSERT INTO invites (code, family_id, created_by, created_at, expires_at, uses, max_uses) VALUES (?, ?, ?, ?, ?, 0, 20)').bind(code, fid, sess.sub, now, now + INVITE_DAYS * 864e5).run();
    return json({ code, link: `${origin}/?invite=${code}`, expires: now + INVITE_DAYS * 864e5 });
  }
  const invDel = path.match(/^\/api\/family\/invite\/([A-Z0-9]{6,12})$/);
  if (invDel && method === 'DELETE') { await db.prepare('DELETE FROM invites WHERE code = ? AND family_id = ?').bind(invDel[1], fid).run(); return json({ ok: true }); }
  if (path === '/api/family/member' && method === 'POST') {
    const body = await readJson(request) || {};
    const who = await db.prepare('SELECT * FROM accounts WHERE sub = ? AND family_id = ?').bind(String(body.id || ''), fid).first();
    if (!who) return json({ error: 'That person isn’t in this family' }, 404);
    if (who.role === 'owner' && sess.account.role !== 'owner') return json({ error: 'Only the owner can change the owner' }, 403);
    if (body.remove) {
      if (who.sub === sess.sub) return json({ error: 'Use “Leave this family” to remove yourself' }, 400);
      await db.prepare('UPDATE accounts SET family_id = NULL, role = NULL WHERE sub = ?').bind(who.sub).run();
      return json({ ok: true });
    }
    if (['admin', 'member'].includes(body.role) && who.role !== 'owner') { await db.prepare('UPDATE accounts SET role = ? WHERE sub = ?').bind(body.role, who.sub).run(); return json({ ok: true }); }
    return json({ error: 'Nothing to change' }, 400);
  }
  if (path === '/api/family/leave' && method === 'POST') {
    if (!sess.account) return json({ error: 'This tablet isn’t a person — use Sign out instead' }, 400);
    if (sess.account.role === 'owner') {
      const others = await db.prepare("SELECT sub FROM accounts WHERE family_id = ? AND sub != ? ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at").bind(fid, sess.sub).all();
      const next = (others.results || [])[0];
      if (next) await db.prepare("UPDATE accounts SET role = 'owner' WHERE sub = ?").bind(next.sub).run(); // hand the family to the next person
    }
    await db.prepare('UPDATE accounts SET family_id = NULL, role = NULL WHERE sub = ?').bind(sess.sub).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn('', sess.sub) });
  }
  if (path === '/api/family/passcode' && method === 'POST') {
    const body = await readJson(request) || {};
    if (body.remove) { await db.prepare('UPDATE families SET passcode = NULL WHERE id = ?').bind(fid).run(); return json({ ok: true }); }
    if (!validPasscode(body.next)) return json({ error: 'Choose a passcode of at least 4 characters' }, 400);
    await db.prepare('UPDATE families SET passcode = ? WHERE id = ?').bind(await makePasscodeRecord(body.next), fid).run();
    return json({ ok: true });
  }

  if (path === '/api/logout-all' && method === 'POST') {
    if (sess.account && !isManager(sess)) return json({ error: 'Only the family’s owner or an admin can do this' }, 403);
    await db.prepare('UPDATE families SET epoch = epoch + 1 WHERE id = ?').bind(fid).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn(fid, sess.sub) }); // keep this device signed in
  }

  if (path === '/api/passcode' && method === 'POST') { // tablet passcode change from an old screen
    const body = await readJson(request);
    if (!body || !validPasscode(body.next)) return json({ error: 'Choose a passcode of at least 4 characters' }, 400);
    if (!isManager(sess) && !(fam.passcode && await checkPasscode(fam.passcode, body.current || ''))) return json({ error: 'Current passcode is not right' }, 401);
    await db.prepare('UPDATE families SET passcode = ?, epoch = epoch + 1 WHERE id = ?').bind(await makePasscodeRecord(body.next), fid).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await signIn(fid, sess.sub) });
  }

  if (path === '/api/board' && method === 'GET') {
    const row = await db.prepare('SELECT data, version, updated_at FROM board WHERE id = ?').bind(fid).first();
    if (!row) return json({ version: 0, data: null, familyId: fid });
    const since = Number(url.searchParams.get('since'));
    if (url.searchParams.has('since') && since === row.version) return json({ version: row.version, unchanged: true, familyId: fid });
    return json({ version: row.version, updatedAt: row.updated_at, data: JSON.parse(row.data), familyId: fid });
  }

  if (path === '/api/board' && method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BOARD_BYTES) return json({ error: 'The family board is too large to save' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body.data !== 'object' || body.data === null || !Number.isInteger(body.baseVersion)) return json({ error: 'Invalid board' }, 400);
    if (body.familyId && body.familyId !== fid) return json({ error: 'This device switched families — reload Calendora', wrongFamily: true }, 409);
    const data = JSON.stringify(body.data);
    const now = Date.now();
    let res;
    if (body.baseVersion === 0) {
      res = await db.prepare('INSERT OR IGNORE INTO board (id, data, version, updated_at) VALUES (?, ?, 1, ?)').bind(fid, data, now).run();
    } else {
      res = await db.prepare('UPDATE board SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(data, now, fid, body.baseVersion).run();
    }
    if (res.meta && res.meta.changes === 1) {
      const al = body.data.settings && body.data.settings.anylist;
      if (al && al.on && ctx && ctx.waitUntil) ctx.waitUntil(anylistSync(env, fid).catch(() => {}));
      return json({ ok: true, version: body.baseVersion + 1, updatedAt: now });
    }
    // someone else saved first: send back what is on the server
    const row = await db.prepare('SELECT data, version, updated_at FROM board WHERE id = ?').bind(fid).first();
    return json({ error: 'conflict', version: row ? row.version : 0, updatedAt: row ? row.updated_at : 0, data: row ? JSON.parse(row.data) : null }, 409);
  }

  if (path === '/api/anylist' && method === 'GET') {
    let status = null;
    try { status = JSON.parse((await getConfig(db, famKey(fid, 'anylist_status'))) || 'null'); } catch (e) { status = null; }
    const creds = await anylistCreds(db, env, fid);
    return json({ configured: !!creds, email: creds && !creds.fromEnv ? creds.email : (creds ? 'set on Cloudflare' : ''), canManage: isManager(sess) || !!sess.device, status });
  }
  if (path === '/api/anylist/login' && method === 'POST') {
    if (sess.account && !isManager(sess)) return json({ error: 'Only the family’s owner or an admin can connect AnyList' }, 403);
    const body = await readJson(request) || {};
    if (body.remove) {
      await db.prepare('UPDATE families SET anylist = NULL WHERE id = ?').bind(fid).run();
      await setConfig(db, famKey(fid, 'anylist_tokens'), '{}');
      return json({ ok: true });
    }
    const email = String(body.email || '').trim(), password = String(body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return json({ error: 'Enter your AnyList email and password' }, 400);
    const t = {};
    try { await alLogin({ email, password }, t); } catch (e) { return json({ error: e.message || 'AnyList did not accept that sign-in' }, 400); }
    await db.prepare('UPDATE families SET anylist = ? WHERE id = ?').bind(await sealJson(db, env, { email, password }), fid).run();
    await alSaveTokens(db, fid, { ...t, email, clientId: alId() });
    return json({ ok: true, email });
  }
  if (path === '/api/anylist/sync' && method === 'POST') {
    const r = await anylistSync(env, fid, { force: true });
    if (r && r.skipped === 'not-configured') return json({ error: 'Connect your AnyList account first' }, 400);
    if (r && r.skipped === 'off') return json({ error: 'Turn on AnyList sync first' }, 400);
    let status = null;
    try { status = JSON.parse((await getConfig(db, famKey(fid, 'anylist_status'))) || 'null'); } catch (e) { status = null; }
    return json({ result: r, status });
  }

  if (path === '/api/images' && method === 'POST') {
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ error: 'Only JPEG, PNG or WebP photos' }, 415);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return json({ error: 'Empty photo' }, 400);
    if (buf.byteLength > MAX_IMAGE_BYTES) return json({ error: 'That photo is too large' }, 413);
    const n = await db.prepare('SELECT COUNT(*) AS n FROM images WHERE family_id = ?').bind(fid).first();
    if (n && n.n >= MAX_IMAGES_PER_FAMILY) return json({ error: 'Your family has reached the photo limit — delete some recipe photos first' }, 413);
    const id = b64u(crypto.getRandomValues(new Uint8Array(12)));
    await db.prepare('INSERT INTO images (id, type, data, created_at, family_id) VALUES (?, ?, ?, ?, ?)').bind(id, type, buf, Date.now(), fid).run();
    return json({ id });
  }

  const imgMatch = path.match(/^\/api\/images\/([A-Za-z0-9_-]{8,40})$/);
  if (imgMatch && method === 'GET') {
    const row = await db.prepare('SELECT type, data FROM images WHERE id = ? AND family_id = ?').bind(imgMatch[1], fid).first();
    if (!row) return json({ error: 'Photo not found' }, 404);
    const data = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
    return new Response(data, { headers: { 'Content-Type': row.type, 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
  if (imgMatch && method === 'DELETE') {
    await db.prepare('DELETE FROM images WHERE id = ? AND family_id = ?').bind(imgMatch[1], fid).run();
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

  if (path === '/api/categorize' && method === 'POST') {
    if (!env.AI) return json({ error: 'Sorting is not switched on' }, 501);
    const body = await readJson(request);
    const items = Array.isArray(body && body.items) ? body.items.slice(0, 40).map(x => String(x).replace(/\s+/g, ' ').slice(0, 80)) : [];
    if (!items.length) return json({ cats: [] });
    const prompt = 'Sort each shopping-list item into "grocery" (food, drinks, cooking ingredients, snacks — things from the food aisles of a supermarket) ' +
      'or "other" (household, cleaning, paper goods, personal care, medicine, pet supplies, clothing, toys, hardware, activities — anything that is not food or drink). ' +
      `Reply with ONLY a JSON array of ${items.length} strings, each "grocery" or "other", in the same order.\nItems:\n${items.map((x, i) => `${i + 1}. ${x}`).join('\n')}`;
    let out;
    try { out = await env.AI.run(VISION_MODEL, { messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0 }); }
    catch (e) { return json({ error: 'Sorting is busy — try again later' }, 502); }
    const text = out && (out.response !== undefined ? out.response : out);
    let arr = Array.isArray(text) ? text : null;
    if (!arr) { const s2 = String(text || ''); const a = s2.indexOf('['), b = s2.lastIndexOf(']'); try { arr = JSON.parse(s2.slice(a, b + 1)); } catch (e) { arr = []; } }
    const cats = items.map((_, i) => { const v = String(arr[i] || '').toLowerCase(); return v.startsWith('groc') ? 'grocery' : v.startsWith('oth') ? 'other' : null; });
    return json({ cats });
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

  // Google Calendar copies, one per Google account, written by whichever device last synced it.
  if (path === '/api/snapshots' && method === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0;
    const prefix = gSnapPrefix(fid);
    const rows = await db.prepare('SELECT key, data, updated_at FROM snapshots WHERE key LIKE ?').bind(`${prefix}%`).all();
    const out = {};
    for (const r of rows.results || []) { const acct = r.key.slice(prefix.length); if (acct.includes(':')) continue; out[acct] = r.updated_at > since ? { at: r.updated_at, data: JSON.parse(r.data) } : { at: r.updated_at, unchanged: true }; }
    return json({ google: out });
  }
  if (path.startsWith('/api/snapshots/google/')) {
    const acct = decodeURIComponent(path.slice('/api/snapshots/google/'.length));
    if (!/^[^\s/@]+@[^\s/@]+$/.test(acct)) return json({ error: 'Bad account' }, 400);
    if (method === 'DELETE') { await db.prepare('DELETE FROM snapshots WHERE key = ?').bind(`${gSnapPrefix(fid)}${acct}`).run(); return json({ ok: true }); }
    if (method === 'PUT') {
      const body = await readJson(request);
      if (!body || !Array.isArray(body.events) || typeof body.calendars !== 'object') return json({ error: 'Bad snapshot' }, 400);
      let data = JSON.stringify({ events: body.events, calendars: body.calendars, syncedAt: Number(body.syncedAt) || Date.now() });
      if (data.length > SNAP_MAX) data = JSON.stringify({ events: body.events.map(e => ({ ...e, notes: '' })), calendars: body.calendars, syncedAt: Number(body.syncedAt) || Date.now() });
      if (!(await putSnapshot(db, `${gSnapPrefix(fid)}${acct}`, data))) return json({ error: 'Too many events to save a copy' }, 413);
      return json({ ok: true, at: Date.now() });
    }
  }

  // News headlines for the idle screen, from the RSS/Atom feeds saved in family settings.
  // Only headline, link, time and outlet name are passed on — no article text.
  // US ZIP code → place name and coordinates for the weather (Zippopotam.us, no key needed)
  if (path === '/api/zip' && method === 'GET') {
    const zip = (url.searchParams.get('zip') || '').trim();
    if (!/^\d{5}$/.test(zip)) return json({ error: 'Enter a 5-digit ZIP code' }, 400);
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { headers: { 'User-Agent': 'Calendora family calendar' } });
      if (r.status === 404) return json({ error: 'ZIP code not found' }, 404);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json(), p = (j.places || [])[0];
      if (!p) return json({ error: 'ZIP code not found' }, 404);
      return json({ name: `${p['place name']}, ${p['state abbreviation']} ${zip}`, lat: Number(p.latitude), lon: Number(p.longitude) });
    } catch (e) { return json({ error: 'ZIP lookup is unavailable right now — try the city name' }, 502); }
  }

  // Verse of the Day. Crossway's ESV API when a key is set (secret ESV_API_KEY), otherwise Bible Gateway's
  // Verse of the Day feed. One verse per day, cached; each shown with its publisher's required credit.
  if (path === '/api/verse' && method === 'GET') {
    const wantCrossway = url.searchParams.get('source') === 'crossway';
    if (wantCrossway && env.ESV_API_KEY) {
      const day = url.searchParams.get('day') || new Date().toISOString().slice(0, 10);
      const ref = VERSE_REFS[Math.floor(Date.parse(day + 'T12:00:00Z') / 864e5) % VERSE_REFS.length];
      const ckey = new Request(`https://verse-cache.calendora/esv/${day}`);
      const chit = await caches.default.match(ckey).catch(() => null);
      if (chit) return new Response(chit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      try {
        const q = new URLSearchParams({ q: ref, 'include-passage-references': 'false', 'include-verse-numbers': 'false', 'include-first-verse-numbers': 'false', 'include-footnotes': 'false', 'include-footnote-body': 'false', 'include-headings': 'false', 'include-short-copyright': 'false', 'include-selahs': 'false', 'indent-paragraphs': '0', 'indent-poetry': 'false', 'indent-declares': '0', 'indent-psalm-doxology': '0' });
        const r = await fetch(`https://api.esv.org/v3/passage/text/?${q}`, { headers: { Authorization: `Token ${env.ESV_API_KEY}` } });
        if (r.status === 401 || r.status === 403) return json({ error: 'The ESV API key was not accepted', source: 'crossway' }, 502);
        const j = r.ok ? await r.json() : null;
        const text = j && j.passages && j.passages[0] ? j.passages[0].replace(/\s+/g, ' ').trim() : '';
        if (text) {
          const out = { text, reference: j.canonical || ref, version: 'ESV', link: `https://www.esv.org/${encodeURIComponent((j.canonical || ref))}/`, source: 'crossway' };
          const res = JSON.stringify(out);
          const put = caches.default.put(ckey, new Response(res, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=43200' } }));
          if (ctx) ctx.waitUntil(put); else await put.catch(() => {});
          return new Response(res, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        }
      } catch (e) { /* fall back to Bible Gateway below */ }
    }
    const keyMissing = wantCrossway && !env.ESV_API_KEY;
    const version = wantCrossway ? 'ESV' : ((url.searchParams.get('version') || 'KJV').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'KJV');
    const cache = caches.default, key = new Request(`https://verse-cache.calendora/${version}/${new Date().toISOString().slice(0, 10)}`);
    const hit = await cache.match(key).catch(() => null);
    if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    let out = null;
    try {
      const r = await fetch(`https://www.biblegateway.com/votd/get/?format=json&version=${encodeURIComponent(version)}`, { headers: { 'User-Agent': 'Calendora family calendar' } });
      const j = r.ok ? await r.json() : null;
      const v = j && (j.votd || j);
      if (v && (v.text || v.content)) out = { text: xmlText(v.text || v.content).replace(/^[“"]|[”"]$/g, ''), reference: xmlText(v.display_ref || v.reference || ''), version: xmlText(v.version || version), link: v.permalink || 'https://www.biblegateway.com/', source: 'biblegateway' };
    } catch (e) { out = null; }
    if (!out) {
      try {
        const r = await fetch(`https://www.biblegateway.com/votd/get/?format=atom&version=${encodeURIComponent(version)}`, { headers: { 'User-Agent': 'Calendora family calendar' } });
        const x = await r.text(), entry = (x.match(/<entry[\s>][\s\S]*?<\/entry>/i) || [''])[0];
        const text = xmlText(xmlTag(entry, 'content')).replace(/Brought to you by BibleGateway\.com.*$/i, '').replace(/^[“"]|[”"]$/g, '').trim();
        const m = /<link\b[^>]*?href=["']([^"']+)["']/i.exec(entry);
        if (text) out = { text, reference: xmlText(xmlTag(entry, 'title')), version, link: m ? m[1].replace(/&amp;/g, '&') : 'https://www.biblegateway.com/', source: 'biblegateway' };
      } catch (e) { out = null; }
    }
    if (!out) return json({ error: 'Could not get today’s verse' }, 502);
    if (keyMissing) out.keyMissing = true;
    const res = new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=21600' } });
    if (ctx) ctx.waitUntil(cache.put(key, res.clone())); else await cache.put(key, res.clone()).catch(() => {});
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  // Test feed links (used when adding a source, and to check the built-in catalog)
  if (path === '/api/news/check' && method === 'POST') {
    const body = await readJson(request);
    const urls = (body && Array.isArray(body.urls) ? body.urls : []).filter(u => /^https?:\/\//i.test(u)).slice(0, 25);
    const out = await Promise.all(urls.map(async u => {
      try { const items = await readFeed(u, ctx); const newest = Math.max(0, ...items.map(i => i.time || 0)); return { url: u, ok: items.length > 0, count: items.length, newest, title: (items[0] && items[0].feedTitle) || '' }; }
      catch (e) { return { url: u, ok: false, count: 0, error: e.message }; }
    }));
    return json({ results: out });
  }
  if (path === '/api/news' && method === 'GET') {
    const row = await db.prepare('SELECT data FROM board WHERE id = ?').bind(fid).first();
    let feeds = [];
    try { const st = row ? (JSON.parse(row.data).settings || {}) : {}; feeds = Array.isArray(st.newsFeeds) ? st.newsFeeds : DEFAULT_NEWS; } catch (e) { feeds = DEFAULT_NEWS; }
    feeds = feeds.filter(f => f && /^https?:\/\//i.test(f.url || '')).slice(0, 8);
    const results = await Promise.all(feeds.map(async f => {
      try { return { id: f.id, items: await readFeed(f.url, ctx), error: null }; }
      catch (e) { return { id: f.id, items: [], error: e.message || 'Could not read that feed' }; }
    }));
    const items = [];
    results.forEach((r, i) => r.items.slice(0, 15).forEach(it => items.push({ ...it, source: feeds[i].name || it.feedTitle || new URL(feeds[i].url).hostname.replace(/^www\./, ''), feed: feeds[i].id })));
    items.sort((a, b) => (b.time || 0) - (a.time || 0));
    return json({ items: items.slice(0, 60), feeds: results.map(r => ({ id: r.id, count: r.items.length, error: r.error })) });
  }

  if (path === '/api/ical' && method === 'GET') {
    // Fetch a calendar feed (e.g. an iCloud "Public Calendar" link) on the family's behalf.
    // The link is looked up in the shared board, so only feeds the family added can be fetched.
    const id = url.searchParams.get('feed') || '';
    const row = await db.prepare('SELECT data FROM board WHERE id = ?').bind(fid).first();
    let feeds = [];
    try { feeds = row ? (JSON.parse(row.data).icalFeeds || []) : []; } catch (e) { feeds = []; }
    const feed = Array.isArray(feeds) ? feeds.find(f => f && f.id === id) : null;
    if (!feed) return json({ error: 'Calendar not found' }, 404);
    let target = String(feed.url || '').trim().replace(/^webcals?:\/\//i, 'https://');
    let host = '';
    try { host = new URL(target).hostname; } catch (e) { return json({ error: 'That calendar link is not valid' }, 400); }
    if (!/^https?:\/\//i.test(target)) return json({ error: 'The link must start with webcal:// or https://' }, 400);
    if (host !== 'localhost') target = target.replace(/^http:\/\//i, 'https://');
    const saved = () => db.prepare('SELECT data, updated_at FROM snapshots WHERE key = ?').bind(`ical:${fid}:${id}`).first();
    const fallback = async (msg, status) => {
      const row = await saved().catch(() => null);
      if (row) return new Response(row.data, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store', 'X-Snapshot-At': String(row.updated_at), 'X-Snapshot-Reason': encodeURIComponent(msg) } });
      return json({ error: msg }, status);
    };
    let r;
    try {
      r = await fetch(target, {
        headers: { Accept: 'text/calendar, text/plain, */*', 'User-Agent': 'Calendora/1.0' },
        redirect: 'follow',
        ...(url.searchParams.get('fresh') ? {} : { cf: { cacheTtl: 600, cacheEverything: true } }),
      });
    } catch (e) { return fallback('Could not reach that calendar', 502); }
    if (r.status === 404 || r.status === 403) return fallback('Calendar link not found — is Public Calendar still turned on?', 502);
    if (!r.ok) return fallback(`The calendar server answered ${r.status}`, 502);
    const text = await r.text();
    if (text.length > 10000000) return json({ error: 'That calendar is too large' }, 502);
    if (!text.includes('BEGIN:VCALENDAR')) return fallback('That link is not a calendar feed', 502);
    if (ctx) ctx.waitUntil(putSnapshot(db, `ical:${fid}:${id}`, text).catch(() => {}));
    else await putSnapshot(db, `ical:${fid}:${id}`, text).catch(() => {});
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
    if (!env.DB) return;
    ctx.waitUntil((async () => {
      await ensureSchema(env.DB);
      const rows = await env.DB.prepare('SELECT id FROM families WHERE anylist IS NOT NULL OR id = ? LIMIT 50').bind(BOARD_ID).all();
      for (const f of rows.results || []) await anylistSync(env, f.id).catch(() => {});
    })());
  },
};
