# 0009 — Roll out the Content-Security-Policy in report-only mode first

**Status:** accepted (enforcement pending a week of clean reports)

## Context
The app's pages had no security headers. A strict CSP is the main defence against script injection, for example through
event titles or feed text that slipped past escaping. But Calendora runs unattended on wall tablets. A policy that blocks
something it shouldn't, such as Google's sign-in frame or a font, breaks the family's calendar with nobody at a
keyboard to notice.

## Decision
- `_headers` (applied by Workers static assets) **enforces** `nosniff`, `X-Frame-Options: DENY`, a strict
  `Permissions-Policy` and HSTS. It sends the CSP as `Content-Security-Policy-Report-Only`, with
  `report-uri /api/csp-report`.
- **The report endpoint** logs each report (directive, blocked origin, page without its query) and counts it in
  Analytics Engine.
- **The browser tests** (`e2e/security.spec.mjs`) check the headers and that normal use produces no reports.
- **The one inline event handler** (`onerror` on news pictures) was replaced with a listener, so the policy needs no
  `'unsafe-inline'` for scripts.
- **After a week of real use with no reports,** the header is renamed to `Content-Security-Policy`.

## Consequences
- No risk to the live screens while the policy is proven.
- Until it's enforced, the CSP only detects problems and doesn't block them. Escaping (`esc`) is still the first line of defence.
- Styles still allow `'unsafe-inline'`, because colors are set with inline styles.
