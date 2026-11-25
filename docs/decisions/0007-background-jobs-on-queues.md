# 0007 — Background work on Cloudflare Queues, with retries and a dead-letter queue

**Status:** accepted

## Context
Two kinds of work depend on outside services that are sometimes slow or down:
- **AnyList sync.** It ran inline from the every-minute cron (looping over families) and from `waitUntil` after a save.
- **Calendar feeds whose source is down.** The Worker served the saved copy, but nothing tried again until a screen asked.

Inline work has no retry policy. A slow family holds up the loop for everyone, and failures disappear into `catch(() => {})`.

## Decision
Producers enqueue small messages on `calendora-jobs` (`{ kind: 'anylist', fid }`, `{ kind: 'ical', fid, feed }`).
The Worker's `queue()` handler runs them (`runJob`).
- **Retries with exponential backoff:** 30 s, 1, 2, 4 … minutes, capped at an hour (`msg.retry({ delaySeconds })`).
  After `max_retries`, messages land in `calendora-jobs-dlq` for inspection.
- **Only retryable failures retry.** A busy lock or a board that changed underneath retries. A feed that was removed is
  acknowledged and dropped.
- **Calendar recovery:** when `/api/ical` serves a saved copy because the source failed, it queues one re-fetch, at
  most once per feed every 10 minutes. When the source comes back, the job saves a fresh copy and tells the family's
  room, and open screens reload that calendar.
- **The cron only enqueues** (`sendBatch`), so it finishes in milliseconds however many families there are.
- **Without a queue binding** (local tools, older deploys), jobs run in place. Nothing depends on the queue existing.
- Every job outcome is recorded (`ok`, `retry`, `dropped`) in Analytics Engine ([observability](../observability.md)).

## Consequences
- Isolation: one family's failing AnyList account retries on its own schedule.
- Cost: roughly one message per AnyList family per minute, about 4,300 queue operations a day for one family, well inside
  the Workers Free allowance. More families would mean moving the cron to every few minutes.
- Two queues to create ([`infra/main.tf`](../../infra/main.tf) or `wrangler queues create`).
