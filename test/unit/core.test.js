// lib/core.js: Calendora's own repeat rules, the RRULE sent to Google, and the iCalendar (.ics) feed engine.
// Runs in a fixed time zone so "local" times are predictable (the app shows events in the device's zone).
process.env.TZ = 'America/New_York';

import { describe, expect, test } from 'vitest';
import core from '../../lib/core.js';

const { occursOn, toRRule, parse, ymd, addDays, rruleWalls, icsParse, icsDuration, icsToEvents } = core;

const on = (ev, ds) => occursOn(ev, ds, parse(ds));
const days = (from, to) => { const out = []; for (let d = parse(from); ymd(d) <= to; d = addDays(d, 1)) out.push(ymd(d)); return out; };
const datesOf = (ev, from, to) => days(from, to).filter(ds => on(ev, ds));

describe('occursOn — Calendora events', () => {
  test('one-off and multi-day all-day events', () => {
    expect(datesOf({ date: '2026-03-10' }, '2026-03-01', '2026-03-31')).toEqual(['2026-03-10']);
    expect(datesOf({ date: '2026-03-10', allDay: true, endDate: '2026-03-12' }, '2026-03-01', '2026-03-31')).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  test('daily, weekdays, and skipped dates / end date', () => {
    expect(datesOf({ date: '2026-03-02', recur: 'weekdays' }, '2026-03-02', '2026-03-08')).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
    const ev = { date: '2026-03-01', recur: 'daily', exdates: ['2026-03-03'], until: '2026-03-05' };
    expect(datesOf(ev, '2026-02-25', '2026-03-10')).toEqual(['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05']);
  });

  test('weekly on chosen days, or on the start day when none are chosen', () => {
    expect(datesOf({ date: '2026-03-02', recur: 'weekly', recurDays: [1, 3] }, '2026-03-01', '2026-03-14')).toEqual(['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11']);
    expect(datesOf({ date: '2026-03-05', recur: 'weekly' }, '2026-03-01', '2026-03-20')).toEqual(['2026-03-05', '2026-03-12', '2026-03-19']);
  });

  test('every 2 weeks', () => {
    expect(datesOf({ date: '2026-03-02', recur: 'biweekly' }, '2026-03-01', '2026-04-15')).toEqual(['2026-03-02', '2026-03-16', '2026-03-30', '2026-04-13']);
  });

  test('biweekly stays on its weeks across the DST change', () => {
    // Clocks change on 2026-03-08 and 2026-11-01 in New York; whole-day maths must not drift.
    expect(datesOf({ date: '2026-02-23', recur: 'biweekly' }, '2026-02-23', '2026-03-31')).toEqual(['2026-02-23', '2026-03-09', '2026-03-23']);
  });

  test('monthly on the 31st skips short months; yearly on Feb 29 only in leap years', () => {
    expect(datesOf({ date: '2026-01-31', recur: 'monthly' }, '2026-01-01', '2026-06-30')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    expect(datesOf({ date: '2024-02-29', recur: 'yearly' }, '2024-01-01', '2028-12-31')).toEqual(['2024-02-29', '2028-02-29']);
  });
});

describe('toRRule — what gets saved to Google Calendar', () => {
  test('maps each repeat option', () => {
    expect(toRRule({ date: '2026-03-02', recur: 'none' })).toBeNull();
    expect(toRRule({ date: '2026-03-02', recur: 'daily' })).toEqual(['RRULE:FREQ=DAILY']);
    expect(toRRule({ date: '2026-03-02', recur: 'weekdays' })).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']);
    expect(toRRule({ date: '2026-03-02', recur: 'weekly', recurDays: [1, 3] })).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE']);
    expect(toRRule({ date: '2026-03-05', recur: 'weekly' })).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=TH']);
    expect(toRRule({ date: '2026-03-02', recur: 'biweekly' })).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2']);
  });
  test('end dates: a date for all-day events, end of that day in UTC for timed ones', () => {
    expect(toRRule({ date: '2026-03-02', recur: 'daily', allDay: true, until: '2026-04-01' })).toEqual(['RRULE:FREQ=DAILY;UNTIL=20260401']);
    expect(toRRule({ date: '2026-03-02', recur: 'daily', until: '2026-04-01' })).toEqual(['RRULE:FREQ=DAILY;UNTIL=20260401T235959Z']);
  });
});

describe('Calendora and Google agree on every repeat option', () => {
  // The app decides what to show with occursOn; Google expands toRRule(). They must produce the same days.
  const wallDay = w => new Date(w).toISOString().slice(0, 10);
  const viaRRule = (ev, from, to) => {
    const [y, m, d] = ev.date.split('-').map(Number);
    const rule = toRRule(ev)[0].replace('RRULE:', '');
    return rruleWalls(Date.UTC(y, m - 1, d), rule, Date.UTC(...from.split('-').map((n, i) => (i === 1 ? n - 1 : +n))),
      Date.UTC(...to.split('-').map((n, i) => (i === 1 ? n - 1 : +n))), new Set()).map(wallDay);
  };
  const cases = [
    { recur: 'daily', date: '2026-01-15' },
    { recur: 'weekdays', date: '2026-01-15' },
    { recur: 'weekly', date: '2026-01-15', recurDays: [0, 2, 6] },
    { recur: 'weekly', date: '2026-01-15' },
    { recur: 'biweekly', date: '2026-01-15' },
    { recur: 'monthly', date: '2026-01-31' },
    { recur: 'monthly', date: '2026-01-15', until: '2026-09-15' },
    { recur: 'yearly', date: '2024-02-29' },
  ];
  test.each(cases)('$recur from $date', c => {
    const ev = { allDay: true, ...c };
    const from = '2026-01-01', to = '2028-12-31';
    expect(viaRRule(ev, from, to)).toEqual(datesOf(ev, from, to));
  });
});

// ------------------------------------------------------------------ iCalendar feeds
const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap(e => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const feed = { id: 'f1' };
const NOW = new Date(2026, 9, 15); // the window runs ~2 months back and ~13 months ahead of this day
const expand = text => icsToEvents(text, feed, NOW).map(e => `${e.date} ${e.allDay ? 'all-day' : `${e.startTime}-${e.endTime}`} ${e.title}`).sort();

describe('icsParse and helpers', () => {
  test('unfolds long lines, reads parameters, ignores nested alarms', () => {
    const [e] = icsParse(ics(['UID:1', 'SUMMARY:Piano', ' lesson', 'DTSTART;TZID=America/Chicago:20261020T170000', 'BEGIN:VALARM', 'SUMMARY:Alarm!', 'END:VALARM']));
    expect(e.SUMMARY.v).toBe('Pianolesson');
    expect(e.DTSTART.p.TZID).toBe('America/Chicago');
  });
  test('durations', () => {
    expect(icsDuration('PT1H30M')).toBe(90 * 60e3);
    expect(icsDuration('P1W')).toBe(7 * 86400e3);
    expect(icsDuration('-PT15M')).toBe(-15 * 60e3);
    expect(icsDuration('nonsense')).toBe(0);
  });
});

describe('icsToEvents', () => {
  test('converts a zoned time to local time, and keeps text readable', () => {
    const out = icsToEvents(ics(['UID:a', 'SUMMARY:Call\\, then lunch', 'LOCATION:1 Main St\\nSpringfield', 'DTSTART;TZID=America/Los_Angeles:20261020T090000', 'DTEND;TZID=America/Los_Angeles:20261020T100000']), feed, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-10-20', startTime: '12:00', endTime: '13:00', title: 'Call, then lunch', location: '1 Main St, Springfield', source: 'apple', readOnly: true });
  });

  test('UTC times, durations and floating times', () => {
    expect(expand(ics(['UID:u', 'SUMMARY:UTC', 'DTSTART:20261020T140000Z', 'DURATION:PT45M']))).toEqual(['2026-10-20 10:00-10:45 UTC']);
    expect(expand(ics(['UID:f', 'SUMMARY:Floating', 'DTSTART:20261021T080000', 'DTEND:20261021T083000']))).toEqual(['2026-10-21 08:00-08:30 Floating']);
  });

  test('all-day events: DTEND is exclusive', () => {
    const [e] = icsToEvents(ics(['UID:t', 'SUMMARY:Trip', 'DTSTART;VALUE=DATE:20261023', 'DTEND;VALUE=DATE:20261026']), feed, NOW);
    expect(e).toMatchObject({ allDay: true, date: '2026-10-23', endDate: '2026-10-25' });
  });

  test('weekly series with a skipped date, a moved occurrence and a cancelled one', () => {
    const out = expand(ics(
      ['UID:s1', 'SUMMARY:Soccer', 'DTSTART;TZID=America/New_York:20261005T170000', 'DTEND;TZID=America/New_York:20261005T180000',
        'RRULE:FREQ=WEEKLY;COUNT=5', 'EXDATE;TZID=America/New_York:20261012T170000'],
      ['UID:s1', 'SUMMARY:Soccer (moved)', 'RECURRENCE-ID;TZID=America/New_York:20261019T170000', 'DTSTART;TZID=America/New_York:20261020T180000', 'DTEND;TZID=America/New_York:20261020T190000'],
      ['UID:s1', 'SUMMARY:Soccer', 'STATUS:CANCELLED', 'RECURRENCE-ID;TZID=America/New_York:20261026T170000', 'DTSTART;TZID=America/New_York:20261026T170000'],
    ));
    expect(out).toEqual(['2026-10-05 17:00-18:00 Soccer', '2026-10-20 18:00-19:00 Soccer (moved)', '2026-11-02 17:00-18:00 Soccer']);
  });

  test('a weekly 9 am event stays at 9 am when the clocks change (Nov 1, 2026)', () => {
    const out = expand(ics(['UID:d', 'SUMMARY:Standup', 'DTSTART;TZID=America/New_York:20261019T090000', 'DTEND;TZID=America/New_York:20261019T091500', 'RRULE:FREQ=WEEKLY;UNTIL=20261110T000000Z']));
    expect(out).toEqual(['2026-10-19 09:00-09:15 Standup', '2026-10-26 09:00-09:15 Standup', '2026-11-02 09:00-09:15 Standup', '2026-11-09 09:00-09:15 Standup']);
  });

  test('a London event moves on New York clocks when only one side changes time', () => {
    // UK clocks change Oct 25, US clocks Nov 1: for that week the gap is 4 hours instead of 5.
    const out = expand(ics(['UID:l', 'SUMMARY:Grandma call', 'DTSTART;TZID=Europe/London:20261018T150000', 'DURATION:PT30M', 'RRULE:FREQ=WEEKLY;COUNT=3']));
    expect(out).toEqual(['2026-10-18 10:00-10:30 Grandma call', '2026-10-25 11:00-11:30 Grandma call', '2026-11-01 10:00-10:30 Grandma call']);
  });

  test('monthly by weekday and by last day, yearly, interval', () => {
    const titles = expand(ics(
      ['UID:m1', 'SUMMARY:PTA', 'DTSTART;VALUE=DATE:20261013', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3'],
      ['UID:m2', 'SUMMARY:Rent', 'DTSTART;VALUE=DATE:20261031', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3'],
      ['UID:y', 'SUMMARY:Birthday', 'DTSTART;VALUE=DATE:20200105', 'RRULE:FREQ=YEARLY'],
      ['UID:i', 'SUMMARY:Bins', 'DTSTART;VALUE=DATE:20261001', 'RRULE:FREQ=DAILY;INTERVAL=10;COUNT=4'],
    ));
    expect(titles).toEqual(expect.arrayContaining([
      '2026-10-13 all-day PTA', '2026-11-10 all-day PTA', '2026-12-08 all-day PTA',
      '2026-10-31 all-day Rent', '2026-11-30 all-day Rent', '2026-12-31 all-day Rent',
      '2027-01-05 all-day Birthday',
      '2026-10-01 all-day Bins', '2026-10-11 all-day Bins', '2026-10-21 all-day Bins', '2026-10-31 all-day Bins',
    ]));
    expect(titles.filter(t => t.endsWith('Birthday'))).toEqual(['2027-01-05 all-day Birthday']); // only inside the window
    expect(titles.filter(t => t.endsWith('PTA'))).toHaveLength(3);
  });

  test('ignores events outside the window and cancelled one-offs', () => {
    expect(expand(ics(
      ['UID:old', 'SUMMARY:Old', 'DTSTART:20200101T100000Z'],
      ['UID:x', 'SUMMARY:Off', 'STATUS:CANCELLED', 'DTSTART:20261020T100000Z'],
      ['UID:n', 'DTSTART:20261022T100000Z'],
    ))).toEqual(['2026-10-22 06:00-06:00 (No title)']);
  });

  test('every occurrence gets a stable, unique id', () => {
    const out = icsToEvents(ics(['UID:r', 'SUMMARY:Daily', 'DTSTART:20261020T120000Z', 'RRULE:FREQ=DAILY;COUNT=5']), feed, NOW);
    expect(new Set(out.map(e => e.id)).size).toBe(5);
    expect(icsToEvents(ics(['UID:r', 'SUMMARY:Daily', 'DTSTART:20261020T120000Z', 'RRULE:FREQ=DAILY;COUNT=5']), feed, NOW).map(e => e.id)).toEqual(out.map(e => e.id));
  });
});
