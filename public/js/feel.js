// Subjective check-ins: "not yet", "in the zone", "too much", tapped during a night.
// Paired with the model's BAC at that moment they reveal where *you* actually feel it,
// how well the estimate matches your body, and whether that point drifts over time.
// Pure functions, no DOM.

import { HOUR, bacAt } from './model.js';

export const FEELS = {
  under: { emoji: '🌱', label: 'Not yet' },
  zone: { emoji: '🎯', label: 'In the zone' },
  over: { emoji: '🌀', label: 'Too much' },
};

const DAY = 24 * HOUR;

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Attach the estimated BAC (with the current, possibly calibrated body) and the session to
 * every check-in. Check-ins outside any session are dropped.
 */
export function feelPoints(feels, sessions, body) {
  const out = [];
  for (const f of feels) {
    const s = sessions.find((x) => f.t >= x.start && f.t <= x.soberAt + 30 * 60_000);
    if (!s) continue;
    out.push({ ...f, bac: bacAt(s.drinks, body, f.t), night: s.start, nightStart: s.start });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Where you feel in the zone: the middle half of your "in the zone" check-ins, nudged by
 * "not yet" / "too much" taps when they clearly disagree. Needs three zone check-ins.
 */
export function feelZone(points) {
  const zone = points.filter((p) => p.feel === 'zone').map((p) => p.bac).sort((a, b) => a - b);
  if (zone.length < 3) return { ready: false, needed: 3 - zone.length, count: zone.length };
  let low = quantile(zone, 0.25);
  let high = quantile(zone, 0.75);
  const median = quantile(zone, 0.5);
  const under = points.filter((p) => p.feel === 'under').map((p) => p.bac).sort((a, b) => a - b);
  const over = points.filter((p) => p.feel === 'over').map((p) => p.bac).sort((a, b) => a - b);
  if (under.length >= 2) low = Math.max(low, Math.min(median, quantile(under, 0.75)));
  if (over.length >= 2) high = Math.min(high, Math.max(median, quantile(over, 0.25)));
  if (high - low < 0.04) {
    low = median - 0.02;
    high = median + 0.02;
  }
  return { ready: true, count: zone.length, low: Math.max(0, low), high, median };
}

/** Share of check-ins where the estimate agrees with how you felt. */
export function agreement(points, zone) {
  if (points.length < 3) return null;
  const agree = points.filter((p) =>
    p.feel === 'zone' ? p.bac >= zone.min && p.bac <= zone.max : p.feel === 'under' ? p.bac < zone.max : p.bac > zone.min,
  ).length;
  return agree / points.length;
}

/** Zone suggestion from the feel zone, rounded to 0.05 ‰ and at least 0.1 ‰ wide. */
export function suggestZone(fz, limits = { min: 0.2, max: 1.0 }) {
  if (!fz.ready) return null;
  const r = (v) => Math.round(v * 20) / 20;
  let min = r(fz.low);
  let max = r(fz.high);
  if (max - min < 0.1) {
    const mid = r((fz.low + fz.high) / 2);
    min = r(mid - 0.05);
    max = r(mid + 0.05);
  }
  min = Math.min(Math.max(min, limits.min), limits.max - 0.1);
  max = Math.max(Math.min(max, limits.max), min + 0.1);
  return { min: r(min), max: r(max) };
}

/**
 * Per-night median of "in the zone" BAC and a least-squares trend through it.
 * `ready` once four nights have zone check-ins.
 */
export function feelTrend(points) {
  const byNight = new Map();
  for (const p of points.filter((x) => x.feel === 'zone')) {
    if (!byNight.has(p.night)) byNight.set(p.night, { t: p.nightStart, values: [] });
    byNight.get(p.night).values.push(p.bac);
  }
  const nights = [...byNight.values()]
    .map((n) => ({ t: n.t, bac: quantile([...n.values].sort((a, b) => a - b), 0.5) }))
    .sort((a, b) => a.t - b.t);
  if (nights.length < 4) return { ready: false, nights, needed: 4 - nights.length };
  const xs = nights.map((n) => (n.t - nights[0].t) / DAY);
  const ys = nights.map((n) => n.bac);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  const slopePerDay = den ? num / den : 0;
  const spanDays = xs.at(-1);
  const change = slopePerDay * spanDays;
  const direction = Math.abs(change) < 0.05 ? 'steady' : change > 0 ? 'up' : 'down';
  return { ready: true, nights, slopePerDay, intercept: my - slopePerDay * mx, change, spanDays, direction };
}
