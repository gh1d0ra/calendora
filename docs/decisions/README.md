# Architecture decision records

| # | Decision |
|---|---|
| [0001](0001-one-worker-no-build.md) | One Cloudflare Worker and a no-build vanilla JS app |
| [0002](0002-board-as-one-versioned-document.md) | Store each family's board as one versioned JSON document |
| [0003](0003-stateless-signed-sessions.md) | Stateless HMAC-signed session cookies with a per-family epoch |
| [0004](0004-expand-ics-in-the-browser.md) | Fetch .ics feeds on the server, expand them in the browser |
| [0005](0005-test-in-workerd.md) | Test the Worker inside workerd, not with mocks |
| [0006](0006-live-sync-durable-objects.md) | Live updates through a Durable Object per family; D1 stays the source of truth |
| [0007](0007-background-jobs-on-queues.md) | Background work on Cloudflare Queues, with retries and a dead-letter queue |
| [0008](0008-python-worker-for-feeds.md) | Subscribe feeds rendered by a separate Python Worker, behind a service binding |
| [0009](0009-csp-report-only-first.md) | Roll out the Content-Security-Policy in report-only mode first |
