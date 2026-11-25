# Architecture decision records

| # | Decision |
|---|---|
| [0001](0001-one-worker-no-build.md) | One Cloudflare Worker and a no-build vanilla JS app |
| [0002](0002-board-as-one-versioned-document.md) | Store each family's board as one versioned JSON document |
| [0003](0003-stateless-signed-sessions.md) | Stateless HMAC-signed session cookies with a per-family epoch |
| [0004](0004-expand-ics-in-the-browser.md) | Fetch .ics feeds on the server, expand them in the browser |
| [0005](0005-test-in-workerd.md) | Test the Worker inside workerd, not with mocks |
