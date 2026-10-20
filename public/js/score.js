// Fun layer on top of the model: zone score, badges and tiers, weekly goals and streaks,
// calendar, insights. Pure functions, no DOM.
//
// Ground rule: nothing rewards drinking more or more often. Scores and badges reward precision
// (staying inside the zone), pacing, water, stopping on purpose, reflection and alcohol-free
// days. Streaks are weekly and a dry week always wins.

import { HOUR, MINUTE, statusOf } from './model.js';

export const GRADES = {
  bullseye: { label: 'Bullseye', min: 90 },
  dialed: { label: 'Dialed in', min: 75 },
  wobbly: { label: 'A bit wobbly', min: 55 },
  overshot: { label: 'Overshot', min: 0 },
  patchy: { label: 'Patchy', min: 0 },
  easy: { label: 'Took it easy', min: null },
};

/**
 * Zone score for one session curve: the share of your "up" time spent inside the zone,
 * minus points for going over. Sessions that never reach the zone get no score at all
 * (so the game never pushes you to drink more).
 */
export function zoneScore(cv, zone) {
  const v = cv.values;
  const stepMin = cv.step / MINUTE;
  const first = v.findIndex((x) => x >= zone.min);
  const peak = v.reduce((m, x) => Math.max(m, x), 0);
  if (first < 0) return { score: null, grade: 'easy', reached: false, minutesInZone: 0, minutesOver: 0, peak };
  let last = v.length - 1;
  while (last > first && v[last] < zone.min) last--;
  let inZone = 0;
  let over = 0;
  let overArea = 0; // ‰·min above the zone
  for (let i = first; i <= last; i++) {
    if (v[i] > zone.max) {
      over++;
      overArea += (v[i] - zone.max) * stepMin;
    } else if (v[i] >= zone.min) inZone++;
  }
  const share = inZone / (last - first + 1);
  let score = Math.round(Math.min(100, Math.max(0, 100 * share - Math.min(60, overArea * 2.5))));
  if (statusOf(peak, zone) === 'high') score = Math.min(score, 40);
  const grade = score >= 90 ? 'bullseye' : score >= 75 ? 'dialed' : score >= 55 ? 'wobbly' : over ? 'overshot' : 'patchy';
  return { score, grade, reached: true, minutesInZone: inZone * stepMin, minutesOver: over * stepMin, peak };
}

export const BADGES = {
  bullseye: { emoji: '🎯', name: 'Bullseye', desc: 'Zone score 90+ with an hour in the zone' },
  'never-over': { emoji: '🧊', name: 'Cool head', desc: 'Reached your zone and never went over' },
  hydrated: { emoji: '💧', name: 'Hydrated', desc: 'A glass of water for every two drinks' },
  'slow-sipper': { emoji: '🐢', name: 'Slow sipper', desc: '3+ drinks, 45+ minutes apart on average' },
  'called-it': { emoji: '🌙', name: 'Called it', desc: 'Tapped “Done for tonight” and stuck to it' },
  easy: { emoji: '🍃', name: 'Easy does it', desc: 'Kept it light — stayed under your zone' },
  calibrated: { emoji: '📏', name: 'Scientist', desc: 'Took a breathalyzer reading' },
  fresh: { emoji: '🌅', name: 'Fresh morning', desc: 'Rated the morning after 4 or 5' },
  'tuned-in': { emoji: '🧘', name: 'Tuned in', desc: 'Checked in on how you feel twice in a night' },
  'goal-week': { emoji: '🗓️', name: 'Goal week', desc: 'Met every weekly goal, Monday to Sunday', weekly: true },
  'dry-week': { emoji: '🌿', name: 'Dry week', desc: 'A whole week without alcohol', weekly: true },
  crew: { emoji: '🤝', name: 'Crew captain', desc: 'Invited friends to pace a night together', weekly: true },
};

export const TIERS = [
  { n: 1, name: 'Bronze' },
  { n: 5, name: 'Silver' },
  { n: 15, name: 'Gold' },
];

