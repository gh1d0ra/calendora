// Families: create, invite, join, roles, leave; and that families can't see each other's data.
import { beforeAll, describe, expect, test } from 'vitest';
import { device, familyOwner, fakeGoogle, person } from './helpers.js';

beforeAll(async () => { await fakeGoogle(); });

const inviteCode = async owner => (await owner.post('/api/family/invite')).data.code;

describe('families and invites', () => {
  test('create a family: you become its owner', async () => {
    const owner = await familyOwner('Ana', '  The   Popescus  ');
    const fam = (await owner.get('/api/family')).data;
    expect(fam.family.name).toBe('The Popescus');
    expect(fam.canManage).toBe(true);
    expect(fam.people).toEqual([expect.objectContaining({ name: 'Ana', role: 'owner' })]);
  });

  test('a family needs a name, and you can only be in one', async () => {
    const p = await person('Solo');
    expect((await p.post('/api/family/create', { name: '   ' }, { 'CF-Connecting-IP': '198.51.100.201' })).status).toBe(400);
    const owner = await familyOwner('Ana2');
    expect((await owner.post('/api/family/create', { name: 'Second' })).status).toBe(409);
  });

  test('invite link → a second person joins as a member', async () => {
    const owner = await familyOwner('Ana');
    const r = await owner.post('/api/family/invite');
    expect(r.data.link).toBe(`https://calendora.test/?invite=${r.data.code}`);
    const bo = await person('Bo');
    expect((await bo.post('/api/family/join', { code: r.data.link })).status).toBe(200); // the whole link works too
    const fam = (await bo.get('/api/family')).data;
    expect(fam.people.map(p => [p.name, p.role])).toEqual([['Ana', 'owner'], ['Bo', 'member']]);
    expect(fam.canManage).toBe(false);
    expect(fam.invites).toEqual([]); // members don't see invite codes
  });

  test('joining straight from Google sign-in with ?invite=', async () => {
    const owner = await familyOwner('Ana');
    const cy = await person('Cy', { invite: await inviteCode(owner) });
    expect((await cy.get('/api/session')).data.signedIn).toBe(true);
  });

  test('bad and revoked invites', async () => {
    const owner = await familyOwner('Ana');
    const code = await inviteCode(owner);
    expect((await owner.del(`/api/family/invite/${code}`)).status).toBe(200);
    const bo = await person('Bo');
    expect((await bo.post('/api/family/join', { code })).status).toBe(400);
    expect((await bo.post('/api/family/join', { code: 'NOTACODE00' })).status).toBe(400);
  });

  test("someone in another family can't join without leaving first", async () => {
    const ana = await familyOwner('Ana');
    const bo = await familyOwner('Bo');
    const r = await bo.post('/api/family/join', { code: await inviteCode(ana) });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/already in another family/);
  });

  test('only owners and admins manage the family', async () => {
    const owner = await familyOwner('Ana');
    const bo = await person('Bo', { invite: await inviteCode(owner) });
    for (const [path, body] of [['/api/family/rename', { name: 'Mine' }], ['/api/family/invite', {}], ['/api/family/passcode', { next: 'abcd' }]]) {
      expect((await bo.post(path, body)).status).toBe(403);
    }
    // promote Bo to admin: now he can
    const boId = (await owner.get('/api/family')).data.people.find(p => p.name === 'Bo').id;
    expect((await owner.post('/api/family/member', { id: boId, role: 'admin' })).status).toBe(200);
    expect((await bo.post('/api/family/rename', { name: 'Ours' })).status).toBe(200);
    // but an admin can't demote or remove the owner
    const anaId = (await owner.get('/api/family')).data.people.find(p => p.name === 'Ana').id;
    expect((await bo.post('/api/family/member', { id: anaId, remove: true })).status).toBe(403);
  });

  test('removing a member signs them out of the family', async () => {
    const owner = await familyOwner('Ana');
    const bo = await person('Bo', { invite: await inviteCode(owner) });
    const boId = (await owner.get('/api/family')).data.people.find(p => p.name === 'Bo').id;
    expect((await owner.post('/api/family/member', { id: boId, remove: true })).status).toBe(200);
    const r = await bo.get('/api/board');
    expect(r.status).toBe(403);
    expect(r.data.needsFamily).toBe(true);
  });

  test('when the owner leaves, the family passes to the next person (admins first)', async () => {
    const owner = await familyOwner('Ana');
    const code = await inviteCode(owner);
    const bo = await person('Bo', { invite: code });
    const cy = await person('Cy', { invite: code });
    const cyId = (await owner.get('/api/family')).data.people.find(p => p.name === 'Cy').id;
    await owner.post('/api/family/member', { id: cyId, role: 'admin' });
    expect((await owner.post('/api/family/leave')).status).toBe(200);
    const people = (await bo.get('/api/family')).data.people;
    expect(people.map(p => [p.name, p.role])).toEqual([['Bo', 'member'], ['Cy', 'owner']]);
    expect((await cy.get('/api/family')).data.canManage).toBe(true);
  });

  test('at most 3 new families per network per day', async () => {
    const ip = '198.51.100.222';
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await (await person(`P${i}`)).post('/api/family/create', { name: `F${i}` }, { 'CF-Connecting-IP': ip })).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe('the shared board', () => {
  test('save, load, and "nothing changed" polling', async () => {
    const owner = await familyOwner();
    expect((await owner.get('/api/board')).data).toMatchObject({ version: 0, data: null });
    const put = await owner.put('/api/board', { baseVersion: 0, data: { members: [{ id: 'm1', name: 'Ana' }] } });
    expect(put.data).toMatchObject({ ok: true, version: 1 });
    const got = await owner.get('/api/board');
    expect(got.data).toMatchObject({ version: 1, data: { members: [{ name: 'Ana' }] } });
    expect((await owner.get('/api/board?since=1')).data).toMatchObject({ version: 1, unchanged: true });
  });

  test('two devices saving at once: the second gets a conflict with the latest copy', async () => {
    const owner = await familyOwner();
    const bo = await person('Bo', { invite: await inviteCode(owner) });
    await owner.put('/api/board', { baseVersion: 0, data: { v: 'first' } });
    expect((await owner.put('/api/board', { baseVersion: 1, data: { v: 'ana' } })).data.version).toBe(2);
    const late = await bo.put('/api/board', { baseVersion: 1, data: { v: 'bo' } });
    expect(late.status).toBe(409);
    expect(late.data).toMatchObject({ error: 'conflict', version: 2, data: { v: 'ana' } });
  });

  test('bad boards are refused', async () => {
    const owner = await familyOwner();
    expect((await owner.put('/api/board', { data: {} })).status).toBe(400);
    expect((await owner.put('/api/board', { baseVersion: 0, data: null })).status).toBe(400);
    expect((await owner.put('/api/board', { baseVersion: 0, data: {}, familyId: 'someone-else' })).status).toBe(409);
  });

  test("families never see each other's board", async () => {
    const ana = await familyOwner('Ana', 'Family A');
    const bo = await familyOwner('Bo', 'Family B');
    await ana.put('/api/board', { baseVersion: 0, data: { secret: 'A only' } });
    expect((await bo.get('/api/board')).data).toMatchObject({ version: 0, data: null });
    await bo.put('/api/board', { baseVersion: 0, data: { secret: 'B only' } });
    expect((await ana.get('/api/board')).data.data).toEqual({ secret: 'A only' });
  });

  test('a person without a family is asked to create or join one', async () => {
    const p = await person('Lonely');
    const r = await p.get('/api/board');
    expect(r.status).toBe(403);
    expect(r.data.needsFamily).toBe(true);
    expect((await device().get('/api/nope')).status).toBe(401);
  });
});
