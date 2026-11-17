/* Calendora — family wall calendar
 * Vanilla JS, no build step. Data lives in localStorage; photos in IndexedDB.
 */
'use strict';
(() => {
  // ---------------------------------------------------------------- constants
  const STORE_KEY = 'calendora.v1';
  const COLORS = ['#F26B4F', '#F2A541', '#E3B505', '#5BBF8A', '#2BB3A3', '#3FA7D6', '#5C7CFA', '#9B6BDF', '#E56BB0', '#8D6E63'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map(m => m.slice(0, 3));
  const MEAL_TYPES = [['breakfast', 'Breakfast', '🥞'], ['lunch', 'Lunch', '🥪'], ['dinner', 'Dinner', '🍝'], ['snack', 'Snack', '🍎']];
  const TIMES_OF_DAY = [['morning', 'Morning', '🌅'], ['afternoon', 'Afternoon', '☀️'], ['evening', 'Evening', '🌙'], ['anytime', 'Anytime', '✨']];
  const REPEAT_OPTS = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday (Mon–Fri)'], ['weekly', 'Weekly on…'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
  const CHORE_EMOJI = ['🛏️', '🪥', '🎒', '🧸', '🐱', '🐕', '🪴', '🍽️', '🗑️', '🧺', '📚', '🎹', '🧹', '🚿', '👕', '🥗', '🚗', '💪'];
  const REWARD_EMOJI = ['🎬', '🍦', '📱', '🌙', '📖', '🎡', '🍕', '🎮', '🛝', '🎨', '🧁', '⚽'];
  const LIST_EMOJI = ['🛒', '✅', '🧳', '🎁', '🏠', '📦', '🎉', '💊', '📝', '🐾'];
  const SCENES = [
    'radial-gradient(120% 90% at 20% 15%, #FFD3A5 0%, transparent 55%), radial-gradient(90% 80% at 85% 80%, #FD6585 0%, transparent 60%), linear-gradient(135deg, #2E1F47, #5B2A6E)',
    'radial-gradient(100% 80% at 80% 10%, #A8E6CF 0%, transparent 55%), radial-gradient(90% 90% at 10% 90%, #3D84A8 0%, transparent 60%), linear-gradient(160deg, #0F2F3D, #1F5C5A)',
    'radial-gradient(110% 80% at 15% 85%, #F9D976 0%, transparent 55%), radial-gradient(80% 70% at 85% 20%, #F39F86 0%, transparent 60%), linear-gradient(200deg, #3A1C32, #8C3B4A)',
    'radial-gradient(120% 80% at 50% 0%, #C3E8FF 0%, transparent 55%), radial-gradient(90% 70% at 20% 100%, #6A82FB 0%, transparent 60%), linear-gradient(180deg, #1A2A6C, #2D3A8C)',
    'radial-gradient(100% 90% at 90% 90%, #FFE29F 0%, transparent 55%), radial-gradient(90% 70% at 10% 10%, #7FD1AE 0%, transparent 60%), linear-gradient(120deg, #234E3A, #4F7A3A)',
  ];

  const ICONS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chores: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
    rewards: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    lists: '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2"/>',
    meals: '<path d="M7 3v7.5M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 10.5V21M17 21V3c-2.5 1.2-3.5 4-3.5 7.5V13H17"/>',
    photos: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 15.5l-4.5-4.5L7 20"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    repeat: '<path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2"/><path d="M18 4v5h-5M6 20v-5h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------------------------------------------------------------- helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const todayStr = () => ymd(today());
  const toMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);

  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (x.getDay() - state.settings.weekStart + 7) % 7;
    return addDays(x, -diff);
  }
  const weekOrder = () => [0, 1, 2, 3, 4, 5, 6].map(i => (i + state.settings.weekStart) % 7);

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (state.settings.use24h) return `${pad(h)}:${pad(m)}`;
    const ap = h < 12 ? 'am' : 'pm';
    const hh = h % 12 || 12;
    return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`;
  }
  function fmtHourLabel(h) {
    if (state.settings.use24h) return `${pad(h)}:00`;
    return `${h % 12 || 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
  }
  const initials = name => (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const memberById = id => state.members.find(m => m.id === id);
  function avatar(m, size = '') {
    if (!m) return `<span class="avatar ${size}" style="--c:#A9A4B5">★</span>`;
    return `<span class="avatar ${size}" style="--c:${m.color}">${m.emoji ? esc(m.emoji) : esc(initials(m.name))}</span>`;
  }

  // ---------------------------------------------------------------- state
  function defaults() {
    return {
      version: 1,
      members: [], events: [], chores: [], choreDone: {}, lists: [], meals: {}, rewards: [], redemptions: [], icalFeeds: [], recipes: [],
      hidden: [], gEvents: [], gSyncedAt: null,
      settings: {
        weekStart: 0, use24h: false, screensaverMin: 10, dayStart: 7, dayEnd: 21, weather: null, tempUnit: 'fahrenheit', showMeals: true,
        google: { clientId: '', connected: false, email: '', calendars: {}, defaultCal: '' },
      },
      ui: { view: 'calendar', calView: 'week', listId: null, mealsTab: 'plan' },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        return mergeState(JSON.parse(raw));
      }
    } catch (e) { console.warn('Calendora: could not read saved data', e); }
    return seed(defaults());
  }

  function mergeState(s) {
    const d = defaults();
    const st = { ...(s.settings || {}) };
    return {
      ...d, ...s,
      settings: { ...d.settings, ...st, google: { ...d.settings.google, ...(st.google || {}) } },
      ui: { ...d.ui, ...(s.ui || {}) },
    };
  }

  let saveTimer;
  function save(opts = {}) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { toast('Could not save — browser storage is full'); }
    }, 120);
    if (!opts.localOnly) cloudQueuePush();
  }

  function seed(s) {
    const t = today();
    const D = n => ymd(addDays(t, n));
    const sun = addDays(t, -t.getDay());
    const W = n => ymd(addDays(sun, n));
    s.members = [
      { id: 'm1', name: 'Mom', color: '#F26B4F' },
      { id: 'm2', name: 'Dad', color: '#3FA7D6' },
      { id: 'm3', name: 'Emma', color: '#9B6BDF' },
      { id: 'm4', name: 'Leo', color: '#5BBF8A' },
    ];
    s.events = [
      { title: 'School drop-off', date: W(1), startTime: '07:45', endTime: '08:15', recur: 'weekdays', memberIds: ['m2'] },
      { title: 'Yoga class', date: W(1), startTime: '06:30', endTime: '07:30', recur: 'weekly', recurDays: [1, 3, 5], memberIds: ['m1'] },
      { title: 'Soccer practice', date: W(2), startTime: '16:30', endTime: '18:00', recur: 'weekly', recurDays: [2, 4], memberIds: ['m4'], location: 'Riverside Park' },
      { title: 'Piano lesson', date: W(3), startTime: '15:30', endTime: '16:15', recur: 'weekly', recurDays: [3], memberIds: ['m3'] },
      { title: 'Trash & recycling', date: W(3), allDay: true, recur: 'weekly', recurDays: [3], memberIds: ['m2'] },
      { title: 'Dentist', date: D(2), startTime: '10:00', endTime: '11:00', memberIds: ['m3', 'm1'], location: 'Bright Smiles Dental' },
      { title: 'Parent–teacher conference', date: D(4), startTime: '17:30', endTime: '18:15', memberIds: ['m1', 'm2'] },
      { title: 'Family movie night 🍿', date: W(5), startTime: '19:00', endTime: '21:00', recur: 'weekly', recurDays: [5], memberIds: [] },
      { title: 'Swim class', date: W(6), startTime: '09:30', endTime: '10:30', recur: 'weekly', recurDays: [6], memberIds: ['m3', 'm4'] },
      { title: 'Farmers market', date: W(6), startTime: '11:00', endTime: '12:30', recur: 'weekly', recurDays: [6], memberIds: [] },
      { title: 'Grandma visiting', date: D(6), endDate: D(8), allDay: true, memberIds: [] },
      { title: 'Leo’s birthday 🎂', date: D(11), allDay: true, recur: 'yearly', memberIds: ['m4'] },
      { title: 'Book club', date: D(-3), startTime: '19:30', endTime: '21:00', recur: 'monthly', memberIds: ['m1'] },
      { title: 'Team lunch', date: D(1), startTime: '12:00', endTime: '13:00', memberIds: ['m2'], location: 'Downtown' },
    ].map(e => ({ id: uid(), endDate: null, allDay: false, startTime: '', endTime: '', recur: 'none', recurDays: [], until: null, notes: '', location: '', exdates: [], ...e }));

    s.chores = [
      { title: 'Make bed', emoji: '🛏️', memberId: 'm3', time: 'morning', stars: 1, repeat: 'daily' },
      { title: 'Brush teeth', emoji: '🪥', memberId: 'm3', time: 'morning', stars: 1, repeat: 'daily' },
      { title: 'Practice piano', emoji: '🎹', memberId: 'm3', time: 'afternoon', stars: 2, repeat: 'daily' },
      { title: 'Pack backpack', emoji: '🎒', memberId: 'm3', time: 'evening', stars: 1, repeat: 'weekly', days: [0, 1, 2, 3, 4] },
      { title: 'Feed the cat', emoji: '🐱', memberId: 'm4', time: 'morning', stars: 1, repeat: 'daily' },
      { title: 'Make bed', emoji: '🛏️', memberId: 'm4', time: 'morning', stars: 1, repeat: 'daily' },
      { title: 'Read 20 minutes', emoji: '📚', memberId: 'm4', time: 'anytime', stars: 2, repeat: 'daily' },
      { title: 'Tidy toys', emoji: '🧸', memberId: 'm4', time: 'evening', stars: 2, repeat: 'daily' },
      { title: 'Water plants', emoji: '🪴', memberId: 'm1', time: 'anytime', stars: 1, repeat: 'weekly', days: [1, 4] },
      { title: 'Meal prep', emoji: '🥗', memberId: 'm1', time: 'afternoon', stars: 2, repeat: 'weekly', days: [0] },
      { title: 'Laundry', emoji: '🧺', memberId: 'm1', time: 'anytime', stars: 2, repeat: 'weekly', days: [2, 6] },
      { title: 'Unload dishwasher', emoji: '🍽️', memberId: 'm2', time: 'morning', stars: 1, repeat: 'daily' },
      { title: 'Walk the dog', emoji: '🐕', memberId: 'm2', time: 'evening', stars: 1, repeat: 'daily' },
      { title: 'Take out trash', emoji: '🗑️', memberId: 'm2', time: 'evening', stars: 1, repeat: 'weekly', days: [2] },
    ].map(c => ({ id: uid(), days: [], date: null, ...c }));

    // some history so the stars & rewards have something to show
    for (let i = -6; i <= 0; i++) {
      const ds = D(i);
      const dd = parse(ds);
      s.choreDone[ds] = {};
      s.chores.forEach((c, idx) => {
        if (!choreOnRaw(c, ds, dd)) return;
        if (i < 0 ? (idx + i) % 4 !== 0 : idx % 3 === 0) s.choreDone[ds][c.id] = { m: c.memberId, s: c.stars };
      });
    }

    s.lists = [
      { id: uid(), name: 'Groceries', emoji: '🛒', items: ['Milk', 'Eggs', 'Bananas', 'Sourdough bread', 'Chicken thighs', 'Baby spinach', 'Cheddar', 'Coffee beans', 'Taco shells'] },
      { id: uid(), name: 'To-Do', emoji: '✅', items: ['Schedule car service', 'Return library books', 'Buy a birthday gift for Leo', 'Call the plumber'] },
      { id: uid(), name: 'Weekend packing', emoji: '🧳', items: ['Swimsuits', 'Sunscreen', 'Chargers', 'Snacks for the car'] },
    ].map(l => ({ ...l, items: l.items.map((text, i) => ({ id: uid(), text, done: i === 1 })) }));

    const dinners = ['Roast chicken', 'Spaghetti & meatballs', 'Tacos', 'Veggie stir-fry', 'Grilled salmon', 'Homemade pizza', 'Breakfast for dinner'];
    for (let i = 0; i < 7; i++) {
      const m = { dinner: dinners[i] };
      if (i === 0 || i === 6) m.breakfast = 'Pancakes';
      if (i >= 1 && i <= 5) m.lunch = i % 2 ? 'Turkey wraps' : 'Leftovers';
      if (i === 3) m.snack = 'Apple slices & PB';
      s.meals[W(i)] = m;
    }

    s.recipes = [{
      id: 'r_tacos', title: 'Weeknight beef tacos', url: '', imageId: null, imageUrl: '', servings: '4', time: '25 min',
      ingredients: ['1 lb ground beef', '1 small onion, diced', '2 tsp chili powder', '1 tsp cumin', '½ tsp garlic powder', 'Salt to taste', '8 taco shells', 'Shredded lettuce, cheese, salsa and sour cream for topping'],
      steps: ['Brown the beef with the onion in a large pan over medium-high heat, about 8 minutes.', 'Drain any fat, then stir in the spices, a pinch of salt and ¼ cup water.', 'Simmer until thick, 3–4 minutes.', 'Warm the taco shells in the oven while the filling simmers.', 'Fill the shells and let everyone add their own toppings.'],
      notes: 'Our Tuesday favourite. Kids like it with extra cheese.',
    }];
    s.meals[W(2)] = { ...(s.meals[W(2)] || {}), dinner: { name: 'Tacos', recipeId: 'r_tacos' } };
    s.rewards = [
      { title: 'Pick the movie', emoji: '🎬', cost: 5 },
      { title: '30 min screen time', emoji: '📱', cost: 8 },
      { title: 'Ice cream trip', emoji: '🍦', cost: 10 },
      { title: 'Stay up 30 min late', emoji: '🌙', cost: 12 },
      { title: 'Choose a new book', emoji: '📖', cost: 20 },
      { title: 'Day trip of your choice', emoji: '🎡', cost: 50 },
    ].map(r => ({ id: uid(), ...r }));
    return s;
  }

  let state = load();
  const ui = {
    cursor: today(),       // calendar focus date
    choreDate: today(),
    mealWeek: today(),
    weather: null,
  };

  // ---------------------------------------------------------------- recurrence
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
  function isVisible(ev) {
    if (!ev.memberIds || !ev.memberIds.length) return true;
    return ev.memberIds.some(id => !state.hidden.includes(id) && memberById(id)) || ev.memberIds.every(id => !memberById(id));
  }
  let dayCache = new Map();
  function eventsOn(ds) {
    if (dayCache.has(ds)) return dayCache.get(ds);
    const dd = parse(ds);
    const list = allEvents().filter(e => isVisible(e) && occursOn(e, ds, dd))
      .sort((a, b) => (b.allDay - a.allDay) || toMin(a.startTime) - toMin(b.startTime) || a.title.localeCompare(b.title));
    dayCache.set(ds, list);
    return list;
  }
  const evColor = ev => {
    const m = (ev.memberIds || []).map(memberById).find(Boolean);
    if (m) return m.color;
    if (ev.source === 'apple') { const f = icalFeed(ev.feed); return f && f.color ? f.color : '#8E8AA0'; }
    const c = ev.gcal && state.settings.google.calendars[ev.gcal];
    return c && c.color ? c.color : '#8E8AA0';
  };
  const evDots = ev => (ev.memberIds || []).map(memberById).filter(Boolean).map(m => `<i style="--c:${m.color}" title="${esc(m.name)}"></i>`).join('');
  function isPast(ev, ds) {
    const t = todayStr();
    if (ds < t) return true;
    if (ds > t || ev.allDay) return false;
    const n = new Date();
    return toMin(ev.endTime || ev.startTime) < n.getHours() * 60 + n.getMinutes();
  }
  function timeRange(ev) {
    if (ev.allDay) return 'All day';
    return ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : fmtTime(ev.startTime);
  }

  // ---------------------------------------------------------------- chores & stars
  function choreOnRaw(c, ds, dd) {
    if (c.repeat === 'once') return c.date === ds;
    if (c.repeat === 'weekly') return (c.days || []).includes(dd.getDay());
    return true; // daily
  }
  const choreOn = (c, ds) => choreOnRaw(c, ds, parse(ds));
  function earned(mid) {
    let n = 0;
    for (const day of Object.values(state.choreDone)) for (const v of Object.values(day)) if (v && v.m === mid) n += v.s || 0;
    return n;
  }
  const spent = mid => state.redemptions.filter(r => r.memberId === mid).reduce((a, r) => a + r.cost, 0);
  const balance = mid => earned(mid) - spent(mid);

  // ---------------------------------------------------------------- photos (IndexedDB)
  const photoDB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('calendora', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction('photos', mode);
        const req = fn(t.objectStore('photos'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    },
    all() { return this.tx('readonly', s => s.getAll()); },
    put(p) { return this.tx('readwrite', s => s.put(p)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); },
  };
  const photoUrls = new Map();
  async function getPhotos() {
    try {
      const list = await photoDB.all();
      list.sort((a, b) => a.added - b.added);
      return list.map(p => {
        if (!photoUrls.has(p.id)) photoUrls.set(p.id, URL.createObjectURL(p.blob));
        return { id: p.id, url: photoUrls.get(p.id) };
      });
    } catch (e) { return []; }
  }
  async function resizeImage(file, max = 1920, quality = 0.86) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/jpeg', quality));
  }

  // ---------------------------------------------------------------- Google Calendar sync
  // Runs fully in the browser: Google Identity Services gives a short-lived access token,
  // and the Calendar REST API is called with fetch. No server, no refresh tokens.
  const GOOGLE_CLIENT_ID = '639692840591-5n38eqpu4b4ldic333i7668ijuceb1iv.apps.googleusercontent.com';
  const G_SCOPE = 'https://www.googleapis.com/auth/calendar';
  const G_API = 'https://www.googleapis.com/calendar/v3';
  const G_TOKEN_KEY = 'calendora.gtoken';
  const g = { tokenClient: null, tokenClientId: '', token: null, exp: 0, loading: null, syncing: false, error: '', pending: null };
  try { const t = JSON.parse(localStorage.getItem(G_TOKEN_KEY) || 'null'); if (t && t.exp > Date.now() + 60000) { g.token = t.t; g.exp = t.exp; } } catch (e) { /* ignore */ }
  const gCfg = () => state.settings.google;
  const gClientId = () => (gCfg().clientId || GOOGLE_CLIENT_ID || '').trim();
  const gHasToken = () => !!g.token && g.exp > Date.now() + 30000;
  const gWritable = c => c && (c.role === 'owner' || c.role === 'writer');
  const enc = encodeURIComponent;

  function gLoadScript() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (g.loading) return g.loading;
    g.loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res();
      s.onerror = () => { g.loading = null; rej(new Error('Could not load Google sign-in')); };
      document.head.appendChild(s);
    });
    return g.loading;
  }
  async function gInitClient() {
    await gLoadScript();
    if (g.tokenClient && g.tokenClientId === gClientId()) return;
    g.tokenClientId = gClientId();
    g.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: gClientId(),
      scope: G_SCOPE,
      callback: resp => {
        const p = g.pending; g.pending = null;
        if (resp.error) { if (p) p.rej(new Error(resp.error_description || resp.error)); return; }
        g.token = resp.access_token;
        g.exp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        try { localStorage.setItem(G_TOKEN_KEY, JSON.stringify({ t: g.token, exp: g.exp })); } catch (e) { /* ignore */ }
        if (p) p.res(g.token);
      },
      error_callback: err => {
        const p = g.pending; g.pending = null;
        const msg = err && err.type === 'popup_closed' ? 'Google sign-in was closed' : err && err.type === 'popup_failed_to_open' ? 'Allow pop-ups for this site to sign in with Google' : 'Google sign-in failed';
        if (p) p.rej(new Error(msg));
      },
    });
  }
  // Call from a click so the browser allows the Google pop-up.
  async function gRequestToken() {
    if (!gClientId()) throw new Error('Add your Google Client ID first');
    await gInitClient();
    return new Promise((res, rej) => {
      g.pending = { res, rej };
      g.tokenClient.requestAccessToken({ prompt: gCfg().connected ? '' : 'consent', login_hint: gCfg().email || undefined });
    });
  }
  async function gFetch(path, opts = {}) {
    if (!gHasToken()) throw Object.assign(new Error('Google needs you to reconnect'), { auth: true });
    const headers = { Authorization: `Bearer ${g.token}` };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(G_API + path, { ...opts, headers });
    if (r.status === 401) {
      g.token = null; localStorage.removeItem(G_TOKEN_KEY); renderSyncPill();
      throw Object.assign(new Error('Google needs you to reconnect'), { auth: true });
    }
    if (r.status === 204 || r.status === 410) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || `Google error ${r.status}`);
    return j;
  }
  const htmlToText = s => (s ? (new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n'), 'text/html').body.textContent || '') : '');

  function gToLocal(ev, calId) {
    if (!ev || ev.status === 'cancelled' || !ev.start) return null;
    const c = gCfg().calendars[calId] || {};
    const base = {
      id: `g_${calId}_${ev.id}`, source: 'google', gcal: calId, gid: ev.id, gseries: ev.recurringEventId || null,
      title: ev.summary || '(No title)', location: ev.location || '', notes: htmlToText(ev.description),
      recur: 'none', recurDays: [], exdates: [], until: null,
      memberIds: c.memberId ? [c.memberId] : [], readOnly: !gWritable(c) || !!ev.locked,
    };
    if (ev.start.date) {
      const end = ev.end && ev.end.date ? ymd(addDays(parse(ev.end.date), -1)) : ev.start.date;
      return { ...base, allDay: true, date: ev.start.date, endDate: end > ev.start.date ? end : null, startTime: '', endTime: '' };
    }
    const s = new Date(ev.start.dateTime), e = new Date((ev.end && ev.end.dateTime) || ev.start.dateTime);
    const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { ...base, allDay: false, date: ymd(s), endDate: null, startTime: hm(s), endTime: ymd(s) === ymd(e) ? hm(e) : '23:59' };
  }
  function localToG(e) {
    const r = { summary: e.title, location: e.location || '', description: e.notes || '' };
    if (e.allDay) {
      r.start = { date: e.date };
      r.end = { date: ymd(addDays(parse(e.endDate || e.date), 1)) };
    } else {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      r.start = { dateTime: `${e.date}T${e.startTime}:00`, timeZone: tz };
      r.end = { dateTime: `${e.date}T${e.endTime}:00`, timeZone: tz };
    }
    return r;
  }
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
  function gRemap() {
    const cals = gCfg().calendars;
    state.gEvents.forEach(e => { const c = cals[e.gcal]; e.memberIds = c && c.memberId ? [c.memberId] : []; e.readOnly = !gWritable(c); });
  }
  function gVisible() {
    const cals = gCfg().calendars;
    return state.gEvents.filter(e => { const c = cals[e.gcal]; return !c || c.on !== false; });
  }
  const allEvents = () => {
    const ge = state.gEvents && state.gEvents.length ? gVisible() : [];
    return ge.length || ical.flat.length ? state.events.concat(ge, ical.flat) : state.events;
  };

  async function gSync({ quiet = false } = {}) {
    if (g.syncing || !gCfg().connected) return;
    if (!gHasToken()) { renderSyncPill(); return; }
    g.syncing = true; g.error = ''; renderSyncPill();
    try {
      const list = await gFetch('/users/me/calendarList?maxResults=250');
      const prevCals = gCfg().calendars, cals = {};
      (list.items || []).forEach(c => {
        if (c.primary) gCfg().email = c.id;
        const prev = prevCals[c.id];
        cals[c.id] = {
          name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || '#8E8AA0', role: c.accessRole, primary: !!c.primary,
          on: prev ? prev.on : !c.hidden && c.selected !== false, memberId: prev ? prev.memberId : '',
        };
      });
      gCfg().calendars = cals;
      const tMin = addDays(today(), -62).toISOString(), tMax = addDays(today(), 400).toISOString();
      const out = [];
      for (const [id, c] of Object.entries(cals)) {
        if (!c.on) continue;
        let pageToken = '';
        do {
          const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeMin: tMin, timeMax: tMax });
          if (pageToken) q.set('pageToken', pageToken);
          const j = await gFetch(`/calendars/${enc(id)}/events?${q}`);
          (j.items || []).forEach(ev => { const m = gToLocal(ev, id); if (m) out.push(m); });
          pageToken = j.nextPageToken || '';
        } while (pageToken);
      }
      state.gEvents = out;
      state.gSyncedAt = Date.now();
      save();
      renderView();
      if (!quiet) toast(`Synced ${out.length} Google event${out.length === 1 ? '' : 's'}`);
    } catch (e) {
      g.error = e.message;
      if (!quiet) toast(e.message);
    } finally {
      g.syncing = false;
      renderSyncPill();
    }
  }
  async function gEnsureToken() { if (!gHasToken()) await gRequestToken(); }
  async function gCreate(e, calId) {
    await gEnsureToken();
    const body = localToG(e);
    const rr = toRRule(e);
    if (rr) body.recurrence = rr;
    const j = await gFetch(`/calendars/${enc(calId)}/events`, { method: 'POST', body: JSON.stringify(body) });
    if (rr) await gSync({ quiet: true });
    else { const m = gToLocal(j, calId); if (m) state.gEvents.push(m); save(); renderView(); }
  }
  async function gUpdate(e) {
    await gEnsureToken();
    const j = await gFetch(`/calendars/${enc(e.gcal)}/events/${enc(e.gid)}`, { method: 'PATCH', body: JSON.stringify(localToG(e)) });
    const m = gToLocal(j, e.gcal);
    state.gEvents = state.gEvents.map(x => (x.id === e.id ? m : x)).filter(Boolean);
    save(); renderView();
  }
  async function gDelete(e, series) {
    await gEnsureToken();
    const target = series && e.gseries ? e.gseries : e.gid;
    await gFetch(`/calendars/${enc(e.gcal)}/events/${enc(target)}`, { method: 'DELETE' });
    state.gEvents = state.gEvents.filter(x => !(x.gcal === e.gcal && (series && e.gseries ? x.gseries === e.gseries || x.gid === e.gseries : x.id === e.id)));
    save(); renderView();
  }
  async function gConnect() {
    const inp = $('[data-g-client]');
    if (inp) gCfg().clientId = inp.value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(gClientId())) { toast('That doesn’t look like a Google Client ID'); return; }
    save();
    try {
      await gRequestToken();
      gCfg().connected = true;
      save();
      await gSync();
      render();
    } catch (e) { toast(e.message); }
  }
  async function gReconnect() {
    try { await gRequestToken(); renderSyncPill(); await gSync({ quiet: true }); toast('Google reconnected'); }
    catch (e) { toast(e.message); }
  }
  function gDisconnect() {
    try { if (g.token && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(g.token, () => {}); } catch (e) { /* ignore */ }
    g.token = null; g.exp = 0; localStorage.removeItem(G_TOKEN_KEY);
    Object.assign(gCfg(), { connected: false, email: '', calendars: {}, defaultCal: '' });
    state.gEvents = []; state.gSyncedAt = null;
    save(); render(); toast('Google Calendar disconnected');
  }
  function gDefaultCalFor(memberIds) {
    const cals = gCfg().calendars;
    if (memberIds.length === 1) {
      const hit = Object.entries(cals).find(([, c]) => c.memberId === memberIds[0] && c.on && gWritable(c));
      if (hit) return hit[0];
    }
    const d = gCfg().defaultCal;
    return d && gWritable(cals[d]) ? d : 'local';
  }
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  }
  function renderSyncPill() {
    const el = $('#syncPill');
    if (!el) return;
    if (!gCfg().connected) { el.hidden = true; return; }
    el.hidden = false;
    if (g.syncing) { el.className = 'sync-pill busy'; el.innerHTML = '<span class="gmark">G</span> Syncing…'; el.dataset.action = 'noop'; return; }
    if (!gHasToken()) { el.className = 'sync-pill warn'; el.innerHTML = '<span class="gmark">G</span> Reconnect Google'; el.dataset.action = 'g-reconnect'; return; }
    el.className = `sync-pill ${g.error ? 'warn' : 'ok'}`;
    el.innerHTML = `<span class="gmark">G</span> ${g.error ? 'Sync problem — retry' : state.gSyncedAt ? `Synced ${timeAgo(state.gSyncedAt)}` : 'Sync now'}`;
    el.dataset.action = 'g-sync';
    el.title = g.error || 'Sync with Google Calendar now';
  }

  // ---------------------------------------------------------------- render: shell
  const NAV = [
    ['calendar', 'Calendar'], ['chores', 'Chores'], ['rewards', 'Rewards'],
    ['lists', 'Lists'], ['meals', 'Meals'], ['photos', 'Photos'],
  ];
  function renderSidebar() {
    $('#sidebar').innerHTML = `
      <div class="logo" title="Calendora"><span></span></div>
      ${NAV.map(([v, label]) => `<button class="nav-btn ${state.ui.view === v ? 'active' : ''}" data-action="view" data-v="${v}">${icon(v)}<span>${label}</span></button>`).join('')}
      <div class="nav-spacer"></div>
      <button class="nav-btn" data-action="sleep" title="Start the photo frame now">${icon('sleep')}<span>Frame</span></button>
      <button class="nav-btn" data-action="fullscreen" title="Full screen">${icon('expand')}<span>Full</span></button>
      <button class="nav-btn ${state.ui.view === 'settings' ? 'active' : ''}" data-action="view" data-v="settings">${icon('settings')}<span>Settings</span></button>`;
  }

  function renderClock() {
    const n = new Date();
    let h = n.getHours(); const m = n.getMinutes();
    let txt;
    if (state.settings.use24h) txt = `${pad(h)}:${pad(m)}`;
    else txt = `${h % 12 || 12}:${pad(m)}<small>${h < 12 ? 'AM' : 'PM'}</small>`;
    $('#clockTime').innerHTML = txt;
    $('#clockDate').textContent = `${DOW_LONG[n.getDay()]}, ${MONTHS[n.getMonth()]} ${n.getDate()}`;
  }

  function renderMemberFilter() {
    const el = $('#memberFilter');
    if (state.ui.view !== 'calendar') { el.innerHTML = ''; return; }
    el.innerHTML = state.members.map(m => `
      <button class="mf-btn ${state.hidden.includes(m.id) ? 'off' : ''}" data-action="toggle-member" data-id="${m.id}" title="Show / hide ${esc(m.name)}">
        ${avatar(m)}<span>${esc(m.name)}</span>
      </button>`).join('');
  }

  function wIcon(code, day = 1) {
    if (code === 0) return day ? '☀️' : '🌙';
    if (code <= 2) return day ? '⛅' : '☁️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 57) return '🌦️';
    if (code >= 61 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code === 85 || code === 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  }
  function dailyWeather(ds) {
    const w = ui.weather;
    if (!w || !w.daily) return null;
    const i = w.daily.time.indexOf(ds);
    if (i < 0) return null;
    return { icon: wIcon(w.daily.weather_code[i]), hi: Math.round(w.daily.temperature_2m_max[i]), lo: Math.round(w.daily.temperature_2m_min[i]) };
  }
  function renderWeather() {
    const el = $('#weather');
    const w = ui.weather;
    if (!w || !w.current) { el.hidden = true; return; }
    const d = dailyWeather(todayStr());
    el.hidden = false;
    el.innerHTML = `<span class="wx-icon">${wIcon(w.current.weather_code, w.current.is_day)}</span>
      <span class="wx-temp">${Math.round(w.current.temperature_2m)}°</span>
      ${d ? `<span class="wx-hilo">H ${d.hi}° · L ${d.lo}°</span>` : ''}`;
    el.title = state.settings.weather ? state.settings.weather.name : '';
  }
  async function fetchWeather() {
    const loc = state.settings.weather;
    if (!loc) { ui.weather = null; renderWeather(); return; }
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=14&timezone=auto&temperature_unit=${state.settings.tempUnit}`;
      const r = await fetch(u);
      if (!r.ok) throw new Error(r.status);
      ui.weather = await r.json();
      renderWeather();
      if (state.ui.view === 'calendar' && state.ui.calView === 'week') renderView();
    } catch (e) { console.warn('Weather unavailable', e); }
  }

  function render() {
    dayCache = new Map();
    renderSidebar();
    renderClock();
    renderMemberFilter();
    renderWeather();
    renderSyncPill();
    renderView();
  }
  function renderView() {
    dayCache = new Map();
    const fn = { calendar: renderCalendar, chores: renderChores, rewards: renderRewards, lists: renderLists, meals: renderMeals, photos: renderPhotos, settings: renderSettings }[state.ui.view] || renderCalendar;
    $('#view').className = `view view-${state.ui.view}`;
    fn();
    $('#fab').hidden = state.ui.view === 'settings';
  }

  // ---------------------------------------------------------------- calendar
  function calTitle() {
    const c = ui.cursor;
    switch (state.ui.calView) {
      case 'month': return `${MONTHS[c.getMonth()]} <span class="muted">${c.getFullYear()}</span>`;
      case 'week': {
        const s = startOfWeek(c), e = addDays(s, 6);
        if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()} <span class="muted">${e.getFullYear()}</span>`;
        return `${MON[s.getMonth()]} ${s.getDate()} – ${MON[e.getMonth()]} ${e.getDate()} <span class="muted">${e.getFullYear()}</span>`;
      }
      case 'day': return `${DOW_LONG[c.getDay()]}, ${MONTHS[c.getMonth()]} ${c.getDate()}`;
      default: return `Upcoming <span class="muted">from ${MON[c.getMonth()]} ${c.getDate()}</span>`;
    }
  }
  function renderCalendar() {
    const v = state.ui.calView;
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous">${icon('left')}</button>
        <button class="btn" data-action="today">Today</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next">${icon('right')}</button>
      </div>
      <h1>${calTitle()}</h1>
      <div class="seg" role="tablist">
        ${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['schedule', 'Schedule']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-action="calview" data-v="${k}">${l}</button>`).join('')}
      </div>`;
    ({ month: renderMonth, week: renderWeek, day: renderDay, schedule: renderSchedule })[v]();
  }

  function chip(e, ds) {
    const c = evColor(e);
    const past = isPast(e, ds) ? 'past' : '';
    if (e.allDay) return `<div class="chip allday ${past}" style="--c:${c}" data-action="edit-event" data-id="${e.id}" data-date="${ds}">${esc(e.title)}</div>`;
    return `<div class="chip ${past}" style="--c:${c}" data-action="edit-event" data-id="${e.id}" data-date="${ds}"><i></i><b>${fmtTime(e.startTime)}</b><span>${esc(e.title)}</span></div>`;
  }

  function renderMonth() {
    const cur = ui.cursor;
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const gs = startOfWeek(first);
    const dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const lead = daysBetween(gs, first);
    const rows = Math.ceil((lead + dim) / 7);
    const max = rows > 5 ? 3 : 4;
    const t = todayStr();
    let cells = '';
    for (let i = 0; i < rows * 7; i++) {
      const d = addDays(gs, i), ds = ymd(d), evs = eventsOn(ds);
      cells += `<div class="mcell ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${ds === t ? 'today' : ''}" data-action="goto-day" data-date="${ds}">
        <div class="mnum">${d.getDate()}</div>
        <div class="mevents">${evs.slice(0, max).map(e => chip(e, ds)).join('')}${evs.length > max ? `<div class="more">+${evs.length - max} more</div>` : ''}</div>
      </div>`;
    }
    $('#view').innerHTML = `<div class="month card">
      <div class="month-head">${weekOrder().map(i => `<div>${DOW[i]}</div>`).join('')}</div>
      <div class="month-grid" style="--rows:${rows}">${cells}</div></div>`;
  }

  function evCard(e, ds) {
    const c = evColor(e);
    return `<div class="evcard ${e.allDay ? 'allday' : ''} ${isPast(e, ds) ? 'past' : ''}" style="--c:${c}" data-action="edit-event" data-id="${e.id}" data-date="${ds}">
      <div class="evtitle">${esc(e.title)}</div>
      <div class="evmeta">${timeRange(e)}${e.recur && e.recur !== 'none' ? ` ${icon('repeat', 'tiny')}` : ''}</div>
      ${e.memberIds && e.memberIds.length > 1 ? `<div class="evdots">${evDots(e)}</div>` : ''}
    </div>`;
  }

  function renderWeek() {
    const ws = startOfWeek(ui.cursor), t = todayStr();
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), ds = ymd(d), evs = eventsOn(ds);
      const wx = dailyWeather(ds);
      const mv = state.settings.showMeals && state.meals[ds] && state.meals[ds].dinner;
      const meal = mealName(mv), mrec = recipeById(mealRecipeId(mv));
      cols += `<div class="wcol ${ds === t ? 'today' : ''} ${ds < t ? 'pastday' : ''}">
        <div class="whead" data-action="goto-day" data-date="${ds}">
          <span class="wdow">${DOW[d.getDay()]}</span><span class="wnum">${d.getDate()}</span>
          ${wx ? `<span class="wwx">${wx.icon} ${wx.hi}°</span>` : ''}
        </div>
        <div class="wbody" data-action="new-event" data-date="${ds}">
          ${evs.map(e => evCard(e, ds)).join('') || '<div class="wempty">Tap to add</div>'}
        </div>
        ${state.settings.showMeals ? `<div class="wmeal ${meal ? '' : 'none'}" data-action="edit-meal" data-date="${ds}" data-type="dinner"><span class="wmeal-name">🍽️ ${meal ? esc(meal) : 'Add dinner'}</span>${mrec ? `<button class="recipe-chip" data-action="open-recipe" data-id="${mrec.id}" aria-label="Open recipe">📖</button>` : ''}</div>` : ''}
      </div>`;
    }
    $('#view').innerHTML = `<div class="week">${cols}</div>`;
  }

  function layoutLanes(items) {
    const out = []; let cluster = []; let end = -1;
    const flush = () => {
      const lanes = [];
      cluster.forEach(it => {
        let l = lanes.findIndex(e => e <= it.s);
        if (l < 0) { l = lanes.length; lanes.push(it.e); } else lanes[l] = it.e;
        it.lane = l;
      });
      cluster.forEach(it => { it.lanes = lanes.length; });
      out.push(...cluster); cluster = []; end = -1;
    };
    items.sort((a, b) => a.s - b.s || b.e - a.e).forEach(it => {
      if (cluster.length && it.s >= end) flush();
      cluster.push(it); end = Math.max(end, it.e);
    });
    if (cluster.length) flush();
    return out;
  }

  const HOUR_H = 64;
  function renderDay() {
    const ds = ymd(ui.cursor), evs = eventsOn(ds);
    const visible = state.members.filter(m => !state.hidden.includes(m.id));
    const hasFamily = evs.some(e => !e.memberIds.length || e.memberIds.every(id => !memberById(id)));
    const columns = [...(hasFamily || !visible.length ? [{ id: '', name: 'Everyone', color: '#8E8AA0', family: true }] : []), ...visible];
    const inCol = (e, col) => col.family ? (!e.memberIds.length || e.memberIds.every(id => !memberById(id))) : e.memberIds.includes(col.id);

    let s = state.settings.dayStart, en = state.settings.dayEnd;
    evs.forEach(e => { if (!e.allDay) { s = Math.min(s, Math.floor(toMin(e.startTime) / 60)); en = Math.max(en, Math.ceil(toMin(e.endTime || e.startTime) / 60)); } });
    en = Math.min(24, Math.max(en, s + 1));

    const allDay = evs.filter(e => e.allDay);
    const head = columns.map(c => `<div class="dname">${c.family ? '<span class="avatar" style="--c:#A9A4B5">★</span>' : avatar(c)}<span>${esc(c.name)}</span></div>`).join('');
    const allRow = allDay.length ? `<div class="dallday" style="--cols:${columns.length}"><div class="dlabel">All day</div>${columns.map(c => `<div>${allDay.filter(e => inCol(e, c)).map(e => chip(e, ds)).join('')}</div>`).join('')}</div>` : '';

    let times = '';
    for (let h = s; h < en; h++) times += `<div class="dt">${h === s ? '' : fmtHourLabel(h)}</div>`;

    const body = columns.map(c => {
      const items = layoutLanes(evs.filter(e => !e.allDay && inCol(e, c)).map(e => {
        const st = toMin(e.startTime); let et = toMin(e.endTime || e.startTime); if (et <= st) et = st + 30;
        return { e, s: st, e2: et, e: et, ev: e };
      }));
      return `<div class="dcol" data-action="new-event-at" data-date="${ds}" data-member="${c.id}">
        ${items.map(it => {
          const top = (it.s - s * 60) / 60 * HOUR_H;
          const h = Math.max(26, (it.e - it.s) / 60 * HOUR_H - 2);
          const w = 100 / it.lanes;
          const ev = it.ev;
          return `<div class="dev ${isPast(ev, ds) ? 'past' : ''} ${h < 44 ? 'short' : ''}" style="--c:${evColor(ev)};top:${top}px;height:${h}px;left:calc(${it.lane * w}% + 3px);width:calc(${w}% - 6px)" data-action="edit-event" data-id="${ev.id}" data-date="${ds}">
            <div class="evtitle">${esc(ev.title)}</div><div class="evmeta">${timeRange(ev)}</div>
            ${ev.location && h >= 70 ? `<div class="evloc">${icon('pin', 'tiny')} ${esc(ev.location)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    $('#view').innerHTML = `<div class="day card" style="--hh:${HOUR_H}px">
      <div class="dhead" style="--cols:${columns.length}"><div></div>${head}</div>
      ${allRow}
      <div class="dscroll" id="dscroll">
        <div class="dgrid" style="--cols:${columns.length};height:${(en - s) * HOUR_H}px" data-start="${s}">
          <div class="dtimes">${times}</div>${body}
          ${ds === todayStr() ? '<div class="nowline" id="nowline"></div>' : ''}
        </div>
      </div></div>`;
    positionNowLine();
    const sc = $('#dscroll');
    const n = new Date();
    const firstTimed = evs.find(e => !e.allDay);
    const focusMin = ds === todayStr() ? n.getHours() * 60 + n.getMinutes() - 90 : (firstTimed ? toMin(firstTimed.startTime) - 30 : 8 * 60);
    sc.scrollTop = Math.max(0, (focusMin - s * 60) / 60 * HOUR_H);
  }
  function positionNowLine() {
    const nl = $('#nowline'); if (!nl) return;
    const s = Number(nl.parentElement.dataset.start);
    const n = new Date();
    const m = n.getHours() * 60 + n.getMinutes();
    nl.style.top = `${(m - s * 60) / 60 * HOUR_H}px`;
    nl.hidden = m < s * 60;
  }

  function renderSchedule() {
    const t = todayStr();
    let h = '';
    for (let i = 0; i < 28; i++) {
      const d = addDays(ui.cursor, i), ds = ymd(d), evs = eventsOn(ds);
      if (!evs.length && ds !== t) continue;
      h += `<div class="sday ${ds === t ? 'today' : ''}">
        <div class="sdate" data-action="goto-day" data-date="${ds}">
          <span class="sdow">${ds === t ? 'Today' : DOW[d.getDay()]}</span><span class="snum">${d.getDate()}</span><span class="smon">${MON[d.getMonth()]}</span>
        </div>
        <div class="slist">${evs.length ? evs.map(e => `
          <div class="srow ${isPast(e, ds) ? 'past' : ''}" style="--c:${evColor(e)}" data-action="edit-event" data-id="${e.id}" data-date="${ds}">
            <div class="stime">${e.allDay ? 'All day' : `${fmtTime(e.startTime)}${e.endTime ? `<small>${fmtTime(e.endTime)}</small>` : ''}`}</div>
            <div class="sbar"></div>
            <div class="sinfo"><div class="stitle">${esc(e.title)}</div>${e.location ? `<div class="sloc">${icon('pin', 'tiny')} ${esc(e.location)}</div>` : ''}</div>
            <div class="savatars">${(e.memberIds || []).map(memberById).filter(Boolean).map(m => avatar(m, 'sm')).join('')}</div>
          </div>`).join('') : '<div class="empty-sm">Nothing planned — enjoy the day!</div>'}
        </div></div>`;
    }
    $('#view').innerHTML = `<div class="schedule card">${h || '<div class="empty">No upcoming events.</div>'}</div>`;
  }

  // ---------------------------------------------------------------- chores
  function dateLabel(d) {
    const diff = daysBetween(today(), d);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return `${DOW_LONG[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  }
  function ring(pct, label) {
    const r = 20, c = 2 * Math.PI * r;
    return `<div class="ring"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="${r}" class="ring-bg"/><circle cx="24" cy="24" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><span>${label}</span></div>`;
  }
  function renderChores() {
    const d = ui.choreDate, ds = ymd(d);
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous day">${icon('left')}</button>
        <button class="btn" data-action="today">Today</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next day">${icon('right')}</button>
      </div>
      <h1>${dateLabel(d)}${daysBetween(today(), d) && Math.abs(daysBetween(today(), d)) <= 1 ? ` <span class="muted">${MON[d.getMonth()]} ${d.getDate()}</span>` : ''}</h1>
      <span class="spacer"></span>
      <button class="btn primary" data-action="new-chore">${icon('plus')} Add chore</button>`;
    const done = state.choreDone[ds] || {};
    if (!state.members.length) { $('#view').innerHTML = emptyMembers(); return; }
    $('#view').innerHTML = `<div class="chores">${state.members.map(m => {
      const list = state.chores.filter(c => c.memberId === m.id && choreOn(c, ds));
      const n = list.filter(c => done[c.id]).length;
      const pct = list.length ? n / list.length : 0;
      const groups = TIMES_OF_DAY.map(([k, label, ic]) => {
        const items = list.filter(c => (c.time || 'anytime') === k);
        if (!items.length) return '';
        return `<div class="ctod">${ic} ${label}</div>` + items.map(c => `
          <div class="chore ${done[c.id] ? 'done' : ''}" data-action="toggle-chore" data-id="${c.id}">
            <span class="cemoji">${esc(c.emoji || '⭐')}</span>
            <span class="ctext"><span class="ctitle">${esc(c.title)}</span><span class="cstars">${'★'.repeat(Math.min(c.stars || 0, 5))}</span></span>
            <button class="mini-btn" data-action="edit-chore" data-id="${c.id}" aria-label="Edit chore">${icon('edit')}</button>
            <span class="check"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></span>
          </div>`).join('');
      }).join('');
      return `<div class="ccol ${list.length && n === list.length ? 'alldone' : ''}" style="--c:${m.color}" data-member="${m.id}">
        <div class="chead">${avatar(m, 'lg')}
          <div class="cwho"><div class="cname">${esc(m.name)}</div><div class="cstat">⭐ ${balance(m.id)} stars</div></div>
          ${ring(pct, list.length ? `${n}/${list.length}` : '–')}
        </div>
        <div class="cbody">${groups || '<div class="empty-sm">Nothing to do today 🎉</div>'}
          <button class="add-row" data-action="new-chore" data-member="${m.id}">${icon('plus')} Add</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }
  function emptyMembers() {
    return `<div class="empty card"><p>Add your family members first.</p><button class="btn primary" data-action="new-member">${icon('plus')} Add a family member</button></div>`;
  }

  function confetti(el) {
    const colors = ['#F26B4F', '#F2A541', '#5BBF8A', '#3FA7D6', '#9B6BDF', '#E56BB0'];
    const box = document.createElement('div');
    box.className = 'confetti';
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${(Math.random() - 0.5) * 320}px`);
      p.style.setProperty('--y', `${-80 - Math.random() * 220}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.background = colors[i % colors.length];
      p.style.left = `${40 + Math.random() * 20}%`;
      p.style.animationDelay = `${Math.random() * 0.15}s`;
      box.appendChild(p);
    }
    el.appendChild(box);
    setTimeout(() => box.remove(), 1600);
  }

  // ---------------------------------------------------------------- rewards
  function renderRewards() {
    $('#toolbar').innerHTML = `<h1>Rewards</h1><span class="muted sub">Earn stars by finishing chores, then trade them in.</span><span class="spacer"></span>
      <button class="btn primary" data-action="new-reward">${icon('plus')} Add reward</button>`;
    const recent = state.redemptions.slice(-8).reverse();
    $('#view').innerHTML = `<div class="rewards">
      <div class="star-row">${state.members.map(m => `
        <div class="star-card" style="--c:${m.color}">${avatar(m, 'lg')}<div><div class="cname">${esc(m.name)}</div><div class="star-num">⭐ ${balance(m.id)}</div></div></div>`).join('')}
      </div>
      <div class="reward-grid">${state.rewards.map(r => `
        <div class="reward card">
          <button class="mini-btn corner" data-action="edit-reward" data-id="${r.id}" aria-label="Edit reward">${icon('edit')}</button>
          <div class="remoji">${esc(r.emoji || '🎁')}</div>
          <div class="rtitle">${esc(r.title)}</div>
          <div class="rcost">⭐ ${r.cost}</div>
          <button class="btn primary block" data-action="redeem" data-id="${r.id}">Redeem</button>
        </div>`).join('') || '<div class="empty-sm">No rewards yet — add one!</div>'}
      </div>
      ${recent.length ? `<div class="history card"><h3>Recently redeemed</h3>${recent.map(r => { const m = memberById(r.memberId); return `<div class="hrow">${avatar(m, 'sm')}<span><b>${esc(m ? m.name : 'Someone')}</b> redeemed ${esc(r.title)}</span><span class="muted">−${r.cost} ⭐ · ${MON[parse(r.date).getMonth()]} ${parse(r.date).getDate()}</span></div>`; }).join('')}</div>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------- lists
  function renderLists() {
    if (!state.lists.find(l => l.id === state.ui.listId)) state.ui.listId = state.lists[0] ? state.lists[0].id : null;
    const list = state.lists.find(l => l.id === state.ui.listId);
    $('#toolbar').innerHTML = `<h1>Lists</h1><span class="spacer"></span><button class="btn primary" data-action="new-list">${icon('plus')} New list</button>`;
    const side = state.lists.map(l => {
      const open = l.items.filter(i => !i.done).length;
      return `<button class="list-tab ${l.id === state.ui.listId ? 'on' : ''}" data-action="pick-list" data-id="${l.id}"><span class="lemoji">${esc(l.emoji || '📝')}</span><span class="lname">${esc(l.name)}</span><span class="lcount">${open}</span></button>`;
    }).join('');
    let main = '<div class="empty-sm">Create a list to get started.</div>';
    if (list) {
      const open = list.items.filter(i => !i.done), done = list.items.filter(i => i.done);
      const row = i => `<div class="litem ${i.done ? 'done' : ''}">
          <button class="lcheck" data-action="toggle-item" data-id="${i.id}" aria-label="Toggle"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
          <span class="ltext" data-action="edit-item" data-id="${i.id}">${esc(i.text)}</span>
          <button class="mini-btn" data-action="delete-item" data-id="${i.id}" aria-label="Remove">${icon('trash')}</button>
        </div>`;
      main = `<div class="list-head"><span class="lemoji big">${esc(list.emoji || '📝')}</span><h2>${esc(list.name)}</h2><span class="spacer"></span>
          <button class="btn" data-action="edit-list" data-id="${list.id}">${icon('edit')} Edit</button></div>
        <form class="add-item" data-form="add-item"><input name="text" placeholder="Add an item…" autocomplete="off" enterkeyhint="done" /><button class="btn primary" type="submit">Add</button></form>
        <div class="litems">${open.map(row).join('') || '<div class="empty-sm">All done! ✨</div>'}
          ${done.length ? `<div class="done-head"><span>Completed (${done.length})</span><button class="link-btn" data-action="clear-done">Clear completed</button></div>${done.map(row).join('')}` : ''}
        </div>`;
    }
    $('#view').innerHTML = `<div class="lists"><div class="list-side card">${side}</div><div class="list-main card">${main}</div></div>`;
  }

  // ---------------------------------------------------------------- recipes
  const mealName = v => (v && typeof v === 'object' ? v.name || '' : v || '');
  const mealRecipeId = v => (v && typeof v === 'object' ? v.recipeId || null : null);
  const recipeById = id => (state.recipes || []).find(r => r.id === id);
  const OPEN_RECIPE_KEY = 'calendora.openRecipe';
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const recipeImg = r => (r.imageId ? `/api/images/${encodeURIComponent(r.imageId)}` : r.imageUrl || '');

  function renderRecipeLibrary() {
    const list = (state.recipes || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    $('#view').innerHTML = `<div class="recipes">${list.length ? `<div class="recipe-grid">${list.map(r => {
      const img = recipeImg(r);
      const meta = r.url ? hostOf(r.url) : r.imageId && !(r.steps || []).length ? 'Photo' : 'Family recipe';
      return `<button class="recipe-card card" data-action="open-recipe" data-id="${r.id}">
        <span class="rc-img" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : '🍳'}</span>
        <span class="rc-title">${esc(r.title)}</span>
        <span class="rc-meta">${esc(meta)}${r.time ? ` · ${esc(r.time)}` : ''}</span>
      </button>`;
    }).join('')}</div>` : `<div class="empty card"><div style="font-size:48px">🍳</div><p>No recipes yet. Paste a link, snap a photo of a cookbook page, or type one in.</p>
      <button class="btn primary" data-action="new-recipe">${icon('plus')} Add a recipe</button></div>`}</div>`;
  }

  function recipeAddChooser(attach) {
    const server = cloud.mode === 'server';
    modal({
      title: 'Add a recipe',
      body: `<div class="add-choices">
        <button type="button" class="add-choice" data-pick="link"><span>🔗</span><b>Paste a link</b><small>From any recipe website</small></button>
        <button type="button" class="add-choice" data-pick="camera" ${server ? '' : 'disabled'}><span>📷</span><b>Take a photo</b><small>Cookbook page or recipe card</small></button>
        <button type="button" class="add-choice" data-pick="upload" ${server ? '' : 'disabled'}><span>🖼️</span><b>Choose a photo</b><small>From this device</small></button>
        <button type="button" class="add-choice" data-pick="type"><span>✍️</span><b>Type it in</b><small>Family favourites</small></button>
      </div>${server ? '' : '<p class="muted small">Photos need the shared Calendora address.</p>'}`,
      onOpen(form) {
        $$('[data-pick]', form).forEach(b => b.addEventListener('click', () => {
          const k = b.dataset.pick;
          closeModal();
          if (k === 'link') recipeLinkModal(attach);
          else if (k === 'type') recipeEditor(null, {}, attach);
          else pickRecipePhoto(k === 'camera', attach);
        }));
      },
    });
  }

  function recipeLinkModal(attach) {
    modal({
      title: 'Recipe from a link',
      body: `<label class="field"><span>Recipe link</span><input name="url" type="url" placeholder="https://…" autofocus autocomplete="off"></label>
        <p class="muted small">Calendora will try to pull in the ingredients and steps. The link to the original page is always kept.</p>`,
      saveLabel: 'Get recipe',
      onSave(form) {
        const url = fval(form, 'url');
        if (!/^https?:\/\/\S+\.\S+/.test(url)) { toast('Paste a link that starts with https://'); return false; }
        if (cloud.mode !== 'server') { closeModal(); recipeEditor(null, { url, title: hostOf(url) }, attach); return false; }
        const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Reading the page…';
        api('/api/recipe-import', { method: 'POST', body: JSON.stringify({ url }) }).then(r => {
          closeModal();
          if (r.ok) {
            const d = r.data;
            if (!d.found) toast('Couldn’t find the recipe details on that page — the link is saved');
            recipeEditor(null, { url: d.url || url, title: d.title, imageUrl: d.image, servings: d.servings, time: d.time, ingredients: d.ingredients, steps: d.steps, notes: d.notes }, attach);
          } else {
            toast((r.data && r.data.error) || 'Couldn’t read that page — the link is saved');
            recipeEditor(null, { url, title: hostOf(url) }, attach);
          }
        }).catch(() => { closeModal(); recipeEditor(null, { url, title: hostOf(url) }, attach); });
        return false;
      },
    });
  }

  function pickRecipePhoto(camera, attach) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (camera) inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try { const blob = await resizeImage(f, 1600, 0.82); recipePhotoChoice(blob, attach); }
      catch (e) { toast('That photo could not be opened'); }
    });
    inp.click();
  }
  const blobToDataUrl = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  async function uploadImage(blob) {
    const r = await fetch('/api/images', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not save the photo');
    return j.id;
  }

  function recipePhotoChoice(blob, attach) {
    const url = URL.createObjectURL(blob);
    modal({
      title: 'What should happen with this photo?',
      body: `<img class="photo-preview" src="${url}" alt="Recipe photo">
        <div class="add-choices two">
          <button type="button" class="add-choice" data-pick="save"><span>🖼️</span><b>Save the photo</b><small>Keep the picture as the recipe</small></button>
          <button type="button" class="add-choice" data-pick="transcribe"><span>📝</span><b>Transcribe it</b><small>Turn it into ingredients and steps</small></button>
        </div>
        <label class="check-row only-transcribe-hint"><input type="checkbox" name="keep" checked> Keep the photo with the transcription</label>
        <div class="busy-note" hidden>Reading the recipe… this can take up to half a minute.</div>`,
      onOpen(form) {
        $$('[data-pick]', form).forEach(b => b.addEventListener('click', async () => {
          const k = b.dataset.pick;
          $$('[data-pick]', form).forEach(x => { x.disabled = true; });
          try {
            if (k === 'save') {
              const imageId = await uploadImage(blob);
              closeModal(); URL.revokeObjectURL(url);
              recipeEditor(null, { imageId, title: '' }, attach);
              return;
            }
            $('.busy-note', form).hidden = false;
            const keep = form.elements.keep.checked;
            const [imageId, r] = await Promise.all([
              keep ? uploadImage(blob) : Promise.resolve(null),
              blobToDataUrl(blob).then(d => api('/api/transcribe', { method: 'POST', body: JSON.stringify({ image: d }) })),
            ]);
            if (!r.ok) throw new Error((r.data && r.data.error) || 'Couldn’t read that photo');
            closeModal(); URL.revokeObjectURL(url);
            if (r.data.partial) toast('Read the photo, but the layout was unclear — please check the text');
            recipeEditor(null, { ...r.data, imageId }, attach);
          } catch (e) {
            toast(e.message || 'Something went wrong');
            $$('[data-pick]', form).forEach(x => { x.disabled = false; });
            $('.busy-note', form).hidden = true;
          }
        }));
      },
    });
  }

  function recipeEditor(rec, preset = {}, attach) {
    const isNew = !rec;
    const r = rec ? { ...rec } : { id: uid(), title: '', url: '', imageId: null, imageUrl: '', servings: '', time: '', ingredients: [], steps: [], notes: '', ...preset };
    const img = recipeImg(r);
    modal({
      title: isNew ? 'New recipe' : 'Edit recipe',
      cls: 'wide',
      body: `
        <input class="title-input" name="title" placeholder="Recipe name" value="${esc(r.title)}" autofocus maxlength="120" />
        ${img ? `<div class="editor-photo"><img src="${esc(img)}" alt=""><label class="check-row"><input type="checkbox" name="dropPhoto"> Remove photo</label></div>` : ''}
        <div class="row">
          <label class="field"><span>Serves</span><input name="servings" value="${esc(r.servings)}" placeholder="4" maxlength="60"></label>
          <label class="field"><span>Time</span><input name="time" value="${esc(r.time)}" placeholder="45 min" maxlength="60"></label>
        </div>
        <label class="field"><span>Ingredients <small class="muted">(one per line)</small></span><textarea name="ingredients" rows="6">${esc((r.ingredients || []).join('\n'))}</textarea></label>
        <label class="field"><span>Steps <small class="muted">(one per line)</small></span><textarea name="steps" rows="7">${esc((r.steps || []).join('\n'))}</textarea></label>
        <label class="field"><span>Link to the original</span><input name="url" type="url" value="${esc(r.url)}" placeholder="https://…"></label>
        <label class="field"><span>Notes</span><textarea name="notes" rows="2">${esc(r.notes)}</textarea></label>`,
      onSave(form) {
        const title = fval(form, 'title');
        if (!title) { form.elements.title.classList.add('invalid'); form.elements.title.focus(); return false; }
        const lines = name => fval(form, name).split(/\n+/).map(s => s.trim()).filter(Boolean);
        const url = fval(form, 'url');
        const out = { ...r, title, servings: fval(form, 'servings'), time: fval(form, 'time'), ingredients: lines('ingredients'), steps: lines('steps'), notes: fval(form, 'notes'), url: /^https?:\/\//.test(url) ? url : '' };
        if (form.elements.dropPhoto && form.elements.dropPhoto.checked) {
          if (out.imageId) api(`/api/images/${encodeURIComponent(out.imageId)}`, { method: 'DELETE' }).catch(() => {});
          out.imageId = null; out.imageUrl = '';
        }
        state.recipes = isNew ? [...(state.recipes || []), out] : state.recipes.map(x => (x.id === out.id ? out : x));
        if (attach) {
          state.meals[attach.date] = { ...(state.meals[attach.date] || {}) };
          const cur = state.meals[attach.date][attach.type];
          state.meals[attach.date][attach.type] = { name: mealName(cur) || out.title, recipeId: out.id };
        }
        save(); renderView();
        toast(isNew ? `Saved “${out.title}”` : 'Recipe updated');
      },
      onDelete: isNew ? null : () => {
        choice(`Delete “${esc(r.title)}”?`, 'Meals that use it keep their name but lose the recipe.', [{
          label: 'Delete recipe', cls: 'danger',
          fn: () => {
            if (r.imageId) api(`/api/images/${encodeURIComponent(r.imageId)}`, { method: 'DELETE' }).catch(() => {});
            state.recipes = state.recipes.filter(x => x.id !== r.id);
            Object.values(state.meals).forEach(day => Object.keys(day).forEach(k => { if (mealRecipeId(day[k]) === r.id) day[k] = mealName(day[k]); }));
            if (openRecipeId() === r.id) closeRecipe();
            save(); renderView();
          },
        }]);
        return false;
      },
    });
  }

  // ---- cooking view: stays open (on this device) until someone closes it
  let wakeLock = null;
  const openRecipeId = () => { try { return localStorage.getItem(OPEN_RECIPE_KEY); } catch (e) { return null; } };
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* not supported or not allowed */ }
  }
  const recipeChecks = {};
  function openRecipe(id) {
    const r = recipeById(id);
    if (!r) { closeRecipe(); return; }
    try { localStorage.setItem(OPEN_RECIPE_KEY, id); } catch (e) { /* ignore */ }
    const el = $('#recipeView');
    const img = recipeImg(r);
    const checks = recipeChecks[id] = recipeChecks[id] || { ing: {}, step: -1 };
    const hasText = (r.ingredients || []).length || (r.steps || []).length;
    el.hidden = false;
    el.innerHTML = `<div class="rv-card">
      <div class="rv-head">
        <div class="rv-titles"><h2>${esc(r.title)}</h2>
          <div class="rv-meta">${[r.servings && `Serves ${esc(r.servings)}`, r.time && esc(r.time), r.url && esc(hostOf(r.url))].filter(Boolean).join(' · ')}</div></div>
        ${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a>` : ''}
        <button class="btn" data-action="edit-recipe" data-id="${r.id}">${icon('edit')} Edit</button>
        <button class="icon-btn" data-action="close-recipe" aria-label="Close recipe">✕</button>
      </div>
      <div class="rv-body ${hasText ? '' : 'photo-only'}">
        ${img || (r.ingredients || []).length ? `<div class="rv-side">
          ${img ? `<img class="rv-photo" src="${esc(img)}" alt="${esc(r.title)}" data-action="zoom-photo">` : ''}
          ${(r.ingredients || []).length ? `<h3>Ingredients</h3><ul class="rv-ing">${r.ingredients.map((x, i) => `<li class="${checks.ing[i] ? 'got' : ''}" data-action="tick-ing" data-i="${i}"><span class="tick"></span>${esc(x)}</li>`).join('')}</ul>
            <button class="btn small" data-action="recipe-to-list" data-id="${r.id}">🛒 Add to Groceries</button>` : ''}
        </div>` : ''}
        <div class="rv-main">
          ${(r.steps || []).length ? `<h3>Steps</h3><ol class="rv-steps">${r.steps.map((x, i) => /^—.*—$/.test(x) ? `<li class="section">${esc(x.replace(/—/g, '').trim())}</li>` : `<li class="${i === checks.step ? 'current' : i < checks.step ? 'done' : ''}" data-action="tick-step" data-i="${i}">${esc(x)}</li>`).join('')}</ol>`
            : !hasText && !img ? `<div class="empty-sm">This recipe is just a link. ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open the recipe ↗</a>` : ''}</div>` : ''}
          ${r.notes ? `<h3>Notes</h3><p class="rv-notes">${esc(r.notes)}</p>` : ''}
        </div>
      </div></div>`;
    keepAwake(true);
  }
  function closeRecipe() {
    try { localStorage.removeItem(OPEN_RECIPE_KEY); } catch (e) { /* ignore */ }
    const el = $('#recipeView');
    el.hidden = true; el.innerHTML = '';
    keepAwake(false);
  }
  const recipeOpen = () => !$('#recipeView').hidden;

  // ---------------------------------------------------------------- meals
  function renderMeals() {
    const tabs = `<div class="seg">${[['plan', 'Plan'], ['recipes', 'Recipes']].map(([k, l]) => `<button class="${state.ui.mealsTab === k ? 'on' : ''}" data-action="meals-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (state.ui.mealsTab === 'recipes') {
      $('#toolbar').innerHTML = `<h1>Recipes <span class="muted">${(state.recipes || []).length}</span></h1>${tabs}<span class="spacer"></span>
        <button class="btn primary" data-action="new-recipe">${icon('plus')} Add recipe</button>`;
      renderRecipeLibrary();
      return;
    }
    const ws = startOfWeek(ui.mealWeek), t = todayStr();
    const e = addDays(ws, 6);
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous week">${icon('left')}</button>
        <button class="btn" data-action="today">This week</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next week">${icon('right')}</button>
      </div>
      <h1>Meal plan <span class="muted">${MON[ws.getMonth()]} ${ws.getDate()} – ${MON[e.getMonth()]} ${e.getDate()}</span></h1>
      ${tabs}
      <span class="spacer"></span>
      <button class="btn" data-action="copy-meals">${icon('copy')} Copy last week</button>`;
    let h = `<div class="meals card"><div class="mg-corner"></div>`;
    for (let i = 0; i < 7; i++) { const d = addDays(ws, i); h += `<div class="mg-day ${ymd(d) === t ? 'today' : ''}"><span>${DOW[d.getDay()]}</span><b>${d.getDate()}</b></div>`; }
    MEAL_TYPES.forEach(([k, label, ic]) => {
      h += `<div class="mg-type"><span>${ic}</span>${label}</div>`;
      for (let i = 0; i < 7; i++) {
        const ds = ymd(addDays(ws, i)); const raw = state.meals[ds] && state.meals[ds][k];
        const v = mealName(raw), rec = recipeById(mealRecipeId(raw));
        h += `<div class="mg-cell ${v ? 'filled' : ''} ${ds === t ? 'today' : ''} t-${k}" data-action="edit-meal" data-date="${ds}" data-type="${k}">${v ? `<span>${esc(v)}</span>` : '<span class="plus">+</span>'}${rec ? `<button class="recipe-chip" data-action="open-recipe" data-id="${rec.id}" aria-label="Open recipe">📖</button>` : ''}</div>`;
      }
    });
    $('#view').innerHTML = h + '</div>';
  }

  // ---------------------------------------------------------------- photos
  async function renderPhotos() {
    $('#toolbar').innerHTML = `<h1>Photo frame</h1><span class="muted sub">Shown as a slideshow when the calendar sits idle.</span><span class="spacer"></span>
      <button class="btn" data-action="sleep">${icon('sleep')} Start slideshow</button>
      <button class="btn primary" data-action="upload-photos">${icon('plus')} Add photos</button>`;
    const photos = await getPhotos();
    if (state.ui.view !== 'photos') return;
    $('#view').innerHTML = `<div class="photos">
      ${photos.length ? `<div class="photo-grid">${photos.map(p => `<div class="photo" style="background-image:url('${p.url}')"><button class="mini-btn corner light" data-action="delete-photo" data-id="${p.id}" aria-label="Delete photo">${icon('trash')}</button></div>`).join('')}</div>`
        : `<div class="empty card"><div class="scene-row">${SCENES.map(s => `<div class="scene" style="background:${s}"></div>`).join('')}</div>
            <p>No photos yet — the frame will show these color scenes until you add your own.<br><span class="muted">Photos stay in this browser on this device.</span></p>
            <button class="btn primary" data-action="upload-photos">${icon('plus')} Add photos</button></div>`}
      <div class="frame-settings card">
        <label class="field inline"><span>Start the frame after</span>
          <select data-setting="screensaverMin" data-num="1">${[[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']].map(([v, l]) => `<option value="${v}" ${state.settings.screensaverMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="muted">of no activity</span></label>
      </div></div>`;
  }

  // ---------------------------------------------------------------- settings
  function renderSettings() {
    const s = state.settings;
    $('#toolbar').innerHTML = `<h1>Settings</h1>`;
    const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
    $('#view').innerHTML = `<div class="settings">
      <section class="card">
        <div class="sec-head"><h3>Family</h3><button class="btn primary" data-action="new-member">${icon('plus')} Add member</button></div>
        <div class="member-list">${state.members.map(m => `
          <div class="member-row">${avatar(m, 'lg')}<span class="cname">${esc(m.name)}</span><span class="spacer"></span>
            <button class="btn" data-action="edit-member" data-id="${m.id}">${icon('edit')} Edit</button></div>`).join('') || '<div class="empty-sm">No family members yet.</div>'}
        </div>
      </section>
      <section class="card">
        <h3>Display</h3>
        <label class="field inline"><span>Week starts on</span><select data-setting="weekStart" data-num="1">${opt(0, 'Sunday', s.weekStart)}${opt(1, 'Monday', s.weekStart)}${opt(6, 'Saturday', s.weekStart)}</select></label>
        <label class="field inline"><span>Clock</span><select data-setting="use24h" data-bool="1">${opt('false', '12-hour (3:30 PM)', s.use24h)}${opt('true', '24-hour (15:30)', s.use24h)}</select></label>
        <label class="field inline"><span>Day view hours</span>
          <select data-setting="dayStart" data-num="1">${[5, 6, 7, 8, 9].map(h => opt(h, fmtHourLabel(h), s.dayStart)).join('')}</select>
          <span class="muted">to</span>
          <select data-setting="dayEnd" data-num="1">${[18, 19, 20, 21, 22, 23, 24].map(h => opt(h, fmtHourLabel(h), s.dayEnd)).join('')}</select></label>
        <label class="field inline"><span>Show dinner on the week view</span><select data-setting="showMeals" data-bool="1">${opt('true', 'Yes', s.showMeals)}${opt('false', 'No', s.showMeals)}</select></label>
        <label class="field inline"><span>Photo frame starts after</span><select data-setting="screensaverMin" data-num="1">${[[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']].map(([v, l]) => opt(v, l, s.screensaverMin)).join('')}</select></label>
      </section>
      ${cloud.mode === 'server' ? `<section class="card">
        <h3>Family sharing</h3>
        <p class="muted" id="cloudStatus">${cloudStatusText()}</p>
        <div class="row wrap">
          <button class="btn" data-action="cloud-sync">Sync now</button>
          <button class="btn" data-action="cloud-passcode">Change passcode</button>
          <button class="btn" data-action="cloud-logout-all">Sign out other devices</button>
          <button class="btn ghost" data-action="cloud-logout">Sign out this device</button>
        </div>
      </section>` : ''}
      ${cloud.mode === 'server' ? anylistSection() : ''}
      ${cloud.mode === 'server' ? icalSection() : ''}
      ${googleSection()}
      <section class="card">
        <h3>Weather</h3>
        <p class="muted">${s.weather ? `Showing weather for <b>${esc(s.weather.name)}</b>.` : 'Add a location to see the forecast in the header and on the week view.'}</p>
        <form class="row" data-form="weather-search"><input name="q" placeholder="City or ZIP code" autocomplete="off" /><button class="btn" type="submit">Search</button>
          <button class="btn" type="button" data-action="geo">📍 Use my location</button>
          ${s.weather ? '<button class="btn ghost" type="button" data-action="clear-weather">Remove</button>' : ''}</form>
        <div id="geoResults" class="geo-results"></div>
        <label class="field inline"><span>Units</span><select data-setting="tempUnit">${opt('fahrenheit', '°F', s.tempUnit)}${opt('celsius', '°C', s.tempUnit)}</select></label>
      </section>
      <section class="card">
        <h3>Your data</h3>
        <p class="muted">Everything is saved in this browser. Export a backup to move it to another device.</p>
        <div class="row wrap">
          <button class="btn" data-action="export">Export backup</button>
          <button class="btn" data-action="import">Import backup</button>
          <button class="btn" data-action="reset-demo">Load demo family</button>
          <button class="btn danger" data-action="clear-all">Start fresh</button>
        </div>
      </section>
      <p class="muted center small">Calendora · works offline · no account needed</p>
    </div>`;
  }

  function googleSection() {
    const G = gCfg();
    let h = `<section class="card"><div class="sec-head"><h3>Google Calendar</h3>${G.connected ? `<span class="status-pill ${gHasToken() ? 'ok' : 'warn'}">${gHasToken() ? 'Connected' : 'Needs reconnect'}</span>` : ''}</div>`;
    if (!G.connected) {
      h += `<p class="muted">Two-way sync: your Google calendars show up here, and events you add here can be saved to Google — so they appear on everyone’s phones.</p>
        <label class="field"><span>Google OAuth Client ID</span><input data-g-client value="${esc(gClientId())}" placeholder="1234567890-abc….apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
        <button class="btn primary" data-action="g-connect"><span class="gmark">G</span> Connect Google Calendar</button>`;
    } else {
      const cals = Object.entries(G.calendars);
      const writable = cals.filter(([, c]) => gWritable(c));
      h += `<p class="muted">Signed in as <b>${esc(G.email || 'your Google account')}</b>${state.gSyncedAt ? ` · synced ${timeAgo(state.gSyncedAt)}` : ''}. Changes made in Google show up here within a few minutes.</p>
        <div class="row wrap">
          ${gHasToken() ? '<button class="btn" data-action="g-sync">Sync now</button>' : '<button class="btn primary" data-action="g-reconnect">Reconnect</button>'}
          <button class="btn ghost" data-action="g-disconnect">Disconnect</button>
        </div>
        <h4>Calendars <small class="muted">— tick to show, and pick whose calendar it is</small></h4>
        <div class="gcal-list">${cals.map(([id, c]) => `
          <div class="gcal-row">
            <label class="gcal-on"><input type="checkbox" data-gcal-on="${esc(id)}" ${c.on ? 'checked' : ''}><span class="gdot" style="--c:${c.color}"></span>
              <span class="gname">${esc(c.name)}${c.primary ? ' <small class="muted">primary</small>' : ''}${gWritable(c) ? '' : ' <small class="muted">read-only</small>'}</span></label>
            <select data-gcal-member="${esc(id)}"><option value="">Everyone</option>${state.members.map(m => `<option value="${m.id}" ${c.memberId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
          </div>`).join('') || '<div class="empty-sm">No calendars yet — press Sync now.</div>'}
        </div>
        <label class="field inline"><span>New events go to</span><select data-g-default>
          <option value="">Calendora only (this device)</option>
          ${writable.map(([id, c]) => `<option value="${esc(id)}" ${G.defaultCal === id ? 'selected' : ''}>Google · ${esc(c.name)}</option>`).join('')}
        </select></label>
        <p class="muted small">Tip: when someone is assigned a Google calendar above, new events for just that person are saved to it automatically.</p>`;
    }
    return h + '</section>';
  }

  // ---------------------------------------------------------------- modals
  const modalRoot = $('#modalRoot');
  let modalOpen = false;
  function modal({ title, body, onSave, onDelete, saveLabel = 'Save', deleteLabel = 'Delete', onOpen, cls = '' }) {
    modalRoot.innerHTML = `<div class="modal-back"><form class="modal ${cls}" novalidate>
      <div class="mhead"><h2>${title}</h2><button type="button" class="icon-btn flat" data-close aria-label="Close">✕</button></div>
      <div class="mbody">${body}</div>
      <div class="mfoot">${onDelete ? `<button type="button" class="btn danger" data-del>${deleteLabel}</button>` : ''}<span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Cancel</button>${onSave ? `<button type="submit" class="btn primary">${saveLabel}</button>` : ''}</div>
    </form></div>`;
    modalOpen = true;
    const form = $('form', modalRoot);
    form.addEventListener('submit', e => { e.preventDefault(); if (onSave && onSave(form) !== false) closeModal(); });
    $$('[data-close]', modalRoot).forEach(b => b.addEventListener('click', closeModal));
    $('.modal-back', modalRoot).addEventListener('pointerdown', e => { if (e.target.classList.contains('modal-back')) closeModal(); });
    if (onDelete) $('[data-del]', modalRoot).addEventListener('click', () => { if (onDelete(form) !== false) closeModal(); });
    if (onOpen) onOpen(form);
    setTimeout(() => { const a = $('[autofocus]', form); if (a && !matchMedia('(pointer:coarse)').matches) a.focus(); }, 60);
    return form;
  }
  function closeModal() { modalRoot.innerHTML = ''; modalOpen = false; }
  function choice(title, text, options) {
    modalRoot.innerHTML = `<div class="modal-back"><div class="modal small"><div class="mhead"><h2>${title}</h2></div>
      <div class="mbody"><p>${text}</p><div class="choice-list">${options.map((o, i) => `<button class="btn ${o.cls || ''}" data-i="${i}">${o.label}</button>`).join('')}
      <button class="btn ghost" data-i="-1">Cancel</button></div></div></div></div>`;
    modalOpen = true;
    $$('[data-i]', modalRoot).forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.i); closeModal(); if (i >= 0) options[i].fn(); }));
  }
  const fval = (form, name) => { const el = form.elements[name]; return el ? el.value.trim() : ''; };
  const fall = (form, name) => $$(`[name="${name}"]:checked`, form).map(i => i.value);

  function memberPicker(selected, multi = true, name = 'memberIds') {
    return `<div class="pick-members">${state.members.map(m => `
      <label class="mpick" style="--c:${m.color}"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${m.id}" ${selected.includes(m.id) ? 'checked' : ''}>${avatar(m, 'sm')}<span>${esc(m.name)}</span></label>`).join('')}</div>`;
  }
  function dayPicker(selected, name) {
    return `<div class="daypick">${weekOrder().map(i => `<label><input type="checkbox" name="${name}" value="${i}" ${selected.includes(i) ? 'checked' : ''}><span>${DOW[i].slice(0, 2)}</span></label>`).join('')}</div>`;
  }
  function emojiPicker(list, cur, name = 'emoji') {
    return `<div class="emoji-pick">${list.map(e => `<label><input type="radio" name="${name}" value="${e}" ${e === cur ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>`;
  }

  function defaultStart(ds) {
    if (ds !== todayStr()) return '09:00';
    const n = new Date();
    const m = Math.min(23 * 60, Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30);
    return fromMin(m);
  }

  function eventModal(ev, occDate, preset = {}) {
    const isNew = !ev;
    const isG = !!(ev && (ev.source === 'google' || ev.source === 'apple'));
    const isApple = !!(ev && ev.source === 'apple');
    const ro = isG && ev.readOnly;
    const date = preset.date || ymd(ui.cursor);
    const st = preset.startTime || defaultStart(date);
    const e = ev ? { ...ev } : {
      id: uid(), title: '', date, endDate: null, allDay: !!preset.allDay, startTime: st, endTime: fromMin(Math.min(toMin(st) + 60, 23 * 60 + 59)),
      recur: 'none', recurDays: [], until: null, memberIds: preset.memberIds || [], location: '', notes: '', exdates: [],
    };
    const recurDays = e.recurDays && e.recurDays.length ? e.recurDays : [parse(e.date).getDay()];
    const gcal = isG && !isApple ? gCfg().calendars[e.gcal] : null;
    const afeed = isApple ? icalFeed(e.feed) : null;
    const srcLabel = isApple ? `Apple · ${esc(afeed ? afeed.name : 'Calendar')}` : `Google · ${esc(gcal ? gcal.name : 'Calendar')}`;
    const srcColor = isApple ? (afeed && afeed.color) || '#8E8AA0' : gcal ? gcal.color : '#8E8AA0';
    const writableCals = gCfg().connected ? Object.entries(gCfg().calendars).filter(([, c]) => c.on && gWritable(c)) : [];
    const calPicker = isNew && writableCals.length ? `<label class="field"><span>Save to</span><select name="gcal">
        <option value="local">Calendora only (this device)</option>
        ${writableCals.map(([id, c]) => `<option value="${esc(id)}">Google · ${esc(c.name)}</option>`).join('')}</select></label>` : '';
    const whoBlock = isG
      ? `<div class="gsource"><span class="gdot" style="--c:${srcColor}"></span>${srcLabel}${ro ? ` <span class="muted">(read-only${isApple ? ' — edit it on the iPhone' : ''})</span>` : ''}</div>`
      : `<div class="field"><span>Who’s going?</span>${memberPicker(e.memberIds)}<small class="muted">Leave empty for the whole family.</small></div>`;
    const repeatBlock = isG
      ? (e.gseries && !isApple ? '<p class="muted small">Part of a repeating Google event — changes here apply to this one only.</p>' : '')
      : `<div class="row">
          <label class="field"><span>Repeat</span><select name="recur">${REPEAT_OPTS.map(([v, l]) => `<option value="${v}" ${e.recur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field only-repeat"><span>Until <small class="muted">(optional)</small></span><input type="date" name="until" value="${e.until || ''}"></label>
        </div>
        <div class="field only-weekly"><span>Repeat on</span>${dayPicker(recurDays, 'recurDays')}</div>`;

    const busy = async (form, fn, msg) => {
      const btn = $('button[type=submit]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      try { await fn(); closeModal(); toast(msg); }
      catch (err) { toast(err.message); if (btn) { btn.disabled = false; btn.textContent = 'Save'; } }
    };
    const gRun = async (fn, msg) => { try { await fn(); toast(msg); } catch (err) { toast(err.message); } };

    modal({
      title: ro ? 'Event' : isNew ? 'New event' : 'Edit event',
      cls: 'event-modal',
      body: `
        <input class="title-input" name="title" placeholder="What’s happening?" value="${esc(e.title)}" autofocus required maxlength="200" />
        ${whoBlock}
        ${calPicker}
        <label class="switch"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}><span class="track"></span><span>All day</span></label>
        <div class="row">
          <label class="field"><span>${e.allDay ? 'Starts' : 'Date'}</span><input type="date" name="date" value="${e.date}" required></label>
          <label class="field only-timed"><span>From</span><input type="time" name="startTime" value="${e.startTime || '09:00'}" step="300"></label>
          <label class="field only-timed"><span>To</span><input type="time" name="endTime" value="${e.endTime || ''}" step="300"></label>
          <label class="field only-allday"><span>Ends</span><input type="date" name="endDate" value="${e.endDate || e.date}"></label>
        </div>
        ${repeatBlock}
        <label class="field"><span>Location</span><input name="location" value="${esc(e.location)}" placeholder="Add a place" maxlength="200"></label>
        <label class="field"><span>Notes</span><textarea name="notes" rows="2" placeholder="Anything to remember?">${esc(e.notes)}</textarea></label>`,
      onOpen(form) {
        const sync = () => {
          form.classList.toggle('is-allday', form.elements.allDay.checked);
          const r = form.elements.recur ? form.elements.recur.value : 'none';
          form.classList.toggle('is-repeat', r !== 'none');
          form.classList.toggle('is-weekly', r === 'weekly');
        };
        form.addEventListener('change', sync); sync();
        form.elements.startTime.addEventListener('change', () => {
          const sEl = form.elements.startTime, eEl = form.elements.endTime;
          if (!eEl.value || toMin(eEl.value) <= toMin(sEl.value)) eEl.value = fromMin(Math.min(toMin(sEl.value) + 60, 23 * 60 + 59));
        });
        const calSel = form.elements.gcal;
        if (calSel) {
          let touched = false;
          calSel.addEventListener('change', () => { touched = true; });
          const pick = () => { if (!touched) calSel.value = gDefaultCalFor(fall(form, 'memberIds')); };
          form.addEventListener('change', ev2 => { if (ev2.target.name === 'memberIds') pick(); });
          pick();
        }
        if (ro) $$('input, select, textarea', form).forEach(i => { i.disabled = true; });
      },
      onSave: ro ? null : form => {
        const title = fval(form, 'title');
        if (!title) { form.elements.title.focus(); form.elements.title.classList.add('invalid'); return false; }
        const allDay = form.elements.allDay.checked;
        const out = {
          ...e, title, allDay,
          date: fval(form, 'date') || e.date,
          location: fval(form, 'location'),
          notes: fval(form, 'notes'),
        };
        if (!isG) {
          out.memberIds = fall(form, 'memberIds');
          out.recur = fval(form, 'recur');
          out.recurDays = fall(form, 'recurDays').map(Number);
          out.until = fval(form, 'until') || null;
          if (out.recur !== 'weekly') out.recurDays = [];
          else if (!out.recurDays.length) out.recurDays = [parse(out.date).getDay()];
        }
        if (allDay) {
          out.startTime = ''; out.endTime = '';
          const ed = fval(form, 'endDate');
          out.endDate = ed && ed > out.date ? ed : null;
        } else {
          out.endDate = null;
          out.startTime = fval(form, 'startTime') || '09:00';
          let et = fval(form, 'endTime');
          if (!et || toMin(et) <= toMin(out.startTime)) et = fromMin(Math.min(toMin(out.startTime) + 60, 23 * 60 + 59));
          out.endTime = et;
        }
        if (isG) { busy(form, () => gUpdate(out), 'Saved to Google Calendar'); return false; }
        const target = form.elements.gcal ? form.elements.gcal.value : 'local';
        if (isNew && target !== 'local') { busy(form, () => gCreate(out, target), 'Added to Google Calendar'); return false; }
        if (isNew) state.events.push(out);
        else state.events = state.events.map(x => x.id === out.id ? out : x);
        save(); renderView();
        toast(isNew ? 'Event added' : 'Event updated');
      },
      onDelete: isNew || ro ? null : () => {
        if (isG) {
          if (e.gseries) {
            choice('Delete repeating event', `“${esc(e.title)}” repeats in Google Calendar. What should be deleted?`, [
              { label: 'Only this one', fn: () => gRun(() => gDelete(e, false), 'Deleted from Google Calendar') },
              { label: 'All events in the series', cls: 'danger', fn: () => gRun(() => gDelete(e, true), 'Series deleted from Google Calendar') },
            ]);
          } else {
            choice('Delete event?', `“${esc(e.title)}” will also be deleted from Google Calendar.`, [
              { label: 'Delete', cls: 'danger', fn: () => gRun(() => gDelete(e, false), 'Deleted from Google Calendar') },
            ]);
          }
          return false;
        }
        const del = () => { state.events = state.events.filter(x => x.id !== e.id); save(); renderView(); toast('Event deleted'); };
        if (e.recur && e.recur !== 'none' && occDate) {
          choice('Delete repeating event', `“${esc(e.title)}” repeats. What should be deleted?`, [
            { label: 'Only this one', fn: () => { const x = state.events.find(x => x.id === e.id); x.exdates = [...(x.exdates || []), occDate]; save(); renderView(); toast('Event deleted'); } },
            { label: 'This and all following', fn: () => { const x = state.events.find(x => x.id === e.id); if (occDate <= x.date) del(); else { x.until = ymd(addDays(parse(occDate), -1)); save(); renderView(); toast('Events deleted'); } } },
            { label: 'All events in the series', cls: 'danger', fn: del },
          ]);
          return false;
        }
        del();
      },
    });
  }

  function choreModal(c, preset = {}) {
    const isNew = !c;
    const ch = c ? { ...c } : { id: uid(), title: '', emoji: '🧹', memberId: preset.memberId || (state.members[0] && state.members[0].id), time: 'anytime', stars: 1, repeat: 'daily', days: [], date: ymd(ui.choreDate) };
    modal({
      title: isNew ? 'New chore' : 'Edit chore',
      body: `
        <input class="title-input" name="title" placeholder="e.g. Feed the dog" value="${esc(ch.title)}" autofocus maxlength="80" />
        <div class="field"><span>Icon</span>${emojiPicker(CHORE_EMOJI.includes(ch.emoji) ? CHORE_EMOJI : [ch.emoji, ...CHORE_EMOJI], ch.emoji)}</div>
        <div class="field"><span>Who</span>${memberPicker([ch.memberId], false, 'memberId')}</div>
        <div class="field"><span>Time of day</span><div class="seg wide">${TIMES_OF_DAY.map(([k, l, ic]) => `<label><input type="radio" name="time" value="${k}" ${ch.time === k ? 'checked' : ''}><span>${ic} ${l}</span></label>`).join('')}</div></div>
        <div class="field"><span>Repeat</span><div class="seg wide">${[['daily', 'Every day'], ['weekly', 'Certain days'], ['once', 'Just once']].map(([k, l]) => `<label><input type="radio" name="repeat" value="${k}" ${ch.repeat === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="field only-weekly">${dayPicker(ch.days && ch.days.length ? ch.days : [1, 2, 3, 4, 5], 'days')}</div>
        <label class="field only-once"><span>On</span><input type="date" name="date" value="${ch.date || ymd(ui.choreDate)}"></label>
        <div class="field"><span>Stars earned</span><div class="star-pick">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" value="${n}" ${ch.stars === n ? 'checked' : ''}><span>${'★'.repeat(n)}</span></label>`).join('')}</div></div>`,
      onOpen(form) {
        const sync = () => { const r = fall(form, 'repeat')[0]; form.classList.toggle('is-weekly', r === 'weekly'); form.classList.toggle('is-once', r === 'once'); };
        form.addEventListener('change', sync); sync();
      },
      onSave(form) {
        const title = fval(form, 'title');
        if (!title) { form.elements.title.classList.add('invalid'); return false; }
        const memberId = fall(form, 'memberId')[0];
        if (!memberId) { toast('Pick who this chore is for'); return false; }
        const out = { ...ch, title, memberId, emoji: fall(form, 'emoji')[0] || '⭐', time: fall(form, 'time')[0] || 'anytime', repeat: fall(form, 'repeat')[0] || 'daily', days: fall(form, 'days').map(Number), date: fval(form, 'date') || null, stars: Number(fall(form, 'stars')[0] || 1) };
        if (out.repeat === 'weekly' && !out.days.length) { toast('Pick at least one day'); return false; }
        if (isNew) state.chores.push(out); else state.chores = state.chores.map(x => x.id === out.id ? out : x);
        save(); renderView(); toast(isNew ? 'Chore added' : 'Chore updated');
      },
      onDelete: isNew ? null : () => { state.chores = state.chores.filter(x => x.id !== ch.id); save(); renderView(); toast('Chore deleted'); },
    });
  }

  function memberModal(m) {
    const isNew = !m;
    const used = state.members.map(x => x.color);
    const mm = m ? { ...m } : { id: uid(), name: '', color: COLORS.find(c => !used.includes(c)) || COLORS[0], emoji: '' };
    modal({
      title: isNew ? 'Add family member' : `Edit ${esc(mm.name)}`,
      body: `
        <label class="field"><span>Name</span><input name="name" value="${esc(mm.name)}" autofocus maxlength="24" placeholder="e.g. Grandpa"></label>
        <div class="field"><span>Color</span><div class="color-pick">${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === mm.color ? 'checked' : ''}><span style="--c:${c}"></span></label>`).join('')}</div></div>
        <label class="field"><span>Emoji instead of initials <small class="muted">(optional)</small></span><input name="emoji" value="${esc(mm.emoji || '')}" maxlength="4" placeholder="🦊"></label>`,
      onSave(form) {
        const name = fval(form, 'name');
        if (!name) { form.elements.name.classList.add('invalid'); return false; }
        const out = { ...mm, name, color: fall(form, 'color')[0] || mm.color, emoji: fval(form, 'emoji') };
        if (isNew) state.members.push(out); else state.members = state.members.map(x => x.id === out.id ? out : x);
        save(); render();
      },
      onDelete: isNew ? null : () => {
        choice(`Remove ${esc(mm.name)}?`, 'Their chores will be deleted. Events they were in stay on the calendar.', [{
          label: 'Remove', cls: 'danger', fn: () => {
            state.members = state.members.filter(x => x.id !== mm.id);
            state.chores = state.chores.filter(c => c.memberId !== mm.id);
            state.events.forEach(e => { e.memberIds = e.memberIds.filter(id => id !== mm.id); });
            state.hidden = state.hidden.filter(id => id !== mm.id);
            Object.values(state.settings.google.calendars).forEach(c => { if (c.memberId === mm.id) c.memberId = ''; });
            gRemap();
            save(); render();
          },
        }]);
        return false;
      },
    });
  }

  function rewardModal(r) {
    const isNew = !r;
    const rr = r ? { ...r } : { id: uid(), title: '', emoji: '🎁', cost: 10 };
    modal({
      title: isNew ? 'New reward' : 'Edit reward',
      body: `
        <input class="title-input" name="title" placeholder="e.g. Pizza night" value="${esc(rr.title)}" autofocus maxlength="60" />
        <div class="field"><span>Icon</span>${emojiPicker(REWARD_EMOJI.includes(rr.emoji) ? REWARD_EMOJI : [rr.emoji, ...REWARD_EMOJI], rr.emoji)}</div>
        <label class="field"><span>Cost in stars</span><input type="number" name="cost" min="1" max="999" value="${rr.cost}"></label>`,
      onSave(form) {
        const title = fval(form, 'title');
        if (!title) { form.elements.title.classList.add('invalid'); return false; }
        const out = { ...rr, title, emoji: fall(form, 'emoji')[0] || '🎁', cost: clamp(Number(fval(form, 'cost')) || 1, 1, 999) };
        if (isNew) state.rewards.push(out); else state.rewards = state.rewards.map(x => x.id === out.id ? out : x);
        save(); renderView();
      },
      onDelete: isNew ? null : () => { state.rewards = state.rewards.filter(x => x.id !== rr.id); save(); renderView(); },
    });
  }

  function redeemModal(r) {
    modal({
      title: `Redeem “${esc(r.title)}”`,
      body: `<p class="muted">Costs ⭐ ${r.cost}. Who is cashing in?</p>
        <div class="redeem-list">${state.members.map(m => { const b = balance(m.id); return `<button type="button" class="redeem-btn" data-mid="${m.id}" ${b < r.cost ? 'disabled' : ''} style="--c:${m.color}">${avatar(m)}<span>${esc(m.name)}</span><span class="muted">⭐ ${b}${b < r.cost ? ` · needs ${r.cost - b} more` : ''}</span></button>`; }).join('')}</div>`,
      onOpen(form) {
        $$('.redeem-btn', form).forEach(b => b.addEventListener('click', () => {
          const m = memberById(b.dataset.mid);
          state.redemptions.push({ id: uid(), rewardId: r.id, title: r.title, memberId: m.id, cost: r.cost, date: todayStr() });
          save(); closeModal(); renderView();
          toast(`🎉 ${m.name} redeemed ${r.title}!`);
          confetti($('#view'));
        }));
      },
    });
  }

  function listModal(l) {
    const isNew = !l;
    const ll = l ? { ...l } : { id: uid(), name: '', emoji: '📝', items: [] };
    modal({
      title: isNew ? 'New list' : 'Edit list',
      body: `<input class="title-input" name="name" placeholder="List name" value="${esc(ll.name)}" autofocus maxlength="40" />
        <div class="field"><span>Icon</span>${emojiPicker(LIST_EMOJI.includes(ll.emoji) ? LIST_EMOJI : [ll.emoji, ...LIST_EMOJI], ll.emoji)}</div>`,
      onSave(form) {
        const name = fval(form, 'name');
        if (!name) { form.elements.name.classList.add('invalid'); return false; }
        const out = { ...ll, name, emoji: fall(form, 'emoji')[0] || '📝' };
        if (isNew) { state.lists.push(out); state.ui.listId = out.id; } else state.lists = state.lists.map(x => x.id === out.id ? out : x);
        save(); renderView();
      },
      onDelete: isNew ? null : () => { state.lists = state.lists.filter(x => x.id !== ll.id); save(); renderView(); toast('List deleted'); },
    });
  }

  function mealModal(ds, type) {
    const label = MEAL_TYPES.find(m => m[0] === type) || MEAL_TYPES[2];
    const raw = state.meals[ds] && state.meals[ds][type];
    const cur = mealName(raw), curRec = mealRecipeId(raw);
    const past = new Map(); // meal name -> recipe id (if it had one)
    Object.values(state.meals).forEach(day => Object.entries(day).forEach(([k, v]) => { if (k === type && mealName(v)) past.set(mealName(v), mealRecipeId(v) || past.get(mealName(v)) || null); }));
    const recipes = (state.recipes || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    const d = parse(ds);
    modal({
      title: `${label[2]} ${label[1]} · ${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`,
      body: `<input class="title-input" name="meal" list="mealSuggest" value="${esc(cur)}" placeholder="What’s on the menu?" autofocus maxlength="80" />
        <datalist id="mealSuggest">${[...past.keys()].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        ${past.size ? `<div class="field"><span>Recent</span><div class="suggest">${[...past.keys()].slice(-10).reverse().map(v => `<button type="button" class="pill" data-meal="${esc(v)}">${esc(v)}${past.get(v) ? ' 📖' : ''}</button>`).join('')}</div></div>` : ''}
        <div class="field"><span>Recipe</span>
          <div class="row recipe-pick">
            <select name="recipe"><option value="">No recipe</option>${recipes.map(r => `<option value="${r.id}" ${r.id === curRec ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select>
            <button type="button" class="btn" data-new-recipe>${icon('plus')} New recipe</button>
          </div>
          <small class="muted">Paste a link, snap a photo or type it in — it opens in a cooking view from the calendar.</small>
        </div>
        <label class="check-row recipe-groceries" hidden><input type="checkbox" name="addIng"> Add this recipe’s ingredients to Groceries</label>
        <label class="field"><span>Add other items to Groceries <small class="muted">(optional, comma-separated)</small></span><input name="ingredients" placeholder="tortillas, ground beef, salsa"></label>`,
      onOpen(form) {
        const sel = form.elements.recipe;
        const syncIng = () => { const r = recipeById(sel.value); $('.recipe-groceries', form).hidden = !(r && (r.ingredients || []).length); };
        sel.addEventListener('change', () => { syncIng(); const r = recipeById(sel.value); if (r && !form.elements.meal.value.trim()) form.elements.meal.value = r.title; });
        syncIng();
        $$('[data-meal]', form).forEach(b => b.addEventListener('click', () => {
          form.elements.meal.value = b.dataset.meal;
          const rid = past.get(b.dataset.meal);
          if (rid && recipeById(rid)) { sel.value = rid; syncIng(); }
        }));
        $('[data-new-recipe]', form).addEventListener('click', () => {
          const name = form.elements.meal.value.trim();
          state.meals[ds] = { ...(state.meals[ds] || {}) };
          if (name) state.meals[ds][type] = { name, recipeId: curRec };
          closeModal();
          recipeAddChooser({ date: ds, type });
        });
      },
      onSave(form) {
        const v = fval(form, 'meal');
        const rid = form.elements.recipe.value || null;
        const rec = recipeById(rid);
        state.meals[ds] = { ...(state.meals[ds] || {}) };
        if (v || rec) state.meals[ds][type] = rec ? { name: v || rec.title, recipeId: rec.id } : v;
        else delete state.meals[ds][type];
        const ing = fval(form, 'ingredients').split(',').map(s => s.trim()).filter(Boolean);
        if (rec && form.elements.addIng.checked) ing.push(...(rec.ingredients || []));
        if (ing.length) addToGroceries(ing);
        save(); renderView();
      },
      onDelete: cur ? () => { delete state.meals[ds][type]; save(); renderView(); } : null,
      deleteLabel: 'Clear',
    });
  }
  function addToGroceries(items) {
    let gl = state.lists.find(l => /grocer/i.test(l.name));
    if (!gl) { gl = { id: uid(), name: 'Groceries', emoji: '🛒', items: [] }; state.lists.unshift(gl); }
    const have = new Set(gl.items.filter(i => !i.done).map(i => i.text.toLowerCase()));
    const add = items.filter(t => t && !have.has(t.toLowerCase()));
    add.slice().reverse().forEach(t => gl.items.unshift({ id: uid(), text: t, done: false }));
    toast(add.length ? `Added ${add.length} item${add.length > 1 ? 's' : ''} to ${gl.name}` : `Everything is already on ${gl.name}`);
  }

  function itemModal(list, item) {
    modal({
      title: 'Edit item',
      body: `<input class="title-input" name="text" value="${esc(item.text)}" autofocus maxlength="120" />`,
      onSave(form) { const t = fval(form, 'text'); if (!t) return false; item.text = t; save(); renderView(); },
      onDelete() { list.items = list.items.filter(i => i.id !== item.id); save(); renderView(); },
    });
  }

  // ---------------------------------------------------------------- actions
  function navigate(dir) {
    const v = state.ui.view;
    if (v === 'calendar') {
      const c = ui.cursor;
      ui.cursor = { day: () => addDays(c, dir), week: () => addDays(c, 7 * dir), schedule: () => addDays(c, 7 * dir), month: () => new Date(c.getFullYear(), c.getMonth() + dir, 1) }[state.ui.calView]();
    } else if (v === 'chores') ui.choreDate = addDays(ui.choreDate, dir);
    else if (v === 'meals') ui.mealWeek = addDays(ui.mealWeek, 7 * dir);
    else return;
    renderView();
  }
  function goToday() { ui.cursor = today(); ui.choreDate = today(); ui.mealWeek = today(); renderView(); }

  const actions = {
    view(el) { state.ui.view = el.dataset.v; save({ localOnly: true }); render(); if (el.dataset.v === 'settings') anylistLoad(); },
    calview(el) { state.ui.calView = el.dataset.v; save(); renderView(); },
    nav(el) { navigate(Number(el.dataset.dir)); },
    today: goToday,
    'goto-day'(el) { ui.cursor = parse(el.dataset.date); state.ui.calView = 'day'; save(); renderView(); },
    'toggle-member'(el) {
      const id = el.dataset.id;
      state.hidden = state.hidden.includes(id) ? state.hidden.filter(x => x !== id) : [...state.hidden, id];
      save(); renderMemberFilter(); renderView();
    },
    'edit-event'(el) { const ev = allEvents().find(e => e.id === el.dataset.id); if (ev) eventModal(ev, el.dataset.date); },
    noop() {},
    async 'anylist-sync'() {
      anylist.syncing = true; renderView();
      try {
        if (JSON.stringify(sharedPart()) !== cloud.lastStr) await cloudPush();
        const r = await api('/api/anylist/sync', { method: 'POST', body: '{}' });
        if (!r.ok) toast((r.data && r.data.error) || 'AnyList sync failed');
        else { anylist.info = { ...(anylist.info || {}), status: r.data.status }; const st = r.data.status; toast(st && st.ok ? `Synced · ${st.pushed} sent, ${st.pulled} received` : (st && st.error) || 'Sync finished'); }
        await cloudPull();
      } catch (e) { toast('Can’t reach Calendora right now'); }
      anylist.syncing = false; renderView();
    },
    'meals-tab'(el) { state.ui.mealsTab = el.dataset.v; save({ localOnly: true }); renderView(); },
    'new-recipe'() { recipeAddChooser(null); },
    'open-recipe'(el) { openRecipe(el.dataset.id); },
    'close-recipe'() { closeRecipe(); },
    'edit-recipe'(el) { const r = recipeById(el.dataset.id); if (r) recipeEditor(r); },
    'recipe-to-list'(el) { const r = recipeById(el.dataset.id); if (r) { addToGroceries(r.ingredients || []); save(); } },
    'tick-ing'(el) { const id = openRecipeId(); const c = recipeChecks[id]; if (!c) return; const i = el.dataset.i; c.ing[i] = !c.ing[i]; el.classList.toggle('got', !!c.ing[i]); },
    'tick-step'(el) { const id = openRecipeId(); const c = recipeChecks[id]; if (!c) return; const i = Number(el.dataset.i); c.step = c.step === i ? i + 1 : i; openRecipe(id); },
    'zoom-photo'(el) { el.classList.toggle('zoomed'); },
    'ical-refresh'() { icalRefresh({ fresh: true }); },
    'ical-remove'(el) {
      const f = icalFeed(el.dataset.id); if (!f) return;
      choice(`Remove “${esc(f.name)}”?`, 'Its events disappear from the board. Nothing changes in iCloud.', [{
        label: 'Remove', cls: 'danger',
        fn: () => { state.icalFeeds = icalFeeds().filter(x => x.id !== f.id); delete ical.data[f.id]; saveIcalCache(); icalRemap(); save(); renderView(); },
      }]);
    },
    'cloud-sync'() { if (JSON.stringify(sharedPart()) !== cloud.lastStr) cloudPush(); else cloudPull(); toast('Syncing…'); },
    'cloud-passcode'() { passcodeModal(); },
    'cloud-logout-all'() {
      choice('Sign out other devices?', 'Every other phone, tablet and computer will need the family passcode again. This device stays signed in.', [{
        label: 'Sign them out', cls: 'danger',
        fn: () => api('/api/logout-all', { method: 'POST', body: '{}' }).then(r => toast(r.ok ? 'Other devices signed out' : 'Could not sign out other devices')).catch(() => toast('Can’t reach Calendora right now')),
      }]);
    },
    'cloud-logout'() {
      choice('Sign out this device?', 'The family board is removed from this device. It stays safe on the server for everyone else.', [{
        label: 'Sign out', cls: 'danger',
        fn: async () => {
          try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch (e) { /* ignore */ }
          localStorage.removeItem(STORE_KEY); localStorage.removeItem(CLOUD_KEY);
          location.reload();
        },
      }]);
    },
    'g-connect'() { gConnect(); },
    'g-reconnect'() { gReconnect(); },
    'g-sync'() { if (!gHasToken()) gReconnect(); else gSync(); },
    'g-disconnect'() { choice('Disconnect Google Calendar?', 'Google events will be removed from this screen. Nothing is deleted from Google.', [{ label: 'Disconnect', cls: 'danger', fn: gDisconnect }]); },
    'new-event'(el) { eventModal(null, null, { date: el.dataset.date }); },
    'new-event-at'(el, evt) {
      const rect = el.getBoundingClientRect();
      const s = Number(el.parentElement.dataset.start);
      const min = clamp(s * 60 + Math.floor((evt.clientY - rect.top) / HOUR_H * 2) * 30, 0, 23 * 60);
      eventModal(null, null, { date: el.dataset.date, startTime: fromMin(min), memberIds: el.dataset.member ? [el.dataset.member] : [] });
    },
    'toggle-chore'(el) {
      const ds = ymd(ui.choreDate);
      const c = state.chores.find(x => x.id === el.dataset.id); if (!c) return;
      const day = state.choreDone[ds] = state.choreDone[ds] || {};
      const nowDone = !day[c.id];
      if (nowDone) day[c.id] = { m: c.memberId, s: c.stars || 0 }; else delete day[c.id];
      save(); renderView();
      if (nowDone) {
        const row = $(`.chore[data-id="${c.id}"]`);
        if (row) { row.classList.add('pop'); const s = document.createElement('span'); s.className = 'star-float'; s.textContent = `+${c.stars}⭐`; row.appendChild(s); }
        const col = $(`.ccol[data-member="${c.memberId}"]`);
        if (col && col.classList.contains('alldone')) { confetti(col); toast(`🎉 ${memberById(c.memberId).name} finished everything!`); }
      }
    },
    'edit-chore'(el) { const c = state.chores.find(x => x.id === el.dataset.id); if (c) choreModal(c); },
    'new-chore'(el) { if (!state.members.length) return memberModal(); choreModal(null, { memberId: el.dataset.member }); },
    'new-member'() { memberModal(); },
    'edit-member'(el) { memberModal(memberById(el.dataset.id)); },
    'new-reward'() { rewardModal(); },
    'edit-reward'(el) { rewardModal(state.rewards.find(r => r.id === el.dataset.id)); },
    redeem(el) { redeemModal(state.rewards.find(r => r.id === el.dataset.id)); },
    'new-list'() { listModal(); },
    'edit-list'(el) { listModal(state.lists.find(l => l.id === el.dataset.id)); },
    'pick-list'(el) { state.ui.listId = el.dataset.id; save(); renderView(); },
    'toggle-item'(el) { const l = currentList(); const it = l && l.items.find(i => i.id === el.dataset.id); if (it) { it.done = !it.done; save(); renderView(); } },
    'delete-item'(el) { const l = currentList(); if (l) { l.items = l.items.filter(i => i.id !== el.dataset.id); save(); renderView(); } },
    'edit-item'(el) { const l = currentList(); const it = l && l.items.find(i => i.id === el.dataset.id); if (it) itemModal(l, it); },
    'clear-done'() { const l = currentList(); if (l) { l.items = l.items.filter(i => !i.done); save(); renderView(); } },
    'edit-meal'(el) { mealModal(el.dataset.date, el.dataset.type); },
    'copy-meals'() {
      const ws = startOfWeek(ui.mealWeek); let n = 0;
      for (let i = 0; i < 7; i++) {
        const src = state.meals[ymd(addDays(ws, i - 7))]; const dst = ymd(addDays(ws, i));
        if (src) { state.meals[dst] = { ...src, ...(state.meals[dst] || {}) }; n++; }
      }
      save(); renderView(); toast(n ? 'Copied last week’s meals into empty slots' : 'Last week has no meals to copy');
    },
    'upload-photos'() { $('#photoInput').click(); },
    async 'delete-photo'(el) { await photoDB.del(el.dataset.id); const u = photoUrls.get(el.dataset.id); if (u) URL.revokeObjectURL(u); photoUrls.delete(el.dataset.id); renderView(); },
    sleep() { startScreensaver(); },
    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available here'));
    },
    geo() {
      if (!navigator.geolocation) return toast('Location is not available in this browser');
      navigator.geolocation.getCurrentPosition(p => {
        state.settings.weather = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'My location' };
        save(); fetchWeather(); renderView(); toast('Weather location set');
      }, () => toast('Could not get your location'));
    },
    'pick-geo'(el) { state.settings.weather = { lat: +el.dataset.lat, lon: +el.dataset.lon, name: el.dataset.name }; save(); fetchWeather(); renderView(); toast(`Weather set to ${el.dataset.name}`); },
    'clear-weather'() { state.settings.weather = null; ui.weather = null; save(); renderWeather(); renderView(); },
    export() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `calendora-backup-${todayStr()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    import() { $('#importInput').click(); },
    'reset-demo'() { choice('Load the demo family?', 'This replaces everything currently saved (photos are kept).', [{ label: 'Load demo', cls: 'danger', fn: () => { const keep = state.settings.google, ge = state.gEvents; state = seed(defaults()); state.settings.google = keep; state.gEvents = ge; gRemap(); state.ui.view = 'calendar'; save(); render(); } }]); },
    'clear-all'() { choice('Start fresh?', 'This deletes all family members, events, chores, lists and meals saved in this browser.', [{ label: 'Delete everything', cls: 'danger', fn: () => { const keep = state.settings.google, ge = state.gEvents; state = defaults(); state.settings.google = keep; state.gEvents = ge; Object.values(keep.calendars).forEach(c => { c.memberId = ''; }); gRemap(); save(); render(); memberModal(); } }]); },
  };
  const currentList = () => state.lists.find(l => l.id === state.ui.listId);

  document.addEventListener('click', evt => {
    const el = evt.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (el.closest('#modalRoot') && !el.closest('.modal')) return;
    const fn = actions[el.dataset.action];
    if (fn) { evt.preventDefault(); evt.stopPropagation(); fn(el, evt); }
  });

  document.addEventListener('submit', async evt => {
    const f = evt.target.closest('[data-form]'); if (!f) return;
    evt.preventDefault();
    if (f.dataset.form === 'setup' || f.dataset.form === 'login') { lockSubmit(f); return; }
    if (f.dataset.form === 'ical-add') {
      const url = f.elements.url.value.trim();
      if (!/^(webcals?|https?):\/\/\S+$/i.test(url)) { toast('Paste the link that starts with webcal://'); return; }
      if (icalFeeds().some(x => x.url === url)) { toast('That calendar is already added'); return; }
      const memberId = f.elements.member.value;
      const used = icalFeeds().map(x => x.color);
      const feed = {
        id: uid(), url, memberId, on: true,
        name: f.elements.name.value.trim() || (memberId ? `${memberById(memberId).name}’s iCloud` : 'iCloud calendar'),
        color: ['#A2845E', '#5C7CFA', '#2BB3A3', '#E56BB0', '#F2A541', '#8D6E63'].find(c => !used.includes(c)) || '#A2845E',
      };
      state.icalFeeds = [...icalFeeds(), feed];
      save({ localOnly: true });
      renderView();
      toast('Adding calendar…');
      await cloudPush(true);
      await icalRefresh({ fresh: true, only: feed.id });
      const d = ical.data[feed.id];
      toast(d && !d.error ? `Added ${feed.name} · ${d.events.length} events` : (d && d.error) || 'Added — it will load shortly');
      return;
    }
    if (f.dataset.form === 'add-item') {
      const text = f.elements.text.value.trim(); const l = currentList();
      if (!text || !l) return;
      text.split(/\n|,(?=\s*\S)/).map(s => s.trim()).filter(Boolean).forEach(t => l.items.unshift({ id: uid(), text: t, done: false }));
      save(); renderView();
      const inp = $('.add-item input'); if (inp) inp.focus();
    }
    if (f.dataset.form === 'weather-search') {
      const q = f.elements.q.value.trim(); if (!q) return;
      const box = $('#geoResults'); box.innerHTML = '<span class="muted">Searching…</span>';
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
        const j = await r.json();
        box.innerHTML = (j.results || []).map(p => {
          const name = [p.name, p.admin1, p.country_code].filter(Boolean).join(', ');
          return `<button class="pill" data-action="pick-geo" data-lat="${p.latitude}" data-lon="${p.longitude}" data-name="${esc(name)}">${esc(name)}</button>`;
        }).join('') || '<span class="muted">No matches — try a nearby city.</span>';
      } catch (e) { box.innerHTML = '<span class="muted">Search is unavailable right now.</span>'; }
    }
  });

  document.addEventListener('change', evt => {
    const t = evt.target;
    if (t.matches('[data-g-client]')) { gCfg().clientId = t.value.trim(); save(); if (gClientId()) gLoadScript().catch(() => {}); return; }
    if (t.matches('[data-gcal-on]')) {
      const c = gCfg().calendars[t.dataset.gcalOn]; if (!c) return;
      c.on = t.checked; save(); renderView(); if (c.on) gSync({ quiet: true }); return;
    }
    if (t.matches('[data-gcal-member]')) {
      const c = gCfg().calendars[t.dataset.gcalMember]; if (!c) return;
      c.memberId = t.value; gRemap(); save(); toast(`${c.name} → ${t.value ? memberById(t.value).name : 'Everyone'}`); return;
    }
    if (t.matches('[data-g-default]')) { gCfg().defaultCal = t.value; save(); return; }
    if (t.matches('[data-anylist]')) {
      const cfg = state.settings.anylist = { listName: 'Groceries', ...(state.settings.anylist || {}) };
      const k = t.dataset.anylist;
      if (k === 'on') cfg.on = t.checked;
      else if (k === 'listName') cfg.listName = t.value.trim() || 'Groceries';
      else if (k === 'listId') cfg.listId = t.value;
      if (k === 'listId' && !cfg.listId) delete cfg.listId;
      save();
      if (k === 'on' && cfg.on) { toast('AnyList sync on — first sync in a few seconds'); setTimeout(() => actions['anylist-sync'](), 1200); } else renderView();
      return;
    }
    if (t.matches('[data-ical-member]')) {
      const f = icalFeed(t.dataset.icalMember); if (!f) return;
      f.memberId = t.value; icalRemap(); save(); toast(`${f.name} → ${t.value ? memberById(t.value).name : 'Everyone'}`); return;
    }
    const el = t.closest('[data-setting]'); if (!el) return;
    let v = el.value;
    if (el.dataset.num) v = Number(v);
    if (el.dataset.bool) v = v === 'true';
    state.settings[el.dataset.setting] = v;
    if (state.settings.dayEnd <= state.settings.dayStart) state.settings.dayEnd = state.settings.dayStart + 1;
    save();
    if (el.dataset.setting === 'tempUnit') fetchWeather();
    render();
  });

  $('#photoInput').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    toast(`Adding ${files.length} photo${files.length > 1 ? 's' : ''}…`);
    let ok = 0;
    for (const f of files) {
      try { const blob = await resizeImage(f); await photoDB.put({ id: uid(), blob, added: Date.now() }); ok++; }
      catch (err) { console.warn(err); }
    }
    toast(ok ? `Added ${ok} photo${ok > 1 ? 's' : ''}` : 'Those files could not be added');
    if (state.ui.view === 'photos') renderView();
  });

  $('#importInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.members) || !Array.isArray(data.events)) throw new Error('bad file');
      state = mergeState(data);
      save(); render(); fetchWeather(); toast('Backup imported');
    } catch (err) { toast('That file is not a Calendora backup'); }
  });

  $('#fab').addEventListener('click', () => {
    switch (state.ui.view) {
      case 'calendar': return eventModal(null, null, { date: ymd(state.ui.calView === 'month' && ui.cursor.getMonth() === today().getMonth() ? today() : ui.cursor) });
      case 'chores': return actions['new-chore']({ dataset: {} });
      case 'rewards': return rewardModal();
      case 'lists': return listModal();
      case 'meals': return state.ui.mealsTab === 'recipes' ? recipeAddChooser(null) : mealModal(todayStr(), 'dinner');
      case 'photos': return $('#photoInput').click();
      default: return null;
    }
  });

  // swipe left / right to move between days, weeks and months
  let touch = null;
  $('#view').addEventListener('touchstart', e => { if (e.touches.length === 1) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
  $('#view').addEventListener('touchend', e => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - touch.t < 700) navigate(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  document.addEventListener('keydown', e => {
    if (ssOn) { stopScreensaver(); return; }
    if (e.key === 'Escape' && modalOpen) { closeModal(); return; }
    if (modalOpen || !$('#lock').hidden || recipeOpen() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') navigate(-1);
    else if (e.key === 'ArrowRight') navigate(1);
    else if (e.key === 't') goToday();
    else if (state.ui.view === 'calendar' && 'dwms'.includes(e.key)) { state.ui.calView = { d: 'day', w: 'week', m: 'month', s: 'schedule' }[e.key]; save(); renderView(); }
    else if (e.key === 'n') $('#fab').click();
  });

  // ---------------------------------------------------------------- family sharing (Cloudflare Worker + D1)
  // When the app is served by the Calendora Worker, the family board is shared through /api.
  // Anywhere else (GitHub Pages, a local file) it runs in local-only mode.
  const CLOUD_KEY = 'calendora.cloud';
  const SHARED_KEYS = ['members', 'events', 'chores', 'choreDone', 'lists', 'meals', 'rewards', 'redemptions', 'icalFeeds', 'recipes'];
  const cloud = { mode: 'unknown', configured: false, signedIn: false, version: 0, lastStr: '', pushing: false, again: false, offline: false, lastSync: 0, timer: null };
  try { const m = JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null'); if (m) { cloud.version = m.version || 0; cloud.lastStr = m.lastStr || ''; cloud.lastSync = m.lastSync || 0; cloud.known = true; } } catch (e) { /* ignore */ }
  const saveCloudMeta = () => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ version: cloud.version, lastStr: cloud.lastStr, lastSync: cloud.lastSync })); } catch (e) { /* ignore */ } };
  const cloudOn = () => cloud.mode === 'server' && cloud.signedIn;

  function sharedPart() {
    const out = {};
    SHARED_KEYS.forEach(k => { out[k] = state[k]; });
    const { google, ...rest } = state.settings; // Google sign-in stays on each device
    out.settings = rest;
    return out;
  }
  function applyShared(data) {
    SHARED_KEYS.forEach(k => { if (data[k] !== undefined) state[k] = data[k]; });
    if (data.settings) state.settings = { ...state.settings, ...data.settings, google: state.settings.google };
    state.hidden = state.hidden.filter(id => state.members.some(m => m.id === id));
    gRemap();
    icalRemap();
    save({ localOnly: true });
    render();
    if (recipeOpen() && !modalOpen) { const id = openRecipeId(); if (recipeById(id)) openRecipe(id); else closeRecipe(); }
  }
  async function api(path, opts = {}) {
    const headers = opts.body ? { 'Content-Type': 'application/json' } : {};
    const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...opts, headers });
    let data = null;
    try { data = await r.json(); } catch (e) { /* not JSON */ }
    return { status: r.status, ok: r.ok, data };
  }
  const isTyping = () => /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');

  async function cloudInit() {
    if (location.protocol === 'file:' || /\.github\.io$/.test(location.hostname)) { cloud.mode = 'local'; return; }
    let r;
    try { r = await api('/api/session'); }
    catch (e) {
      if (cloud.known) { cloud.mode = 'server'; cloud.signedIn = true; cloud.offline = true; renderCloudStatus(); } // offline: keep using this device's copy
      else cloud.mode = 'local';
      return;
    }
    if (!r.data || typeof r.data.configured !== 'boolean') { cloud.mode = 'local'; return; }
    cloud.mode = 'server';
    cloud.configured = r.data.configured;
    cloud.signedIn = r.data.signedIn;
    if (!cloud.signedIn) { showLock(); return; }
    await cloudAfterSignIn();
  }

  async function cloudAfterSignIn() {
    hideLock();
    let r;
    try { r = await api('/api/board'); } catch (e) { cloud.offline = true; renderCloudStatus(); return; }
    if (r.status === 401) { cloud.signedIn = false; showLock(); return; }
    if (!r.ok) { toast('Could not load the family board'); return; }
    cloud.offline = false;
    if (!r.data.data) {
      cloud.version = 0; cloud.lastStr = '';
      await cloudPush(true);
      toast('Family board created — every signed-in device will now share it');
    } else {
      cloud.version = r.data.version;
      applyShared(r.data.data);
      cloud.lastStr = JSON.stringify(sharedPart());
    }
    cloud.lastSync = Date.now();
    saveCloudMeta();
    renderCloudStatus();
    icalRefresh();
  }

  function cloudQueuePush() {
    if (!cloudOn()) return;
    clearTimeout(cloud.timer);
    cloud.timer = setTimeout(() => cloudPush(), 600);
  }

  async function cloudPush(force = false) {
    if (!cloudOn()) return;
    if (cloud.pushing) { cloud.again = true; return; }
    const str = JSON.stringify(sharedPart());
    if (!force && str === cloud.lastStr) return;
    cloud.pushing = true;
    try {
      const r = await api('/api/board', { method: 'PUT', body: JSON.stringify({ data: JSON.parse(str), baseVersion: cloud.version }) });
      if (r.ok) {
        cloud.version = r.data.version; cloud.lastStr = str; cloud.offline = false; cloud.lastSync = Date.now();
        if (state.settings.anylist && state.settings.anylist.on) setTimeout(cloudPull, 3500); // pick up items AnyList sent back
      } else if (r.status === 409 && r.data) {
        // Another device saved first. Keep our edits to parts they didn't touch; take theirs elsewhere.
        const base = cloud.lastStr ? JSON.parse(cloud.lastStr) : {};
        const local = JSON.parse(str), remote = r.data.data || {};
        const merged = {}; let keptLocal = false;
        [...SHARED_KEYS, 'settings'].forEach(k => {
          const lc = JSON.stringify(local[k]), bc = JSON.stringify(base[k]), rc = JSON.stringify(remote[k]);
          if (lc !== bc && rc === bc) { merged[k] = local[k]; keptLocal = true; } else merged[k] = remote[k];
        });
        cloud.version = r.data.version;
        applyShared(merged);
        cloud.lastStr = JSON.stringify(remote);
        if (keptLocal) cloud.again = true;
        cloud.offline = false; cloud.lastSync = Date.now();
      } else if (r.status === 401) {
        cloud.signedIn = false; showLock();
      } else if (r.data && r.data.error) {
        toast(r.data.error);
      }
    } catch (e) {
      cloud.offline = true; // keep the change locally; it goes up on the next attempt
    } finally {
      cloud.pushing = false;
      saveCloudMeta();
      renderCloudStatus();
      if (cloud.again) { cloud.again = false; cloudQueuePush(); }
    }
  }

  async function cloudPull() {
    if (!cloudOn() || cloud.pushing) return;
    if (JSON.stringify(sharedPart()) !== cloud.lastStr) { cloudPush(); return; }
    if (modalOpen || isTyping()) return; // don't redraw under someone's fingers
    try {
      const r = await api(`/api/board?since=${cloud.version}`);
      if (r.status === 401) { cloud.signedIn = false; showLock(); return; }
      if (r.ok) {
        cloud.offline = false; cloud.lastSync = Date.now();
        if (!r.data.unchanged && r.data.data) {
          cloud.version = r.data.version;
          applyShared(r.data.data);
          cloud.lastStr = JSON.stringify(sharedPart());
        }
      }
    } catch (e) { cloud.offline = true; }
    saveCloudMeta();
    renderCloudStatus();
  }

  function renderCloudStatus() {
    const pill = $('#cloudPill');
    if (pill) {
      pill.hidden = !(cloud.mode === 'server' && cloud.offline);
      pill.textContent = 'Offline · changes saved on this device';
    }
    const st = $('#cloudStatus');
    if (st) st.innerHTML = cloudStatusText();
  }
  function cloudStatusText() {
    if (cloud.offline) return 'Offline right now — changes are kept on this device and sync when the connection is back.';
    return cloud.lastSync ? `Shared with every signed-in device · synced ${timeAgo(cloud.lastSync)}.` : 'Shared with every signed-in device.';
  }

  // ---- lock screen
  function showLock(error = '') {
    const el = $('#lock');
    const setup = !cloud.configured;
    el.hidden = false;
    el.innerHTML = `<form class="lock-card" data-form="${setup ? 'setup' : 'login'}">
      <div class="logo big"><span></span></div>
      <h1>${setup ? 'Welcome to Calendora' : 'Calendora'}</h1>
      <p class="muted">${setup ? 'Create a family passcode. Everyone in the family uses it once on each of their devices.' : 'Enter the family passcode to open the family board on this device.'}</p>
      <input type="password" name="pass" placeholder="${setup ? 'New family passcode' : 'Family passcode'}" autocomplete="${setup ? 'new-password' : 'current-password'}" minlength="4" required autofocus />
      ${setup ? '<input type="password" name="pass2" placeholder="Type it again" autocomplete="new-password" minlength="4" required />' : ''}
      <div class="lock-error" role="alert">${esc(error)}</div>
      <button class="btn primary block" type="submit">${setup ? 'Create passcode' : 'Open Calendora'}</button>
      ${setup ? '<p class="muted small">At least 4 characters. You can change it later in Settings.</p>' : ''}
    </form>`;
    setTimeout(() => { const i = $('#lock input'); if (i) i.focus(); }, 50);
  }
  function hideLock() { const el = $('#lock'); el.hidden = true; el.innerHTML = ''; }

  async function lockSubmit(form) {
    const pass = form.elements.pass.value;
    const btn = $('button[type=submit]', form);
    const fail = msg => { $('.lock-error', form).textContent = msg; btn.disabled = false; };
    if (pass.length < 4) return fail('Use at least 4 characters');
    if (form.dataset.form === 'setup' && pass !== form.elements.pass2.value) return fail('The two passcodes don’t match');
    btn.disabled = true;
    try {
      const r = await api(form.dataset.form === 'setup' ? '/api/setup' : '/api/login', { method: 'POST', body: JSON.stringify({ passcode: pass }) });
      if (r.status === 409 && form.dataset.form === 'setup') { cloud.configured = true; showLock('A passcode was already created — enter it here'); return; }
      if (!r.ok) return fail((r.data && r.data.error) || 'Something went wrong — try again');
      cloud.configured = true; cloud.signedIn = true;
      await cloudAfterSignIn();
    } catch (e) { fail('Can’t reach Calendora — check the internet connection'); }
  }

  function passcodeModal() {
    modal({
      title: 'Change family passcode',
      body: `<label class="field"><span>Current passcode</span><input type="password" name="cur" autocomplete="current-password" autofocus></label>
        <label class="field"><span>New passcode</span><input type="password" name="next" autocomplete="new-password" minlength="4"></label>
        <label class="field"><span>New passcode again</span><input type="password" name="next2" autocomplete="new-password"></label>
        <p class="muted small">Every other device will need the new passcode. This one stays signed in.</p>`,
      onSave(form) {
        const next = form.elements.next.value;
        if (next.length < 4) { toast('Use at least 4 characters'); return false; }
        if (next !== form.elements.next2.value) { toast('The new passcodes don’t match'); return false; }
        api('/api/passcode', { method: 'POST', body: JSON.stringify({ current: form.elements.cur.value, next }) })
          .then(r => { if (r.ok) { closeModal(); toast('Passcode changed'); } else toast((r.data && r.data.error) || 'Could not change the passcode'); })
          .catch(() => toast('Can’t reach Calendora right now'));
        return false;
      },
      saveLabel: 'Change passcode',
    });
  }

  // ---------------------------------------------------------------- Apple / iCal calendars (read-only)
  // The Worker fetches each feed (e.g. an iCloud "Public Calendar" link); this code parses the
  // iCalendar text and expands repeating events in the browser.
  const ICAL_KEY = 'calendora.ical';
  const DAY_MS = 86400000;
  const ical = { data: {}, flat: [], loading: false, lastFetch: 0 };
  try { const c = JSON.parse(localStorage.getItem(ICAL_KEY) || 'null'); if (c) { ical.data = c.data || {}; ical.lastFetch = c.at || 0; } } catch (e) { /* ignore */ }
  const saveIcalCache = () => { try { localStorage.setItem(ICAL_KEY, JSON.stringify({ data: ical.data, at: ical.lastFetch })); } catch (e) { /* storage full: keep in memory */ } };
  const icalFeeds = () => (Array.isArray(state.icalFeeds) ? state.icalFeeds : []);
  const icalFeed = id => icalFeeds().find(f => f.id === id);

  function icalRemap() {
    ical.flat = [];
    Object.entries(ical.data).forEach(([id, d]) => {
      const f = icalFeed(id);
      if (!f || f.on === false) return;
      const mids = f.memberId && memberById(f.memberId) ? [f.memberId] : [];
      (d.events || []).forEach(e => { e.memberIds = mids; ical.flat.push(e); });
    });
  }

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

  function icsToEvents(text, feed) {
    const raw = icsParse(text);
    const t = today();
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

  async function icalFetchOne(f, fresh) {
    const r = await fetch(`/api/ical?feed=${encodeURIComponent(f.id)}${fresh ? '&fresh=1' : ''}`, { credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 401) { cloud.signedIn = false; showLock(); throw new Error('signed out'); }
    if (!r.ok) { let msg = 'Could not load this calendar'; try { msg = (await r.json()).error || msg; } catch (e) { /* ignore */ } return { error: msg, status: r.status }; }
    return { text: await r.text() };
  }
  async function icalRefresh({ fresh = false, only = null } = {}) {
    if (!cloudOn() || ical.loading) return;
    const feeds = icalFeeds().filter(f => !only || f.id === only);
    ical.loading = true;
    renderIcalStatus();
    try {
      for (const f of feeds) {
        let res;
        try {
          res = await icalFetchOne(f, fresh);
          if (res.status === 404 && only) { await new Promise(ok => setTimeout(ok, 1500)); res = await icalFetchOne(f, fresh); }
        } catch (e) {
          if (e.message === 'signed out') break;
          ical.data[f.id] = { ...(ical.data[f.id] || { events: [] }), error: 'Offline — showing the last copy', at: Date.now() };
          continue;
        }
        if (res.error) { ical.data[f.id] = { ...(ical.data[f.id] || { events: [] }), error: res.error, at: Date.now() }; continue; }
        try {
          const events = icsToEvents(res.text, f);
          ical.data[f.id] = { events, error: null, at: Date.now() };
        } catch (e) { ical.data[f.id] = { ...(ical.data[f.id] || { events: [] }), error: 'Could not read this calendar', at: Date.now() }; }
      }
      Object.keys(ical.data).forEach(id => { if (!icalFeed(id)) delete ical.data[id]; });
      if (!only) ical.lastFetch = Date.now();
      saveIcalCache();
    } finally {
      ical.loading = false;
      icalRemap();
      renderView();
    }
  }
  function renderIcalStatus() { if (state.ui.view === 'settings') renderView(); }

  function icalSection() {
    const feeds = icalFeeds();
    const memberOpts = sel => `<option value="">Everyone</option>${state.members.map(m => `<option value="${m.id}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}`;
    const status = f => {
      const d = ical.data[f.id];
      if (ical.loading && (!d || !d.at)) return 'Loading…';
      if (!d) return 'Not loaded yet';
      if (d.error) return `<span class="warn-text">${esc(d.error)}</span>`;
      return `${d.events.length} event${d.events.length === 1 ? '' : 's'} · updated ${timeAgo(d.at)}`;
    };
    return `<section class="card">
      <div class="sec-head"><h3>Apple calendars</h3>${feeds.length ? '<button class="btn" data-action="ical-refresh">Refresh now</button>' : ''}</div>
      <p class="muted">Show iCloud calendars on the board (read-only). Refreshes about every 15 minutes.</p>
      ${feeds.length ? `<div class="gcal-list">${feeds.map(f => `
        <div class="gcal-row">
          <div class="gcal-on"><span class="gdot" style="--c:${f.color}"></span><span class="gname">${esc(f.name)}<small class="muted feed-status">${status(f)}</small></span></div>
          <select data-ical-member="${f.id}">${memberOpts(f.memberId)}</select>
          <button class="mini-btn" data-action="ical-remove" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">${icon('trash')}</button>
        </div>`).join('')}</div>` : ''}
      <form class="ical-add" data-form="ical-add">
        <label class="field"><span>Public Calendar link</span><input name="url" placeholder="webcal://p…-caldav.icloud.com/published/2/…" autocomplete="off" spellcheck="false" required></label>
        <div class="row">
          <label class="field"><span>Name</span><input name="name" placeholder="e.g. Mom’s iCloud" maxlength="40"></label>
          <label class="field"><span>Whose calendar</span><select name="member">${memberOpts('')}</select></label>
          <button class="btn primary" type="submit">Add</button>
        </div>
      </form>
      <details class="howto"><summary>How do I get the link?</summary>
        <ol><li>On the iPhone, open <b>Calendar</b> and tap <b>Calendars</b>.</li><li>Tap <b>ⓘ</b> next to the calendar and turn on <b>Public Calendar</b>.</li><li>Tap <b>Share Link…</b>, then <b>Copy</b>, and paste it above.</li></ol>
        <p class="muted small">Anyone with the link can view that calendar, so only share calendars meant for the family board. Turning Public Calendar off stops the link.</p>
      </details>
    </section>`;
  }

  // ---------------------------------------------------------------- AnyList shopping-list sync (settings)
  const anylist = { info: null, loading: false, syncing: false };
  async function anylistLoad() {
    if (cloud.mode !== 'server' || !cloudOn() || anylist.loading) return;
    anylist.loading = true;
    try { const r = await api('/api/anylist'); if (r.ok) { anylist.info = r.data; anylist.loadedAt = Date.now(); } } catch (e) { /* offline */ }
    anylist.loading = false;
    if (state.ui.view === 'settings' && !modalOpen && !isTyping()) renderView();
  }
  function anylistSection() {
    if (!anylist.loading && (!anylist.info || Date.now() - (anylist.loadedAt || 0) > 30000)) setTimeout(anylistLoad, 0);
    const cfg = state.settings.anylist || {};
    const info = anylist.info;
    const lists = state.lists || [];
    const target = lists.find(l => l.id === cfg.listId) || lists.find(l => /grocer/i.test(l.name));
    const st = info && info.status;
    let statusLine = '';
    if (!info) statusLine = '<span class="muted">Checking…</span>';
    else if (!info.configured) statusLine = '<span class="warn-text">Waiting for your AnyList email and password on Cloudflare (steps below).</span>';
    else if (!cfg.on) statusLine = '<span class="muted">Ready — switch it on to start syncing.</span>';
    else if (anylist.syncing) statusLine = 'Syncing…';
    else if (st && st.ok) statusLine = `Synced with AnyList “${esc(st.listName)}” · ${timeAgo(st.at)}`;
    else if (st && st.error) statusLine = `<span class="warn-text">AnyList sync paused: ${esc(st.error)}</span>`;
    else statusLine = '<span class="muted">Waiting for the first sync (within a minute)…</span>';
    return `<section class="card">
      <div class="sec-head"><h3>AnyList shopping list</h3>${info && info.configured && cfg.on ? '<button class="btn" data-action="anylist-sync">Sync now</button>' : ''}</div>
      <p class="muted">Keeps one Calendora list and one AnyList list matched, both ways, about every minute. Uses AnyList’s unofficial connection, so it could stop working if AnyList changes its app.</p>
      <p id="anylistStatus">${statusLine}</p>
      <label class="switch"><input type="checkbox" data-anylist="on" ${cfg.on ? 'checked' : ''} ${info && info.configured ? '' : 'disabled'}><span class="track"></span><span>Sync with AnyList</span></label>
      <div class="row">
        <label class="field"><span>AnyList list name</span><input data-anylist="listName" value="${esc(cfg.listName || 'Groceries')}" maxlength="60" placeholder="Groceries"></label>
        <label class="field"><span>Calendora list</span><select data-anylist="listId">${target ? '' : '<option value="" selected>Create one automatically</option>'}${lists.map(l => `<option value="${l.id}" ${target && target.id === l.id ? 'selected' : ''}>${esc(l.emoji || '')} ${esc(l.name)}</option>`).join('')}</select></label>
      </div>
      ${info && info.configured ? '' : `<details class="howto" open><summary>Connect your AnyList account</summary>
        <ol>
          <li>In the Cloudflare dashboard open <b>Workers &amp; Pages → calendora → Settings → Variables and secrets</b>.</li>
          <li>Click <b>Add</b>, choose type <b>Secret</b>, name it <code>ANYLIST_EMAIL</code> and enter your AnyList email. <b>Deploy</b>.</li>
          <li>Add another <b>Secret</b> named <code>ANYLIST_PASSWORD</code> with your AnyList password. <b>Deploy</b>.</li>
          <li>Come back here — the switch above becomes available.</li>
        </ol>
        <p class="muted small">The password is stored encrypted by Cloudflare and only the Calendora server can use it. Nobody can read it back, including Calendora’s settings page.</p>
      </details>`}
    </section>`;
  }

  // ---------------------------------------------------------------- toast
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- photo frame / screensaver
  let ssOn = false, ssTimer = null, ssIdx = 0, ssSlides = [], ssFlip = false, lastActive = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  const ss = $('#screensaver');

  async function startScreensaver() {
    if (ssOn) return;
    ssOn = true;
    closeModal();
    const photos = await getPhotos();
    ssSlides = photos.length ? photos.map(p => `url('${p.url}') center/cover no-repeat`) : SCENES;
    ssIdx = Math.floor(Math.random() * ssSlides.length);
    ss.innerHTML = `<div class="ss-slide" id="ssA"></div><div class="ss-slide" id="ssB"></div><div class="ss-shade"></div>
      <div class="ss-info"><div class="ss-time" id="ssTime"></div><div class="ss-date" id="ssDate"></div><div class="ss-weather" id="ssWeather"></div></div>
      <div class="ss-events" id="ssEvents"></div><div class="ss-hint">Tap anywhere to return</div>`;
    ss.hidden = false;
    requestAnimationFrame(() => ss.classList.add('on'));
    showSlide();
    updateScreensaver();
    ssTimer = setInterval(() => { ssIdx = (ssIdx + 1) % ssSlides.length; showSlide(); }, 12000);
  }
  function showSlide() {
    ssFlip = !ssFlip;
    const show = $(ssFlip ? '#ssA' : '#ssB'), hide = $(ssFlip ? '#ssB' : '#ssA');
    if (!show) return;
    show.style.background = ssSlides[ssIdx];
    show.classList.remove('kb'); void show.offsetWidth; show.classList.add('kb', 'show');
    hide.classList.remove('show');
  }
  function updateScreensaver() {
    if (!ssOn) return;
    const n = new Date();
    $('#ssTime').innerHTML = state.settings.use24h ? `${pad(n.getHours())}:${pad(n.getMinutes())}` : `${n.getHours() % 12 || 12}:${pad(n.getMinutes())}<small>${n.getHours() < 12 ? 'AM' : 'PM'}</small>`;
    $('#ssDate').textContent = `${DOW_LONG[n.getDay()]}, ${MONTHS[n.getMonth()]} ${n.getDate()}`;
    const w = ui.weather;
    $('#ssWeather').textContent = w && w.current ? `${wIcon(w.current.weather_code, w.current.is_day)} ${Math.round(w.current.temperature_2m)}°` : '';
    const nowMin = n.getHours() * 60 + n.getMinutes();
    dayCache = new Map();
    const up = eventsOn(todayStr()).filter(e => e.allDay || toMin(e.endTime || e.startTime) >= nowMin).slice(0, 4);
    $('#ssEvents').innerHTML = up.length ? `<div class="ss-ev-head">Today</div>${up.map(e => `<div class="ss-ev" style="--c:${evColor(e)}"><b>${e.allDay ? 'All day' : fmtTime(e.startTime)}</b>${esc(e.title)}</div>`).join('')}` : '';
  }
  function stopScreensaver() {
    if (!ssOn) return;
    ssOn = false; clearInterval(ssTimer);
    ss.classList.remove('on');
    setTimeout(() => { if (!ssOn) { ss.hidden = true; ss.innerHTML = ''; } }, 400);
    lastActive = Date.now();
    goToday();
  }
  ss.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); stopScreensaver(); });

  // ---------------------------------------------------------------- tick
  let lastDay = todayStr();
  setInterval(() => {
    renderClock();
    positionNowLine();
    if (ssOn) updateScreensaver();
    const m = state.settings.screensaverMin;
    if (!ssOn && !modalOpen && $('#lock').hidden && !recipeOpen() && m > 0 && Date.now() - lastActive > m * 60000) startScreensaver();
    if (todayStr() !== lastDay) { lastDay = todayStr(); goToday(); }
  }, 1000 * 15);
  setInterval(fetchWeather, 30 * 60 * 1000);

  // ---------------------------------------------------------------- boot
  render();
  fetchWeather();
  setInterval(renderClock, 1000);
  icalRemap();
  if (openRecipeId() && recipeById(openRecipeId())) openRecipe(openRecipeId());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && recipeOpen()) keepAwake(true); });
  cloudInit();
  setInterval(cloudPull, 15000);
  setInterval(() => icalRefresh(), 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - ical.lastFetch > 15 * 60 * 1000) icalRefresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cloudPull(); });
  addEventListener('online', () => { if (cloud.mode === 'server') { cloud.offline = false; cloudPull(); } });
  if (gCfg().connected) {
    gLoadScript().catch(() => {});
    gSync({ quiet: true });
  } else if (gClientId()) gLoadScript().catch(() => {});
  // keep Google in step: every 5 minutes, and whenever the tab comes back into view
  setInterval(() => { if (gCfg().connected && gHasToken()) gSync({ quiet: true }); else renderSyncPill(); }, 5 * 60 * 1000);
  setInterval(renderSyncPill, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && gCfg().connected && gHasToken() && Date.now() - (state.gSyncedAt || 0) > 60000) gSync({ quiet: true });
  });
})();
