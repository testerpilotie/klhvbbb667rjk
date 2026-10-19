import * as M from './model.js';
import * as S from './store.js';
import * as F from './format.js';
import { PRESETS, sipMinutesFor } from './drinks.js';
import { mountTimeline } from './chart.js';
import * as Sc from './score.js';
import * as Fe from './feel.js';
import { shareNight } from './share.js';
import { ICONS, drinkName } from './ui/common.js';
import { dockView, nowView } from './ui/now.js';
import { historyView } from './ui/history.js';
import { settingsView } from './ui/settings.js';
import { onboardingView, profileValid } from './ui/onboarding.js';
import { customValid, gramsHint, sheetTitle, sheetView } from './ui/sheets.js';

const { MINUTE, HOUR } = M;
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
const toastRoot = document.getElementById('toast-root');

const ui = {
  tab: 'now',
  historyTab: 'nights', // 'nights' | 'trends' | 'trophies'
  shownBac: null,
  ob: null, // onboarding draft
  sheet: null, // { type: 'add' | 'custom' | 'edit' | 'reading', ... }
};

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const install = {
  prompt: null,
  standalone,
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone,
};

const reminders = {
  get supported() {
    return 'Notification' in window;
  },
  get permission() {
    return 'Notification' in window ? Notification.permission : 'denied';
  },
};

// ---------------------------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------------------------

function catalogue(state) {
  return [...PRESETS, ...state.customDrinks.map((c) => ({ ...c, custom: true }))];
}

/** The drink guidance is based on: whatever you had last, or a pint. */
function refDrink(state) {
  const last = state.drinks.at(-1);
  if (last) {
    const match = catalogue(state).find((c) => c.id === last.kind);
    if (match) return { ...match, grams: M.gramsOf(match.volumeMl, match.abv) };
    return { id: null, name: drinkName(last), volumeMl: last.volumeMl, abv: last.abv, icon: last.icon, grams: last.grams };
  }
  const p = PRESETS[0];
  return { ...p, grams: M.gramsOf(p.volumeMl, p.abv) };
}

const QUICK_DEFAULTS = ['pint', 'long', 'wine12', 'shot'];

