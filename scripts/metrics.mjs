// API and background-job metrics from Workers Analytics Engine (written by src/worker.js), checked against the
// targets in docs/observability.md.
//
//   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/metrics.mjs [hours=24]
//
// The token needs "Account Analytics: Read". Exits 1 if a target is missed.
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const hours = Number(process.argv[2] || 24);
if (!account || !token) { console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'); process.exit(1); }

const TARGETS = { availability: 0.995, boardP95Ms: 250, conflictRate: 0.05 }; // also in docs/observability.md

async function sql(query) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: query,
  });
  if (!res.ok) throw new Error(`Analytics Engine answered ${res.status}: ${await res.text()}`);
  return (await res.json()).data;
}

const window = `timestamp > NOW() - INTERVAL '${hours}' HOUR`;
const api = await sql(`
  SELECT blob2 AS route, blob3 AS outcome, SUM(_sample_interval) AS n,
         quantileExactWeighted(0.95)(double1, _sample_interval) AS p95
  FROM calendora_events WHERE blob1 = 'api' AND ${window}
  GROUP BY route, outcome ORDER BY n DESC FORMAT JSON`);
const jobs = await sql(`
  SELECT blob2 AS kind, blob3 AS outcome, SUM(_sample_interval) AS n, AVG(double1) AS avg_ms
  FROM calendora_events WHERE blob1 = 'job' AND ${window}
  GROUP BY kind, outcome ORDER BY n DESC FORMAT JSON`);

const count = (rows, f = () => true) => rows.filter(f).reduce((s, r) => s + Number(r.n), 0);
const total = count(api), errors = count(api, r => r.outcome === '5xx');
const saves = count(api, r => r.route === '/api/board' && (r.outcome === '2xx' || r.outcome === '409'));
const conflicts = count(api, r => r.route === '/api/board' && r.outcome === '409');
const boardP95 = Math.max(0, ...api.filter(r => r.route === '/api/board' && r.outcome === '2xx').map(r => Number(r.p95)));
const availability = total ? 1 - errors / total : 1;
const conflictRate = saves ? conflicts / saves : 0;

console.log(`Last ${hours} h: ${total} API requests, ${errors} server errors\n`);
console.table(api.map(r => ({ route: r.route, outcome: r.outcome, requests: Number(r.n), 'p95 ms': Math.round(r.p95) })));
console.log('Background jobs:');
console.table(jobs.map(r => ({ kind: r.kind, outcome: r.outcome, runs: Number(r.n), 'avg ms': Math.round(r.avg_ms) })));
const ok = availability >= TARGETS.availability && boardP95 <= TARGETS.boardP95Ms && conflictRate <= TARGETS.conflictRate;
console.log(`availability ${(availability * 100).toFixed(2)}% (≥ ${TARGETS.availability * 100}%) · board p95 ${Math.round(boardP95)} ms (≤ ${TARGETS.boardP95Ms}) · save conflicts ${(conflictRate * 100).toFixed(1)}% (≤ ${TARGETS.conflictRate * 100}%) → ${ok ? 'OK' : 'MISSED'}`);
process.exit(ok ? 0 : 1);