/** Where a badge count sits on the Bronze / Silver / Gold ladder. */
export function tierOf(count) {
  const index = TIERS.findLastIndex((t) => count >= t.n);
  const next = TIERS[index + 1] ?? null;
  const from = index >= 0 ? TIERS[index].n : 0;
  return {
    index,
    name: index >= 0 ? TIERS[index].name : null,
    next,
    toNext: next ? next.n - count : 0,
    progress: next ? (count - from) / (next.n - from) : 1,
  };
}

/** Badges whose tier went up between two count maps: [{ id, tier }]. */
export function tierUps(before, after) {
  return Object.keys(after)
    .filter((id) => tierOf(after[id] || 0).index > tierOf(before[id] || 0).index)
    .map((id) => ({ id, tier: tierOf(after[id]).name }));
}

/** Badges earned in one session. */
export function sessionBadges({ session, score, water = [], readings = [], rating = null, feels = [], calledAt = null }) {
  const drinks = session.drinks;
  const out = [];
  const end = session.soberAt;
  if (score.score >= 90 && score.minutesInZone >= 60) out.push('bullseye');
  if (score.reached && score.minutesOver === 0) out.push('never-over');
  const sips = water.filter((w) => w.t >= session.start && w.t <= end).length;
  if (drinks.length >= 2 && sips >= Math.ceil(drinks.length / 2)) out.push('hydrated');
  if (drinks.length >= 3) {
    const gap = (drinks.at(-1).t - drinks[0].t) / (drinks.length - 1);
    if (gap >= 45 * MINUTE) out.push('slow-sipper');
  }
  if (calledAt && !drinks.some((x) => x.t > calledAt)) out.push('called-it');
  if (!score.reached) out.push('easy');
  if (readings.some((r) => r.t >= session.start && r.t <= end)) out.push('calibrated');
  if (rating >= 4) out.push('fresh');
  if (feels.length >= 2) out.push('tuned-in');
  return out;
}

/** Local date key for "drinking days": anything before 6 am counts as the night before. */
export function dayKey(t) {
  const d = new Date(t - 6 * HOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(t) {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Calendar grid for the last `weeks` weeks (Monday-first columns).
 * @param nights  [{ start, peak }] — one entry per session
 * @returns [{ key, t, future, today, peak|null }] in column-major order (week by week)
 */
export function calendar(nights, now, weeks = 12) {
  const byDay = new Map();
  for (const n of nights) {
    const k = dayKey(n.start);
    byDay.set(k, Math.max(byDay.get(k) ?? 0, n.peak));
  }
  const start = mondayOf(now);
  start.setDate(start.getDate() - 7 * (weeks - 1));
  const todayKey = dayKey(now);
  const days = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const t = d.getTime();
    const key = dayKey(t + 6 * HOUR);
    days.push({ key, t, future: t > now && key !== todayKey, today: key === todayKey, peak: byDay.has(key) ? byDay.get(key) : null });
  }
  return days;
}

/** Alcohol-free days among the last `days` days (today included). */
export function alcoholFreeDays(nights, now, days = 7) {
  const drinking = new Set(nights.map((n) => dayKey(n.start)));
  let free = 0;
  for (let i = 0; i < days; i++) if (!drinking.has(dayKey(now - i * 24 * HOUR))) free++;
  return free;
}

/** Full Monday–Sunday weeks with no drinking, since the first ever session. */
export function dryWeeks(nights, now) {
  if (!nights.length) return 0;
  const drinking = new Set(nights.map((n) => dayKey(n.start)));
  const first = mondayOf(Math.min(...nights.map((n) => n.start)));
  const thisMonday = mondayOf(now);
  let count = 0;
  for (const w = new Date(first); w < thisMonday; w.setDate(w.getDate() + 7)) {
    let dry = true;
    for (let i = 0; i < 7 && dry; i++) {
      const d = new Date(w);
      d.setDate(w.getDate() + i);
      if (drinking.has(dayKey(d.getTime() + 6 * HOUR))) dry = false;
    }
    if (dry) count++;
  }
  return count;
}

export const DEFAULT_GOALS = { freeDays: 4, neverOver: true, maxStd: 0 };

/**
 * Weekly goals, Monday to Sunday by drinking day, from the week you started.
 * @param nights  [{ start, grams, over, peak }] — one per night
 * @param since   ms; earlier weeks are ignored
 * @returns weeks, oldest first: { start, days: [{ t, key, state: 'past'|'today'|'future', drank, peak }],
 *   free, pending, std, over, complete, won (complete weeks) | status (current week) }
 */
export function weekReport(nights, now, goals, standardGrams, since) {
  const todayKey = dayKey(now);
  const byDay = new Map();
  for (const n of nights) {
    const k = dayKey(n.start);
    const e = byDay.get(k) || { grams: 0, over: false, peak: 0 };
    e.grams += n.grams;
    e.over ||= n.over;
    e.peak = Math.max(e.peak, n.peak ?? 0);
    byDay.set(k, e);
  }
  const weeks = [];
  const thisMonday = mondayOf(now);
  for (const w = mondayOf(Math.min(since, now)); w <= thisMonday; w.setDate(w.getDate() + 7)) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(w);
      d.setDate(w.getDate() + i);
      const key = dayKey(d.getTime() + 6 * HOUR);
      const e = byDay.get(key);
      const state = key === todayKey ? 'today' : key < todayKey ? 'past' : 'future';
      days.push({ t: d.getTime(), key, state, drank: !!e, peak: e?.peak ?? 0 });
    }
    const drinking = days.map((x) => byDay.get(x.key)).filter(Boolean);
    const free = days.filter((x) => x.state === 'past' && !x.drank).length;
    const pending = days.filter((x) => (x.state === 'today' && !x.drank) || x.state === 'future').length;
    const std = drinking.reduce((m, e) => m + e.grams, 0) / standardGrams;
    const over = drinking.some((e) => e.over);
    const complete = pending === 0 && !days.some((x) => x.state === 'today');
    const broken = (goals.neverOver && over) || (goals.maxStd > 0 && std > goals.maxStd);
    const week = { start: days[0].t, days, free, pending, std, over, complete };
    if (complete) week.won = !broken && free >= goals.freeDays;
    else {
      const need = Math.max(0, goals.freeDays - free);
      week.need = need;
      week.status = broken || free + pending < goals.freeDays ? 'lost' : need === 0 ? 'met' : free + pending === goals.freeDays ? 'tight' : 'on-track';
    }
    weeks.push(week);
  }
  return weeks;
}

