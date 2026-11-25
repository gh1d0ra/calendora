# 0003 — Stateless HMAC-signed session cookies with a per-family epoch

**Status:** accepted

## Context
A wall tablet should stay signed in for a year with no maintenance, yet a family must be able to sign every device out
(a lost phone, a changed passcode).

## Decision
The session cookie holds `2|familyId|googleSub|epoch|expires`, signed with HMAC-SHA256 using a key stored in D1. There is no session
table. Each family has an `epoch`; "sign out all devices" and passcode changes increment it, which invalidates every
older cookie. Google accounts are re-checked against `accounts` on each request, so removing a person takes effect at once.

## Consequences
- No session storage or cleanup. Verifying a cookie costs one HMAC check and one family lookup.
- Single devices can't be revoked individually; it's all-or-nothing per family, which matches how families use it.
- The signing key lives in D1, so a database leak would allow forging cookies. Moving the key into a Worker secret would separate them.
