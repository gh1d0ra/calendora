// Live updates: screens hold a WebSocket to their family's FamilyRoom Durable Object (src/room.js).
// A save on one device reaches the others at once; families never hear about each other.
import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import { device, familyOwner, fakeGoogle } from './helpers.js';

beforeAll(async () => { await fakeGoogle(); });

/** Opens /api/live as this device; collects JSON messages. */
async function connect(d) {
  const res = await SELF.fetch('https://calendora.test/api/live', { headers: { Upgrade: 'websocket', Cookie: d.cookie } });
  if (res.status !== 101) return { status: res.status };
  const ws = res.webSocket;
  const messages = [];
  const waiters = [];
  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { m = ev.data; }
    messages.push(m);
    waiters.splice(0).forEach(w => w());
  });
  let closed = null;
  ws.addEventListener('close', ev => { closed = ev.code; waiters.splice(0).forEach(w => w()); });
  ws.accept();
  /** Waits until a message matches (or the socket closes), up to 2 s. */
  const next = async (match, ms = 2000) => {
    const end = Date.now() + ms;
    for (;;) {
      const hit = messages.find(match);
      if (hit) return hit;
      if (closed !== null || Date.now() > end) return null;
      await new Promise(r => { waiters.push(r); setTimeout(r, 50); });
    }
  };
  return { status: 101, ws, messages, next, get closed() { return closed; } };
}

const tabletOf = async owner => {
  expect((await owner.post('/api/family/passcode', { next: 'blue-tiger' })).status).toBe(200);
  const { family } = (await owner.get('/api/session')).data;
  const tablet = device('203.0.113.50');
  expect((await tablet.post('/api/login', { family: family.code, passcode: 'blue-tiger' })).status).toBe(200);
  return tablet;
};

describe('live updates (/api/live)', () => {
  test('needs a signed-in family member, and a WebSocket', async () => {
    expect((await connect(device())).status).toBe(401);
    const owner = await familyOwner();
    expect((await owner.get('/api/live')).status).toBe(426);
  });

  test("a save on the phone reaches the kitchen tablet's open connection", async () => {
    const owner = await familyOwner();
    const tablet = await tabletOf(owner);
    const live = await connect(tablet);
    expect(live.status).toBe(101);
    expect(await live.next(m => m.type === 'presence')).toMatchObject({ screens: 1, tablets: 1 });

    expect((await owner.put('/api/board', { baseVersion: 0, data: { events: [] } })).data.version).toBe(1);
    expect((await owner.put('/api/board', { baseVersion: 1, data: { events: [{ id: 'e1' }] } })).data.version).toBe(2);
    expect(await live.next(m => m.type === 'board' && m.version === 2)).toEqual({ type: 'board', version: 2 });
    // only a version number travels over the socket, never family data
    expect(JSON.stringify(live.messages)).not.toContain('e1');
    live.ws.close(1000);
  });

  test('a conflicting save does not announce a new version', async () => {
    const owner = await familyOwner();
    await owner.put('/api/board', { baseVersion: 0, data: {} });
    const live = await connect(owner);
    expect((await owner.put('/api/board', { baseVersion: 0, data: { x: 1 } })).status).toBe(409);
    expect(await live.next(m => m.type === 'board', 400)).toBeNull();
    live.ws.close(1000);
  });

  test("families don't hear each other's saves", async () => {
    const a = await familyOwner('A', 'Family A');
    const b = await familyOwner('B', 'Family B');
    const liveA = await connect(a);
    await b.put('/api/board', { baseVersion: 0, data: {} });
    expect(await liveA.next(m => m.type === 'board', 400)).toBeNull();
    liveA.ws.close(1000);
  });

  test('presence counts the screens that are open', async () => {
    const owner = await familyOwner();
    const tablet = await tabletOf(owner);
    const one = await connect(owner);
    const two = await connect(tablet);
    expect(await one.next(m => m.type === 'presence' && m.screens === 2)).toMatchObject({ screens: 2, tablets: 1 });
    two.ws.close(1000);
    expect(await one.next(m => m.type === 'presence' && m.screens === 1)).toBeTruthy();
    one.ws.close(1000);
  });

  test('"sign out all devices" closes every live connection', async () => {
    const owner = await familyOwner();
    const tablet = await tabletOf(owner);
    const live = await connect(tablet);
    await live.next(m => m.type === 'presence');
    expect((await owner.post('/api/logout-all')).status).toBe(200);
    await live.next(() => false, 1500); // wait for the close
    expect(live.closed).toBe(4001);
    expect((await tablet.get('/api/board')).status).toBe(401);
  });
});
