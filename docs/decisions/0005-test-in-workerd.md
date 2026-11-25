# 0005 — Test the Worker inside workerd, not with mocks

**Status:** accepted

## Context
The Worker's logic is mostly SQL against D1, WebCrypto (PBKDF2, HMAC, RS256) and `fetch`. Mocking those would test the
mocks rather than the code.

## Decision
Use `@cloudflare/vitest-plugin`: tests run inside workerd, the real Workers runtime, with `wrangler.toml` bindings and a local D1.
Only the outside world is faked:
- Google's signing keys are a test RSA key served at the JWKS URL, so ID tokens are real RS256 tokens.
- iCloud and recipe sites are canned responses.

Remote bindings (Workers AI) are switched off in tests and in `wrangler dev --local`, so they never touch the real account.

## Consequences
- The tests exercise the real SQL, crypto and cookie handling. The Worker tests (sessions, families, live updates, queues, feeds) run in a few seconds.
- The browser tests use `wrangler dev --local` on a fresh database seeded by `scripts/e2e-seed.mjs`.
