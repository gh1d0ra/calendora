# 0004 — Fetch .ics feeds on the server, expand them in the browser

**Status:** accepted

## Context
iCloud "Public Calendar" links don't allow cross-origin requests from browsers, and they're sometimes slow or down.
Repeating events must show in each device's local time.

## Decision
The Worker fetches a feed (only feeds stored in the family's board, so it isn't an open proxy) and keeps the last good
copy in D1. When the source fails, it serves that copy, marked with `X-Snapshot-At` and `X-Snapshot-Reason`. The browser
parses and expands the feed with `lib/core.js`, using `Intl.DateTimeFormat` for time-zone offsets, for a window from 2 months back to 13 months ahead.

## Consequences
- No RRULE library and no time-zone database to ship. `Intl` already knows every zone and daylight-saving rule.
- Expansion is fully unit-tested (zones, DST, EXDATE, moved and cancelled instances, BYDAY/BYMONTHDAY, COUNT/UNTIL).
- Uncommon RRULE parts aren't supported: BYSETPOS and BYWEEKNO are ignored, and HOURLY or MINUTELY series aren't shown.
