"""Tests for the iCalendar renderer. Run: cd services/ics-py && uv run --with pytest pytest -q"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "src"))

from ics import escape, fold, render, rrule  # noqa: E402

NOW = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
BOARD = json.loads((HERE / "board.json").read_text(encoding="utf-8"))
GOLDEN = HERE.parent.parent.parent / "test" / "fixtures" / "calendora-feed.ics"


def feed(**kw):
    return render(BOARD, name="The Testers", now=NOW, **kw)


def unfold(text):
    return text.replace("\r\n ", "")


def test_matches_the_golden_file_the_js_tests_read():
    # The JS side (test/unit/feed.test.js) parses this exact file with lib/core.js. If the renderer changes on
    # purpose, regenerate it: UPDATE_GOLDEN=1 uv run --with pytest pytest -q
    import os

    if os.environ.get("UPDATE_GOLDEN"):
        GOLDEN.write_bytes(feed().encode("utf-8"))
    assert GOLDEN.read_bytes().decode("utf-8") == feed()


def test_structure_and_line_endings():
    text = feed()
    assert text.startswith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")
    assert text.endswith("END:VCALENDAR\r\n")
    assert "\n" not in text.replace("\r\n", "")
    assert text.count("BEGIN:VEVENT") == 10  # the event without a date is skipped, not fatal
    assert all(len(line.encode()) <= 75 for line in text.split("\r\n"))


def test_repeat_rules_match_lib_core_toRRule():
    assert rrule({"recur": "weekdays", "date": "2026-11-02"}) == "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    assert rrule({"recur": "weekly", "date": "2026-11-04"}) == "FREQ=WEEKLY;BYDAY=WE"  # the start date's weekday
    assert rrule({"recur": "weekly", "date": "2026-11-02", "recurDays": [0, 6]}) == "FREQ=WEEKLY;BYDAY=SU,SA"
    assert rrule({"recur": "biweekly", "date": "2026-11-05"}) == "FREQ=WEEKLY;INTERVAL=2"
    assert rrule({"recur": "daily", "date": "2026-11-01", "until": "2026-11-10"}) == "FREQ=DAILY;UNTIL=20261110T235959"
    assert rrule({"recur": "monthly", "date": "2026-01-31", "allDay": True, "until": "2026-06-30"}) == "FREQ=MONTHLY;UNTIL=20260630"
    assert rrule({"recur": "none", "date": "2026-11-01"}) is None


def test_times_are_floating_and_all_day_is_exclusive():
    text = unfold(feed())
    assert "DTSTART:20261103T100000\r\nDTEND:20261103T110000" in text  # no Z, no TZID
    assert "DTSTART;VALUE=DATE:20261222\r\nDTEND;VALUE=DATE:20261229" in text  # multi-day, DTEND exclusive
    assert "DTSTART:20261107T230000\r\nDTEND:20261108T010000" in text  # 23:00–01:00 ends after midnight
    assert "DTSTART:20261101T080000\r\nDTEND:20261101T090000" in text  # no end time: one hour


def test_skipped_days_people_and_escaping():
    text = unfold(feed())
    assert "EXDATE:20261126T074500\r\nEXDATE:20261127T074500" in text
    assert "LOCATION:Bright Smiles\\, Suite 4\\; 2nd floor" in text
    assert "DESCRIPTION:With: Ana\\, Mom" in text
    assert "DESCRIPTION:Airport pickup at 3 pm.\\nBring the car seat" in text
    assert "SUMMARY:Ana's birthday 🎂" in text


def test_one_person_feed():
    text = unfold(feed(member="m3"))
    assert "X-WR-CALNAME:The Testers · Ana" in text
    assert "SUMMARY:Dentist" in text and "SUMMARY:Piano lesson" in text
    assert "SUMMARY:Yoga" not in text  # Mom's
    assert "SUMMARY:Trash out" in text  # nobody in particular: everyone's


def test_fold_never_splits_a_character():
    line = "SUMMARY:" + "é🎂" * 40
    folded = fold(line)
    assert unfold(folded) == line
    assert all(len(p.encode()) <= 75 for p in folded.split("\r\n"))


def test_escape():
    assert escape("a,b;c\\d\ne") == "a\\,b\\;c\\\\d\\ne"
