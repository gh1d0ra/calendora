// Cross-language check of the subscribe feed: services/ics-py (Python) renders services/ics-py/tests/board.json to
// test/fixtures/calendora-feed.ics (its own tests keep that file current). Here Calendora's JavaScript iCalendar
// engine reads it back, and every occurrence must match what the app itself shows for the same events (occursOn).
process.env.TZ = 'America/New_York';

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import core from '../../lib/core.js';

const { occursOn, parse, ymd, addDays, icsToEvents } = core;
const board = JSON.parse(readFileSync(new URL('../../services/ics-py/tests/board.json', import.meta.url), 'utf8'));
const text = readFileSync(new URL('../fixtures/calendora-feed.ics', import.meta.url), 'utf8');
const NOW = new Date(2026, 10, 24);
const FROM = '2026-10-01', TO = '2027-11-30'; // inside icsToEvents' window around NOW

const days = () => { const out = []; for (let d = parse(FROM); ymd(d) <= TO; d = addDays(d, 1)) out.push(ymd(d)); return out; };

/** What the app shows for one of its own events: "date start-end title" per occurrence. */
function appOccurrences(ev) {
  const out = [];
  for (const ds of days()) {
    if (!occursOn(ev, ds, parse(ds))) continue;
    if (ev.allDay && ev.endDate && !ev.recur && ds !== ev.date) continue; // a multi-day event is one entry
    const overnight = ev.startTime && ev.endTime && ev.endTime <= ev.startTime;
    const time = ev.allDay || !ev.startTime ? 'all-day' : `${ev.startTime}-${overnight ? '23:59' : ev.endTime || addHour(ev.startTime)}`;
    out.push(`${ds} ${time} ${ev.title}`);
  }
  return out;
}
const addHour = hm => `${String(Number(hm.slice(0, 2)) + 1).padStart(2, '0')}${hm.slice(2)}`;

describe('subscribe feed rendered by the Python Worker', () => {
  const parsed = icsToEvents(text, { id: 'sub' }, NOW).filter(e => e.date >= FROM && e.date <= TO);
  const feedOccurrences = title => parsed.filter(e => e.title === title)
    .map(e => `${e.date} ${e.allDay ? 'all-day' : `${e.startTime}-${e.endTime}`} ${e.title}`).sort();

  for (const ev of board.events.filter(e => e.date)) {
    test(`${ev.title} (${ev.recur || 'once'}) has the same occurrences as in the app`, () => {
      const expected = appOccurrences(ev).sort();
      // Feb 29 has no occurrence until 2028: both sides must agree on that (no Feb 28 / Mar 1 stand-in)
      if (ev.date.endsWith('-02-29')) expect(expected).toEqual([]);
      else expect(expected.length).toBeGreaterThan(0);
      expect(feedOccurrences(ev.title)).toEqual(expected);
    });
  }

  test('multi-day events keep their last day', () => {
    const [visit] = parsed.filter(e => e.title === 'Grandma visits');
    expect([visit.date, visit.endDate]).toEqual(['2026-12-22', '2026-12-28']);
  });

  test('locations and people come through', () => {
    const [dentist] = parsed.filter(e => e.title === 'Dentist');
    expect(dentist.location).toBe('Bright Smiles, Suite 4; 2nd floor');
  });
});
