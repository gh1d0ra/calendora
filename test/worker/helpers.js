// Helpers for Worker tests: "devices" with their own cookies, and real-looking Google ID tokens.
// The tests run inside workerd with the actual src/worker.js and a local D1 (see vitest.config.mjs).
import { SELF } from 'cloudflare:test';
import { vi } from 'vitest';

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const ORIGIN = 'https://calendora.test';

// ---------- a device = a browser or tablet with its own session cookie ----------
export function device(ip = '203.0.113.7') {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const h = { 'CF-Connecting-IP': ip, ...headers };
    if (cookie) h.Cookie = cookie;
    let payload;
    if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await SELF.fetch(`${ORIGIN}${path}`, { method, headers: h, body: payload });
    const set = res.headers.get('Set-Cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const type = res.headers.get('Content-Type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b, h) => call('PUT', p, b, h),
    del: (p, h) => call('DELETE', p, undefined, h),
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
  };
}

// ---------- Google sign-in: our own RSA key stands in for Google's ----------
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = obj => b64u(new TextEncoder().encode(JSON.stringify(obj)));
let keys;
async function keyPair() {
  keys ??= await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  return keys;
}

/** Serve our public key at Google's certificate URL; everything else goes out as normal. */
export async function fakeGoogle() {
  const jwk = { ...(await crypto.subtle.exportKey('jwk', (await keyPair()).publicKey)), kid: 'test-kid', alg: 'RS256', use: 'sig' };
  const realFetch = globalThis.fetch;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return Promise.resolve(Response.json({ keys: [jwk] }));
    return realFetch(input, init);
  });
}

/** A signed Google ID token. Override any claim to test the checks. */
export async function googleToken(claims = {}, { kid = 'test-kid', signWith } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'sub-' + crypto.randomUUID(), email: 'person@example.com',
    email_verified: true, name: 'Test Person', iat: now, exp: now + 3600, ...claims,
  };
  const unsigned = `${enc({ alg: 'RS256', kid, typ: 'JWT' })}.${enc(body)}`;
  const key = signWith || (await keyPair()).privateKey;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64u(sig)}`;
}

let n = 0;
/** A new person signed in with Google on their own device. */
export async function person(name = 'Person', extra = {}) {
  const d = device();
  const email = extra.email || `${name.toLowerCase()}-${++n}-${Date.now()}@example.com`;
  const r = await d.post('/api/auth/google', { credential: await googleToken({ name, email, sub: `sub-${email}`, ...extra }), ...(extra.invite ? { invite: extra.invite } : {}) });
  if (r.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(r.data)}`);
  return Object.assign(d, { email, name });
}

/** A person who created a new family (and is its owner). */
export async function familyOwner(name = 'Owner', familyName = 'The Testers') {
  const p = await person(name);
  const r = await p.post('/api/family/create', { name: familyName }, { 'CF-Connecting-IP': `198.51.100.${++n % 250}` });
  if (r.status !== 200) throw new Error(`create failed: ${JSON.stringify(r.data)}`);
  return p;
}
