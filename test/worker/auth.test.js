// Sign-in: Google ID tokens, tablet passcodes, session cookies, rate limits.
import { beforeAll, describe, expect, test } from 'vitest';
import { CLIENT_ID, device, familyOwner, fakeGoogle, googleToken, person } from './helpers.js';

beforeAll(async () => { await fakeGoogle(); });

describe('Google sign-in', () => {
  test('a new account is signed in but has no family yet', async () => {
    const d = device();
    const r = await d.post('/api/auth/google', { credential: await googleToken({ email: 'new@example.com', name: 'New' }) });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ ok: true, needsFamily: true });
    expect(r.headers.get('Set-Cookie')).toMatch(/^cal_session=[^;]+; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/);
    const s = await d.get('/api/session');
    expect(s.data).toMatchObject({ signedIn: false, needsFamily: true, account: { email: 'new@example.com', name: 'New' } });
  });

  test.each([
    ['another app', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['another issuer', { iss: 'https://evil.example' }],
    ['an expired token', { exp: Math.floor(Date.now() / 1000) - 60 }],
    ['an unverified email', { email_verified: false }],
  ])('rejects a token for %s', async (_, claims) => {
    const r = await device(`192.0.2.${Math.floor(Math.random() * 250)}`).post('/api/auth/google', { credential: await googleToken(claims) });
    expect(r.status).toBe(401);
  });

  test('rejects a token signed with a different key, or a garbled one', async () => {
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
    const d = device('192.0.2.200');
    expect((await d.post('/api/auth/google', { credential: await googleToken({}, { signWith: other.privateKey }) })).status).toBe(401);
    expect((await d.post('/api/auth/google', { credential: 'not.a.jwt' })).status).toBe(401);
    expect((await d.post('/api/auth/google', {})).status).toBe(401);
  });

  test('the configured client id is what the app is told to use', async () => {
    expect((await device().get('/api/session')).data.googleClientId).toBe(CLIENT_ID);
  });

  test('OWNER_EMAILS people are made owners of family #1 when it exists', async () => {
    // family #1 only exists on installs that predate multi-family support, so a fresh database has none
    const owner = await person('Boss', { email: 'owner@example.com' });
    expect((await owner.get('/api/session')).data.needsFamily).toBe(true);
  });
});

describe('sessions', () => {
  test('signed-out requests are refused', async () => {
    expect((await device().get('/api/board')).status).toBe(401);
  });

  test('a tampered cookie is refused', async () => {
    const owner = await familyOwner();
    const [name, value] = owner.cookie.split('=');
    const [payload, sig] = value.split('.');
    const forged = device();
    forged.cookie = `${name}=${payload.slice(0, -2)}xx.${sig}`;
    expect((await forged.get('/api/board')).status).toBe(401);
  });

  test('"sign out all devices" ends every other session but keeps this one', async () => {
    const owner = await familyOwner();
    const tablet = device();
    tablet.cookie = owner.cookie; // a second device with the same session
    expect((await owner.post('/api/logout-all')).status).toBe(200);
    expect((await owner.get('/api/board')).status).toBe(200);
    expect((await tablet.get('/api/board')).status).toBe(401);
  });

  test('log out clears the cookie', async () => {
    const owner = await familyOwner();
    await owner.post('/api/logout');
    expect(owner.cookie).toBe('');
    expect((await owner.get('/api/board')).status).toBe(401);
  });
});

describe('tablet passcode', () => {
  test('a tablet signs in with the family code and passcode', async () => {
    const owner = await familyOwner();
    expect((await owner.post('/api/family/passcode', { next: 'blue-tiger' })).status).toBe(200);
    const { family } = (await owner.get('/api/family')).data;
    expect(family.hasPasscode).toBe(true);

    const tablet = device('203.0.113.50');
    expect((await tablet.post('/api/login', { family: family.code, passcode: 'wrong' })).status).toBe(401);
    expect((await tablet.post('/api/login', { family: family.code.toLowerCase(), passcode: 'blue-tiger' })).status).toBe(200);
    const s = (await tablet.get('/api/session')).data;
    expect(s).toMatchObject({ signedIn: true, device: true, family: { id: family.id } });
    // a tablet is not a person, so it can't manage the family
    expect((await tablet.post('/api/family/invite')).status).toBe(403);
  });

  test('passcodes must be at least 4 characters', async () => {
    const owner = await familyOwner();
    expect((await owner.post('/api/family/passcode', { next: 'abc' })).status).toBe(400);
  });

  test('10 wrong tries from one network lock it out for 15 minutes', async () => {
    const tablet = device('203.0.113.99');
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await tablet.post('/api/login', { family: 'NOPE42', passcode: 'guess' })).status);
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
    // other networks are unaffected
    expect((await device('203.0.113.98').post('/api/login', { family: 'NOPE42', passcode: 'guess' })).status).toBe(401);
  });
});
