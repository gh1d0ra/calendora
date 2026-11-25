# 0001 — One Cloudflare Worker and a no-build vanilla JS app

**Status:** accepted

## Context
Calendora runs on a family's wall tablet, phones and a TV. It must be cheap (free tier), fast to load on old tablets, and
easy to change. Most features are UI with light server needs: storage, sign-in, and fetching outside feeds.

## Decision
One Worker (`src/worker.js`) serves both the static files and `/api/*`. The app is plain HTML, CSS and JavaScript with no
framework or bundler. Logic that benefits from tests (repeat rules, the iCalendar engine) lives in `lib/core.js`,
which has no DOM and works both as a browser script and as a module in tests.

## Consequences
- No build step: what's in the repo is what runs. Cloudflare Workers Builds deploys every push to `main`.
- `.assetsignore` must list every non-app file (tests, docs, tooling). CI checks the important ones.
- `app.js` is large (about 4,000 lines). New pure logic should go into `lib/` with tests, not into `app.js`.
