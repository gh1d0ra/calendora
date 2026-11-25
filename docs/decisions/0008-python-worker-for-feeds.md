# 0008 — Subscribe feeds rendered by a separate Python Worker, behind a service binding

**Status:** accepted

## Context
Families asked to see Calendora's events in the calendar app on their phones. That needs an iCalendar feed at a secret
URL: calendar apps can't sign in. Rendering iCalendar has many small rules:
- escaping;
- 75-octet line folding that never splits a UTF-8 character;
- exclusive all-day end dates;
- floating times;
- RRULE and EXDATE.

## Decision
- A **separate Worker in Python** (`services/ics-py`) renders the feed. It has no public URL (`workers_dev = false`).
  The main Worker reaches it through a **service binding** (`env.ICS`).
- **The main Worker owns everything about trust.** It creates the per-family secret (only its SHA-256 is stored, and a
  new link replaces the old one), checks it, loads the board, filters by person, and sets the cache headers. The Python
  Worker gets JSON and returns text. It sees no secrets, sessions or database.
- **The renderer is pure standard-library Python** (`src/ics.py`), so the same code runs in the Worker and in pytest.
- **Repeats map to RRULEs** exactly as `lib/core.js → toRRule` does for Google Calendar. Times are floating: a family
  calendar means "4 pm wherever we are".

## Why a second language here
The feed is a self-contained transformation with a narrow interface (JSON in, text out), so it can live in any runtime.
Doing it in Python shows a polyglot setup that is actually well-bounded: a separate deploy, a service binding with no
network hop, and a typed boundary that is tested from both sides.
- **Python side:** `services/ics-py/tests` renders `tests/board.json` to the committed file
  `test/fixtures/calendora-feed.ics` and fails if the output changes.
- **JavaScript side:** `test/unit/feed.test.js` parses that same file with Calendora's own iCalendar engine and checks
  every occurrence against the app's repeat logic (`occursOn`), including:
  - the daylight-saving change;
  - the 31st of each month;
  - Feb 29;
  - skipped dates;
  - an event that runs past midnight.

## Consequences
- **Deploy order matters.** `calendora-ics` must exist before the main Worker can bind to it.
- **Cold starts.** Python Workers start more slowly than JavaScript ones. That's acceptable for a feed that calendar
  apps poll about hourly, with a 15-minute `Cache-Control`.
- **Two implementations of the repeat mapping** (`toRRule` in JS, `rrule` in Python). They're kept honest by the
  cross-language test, not by sharing code.
