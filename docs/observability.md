# Observability

## What is recorded

`src/worker.js` writes one data point to Workers Analytics Engine (dataset `calendora_events`) for every API request
and every background job. It also writes a structured JSON line to Workers Logs (`[observability] enabled = true`).

| Field | API request | Background job |
|---|---|---|
| `blob1` (also `index1`) | `api` | `job` |
| `blob2` | Route (`/api/board`, `/api/live`, …) | Job kind (`anylist`, `ical`) |
| `blob3` | `2xx`, `4xx`, `5xx`, or `409` / `101` / `429` reported separately | `ok`, `retry`, `dropped` |
| `blob4` | Worker version (first 8 characters) | Worker version |
| `double1` | Duration, ms | Duration, ms |
| `double2` | Status code | Attempt number |

Some outcomes are kept separate on purpose:
- `409` on `/api/board` is a save conflict. It shows how often two screens edit at once and the three-way merge has to run.
- `101` on `/api/live` is a live connection opening.
- `retry` on a job means the queue will try again with backoff.

## Targets

| Objective | Target |
|---|---|
| Availability | **99.5%** of API requests are not 5xx (24 h) |
| Board latency | **p95 ≤ 250 ms** for successful `/api/board` requests |
| Save conflicts | **≤ 5%** of board saves. If this goes higher, live sync isn't reaching screens fast enough. |

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/metrics.mjs 24
```

This prints API and job tables and exits with status 1 if a target was missed. The token needs "Account Analytics: Read".

## Useful queries (Analytics Engine SQL API)

```sql
-- Jobs that keep retrying (a calendar source that stays down, AnyList sign-in trouble)
SELECT blob2 AS kind, SUM(_sample_interval) AS retries, MAX(double2) AS max_attempt
FROM calendora_events WHERE blob1 = 'job' AND blob3 = 'retry' AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY kind

-- Live connections opened per hour
SELECT toStartOfHour(timestamp) AS hour, SUM(_sample_interval) AS connections
FROM calendora_events WHERE blob1 = 'api' AND blob2 = '/api/live' AND blob3 = '101'
  AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY hour ORDER BY hour
```

Messages that fail every retry end up in the `calendora-jobs-dlq` queue, which you can inspect in the Cloudflare dashboard.

## Load test

`load/board.k6.js` (k6) simulates 20 screens of one family for 45 seconds against a **local** `wrangler dev`. Each
screen polls the board every second and saves an edit on one poll in five, which is about 4 saves a second, far busier
than a real family. Last run: 1,103 requests and 0 failures, with p95 of 85 ms for a poll and 64 ms for a save.
**34% of saves collided** (409), and most of those went through on one retry after taking the server's copy. That's
the cost of every screen saving at once, and it's why live updates matter ([decision 0006](decisions/0006-live-sync-durable-objects.md)):
the sooner a screen hears about a new version, the less likely its next save is to collide. The production target is
≤ 5% conflicts.
