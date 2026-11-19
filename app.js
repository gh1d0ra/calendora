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
  const CHORE_EMOJI = [
    // home & tidy
    '🛏️', '🧸', '🧹', '🧽', '🧼', '🪣', '🗑️', '♻️', '🧺', '👕', '🧦', '👟', '🪟', '🛋️', '🚪', '📦',
    // kitchen & food
    '🍽️', '🍳', '🍝', '🥗', '🥦', '🥪', '🥘', '🍎', '💧', '🥛', '🧃',
    // errands & planning
    '🛒', '📝', '🧾', '🎁', '🦃', '🎄', '📸', '🖼️', '📅', '✉️', '💳',
    // fix, paint & yard
    '🎨', '🖌️', '🔧', '🧰', '🪜', '🌿', '🪴', '🌱', '🍂', '❄️', '🚗',
    // school & practice
    '🎒', '📚', '📖', '✏️', '💻', '🧮', '🎹', '🎻', '⚽', '🏃', '💪',
    // self-care & pets
    '🪥', '🚿', '🛁', '💇', '💊', '😴', '🐱', '🐕', '🐠', '🐹', '🐾',
  ];
  // Picks an icon from the chore's wording (used until someone picks one by hand)
  const CHORE_ICON_WORDS = [
    [/\b(paint|trim|baseboard|wall)/i, '🎨'], [/\b(fix|repair|tighten|screw)/i, '🔧'], [/\b(ladder|gutter|attic)/i, '🪜'],
    [/\b(pasta|spaghetti|noodle)/i, '🍝'], [/\b(broccoli|veggie|vegetable)/i, '🥦'], [/\b(salad)/i, '🥗'], [/\b(cook|make (dinner|lunch|breakfast)|bake)/i, '🍳'],
    [/\b(lunch ?bag|lunch ?box|sandwich|lunch)/i, '🥪'], [/\b(water|drink)/i, '💧'], [/\b(dish|dishwasher|table)/i, '🍽️'],
    [/\b(eucalyptus|greener|flower|plant|water the)/i, '🌿'], [/\b(costco|shopping|store|groceries|buy)\b/i, '🛒'], [/\b(list|plan|schedule)/i, '📝'], [/\b(thanksgiving|turkey)/i, '🦃'], [/\b(christmas|tree|ornament)/i, '🎄'],
    [/\b(photo|picture|album)/i, '🖼️'], [/\b(gift|present|wrap)/i, '🎁'], [/\b(mail|letter|card)/i, '✉️'], [/\b(bill|pay)/i, '💳'],
    [/\b(leaves|rake)/i, '🍂'], [/\b(snow|shovel)/i, '❄️'], [/\b(garden|weed|mow|lawn)/i, '🌱'],
    [/\b(toy)/i, '🧸'], [/\b(bed)\b/i, '🛏️'], [/\b(sweep|vacuum|clean)/i, '🧹'], [/\b(wipe|scrub|mop)/i, '🧽'], [/\b(trash|garbage)/i, '🗑️'], [/\b(recycl)/i, '♻️'],
    [/\b(laundry|wash clothes|fold)/i, '🧺'], [/\b(sock)/i, '🧦'], [/\b(shoe)/i, '👟'], [/\b(clothes|dress|outfit)/i, '👕'], [/\b(window)/i, '🪟'], [/\b(box|package|upstairs|downstairs|put away)/i, '📦'],
    [/\b(i-?ready|computer|laptop|ipad|online)/i, '💻'], [/\b(math)/i, '🧮'], [/\b(homework|worksheet|write|paper)/i, '✏️'], [/\b(read|book)/i, '📖'], [/\b(backpack|school bag)/i, '🎒'],
    [/\b(piano)/i, '🎹'], [/\b(violin|guitar|instrument)/i, '🎻'], [/\b(soccer|ball|practice)/i, '⚽'], [/\b(run|walk|exercise)/i, '🏃'], [/\b(workout|gym)/i, '💪'],
    [/\b(teeth|brush)/i, '🪥'], [/\b(shower)/i, '🚿'], [/\b(bath)/i, '🛁'], [/\b(hair)/i, '💇'], [/\b(vitamin|medicine|pill)/i, '💊'], [/\b(sleep|nap)/i, '😴'],
    [/\b(cat|litter)/i, '🐱'], [/\b(dog|walk the)/i, '🐕'], [/\b(fish|tank)/i, '🐠'], [/\b(hamster|guinea)/i, '🐹'], [/\b(pet|feed)/i, '🐾'], [/\b(car)\b/i, '🚗'],
  ];
  const choreIconFor = title => { for (const [re, e] of CHORE_ICON_WORDS) if (re.test(title || '')) return e; return ''; };
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
    health: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M7.5 12.5h2.6l1.4-2.6 2 4.6 1.3-2h1.7"/>',
    baby: '<circle cx="12" cy="11" r="7.5"/><path d="M9.2 10.2h.01M14.8 10.2h.01M9.6 13.6c1.3 1.1 3.5 1.1 4.8 0M12 3.5c-1 0-1.6.8-1.2 1.6"/><path d="M8 20.5c1.2.6 2.5 1 4 1s2.8-.4 4-1"/>',
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
      members: [], events: [], chores: [], choreDone: {}, lists: [], meals: {}, rewards: [], redemptions: [], icalFeeds: [], recipes: [], babies: [], babyLog: [], workouts: [], supplements: [], suppTaken: {}, illnesses: [], healthLog: [],
      hidden: [], gEvents: [], gSyncedAt: null, gAcctAt: {},
      settings: {
        weekStart: 0, use24h: false, screensaverMin: 10, dayStart: 7, dayEnd: 21, weather: null, tempUnit: 'fahrenheit', showMeals: true, babyEnabled: false, babyUnits: 'imperial', healthEnabled: true, newsEnabled: true, newsFeeds: [{ id: 'npr', name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' }, { id: 'bbcworld', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }], dinnerPresets: [], dinnerSeed: 0,
        google: { clientId: '', connected: false, accounts: [], calendars: {}, defaultCal: '' },
      },
      ui: { view: 'calendar', calView: 'week', listId: null, mealsTab: 'plan', textSize: 0.85 },
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
  // Carry-over: a chore missed on its day shows on the following days (up to today) until it's done,
  // unless "carry over" is switched off for it. Daily chores are already on every day, so they never pile up.
  function choreCarriedFrom(c, ds) {
    if (c.carry === false || choreOn(c, ds) || ds > todayStr()) return null;
    const start = c.created || ds;
    let d0 = null;
    for (let i = 1; i <= 14; i++) { const x = ymd(addDays(parse(ds), -i)); if (x < start) break; if (choreOn(c, x)) { d0 = x; break; } }
    if (!d0) return null;
    for (let x = d0; x < ds; x = ymd(addDays(parse(x), 1))) if ((state.choreDone[x] || {})[c.id]) return null;
    return d0;
  }
  // Chores for a person on a day: scheduled ones plus carried-over ones ({ c, from }).
  function choresDue(mid, ds) {
    const out = [];
    state.chores.forEach(c => { if (c.memberId !== mid) return; if (choreOn(c, ds)) out.push({ c, from: null }); else { const f = choreCarriedFrom(c, ds); if (f) out.push({ c, from: f }); } });
    return out;
  }
  function ensureChoreCreated() {
    let changed = false;
    state.chores.forEach(c => { if (!c.created) { c.created = todayStr(); changed = true; } });
    if (changed) save();
  }
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

  // ---------------------------------------------------------------- Google Calendar sync (several accounts)
  // Runs fully in the browser: Google Identity Services gives a short-lived access token per account,
  // and the Calendar REST API is called with fetch. No server, no refresh tokens.
  // Calendars are keyed "account|calendarId" so the same calendar can come from two accounts.
  const GOOGLE_CLIENT_ID = '639692840591-5n38eqpu4b4ldic333i7668ijuceb1iv.apps.googleusercontent.com';
  const G_SCOPE = 'https://www.googleapis.com/auth/calendar';
  const G_API = 'https://www.googleapis.com/calendar/v3';
  const G_TOKEN_KEY = 'calendora.gtokens';
  const g = { tokenClient: null, tokenClientId: '', tokens: {}, loading: null, syncing: false, error: '', pending: null };
  const gCfg = () => state.settings.google;
  const gClientId = () => (gCfg().clientId || GOOGLE_CLIENT_ID || '').trim();
  const gAccounts = () => (Array.isArray(gCfg().accounts) ? gCfg().accounts : []);
  const gHasToken = acct => { const t = g.tokens[acct]; return !!t && t.exp > Date.now() + 30000; };
  const gExpired = () => gAccounts().filter(a => !gHasToken(a));
  // Writable only when this device is signed in to that Google account (saved copies from other devices are view-only here).
  const gWritable = c => !!c && gAccounts().includes(c.acct) && (c.role === 'owner' || c.role === 'writer');
  const gKey = (acct, calId) => `${acct}|${calId}`;
  const enc = encodeURIComponent;
  const saveTokens = () => { try { localStorage.setItem(G_TOKEN_KEY, JSON.stringify(g.tokens)); } catch (e) { /* ignore */ } };

  // Load tokens, and move a single-account setup from earlier versions to the multi-account layout.
  (function gMigrate() {
    try { g.tokens = JSON.parse(localStorage.getItem(G_TOKEN_KEY) || '{}') || {}; } catch (e) { g.tokens = {}; }
    const G = gCfg();
    if (!Array.isArray(G.accounts)) G.accounts = [];
    if (!G.accounts.length && G.email) {
      {
        const acct = G.email;
        G.accounts = [acct];
        const cals = {};
        Object.entries(G.calendars || {}).forEach(([id, c]) => { cals[id.includes('|') ? id : gKey(acct, id)] = { ...c, acct, calId: id.includes('|') ? c.calId : id }; });
        G.calendars = cals;
        if (G.defaultCal && !G.defaultCal.includes('|')) G.defaultCal = gKey(acct, G.defaultCal);
        (state.gEvents || []).forEach(e => { if (!e.gacct) { e.gacct = acct; e.gcalId = e.gcal; e.gcal = gKey(acct, e.gcal); } });
        try { const old = JSON.parse(localStorage.getItem('calendora.gtoken') || 'null'); if (old && old.t) { g.tokens[acct] = { t: old.t, exp: old.exp }; saveTokens(); } } catch (e) { /* ignore */ }
      }
      try { localStorage.removeItem('calendora.gtoken'); } catch (e) { /* ignore */ }
    }
    G.connected = G.accounts.length > 0;
  })();

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
        if (p) p.res({ t: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000 });
      },
      error_callback: err => {
        const p = g.pending; g.pending = null;
        const msg = err && err.type === 'popup_closed' ? 'Google sign-in was closed' : err && err.type === 'popup_failed_to_open' ? 'Allow pop-ups for this site to sign in with Google' : 'Google sign-in failed';
        if (p) p.rej(new Error(msg));
      },
    });
  }
  // Ask Google for a token. acct = an existing account to refresh, or null to pick/add an account.
  // Must be started from a click so the browser allows the pop-up.
  async function gRequestToken(acct) {
    if (!gClientId()) throw new Error('Add your Google Client ID first');
    await gInitClient();
    return new Promise((res, rej) => {
      g.pending = { res, rej };
      g.tokenClient.requestAccessToken(acct ? { prompt: '', login_hint: acct } : { prompt: 'select_account consent' });
    });
  }
  // Find out which Google account a token belongs to (its primary calendar id is the account's email).
  async function gWhoAmI(tok) {
    const r = await fetch(`${G_API}/users/me/calendarList/primary`, { headers: { Authorization: `Bearer ${tok.t}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error('Could not read that Google account');
    return j.id;
  }
  async function gSignIn(acct) {
    const tok = await gRequestToken(acct || null);
    const who = await gWhoAmI(tok);
    g.tokens[who] = tok;
    saveTokens();
    if (!gAccounts().includes(who)) gCfg().accounts = [...gAccounts(), who];
    gCfg().connected = true;
    save({ localOnly: true });
    return who;
  }

  async function gFetch(acct, path, opts = {}) {
    if (!gHasToken(acct)) throw Object.assign(new Error(`${acct} needs to reconnect`), { auth: true });
    const headers = { Authorization: `Bearer ${g.tokens[acct].t}` };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(G_API + path, { ...opts, headers });
    if (r.status === 401) {
      delete g.tokens[acct]; saveTokens(); renderSyncPill();
      throw Object.assign(new Error(`${acct} needs to reconnect`), { auth: true });
    }
    if (r.status === 204 || r.status === 410) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || `Google error ${r.status}`);
    return j;
  }
  const htmlToText = s => (s ? (new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n'), 'text/html').body.textContent || '') : '');

  function gToLocal(ev, key) {
    if (!ev || ev.status === 'cancelled' || !ev.start) return null;
    const c = gCfg().calendars[key] || {};
    const base = {
      id: `g_${key}_${ev.id}`, source: 'google', gcal: key, gacct: c.acct, gcalId: c.calId, gid: ev.id, gseries: ev.recurringEventId || null,
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
    (state.gEvents || []).forEach(e => { const c = cals[e.gcal]; e.memberIds = c && c.memberId ? [c.memberId] : []; e.readOnly = !gWritable(c); });
  }
  function gVisible() {
    const cals = gCfg().calendars;
    return state.gEvents.filter(e => { const c = cals[e.gcal]; return c && c.on !== false; });
  }
  const allEvents = () => {
    const ge = state.gEvents && state.gEvents.length ? gVisible() : [];
    return ge.length || ical.flat.length ? state.events.concat(ge, ical.flat) : state.events;
  };

  async function gSyncAccount(acct, out) {
    const list = await gFetch(acct, '/users/me/calendarList?maxResults=250');
    const prev = gCfg().calendars;
    Object.keys(prev).forEach(k => { if (prev[k].acct === acct) delete prev[k]; });
    const fresh = {};
    (list.items || []).forEach(c => {
      const key = gKey(acct, c.id);
      fresh[key] = {
        acct, calId: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || '#8E8AA0', role: c.accessRole, primary: !!c.primary,
        on: g.prevCals[key] ? g.prevCals[key].on : !c.hidden && c.selected !== false, memberId: g.prevCals[key] ? g.prevCals[key].memberId : '',
      };
    });
    Object.assign(gCfg().calendars, fresh);
    const tMin = addDays(today(), -62).toISOString(), tMax = addDays(today(), 400).toISOString();
    for (const [key, c] of Object.entries(fresh)) {
      if (!c.on) continue;
      let pageToken = '';
      do {
        const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeMin: tMin, timeMax: tMax });
        if (pageToken) q.set('pageToken', pageToken);
        const j = await gFetch(acct, `/calendars/${enc(c.calId)}/events?${q}`);
        (j.items || []).forEach(ev => { const m = gToLocal(ev, key); if (m) out.push(m); });
        pageToken = j.nextPageToken || '';
      } while (pageToken);
    }
  }
  async function gSync({ quiet = false } = {}) {
    if (g.syncing || !gAccounts().length) return;
    const ready = gAccounts().filter(gHasToken);
    if (!ready.length) { renderSyncPill(); return; }
    g.syncing = true; g.error = ''; renderSyncPill();
    g.prevCals = { ...gCfg().calendars };
    // keep the last copy of accounts we can't reach right now
    const out = (state.gEvents || []).filter(e => !ready.includes(e.gacct));
    let n = 0;
    const problems = [];
    for (const acct of ready) {
      const before = out.length;
      try { await gSyncAccount(acct, out); n += out.length - before; (state.gAcctAt = state.gAcctAt || {})[acct] = Date.now(); gSnapQueue(acct); }
      catch (e) {
        problems.push(e.message);
        out.push(...(state.gEvents || []).filter(x => x.gacct === acct)); // keep its old events
      }
    }
    state.gEvents = out;
    state.gSyncedAt = Date.now();
    g.error = problems.join(' · ');
    g.syncing = false;
    save({ localOnly: true });
    renderView();
    renderSyncPill();
    if (!quiet) toast(problems.length ? problems[0] : `Synced ${n} Google event${n === 1 ? '' : 's'}`);
  }
  const calOf = key => gCfg().calendars[key];
  async function gEnsureToken(acct) { if (!gHasToken(acct)) { const who = await gSignIn(acct); if (who !== acct) throw new Error(`Please sign in as ${acct}`); } }
  async function gCreate(e, key) {
    const c = calOf(key); if (!c) throw new Error('That calendar is no longer connected');
    await gEnsureToken(c.acct);
    const body = localToG(e);
    const rr = toRRule(e);
    if (rr) body.recurrence = rr;
    const j = await gFetch(c.acct, `/calendars/${enc(c.calId)}/events`, { method: 'POST', body: JSON.stringify(body) });
    if (rr) await gSync({ quiet: true });
    else { const m = gToLocal(j, key); if (m) state.gEvents.push(m); save({ localOnly: true }); renderView(); }
    gSnapQueue(c.acct);
  }
  async function gUpdate(e) {
    const c = calOf(e.gcal); if (!c) throw new Error('That calendar is no longer connected');
    await gEnsureToken(c.acct);
    const j = await gFetch(c.acct, `/calendars/${enc(c.calId)}/events/${enc(e.gid)}`, { method: 'PATCH', body: JSON.stringify(localToG(e)) });
    const m = gToLocal(j, e.gcal);
    state.gEvents = state.gEvents.map(x => (x.id === e.id ? m : x)).filter(Boolean);
    save({ localOnly: true }); renderView(); gSnapQueue(c.acct);
  }
  async function gDelete(e, series) {
    const c = calOf(e.gcal); if (!c) throw new Error('That calendar is no longer connected');
    await gEnsureToken(c.acct);
    const target = series && e.gseries ? e.gseries : e.gid;
    await gFetch(c.acct, `/calendars/${enc(c.calId)}/events/${enc(target)}`, { method: 'DELETE' });
    state.gEvents = state.gEvents.filter(x => !(x.gcal === e.gcal && (series && e.gseries ? x.gseries === e.gseries || x.gid === e.gseries : x.id === e.id)));
    save({ localOnly: true }); renderView(); gSnapQueue(c.acct);
  }
  async function gConnect() {
    const inp = $('[data-g-client]');
    if (inp && inp.value.trim()) gCfg().clientId = inp.value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(gClientId())) { toast('That doesn’t look like a Google Client ID'); return; }
    try {
      const who = await gSignIn(null);
      toast(`Connected ${who}`);
      await gSync({ quiet: true });
      render();
    } catch (e) { toast(e.message); }
  }
  async function gReconnect(acct) {
    const target = acct || gExpired()[0];
    if (!target) { gSync(); return; }
    try {
      const who = await gSignIn(target);
      if (who !== target) toast(`That was ${who} — added it as another account`);
      else toast(`${who} reconnected`);
      renderSyncPill();
      await gSync({ quiet: true });
      if (state.ui.view === 'settings') renderView();
    } catch (e) { toast(e.message); }
  }
  function gDisconnect(acct) {
    const t = g.tokens[acct];
    try { if (t && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(t.t, () => {}); } catch (e) { /* ignore */ }
    delete g.tokens[acct]; saveTokens();
    const G = gCfg();
    G.accounts = gAccounts().filter(a => a !== acct);
    Object.keys(G.calendars).forEach(k => { if (G.calendars[k].acct === acct) delete G.calendars[k]; });
    if (G.defaultCal && !G.calendars[G.defaultCal]) G.defaultCal = '';
    G.connected = G.accounts.length > 0;
    state.gEvents = (state.gEvents || []).filter(e => e.gacct !== acct);
    if (state.gAcctAt) delete state.gAcctAt[acct];
    if (cloudOn()) api(`/api/snapshots/google/${enc(acct)}`, { method: 'DELETE' }).catch(() => {});
    delete g.snaps[acct];
    save({ localOnly: true }); render(); toast(`${acct} disconnected`);
  }
  // ---- saved copies: every sync uploads each account's events, so devices that aren't signed in to Google
  //      (or whose sign-in ran out) still show the calendar, and it updates whenever any device syncs.
  g.snaps = {}; g.snapSince = 0; g.snapTimers = {};
  function gSnapQueue(acct) {
    if (!cloudOn()) return;
    clearTimeout(g.snapTimers[acct]);
    g.snapTimers[acct] = setTimeout(() => gSnapPush(acct), 1500);
  }
  async function gSnapPush(acct) {
    const calendars = {};
    Object.entries(gCfg().calendars).forEach(([k, c]) => { if (c.acct === acct) calendars[k] = { ...c }; });
    const events = (state.gEvents || []).filter(e => e.gacct === acct).map(({ readOnly, memberIds, ...e }) => e);
    const syncedAt = (state.gAcctAt || {})[acct] || Date.now();
    try {
      const r = await api(`/api/snapshots/google/${enc(acct)}`, { method: 'PUT', body: JSON.stringify({ events, calendars, syncedAt }) });
      if (r.ok) g.snaps[acct] = { at: r.data.at, syncedAt, mine: true };
    } catch (e) { /* offline: the next sync tries again */ }
  }
  async function gSnapLoad() {
    if (!cloudOn() || !cloud.signedIn) return;
    let r;
    try { r = await api(`/api/snapshots?since=${g.snapSince}`); } catch (e) { return; }
    if (!r.ok || !r.data || !r.data.google) return;
    const server = r.data.google, G = gCfg(), local = gAccounts();
    let changed = false;
    Object.entries(server).forEach(([acct, sn]) => {
      g.snapSince = Math.max(g.snapSince, sn.at);
      if (sn.unchanged || !sn.data) return;
      const d = sn.data, mineAt = (state.gAcctAt || {})[acct] || 0;
      g.snaps[acct] = { at: sn.at, syncedAt: d.syncedAt };
      if (mineAt >= d.syncedAt) return; // this device has a newer copy of its own
      // calendars: take names/colours from the copy, keep this device's own show/hide and person choices
      Object.keys(G.calendars).forEach(k => { if (G.calendars[k].acct === acct && !d.calendars[k]) delete G.calendars[k]; });
      Object.entries(d.calendars || {}).forEach(([k, c]) => { const mine = G.calendars[k]; G.calendars[k] = mine && local.includes(acct) ? { ...c, on: mine.on, memberId: mine.memberId } : mine ? { ...c, on: mine.on, memberId: mine.memberId } : c; });
      state.gEvents = (state.gEvents || []).filter(e => e.gacct !== acct).concat(d.events || []);
      (state.gAcctAt = state.gAcctAt || {})[acct] = d.syncedAt;
      changed = true;
    });
    // an account removed everywhere: drop its saved copy here too (unless this device is signed in to it)
    Object.keys(state.gAcctAt || {}).forEach(acct => {
      if (server[acct] || local.includes(acct)) return;
      state.gEvents = (state.gEvents || []).filter(e => e.gacct !== acct);
      Object.keys(G.calendars).forEach(k => { if (G.calendars[k].acct === acct) delete G.calendars[k]; });
      delete state.gAcctAt[acct]; delete g.snaps[acct]; changed = true;
    });
    if (changed) { gRemap(); save({ localOnly: true }); renderView(); renderSyncPill(); }
  }
  const gCopyAccts = () => Object.keys(state.gAcctAt || {}).filter(a => !gAccounts().includes(a) && (state.gEvents || []).some(e => e.gacct === a));

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
    if (!gAccounts().length) {
      const copies = gCopyAccts();
      if (!copies.length) { el.hidden = true; return; }
      const at = Math.max(...copies.map(a => state.gAcctAt[a] || 0));
      el.hidden = false; el.className = 'sync-pill ok'; el.dataset.action = 'noop'; el.removeAttribute('data-acct');
      el.innerHTML = `<span class="gmark">G</span> Updated ${timeAgo(at)}`;
      el.title = 'Google Calendar copy saved by another family device. It refreshes whenever any device syncs.';
      return;
    }
    el.hidden = false;
    const expired = gExpired();
    if (g.syncing) { el.className = 'sync-pill busy'; el.innerHTML = '<span class="gmark">G</span> Syncing…'; el.dataset.action = 'noop'; return; }
    if (expired.length) {
      el.className = 'sync-pill warn';
      el.innerHTML = `<span class="gmark">G</span> Reconnect ${expired.length > 1 ? `${expired.length} Google accounts` : 'Google'}`;
      el.dataset.action = 'g-reconnect'; el.removeAttribute('data-acct');
      el.title = `Tap to reconnect ${expired[0]}`;
      return;
    }
    el.className = `sync-pill ${g.error ? 'warn' : 'ok'}`;
    el.innerHTML = `<span class="gmark">G</span> ${g.error ? 'Sync problem — retry' : state.gSyncedAt ? `Synced ${timeAgo(state.gSyncedAt)}` : 'Sync now'}`;
    el.dataset.action = 'g-sync';
    el.title = g.error || 'Sync with Google Calendar now';
  }

  // ---------------------------------------------------------------- baby tracker (off by default; Settings → Baby tracker)
  // Log entries live in the shared board: { id, babyId, type, start, end, ... } with times in ms.
  // A running timer is an entry whose end is null (sleep) or whose last nursing segment has no end.
  const BABY_TYPES = {
    feed: { icon: '🍼', label: 'Feed' }, sleep: { icon: '😴', label: 'Sleep' }, diaper: { icon: '🧷', label: 'Diaper' },
    pump: { icon: '🥛', label: 'Pump' }, growth: { icon: '📏', label: 'Growth' }, med: { icon: '💊', label: 'Medicine' },
    temp: { icon: '🌡️', label: 'Temp' }, note: { icon: '📝', label: 'Note' },
  };
  const bUI = { day: today(), babyId: null };
  const babies = () => state.babies || [];
  const blog = () => state.babyLog || [];
  const curBaby = () => babies().find(b => b.id === (bUI.babyId || state.ui.babyId)) || babies()[0] || null;
  const MIN = 60000, HOUR = 3600000;
  const dur = ms => { ms = Math.max(0, ms); if (ms < MIN) return `${Math.floor(ms / 1000)}s`; const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / MIN); return h ? `${h}h ${m}m` : `${m}m`; };
  const clock = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
  const ago = ms => (Date.now() - ms < MIN ? 'just now' : `${dur(Date.now() - ms)} ago`);
  const hmOf = ms => { const d = new Date(ms); return fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); };
  const toLocalInput = ms => { const d = new Date(ms); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromLocalInput = v => { const [d, t] = String(v || '').split('T'); if (!d || !t) return Date.now(); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi).getTime(); };
  const imperial = () => (state.settings.babyUnits || 'imperial') === 'imperial';
  const volUnit = () => (imperial() ? 'oz' : 'ml');
  function ageText(birth) {
    if (!birth) return '';
    const b = parse(birth), t = today();
    const days = daysBetween(b, t);
    if (days < 0) return 'not born yet';
    if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
    if (days < 70) return `${Math.floor(days / 7)} weeks old`;
    let months = (t.getFullYear() - b.getFullYear()) * 12 + t.getMonth() - b.getMonth() - (t.getDate() < b.getDate() ? 1 : 0);
    if (months < 24) return `${months} months old`;
    return `${Math.floor(months / 12)} years ${months % 12 ? `${months % 12} mo` : ''} old`;
  }
  // Very rough, general wake-window ranges by age (minutes). Shown as a guide only.
  function wakeWindow(birth) {
    if (!birth) return null;
    const m = daysBetween(parse(birth), today()) / 30.4;
    const table = [[1, 35, 60], [2, 60, 90], [3, 75, 105], [5, 90, 150], [7, 120, 180], [10, 150, 210], [14, 180, 240], [19, 240, 330], [36, 300, 360]];
    const row = table.find(r => m < r[0]);
    return row ? { min: row[1], max: row[2] } : null;
  }
  const segOpen = e => e.segs && e.segs.length && !e.segs[e.segs.length - 1].to;
  const isRunning = e => (e.type === 'sleep' && !e.end) || (e.type === 'feed' && e.kind === 'breast' && !e.end);
  const feedMs = e => (e.segs || []).reduce((a, s) => a + ((s.to || Date.now()) - s.from), 0);
  const sideMs = (e, side) => (e.segs || []).filter(s => s.side === side).reduce((a, s) => a + ((s.to || Date.now()) - s.from), 0);
  function entryText(e) {
    const u = e.unit || volUnit();
    switch (e.type) {
      case 'feed':
        if (e.kind === 'bottle') return `Bottle ${e.amount || '?'} ${u}${e.milk ? ` · ${e.milk}` : ''}`;
        if (e.kind === 'solids') return `Solids${e.food ? `: ${e.food}` : ''}${e.amount ? ` · ${e.amount}` : ''}`;
        { const L = sideMs(e, 'L'), R = sideMs(e, 'R'); return `Nursed ${dur(feedMs(e))}${L || R ? ` (${[L && `L ${dur(L)}`, R && `R ${dur(R)}`].filter(Boolean).join(' · ')})` : ''}`; }
      case 'sleep': return e.end ? `Slept ${dur(e.end - e.start)}` : 'Sleeping';
      case 'diaper': return `Diaper · ${{ wet: 'Wet', dirty: 'Dirty', mixed: 'Wet + dirty', dry: 'Dry' }[e.kind] || e.kind}`;
      case 'pump': return `Pumped ${[e.left && `L ${e.left}`, e.right && `R ${e.right}`].filter(Boolean).join(' · ') || e.amount || ''} ${u}`;
      case 'growth': return ['weight', 'length', 'head'].filter(k => e[k]).map(k => `${{ weight: 'Weight', length: 'Length', head: 'Head' }[k]} ${e[k]} ${k === 'weight' ? (imperial() ? 'lb' : 'kg') : imperial() ? 'in' : 'cm'}`).join(' · ') || 'Growth';
      case 'med': return `${e.name || 'Medicine'}${e.dose ? ` · ${e.dose}` : ''}`;
      case 'temp': return `${e.value || '?'} °${imperial() ? 'F' : 'C'}`;
      default: return e.text || 'Note';
    }
  }
  function overlapMs(a, b, from, to) { return Math.max(0, Math.min(b, to) - Math.max(a, from)); }
  function dayStats(babyId, ds) {
    const from = parse(ds).getTime(), to = from + 24 * HOUR;
    const L = blog().filter(e => e.babyId === babyId);
    const inDay = L.filter(e => e.start >= from && e.start < to);
    const sleeps = L.filter(e => e.type === 'sleep');
    const sleepMs = sleeps.reduce((a, e) => a + overlapMs(e.start, e.end || Date.now(), from, to), 0);
    const feeds = inDay.filter(e => e.type === 'feed');
    const bottleVol = feeds.filter(e => e.kind === 'bottle').reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const diapers = inDay.filter(e => e.type === 'diaper');
    return {
      sleepMs, naps: sleeps.filter(e => e.start >= from && e.start < to).length, feeds: feeds.length, bottleVol,
      nurseMs: feeds.filter(e => e.kind === 'breast').reduce((a, e) => a + feedMs(e), 0),
      wet: diapers.filter(e => e.kind === 'wet' || e.kind === 'mixed').length, dirty: diapers.filter(e => e.kind === 'dirty' || e.kind === 'mixed').length,
    };
  }

  function renderBaby() {
    const b = curBaby();
    const dsel = bUI.day, ds = ymd(dsel), isToday = ds === todayStr();
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous day">${icon('left')}</button>
        <button class="btn" data-action="today">Today</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next day">${icon('right')}</button>
      </div>
      <h1>${b ? esc(b.name) : 'Baby'} <span class="muted">${isToday ? 'Today' : `${DOW[dsel.getDay()]} ${MON[dsel.getMonth()]} ${dsel.getDate()}`}</span></h1>
      ${babies().length > 1 ? `<div class="seg">${babies().map(x => `<button class="${b && b.id === x.id ? 'on' : ''}" data-action="pick-baby" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
      <span class="spacer"></span>
      <button class="btn" data-action="baby-edit">${icon(b ? 'edit' : 'plus')} ${b ? 'Baby details' : 'Add baby'}</button>`;
    if (!b) {
      $('#view').innerHTML = `<div class="empty card"><div style="font-size:52px">👶</div><p>Add your baby to start tracking feeds, sleep and diapers.</p><button class="btn primary" data-action="baby-edit">${icon('plus')} Add baby</button></div>`;
      return;
    }
    const L = blog().filter(e => e.babyId === b.id);
    const lastFeed = L.filter(e => e.type === 'feed').sort((x, y) => y.start - x.start)[0];
    const sleeping = L.find(e => e.type === 'sleep' && !e.end);
    const lastSleep = L.filter(e => e.type === 'sleep' && e.end).sort((x, y) => y.end - x.end)[0];
    const nursing = L.find(e => e.type === 'feed' && e.kind === 'breast' && !e.end);
    const lastBreast = L.filter(e => e.type === 'feed' && e.kind === 'breast' && e.segs && e.segs.length).sort((x, y) => y.start - x.start)[0];
    const nextSide = lastBreast ? (lastBreast.segs[lastBreast.segs.length - 1].side === 'L' ? 'R' : 'L') : null;
    const lastDiaper = L.filter(e => e.type === 'diaper').sort((x, y) => y.start - x.start)[0];
    const st = dayStats(b.id, ds);
    const ww = wakeWindow(b.birth);
    let napHint = '';
    if (!sleeping && lastSleep && ww) {
      const from = lastSleep.end + ww.min * MIN, to = lastSleep.end + ww.max * MIN;
      napHint = Date.now() > to ? 'Past the usual wake window' : `${hmOf(from)} – ${hmOf(to)}`;
    }
    const timers = [];
    if (nursing) {
      const open = segOpen(nursing), side = open ? nursing.segs[nursing.segs.length - 1].side : null;
      timers.push(`<div class="b-timer feed">
        <div class="bt-main"><span class="bt-icon">🤱</span><div><b>Nursing ${open ? `· ${side === 'L' ? 'Left' : 'Right'}` : '· paused'}</b>
          <div class="bt-sub">L <span data-tick-side="L" data-id="${nursing.id}">${clock(sideMs(nursing, 'L'))}</span> · R <span data-tick-side="R" data-id="${nursing.id}">${clock(sideMs(nursing, 'R'))}</span></div></div>
          <span class="bt-clock" data-tick-feed="${nursing.id}">${clock(feedMs(nursing))}</span></div>
        <div class="bt-actions">
          <button class="btn ${open && side === 'L' ? 'primary' : ''}" data-action="nurse-side" data-side="L">Left</button>
          <button class="btn ${open && side === 'R' ? 'primary' : ''}" data-action="nurse-side" data-side="R">Right</button>
          ${open ? '<button class="btn" data-action="nurse-pause">Pause</button>' : ''}
          <button class="btn primary" data-action="nurse-stop">Done</button>
        </div></div>`);
    }
    if (sleeping) {
      timers.push(`<div class="b-timer sleep">
        <div class="bt-main"><span class="bt-icon">😴</span><div><b>Sleeping</b><div class="bt-sub">since ${hmOf(sleeping.start)}</div></div>
          <span class="bt-clock" data-tick-since="${sleeping.start}">${clock(Date.now() - sleeping.start)}</span></div>
        <div class="bt-actions"><button class="btn primary" data-action="sleep-stop">Woke up</button></div></div>`);
    }
    const quick = [
      ['nurse', '🤱', nursing ? 'Nursing…' : `Nurse${nextSide ? ` · start ${nextSide === 'L' ? 'left' : 'right'}` : ''}`],
      ['bottle', '🍼', 'Bottle'], ['solids', '🥣', 'Solids'],
      ['sleep', '😴', sleeping ? 'Woke up' : 'Sleep'], ['diaper', '🧷', 'Diaper'], ['pump', '🥛', 'Pump'],
      ['growth', '📏', 'Growth'], ['med', '💊', 'Medicine'], ['temp', '🌡️', 'Temp'], ['note', '📝', 'Note'],
    ];
    const entries = L.filter(e => { const from = parse(ds).getTime(); return (e.start >= from && e.start < from + 24 * HOUR) || (e.type === 'sleep' && e.start < from && (e.end || Date.now()) > from); }).sort((x, y) => y.start - x.start);
    // 7-day trend
    const days7 = [6, 5, 4, 3, 2, 1, 0].map(i => { const d = addDays(dsel, -i); return { d, s: dayStats(b.id, ymd(d)) }; });
    const maxSleep = Math.max(HOUR, ...days7.map(x => x.s.sleepMs)), maxFeeds = Math.max(1, ...days7.map(x => x.s.feeds));
    const bars = (key, max, fmt) => days7.map(x => `<div class="bar-col ${ymd(x.d) === ds ? 'sel' : ''}"><div class="bar" style="height:${Math.round(x.s[key] / max * 100)}%"></div><span class="bar-v">${fmt(x.s[key])}</span><span class="bar-d">${DOW[x.d.getDay()][0]}</span></div>`).join('');
    $('#view').innerHTML = `<div class="baby" style="--c:${b.color || '#9B6BDF'}">
      <div class="b-cards">
        <div class="b-card"><span class="bc-ic">🍼</span><div><div class="bc-k">Last fed</div><div class="bc-v" ${lastFeed ? `data-tick-ago="${lastFeed.end || lastFeed.start}"` : ''}>${lastFeed ? ago(lastFeed.end || lastFeed.start) : '—'}</div><div class="bc-s">${lastFeed ? esc(entryText(lastFeed)) : 'No feeds yet'}${nextSide ? ` · next: ${nextSide === 'L' ? 'left' : 'right'}` : ''}</div></div></div>
        <div class="b-card"><span class="bc-ic">${sleeping ? '😴' : '🌤️'}</span><div><div class="bc-k">${sleeping ? 'Asleep for' : 'Awake for'}</div><div class="bc-v" ${sleeping ? `data-tick-dur="${sleeping.start}"` : lastSleep ? `data-tick-dur="${lastSleep.end}"` : ''}>${sleeping ? dur(Date.now() - sleeping.start) : lastSleep ? dur(Date.now() - lastSleep.end) : '—'}</div><div class="bc-s">${napHint ? `Next sleep around ${napHint}` : lastSleep ? `Last sleep ${dur(lastSleep.end - lastSleep.start)}` : 'Log a sleep to see wake windows'}</div></div></div>
        <div class="b-card"><span class="bc-ic">🧷</span><div><div class="bc-k">Diapers ${isToday ? 'today' : ''}</div><div class="bc-v">${st.wet} wet · ${st.dirty} dirty</div><div class="bc-s">${lastDiaper ? `Last change ${ago(lastDiaper.start)}` : 'No changes logged'}</div></div></div>
        <div class="b-card"><span class="bc-ic">📊</span><div><div class="bc-k">${isToday ? 'Today' : 'This day'}</div><div class="bc-v">${st.feeds} feeds · ${dur(st.sleepMs)} sleep</div><div class="bc-s">${[st.nurseMs && `nursed ${dur(st.nurseMs)}`, st.bottleVol && `${Math.round(st.bottleVol * 10) / 10} ${volUnit()} bottle`, `${st.naps} sleeps`].filter(Boolean).join(' · ')}</div></div></div>
      </div>
      ${timers.join('')}
      <div class="b-quick">${quick.map(([k, ic, l]) => `<button class="bq" data-action="baby-log" data-kind="${k}"><span>${ic}</span>${esc(l)}</button>`).join('')}</div>
      <div class="b-lower">
        <div class="b-timeline card"><h3>${isToday ? 'Today' : 'Log'}</h3>
          ${entries.length ? entries.map(e => `<div class="b-entry ${isRunning(e) ? 'running' : ''}" data-action="baby-entry" data-id="${e.id}">
            <span class="be-time">${hmOf(e.start)}</span><span class="be-ic">${(e.type === 'feed' && e.kind === 'breast') ? '🤱' : e.type === 'feed' && e.kind === 'solids' ? '🥣' : BABY_TYPES[e.type].icon}</span>
            <span class="be-text">${esc(entryText(e))}${e.type === 'sleep' && e.end ? ` <small class="muted">${hmOf(e.start)}–${hmOf(e.end)}</small>` : ''}${e.notes ? `<small class="muted be-note">${esc(e.notes)}</small>` : ''}</span>
          </div>`).join('') : '<div class="empty-sm">Nothing logged yet — use the buttons above.</div>'}
        </div>
        <div class="b-trends card"><h3>Last 7 days</h3>
          <div class="trend"><div class="trend-k">Sleep</div><div class="bars">${bars('sleepMs', maxSleep, v => (v ? `${Math.round(v / HOUR * 10) / 10}h` : ''))}</div></div>
          <div class="trend"><div class="trend-k">Feeds</div><div class="bars">${bars('feeds', maxFeeds, v => v || '')}</div></div>
          ${ww ? `<p class="muted small">Wake-window guide for ${esc(ageText(b.birth))}: about ${dur(ww.min * MIN)}–${dur(ww.max * MIN)}. Every baby is different — this is a general guide, not medical advice.</p>` : ''}
        </div>
      </div></div>`;
  }
  function tickBaby() {
    if (state.ui.view !== 'baby') return;
    const now = Date.now();
    $$('[data-tick-since]').forEach(el => { el.textContent = clock(now - Number(el.dataset.tickSince)); });
    $$('[data-tick-dur]').forEach(el => { el.textContent = dur(now - Number(el.dataset.tickDur)); });
    $$('[data-tick-ago]').forEach(el => { el.textContent = ago(Number(el.dataset.tickAgo)); });
    $$('[data-tick-feed]').forEach(el => { const e = blog().find(x => x.id === el.dataset.tickFeed); if (e) el.textContent = clock(feedMs(e)); });
    $$('[data-tick-side]').forEach(el => { const e = blog().find(x => x.id === el.dataset.id); if (e) el.textContent = clock(sideMs(e, el.dataset.tickSide)); });
  }

  const addLog = e => { state.babyLog = [...blog(), { id: uid(), babyId: curBaby().id, ...e }]; save(); renderView(); };
  const updLog = (id, patch) => { state.babyLog = blog().map(e => (e.id === id ? { ...e, ...patch } : e)); save(); renderView(); };
  const runningFeed = () => blog().find(e => e.babyId === curBaby().id && e.type === 'feed' && e.kind === 'breast' && !e.end);
  const runningSleep = () => blog().find(e => e.babyId === curBaby().id && e.type === 'sleep' && !e.end);
  function nurseSide(side) {
    const now = Date.now(), f = runningFeed();
    if (!f) { addLog({ type: 'feed', kind: 'breast', start: now, end: null, segs: [{ side, from: now, to: null }] }); return; }
    const segs = f.segs.map(s => (s.to ? s : { ...s, to: now }));
    const last = f.segs[f.segs.length - 1];
    if (!last.to && last.side === side) return;
    segs.push({ side, from: now, to: null });
    updLog(f.id, { segs });
  }
  function nursePause() { const f = runningFeed(); if (f) updLog(f.id, { segs: f.segs.map(s => (s.to ? s : { ...s, to: Date.now() })) }); }
  function nurseStop() {
    const f = runningFeed(); if (!f) return;
    const now = Date.now(), segs = f.segs.map(s => (s.to ? s : { ...s, to: now }));
    updLog(f.id, { segs, end: segs.length ? segs[segs.length - 1].to : now });
    toast(`Nursed ${dur(segs.reduce((a, s) => a + s.to - s.from, 0))}`);
  }

  function babyEntryModal(kind, entry) {
    const b = curBaby(); if (!b) return;
    const e = entry || {};
    const isNew = !entry;
    const t = e.start || Date.now();
    const timeField = (name, label, ms) => `<label class="field"><span>${label}</span><input type="datetime-local" name="${name}" value="${toLocalInput(ms)}"></label>`;
    const seg = (name, opts, cur) => `<div class="seg wide">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    const u = volUnit();
    let title = '', body = '';
    const type = entry ? entry.type : { nurse: 'feed', bottle: 'feed', solids: 'feed' }[kind] || kind;
    const sub = entry ? entry.kind : kind;
    if (type === 'feed' && sub === 'breast' || kind === 'nurse') {
      title = 'Nursing';
      const L = entry ? Math.round(sideMs(entry, 'L') / MIN) : '', R = entry ? Math.round(sideMs(entry, 'R') / MIN) : '';
      body = `${isNew ? '<p class="muted">Start a timer, or enter a feed that already happened.</p><div class="row"><button type="button" class="btn primary block" data-start="L">▶ Start left</button><button type="button" class="btn primary block" data-start="R">▶ Start right</button></div><hr class="soft">' : ''}
        ${timeField('start', 'Started', t)}
        <div class="row"><label class="field"><span>Left (minutes)</span><input type="number" name="L" min="0" max="240" value="${L}"></label><label class="field"><span>Right (minutes)</span><input type="number" name="R" min="0" max="240" value="${R}"></label></div>`;
    } else if (type === 'feed' && (sub === 'bottle')) {
      title = 'Bottle';
      body = `${timeField('start', 'Time', t)}<label class="field"><span>Amount (${u})</span><input type="number" name="amount" step="0.5" min="0" value="${esc(e.amount || '')}" autofocus></label>
        <div class="field"><span>Milk</span>${seg('milk', [['Breast milk', 'Breast milk'], ['Formula', 'Formula'], ['Mixed', 'Mixed']], e.milk || 'Formula')}</div>`;
    } else if (type === 'feed') {
      title = 'Solids';
      body = `${timeField('start', 'Time', t)}<label class="field"><span>Food</span><input name="food" value="${esc(e.food || '')}" placeholder="e.g. banana, oatmeal" autofocus></label>
        <label class="field"><span>Amount</span><input name="amount" value="${esc(e.amount || '')}" placeholder="e.g. 2 tbsp"></label>
        <div class="field"><span>Reaction</span>${seg('reaction', [['', 'None'], ['Loved it', 'Loved it'], ['Disliked', 'Disliked'], ['Allergy?', 'Allergy?']], e.reaction || '')}</div>`;
    } else if (type === 'sleep') {
      title = 'Sleep';
      body = `${isNew ? '<button type="button" class="btn primary block" data-sleep-now>▶ Start sleep timer now</button><hr class="soft"><p class="muted">Or log a sleep that already happened:</p>' : ''}
        ${timeField('start', 'Fell asleep', e.start || Date.now() - HOUR)}${timeField('end', 'Woke up', e.end || Date.now())}`;
    } else if (type === 'diaper') {
      title = 'Diaper';
      body = `${timeField('start', 'Time', t)}<div class="field"><span>Type</span>${seg('kind', [['wet', '💧 Wet'], ['dirty', '💩 Dirty'], ['mixed', 'Both'], ['dry', 'Dry']], e.kind || 'wet')}</div>`;
    } else if (type === 'pump') {
      title = 'Pumping';
      body = `${timeField('start', 'Time', t)}<div class="row"><label class="field"><span>Left (${u})</span><input type="number" step="0.5" min="0" name="left" value="${esc(e.left || '')}"></label><label class="field"><span>Right (${u})</span><input type="number" step="0.5" min="0" name="right" value="${esc(e.right || '')}"></label></div>`;
    } else if (type === 'growth') {
      title = 'Growth';
      const wu = imperial() ? 'lb' : 'kg', lu = imperial() ? 'in' : 'cm';
      body = `${timeField('start', 'Date', t)}<div class="row"><label class="field"><span>Weight (${wu})</span><input type="number" step="0.01" min="0" name="weight" value="${esc(e.weight || '')}"></label>
        <label class="field"><span>Length (${lu})</span><input type="number" step="0.1" min="0" name="length" value="${esc(e.length || '')}"></label>
        <label class="field"><span>Head (${lu})</span><input type="number" step="0.1" min="0" name="head" value="${esc(e.head || '')}"></label></div>`;
    } else if (type === 'med') {
      title = 'Medicine';
      body = `${timeField('start', 'Time', t)}<label class="field"><span>Medicine</span><input name="name" value="${esc(e.name || '')}" placeholder="e.g. vitamin D drops" autofocus></label>
        <label class="field"><span>Dose</span><input name="dose" value="${esc(e.dose || '')}" placeholder="as given"></label>`;
    } else if (type === 'temp') {
      title = 'Temperature';
      body = `${timeField('start', 'Time', t)}<label class="field"><span>Temperature (°${imperial() ? 'F' : 'C'})</span><input type="number" step="0.1" name="value" value="${esc(e.value || '')}" autofocus></label>`;
    } else {
      title = 'Note';
      body = `${timeField('start', 'Time', t)}<label class="field"><span>Note</span><textarea name="text" rows="3" autofocus>${esc(e.text || '')}</textarea></label>`;
    }
    if (type !== 'note') body += `<label class="field"><span>Notes <small class="muted">(optional)</small></span><input name="notes" value="${esc(e.notes || '')}"></label>`;
    modal({
      title: `${isNew ? '' : 'Edit · '}${title}`,
      body,
      onOpen(form) {
        $$('[data-start]', form).forEach(x => x.addEventListener('click', () => { closeModal(); nurseSide(x.dataset.start); }));
        const sn = $('[data-sleep-now]', form);
        if (sn) sn.addEventListener('click', () => { closeModal(); if (!runningSleep()) addLog({ type: 'sleep', start: Date.now(), end: null }); });
      },
      onSave(form) {
        const v = n => (form.elements[n] ? form.elements[n].value.trim() : '');
        const r = n => fall(form, n)[0] || '';
        const start = fromLocalInput(v('start'));
        let out = { type, start, notes: v('notes') };
        if (type === 'feed' && (sub === 'breast' || kind === 'nurse')) {
          const L = Number(v('L')) || 0, R = Number(v('R')) || 0;
          if (!L && !R) { toast('Enter minutes for at least one side'); return false; }
          const segs = []; let at = start;
          if (L) { segs.push({ side: 'L', from: at, to: at + L * MIN }); at += L * MIN; }
          if (R) { segs.push({ side: 'R', from: at, to: at + R * MIN }); at += R * MIN; }
          out = { ...out, kind: 'breast', segs, end: at };
        } else if (type === 'feed' && sub === 'bottle') out = { ...out, kind: 'bottle', amount: v('amount'), unit: volUnit(), milk: r('milk') };
        else if (type === 'feed') out = { ...out, kind: 'solids', food: v('food'), amount: v('amount'), reaction: r('reaction') };
        else if (type === 'sleep') { const end = fromLocalInput(v('end')); if (end <= start) { toast('Wake-up time must be after falling asleep'); return false; } out.end = end; }
        else if (type === 'diaper') out.kind = r('kind') || 'wet';
        else if (type === 'pump') out = { ...out, left: v('left'), right: v('right'), unit: volUnit() };
        else if (type === 'growth') out = { ...out, weight: v('weight'), length: v('length'), head: v('head') };
        else if (type === 'med') out = { ...out, name: v('name'), dose: v('dose') };
        else if (type === 'temp') out.value = v('value');
        else out.text = v('text');
        if (isNew) addLog(out); else updLog(entry.id, out);
      },
      onDelete: isNew ? null : () => { state.babyLog = blog().filter(x => x.id !== entry.id); save(); renderView(); toast('Entry deleted'); },
    });
  }

  function babyProfileModal(b) {
    const isNew = !b;
    const bb = b ? { ...b } : { id: uid(), name: '', birth: '', color: '#9B6BDF' };
    modal({
      title: isNew ? 'Add baby' : `${esc(bb.name)}`,
      body: `<label class="field"><span>Name</span><input name="name" value="${esc(bb.name)}" autofocus maxlength="30"></label>
        <label class="field"><span>Birthday</span><input type="date" name="birth" value="${esc(bb.birth)}"></label>
        <div class="field"><span>Color</span><div class="color-pick">${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === bb.color ? 'checked' : ''}><span style="--c:${c}"></span></label>`).join('')}</div></div>`,
      onSave(form) {
        const name = fval(form, 'name');
        if (!name) { form.elements.name.classList.add('invalid'); return false; }
        const out = { ...bb, name, birth: fval(form, 'birth'), color: fall(form, 'color')[0] || bb.color };
        state.babies = isNew ? [...babies(), out] : babies().map(x => (x.id === out.id ? out : x));
        state.ui.babyId = out.id; bUI.babyId = out.id;
        save(); renderView();
      },
      onDelete: isNew ? null : () => {
        choice(`Remove ${esc(bb.name)}?`, 'This deletes the baby and every logged feed, sleep and diaper for them.', [{ label: 'Continue', cls: 'danger', fn: () => confirmTyped(`Delete ${bb.name}’s log?`, `${bb.name}’s whole log`, () => {
          state.babies = babies().filter(x => x.id !== bb.id); state.babyLog = blog().filter(e => e.babyId !== bb.id); bUI.babyId = null; save(); renderView();
        }) }]);
        return false;
      },
    });
  }

  // ---------------------------------------------------------------- health (workouts, vitamins, sick log)
  // workouts: { id, memberId, date, time, type, minutes, notes }
  // supplements: { id, memberId, name, dose, time, days: [0-6] (empty = every day), active }
  // suppTaken: { 'suppId|YYYY-MM-DD': ms }
  // illnesses: { id, memberId, name, start (ymd), end (ymd|null), notes }
  // healthLog: { id, illnessId, memberId, type: 'med'|'temp'|'symptom', at (ms), name, dose, everyH, value, text }
  const WORKOUTS = [['Strength', '🏋️'], ['Cardio', '❤️'], ['Run', '🏃'], ['Walk', '🚶'], ['Cycling', '🚴'], ['Swim', '🏊'], ['Yoga', '🧘'], ['HIIT', '🔥'], ['Sports', '⚽'], ['Class', '🤸'], ['Other', '💪']];
  const workIcon = t => (WORKOUTS.find(w => w[0] === t) || ['', '💪'])[1];
  const hUI = { day: today(), who: '' };
  const hArr = k => state[k] || [];
  const hWho = m => !hUI.who || m === hUI.who;
  const tempU = () => (state.settings.tempUnit === 'celsius' ? 'C' : 'F');
  const suppDue = (s, d) => s.active !== false && (!s.days || !s.days.length || s.days.includes(d.getDay()));
  const hmNow = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };
  const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function renderHealth() {
    const d = hUI.day, ds = ymd(d), isToday = ds === todayStr();
    const ws = startOfWeek(d), we = addDays(ws, 6);
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous day">${icon('left')}</button>
        <button class="btn" data-action="today">Today</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next day">${icon('right')}</button>
      </div>
      <h1>Health <span class="muted">${isToday ? 'Today' : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`}</span></h1>
      <span class="spacer"></span>
      <div class="h-who"><button class="hchip ${!hUI.who ? 'on' : ''}" data-action="h-who" data-id="">Everyone</button>${state.members.map(m => `<button class="hchip ${hUI.who === m.id ? 'on' : ''}" data-action="h-who" data-id="${m.id}" style="--c:${m.color}">${avatar(m, 'xs')}${esc(m.name)}</button>`).join('')}</div>`;

    // vitamins
    const supps = hArr('supplements').filter(s => hWho(s.memberId) && suppDue(s, d)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const taken = state.suppTaken || {};
    const doneN = supps.filter(s => taken[`${s.id}|${ds}`]).length;
    const vit = `<section class="card h-card"><div class="h-head"><h3>💊 Vitamins & daily meds</h3><span class="muted">${supps.length ? `${doneN}/${supps.length} taken` : ''}</span><span class="spacer"></span><button class="btn small" data-action="h-supp">${icon('plus')} Add</button></div>
      ${supps.length ? supps.map(s => { const m = memberById(s.memberId), t = taken[`${s.id}|${ds}`]; const late = !t && isToday && s.time && s.time < hmNow();
        return `<div class="h-supp ${t ? 'done' : ''} ${late ? 'late' : ''}">
          <button class="h-check" data-action="h-take" data-id="${s.id}" aria-label="Mark taken">${t ? '✓' : ''}</button>
          ${avatar(m, 'xs')}<div class="hs-main"><b>${esc(s.name)}</b><small class="muted">${esc([m ? m.name : '', s.dose, s.time ? fmtTime(s.time) : 'any time'].filter(Boolean).join(' · '))}</small></div>
          <span class="hs-status">${t ? `Taken ${hmOf(t)}` : late ? 'Due' : ''}</span>
          <button class="icon-btn flat" data-action="h-supp" data-id="${s.id}" aria-label="Edit">${icon('edit')}</button></div>`; }).join('')
        : `<div class="empty-sm">Nothing scheduled${hUI.who ? ' for this person' : ''}. Add something like “Vitamin D · every day · 8:00am”.</div>`}
      ${(() => { const off = hArr('supplements').filter(s => hWho(s.memberId) && !suppDue(s, d)); return off.length ? `<p class="muted small">Not due ${isToday ? 'today' : 'this day'}: ${off.map(s => `<a href="#" data-action="h-supp" data-id="${s.id}">${esc(s.name)}</a>`).join(', ')}</p>` : ''; })()}
    </section>`;

    // sick log
    const ill = hArr('illnesses').filter(i => hWho(i.memberId));
    const active = ill.filter(i => !i.end).sort((a, b) => b.start.localeCompare(a.start));
    const past = ill.filter(i => i.end).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 6);
    const logOf = id => hArr('healthLog').filter(l => l.illnessId === id).sort((a, b) => b.at - a.at);
    const illCard = i => {
      const m = memberById(i.memberId), L = logOf(i.id);
      const meds = {}; L.filter(l => l.type === 'med').forEach(l => { if (!meds[l.name]) meds[l.name] = l; });
      const due = Object.values(meds).filter(l => l.everyH).map(l => { const next = l.at + l.everyH * HOUR; return `<span class="h-due ${next <= Date.now() ? 'ok' : ''}">${esc(l.name)}: ${next <= Date.now() ? 'next dose OK now' : `next dose ${hmOf(next)}`}</span>`; });
      const lastTemp = L.find(l => l.type === 'temp');
      const day = daysBetween(parse(i.start), today()) + 1;
      return `<div class="h-ill" style="--c:${m ? m.color : '#999'}">
        <div class="hi-head">${avatar(m, 'sm')}<div><b>${esc(i.name)}</b><small class="muted">${esc(m ? m.name : '')} · ${i.end ? `${MON[parse(i.start).getMonth()]} ${parse(i.start).getDate()} – ${MON[parse(i.end).getMonth()]} ${parse(i.end).getDate()}` : `day ${day}, since ${MON[parse(i.start).getMonth()]} ${parse(i.start).getDate()}`}${lastTemp ? ` · last temp ${esc(lastTemp.value)}°${tempU()}` : ''}</small></div>
          <span class="spacer"></span><button class="icon-btn flat" data-action="h-ill" data-id="${i.id}" aria-label="Edit">${icon('edit')}</button></div>
        ${due.length ? `<div class="h-dues">${due.join('')}</div>` : ''}
        ${i.end ? '' : `<div class="hi-actions"><button class="btn small" data-action="h-log" data-ill="${i.id}" data-type="med">💊 Medicine</button><button class="btn small" data-action="h-log" data-ill="${i.id}" data-type="temp">🌡️ Temp</button><button class="btn small" data-action="h-log" data-ill="${i.id}" data-type="symptom">📝 Symptom</button><button class="btn small primary" data-action="h-recover" data-id="${i.id}">Recovered</button></div>`}
        ${L.length ? `<div class="hi-log">${L.slice(0, i.end ? 4 : 12).map(l => `<div class="hl" data-action="h-log-edit" data-id="${l.id}"><span class="hl-t">${ymd(new Date(l.at)) === todayStr() ? '' : `${MON[new Date(l.at).getMonth()]} ${new Date(l.at).getDate()} `}${hmOf(l.at)}</span><span>${l.type === 'med' ? `💊 ${esc(l.name)}${l.dose ? ` · ${esc(l.dose)}` : ''}` : l.type === 'temp' ? `🌡️ ${esc(l.value)}°${tempU()}` : `📝 ${esc(l.text)}`}</span></div>`).join('')}${L.length > (i.end ? 4 : 12) ? `<div class="muted small">+${L.length - (i.end ? 4 : 12)} earlier</div>` : ''}</div>` : ''}
      </div>`;
    };
    const sick = `<section class="card h-card"><div class="h-head"><h3>🤒 Sick log</h3><span class="spacer"></span><button class="btn small" data-action="h-ill">${icon('plus')} Someone’s sick</button></div>
      ${active.length ? active.map(illCard).join('') : '<div class="empty-sm">Everyone’s well 🎉</div>'}
      ${past.length ? `<details class="h-past"><summary>Past illnesses (${past.length})</summary>${past.map(illCard).join('')}</details>` : ''}
    </section>`;

    // workouts
    const wk = hArr('workouts').filter(w => hWho(w.memberId) && w.date >= ymd(ws) && w.date <= ymd(we));
    const dayW = wk.filter(w => w.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const people = (hUI.who ? state.members.filter(m => m.id === hUI.who) : state.members);
    const summary = people.map(m => { const mine = wk.filter(w => w.memberId === m.id); if (!mine.length && !hUI.who) return '';
      const mins = mine.reduce((a, w) => a + (Number(w.minutes) || 0), 0);
      return `<div class="h-wsum">${avatar(m, 'xs')}<b>${esc(m.name)}</b><span class="muted">${mine.length} workout${mine.length === 1 ? '' : 's'} · ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}</span>
        <span class="h-dots">${[0, 1, 2, 3, 4, 5, 6].map(i => { const dd = ymd(addDays(ws, i)); const has = mine.some(w => w.date === dd); return `<i class="${has ? 'on' : ''} ${dd === ds ? 'sel' : ''}" style="--c:${m.color}" title="${DOW[addDays(ws, i).getDay()]}">${DOW1[addDays(ws, i).getDay()]}</i>`; }).join('')}</span></div>`; }).join('');
    const gym = `<section class="card h-card"><div class="h-head"><h3>🏋️ Workouts</h3><span class="muted">week of ${MON[ws.getMonth()]} ${ws.getDate()}</span><span class="spacer"></span><button class="btn small" data-action="h-workout">${icon('plus')} Log workout</button></div>
      ${summary || '<div class="empty-sm">No workouts this week yet.</div>'}
      <h4 class="h-sub">${isToday ? 'Today' : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`}</h4>
      ${dayW.length ? dayW.map(w => { const m = memberById(w.memberId); return `<div class="h-work" data-action="h-workout" data-id="${w.id}"><span class="hw-ic">${workIcon(w.type)}</span>${avatar(m, 'xs')}<div class="hs-main"><b>${esc(w.type)}${w.minutes ? ` · ${w.minutes} min` : ''}</b><small class="muted">${esc([m ? m.name : '', w.time ? fmtTime(w.time) : '', w.notes].filter(Boolean).join(' · '))}</small></div></div>`; }).join('') : '<div class="empty-sm">Nothing logged.</div>'}
    </section>`;

    $('#view').innerHTML = `<div class="health">${active.length ? sick + vit : vit + sick}${gym}</div>`;
  }

  const memberOpts = cur => state.members.map(m => `<label><input type="radio" name="who" value="${m.id}" ${cur === m.id ? 'checked' : ''}><span>${esc(m.name)}</span></label>`).join('');
  const defaultWho = () => hUI.who || (state.members[0] || {}).id || '';
  function hSave(key, obj, isNew) { state[key] = isNew ? [...hArr(key), obj] : hArr(key).map(x => (x.id === obj.id ? obj : x)); save(); renderView(); }
  function hDelete(key, id) { state[key] = hArr(key).filter(x => x.id !== id); save(); renderView(); }

  function workoutModal(w) {
    const isNew = !w; const x = w || { id: uid(), memberId: defaultWho(), date: ymd(hUI.day), time: hmNow(), type: 'Strength', minutes: 45, notes: '' };
    modal({
      title: isNew ? 'Log workout' : 'Edit workout',
      body: `<div class="field"><span>Who</span><div class="seg wide">${memberOpts(x.memberId)}</div></div>
        <div class="field"><span>Type</span><div class="seg wide w-types">${WORKOUTS.map(([t, ic]) => `<label><input type="radio" name="type" value="${t}" ${x.type === t ? 'checked' : ''}><span>${ic} ${t}</span></label>`).join('')}</div></div>
        <div class="row"><label class="field"><span>Day</span><input type="date" name="date" value="${x.date}"></label><label class="field"><span>Time</span><input type="time" name="time" value="${x.time || ''}"></label><label class="field"><span>Minutes</span><input type="number" min="0" max="600" name="minutes" value="${esc(x.minutes || '')}"></label></div>
        <label class="field"><span>Notes <small class="muted">(optional)</small></span><input name="notes" value="${esc(x.notes || '')}" placeholder="e.g. legs, 5k, gym at work"></label>`,
      onSave(f) { const who = fall(f, 'who')[0]; if (!who) { toast('Pick who worked out'); return false; }
        hSave('workouts', { ...x, memberId: who, type: fall(f, 'type')[0] || 'Other', date: fval(f, 'date') || ymd(hUI.day), time: fval(f, 'time'), minutes: Number(fval(f, 'minutes')) || 0, notes: fval(f, 'notes') }, isNew); },
      onDelete: isNew ? null : () => hDelete('workouts', x.id),
    });
  }
  function suppModal(s) {
    const isNew = !s; const x = s || { id: uid(), memberId: defaultWho(), name: '', dose: '', time: '08:00', days: [], active: true };
    const order = [...Array(7)].map((_, i) => (state.settings.weekStart + i) % 7);
    modal({
      title: isNew ? 'Add vitamin or daily medicine' : `Edit ${esc(x.name)}`,
      body: `<div class="field"><span>For</span><div class="seg wide">${memberOpts(x.memberId)}</div></div>
        <div class="row"><label class="field"><span>Name</span><input name="name" value="${esc(x.name)}" placeholder="e.g. Vitamin D" autofocus></label><label class="field"><span>Dose</span><input name="dose" value="${esc(x.dose || '')}" placeholder="e.g. 2000 IU"></label></div>
        <label class="field"><span>Time of day <small class="muted">(optional)</small></span><input type="time" name="time" value="${x.time || ''}"></label>
        <div class="field"><span>Days <small class="muted">(none picked = every day)</small></span><div class="seg wide">${order.map(i => `<label><input type="checkbox" name="days" value="${i}" ${x.days && x.days.includes(i) ? 'checked' : ''}><span>${DOW[i]}</span></label>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" name="active" ${x.active !== false ? 'checked' : ''}><span class="track"></span><span>Currently taking</span></label>`,
      onSave(f) { const name = fval(f, 'name'); if (!name) { f.elements.name.classList.add('invalid'); return false; } const who = fall(f, 'who')[0]; if (!who) { toast('Pick who takes it'); return false; }
        hSave('supplements', { ...x, memberId: who, name, dose: fval(f, 'dose'), time: fval(f, 'time'), days: fall(f, 'days').map(Number), active: f.elements.active.checked }, isNew); },
      onDelete: isNew ? null : () => hDelete('supplements', x.id),
    });
  }
  function illModal(i) {
    const isNew = !i; const x = i || { id: uid(), memberId: defaultWho(), name: '', start: todayStr(), end: null, notes: '' };
    modal({
      title: isNew ? 'Someone’s sick' : 'Edit illness',
      body: `<div class="field"><span>Who</span><div class="seg wide">${memberOpts(x.memberId)}</div></div>
        <label class="field"><span>What is it</span><input name="name" value="${esc(x.name)}" placeholder="e.g. Cold, fever, stomach bug" autofocus></label>
        <div class="row"><label class="field"><span>Started</span><input type="date" name="start" value="${x.start}"></label><label class="field"><span>Recovered <small class="muted">(blank = still sick)</small></span><input type="date" name="end" value="${x.end || ''}"></label></div>
        <label class="field"><span>Notes</span><input name="notes" value="${esc(x.notes || '')}" placeholder="symptoms, doctor visit…"></label>`,
      onSave(f) { const name = fval(f, 'name'); if (!name) { f.elements.name.classList.add('invalid'); return false; } const who = fall(f, 'who')[0]; if (!who) { toast('Pick who is sick'); return false; }
        hSave('illnesses', { ...x, memberId: who, name, start: fval(f, 'start') || todayStr(), end: fval(f, 'end') || null, notes: fval(f, 'notes') }, isNew); },
      onDelete: isNew ? null : () => { choice('Delete this illness?', 'Its medicine, temperature and symptom log is deleted too.', [{ label: 'Delete', cls: 'danger', fn: () => { state.healthLog = hArr('healthLog').filter(l => l.illnessId !== x.id); hDelete('illnesses', x.id); } }]); return false; },
    });
  }
  function hLogModal(illnessId, type, l) {
    const isNew = !l; const ill = hArr('illnesses').find(i => i.id === illnessId) || {};
    const lastMed = hArr('healthLog').filter(e => e.illnessId === illnessId && e.type === 'med').sort((a, b) => b.at - a.at)[0];
    const x = l || { id: uid(), illnessId, memberId: ill.memberId, type, at: Date.now(), ...(type === 'med' && lastMed ? { name: lastMed.name, dose: lastMed.dose, everyH: lastMed.everyH } : {}) };
    const medNames = [...new Set(hArr('healthLog').filter(e => e.type === 'med').map(e => e.name))];
    let body = `<label class="field"><span>When</span><input type="datetime-local" name="at" value="${toLocalInput(x.at)}"></label>`;
    if (x.type === 'med') body += `<div class="row"><label class="field"><span>Medicine</span><input name="name" list="medNames" value="${esc(x.name || '')}" placeholder="e.g. Tylenol" autofocus><datalist id="medNames">${medNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label><label class="field"><span>Dose</span><input name="dose" value="${esc(x.dose || '')}" placeholder="as directed"></label></div>
        <label class="field"><span>Can repeat every (hours) <small class="muted">— optional, from the label or your doctor; shows when the next dose is OK</small></span><input type="number" step="0.5" min="0" max="48" name="everyH" value="${esc(x.everyH || '')}"></label>`;
    else if (x.type === 'temp') body += `<label class="field"><span>Temperature (°${tempU()})</span><input type="number" step="0.1" name="value" value="${esc(x.value || '')}" autofocus></label>`;
    else body += `<label class="field"><span>Symptom or note</span><input name="text" value="${esc(x.text || '')}" placeholder="e.g. cough worse at night" autofocus></label>`;
    modal({
      title: `${{ med: 'Medicine', temp: 'Temperature', symptom: 'Symptom' }[x.type]}${ill.name ? ` · ${esc(ill.name)}` : ''}`,
      body,
      onSave(f) {
        const o = { ...x, at: fromLocalInput(fval(f, 'at')) };
        if (x.type === 'med') { o.name = fval(f, 'name'); if (!o.name) { f.elements.name.classList.add('invalid'); return false; } o.dose = fval(f, 'dose'); o.everyH = Number(fval(f, 'everyH')) || 0; }
        else if (x.type === 'temp') { o.value = fval(f, 'value'); if (!o.value) return false; }
        else { o.text = fval(f, 'text'); if (!o.text) return false; }
        hSave('healthLog', o, isNew);
      },
      onDelete: isNew ? null : () => hDelete('healthLog', x.id),
    });
  }

  let installPrompt = null;
  const isInstalled = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  function installSection() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let body;
    if (isInstalled()) body = '<p>✅ You’re using the installed app.</p>';
    else if (installPrompt) body = `<p class="muted small">Adds Calendora to your home screen; it opens full screen like any other app.</p><button class="btn primary" data-action="install-app">${icon('plus')} Install app</button>`;
    else if (/Silk\//.test(navigator.userAgent)) body = '<p>On a Fire tablet (Silk): tap the <b>⋮</b> menu at the top right, then <b>Add to Home screen</b>. If you don’t see it, add a bookmark and choose <b>Pin to Home</b>.</p>';
    else if (ios) body = '<p>On iPad or iPhone: open this page in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>';
    else body = '<p>On Android: open this page in <b>Chrome</b>, tap the <b>⋮</b> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).</p>';
    return `<section class="card"><h3>Install as an app</h3>${body}<div class="row"><button class="btn" data-action="reload-app">↻ Reload app</button><span class="muted small">Loads the newest version. Calendora also offers this by itself when an update is out.</span></div></section>`;
  }

  // ---------------------------------------------------------------- news (RSS headlines on the idle screen)
  const NEWS_CATALOG = [
    ["US news", "NPR News", "https://feeds.npr.org/1001/rss.xml"],
    ["US news", "NPR Politics", "https://feeds.npr.org/1014/rss.xml"],
    ["US news", "NBC News", "https://feeds.nbcnews.com/nbcnews/public/news"],
    ["US news", "CBS News", "https://www.cbsnews.com/latest/rss/main"],
    ["US news", "CBS News US", "https://www.cbsnews.com/latest/rss/us"],
    ["US news", "ABC News", "https://abcnews.go.com/abcnews/topstories"],
    ["US news", "ABC News US", "https://abcnews.go.com/abcnews/usheadlines"],
    ["US news", "Fox News", "https://moxie.foxnews.com/google-publisher/latest.xml"],
    ["US news", "Fox News US", "https://moxie.foxnews.com/google-publisher/us.xml"],
    ["US news", "Fox News Politics", "https://moxie.foxnews.com/google-publisher/politics.xml"],
    ["US news", "MS NOW", "https://www.ms.now/feed"],
    ["US news", "PBS NewsHour", "https://www.pbs.org/newshour/feeds/rss/headlines"],
    ["US news", "New York Times", "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"],
    ["US news", "New York Times US", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"],
    ["US news", "New York Times Politics", "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"],
    ["US news", "Washington Post Politics", "https://feeds.washingtonpost.com/rss/politics"],
    ["US news", "Los Angeles Times", "https://www.latimes.com/world-nation/rss2.0.xml"],
    ["US news", "New York Post", "https://nypost.com/feed/"],
    ["US news", "Politico", "https://rss.politico.com/politics-news.xml"],
    ["US news", "The Hill", "https://thehill.com/news/feed/"],
    ["US news", "Axios", "https://api.axios.com/feed/"],
    ["US news", "TIME", "https://time.com/feed/"],
    ["US news", "The Atlantic", "https://www.theatlantic.com/feed/all/"],
    ["US news", "Vox", "https://www.vox.com/rss/index.xml"],
    ["US news", "Christian Science Monitor", "https://rss.csmonitor.com/feeds/all"],
    ["US news", "National Review", "https://www.nationalreview.com/feed/"],
    ["US news", "Washington Examiner", "https://www.washingtonexaminer.com/feed"],
    ["US news", "The Daily Wire", "https://www.dailywire.com/feeds/rss.xml"],
    ["US news", "Reason", "https://reason.com/feed/"],
    ["US news", "Yahoo News", "https://news.yahoo.com/rss/"],
    ["US news", "AP Top Stories (Flipboard)", "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss"],
    ["US news", "NPR National", "https://feeds.npr.org/1003/rss.xml"],
    ["US news", "Washington Post US", "https://feeds.washingtonpost.com/rss/national"],
    ["US news", "CBS News Politics", "https://www.cbsnews.com/latest/rss/politics"],
    ["US news", "ABC News Politics", "https://abcnews.go.com/abcnews/politicsheadlines"],
    ["World news", "BBC News", "https://feeds.bbci.co.uk/news/rss.xml"],
    ["World news", "BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"],
    ["World news", "BBC US & Canada", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    ["World news", "NPR World", "https://feeds.npr.org/1004/rss.xml"],
    ["World news", "New York Times World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"],
    ["World news", "CBS News World", "https://www.cbsnews.com/latest/rss/world"],
    ["World news", "ABC News International", "https://abcnews.go.com/abcnews/internationalheadlines"],
    ["World news", "Fox News World", "https://moxie.foxnews.com/google-publisher/world.xml"],
    ["World news", "The Guardian US", "https://www.theguardian.com/us-news/rss"],
    ["World news", "The Guardian World", "https://www.theguardian.com/world/rss"],
    ["World news", "Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"],
    ["World news", "Deutsche Welle", "https://rss.dw.com/rdf/rss-en-all"],
    ["World news", "France 24", "https://www.france24.com/en/rss"],
    ["World news", "Sky News World", "https://feeds.skynews.com/feeds/rss/world.xml"],
    ["World news", "CBC News", "https://www.cbc.ca/webfeed/rss/rss-topstories"],
    ["World news", "ABC Australia", "https://www.abc.net.au/news/feed/45910/rss.xml"],
    ["World news", "The Independent", "https://www.independent.co.uk/news/world/rss"],
    ["World news", "Euronews", "https://www.euronews.com/rss"],
    ["World news", "Times of Israel", "https://www.timesofisrael.com/feed/"],
    ["World news", "Japan Times", "https://www.japantimes.co.jp/feed/"],
    ["World news", "South China Morning Post", "https://www.scmp.com/rss/91/feed"],
    ["World news", "Kyiv Independent", "https://kyivindependent.com/news-archive/rss/"],
    ["World news", "Washington Post World", "https://feeds.washingtonpost.com/rss/world"],
    ["Christian", "The Christian Post", "https://www.christianpost.com/rss/feed"],
    ["Christian", "CBN News", "https://www1.cbn.com/rss-cbn-articles-cbnnews.xml"],
    ["Christian", "Religion News Service", "https://religionnews.com/feed/"],
    ["Christian", "Christian Headlines", "https://www.christianheadlines.com/rss/"],
    ["Christian", "Christian News Network", "https://christiannews.net/feed/"],
    ["Christian", "WORLD (wng.org)", "https://wng.org/feeds/rss/topics.rss"],
    ["Christian", "The Gospel Coalition", "https://www.thegospelcoalition.org/feed/"],
    ["Christian", "Relevant", "https://relevantmagazine.com/feed/"],
    ["Christian", "Faithwire", "https://www.faithwire.com/feed/"],
    ["Christian", "International Christian Concern", "https://www.persecution.org/feed/"],
    ["Christian", "Bible Gateway Verse of the Day", "https://www.biblegateway.com/votd/get/?format=atom"],
    ["Christian", "Christianity Today", "https://www.christianitytoday.com/feed/"],
    ["Christian", "Christian Today", "https://www.christiantoday.com/rss/feed"],
    ["Christian", "Mission Network News", "https://www.mnnonline.org/news/feed/"],
    ["Christian", "Desiring God", "https://www.desiringgod.org/blog.rss"],
    ["Christian", "Daily Citizen (Focus on the Family)", "https://dailycitizen.focusonthefamily.com/feed/"],
    ["Christian", "Crosswalk", "https://www.crosswalk.com/rss/"],
    ["Christian", "Christianity.com", "https://www.christianity.com/rss/"],
    ["Christian", "Ligonier Ministries", "https://www.ligonier.org/feed"],
    ["Christian", "Lifeway Research", "https://research.lifeway.com/feed/"],
    ["Christian (Catholic)", "Catholic News Agency", "https://www.catholicnewsagency.com/rss/news.xml"],
    ["Christian (Catholic)", "National Catholic Register", "https://www.ncregister.com/feeds/general-news.xml"],
    ["Christian (Catholic)", "National Catholic Reporter", "https://www.ncronline.org/rss.xml"],
    ["Christian (Catholic)", "Crux", "https://cruxnow.com/feed"],
    ["Christian (Catholic)", "Vatican News", "https://www.vaticannews.va/en.rss.xml"],
    ["Christian (Catholic)", "The Pillar", "https://www.pillarcatholic.com/feed"],
    ["Christian (Catholic)", "Aleteia", "https://aleteia.org/feed/"],
    ["Christian (Catholic)", "EWTN News", "https://www.ewtnnews.com/rss"],
    ["Business", "NPR Business", "https://feeds.npr.org/1006/rss.xml"],
    ["Business", "CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html"],
    ["Business", "MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"],
    ["Business", "New York Times Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"],
    ["Business", "BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"],
    ["Tech", "The Verge", "https://www.theverge.com/rss/index.xml"],
    ["Tech", "Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"],
    ["Tech", "TechCrunch", "https://techcrunch.com/feed/"],
    ["Tech", "Wired", "https://www.wired.com/feed/rss"],
    ["Tech", "Engadget", "https://www.engadget.com/rss.xml"],
    ["Tech", "NPR Technology", "https://feeds.npr.org/1019/rss.xml"],
    ["Tech", "BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"],
    ["Tech", "New York Times Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"],
    ["Tech", "Hacker News", "https://hnrss.org/frontpage"],
    ["Tech", "9to5Mac", "https://9to5mac.com/feed/"],
    ["Tech", "Android Police", "https://www.androidpolice.com/feed/"],
    ["Science & health", "NPR Health", "https://feeds.npr.org/1128/rss.xml"],
    ["Science & health", "NPR Science", "https://feeds.npr.org/1007/rss.xml"],
    ["Science & health", "New York Times Science", "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml"],
    ["Science & health", "New York Times Health", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml"],
    ["Science & health", "BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
    ["Science & health", "NASA", "https://www.nasa.gov/news-release/feed/"],
    ["Science & health", "ScienceDaily", "https://www.sciencedaily.com/rss/top/science.xml"],
    ["Science & health", "Smithsonian", "https://www.smithsonianmag.com/rss/latest_articles/"],
    ["Science & health", "Scientific American", "http://rss.sciam.com/ScientificAmerican-Global"],
    ["Science & health", "Science News", "https://www.sciencenews.org/feed"],
    ["Sports", "ESPN", "https://www.espn.com/espn/rss/news"],
    ["Sports", "ESPN NFL", "https://www.espn.com/espn/rss/nfl/news"],
    ["Sports", "ESPN NBA", "https://www.espn.com/espn/rss/nba/news"],
    ["Sports", "ESPN MLB", "https://www.espn.com/espn/rss/mlb/news"],
    ["Sports", "CBS Sports", "https://www.cbssports.com/rss/headlines/"],
    ["Sports", "Yahoo Sports", "https://sports.yahoo.com/rss/"],
    ["Arts & culture", "New York Times Arts", "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml"],
    ["Good news", "Good News Network", "https://www.goodnewsnetwork.org/feed/"],
    ["Good news", "Positive News", "https://www.positive.news/feed/"],
    ["Good news", "Good News Network USA", "https://www.goodnewsnetwork.org/category/news/usa/feed/"],
  ];
  const news = { items: [], feeds: [], at: 0, idx: 0, timer: null, loading: null };
  try { const c = JSON.parse(localStorage.getItem('calendora.news') || 'null'); if (c && Array.isArray(c.items)) Object.assign(news, { items: c.items, at: c.at || 0 }); } catch (e) { /* none */ }
  const newsFeeds = () => (Array.isArray(state.settings.newsFeeds) ? state.settings.newsFeeds : []);
  function loadNews(force) {
    if (!cloudOn() || !cloud.signedIn) return Promise.resolve();
    if (news.loading) return news.loading;
    if (!force && Date.now() - news.at < 10 * 60000 && news.items.length) return Promise.resolve();
    news.loading = api('/api/news').then(r => {
      if (r.ok && r.data) {
        news.items = (r.data.items || []).filter(x => x.title); news.feeds = r.data.feeds || []; news.at = Date.now();
        try { localStorage.setItem('calendora.news', JSON.stringify({ items: news.items.slice(0, 60), at: news.at })); } catch (e) { /* full */ }
      }
    }).catch(() => {}).finally(() => { news.loading = null; });
    return news.loading;
  }
  function showHeadline() {
    const box = $('#ssNews');
    if (!box) return;
    if (!state.settings.newsEnabled || !news.items.length) { box.hidden = true; return; }
    // four headlines at a time, stacked; the next four come in every rotation
    const n = Math.min(4, news.items.length);
    news.idx = news.idx % news.items.length;
    const four = Array.from({ length: n }, (_, k) => news.items[(news.idx + k) % news.items.length]);
    box.hidden = false;
    box.classList.remove('in'); void box.offsetWidth;
    box.innerHTML = `<div class="ss-ev-head">📰 News</div>${four.map(it => `<div class="ssn-item" data-link="${esc(it.link || '')}"><div class="ssn-title">${esc(it.title)}</div><div class="ssn-src">${esc(it.source || '')}${it.time ? ` · ${timeAgo(it.time)}` : ''}</div></div>`).join('')}`;
    box.classList.add('in');
  }
  function startNews() {
    clearInterval(news.timer);
    if (!state.settings.newsEnabled) return;
    news.idx = Math.floor(Math.random() * Math.max(1, news.items.length));
    showHeadline();
    loadNews().then(showHeadline);
    news.timer = setInterval(() => { news.idx += 4; showHeadline(); if (Date.now() - news.at > 15 * 60000) loadNews(); }, 15000);
  }
  function newsSection() {
    const fs = newsFeeds(), st = Object.fromEntries((news.feeds || []).map(f => [f.id, f]));
    return `<section class="card">
      <h3>News on the idle screen</h3>
      <label class="switch"><input type="checkbox" data-setting-bool="newsEnabled" ${state.settings.newsEnabled ? 'checked' : ''}><span class="track"></span><span>Show headlines on the idle screen</span></label>
      ${state.settings.newsEnabled ? `
      <p class="muted small">Four headlines show at a time, changing every 15 seconds, with each outlet's name. Tap one to read the full story on the outlet's site.</p>
      <div class="news-feeds">${fs.map(f => { const s = st[f.id]; return `<div class="news-feed"><div class="nf-main"><b>${esc(f.name || f.url)}</b><small class="${s && s.error ? 'warn-text' : 'muted'}">${s ? (s.error ? esc(s.error) : `${s.count} headlines`) : esc(f.url)}</small></div><button class="btn ghost small" data-action="news-remove" data-id="${f.id}">Remove</button></div>`; }).join('') || '<div class="empty-sm">No sources yet — add one below.</div>'}</div>
      <button class="btn primary news-browse" data-action="news-browse">${icon('plus')} Choose from ${NEWS_CATALOG.length} news sources</button>
      <details class="news-custom"><summary>Add a source that isn’t listed</summary>
        <form class="row news-add" data-form="news-add"><input name="name" placeholder="Name (e.g. Local TV)" maxlength="40"><input name="url" placeholder="RSS feed link (https://…)" autocomplete="off"><button class="btn" type="submit">${icon('plus')} Add</button></form>
        <p class="muted small">Most news sites publish an RSS feed — search the site for “RSS”. Local TV stations usually have one for local news.</p>
      </details>` : ''}
    </section>`;
  }
  function newsBrowse() {
    const cats = [...new Set(NEWS_CATALOG.map(c => c[0]))];
    const rows = () => cats.map(cat => `<div class="nb-cat" data-cat="${esc(cat)}"><h4>${esc(cat)}</h4>${NEWS_CATALOG.filter(c => c[0] === cat).map(([, n, u]) => `
      <label class="nb-row" data-name="${esc(n.toLowerCase())}"><input type="checkbox" data-url="${esc(u)}" data-name="${esc(n)}" ${newsFeeds().some(f => f.url === u) ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div>`).join('');
    modal({
      title: 'News sources',
      body: `<p class="muted small">Pick up to 8. Changes save right away and are shared with the family.</p>
        <input class="nb-search" name="q" placeholder="Search — e.g. Fox, BBC, Catholic, sports" autocomplete="off">
        <div class="nb-count muted small"></div>
        <div class="nb-list">${rows()}</div>`,
      saveLabel: 'Done',
      onOpen(form) {
        const count = () => { $('.nb-count', form).textContent = `${newsFeeds().length} of 8 chosen`; };
        count();
        form.elements.q.addEventListener('input', () => {
          const q = form.elements.q.value.trim().toLowerCase();
          $$('.nb-cat', form).forEach(c => { let any = false; $$('.nb-row', c).forEach(r => { const hit = !q || r.dataset.name.includes(q) || c.dataset.cat.toLowerCase().includes(q); r.hidden = !hit; any = any || hit; }); c.hidden = !any; });
        });
        $$('.nb-row input', form).forEach(cb => cb.addEventListener('change', () => {
          if (cb.checked) { if (newsAdd(cb.dataset.name, cb.dataset.url, true) === false) cb.checked = false; }
          else { const f = newsFeeds().find(x => x.url === cb.dataset.url); if (f) { state.settings.newsFeeds = newsFeeds().filter(x => x !== f); save(); news.items = news.items.filter(x => x.feed !== f.id); } }
          count(); renderView(); // the Settings page behind updates too
        }));
      },
      onSave() { renderView(); loadNews(true).then(() => { if (state.ui.view === 'settings') renderView(); }); },
    });
  }
  function newsAdd(name, url, quiet) {
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) { toast('Paste a full feed link starting with https://'); return; }
    if (newsFeeds().some(f => f.url === url)) { toast('That source is already added'); return; }
    if (newsFeeds().length >= 8) { toast('Up to 8 sources at a time — remove one first'); return false; }
    state.settings.newsFeeds = [...newsFeeds(), { id: uid(), name: name || '', url }];
    save();
    if (quiet) { cloudPush(true).catch(() => {}); return true; }
    renderView();
    cloudPush(true).catch(() => {}).then(() => loadNews(true)).then(() => { renderView(); const s = (news.feeds || []).find(f => f.url === url || f.id === state.settings.newsFeeds[state.settings.newsFeeds.length - 1].id); toast(s && s.error ? s.error : 'News source added'); });
  }

  // ---------------------------------------------------------------- render: shell
  const NAV = [
    ['calendar', 'Calendar'], ['chores', 'Chores'], ['rewards', 'Rewards'],
    ['lists', 'Lists'], ['meals', 'Meals'],
  ];
  function renderSidebar() {
    $('#sidebar').innerHTML = `
      <div class="logo" title="Calendora"><span></span></div>
      ${[...NAV, ...(state.settings.healthEnabled ? [['health', 'Health']] : []), ...(state.settings.babyEnabled ? [['baby', 'Baby']] : [])].map(([v, label]) => `<button class="nav-btn ${state.ui.view === v ? 'active' : ''}" data-action="view" data-v="${v}">${icon(v)}<span>${label}</span></button>`).join('')}
      <div class="nav-spacer"></div>
      <button class="nav-btn" data-action="sleep" title="Show the idle screen now">${icon('sleep')}<span>Frame</span></button>
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

  // Text size is per device (a wall tablet and a phone want different sizes). Scales the page content, not dialogs.
  function applyTextSize() {
    const z = Number(state.ui.textSize) || 1;
    ['.topbar', '#toolbar', '#view'].forEach(sel => { const el = $(sel); if (el) el.style.zoom = z === 1 ? '' : String(z); });
  }
  function render() {
    applyTextSize();
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
    if (state.ui.view === 'baby' && !state.settings.babyEnabled) state.ui.view = 'calendar';
    if (state.ui.view === 'health' && !state.settings.healthEnabled) state.ui.view = 'calendar';
    const fn = { calendar: renderCalendar, chores: renderChores, rewards: renderRewards, lists: renderLists, meals: renderMeals, baby: renderBaby, health: renderHealth, settings: renderSettings }[state.ui.view] || renderCalendar;
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
      </div>
      ${v === 'week' ? `<div class="seg small week-layout-toggle" title="How events are laid out in the week">
        ${[['time', 'By time'], ['stack', 'Stacked']].map(([k, l]) => `<button class="${(state.ui.weekLayout || 'time') === k ? 'on' : ''}" data-action="week-layout" data-v="${k}">${l}</button>`).join('')}
      </div>` : ''}`;
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

  const isPhone = () => matchMedia('(max-width: 600px)').matches;
  function renderWeek() {
    // phones always use the stacked week, one day per screen (swipe sideways for the next day)
    if (!isPhone() && (state.ui.weekLayout || 'time') === 'time') { renderWeekByTime(); return; }
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
    if (isPhone()) {
      const box = $('.week'), i = Math.max(0, Math.min(6, daysBetween(ws, ui.cursor)));
      box.scrollLeft = i * box.clientWidth;
    }
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
  // Week laid out on a time grid: one column per day, events placed by start time and length.
  function renderWeekByTime() {
    const ws = startOfWeek(ui.cursor), t = todayStr();
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(ws, i); return { d, ds: ymd(d), evs: eventsOn(ymd(d)) }; });
    let s = state.settings.dayStart, en = state.settings.dayEnd;
    days.forEach(({ evs }) => evs.forEach(e => { if (!e.allDay) { s = Math.min(s, Math.floor(toMin(e.startTime) / 60)); en = Math.max(en, Math.ceil(toMin(e.endTime || e.startTime) / 60)); } }));
    en = Math.min(24, Math.max(en, s + 1));
    const head = days.map(({ d, ds }) => {
      const wx = dailyWeather(ds);
      return `<div class="dname wk ${ds === t ? 'today' : ''}" data-action="goto-day" data-date="${ds}"><span class="wdow">${DOW[d.getDay()]}</span><span class="wnum">${d.getDate()}</span>${wx ? `<span class="wwx">${wx.icon} ${wx.hi}°</span>` : ''}</div>`;
    }).join('');
    const anyAllDay = days.some(({ evs }) => evs.some(e => e.allDay));
    const allRow = anyAllDay ? `<div class="dallday" style="--cols:7"><div class="dlabel">All day</div>${days.map(({ ds, evs }) => `<div>${evs.filter(e => e.allDay).map(e => chip(e, ds)).join('')}</div>`).join('')}</div>` : '';
    let times = '';
    for (let h = s; h < en; h++) times += `<div class="dt">${h === s ? '' : fmtHourLabel(h)}</div>`;
    const body = days.map(({ ds, evs }) => {
      const items = layoutLanes(evs.filter(e => !e.allDay).map(e => {
        const st = toMin(e.startTime); let et = toMin(e.endTime || e.startTime); if (et <= st) et = st + 30;
        return { s: st, e: et, ev: e };
      }));
      return `<div class="dcol ${ds === t ? 'today' : ''}" data-action="new-event-at" data-date="${ds}" data-member="" ${ds === t ? `data-start="${s}"` : ''}>
        ${items.map(it => {
          const top = (it.s - s * 60) / 60 * HOUR_H;
          const h = Math.max(24, (it.e - it.s) / 60 * HOUR_H - 2);
          const w = 100 / it.lanes;
          const ev = it.ev;
          return `<div class="dev wk ${isPast(ev, ds) ? 'past' : ''} ${h < 40 ? 'short' : ''}" style="--c:${evColor(ev)};top:${top}px;height:${h}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px)" data-action="edit-event" data-id="${ev.id}" data-date="${ds}" title="${esc(ev.title)} · ${esc(timeRange(ev))}">
            <div class="evtitle">${esc(ev.title)}</div>${h >= 40 ? `<div class="evmeta">${timeRange(ev)}</div>` : ''}
          </div>`;
        }).join('')}
        ${ds === t ? '<div class="nowline in-col" id="nowline"></div>' : ''}
      </div>`;
    }).join('');
    $('#view').innerHTML = `<div class="day week-time card" style="--hh:${HOUR_H}px">
      <div class="dhead" style="--cols:7"><div></div>${head}</div>
      ${allRow}
      <div class="dscroll" id="dscroll">
        <div class="dgrid" style="--cols:7;height:${(en - s) * HOUR_H}px" data-start="${s}">
          <div class="dtimes">${times}</div>${body}
        </div>
      </div></div>`;
    positionNowLine();
    const n = new Date();
    const inWeek = days.some(x => x.ds === t);
    const firstTimed = days.flatMap(x => x.evs).filter(e => !e.allDay).map(e => toMin(e.startTime)).sort((a, b) => a - b)[0];
    const focusMin = inWeek ? n.getHours() * 60 + n.getMinutes() - 120 : (firstTimed !== undefined ? firstTimed - 30 : 8 * 60);
    $('#dscroll').scrollTop = Math.max(0, (focusMin - s * 60) / 60 * HOUR_H);
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
    const td = $('.sday.today'); if (td && td.offsetTop > 40) td.scrollIntoView({ block: 'start' });
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
  // People shown in Chores (someone too young for chores can be switched off in Settings → Family)
  const choreMembers = () => state.members.filter(m => !m.noChores);
  function renderChores() {
    const d = ui.choreDate, ds = ymd(d);
    const cv = state.ui.choreView || 'day';
    const ws = startOfWeek(d), we = addDays(ws, 6);
    const title = cv === 'day' ? `${dateLabel(d)}${daysBetween(today(), d) && Math.abs(daysBetween(today(), d)) <= 1 ? ` <span class="muted">${MON[d.getMonth()]} ${d.getDate()}</span>` : ''}`
      : cv === 'week' ? `${MON[ws.getMonth()]} ${ws.getDate()} – ${ws.getMonth() !== we.getMonth() ? `${MON[we.getMonth()]} ` : ''}${we.getDate()}`
      : `${MONTHS[d.getMonth()]} <span class="muted">${d.getFullYear()}</span>`;
    const unit = { day: 'day', week: 'week', month: 'month' }[cv];
    $('#toolbar').innerHTML = `
      <div class="nav-group">
        <button class="icon-btn" data-action="nav" data-dir="-1" aria-label="Previous ${unit}">${icon('left')}</button>
        <button class="btn" data-action="today">Today</button>
        <button class="icon-btn" data-action="nav" data-dir="1" aria-label="Next ${unit}">${icon('right')}</button>
      </div>
      <h1>${title}</h1>
      <div class="seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button class="${cv === k ? 'on' : ''}" data-action="chore-view" data-v="${k}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn primary" data-action="new-chore">${icon('plus')} Add chore</button>`;
    if (!choreMembers().length) { $('#view').innerHTML = state.members.length ? '<div class="empty card"><p>Everyone is switched off for chores.</p><p class="muted">Turn someone back on in Settings → Family.</p></div>' : emptyMembers(); return; }
    ensureChoreCreated();
    if (cv === 'week') return renderChoresWeek(ws);
    if (cv === 'month') return renderChoresMonth(d);
    const done = state.choreDone[ds] || {};
    if (!choreMembers().length) { $('#view').innerHTML = state.members.length ? '<div class="empty card"><p>Everyone is switched off for chores.</p><p class="muted">Turn someone back on in Settings → Family.</p></div>' : emptyMembers(); return; }
    $('#view').innerHTML = `<div class="chores">${choreMembers().map(m => {
      const due = choresDue(m.id, ds), list = due.map(x => x.c), fromOf = Object.fromEntries(due.map(x => [x.c.id, x.from]));
      const n = list.filter(c => done[c.id]).length;
      const pct = list.length ? n / list.length : 0;
      const groups = TIMES_OF_DAY.map(([k, label, ic]) => {
        const items = list.filter(c => (c.time || 'anytime') === k);
        if (!items.length) return '';
        return `<div class="ctod">${ic} ${label}</div>` + items.map(c => `
          <div class="chore ${done[c.id] ? 'done' : ''} ${fromOf[c.id] ? 'carried' : ''}" data-action="toggle-chore" data-id="${c.id}">
            <span class="cemoji">${esc(c.emoji || '⭐')}</span>
            <span class="ctext"><span class="ctitle">${esc(c.title)}</span><span class="cstars">${'★'.repeat(Math.min(c.stars || 0, 5))}${fromOf[c.id] ? `<span class="carry-tag">↪ from ${DOW[parse(fromOf[c.id]).getDay()]}</span>` : ''}</span></span>
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
    }).join('')}</div>
    <div class="chore-dots">${choreMembers().map((m, i) => `<button class="${i === (ui.choreCol || 0) ? 'on' : ''}" style="--c:${m.color}" data-action="chore-col" data-i="${i}" aria-label="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div>`;
    // phones: one person per screen; swipe sideways for the next person
    const box = $('.chores');
    if (box && matchMedia('(max-width: 600px)').matches) {
      box.scrollLeft = (ui.choreCol || 0) * box.clientWidth;
      box.addEventListener('scroll', () => {
        const i = Math.round(box.scrollLeft / box.clientWidth);
        if (i !== ui.choreCol) { ui.choreCol = i; $$('.chore-dots button').forEach((b, j) => b.classList.toggle('on', j === i)); }
      }, { passive: true });
    }
  }
  const choresFor = (mid, ds) => choresDue(mid, ds).map(x => x.c);
  function renderChoresWeek(ws) {
    const days = [...Array(7)].map((_, i) => addDays(ws, i)), tds = todayStr();
    $('#view').innerHTML = `<div class="cweek" style="grid-template-columns: 170px repeat(7, minmax(120px, 1fr))">
      <div class="cw-corner"></div>
      ${days.map(x => `<button class="cw-day ${ymd(x) === tds ? 'today' : ''}" data-action="chore-goto" data-date="${ymd(x)}"><span>${DOW[x.getDay()]}</span><b>${x.getDate()}</b></button>`).join('')}
      ${choreMembers().map(m => {
        let tot = 0, dn = 0, stars = 0;
        const cells = days.map(x => {
          const ds = ymd(x), done = state.choreDone[ds] || {}, list = choresFor(m.id, ds);
          tot += list.length; dn += list.filter(c => done[c.id]).length; stars += list.filter(c => done[c.id]).reduce((a, c) => a + (done[c.id].s || 0), 0);
          const all = list.length && list.every(c => done[c.id]);
          return `<div class="cw-cell ${ds === tds ? 'today' : ''} ${all ? 'alldone' : ''}" style="--c:${m.color}">
            ${list.map(c => `<button class="cw-chore ${done[c.id] ? 'done' : ''}" data-action="toggle-chore" data-id="${c.id}" data-date="${ds}" title="${esc(c.title)}"><span>${esc(c.emoji || '⭐')}</span><span class="cw-t">${esc(c.title)}</span></button>`).join('') || '<span class="cw-none">—</span>'}
          </div>`;
        }).join('');
        return `<div class="cw-who" style="--c:${m.color}">${avatar(m)}<div><b>${esc(m.name)}</b><small class="muted">${dn}/${tot} done · ⭐ ${stars}</small></div></div>${cells}`;
      }).join('')}
    </div>`;
  }
  function renderChoresMonth(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1), start = startOfWeek(first);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const weeks = Math.ceil((daysBetween(start, last) + 1) / 7), tds = todayStr();
    const head = [...Array(7)].map((_, i) => `<div class="cm-dow">${DOW[addDays(start, i).getDay()]}</div>`).join('');
    const cells = [...Array(weeks * 7)].map((_, i) => {
      const x = addDays(start, i), ds = ymd(x), done = state.choreDone[ds] || {};
      const rows = choreMembers().map(m => { const list = choresFor(m.id, ds); if (!list.length) return ''; const n = list.filter(c => done[c.id]).length;
        return `<div class="cm-row" style="--c:${m.color}"><span class="cm-dot"></span><span class="cm-name">${esc(m.name)}</span><span class="cm-bar"><i style="width:${Math.round(n / list.length * 100)}%"></i></span><span class="cm-n ${n === list.length ? 'all' : ''}">${n === list.length ? '✓' : `${n}/${list.length}`}</span></div>`; }).join('');
      return `<button class="cm-cell ${x.getMonth() !== d.getMonth() ? 'other' : ''} ${ds === tds ? 'today' : ''} ${ds > tds ? 'future' : ''}" data-action="chore-goto" data-date="${ds}"><span class="cm-date">${x.getDate()}</span>${rows}</button>`;
    }).join('');
    $('#view').innerHTML = `<div class="cmonth">${head}${cells}</div>`;
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
  // ---------------------------------------------------------------- shopping list: Groceries vs Other
  // Order of trust: a category someone picked by hand → AnyList's own aisle category →
  // a built-in word list → Cloudflare AI (for anything the word list doesn't know).
  const OTHER_PHRASES = ['paper towel', 'toilet paper', 'trash bag', 'garbage bag', 'dish soap', 'dishwasher', 'laundry', 'dog food', 'cat food', 'cat litter', 'pet food', 'light bulb', 'aluminum foil', 'plastic wrap', 'zip bag', 'ziploc', 'paper plate', 'plastic cup', 'gift card', 'hand soap', 'band-aid', 'cotton ball'];
  const OTHER_WORDS = ['towel', 'towels', 'tissue', 'tissues', 'napkin', 'napkins', 'detergent', 'soap', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'floss', 'deodorant', 'lotion', 'sunscreen', 'razor', 'razors', 'diaper', 'diapers', 'wipes', 'battery', 'batteries', 'bulb', 'bulbs', 'candle', 'candles', 'holder', 'holders', 'cleaner', 'bleach', 'sponge', 'sponges', 'filter', 'filters', 'vitamin', 'vitamins', 'medicine', 'tylenol', 'advil', 'ibuprofen', 'bandage', 'bandages', 'litter', 'charger', 'cable', 'tape', 'glue', 'pen', 'pens', 'pencil', 'pencils', 'notebook', 'gift', 'card', 'cards', 'socks', 'shirt', 'shoes', 'toy', 'toys', 'activities', 'activity', 'flowers', 'plant', 'soil', 'fertilizer', 'hanger', 'hangers', 'storage', 'container', 'containers', 'foil', 'bags', 'plates', 'utensils', 'mop', 'broom', 'vacuum', 'screws', 'nails', 'paint', 'brush', 'comb', 'makeup', 'mascara', 'perfume', 'polish', 'stamps', 'envelopes', 'printer', 'ink', 'frame', 'pillow', 'sheets', 'blanket', 'curtain', 'rug', 'mat', 'basket', 'decor', 'decorations', 'balloons', 'wrapping'];
  const GROCERY_WORDS = ['milk', 'egg', 'eggs', 'bread', 'butter', 'cheese', 'yogurt', 'cream', 'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'lemon', 'lemons', 'lime', 'limes', 'grape', 'grapes', 'berries', 'strawberries', 'blueberries', 'raspberries', 'avocado', 'avocados', 'tomato', 'tomatoes', 'potato', 'potatoes', 'onion', 'onions', 'garlic', 'lettuce', 'spinach', 'kale', 'carrot', 'carrots', 'broccoli', 'peppers', 'pepper', 'cucumber', 'cucumbers', 'celery', 'mushrooms', 'corn', 'beans', 'peas', 'rice', 'pasta', 'spaghetti', 'noodles', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'honey', 'jam', 'jelly', 'peanut', 'nuts', 'almonds', 'cereal', 'oats', 'oatmeal', 'granola', 'crackers', 'chips', 'cookies', 'chocolate', 'candy', 'coffee', 'tea', 'juice', 'soda', 'water', 'wine', 'beer', 'chicken', 'beef', 'pork', 'turkey', 'ham', 'bacon', 'sausage', 'sausages', 'fish', 'salmon', 'tuna', 'shrimp', 'tofu', 'tortilla', 'tortillas', 'taco', 'tacos', 'pizza', 'soup', 'broth', 'stock', 'cinnamon', 'vanilla', 'yeast', 'icecream', 'frozen', 'snack', 'snacks', 'bagel', 'bagels', 'muffin', 'muffins', 'cake', 'pie', 'fruit', 'fruits', 'veggies', 'vegetables', 'salad', 'basil', 'cilantro', 'parsley', 'ginger', 'salsa', 'hummus', 'pickles', 'olives', 'sourdough', 'buns', 'rolls', 'cream cheese', 'zucchini', 'squash', 'pumpkin', 'melon', 'watermelon', 'pineapple', 'mango', 'peach', 'peaches', 'pear', 'pears', 'cherries', 'kiwi', 'dates', 'raisins', 'popcorn', 'pretzels', 'waffles', 'pancake', 'syrup', 'sour', 'feta', 'mozzarella', 'cheddar', 'parmesan', 'ground', 'steak', 'lamb', 'meatballs', 'hot dogs', 'deli', 'oregano', 'paprika', 'cumin', 'thyme', 'rosemary', 'spices', 'seasoning', 'baking', 'powder', 'soda water', 'lemonade', 'kombucha', 'cocoa', 'gum', 'jerky', 'applesauce'];
  const GROCERY_AL = /produce|meat|seafood|dairy|egg|bakery|bread|deli|frozen|canned|beverage|drink|snack|breakfast|cereal|condiment|sauce|spice|season|baking|pasta|rice|grain|international|ethnic|candy|sweet|coffee|tea|wine|beer|alcohol|oil|soup|nut|cheese|fruit|vegetable|refrigerated|grocery|food/i;
  const OTHER_AL = /household|cleaning|paper|personal|health|beauty|baby|pet|pharmacy|office|home|garden|hardware|clothing|electronic|supplies|toiletr|laundry|medicine/i;
  const wordsOf = t => String(t || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  function guessCat(text) {
    const t = String(text || '').toLowerCase();
    if (OTHER_PHRASES.some(p => t.includes(p))) return 'other';
    const w = wordsOf(t);
    if (w.some(x => OTHER_WORDS.includes(x))) return 'other';
    if (w.some(x => GROCERY_WORDS.includes(x)) || GROCERY_WORDS.some(p => p.includes(' ') && t.includes(p))) return 'grocery';
    return null;
  }
  function catOf(item) {
    if (item.cat === 'grocery' || item.cat === 'other') return item.cat;
    if (item.alCat) { if (GROCERY_AL.test(item.alCat)) return 'grocery'; if (OTHER_AL.test(item.alCat)) return 'other'; }
    return guessCat(item.text);
  }
  const shoppingList = () => state.lists.find(l => l.id === state.settings.shoppingListId) || state.lists.find(l => l.split) || state.lists.find(l => /grocer|need to buy|shopping/i.test(l.name)) || null;

  const catAsk = { busy: false, tried: new Set() };
  async function categorizeUnknown(list) {
    if (cloud.mode !== 'server' || !cloudOn() || catAsk.busy) return;
    const unknown = list.items.filter(i => !i.done && !catOf(i) && !catAsk.tried.has(i.text.toLowerCase())).slice(0, 40);
    if (!unknown.length) return;
    catAsk.busy = true;
    unknown.forEach(i => catAsk.tried.add(i.text.toLowerCase()));
    try {
      const r = await api('/api/categorize', { method: 'POST', body: JSON.stringify({ items: unknown.map(i => i.text) }) });
      if (r.ok && Array.isArray(r.data.cats)) {
        let changed = false;
        unknown.forEach((it, k) => {
          const c = r.data.cats[k];
          const live = list.items.find(x => x.id === it.id);
          if (live && !live.cat && (c === 'grocery' || c === 'other')) { live.cat = c; live.catBy = 'ai'; changed = true; }
        });
        if (changed) {
          save();
          const ae = document.activeElement, inAdd = ae && ae.closest && ae.closest('.add-item'), val = inAdd ? ae.value : '';
          if (state.ui.view === 'lists' && !modalOpen && (!isTyping() || inAdd)) {
            renderView();
            if (inAdd) { const i = $('.add-item input'); if (i) { i.value = val; i.focus(); } }
          }
        }
      }
    } catch (e) { /* try again next time the list is opened */ }
    catAsk.busy = false;
  }

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
          ${list.split && !i.done ? `<button class="mini-btn move-cat" data-action="move-cat" data-id="${i.id}" title="Move to ${catOf(i) === 'grocery' ? 'Other' : 'Groceries'}" aria-label="Move to the other section">${catOf(i) === 'grocery' ? '🧺' : '🥕'}</button>` : ''}
          <button class="mini-btn" data-action="delete-item" data-id="${i.id}" aria-label="Remove">${icon('trash')}</button>
        </div>`;
      const sections = list.split
        ? [['grocery', '🥕 Groceries'], ['other', '🧺 Other']].map(([k, label]) => {
            const items = open.filter(i => (catOf(i) || 'other') === k);
            return `<div class="cat-head"><span>${label}</span><span class="muted">${items.length}</span></div>${items.map(row).join('') || '<div class="empty-sm">Nothing here</div>'}`;
          }).join('')
        : open.map(row).join('');
      main = `<div class="list-head"><span class="lemoji big">${esc(list.emoji || '📝')}</span><h2>${esc(list.name)}</h2><span class="spacer"></span>
          <button class="btn" data-action="edit-list" data-id="${list.id}">${icon('edit')} Edit</button></div>
        <form class="add-item" data-form="add-item"><input name="text" placeholder="Add an item…" autocomplete="off" enterkeyhint="done" /><button class="btn primary" type="submit">Add</button></form>
        <div class="litems">${open.length ? sections : '<div class="empty-sm">All done! ✨</div>'}
          ${done.length ? `<div class="done-head"><span>Completed (${done.length})</span><button class="link-btn" data-action="clear-done">Clear completed</button></div>${done.map(row).join('')}` : ''}
        </div>`;
    }
    $('#view').innerHTML = `<div class="lists"><div class="list-side card">${side}</div><div class="list-main card">${main}</div></div>`;
    if (list && list.split) categorizeUnknown(list);
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
            <button class="btn small" data-action="recipe-to-list" data-id="${r.id}">🛒 Add to ${esc((shoppingList() || { name: 'shopping list' }).name)}</button>` : ''}
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
            <label class="switch compact" title="Show ${esc(m.name)} in Chores"><input type="checkbox" data-action="member-chores" data-id="${m.id}" ${m.noChores ? '' : 'checked'}><span class="track"></span><span>Chores</span></label>
            <button class="btn" data-action="edit-member" data-id="${m.id}">${icon('edit')} Edit</button></div>`).join('') || '<div class="empty-sm">No family members yet.</div>'}
        </div>
      </section>
      ${installSection()}
      ${newsSection()}
      <section class="card">
        <h3>Health</h3>
        <label class="switch"><input type="checkbox" data-setting-bool="healthEnabled" ${state.settings.healthEnabled ? 'checked' : ''}><span class="track"></span><span>Show the Health section in the menu</span></label>
        <p class="muted small">Workouts, vitamins and daily meds, and a sick log with medicine times.</p>
      </section>
      <section class="card">
        <h3>Baby tracker</h3>
        <label class="switch"><input type="checkbox" data-setting-bool="babyEnabled" ${state.settings.babyEnabled ? 'checked' : ''}><span class="track"></span><span>Show the Baby section in the menu</span></label>
        ${state.settings.babyEnabled ? `<label class="field inline"><span>Units</span><select data-setting="babyUnits">${opt('imperial', 'oz · lb · in', s.babyUnits)}${opt('metric', 'ml · kg · cm', s.babyUnits)}</select></label>` : '<p class="muted small">Track feeds, sleep, diapers, pumping and growth. Off by default.</p>'}
      </section>
      <section class="card">
        <h3>Display</h3>
        <label class="field inline"><span>Text size on this device</span><select data-ui-setting="textSize">${[[0.7, 'Smallest (70%)'], [0.78, 'Smaller (78%)'], [0.85, 'Small (85%)'], [0.92, 'Medium (92%)'], [1, 'Normal (100%)'], [1.12, 'Large (112%)']].map(([v, l]) => opt(v, l, state.ui.textSize || 1)).join('')}</select></label>
        <label class="field inline"><span>Week starts on</span><select data-setting="weekStart" data-num="1">${opt(0, 'Sunday', s.weekStart)}${opt(1, 'Monday', s.weekStart)}${opt(6, 'Saturday', s.weekStart)}</select></label>
        <label class="field inline"><span>Clock</span><select data-setting="use24h" data-bool="1">${opt('false', '12-hour (3:30 PM)', s.use24h)}${opt('true', '24-hour (15:30)', s.use24h)}</select></label>
        <label class="field inline"><span>Day view hours</span>
          <select data-setting="dayStart" data-num="1">${[5, 6, 7, 8, 9].map(h => opt(h, fmtHourLabel(h), s.dayStart)).join('')}</select>
          <span class="muted">to</span>
          <select data-setting="dayEnd" data-num="1">${[18, 19, 20, 21, 22, 23, 24].map(h => opt(h, fmtHourLabel(h), s.dayEnd)).join('')}</select></label>
        ${(seedDinners(), '')}<label class="field"><span>Our dinners <small class="muted">(one per line — shown as a dropdown when picking dinner)</small></span><textarea rows="4" data-setting-lines="dinnerPresets">${esc((s.dinnerPresets || []).join('\n'))}</textarea></label>
        <label class="field inline"><span>Show dinner on the week view</span><select data-setting="showMeals" data-bool="1">${opt('true', 'Yes', s.showMeals)}${opt('false', 'No', s.showMeals)}</select></label>
        <label class="field inline"><span>Idle screen starts after</span><select data-setting="screensaverMin" data-num="1">${[[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']].map(([v, l]) => opt(v, l, s.screensaverMin)).join('')}</select></label>
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
    const accts = gAccounts();
    const memberOpts = sel => `<option value="">Everyone</option>${state.members.map(m => `<option value="${m.id}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}`;
    let h = `<section class="card"><div class="sec-head"><h3>Google Calendar</h3>${accts.length ? `<div class="row wrap"><button class="btn" data-action="g-sync">Sync now</button><button class="btn primary" data-action="g-add">${icon('plus')} Add Google account</button></div>` : ''}</div>`;
    const copies = gCopyAccts();
    const copyHtml = copies.length ? `<div class="g-copies"><p><b>Saved copies from other devices</b> <small class="muted">— shown here even though this device isn’t signed in. They update whenever any device syncs. Sign in on this device to add or change Google events here.</small></p>${copies.map(a => `<div class="g-copy"><span class="gmark">G</span> ${esc(a)} <span class="muted">· updated ${timeAgo(state.gAcctAt[a])} · ${(state.gEvents || []).filter(e => e.gacct === a).length} events</span></div>`).join('')}</div>` : '';
    if (!accts.length) {
      h += copyHtml;
      h += `<p class="muted">Two-way sync: your Google calendars show up here, and events you add here can be saved to Google — so they appear on everyone’s phones. You can connect several Google accounts.</p>
        <button class="btn primary" data-action="g-connect"><span class="gmark">G</span> Connect Google Calendar</button>`;
      return h + '</section>';
    }
    h += `<p class="muted">${state.gSyncedAt ? `Synced ${timeAgo(state.gSyncedAt)}. ` : ''}Each account stays signed in for about an hour at a time on this device — tap Reconnect when asked. Until then, the last synced copy keeps showing on every device.</p>`;
    h += copyHtml;
    accts.forEach(acct => {
      const ok = gHasToken(acct);
      const cals = Object.entries(gCfg().calendars).filter(([, c]) => c.acct === acct);
      h += `<div class="g-account">
        <div class="g-acct-head"><span class="gmark">G</span><b>${esc(acct)}</b>
          <span class="status-pill ${ok ? 'ok' : 'warn'}">${ok ? 'Connected' : 'Needs reconnect'}</span><span class="spacer"></span>
          ${ok ? '' : `<button class="btn primary small" data-action="g-reconnect" data-acct="${esc(acct)}">Reconnect</button>`}
          <button class="btn ghost small" data-action="g-disconnect" data-acct="${esc(acct)}">Remove</button></div>
        <div class="gcal-list">${cals.map(([key, c]) => `
          <div class="gcal-row">
            <label class="gcal-on"><input type="checkbox" data-gcal-on="${esc(key)}" ${c.on ? 'checked' : ''}><span class="gdot" style="--c:${c.color}"></span>
              <span class="gname">${esc(c.name)}${c.primary ? ' <small class="muted">primary</small>' : ''}${gWritable(c) ? '' : ' <small class="muted">read-only</small>'}</span></label>
            <select data-gcal-member="${esc(key)}">${memberOpts(c.memberId)}</select>
          </div>`).join('') || `<div class="empty-sm">${ok ? 'No calendars yet — press Sync now.' : 'Reconnect to load this account’s calendars.'}</div>`}
        </div></div>`;
    });
    const writable = Object.entries(gCfg().calendars).filter(([, c]) => gWritable(c));
    h += `<label class="field inline"><span>New events go to</span><select data-g-default>
        <option value="">Calendora only (not sent to Google)</option>
        ${writable.map(([key, c]) => `<option value="${esc(key)}" ${gCfg().defaultCal === key ? 'selected' : ''}>${esc(c.name)} · ${esc(c.acct)}</option>`).join('')}
      </select></label>
      <p class="muted small">Tip: when someone is assigned a Google calendar above, new events for just that person are saved to it automatically.</p>`;
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
  // Second confirmation for destructive actions: the button only works after typing DELETE.
  function confirmTyped(title, what, fn) {
    modal({
      title,
      body: `<p>This can’t be undone. Consider <b>Export backup</b> first.</p>
        <label class="field"><span>Type <b>DELETE</b> to confirm (${esc(what)})</span><input name="word" autocomplete="off" autocapitalize="characters" spellcheck="false" autofocus placeholder="DELETE"></label>`,
      saveLabel: 'Yes, do it',
      onOpen(form) {
        const btn = $('button[type=submit]', form);
        btn.classList.remove('primary'); btn.classList.add('danger'); btn.disabled = true;
        form.elements.word.addEventListener('input', () => { btn.disabled = form.elements.word.value.trim().toUpperCase() !== 'DELETE'; });
      },
      onSave(form) {
        if (form.elements.word.value.trim().toUpperCase() !== 'DELETE') return false;
        closeModal(); fn(); return false;
      },
    });
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
    const writableCals = gAccounts().length ? Object.entries(gCfg().calendars).filter(([, c]) => c.on && gWritable(c)) : [];
    const multi = gAccounts().length > 1;
    const calPicker = isNew && writableCals.length ? `<label class="field"><span>Save to</span><select name="gcal">
        <option value="local">Calendora only (not sent to Google)</option>
        ${writableCals.map(([key, c]) => `<option value="${esc(key)}">Google · ${esc(c.name)}${multi ? ` (${esc(c.acct)})` : ''}</option>`).join('')}</select></label>` : '';
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
    const ch = c ? { ...c } : { id: uid(), title: '', emoji: '🧹', memberId: preset.memberId || ((choreMembers()[0] || state.members[0] || {}).id), time: 'anytime', stars: 1, repeat: 'daily', days: [], date: ymd(ui.choreDate), carry: true, created: todayStr() };
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
        <div class="field"><span>Stars earned</span><div class="star-pick">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" value="${n}" ${ch.stars === n ? 'checked' : ''}><span>${'★'.repeat(n)}</span></label>`).join('')}</div></div>
        <label class="check-row"><input type="checkbox" name="carry" ${ch.carry !== false ? 'checked' : ''}><span>Carry over to the next day if it isn’t done<br><small class="muted">Daily chores are already on every day, so this matters for “Certain days” and “Just once”.</small></span></label>`,
      onOpen(form) {
        const sync = () => { const r = fall(form, 'repeat')[0]; form.classList.toggle('is-weekly', r === 'weekly'); form.classList.toggle('is-once', r === 'once'); };
        form.addEventListener('change', sync); sync();
        // suggest an icon from the wording until one is picked by hand
        let picked = !!c;
        $$('input[name="emoji"]', form).forEach(r => r.addEventListener('change', () => { picked = true; }));
        form.elements.title.addEventListener('input', () => {
          if (picked) return;
          const e = choreIconFor(form.elements.title.value), r = e && $(`input[name="emoji"][value="${e}"]`, form);
          if (r) { r.checked = true; r.closest('label').scrollIntoView({ block: 'nearest' }); }
        });
      },
      onSave(form) {
        const title = fval(form, 'title');
        if (!title) { form.elements.title.classList.add('invalid'); return false; }
        const memberId = fall(form, 'memberId')[0];
        if (!memberId) { toast('Pick who this chore is for'); return false; }
        const out = { ...ch, title, memberId, emoji: fall(form, 'emoji')[0] || '⭐', time: fall(form, 'time')[0] || 'anytime', repeat: fall(form, 'repeat')[0] || 'daily', days: fall(form, 'days').map(Number), date: fval(form, 'date') || null, stars: Number(fall(form, 'stars')[0] || 1), carry: form.elements.carry.checked, created: ch.created || todayStr() };
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
        <label class="field"><span>Emoji instead of initials <small class="muted">(optional)</small></span><input name="emoji" value="${esc(mm.emoji || '')}" maxlength="4" placeholder="🦊"></label>
        <label class="check-row"><input type="checkbox" name="chores" ${mm.noChores ? '' : 'checked'}><span>Show in Chores<br><small class="muted">Turn off for someone too young for chores — they stay on the calendar.</small></span></label>`,
      onSave(form) {
        const name = fval(form, 'name');
        if (!name) { form.elements.name.classList.add('invalid'); return false; }
        const out = { ...mm, name, color: fall(form, 'color')[0] || mm.color, emoji: fval(form, 'emoji'), noChores: !form.elements.chores.checked };
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
        <div class="field"><span>Icon</span>${emojiPicker(LIST_EMOJI.includes(ll.emoji) ? LIST_EMOJI : [ll.emoji, ...LIST_EMOJI], ll.emoji)}</div>
        <label class="check-row"><input type="checkbox" name="split" ${ll.split ? 'checked' : ''}> Split into 🥕 Groceries and 🧺 Other (sorted automatically)</label>
        <label class="check-row"><input type="checkbox" name="shopping" ${shoppingList() && shoppingList().id === ll.id ? 'checked' : ''}> This is our shopping list (recipes and meals add ingredients here)</label>`,
      onSave(form) {
        const name = fval(form, 'name');
        if (!name) { form.elements.name.classList.add('invalid'); return false; }
        const out = { ...ll, name, emoji: fall(form, 'emoji')[0] || '📝', split: form.elements.split.checked };
        if (form.elements.shopping.checked) state.settings.shoppingListId = out.id;
        // keep the AnyList link pointing at this list even after a rename
        const al = state.settings.anylist;
        if (al && al.on && !al.listId && /grocer/i.test(ll.name || '')) al.listId = out.id;
        if (isNew) { state.lists.push(out); state.ui.listId = out.id; } else state.lists = state.lists.map(x => x.id === out.id ? out : x);
        save(); renderView();
      },
      onDelete: isNew ? null : () => { state.lists = state.lists.filter(x => x.id !== ll.id); save(); renderView(); toast('List deleted'); },
    });
  }

  // Built-in dinner list. Bump DINNER_SEED when adding names so boards that already exist pick them up once.
  const DINNER_DEFAULTS = ['Dutch Oven Potatoes', 'Meatballs and Spaghetti', 'Moldovan Pie', 'Grilled Chicken Salad', 'Orange Chicken', 'Roasted Chicken and Potatoes',
    'Honey Lime Chicken and Avocado Salad', 'Mashed Potatoes and Fried Fish', 'Mămăligă cu tocăniță', 'Baked Salmon and Asparagus', 'Stuffed Peppers', 'Chicken Quesadillas', 'Ciorbă de perișoare',
    'Morcovi cu coriandru și cotlete', 'Creamy Chicken and Mushroom', 'Chicken Fried Rice', 'Chicken Noodle Soup', 'Beef Stew', 'Chicken Livers and Potatoes',
    'Tomato Soup and Grilled Cheese Sandwiches', 'Chicken Salad Sandwich', 'Lasagna', 'Chickpea and Spicy Cucumber Salad', 'Pulled Pork and Coleslaw', 'Baked Brussels Sprouts', 'Meatball Subs',
    'Chicken Kebab with Tzatziki Sauce and Rice', 'Chicken Spinach Meatballs', 'Taquitos', 'Broccoli Chicken Alfredo', 'Mexican Beef and Rice Skillet',
    'Sweet Potato Salad', 'Mushroom and Green Bean Salad', 'Grilled Chicken Thighs',
    'Turkey Chili', 'Loaded Potato Soup', 'Pârjoale', 'Plăcintă', 'Air Fryer Wings with Carrots and Celery', 'Chicken Spiedini', 'Burgers',
    'Spaghetti with Shrimp', 'Spaghetti with Beef Ragù'];
  const DINNER_SEED = 6;
  // For each dinner name: times made in the last 365 days, last date made (today or earlier) and next planned date.
  function dinnerHistory(skipDs) {
    const t = todayStr(), yearAgo = ymd(addDays(today(), -365)), h = {};
    for (const [ds, day] of Object.entries(state.meals)) {
      const n = day && mealName(day.dinner); if (!n || ds === skipDs) continue;
      const k = n.trim().toLowerCase(), r = h[k] = h[k] || { count: 0, last: '', next: '' };
      if (ds <= t) { if (ds >= yearAgo) r.count++; if (ds > r.last) r.last = ds; }
      else if (!r.next || ds < r.next) r.next = ds;
    }
    return h;
  }
  const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const shortDate = ds => { const x = parse(ds); return `${MON[x.getMonth()]} ${ordinal(x.getDate())}${x.getFullYear() !== today().getFullYear() ? `, ${x.getFullYear()}` : ''}`; };
  function dinnerOptions(cur, ds) {
    const h = dinnerHistory(ds), list = state.settings.dinnerPresets || [];
    const info = n => h[n.toLowerCase()] || { count: 0, last: '', next: '' };
    // Never made first (in list order), then the longest since last made, so recent dinners sink to the bottom.
    const key = n => { const r = info(n); return r.next || r.last || ''; };
    const sorted = list.map((n, i) => ({ n, i })).sort((a, b) => key(a.n).localeCompare(key(b.n)) || a.i - b.i);
    return sorted.map(({ n }) => { const r = info(n);
      const note = [r.count ? `Count ${r.count}` : '', r.last ? `Last ${shortDate(r.last)}` : '', r.next ? `Planned ${shortDate(r.next)}` : ''].filter(Boolean).join(' - ');
      return `<option value="${esc(n)}" ${n === cur ? 'selected' : ''}>${esc(n)}${note ? ` — ${note}` : ''}</option>`; }).join('');
  }
  function seedDinners() {
    const st = state.settings;
    if ((st.dinnerSeed || 0) >= DINNER_SEED) return;
    const have = new Set((st.dinnerPresets || []).map(x => x.toLowerCase()));
    st.dinnerPresets = [...(st.dinnerPresets || []), ...DINNER_DEFAULTS.filter(x => !have.has(x.toLowerCase()))];
    st.dinnerSeed = DINNER_SEED; save();
  }
  function mealModal(ds, type) {
    seedDinners();
    const label = MEAL_TYPES.find(m => m[0] === type) || MEAL_TYPES[2];
    const raw = state.meals[ds] && state.meals[ds][type];
    const cur = mealName(raw), curRec = mealRecipeId(raw);
    const past = new Map(); // meal name -> recipe id (if it had one)
    Object.values(state.meals).forEach(day => Object.entries(day).forEach(([k, v]) => { if (k === type && mealName(v)) past.set(mealName(v), mealRecipeId(v) || past.get(mealName(v)) || null); }));
    const recipes = (state.recipes || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    const d = parse(ds);
    modal({
      title: `${label[2]} ${label[1]} · ${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`,
      body: `${type === 'dinner' ? `<label class="field"><span>Our dinners</span><select name="preset"><option value="">Pick a dinner…</option>${dinnerOptions(cur, ds)}</select><small class="muted">Recently made dinners move to the bottom.</small></label>` : ''}
        <input class="title-input" name="meal" list="mealSuggest" value="${esc(cur)}" placeholder="What’s on the menu?" autofocus maxlength="80" />
        <datalist id="mealSuggest">${[...past.keys()].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        ${past.size ? `<div class="field"><span>Recent</span><div class="suggest">${[...past.keys()].slice(-10).reverse().map(v => `<button type="button" class="pill" data-meal="${esc(v)}">${esc(v)}${past.get(v) ? ' 📖' : ''}</button>`).join('')}</div></div>` : ''}
        <div class="field"><span>Recipe</span>
          <div class="row recipe-pick">
            <select name="recipe"><option value="">No recipe</option>${recipes.map(r => `<option value="${r.id}" ${r.id === curRec ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select>
            <button type="button" class="btn" data-new-recipe>${icon('plus')} New recipe</button>
          </div>
          <small class="muted">Paste a link, snap a photo or type it in — it opens in a cooking view from the calendar.</small>
        </div>
        ${type === 'dinner' ? '<button type="button" class="linkish" data-save-preset>☆ Add this to Our dinners</button>' : ''}
        <label class="check-row recipe-groceries" hidden><input type="checkbox" name="addIng"> Add this recipe’s ingredients to Groceries</label>
        <label class="field"><span>Add other items to Groceries <small class="muted">(optional, comma-separated)</small></span><input name="ingredients" placeholder="tortillas, ground beef, salsa"></label>`,
      onOpen(form) {
        const sel = form.elements.recipe;
        const syncIng = () => { const r = recipeById(sel.value); $('.recipe-groceries', form).hidden = !(r && (r.ingredients || []).length); };
        sel.addEventListener('change', () => { syncIng(); const r = recipeById(sel.value); if (r && !form.elements.meal.value.trim()) form.elements.meal.value = r.title; });
        syncIng();
        const pre = form.elements.preset, sp = $('[data-save-preset]', form);
        const syncSp = () => { if (!sp) return; const n = form.elements.meal.value.trim(); sp.hidden = !n || (state.settings.dinnerPresets || []).some(x => x.toLowerCase() === n.toLowerCase()); };
        if (pre) pre.addEventListener('change', () => {
          if (!pre.value) return; form.elements.meal.value = pre.value;
          const r = recipes.find(x => x.title.toLowerCase() === pre.value.toLowerCase()) || recipeById(past.get(pre.value));
          if (r) { sel.value = r.id; syncIng(); } syncSp();
        });
        form.elements.meal.addEventListener('input', syncSp); syncSp();
        if (sp) sp.addEventListener('click', () => { const n = form.elements.meal.value.trim(); if (!n) return; state.settings.dinnerPresets = [...(state.settings.dinnerPresets || []), n]; save(); sp.hidden = true; if (pre) pre.insertAdjacentHTML('beforeend', `<option value="${esc(n)}" selected>${esc(n)}</option>`); toast(`${n} added to Our dinners`); });
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
    let gl = shoppingList();
    if (!gl) { gl = { id: uid(), name: 'Need to Buy', emoji: '🛒', items: [], split: true }; state.lists.unshift(gl); state.settings.shoppingListId = gl.id; }
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
    } else if (v === 'chores') {
      const cv = state.ui.choreView || 'day';
      ui.choreDate = cv === 'month' ? new Date(ui.choreDate.getFullYear(), ui.choreDate.getMonth() + dir, 1) : addDays(ui.choreDate, cv === 'week' ? 7 * dir : dir);
    }
    else if (v === 'baby') bUI.day = addDays(bUI.day, dir);
    else if (v === 'health') hUI.day = addDays(hUI.day, dir);
    else if (v === 'meals') ui.mealWeek = addDays(ui.mealWeek, 7 * dir);
    else return;
    renderView();
  }
  function goToday() { ui.cursor = today(); ui.choreDate = today(); ui.mealWeek = today(); bUI.day = today(); hUI.day = today(); renderView(); }

  const actions = {
    view(el) { state.ui.view = el.dataset.v; save({ localOnly: true }); render(); if (el.dataset.v === 'settings') anylistLoad(); },
    calview(el) { state.ui.calView = el.dataset.v; save({ localOnly: true }); renderView(); },
    'week-layout'(el) { state.ui.weekLayout = el.dataset.v; save({ localOnly: true }); renderView(); },
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
    'reload-app'() { location.reload(); },
    'news-browse'() { newsBrowse(); },
    'news-remove'(el) { state.settings.newsFeeds = newsFeeds().filter(f => f.id !== el.dataset.id); save(); renderView(); news.items = news.items.filter(x => x.feed !== el.dataset.id); },
    'member-chores'(el) { const m = state.members.find(x => x.id === el.dataset.id); if (!m) return; m.noChores = !m.noChores; ui.choreCol = 0; save(); renderView(); toast(m.noChores ? `${m.name} is hidden from Chores` : `${m.name} is back in Chores`); },
    async 'install-app'() { if (!installPrompt) return; installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => null); installPrompt = null; if (r && r.outcome !== 'accepted') toast('You can install it any time from Settings'); renderView(); },
    'h-who'(el) { hUI.who = el.dataset.id; renderView(); },
    'h-workout'(el) { workoutModal(hArr('workouts').find(w => w.id === el.dataset.id)); },
    'h-supp'(el, ev) { if (ev) ev.preventDefault(); suppModal(hArr('supplements').find(x => x.id === el.dataset.id)); },
    'h-take'(el) { const k = `${el.dataset.id}|${ymd(hUI.day)}`; const t = { ...(state.suppTaken || {}) }; if (t[k]) delete t[k]; else { const n = new Date(), d = hUI.day; t[k] = new Date(d.getFullYear(), d.getMonth(), d.getDate(), n.getHours(), n.getMinutes()).getTime(); } state.suppTaken = t; save(); renderView(); },
    'h-ill'(el) { illModal(hArr('illnesses').find(i => i.id === el.dataset.id)); },
    'h-log'(el) { hLogModal(el.dataset.ill, el.dataset.type); },
    'h-log-edit'(el) { const l = hArr('healthLog').find(x => x.id === el.dataset.id); if (l) hLogModal(l.illnessId, l.type, l); },
    'h-recover'(el) { const i = hArr('illnesses').find(x => x.id === el.dataset.id); if (i) { hSave('illnesses', { ...i, end: todayStr() }, false); toast(`Glad ${memberById(i.memberId) ? memberById(i.memberId).name : 'they'}’s better!`); } },
    'pick-baby'(el) { bUI.babyId = el.dataset.id; state.ui.babyId = el.dataset.id; save({ localOnly: true }); renderView(); },
    'baby-edit'() { babyProfileModal(curBaby()); },
    'baby-log'(el) {
      const k = el.dataset.kind;
      if (k === 'nurse' && runningFeed()) { toast('Nursing timer is running — use the buttons above'); return; }
      if (k === 'sleep' && runningSleep()) { actions['sleep-stop'](); return; }
      babyEntryModal(k);
    },
    'baby-entry'(el) { const e = blog().find(x => x.id === el.dataset.id); if (!e) return; if (isRunning(e)) { toast(e.type === 'sleep' ? 'Tap “Woke up” to stop the timer' : 'Use Left / Right / Done above'); return; } babyEntryModal(null, e); },
    'nurse-side'(el) { nurseSide(el.dataset.side); },
    'nurse-pause'() { nursePause(); },
    'nurse-stop'() { nurseStop(); },
    'sleep-stop'() { const sl = runningSleep(); if (sl) { updLog(sl.id, { end: Date.now() }); toast(`Slept ${dur(Date.now() - sl.start)}`); } },
    'move-cat'(el) {
      const l = currentList(); const it = l && l.items.find(i => i.id === el.dataset.id); if (!it) return;
      it.cat = catOf(it) === 'grocery' ? 'other' : 'grocery'; it.catBy = 'user';
      save(); renderView(); toast(`Moved “${it.text}” to ${it.cat === 'grocery' ? 'Groceries' : 'Other'}`);
    },
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
    'g-add'() { gConnect(); },
    'g-reconnect'(el) { gReconnect(el.dataset.acct || null); },
    'g-sync'() { if (!gAccounts().some(gHasToken)) gReconnect(); else gSync(); },
    'g-disconnect'(el) { const acct = el.dataset.acct; choice(`Remove ${esc(acct)}?`, 'Its events will be removed from this screen. Nothing is deleted from Google.', [{ label: 'Remove', cls: 'danger', fn: () => gDisconnect(acct) }]); },
    'new-event'(el) { eventModal(null, null, { date: el.dataset.date }); },
    'new-event-at'(el, evt) {
      const rect = el.getBoundingClientRect();
      const s = Number(el.parentElement.dataset.start);
      const min = clamp(s * 60 + Math.floor((evt.clientY - rect.top) / HOUR_H * 2) * 30, 0, 23 * 60);
      eventModal(null, null, { date: el.dataset.date, startTime: fromMin(min), memberIds: el.dataset.member ? [el.dataset.member] : [] });
    },
    'chore-col'(el) { const box = $('.chores'); ui.choreCol = Number(el.dataset.i); if (box) box.scrollTo({ left: ui.choreCol * box.clientWidth, behavior: 'smooth' }); },
    'chore-view'(el) { state.ui.choreView = el.dataset.v; save({ localOnly: true }); renderView(); },
    'chore-goto'(el) { ui.choreDate = parse(el.dataset.date); state.ui.choreView = 'day'; save({ localOnly: true }); renderView(); },
    'toggle-chore'(el) {
      const ds = el.dataset.date || ymd(ui.choreDate);
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
    'reset-demo'() {
      const scope = cloud.mode === 'server' ? 'This replaces the family board on every signed-in device (photos are kept).' : 'This replaces everything saved in this browser (photos are kept).';
      choice('Load the demo family?', scope, [{ label: 'Continue', cls: 'danger', fn: () => confirmTyped('Replace everything with the demo family?', 'demo family', () => {
        const keep = state.settings.google, ge = state.gEvents; state = seed(defaults()); state.settings.google = keep; state.gEvents = ge; gRemap(); state.ui.view = 'calendar'; save(); render(); toast('Demo family loaded');
      }) }]);
    },
    'clear-all'() {
      const scope = cloud.mode === 'server' ? 'This deletes all family members, events, chores, lists, meals and recipes for everyone — on every signed-in device.' : 'This deletes all family members, events, chores, lists, meals and recipes saved in this browser.';
      choice('Start fresh?', scope, [{ label: 'Continue', cls: 'danger', fn: () => confirmTyped('Delete everything?', 'everything', () => {
        const keep = state.settings.google, ge = state.gEvents; state = defaults(); state.settings.google = keep; state.gEvents = ge; Object.values(keep.calendars).forEach(c => { c.memberId = ''; }); gRemap(); save(); render(); toast('Everything was deleted'); memberModal();
      }) }]);
    },
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
    if (f.dataset.form === 'news-add') { newsAdd(f.elements.name.value.trim(), f.elements.url.value.trim()); return; }
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
    if (t.matches('[data-ui-setting]')) { state.ui[t.dataset.uiSetting] = Number(t.value); save({ localOnly: true }); render(); return; }
    if (t.matches('[data-setting-lines]')) { state.settings[t.dataset.settingLines] = [...new Set(t.value.split('\n').map(x => x.trim()).filter(Boolean))]; save(); toast('Saved'); return; }
    if (t.matches('[data-setting-bool]')) { state.settings[t.dataset.settingBool] = t.checked; save(); render(); if (t.dataset.settingBool === 'babyEnabled' && t.checked) toast('Baby is now in the menu'); return; }
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
      case 'health': return choice('Add to Health', '', [{ label: '🏋️ Workout', fn: () => workoutModal() }, { label: '💊 Vitamin / daily med', fn: () => suppModal() }, { label: '🤒 Someone’s sick', fn: () => illModal() }]);
      case 'baby': return curBaby() ? babyEntryModal('diaper') : babyProfileModal(null);
      default: return null;
    }
  });

  // swipe left / right to move between days, weeks and months
  let touch = null;
  // Swipes that start inside something that scrolls sideways (week grids, chore columns, meal plan) scroll it instead of changing the date.
  const sideScroller = el => { for (; el && el !== document.body; el = el.parentElement) { if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return el; } return null; };
  $('#view').addEventListener('touchstart', e => { if (e.touches.length === 1 && !sideScroller(e.target)) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; else touch = null; }, { passive: true });
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
  const SHARED_KEYS = ['members', 'events', 'chores', 'choreDone', 'lists', 'meals', 'rewards', 'redemptions', 'icalFeeds', 'recipes', 'babies', 'babyLog', 'workouts', 'supplements', 'suppTaken', 'illnesses', 'healthLog'];
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
    gSnapLoad();
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
    const snapAt = Number(r.headers.get('X-Snapshot-At')) || 0;
    return { text: await r.text(), snapAt, snapWhy: snapAt ? decodeURIComponent(r.headers.get('X-Snapshot-Reason') || '') : '' };
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
          ical.data[f.id] = res.snapAt ? { events, error: `${res.snapWhy || 'Could not reach Apple'} — showing the copy saved ${timeAgo(res.snapAt)}`, at: res.snapAt, saved: true } : { events, error: null, at: Date.now() };
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
    const target = lists.find(l => l.id === cfg.listId) || shoppingList();
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
    ssSlides = SCENES; // the idle screen shows color scenes with the clock and today's events
    ssIdx = Math.floor(Math.random() * ssSlides.length);
    ss.innerHTML = `<div class="ss-slide" id="ssA"></div><div class="ss-slide" id="ssB"></div><div class="ss-shade"></div>
      <div class="ss-left"><div class="ss-news" id="ssNews" hidden></div><div class="ss-events" id="ssEvents"></div>
        <div class="ss-info"><div class="ss-time" id="ssTime"></div><div class="ss-date" id="ssDate"></div><div class="ss-weather" id="ssWeather"></div></div></div>
      <div class="ss-hint">Tap anywhere to return</div>`;
    ss.hidden = false;
    requestAnimationFrame(() => ss.classList.add('on'));
    showSlide();
    updateScreensaver();
    ssTimer = setInterval(() => { ssIdx = (ssIdx + 1) % ssSlides.length; showSlide(); }, 12000);
    startNews();
  }
  function showSlide() {
    ssFlip = !ssFlip;
    const show = $(ssFlip ? '#ssA' : '#ssB'), hide = $(ssFlip ? '#ssB' : '#ssA');
    if (!show) return;
    show.style.background = ssSlides[ssIdx];
    show.classList.remove('kb'); void show.offsetWidth; show.classList.add('kb', 'show');
    hide.classList.remove('show');
    const next = ssSlides[(ssIdx + 1) % ssSlides.length], m = /url\('([^']+)'\)/.exec(next || '');
    if (m) { const im = new Image(); im.src = m[1]; } // warm the next photo so it doesn't pop in
  }
  const today_ = () => today();
  function updateScreensaver() {
    if (!ssOn) return;
    const n = new Date();
    $('#ssTime').innerHTML = state.settings.use24h ? `${pad(n.getHours())}:${pad(n.getMinutes())}` : `${n.getHours() % 12 || 12}:${pad(n.getMinutes())}<small>${n.getHours() < 12 ? 'AM' : 'PM'}</small>`;
    $('#ssDate').textContent = `${DOW_LONG[n.getDay()]}, ${MONTHS[n.getMonth()]} ${n.getDate()}`;
    const w = ui.weather;
    $('#ssWeather').textContent = w && w.current ? `${wIcon(w.current.weather_code, w.current.is_day)} ${Math.round(w.current.temperature_2m)}°` : '';
    const nowMin = n.getHours() * 60 + n.getMinutes();
    dayCache = new Map();
    // today's remaining events, then tomorrow's, stacked above the clock
    const today = eventsOn(todayStr()).filter(e => e.allDay || toMin(e.endTime || e.startTime) >= nowMin);
    const tmr = eventsOn(ymd(addDays(today_(), 1)));
    const max = matchMedia('(max-width: 700px)').matches ? 3 : 5;
    const block = (label, list, empty) => `<div class="ss-ev-group"><div class="ss-ev-head">${label}</div>${list.length ? list.slice(0, max).map(e => `<div class="ss-ev" style="--c:${evColor(e)}"><b>${e.allDay ? 'All day' : fmtTime(e.startTime)}</b><span>${esc(e.title)}</span></div>`).join('') + (list.length > max ? `<div class="ss-ev-more">+${list.length - max} more</div>` : '') : `<div class="ss-ev-none">${empty}</div>`}</div>`;
    $('#ssEvents').innerHTML = block('Today', today, 'Nothing else today') + block(`Tomorrow · ${DOW_LONG[addDays(today_(), 1).getDay()]}`, tmr, 'Nothing planned');
  }
  function stopScreensaver() {
    if (!ssOn) return;
    ssOn = false; clearInterval(ssTimer); clearInterval(news.timer);
    ss.classList.remove('on');
    setTimeout(() => { if (!ssOn) { ss.hidden = true; ss.innerHTML = ''; } }, 400);
    lastActive = Date.now();
    goToday();
  }
  ss.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const n = e.target.closest('.ssn-item');
    if (n && n.dataset.link) { window.open(n.dataset.link, '_blank', 'noopener'); return; } // read the story; the idle screen stays
    stopScreensaver();
  });

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
  setInterval(() => { renderClock(); tickBaby(); }, 1000);
  icalRemap();
  if (openRecipeId() && recipeById(openRecipeId())) openRecipe(openRecipeId());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && recipeOpen()) keepAwake(true); });
  cloudInit();
  setInterval(cloudPull, 15000);
  setInterval(() => { if (document.visibilityState === 'visible') gSnapLoad(); }, 120000);
  setInterval(() => icalRefresh(), 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - ical.lastFetch > 15 * 60 * 1000) icalRefresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cloudPull(); });
  addEventListener('online', () => { if (cloud.mode === 'server') { cloud.offline = false; cloudPull(); } });
  gLoadScript().catch(() => {});
  if (gAccounts().length) gSync({ quiet: true });
  // keep Google in step: every 5 minutes, and whenever the tab comes back into view
  setInterval(() => { if (gAccounts().some(gHasToken)) gSync({ quiet: true }); else renderSyncPill(); }, 5 * 60 * 1000);
  setInterval(renderSyncPill, 60 * 1000);
  // Update check: when a new version is deployed, offer a one-tap reload (installed apps have no reload button).
  let appTag = null, updateShown = false;
  async function checkForUpdate() {
    if (updateShown || location.protocol === 'file:') return;
    try {
      const r = await fetch('/app.js', { method: 'HEAD', cache: 'no-store' });
      const tag = r.headers.get('ETag') || r.headers.get('Last-Modified') || r.headers.get('Content-Length');
      if (!tag) return;
      if (appTag === null) { appTag = tag; return; }
      if (tag !== appTag) {
        updateShown = true;
        const b = document.createElement('button');
        b.className = 'update-bar'; b.innerHTML = '✨ Calendora was updated — <b>tap to reload</b>';
        b.addEventListener('click', () => location.reload());
        document.body.appendChild(b);
      }
    } catch (e) { /* offline */ }
  }
  checkForUpdate();
  setInterval(checkForUpdate, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  // Installable app: offline start-up plus the browser's "Install app" prompt.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (state.ui.view === 'settings') renderView(); });
  addEventListener('appinstalled', () => { installPrompt = null; toast('Calendora installed 🎉'); if (state.ui.view === 'settings') renderView(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') gSnapLoad();
    if (document.visibilityState === 'visible' && gAccounts().some(gHasToken) && Date.now() - (state.gSyncedAt || 0) > 60000) gSync({ quiet: true });
  });
})();
