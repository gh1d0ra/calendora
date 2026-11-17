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

// ------------------------------------------------------------------ API
async function readJson(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  try { return await request.json(); } catch (e) { return null; }
}

async function handleApi(request, env, url) {
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
    if (res.meta && res.meta.changes === 1) return json({ ok: true, version: body.baseVersion + 1, updatedAt: now });
    // someone else saved first: send back what is on the server
    const row = await db.prepare('SELECT data, version, updated_at FROM board WHERE id = ?').bind(BOARD_ID).first();
    return json({ error: 'conflict', version: row ? row.version : 0, updatedAt: row ? row.updated_at : 0, data: row ? JSON.parse(row.data) : null }, 409);
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env, url); }
      catch (e) { return json({ error: 'Server error' }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
