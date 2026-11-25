// Load test for board sync: many screens of one family polling the board while some of them save at the same
// time. Measures latency and how often saves collide (409, which the app resolves with its three-way merge).
// Runs against a LOCAL wrangler dev with the seeded test family; never against production.
//
//   node scripts/e2e-seed.mjs .wrangler/load
//   npx wrangler dev --local --port 8799 --persist-to .wrangler/load
//   k6 run -e BASE_URL=http://127.0.0.1:8799 load/board.k6.js
//
// Results are summarized in docs/observability.md.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8799';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };
const conflicts = new Rate('save_conflicts');
const merged = new Counter('saves_after_merge');

http.setResponseCallback(http.expectedStatuses(200, 409)); // a 409 is a normal, handled outcome here

export const options = {
  noCookiesReset: true,
  scenarios: {
    screens: {
      executor: 'constant-vus',
      vus: Number(__ENV.SCREENS || 20), // tablets, phones and TVs of one busy family
      duration: __ENV.DURATION || '45s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:poll}': ['p(95)<150'],
    'http_req_duration{name:save}': ['p(95)<250'],
    save_conflicts: ['rate<0.5'],
    checks: ['rate>0.99'],
  },
};

const state = {};
export default function () {
  const me = (state[__VU] ??= { version: 0, signedIn: false });
  if (!me.signedIn) {
    const r = http.post(`${BASE}/api/login`, JSON.stringify({ family: 'E2ETEST', passcode: 'e2e-pass' }), { ...JSON_HEADERS, tags: { name: 'login' } });
    me.signedIn = check(r, { 'signed in': (x) => x.status === 200 });
    if (!me.signedIn) { sleep(1); return; }
  }

  // Poll like a screen does: "anything newer than my version?"
  const poll = http.get(`${BASE}/api/board?since=${me.version}`, { tags: { name: 'poll' } });
  check(poll, { 'poll ok': (x) => x.status === 200 });
  let board = {};
  if (poll.status === 200) {
    const b = poll.json();
    if (!b.unchanged) { me.version = b.version; board = b.data || {}; me.board = board; } else board = me.board || {};
  }

  // About one poll in five comes with an edit (a chore ticked, an item added to the list)
  if (Math.random() < 0.2) {
    const data = { ...board, events: [...(board.events || []).slice(-50), { id: `k6-${__VU}-${__ITER}`, title: `Load ${__VU}`, date: '2026-12-01' }] };
    let save = http.put(`${BASE}/api/board`, JSON.stringify({ baseVersion: me.version, data }), { ...JSON_HEADERS, tags: { name: 'save' } });
    conflicts.add(save.status === 409);
    if (save.status === 409) {
      // what the app does: take the server's copy, re-apply our change, save once more
      const latest = save.json();
      const again = { ...latest.data, events: [...(latest.data.events || []).slice(-50), data.events[data.events.length - 1]] };
      save = http.put(`${BASE}/api/board`, JSON.stringify({ baseVersion: latest.version, data: again }), { ...JSON_HEADERS, tags: { name: 'save' } });
      if (save.status === 200) merged.add(1);
    }
    if (save.status === 200) me.version = save.json('version');
  }
  sleep(1);
}
