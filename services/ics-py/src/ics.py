"""Renders a Calendora family board as an iCalendar (RFC 5545) feed that phones can subscribe to.

Pure Python with no imports outside the standard library, so the same code runs in the Python Worker
(src/entry.py) and in plain pytest. The repeat options map to RRULEs exactly as lib/core.js → toRRule does for
Google Calendar. Times are *floating* (no time zone): a family calendar means "4 pm wherever we are", and
calendar apps show floating times in the phone's own zone.

Cross-language check: tests/test_ics.py renders tests/board.json to ../../test/fixtures/calendora-feed.ics, and
test/unit/feed.test.js reads that file with Calendora's own iCalendar parser and checks every occurrence
against occursOn().
"""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone

PRODID = "-//Calendora//Family calendar//EN"
BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]  # Python's weekday(): Monday = 0
RECUR = {
    "daily": "FREQ=DAILY",
    "weekdays": "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "biweekly": "FREQ=WEEKLY;INTERVAL=2",
    "monthly": "FREQ=MONTHLY",
    "yearly": "FREQ=YEARLY",
}


def escape(text: str) -> str:
    """TEXT value escaping (RFC 5545 §3.3.11)."""
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def fold(line: str) -> str:
    """Folds a content line at 75 octets without splitting a UTF-8 character (RFC 5545 §3.1)."""
    out, cur, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        if size + n > (75 if not out else 74):  # continuation lines start with a space
            out.append(cur)
            cur, size = "", 0
        cur += ch
        size += n
    out.append(cur)
    return "\r\n ".join(out)


def _d(s: str) -> date:
    return date.fromisoformat(s)


def _ymd(d: date) -> str:
    return d.strftime("%Y%m%d")


def _local(d: date, hhmm: str) -> str:
    return f"{_ymd(d)}T{hhmm.replace(':', '')}00"


def _uid(ev: dict) -> str:
    if ev.get("id"):
        return f"{ev['id']}@calendora"
    digest = hashlib.sha1(f"{ev.get('title')}|{ev.get('date')}|{ev.get('startTime')}".encode()).hexdigest()[:16]
    return f"{digest}@calendora"


def rrule(ev: dict) -> str | None:
    """The event's repeat as an RRULE value, or None. Mirrors lib/core.js toRRule (floating UNTIL)."""
    kind = ev.get("recur") or "none"
    if kind == "weekly":
        days = ev.get("recurDays") or [(_d(ev["date"]).weekday() + 1) % 7]  # JS days: Sunday = 0
        rule = "FREQ=WEEKLY;BYDAY=" + ",".join(BYDAY[(int(d) - 1) % 7] for d in days)
    elif kind in RECUR:
        rule = RECUR[kind]
    else:
        return None
    if ev.get("until"):
        rule += f";UNTIL={_ymd(_d(ev['until']))}" + ("" if ev.get("allDay") else "T235959")
    return rule


def vevent(ev: dict, members: dict[str, str], stamp: str) -> list[str]:
    start = _d(ev["date"])
    lines = ["BEGIN:VEVENT", f"UID:{_uid(ev)}", f"DTSTAMP:{stamp}"]
    timed = not ev.get("allDay") and ev.get("startTime")
    if timed:
        begin = datetime.fromisoformat(f"{ev['date']}T{ev['startTime']}")
        end = datetime.fromisoformat(f"{ev['date']}T{ev['endTime']}") if ev.get("endTime") else begin + timedelta(hours=1)
        if end <= begin:  # ends after midnight (23:00–01:00)
            end += timedelta(days=1)
        lines += [f"DTSTART:{begin.strftime('%Y%m%dT%H%M%S')}", f"DTEND:{end.strftime('%Y%m%dT%H%M%S')}"]
    else:
        last = _d(ev["endDate"]) if ev.get("endDate") and not ev.get("recur") else start
        lines += [f"DTSTART;VALUE=DATE:{_ymd(start)}", f"DTEND;VALUE=DATE:{_ymd(last + timedelta(days=1))}"]
    rule = rrule(ev)
    if rule:
        lines.append(f"RRULE:{rule}")
        for ex in sorted(ev.get("exdates") or []):
            lines.append(f"EXDATE:{_local(_d(ex), ev['startTime'])}" if timed else f"EXDATE;VALUE=DATE:{_ymd(_d(ex))}")
    lines.append(f"SUMMARY:{escape(ev.get('title') or 'Event')}")
    if ev.get("location"):
        lines.append(f"LOCATION:{escape(ev['location'])}")
    who = [members[m] for m in (ev.get("memberIds") or []) if m in members]
    notes = [f"With: {', '.join(who)}"] if who else []
    if ev.get("notes"):
        notes.append(str(ev["notes"]))
    if notes:
        lines.append(f"DESCRIPTION:{escape(chr(10).join(notes))}")
        if who:
            lines.append(f"CATEGORIES:{','.join(escape(w) for w in who)}")
    lines.append("END:VEVENT")
    return lines


def render(board: dict, *, name: str = "Calendora", member: str | None = None, now: datetime | None = None) -> str:
    """The whole feed. With `member`, only that person's events (and events for everyone)."""
    now = now or datetime.now(timezone.utc)
    stamp = now.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    members = {m["id"]: m.get("name", "") for m in board.get("members") or [] if isinstance(m, dict) and m.get("id")}
    out = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape(name if not member or member not in members else f'{name} · {members[member]}')}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]
    for ev in board.get("events") or []:
        if not isinstance(ev, dict) or not ev.get("date"):
            continue
        ids = ev.get("memberIds") or []
        if member and ids and member not in ids:
            continue
        try:
            out += vevent(ev, members, stamp)
        except (ValueError, KeyError, TypeError):
            continue  # one malformed event never breaks the whole feed
    out.append("END:VCALENDAR")
    return "\r\n".join(fold(line) for line in out) + "\r\n"
