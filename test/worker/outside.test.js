// Endpoints that fetch other sites: iCloud / iCal feeds (with a saved copy for when the source is down)
// and recipe import from a web page. Outside sites are faked; nothing leaves the test.
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { familyOwner, fakeGoogle } from './helpers.js';

let fetchSpy;
let sites = {}; // url -> () => Response
beforeAll(async () => {
  fetchSpy = await fakeGoogle();
  const google = fetchSpy.getMockImplementation();
  fetchSpy.mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (sites[url]) return Promise.resolve(sites[url]());
    return google(input, init);
  });
});
beforeEach(() => { sites = {}; });

const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:1', 'SUMMARY:Swim', 'DTSTART:20261020T140000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

async function familyWithFeed(url) {
  const owner = await familyOwner();
  await owner.put('/api/board', { baseVersion: 0, data: { icalFeeds: [{ id: 'kids', url }] } });
  return owner;
}

describe('calendar feeds (/api/ical)', () => {
  test('fetches a feed the family added (webcal:// becomes https://) and keeps a copy', async () => {
    sites['https://p01-caldav.icloud.example/published/2/abc'] = () => new Response(ICS, { headers: { 'Content-Type': 'text/calendar' } });
    const owner = await familyWithFeed('webcal://p01-caldav.icloud.example/published/2/abc');
    const r = await owner.get('/api/ical?feed=kids&fresh=1');
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toMatch(/text\/calendar/);
    expect(r.data).toContain('SUMMARY:Swim');
    expect(r.headers.get('X-Snapshot-At')).toBeNull();

    // the source goes down: the saved copy is served, marked as a snapshot with the reason
    sites['https://p01-caldav.icloud.example/published/2/abc'] = () => new Response('gone', { status: 404 });
    const later = await owner.get('/api/ical?feed=kids&fresh=1');
    expect(later.status).toBe(200);
    expect(later.data).toContain('SUMMARY:Swim');
    expect(Number(later.headers.get('X-Snapshot-At'))).toBeGreaterThan(0);
    expect(decodeURIComponent(later.headers.get('X-Snapshot-Reason'))).toMatch(/Public Calendar/);
  });

  test("only feeds in the family's own board can be fetched", async () => {
    const owner = await familyWithFeed('https://cal.example/a.ics');
    expect((await owner.get('/api/ical?feed=not-ours')).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('not-ours'), expect.anything());
  });

  test('a page that is not a calendar, with no saved copy, is an error', async () => {
    sites['https://cal.example/b.ics'] = () => new Response('<html>Sign in</html>');
    const owner = await familyWithFeed('https://cal.example/b.ics');
    const r = await owner.get('/api/ical?feed=kids&fresh=1');
    expect(r.status).toBe(502);
    expect(r.data.error).toMatch(/not a calendar feed/);
  });
});

describe('recipe import (/api/recipe-import)', () => {
  const page = recipe => `<!doctype html><html><head><title>Fallback title</title>
    <meta property="og:image" content="/img/cover.jpg">
    <script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body>…</body></html>`;

  test('reads schema.org Recipe data: ingredients, steps, sections, time, image', async () => {
    sites['https://food.example/soup'] = () => new Response(page({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebPage' }, {
        '@type': ['Recipe'], name: 'Tomato &amp; Basil Soup', recipeYield: ['4 servings'], totalTime: 'PT1H15M',
        image: [{ url: '/img/soup.jpg' }],
        recipeIngredient: ['2 lb tomatoes', '1 cup <b>basil</b>', ''],
        recipeInstructions: [
          { '@type': 'HowToSection', name: 'Soup', itemListElement: [{ '@type': 'HowToStep', text: 'Roast the tomatoes.' }, { '@type': 'HowToStep', text: 'Blend.' }] },
          'Serve hot.\nAdd basil.',
        ],
        description: 'A cozy soup.',
      }],
    }));
    const owner = await familyOwner();
    const r = await owner.post('/api/recipe-import', { url: 'https://food.example/soup' });
    expect(r.status).toBe(200);
    expect(r.data).toEqual({
      url: 'https://food.example/soup', found: true, title: 'Tomato & Basil Soup', image: 'https://food.example/img/soup.jpg',
      servings: '4 servings', time: '1 h 15 min', ingredients: ['2 lb tomatoes', '1 cup basil'],
      steps: ['— Soup —', 'Roast the tomatoes.', 'Blend.', 'Serve hot.', 'Add basil.'], notes: 'A cozy soup.',
    });
  });

  test('a page without recipe data still gives a title and picture', async () => {
    sites['https://blog.example/post'] = () => new Response('<html><head><title>Grandma&#39;s pie</title><meta property="og:image" content="https://cdn.example/pie.jpg"></head></html>');
    const owner = await familyOwner();
    const r = await owner.post('/api/recipe-import', { url: 'https://blog.example/post' });
    expect(r.data).toMatchObject({ found: false, title: "Grandma's pie", image: 'https://cdn.example/pie.jpg', ingredients: [] });
  });

  test('bad links', async () => {
    const owner = await familyOwner();
    expect((await owner.post('/api/recipe-import', { url: 'not a url' })).status).toBe(400);
    expect((await owner.post('/api/recipe-import', { url: 'ftp://files.example/x' })).status).toBe(400);
    sites['https://down.example/'] = () => new Response('nope', { status: 503 });
    expect((await owner.post('/api/recipe-import', { url: 'https://down.example/' })).status).toBe(502);
  });

  test('signed-out visitors cannot use the server to fetch pages', async () => {
    const { device } = await import('./helpers.js');
    expect((await device().post('/api/recipe-import', { url: 'https://food.example/soup' })).status).toBe(401);
    expect(vi.isMockFunction(fetch)).toBe(true);
  });
});
