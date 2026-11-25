// Subscribe links for phone calendars: a secret URL per family, rendered by the calendora-ics Python Worker
// (here a stand-in; see vitest.config.mjs). Only owners and admins create or turn off the link.
import { beforeAll, describe, expect, test } from 'vitest';
import { device, familyOwner, fakeGoogle, person } from './helpers.js';

beforeAll(async () => { await fakeGoogle(); });

const tokenOf = url => url.match(/\/api\/feed\/([\w-]+)\.ics/)[1];

describe('subscribe feed', () => {
  test('an owner creates a link; a calendar app (no cookies) can read it', async () => {
    const owner = await familyOwner('Owner', 'The Smiths');
    await owner.put('/api/board', { baseVersion: 0, data: { members: [{ id: 'm1', name: 'Ana' }], events: [{ id: 'e1', title: 'Swim', date: '2026-11-03' }] } });
    expect((await owner.get('/api/family')).data.feed).toBe(false);

    const r = await owner.post('/api/family/feed');
    expect(r.status).toBe(200);
    expect(r.data.webcal).toMatch(/^webcal:\/\/calendora\.test\/api\/feed\/[\w-]{32}\.ics$/);
    expect(r.data.members).toEqual([{ id: 'm1', name: 'Ana', webcal: `${r.data.webcal}?member=m1` }]);
    expect((await owner.get('/api/family')).data.feed).toBe(true);

    const app = device('203.0.113.99'); // no session at all
    const feed = await app.get(`/api/feed/${tokenOf(r.data.url)}.ics?member=m1`);
    expect(feed.status).toBe(200);
    expect(feed.headers.get('Content-Type')).toMatch(/text\/calendar/);
    expect(feed.data).toContain('X-WR-CALNAME:The Smiths');
    expect(feed.data).toContain('X-MEMBER:m1');
    expect(feed.data).toContain('SUMMARY:Swim');
  });

  test('a new link replaces the old one, and turning it off stops it', async () => {
    const owner = await familyOwner();
    const first = tokenOf((await owner.post('/api/family/feed')).data.url);
    const second = tokenOf((await owner.post('/api/family/feed')).data.url);
    const app = device();
    expect((await app.get(`/api/feed/${first}.ics`)).status).toBe(404);
    expect((await app.get(`/api/feed/${second}.ics`)).status).toBe(200);
    expect((await owner.del('/api/family/feed')).status).toBe(200);
    expect((await app.get(`/api/feed/${second}.ics`)).status).toBe(404);
  });

  test('members cannot create links; unknown or malformed tokens find nothing', async () => {
    const owner = await familyOwner();
    const { code } = (await owner.post('/api/family/invite')).data;
    const member = await person('Member', { invite: code });
    expect((await member.post('/api/family/feed')).status).toBe(403);
    expect((await device().get('/api/feed/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.ics')).status).toBe(404);
    expect((await device().get('/api/feed/short.ics')).status).toBe(401); // not a feed address: needs a session like any API call
  });

  test("a family's link only ever shows that family's events", async () => {
    const a = await familyOwner('A', 'Family A');
    const b = await familyOwner('B', 'Family B');
    await a.put('/api/board', { baseVersion: 0, data: { events: [{ id: 'x', title: 'A only', date: '2026-11-03' }] } });
    await b.put('/api/board', { baseVersion: 0, data: { events: [{ id: 'y', title: 'B only', date: '2026-11-03' }] } });
    const feed = await device().get(`/api/feed/${tokenOf((await b.post('/api/family/feed')).data.url)}.ics`);
    expect(feed.data).toContain('B only');
    expect(feed.data).not.toContain('A only');
  });
});