/** Up to four recent distinct drinks, topped up with common presets. */
function quickList(state) {
  const cat = catalogue(state);
  const seen = new Set();
  const out = [];
  for (const x of [...state.drinks].reverse()) {
    const item = cat.find((c) => c.id === x.kind) || (x.volumeMl ? { id: null, name: x.name, volumeMl: x.volumeMl, abv: x.abv, icon: x.icon } : null);
    if (!item) continue;
    const key = item.id || `${item.name}|${item.volumeMl}|${item.abv}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === 4) return out;
  }
  for (const id of QUICK_DEFAULTS) {
    if (out.length >= 4) break;
    if (!seen.has(id)) out.push(PRESETS.find((p) => p.id === id));
  }
  return out;
}

let cache = { state: null };

function derive(state, now = Date.now()) {
  if (cache.state !== state) {
    const baseBody = M.makeBody(state.profile, state.settings.elimination);
    const cal = state.calibration;
    const factor = cal?.factor ?? 1;
    const elimination = cal?.elimination ?? state.settings.elimination;
    const body = M.makeBody(state.profile, elimination, factor);
    const calibrated = !!cal?.readings;
    cache = {
      state,
      baseBody,
      body,
      factor,
      calibrated,
      learnedElimination: cal?.elimination ?? null,
      bodies: { main: body, ...M.rangeBodies(body, calibrated, cal?.elimination != null) },
      sessions: M.splitSessions(state.drinks, body),
      stats: new Map(),
    };
    cache.feels = Fe.feelPoints(state.feels, cache.sessions, body);
  }
  const { body, bodies, sessions } = cache;
  const zone = { min: state.settings.zoneMin, max: state.settings.zoneMax };
  const last = sessions.at(-1) ?? null;
  const a = M.analyze(last, bodies, now, { zone, drivingLimit: state.settings.drivingLimit });
  const active = a.active ? last : null;
  const ref = refDrink(state);
  // Food is per night: a new night starts on an empty stomach until you say otherwise.
  const food = active ? state.settings.food : 'empty';
  const refIntake = { grams: ref.grams, food, sipMin: sipMinutesFor(ref) };
  const done = active && state.doneUntil && state.doneUntil > now;
  const guidance = done ? { kind: 'done' } : M.nextDrink(active ? active.drinks : [], body, now, a.bac, zone, refIntake);

  const sessionWater = active ? state.water.filter((w) => w.t >= active.start && w.t <= now) : [];
  const lastWater = sessionWater.at(-1)?.t ?? -Infinity;
  const drinksSinceWater = active ? active.drinks.filter((x) => x.t > lastWater).length : 0;
  const lone = M.curve([{ ...refIntake, t: 0 }], body, 0, 4 * HOUR);

  const statsFor = (s) => {
    const until = s === active ? now : undefined;
    const key = `${s.start}:${s.drinks.length}:${until ?? ''}`;
    if (!cache.stats.has(key)) cache.stats.set(key, M.sessionStats(s, body, zone, until));
    return cache.stats.get(key);
  };

  const nightOf = (s) => {
    const id = nightKey(state, s);
    const isActive = s === active;
    const stats = statsFor(s);
    const score = Sc.zoneScore(stats.curve, zone);
    const meta = state.nights[id] || {};
    const feels = cache.feels.filter((f) => f.nightStart === s.start);
    const badges = isActive ? [] : Sc.sessionBadges({ session: s, score, water: state.water, readings: state.readings, rating: meta.rating, feels, calledAt: meta.calledAt });
    const waterList = state.water.filter((w) => w.t >= s.start && w.t <= (isActive ? now : s.soberAt));
    return { id, session: s, stats, score, badges, water: waterList.length, waterList, feels, name: meta.name || '', rating: meta.rating ?? null, skipped: !!meta.skipped, revealed: !!meta.revealed, calledAt: meta.calledAt ?? null, active: isActive };
  };
  let nightsMemo = null;
  const nights = () => (nightsMemo ??= sessions.map(nightOf));
  let gameMemo = null;
  const game = () => (gameMemo ??= gameState(state, nights(), now));

  return {
    now,
    body,
    baseBody: cache.baseBody,
    factor: cache.factor,
    calibrated: cache.calibrated,
    learnedElimination: cache.learnedElimination,
    food,
    sessions,
    active,
    a,
    zone,
    ref,
    guidance,
    quick: quickList(state),
    sessionWater,
    drinksSinceWater,
    lonePeak: Math.max(...lone.values),
    statsFor,
    nightOf,
    nights,
    game,
    feels: cache.feels,
    morning: morningCandidate(state, sessions, active, now, nightOf),
    reveal: revealCandidate(sessions, active, now, nightOf),
    live: active ? liveGoalsFor(state, nightOf(active), sessionWater.length) : null,
  };
}

/**
 * A night's identity for names, ratings and the celebration: whichever of its drinks already
 * carries that data, else its first drink. Survives editing or deleting the first drink.
 */
function nightKey(state, session) {
  return session.drinks.find((x) => state.nights[x.id] || state.celebrated.includes(x.id))?.id ?? session.drinks[0].id;
}

/** The night that deserves a "how was the morning?" check-in, if any. */
function morningCandidate(state, sessions, active, now, nightOf) {
  const last = [...sessions].reverse().find((s) => s !== active);
  if (!last) return null;
  const meta = state.nights[nightKey(state, last)] || {};
  if (meta.rating || meta.skipped) return null;
  const lastDrink = last.drinks.at(-1).t;
  const asked = now - lastDrink >= 6 * HOUR && new Date(now).getHours() >= 7 && Sc.dayKey(now) !== Sc.dayKey(lastDrink);
  if (!asked || now - last.soberAt > 36 * HOUR) return null;
  const night = nightOf(last);
  return night.stats.peak >= 0.2 ? night : null; // a single light drink isn't worth asking about
}

/** Weekly goals, streak and badge counts (night badges + weekly achievements). */
function gameState(state, nights, now) {
  const goals = state.settings.goals;
  const since = Math.min(state.acceptedAt ?? now, ...nights.map((n) => n.session.start));
  const weeks = Sc.weekReport(
    nights.map((n) => ({ start: n.session.start, grams: n.stats.grams, over: n.score.minutesOver > 0, peak: n.stats.peak })),
    now,
    goals,
    state.settings.standardGrams,
    since,
  );
  const finished = weeks.filter((w) => w.complete);
  const countsFor = (list) => {
    const counts = {};
    for (const n of list) for (const b of n.badges) counts[b] = (counts[b] || 0) + 1;
    counts['goal-week'] = finished.filter((w) => w.won).length;
    counts['dry-week'] = finished.filter((w) => w.days.every((x) => !x.drank)).length;
    return counts;
  };
  const scored = nights.filter((n) => !n.active && n.score.score != null);
  return {
    goals,
    weeks,
    week: weeks.at(-1),
    streak: Sc.weekStreak(weeks),
    counts: countsFor(nights),
    countsWithout: (night) => countsFor(nights.filter((n) => n !== night)),
    best: scored.reduce((m, n) => Math.max(m, n.score.score), 0),
    average: scored.length ? Math.round(scored.reduce((m, n) => m + n.score.score, 0) / scored.length) : null,
  };
}

/** The night that just ended and hasn't had its reveal yet. */
function revealCandidate(sessions, active, now, nightOf) {
  const last = [...sessions].reverse().find((s) => s !== active);
  if (!last || now - last.soberAt > 36 * HOUR) return null;
  const night = nightOf(last);
  return night.revealed ? null : night;
}

function liveGoalsFor(state, night, water) {
  return Sc.liveGoals({ drinks: night.session.drinks.length, water, checkins: night.feels.length, score: night.score, calledAt: night.calledAt });
}

/** Toast the moment a live goal flips to done. */
function announceLive(before) {
  const after = derive(S.getState()).live;
  if (!before || !after) return;
  const done = after.find((g) => g.done && !before.find((b) => b.id === g.id)?.done);
  if (done) setTimeout(() => toast(`${Sc.BADGES[done.id].emoji} ${Sc.BADGES[done.id].name} — earned tonight`), 900);
}

/** Refit the personal model from all breathalyzer readings. */
function refitCalibration(state) {
  if (!state.readings.length) return null;
  const base = M.makeBody(state.profile, state.settings.elimination);
  const groups = M.splitSessions(state.drinks, base)
    .map((s) => ({ drinks: s.drinks, readings: state.readings.filter((r) => r.t >= s.start && r.t <= s.soberAt + 30 * MINUTE) }))
    .filter((g) => g.readings.length);
  const fit = M.fitCalibration(state.profile, state.settings.elimination, groups);
  return fit.readings ? fit : null;
}

function ctx(state, d = derive(state)) {
  return { state, d, ui, install, reminders, catalogue: catalogue(state) };
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

function render() {
  const state = S.getState();
  applyTheme(state.settings.theme);
  if (!state.acceptedAt || !state.profile) {
    renderOnboarding(state);
    return;
  }
  app.className = `app tab-${ui.tab}`;
  const c = ctx(state);
  const { d } = c;
  const view = ui.tab === 'history' ? historyView(c) : ui.tab === 'settings' ? settingsView(c) : nowView(c);
  const chip = d.active && ui.tab === 'now' ? `<span class="chip"><span class="dot"></span>Session · ${F.duration(d.now - d.active.start)}</span>` : '';
  app.innerHTML = `
    <header class="topbar"><div class="brand"><img src="icons/icon.svg" alt="">Optihol</div>${chip}</header>
    <main>${view}</main>
    ${ui.tab === 'now' ? dockView(c) : ''}
    <nav class="nav" aria-label="Main"><div class="nav-inner">
      ${['now', 'history', 'settings']
        .map((t) => `<button data-action="tab" data-tab="${t}" ${ui.tab === t ? 'aria-current="page"' : ''}>${ICONS[t]}${t[0].toUpperCase() + t.slice(1)}</button>`)
        .join('')}
    </div></nav>`;
  if (ui.tab === 'now') afterNow(state, d);
  if (ui.sheet) renderSheet();
  scheduleReminder(state, d);
  maybeCelebrate(state, d);
}

function renderOnboarding(state) {
  if (!ui.ob) {
    ui.ob = {
      step: 0,
      age18: false,
      estimates: false,
      profile: state.profile ? { ...state.profile } : { sex: 'male', weightKg: '', heightCm: '', age: '' },
      zoneMin: state.settings.zoneMin,
      zoneMax: state.settings.zoneMax,
      drivingLimit: state.settings.drivingLimit,
      unit: state.settings.unit,
    };
  }
  app.className = 'app onboarding';
  app.innerHTML = onboardingView(ui.ob);
}

function afterNow(state, d) {
  const { a, active } = d;
  const unit = state.settings.unit;
  // Animate the number from what was on screen before.
  const numEl = app.querySelector('[data-num]');
  const from = ui.shownBac ?? 0;
  const to = a.bac;
  ui.shownBac = to;
  if (numEl && Math.abs(from - to) > 0.004 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      numEl.textContent = F.bacNumber(from + (to - from) * e, unit);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else if (numEl) numEl.textContent = F.bacNumber(to, unit);

  const el = document.getElementById('timeline');
  if (!el || !active) return;
  const start = Math.max(active.start - 10 * MINUTE, d.now - 5 * HOUR);
  const end = Math.min(Math.max(a.soberAt, d.now + HOUR) + 10 * MINUTE, d.now + 8 * HOUR);
  const at = (track, t) => (t <= d.now ? M.valueAt(track.past, t) : M.valueAt(track.future, t));
  const points = [];
  for (let t = start; t <= end; t += 2 * MINUTE) points.push([t, at(a, t)]);
  points.push([d.now, a.bac]);
  points.sort((p, q) => p[0] - q[0]);
  mountTimeline(el, {
    points,
    band: points.map(([t]) => [t, at(a.band.low, t), at(a.band.high, t)]),
    now: d.now,
    start,
    end,
    zone: d.zone,
    drivingLimit: state.settings.drivingLimit,
    drinks: active.drinks.map((x) => x.t),
    feels: d.feels.filter((f) => f.nightStart === active.start),
    unit,
  });
}

function renderSheet() {
  if (!ui.sheet) return;
  const focusedId = document.activeElement?.id;
  const c = ctx(S.getState());
  sheetRoot.innerHTML = `<div class="scrim" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${sheetTitle(ui.sheet.type)}">
      <div class="sheet-grip"></div>${sheetView(ui.sheet, c)}</div>`;
  if (focusedId) document.getElementById(focusedId)?.focus();
}

function openSheet(sheet) {
  ui.sheet = sheet;
  renderSheet();
}

function closeSheet() {
  ui.sheet = null;
  sheetRoot.innerHTML = '';
}

/** The first time a session enters the zone, make a little moment of it. */
function maybeCelebrate(state, d) {
  if (!d.active || d.a.status !== 'zone') return;
  if (d.active.drinks.some((x) => state.celebrated.includes(x.id))) return;
  const id = nightKey(state, d.active);
  ui.celebrateUntil = Date.now() + 2600;
  app.querySelector('.hero')?.classList.add('celebrate');
  toast('🎯 You’re in the zone — nice pacing');
  setTimeout(() => S.update((s) => (s.celebrated = [...s.celebrated.slice(-50), id])), 0);
}

// ---------------------------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------------------------

let toastTimer;
function toast(message, action) {
  clearTimeout(toastTimer);
  toastRoot.innerHTML = `<div class="toast"><span>${F.esc(message)}</span>${action ? `<button>${action.label}</button>` : ''}</div>`;
  if (action) {
    toastRoot.querySelector('button').onclick = () => {
      toastRoot.innerHTML = '';
      action.run();
    };
  }
  toastTimer = setTimeout(() => (toastRoot.innerHTML = ''), 5000);
}

// ---------------------------------------------------------------------------------------------
// Reminders (while the app is open or backgrounded; there is no push server)
// ---------------------------------------------------------------------------------------------

let reminderTimer = null;
let reminderFor = null;
let lastReminded = null;

function scheduleReminder(state, d) {
  const g = d.guidance;
  const wanted = state.settings.reminders && reminders.permission === 'granted' && d.active && g.kind === 'later' && g.at;
  const key = wanted ? Math.round(g.at / (5 * MINUTE)) : null;
  if (key === reminderFor) return;
  clearTimeout(reminderTimer);
  reminderFor = key;
  if (!wanted || key === lastReminded) return;
  reminderTimer = setTimeout(() => {
    lastReminded = key;
    if (document.visibilityState === 'visible') return toast('Your next drink fits now');
    notify('Next drink fits now', `Your next ${d.ref.name} won’t take you over ${F.bac(d.zone.max, state.settings.unit)}.`);
  }, Math.max(0, g.at - Date.now()));
}

async function notify(title, body) {
  const options = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'optihol-next-drink' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, options);
    new Notification(title, options);
  } catch (err) {
    console.error('Notification failed', err);
  }
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

function buzz() {
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(12);
}

function logDrink(item, minsAgo = 0) {
  const d = derive(S.getState());
  if (!d.active && S.getState().settings.food !== 'empty') S.update((s) => (s.settings.food = 'empty'));
  const entry = S.addDrink({
    t: Date.now() - minsAgo * MINUTE,
    grams: M.gramsOf(item.volumeMl, item.abv),
    name: item.name,
    volumeMl: item.volumeMl,
    abv: item.abv,
    icon: item.icon,
    kind: item.id ?? null,
    food: d.food,
    sipMin: sipMinutesFor(item),
  });
  buzz();
  toast(`${item.name} added`, { label: 'Undo', run: () => S.removeDrink(entry.id) });
}

function logWater(minsAgo = 0) {
  const before = derive(S.getState()).live;
  const entry = S.addWater(Date.now() - minsAgo * MINUTE);
  announceLive(before);
  buzz();
  toast(minsAgo ? `Water logged at ${F.time(entry.t)}` : 'Water logged — nice', { label: 'Undo', run: () => S.removeWater(entry.id) });
}

function deleteWater(id) {
  const entry = S.getState().water.find((w) => w.id === id);
  if (!entry) return;
  S.removeWater(id);
  toast('Water removed', { label: 'Undo', run: () => S.restoreWater(entry) });
}

function deleteDrink(id) {
  const state = S.getState();
  const drink = state.drinks.find((x) => x.id === id);
  if (!drink) return;
  const session = derive(state).sessions.find((s) => s.drinks.includes(drink));
  const sibling = session?.drinks.find((x) => x.id !== id);
  if (sibling && (state.nights[id] || state.celebrated.includes(id))) S.moveNightKey(id, sibling.id);
  S.removeDrink(drink.id);
  toast(`${drinkName(drink)} removed`, { label: 'Undo', run: () => S.restoreDrink(drink) });
}

function clampZone(min, max, key) {
  const r = (v) => Math.round(v * 100) / 100;
  min = r(Math.min(Math.max(min, S.ZONE_LIMITS.min), S.ZONE_LIMITS.max - 0.1));
  max = r(Math.min(Math.max(max, S.ZONE_LIMITS.min + 0.1), S.ZONE_LIMITS.max));
  if (max - min < 0.1) {
    if (key === 'zoneMin') max = r(min + 0.1);
    else min = r(max - 0.1);
  }
  return { zoneMin: min, zoneMax: max };
}

async function toggleReminders() {
  const s = S.getState().settings;
  if (s.reminders && reminders.permission === 'granted') {
    S.update((st) => (st.settings.reminders = false));
    return toast('Reminders off');
  }
  if (!reminders.supported) return toast('Notifications aren’t available in this browser');
  const result = reminders.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result !== 'granted') {
    S.update((st) => (st.settings.reminders = false));
    return toast('Notifications are blocked for this site');
  }
  S.update((st) => (st.settings.reminders = true));
  toast('We’ll nudge you when your next drink fits');
}

const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    render();
    scrollTo({ top: 0 });
  },
  'toggle-drinks'() {
    ui.showAllDrinks = !ui.showAllDrinks;
    render();
  },
  htab(el) {
    ui.historyTab = el.dataset.value;
    render();
    scrollTo({ top: 0 });
  },
  add: () => openSheet({ type: 'add', selId: refDrink(S.getState()).id ?? PRESETS[0].id, minsAgo: 0 }),
  'quick-add': () => logDrink(refDrink(S.getState())),
  quick(el) {
    const item = derive(S.getState()).quick[Number(el.dataset.index)];
    if (item) logDrink(item);
  },
  water: () => logWater(),
  'delete-water': (el) => deleteWater(el.dataset.id),
  done() {
    const d = derive(S.getState());
    const key = d.active ? nightKey(S.getState(), d.active) : null;
    S.update((s) => {
      s.doneUntil = d.a.soberAt;
      if (key) s.nights[key] = { ...s.nights[key], calledAt: d.now };
    });
    if (key) toast('🌙 Called it. Stick to it and the badge is yours.');
  },
  undone() {
    const d = derive(S.getState());
    const key = d.active ? nightKey(S.getState(), d.active) : null;
    S.update((s) => {
      s.doneUntil = null;
      if (key && s.nights[key]) delete s.nights[key].calledAt;
    });
  },
  food(el) {
    const food = el.dataset.value;
    const d = derive(S.getState());
    // Eating now changes drinks still in your stomach (roughly the last hour), not earlier ones.
    const since = d.now - HOUR;
    const ids = new Set(d.active ? d.active.drinks.filter((x) => x.t + (x.sipMin || 0) * MINUTE >= since).map((x) => x.id) : []);
    S.update((s) => {
      s.settings.food = food;
      s.drinks.forEach((x) => ids.has(x.id) && (x.food = food));
    });
  },
  'delete-drink': (el) => deleteDrink(el.dataset.id),
  'edit-drink'(el) {
    const x = S.getState().drinks.find((dr) => dr.id === el.dataset.id);
    if (x) openSheet({ type: 'edit', id: x.id, t: x.t });
  },
  reading: () => openSheet({ type: 'reading', minsAgo: 0, value: null }),
  'reset-calibration'() {
    if (!confirm('Forget all breathalyzer readings and go back to the average model?')) return;
    S.update((s) => {
      s.readings = [];
      s.calibration = null;
    });
    toast('Calibration reset');
  },
  'toggle-reminder': toggleReminders,
  night(el) {
    const id = el.dataset.id;
    const night = derive(S.getState()).nights().find((n) => n.id === id);
    ui.revealing = night && !night.active && !night.revealed ? id : null;
    openSheet({ type: 'night', id });
    if (ui.revealing) S.setNight(id, { revealed: true });
  },
  'dismiss-reveal': (el) => S.setNight(el.dataset.id, { revealed: true, ...(el.dataset.skipRating ? { skipped: true } : {}) }),
  goal(el) {
    const { key, dir } = el.dataset;
    S.update((s) => {
      const g = s.settings.goals;
      if (key === 'freeDays') g.freeDays = Math.min(7, Math.max(0, g.freeDays + Number(dir)));
      if (key === 'neverOver') g.neverOver = !g.neverOver;
    });
  },
  rate(el) {
    const rating = Number(el.dataset.value);
    S.setNight(el.dataset.id, { rating, ratedAt: Date.now() });
    toast(rating >= 4 ? 'Noted — a fresh morning 🌅' : rating <= 2 ? 'Noted. Water and rest today 💧' : 'Noted');
  },
  feel(el) {
    const d = derive(S.getState());
    if (!d.active) return;
    const feel = el.dataset.value;
    const before = d.live;
    const entry = S.addFeel(feel);
    announceLive(before);
    buzz();
    const at = F.bac(d.a.bac, S.getState().settings.unit);
    const msg = { zone: `🎯 In the zone at ${at} — noted`, under: `🌱 Not yet at ${at} — noted`, over: `🌀 Too much at ${at} — water time?` }[feel];
    toast(msg, { label: 'Undo', run: () => S.removeFeel(entry.id) });
  },
  'delete-feel': (el) => S.removeFeel(el.dataset.id),
  'use-feel-zone'(el) {
    const zoneMin = Number(el.dataset.min);
    const zoneMax = Number(el.dataset.max);
    const prev = { ...S.getState().settings };
    S.update((s) => Object.assign(s.settings, { zoneMin, zoneMax }));
    toast(`Zone set to ${F.bacNumber(zoneMin, prev.unit)}–${F.bacNumber(zoneMax, prev.unit)} from how you feel`, {
      label: 'Undo',
      run: () => S.update((s) => Object.assign(s.settings, { zoneMin: prev.zoneMin, zoneMax: prev.zoneMax })),
    });
  },
  'skip-morning': (el) => S.setNight(el.dataset.id, { skipped: true }),
  badge(el) {
    const b = Sc.BADGES[el.dataset.id];
    if (b) toast(`${b.emoji} ${b.name}: ${b.desc}`);
  },
  async install() {
    if (!install.prompt) return;
    install.prompt.prompt();
    await install.prompt.userChoice.catch(() => null);
    install.prompt = null;
    render();
  },
  'dismiss-install': () => S.update((s) => (s.installDismissed = true)),
  // settings
  setting(el) {
    const { key, value } = el.dataset;
    S.update((s) => (s.settings[key] = value));
  },
  'profile-sex'(el) {
    if (ui.ob) {
      ui.ob.profile.sex = el.dataset.value;
      return render();
    }
    S.update((s) => (s.profile.sex = el.dataset.value));
  },
  'zone-step'(el) {
    const key = el.dataset.key;
    const delta = 0.05 * Number(el.dataset.dir);
    const src = ui.ob || S.getState().settings;
    const next = clampZone(key === 'zoneMin' ? src.zoneMin + delta : src.zoneMin, key === 'zoneMax' ? src.zoneMax + delta : src.zoneMax, key);
    if (ui.ob) {
      Object.assign(ui.ob, next);
      return render();
    }
    S.update((s) => Object.assign(s.settings, next));
  },
  'zone-preset'(el) {
    const next = { zoneMin: Number(el.dataset.min), zoneMax: Number(el.dataset.max) };
    if (ui.ob) {
      Object.assign(ui.ob, next);
      return render();
    }
    S.update((s) => Object.assign(s.settings, next));
  },
  'new-custom'() {
    openSheet({ type: 'custom', from: ui.sheet?.type === 'add' ? 'add' : null, draft: { name: '', volumeMl: 330, abv: 5, icon: 'pint' } });
    document.getElementById('c-name')?.focus();
  },
  'delete-custom'(el) {
    S.update((s) => (s.customDrinks = s.customDrinks.filter((c) => c.id !== el.dataset.id)));
  },
  export() {
    const blob = new Blob([S.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `optihol-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import() {
    document.getElementById('import-file')?.click();
  },
  erase() {
    if (!confirm('Erase all Optihol data on this device? This can’t be undone.')) return;
    ui.ob = null;
    ui.tab = 'now';
    ui.shownBac = null;
    S.eraseAll();
  },
  // onboarding
  'ob-next'() {
    ui.ob.step++;
    render();
    scrollTo({ top: 0 });
  },
  'ob-back'() {
    ui.ob.step--;
    render();
  },
  'ob-unit'(el) {
    ui.ob.unit = el.dataset.value;
    render();
  },
  'ob-finish'() {
    const ob = ui.ob;
    const p = ob.profile;
    S.update((s) => {
      s.acceptedAt = Date.now();
      s.profile = { sex: p.sex, weightKg: +p.weightKg, heightCm: +p.heightCm, age: +p.age };
      Object.assign(s.settings, { zoneMin: ob.zoneMin, zoneMax: ob.zoneMax, drivingLimit: ob.drivingLimit, unit: ob.unit });
    });
    ui.ob = null;
    render();
    scrollTo({ top: 0 });
  },
};

const sheetActions = {
  'close-sheet': closeSheet,
  rate: (el) => actions.rate(el),
  'delete-feel': (el) => actions['delete-feel'](el),
  badge: (el) => actions.badge(el),
  'edit-drink': (el) => actions['edit-drink'](el),
  'delete-drink': (el) => deleteDrink(el.dataset.id),
  async share(el) {
    const state = S.getState();
    const night = derive(state).nights().find((n) => n.id === el.dataset.id);
    if (!night) return;
    el.disabled = true;
    try {
      const result = await shareNight(night, { zone: { min: state.settings.zoneMin, max: state.settings.zoneMax }, unit: state.settings.unit, standardGrams: state.settings.standardGrams });
      if (result === 'downloaded') toast('Recap image saved');
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Couldn’t share — try again');
    } finally {
      el.disabled = false;
    }
  },
  pick(el) {
    ui.sheet.selId = el.dataset.id;
    renderSheet();
  },
  when(el) {
    ui.sheet.minsAgo = Number(el.dataset.value);
    renderSheet();
  },
  'confirm-add'() {
    const { selId, minsAgo } = ui.sheet;
    closeSheet();
    if (selId === 'water') return logWater(minsAgo);
    const item = catalogue(S.getState()).find((i) => i.id === selId);
    if (item) logDrink(item, minsAgo);
  },
  'delete-water': (el) => deleteWater(el.dataset.id),
  'new-custom': actions['new-custom'],
  'custom-icon'(el) {
    ui.sheet.draft.icon = el.dataset.value;
    renderSheet();
  },
  'save-custom'() {
    const c = ui.sheet.draft;
    const entry = { id: `c-${S.uid()}`, name: c.name.trim(), volumeMl: +c.volumeMl, abv: +c.abv, icon: c.icon };
    const from = ui.sheet.from;
    S.update((s) => s.customDrinks.push(entry));
    if (from === 'add') openSheet({ type: 'add', selId: entry.id, minsAgo: 0 });
    else closeSheet();
    toast(`${entry.name} saved to your drinks`);
  },
  nudge(el) {
    const now = Date.now();
    ui.sheet.t = Math.min(now, Math.max(now - 24 * HOUR, ui.sheet.t + Number(el.dataset.value) * MINUTE));
    renderSheet();
  },
  'save-edit'() {
    const { id, t } = ui.sheet;
    closeSheet();
    S.updateDrink(id, { t });
    toast(`Moved to ${F.time(t)}`);
  },
  'delete-from-edit'() {
    const id = ui.sheet.id;
    closeSheet();
    deleteDrink(id);
  },
  'reading-when'(el) {
    ui.sheet.minsAgo = Number(el.dataset.value);
    renderSheet();
  },
  'save-reading'() {
    const state = S.getState();
    const d = derive(state);
    if (!d.active) return;
    const t = d.now - ui.sheet.minsAgo * MINUTE;
    const measured = state.settings.unit === 'percent' ? ui.sheet.value * 10 : ui.sheet.value;
    if (M.bacAt(d.active.drinks, d.baseBody, t) < 0.05 || measured < 0.05) {
      sheetRoot.querySelector('#r-hint').textContent = `Readings work once you’re above ${F.bac(0.05, state.settings.unit)}. Try again later in the night.`;
      return;
    }
    const before = state.calibration;
    const next = { ...state, readings: [...state.readings, { id: S.uid(), t, measured }] };
    const fit = refitCalibration(next);
    S.update((s) => {
      s.readings = next.readings;
      s.calibration = fit;
    });
    closeSheet();
    const pct = Math.round(((fit?.factor ?? 1) - 1) * 100);
    const size = pct === 0 ? 'you match the average body' : `you read ${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than average`;
    const rate = fit?.elimination != null && fit.elimination !== before?.elimination ? ` · you burn ${F.bac(fit.elimination, state.settings.unit)}/h` : '';
    toast(`Calibrated — ${size}${rate}`);
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el, e);
});

