/* Calendora core: pure date, recurrence and iCalendar logic. No DOM and no app state.
 * Loaded by index.html before app.js (as window.CalendoraCore) and imported by the unit tests (test/).
 */
'use strict';
(function (root) {
const DAY_MS = 86400000;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// ---------------------------------------------------------------- recurrence (Calendora's own events)
// Does event ev happen on day ds ('YYYY-MM-DD'; dd is the same day as a Date)?
function occursOn(ev, ds, dd) {
  if (ds < ev.date) return false;
  if (ev.exdates && ev.exdates.includes(ds)) return false;
  if (ev.until && ds > ev.until) return false;
  const start = parse(ev.date);
  switch (ev.recur || 'none') {
    case 'none': return ev.allDay && ev.endDate ? ds <= ev.endDate : ds === ev.date;
    case 'daily': return true;
    case 'weekdays': return dd.getDay() > 0 && dd.getDay() < 6;
    case 'weekly': return (ev.recurDays && ev.recurDays.length ? ev.recurDays : [start.getDay()]).includes(dd.getDay());
    case 'biweekly': return dd.getDay() === start.getDay() && (daysBetween(start, dd) / 7) % 2 === 0;
    case 'monthly': return dd.getDate() === start.getDate();
    case 'yearly': return dd.getDate() === start.getDate() && dd.getMonth() === start.getMonth();
    default: return false;
  }
}

// The same repeat rule as an RFC 5545 RRULE, for saving to Google Calendar.
function toRRule(e) {
  const until = e.until ? `;UNTIL=${e.until.replace(/-/g, '')}${e.allDay ? '' : 'T235959Z'}` : '';
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const map = {
    daily: 'FREQ=DAILY',
    weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    weekly: `FREQ=WEEKLY;BYDAY=${(e.recurDays && e.recurDays.length ? e.recurDays : [parse(e.date).getDay()]).map(i => BY[i]).join(',')}`,
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    monthly: 'FREQ=MONTHLY',
    yearly: 'FREQ=YEARLY',
  };
  return map[e.recur] ? [`RRULE:${map[e.recur]}${until}`] : null;
}

// ---------------------------------------------------------------- iCalendar feeds (Apple / iCloud, read-only)
// Parses a feed and expands repeating events (RRULE, EXDATE, RECURRENCE-ID overrides, time zones) into
// one Calendora event per occurrence, for a window from about 2 months back to 13 months ahead of `t`.
const icsUnescape = s => (s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
function icsParse(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null, skip = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { EXDATE: [] }; skip = 0; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { skip++; continue; } // e.g. VALARM
    if (line.startsWith('END:')) { skip = Math.max(0, skip - 1); continue; }
    if (skip) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const p = {};
    params.forEach(x => { const j = x.indexOf('='); if (j > 0) p[x.slice(0, j).toUpperCase()] = x.slice(j + 1).replace(/^"|"$/g, ''); });
    const N = name.toUpperCase(), v = line.slice(i + 1);
    if (N === 'EXDATE') v.split(',').forEach(x => cur.EXDATE.push({ v: x, p }));
    else cur[N] = { v, p };
  }
  return events;
}
function icsTime(prop) {
  if (!prop) return null;
  const v = String(prop.v).trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const allDay = prop.p.VALUE === 'DATE' || !m[4];
  return { allDay, y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0), utc: !!m[7], tz: prop.p.TZID || null };
}
const wallOf = t => Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s); // ms whose UTC fields equal the wall-clock fields
const tzFmt = {};
function tzOffset(ts, tz) {
  let f = tzFmt[tz];
  if (!f) f = tzFmt[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = {};
  f.formatToParts(new Date(ts)).forEach(x => { p[x.type] = x.value; });
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
}
function wallToInstant(wall, t) {
  if (t.utc) return wall;
  if (!t.tz) return null; // floating time: show as written
  try {
    const o1 = tzOffset(wall, t.tz);
    let ts = wall - o1;
    const o2 = tzOffset(ts, t.tz);
    if (o2 !== o1) ts = wall - o2;
    return ts;
  } catch (e) { return null; }
}
// Put a time (EXDATE / RECURRENCE-ID) on the same wall clock as the event's start.
function wallLike(t, st) {
  if (st.allDay) return Date.UTC(t.y, t.mo - 1, t.d, st.h, st.mi, st.s);
  if (t.utc && !st.utc && st.tz) { const inst = wallOf(t); try { return inst + tzOffset(inst, st.tz); } catch (e) { return inst; } }
  return wallOf(t);
}
function icsDuration(v) {
  const m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function monthByDay(y, m, byday, dim) {
  const out = [];
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  byday.forEach(b => {
    const first = 1 + ((b.d - firstDow + 7) % 7);
    const all = [];
    for (let d = first; d <= dim; d += 7) all.push(d);
    if (!b.n) out.push(...all);
    else { const d = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (d) out.push(d); }
  });
  return out;
}
// Returns the wall-clock start of every occurrence inside [winStart, winEnd].
function rruleWalls(startWall, rule, winStart, winEnd, exset) {
  const r = {};
  rule.split(';').forEach(kv => { const i = kv.indexOf('='); if (i > 0) r[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); });
  const freq = r.FREQ;
  const iv = Math.max(1, parseInt(r.INTERVAL || '1', 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  let until = Infinity;
  if (r.UNTIL) { const t = icsTime({ v: r.UNTIL, p: {} }); if (t) until = t.allDay ? Date.UTC(t.y, t.mo - 1, t.d, 23, 59, 59) : wallOf(t); }
  const tod = ((startWall % DAY_MS) + DAY_MS) % DAY_MS;
  const sd = new Date(startWall);
  const sy = sd.getUTCFullYear(), sm = sd.getUTCMonth(), sdate = sd.getUTCDate(), sdow = sd.getUTCDay();
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.trim().match(/^([+-]?\d+)?([A-Z]{2})$/); return m && m[2] in WD ? { n: m[1] ? parseInt(m[1], 10) : 0, d: WD[m[2]] } : null; }).filter(Boolean) : null;
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null;
  const bymonth = r.BYMONTH ? r.BYMONTH.split(',').map(n => Number(n) - 1) : null;
  const out = [];
  let n = 0;
  const jump = count === Infinity && winStart > startWall; // safe to skip ahead when occurrences aren't counted
  const push = w => {
    if (w < startWall) return true;
    if (w > until || n >= count) return false;
    n++;
    if (w >= winStart && w <= winEnd && !exset.has(w)) out.push(w);
    return w <= winEnd;
  };
  const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const monthDays = (y, m, fallback) => {
    const days = dim(y, m);
    let list;
    if (bymd) list = bymd.map(x => (x < 0 ? days + 1 + x : x)).filter(x => x >= 1 && x <= days);
    else if (byday) list = monthByDay(y, m, byday, days);
    else list = fallback <= days ? [fallback] : [];
    return [...new Set(list)].sort((a, b) => a - b);
  };
  if (freq === 'DAILY') {
    let k = jump ? Math.max(0, Math.floor((winStart - startWall) / DAY_MS / iv) - 1) : 0;
    for (let g = 0; g < 6000; g++, k++) {
      const w = startWall + k * iv * DAY_MS;
      if (w > winEnd || w > until) break;
      const dt = new Date(w);
      if (bymonth && !bymonth.includes(dt.getUTCMonth())) continue;
      if (byday && !byday.some(b => b.d === dt.getUTCDay())) continue;
      if (!push(w)) break;
    }
  } else if (freq === 'WEEKLY') {
    const wkst = WD[r.WKST] ?? 1;
    const offs = [...new Set((byday && byday.length ? byday.map(b => b.d) : [sdow]).map(d => (d - wkst + 7) % 7))].sort((a, b) => a - b);
    const weekStart = startWall - ((sdow - wkst + 7) % 7) * DAY_MS;
    let k = jump ? Math.max(0, Math.floor((winStart - weekStart) / (7 * DAY_MS) / iv) - 1) : 0;
    outer: for (let g = 0; g < 3000; g++, k++) {
      const ws = weekStart + k * iv * 7 * DAY_MS;
      if (ws > winEnd || ws > until) break;
      for (const o of offs) if (!push(ws + o * DAY_MS)) break outer;
    }
  } else if (freq === 'MONTHLY') {
    let k = 0;
    if (jump) { const w = new Date(winStart); k = Math.max(0, Math.floor(((w.getUTCFullYear() - sy) * 12 + w.getUTCMonth() - sm) / iv) - 1); }
    outer: for (let g = 0; g < 1200; g++, k++) {
      const mi = sm + k * iv, y = sy + Math.floor(mi / 12), m = ((mi % 12) + 12) % 12;
      if (Date.UTC(y, m, 1) > winEnd || Date.UTC(y, m, 1) > until) break;
      for (const d of monthDays(y, m, sdate)) if (!push(Date.UTC(y, m, d) + tod)) break outer;
    }
  } else if (freq === 'YEARLY') {
    let k = jump ? Math.max(0, Math.floor((new Date(winStart).getUTCFullYear() - sy) / iv) - 1) : 0;
    outer: for (let g = 0; g < 300; g++, k++) {
      const y = sy + k * iv;
      if (Date.UTC(y, 0, 1) > winEnd || Date.UTC(y, 0, 1) > until) break;
      const cands = [];
      (bymonth || [sm]).forEach(m => {
        const days = bymd || byday ? monthDays(y, m, sdate) : sdate <= dim(y, m) ? [sdate] : [];
        days.forEach(d => cands.push(Date.UTC(y, m, d) + tod));
      });
      cands.sort((a, b) => a - b);
      for (const w of cands) if (!push(w)) break outer;
    }
  }
  return out;
}

function icsToEvents(text, feed, t = today()) {
  const raw = icsParse(text);
  const winStart = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() - 62);
  const winEnd = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + 400);
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const out = [];
  const overrides = new Map();
  const masters = [];
  raw.forEach(e => {
    if (!e.DTSTART) return;
    if (e['RECURRENCE-ID']) {
      const key = (e.UID && e.UID.v) || '';
      if (!overrides.has(key)) overrides.set(key, []);
      overrides.get(key).push(e);
    } else masters.push(e);
  });
  const cancelled = e => e.STATUS && /CANCELLED/i.test(e.STATUS.v);
  const durationOf = (e, st) => {
    if (e.DTEND) { const et = icsTime(e.DTEND); if (et) { const a = wallToInstant(wallOf(st), st), b = wallToInstant(wallOf(et), et); return a !== null && b !== null ? b - a : wallOf(et) - wallOf(st); } }
    if (e.DURATION) return icsDuration(e.DURATION.v);
    return st.allDay ? DAY_MS : 0;
  };
  let seq = 0;
  const emit = (e, st, w, dur) => {
    if (out.length >= 4000) return;
    const uidPart = String((e.UID && e.UID.v) || `n${seq++}`).replace(/[^\w.@-]/g, '').slice(0, 60);
    const base = {
      id: `a_${feed.id}_${uidPart}_${w}`, source: 'apple', feed: feed.id, readOnly: true,
      title: icsUnescape(e.SUMMARY && e.SUMMARY.v) || '(No title)',
      location: icsUnescape(e.LOCATION && e.LOCATION.v).replace(/\s*\n\s*/g, ', ').slice(0, 200),
      notes: icsUnescape(e.DESCRIPTION && e.DESCRIPTION.v).slice(0, 1000),
      recur: 'none', recurDays: [], exdates: [], until: null, memberIds: [],
    };
    if (st.allDay) {
      const s = new Date(w), endW = w + Math.max(dur, DAY_MS) - DAY_MS;
      const date = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
      const e2 = new Date(endW);
      const endDate = `${e2.getUTCFullYear()}-${pad(e2.getUTCMonth() + 1)}-${pad(e2.getUTCDate())}`;
      out.push({ ...base, allDay: true, date, endDate: endDate > date ? endDate : null, startTime: '', endTime: '' });
      return;
    }
    const inst = wallToInstant(w, st);
    const fw = new Date(w);
    const s = inst === null ? new Date(fw.getUTCFullYear(), fw.getUTCMonth(), fw.getUTCDate(), fw.getUTCHours(), fw.getUTCMinutes()) : new Date(inst);
    const e2 = new Date(s.getTime() + Math.max(dur, 0));
    out.push({ ...base, allDay: false, date: ymd(s), endDate: null, startTime: hm(s), endTime: ymd(s) === ymd(e2) ? hm(e2) : '23:59' });
  };
  const emitStandalone = e => {
    if (cancelled(e)) return;
    const st = icsTime(e.DTSTART); if (!st) return;
    const sw = wallOf(st), dur = durationOf(e, st);
    if (sw + Math.max(dur, 0) >= winStart && sw <= winEnd) emit(e, st, sw, dur);
  };
  masters.forEach(e => {
    if (cancelled(e)) return;
    const st = icsTime(e.DTSTART); if (!st) return;
    const sw = wallOf(st), dur = durationOf(e, st);
    const key = (e.UID && e.UID.v) || '';
    const ovList = overrides.get(key) || [];
    overrides.delete(key);
    if (!e.RRULE) { if (sw + Math.max(dur, 0) >= winStart && sw <= winEnd) emit(e, st, sw, dur); ovList.forEach(emitStandalone); return; }
    const ex = new Set();
    e.EXDATE.forEach(x => { const t2 = icsTime(x); if (t2) ex.add(wallLike(t2, st)); });
    const ovMap = new Map();
    ovList.forEach(o => { const rt = icsTime(o['RECURRENCE-ID']); if (rt) ovMap.set(wallLike(rt, st), o); });
    ovMap.forEach((o, w) => ex.add(w)); // moved/changed occurrences replace the original
    rruleWalls(sw, e.RRULE.v, winStart - Math.max(dur, 0), winEnd, ex).forEach(w => emit(e, st, w, dur));
    ovMap.forEach(o => emitStandalone(o));
  });
  overrides.forEach(list => list.forEach(emitStandalone)); // overrides whose series wasn't in the feed
  return out;
}

const api = {
  DAY_MS, pad, ymd, parse, addDays, today, daysBetween,
  occursOn, toRRule,
  icsParse, icsTime, icsDuration, tzOffset, wallToInstant, rruleWalls, icsToEvents,
};
if (typeof module === 'object' && module.exports) module.exports = api;
else root.CalendoraCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