/** Current and best run of won weeks (finished weeks only). */
export function weekStreak(weeks) {
  let run = 0;
  let best = 0;
  for (const w of weeks.filter((x) => x.complete)) {
    run = w.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/**
 * Progress on tonight's good-behaviour badges, for the live row during a night.
 * @returns [{ id, label, done, failed }]
 */
export function liveGoals({ drinks, water, checkins, score, calledAt }) {
  const needWater = Math.max(1, Math.ceil(drinks / 2));
  const out = [
    { id: 'hydrated', label: `${Math.min(water, needWater)}/${needWater}`, done: drinks >= 2 && water >= needWater },
    { id: 'tuned-in', label: `${Math.min(checkins, 2)}/2`, done: checkins >= 2 },
  ];
  if (score.reached) out.push({ id: 'never-over', label: score.minutesOver ? 'missed' : 'on track', done: false, failed: score.minutesOver > 0 });
  out.push({ id: 'called-it', label: calledAt ? 'done' : 'when you stop', done: !!calledAt });
  return out;
}

/**
 * Does your peak predict your morning? Needs three rated nights.
 * @param rated [{ peak, rating }]
 */
export function sweetSpot(rated) {
  if (rated.length < 3) return { ready: false, needed: 3 - rated.length };
  const sorted = [...rated].sort((a, b) => a.peak - b.peak);
  let best = null;
  for (let i = 1; i < sorted.length; i++) {
    const low = sorted.slice(0, i);
    const high = sorted.slice(i);
    const avg = (xs) => xs.reduce((m, x) => m + x.rating, 0) / xs.length;
    const diff = avg(low) - avg(high);
    if (!best || diff > best.diff) best = { diff, threshold: low.at(-1).peak, good: avg(low), bad: avg(high) };
  }
  if (best.diff < 0.75) return { ready: true, found: false };
  return { ready: true, found: true, threshold: Math.ceil(best.threshold * 20) / 20, good: best.good, bad: best.bad };
}