sheetRoot.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  sheetActions[el.dataset.action]?.(el, e);
});

sheetRoot.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.nightName) S.setNight(t.dataset.nightName, { name: t.value.trim().slice(0, 40) });
});

sheetRoot.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.rfield) {
    ui.sheet.value = t.value === '' ? null : Number(t.value);
    const btn = sheetRoot.querySelector('[data-action="save-reading"]');
    btn.disabled = !(ui.sheet.value > 0) || btn.dataset.toosoon === '1';
    return;
  }
  const key = t.dataset.cfield;
  if (!key || !ui.sheet?.draft) return;
  ui.sheet.draft[key] = key === 'name' ? t.value : Number(t.value);
  sheetRoot.querySelector('[data-action="save-custom"]').disabled = !customValid(ui.sheet.draft);
  sheetRoot.querySelector('#c-grams').textContent = gramsHint(ui.sheet.draft);
});

app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.ob) {
    ui.ob[t.dataset.ob] = t.checked;
    app.querySelector('[data-action="ob-next"]').disabled = !(ui.ob.age18 && ui.ob.estimates);
    return;
  }
  if (!t.dataset.field) return;
  const scope = t.closest('[data-scope]')?.dataset.scope;
  if (scope === 'ob-profile') {
    ui.ob.profile[t.dataset.field] = t.value === '' ? '' : Number(t.value);
    app.querySelector('[data-action="ob-next"]').disabled = !profileValid(ui.ob.profile);
  }
  if (t.dataset.field === 'elimination') {
    const s = S.getState().settings;
    document.getElementById('elim-out').textContent = `${F.bac(Number(t.value), s.unit)}/h`;
  }
});

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'import-file' && t.files?.[0]) {
    t.files[0].text().then((text) => {
      try {
        S.importJson(text);
        toast('Data imported');
      } catch {
        toast('That file isn’t an Optihol export');
      }
    });
    return;
  }
  const key = t.dataset.field;
  if (!key) return;
  const scope = t.closest('[data-scope]')?.dataset.scope;
  if (scope === 'ob-zone') {
    ui.ob.drivingLimit = Number(t.value);
    return;
  }
  if (scope === 'profile') {
    const v = Number(t.value);
    const next = { ...S.getState().profile, [key]: v };
    if (!profileValid(next)) {
      toast('That doesn’t look right — check the value');
      t.value = S.getState().profile[key];
      return;
    }
    S.update((s) => (s.profile[key] = v));
    return;
  }
  if (['drivingLimit', 'elimination', 'standardGrams'].includes(key)) S.update((s) => (s.settings[key] = Number(t.value)));
  if (key === 'maxStd') S.update((s) => (s.settings.goals.maxStd = Number(t.value)));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.sheet) closeSheet();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.prompt = e;
  if (ui.tab === 'now') render();
});
window.addEventListener('appinstalled', () => {
  install.prompt = null;
  install.standalone = true;
});

S.subscribe(() => render());

// Keep the numbers live.
setInterval(() => {
  if (document.visibilityState !== 'visible' || ui.tab !== 'now' || !S.getState().profile) return;
  if (ui.sheet) return renderSheet();
  render();
}, 15_000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && render());

// Home-screen shortcuts and links like ./?log=pint or ./?log=water
function handleDeepLink() {
  const params = new URLSearchParams(location.search);
  const what = params.get('log');
  if (!what) return;
  history.replaceState(null, '', location.pathname);
  const state = S.getState();
  if (!state.acceptedAt || !state.profile) return;
  if (what === 'water') return logWater();
  const item = catalogue(state).find((c) => c.id === what);
  if (item) logDrink(item);
}

// Boot.
{
  const st = S.getState();
  if (st.readings.length && !st.calibration && st.profile) S.update((s) => (s.calibration = refitCalibration(s)));
}
render();
handleDeepLink();
S.migrateFromV1().then((migrated) => {
  if (migrated) toast('Imported your data from the previous Optihol');
});

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isLocal) {
  navigator.serviceWorker.register('sw.js');
}
