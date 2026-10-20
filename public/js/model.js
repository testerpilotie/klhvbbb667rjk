// Optihol BAC model. Pure functions, no DOM — runs in the browser and in `node --test`.
//
// BAC is expressed in ‰ (g alcohol per litre of blood). Display code converts to %BAC.
//
// - Distribution volume: Watson total body water / 0.80 (water fraction of blood),
//   optionally personalised by breathalyzer readings (see fitCalibration).
// - Intake: a drink is sipped evenly over `sipMin` minutes from when it was logged (0 = a shot).
// - Absorption: first-order from the stomach; rate and bioavailability depend on what you ate.
// - Elimination: Michaelis–Menten. Close to the configured ‰/h at normal levels, slowing down
//   near zero the way liver enzymes do.
// - Uncertainty: the same curve with a "light" and a "heavy" body gives a likely range.
// The curve is integrated numerically at a 1-minute resolution.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
const STEP = MINUTE;
const ETHANOL_DENSITY = 0.789; // g/ml
const BLOOD_WATER_FRACTION = 0.8;
const ABSORBED_EPSILON_G = 0.05; // grams still in the gut we treat as "fully absorbed"
const KM = 0.05; // ‰, Michaelis constant of alcohol dehydrogenase (≈ 0.05–0.1 g/L)
const ZERO = 0.01; // ‰; the curve snaps to 0 below this
// ‰; "sober" means below this. It's what a breathalyzer shows as 0.00, and what people mean.
export const SOBER_BAC = 0.05;

export const FOOD = {
  empty: { ka: 4.0, bioavailability: 1.0 },
  snack: { ka: 3.0, bioavailability: 0.95 },
  meal: { ka: 2.0, bioavailability: 0.85 },
};

export const DEFAULT_ELIMINATION = 0.15; // ‰ per hour at normal levels

export function gramsOf(volumeMl, abvPercent) {
  return volumeMl * (abvPercent / 100) * ETHANOL_DENSITY;
}

/** Watson total body water, litres. */
export function totalBodyWater({ sex, weightKg, heightCm, age }) {
  if (sex === 'female') {
    return -2.097 + 0.1069 * heightCm + 0.2466 * weightKg;
  }
  return 2.447 - 0.09516 * age + 0.1074 * heightCm + 0.3362 * weightKg;
}

/**
 * Build the per-person constants every other function needs.
 * @param factor  personal calibration: >1 means you read higher than the average body.
 */
export function makeBody(profile, eliminationPerHour = DEFAULT_ELIMINATION, factor = 1) {
  const tbw = totalBodyWater(profile);
  return {
    volumeL: Math.max(tbw, 10) / BLOOD_WATER_FRACTION / factor,
    eliminationPerHour,
    eliminationPerMs: eliminationPerHour / HOUR,
  };
}

/**
 * Bodies at the edges of the likely range. Calibrated users get a narrower band.
 * `high` reads higher than `body` (smaller volume, slower burn-off), `low` reads lower.
 */
export function rangeBodies(body, calibrated = false, rateLearned = false) {
  const v = calibrated ? 0.06 : 0.12;
  const e = rateLearned ? 0.06 : calibrated ? 0.1 : 0.2;
  const variant = (vk, ek) => ({
    volumeL: body.volumeL * vk,
    eliminationPerHour: body.eliminationPerHour * ek,
    eliminationPerMs: body.eliminationPerMs * ek,
  });
  return { high: variant(1 - v, 1 - e), low: variant(1 + v, 1 + e) };
}

function foodOf(drink) {
  return FOOD[drink.food] || FOOD.empty;
}

/**
 * Grams of a drink's alcohol that have entered the blood by time t. The drink is swallowed at
 * an even rate over `sipMin` minutes; each sip is then absorbed first-order. Closed form of
 *   (total / D) · ∫₀^min(h, D) (1 − e^(−ka·(h − s))) ds.
 */
function absorbedBy(drink, t) {
  if (t <= drink.t) return 0;
  const { ka, bioavailability } = foodOf(drink);
  const total = drink.grams * bioavailability;
  const h = (t - drink.t) / HOUR;
  const D = (drink.sipMin || 0) / 60;
  if (D <= 0) return total * (1 - Math.exp(-ka * h));
  const u = Math.min(h, D);
  return (total * (u - (Math.exp(-ka * (h - u)) - Math.exp(-ka * h)) / ka)) / D;
}

function unabsorbedAt(drink, t) {
  const { bioavailability } = foodOf(drink);
  return drink.grams * bioavailability - absorbedBy(drink, t);
}

/** ‰ removed during one step at concentration c. Equals the nominal rate at 1 ‰. */
function eliminated(c, perStep) {
  return (perStep * (1 + KM) * c) / (KM + c);
}

/**
 * Integrate the BAC curve.
 * @param drinks  [{ t: ms, grams, food }]
 * @param body    from makeBody()
 * @param start   ms; drinks before start only contribute what they haven't absorbed yet,
 *                so pass the BAC at `start` as c0.
 * @param end     ms (inclusive, rounded up to a whole step)
 * @returns { start, step, values: number[] }  values[i] is BAC at start + i*step
 */
export function curve(drinks, body, start, end, c0 = 0) {
  const n = Math.max(0, Math.ceil((end - start) / STEP));
  const values = new Array(n + 1);
  let c = c0;
  values[0] = c;
  const sorted = drinks
    .filter((d) => d.t >= start || unabsorbedAt(d, start) > 1e-4)
    .sort((a, b) => a.t - b.t);
  const perStep = body.eliminationPerMs * STEP;
  for (let i = 1; i <= n; i++) {
    const t0 = start + (i - 1) * STEP;
    const t1 = t0 + STEP;
    let grams = 0;
    for (const d of sorted) {
      if (d.t >= t1) break;
      grams += absorbedBy(d, t1) - absorbedBy(d, Math.max(t0, d.t));
    }
    c = c + grams / body.volumeL - eliminated(c, perStep);
    if (c < ZERO && grams < 1e-3) c = 0;
    values[i] = Math.max(0, c);
    c = values[i];
  }
  return { start, step: STEP, values };
}

export function valueAt(cv, t) {
  const i = Math.round((t - cv.start) / cv.step);
  return cv.values[Math.min(Math.max(i, 0), cv.values.length - 1)];
}

/** BAC at time t for a set of drinks, simulated from the first drink. */
export function bacAt(drinks, body, t) {
  const before = drinks.filter((d) => d.t <= t);
  if (!before.length) return 0;
  const start = Math.min(...before.map((d) => d.t));
  return valueAt(curve(before, body, start, t), t);
}

function gutAt(drinks, t) {
  let g = 0;
  for (const d of drinks) if (d.t <= t) g += unabsorbedAt(d, t);
  return g;
}

/** First time ≥ from when BAC is below SOBER_BAC and nothing is left to absorb. Searches up to 36 h. */
export function soberTime(drinks, body, from, cFrom, threshold = SOBER_BAC) {
  const lastDrink = Math.max(...drinks.map((d) => d.t));
  let t = from;
  let c = cFrom;
  const chunk = 2 * HOUR;
  for (let k = 0; k < 18; k++) {
    const cv = curve(drinks, body, t, t + chunk, c);
    for (let i = 0; i < cv.values.length; i++) {
      const ti = t + i * STEP;
      if (cv.values[i] < threshold && ti >= lastDrink && gutAt(drinks, ti) < ABSORBED_EPSILON_G) return ti;
    }
    t += chunk;
    c = cv.values[cv.values.length - 1];
  }
  return t;
}

/**
 * Group a drink history into sessions. A new session starts when a drink is logged after the
 * previous session's estimated sober time.
 */
export function splitSessions(drinks, body) {
  const sorted = [...drinks].sort((a, b) => a.t - b.t);
  const sessions = [];
  let current = null;
  for (const d of sorted) {
    if (current && d.t < current.soberAt) {
      current.drinks.push(d);
      const cv = curve(current.drinks, body, current.start, d.t);
      current.soberAt = soberTime(current.drinks, body, d.t, cv.values[cv.values.length - 1]);
    } else {
      current = { start: d.t, drinks: [d], soberAt: 0 };
      current.soberAt = soberTime(current.drinks, body, d.t, 0);
      sessions.push(current);
    }
  }
  return sessions;
}

/** Summary stats for a finished (or ongoing, up to `until`) session. */
export function sessionStats(session, body, zone, until = session.soberAt) {
  const end = Math.min(until, session.soberAt);
  const cv = curve(session.drinks, body, session.start, Math.max(end, session.start));
  let peak = 0;
  let peakAt = session.start;
  let inZone = 0;
  cv.values.forEach((v, i) => {
    if (v > peak) {
      peak = v;
      peakAt = session.start + i * STEP;
    }
    if (v >= zone.min && v <= zone.max) inZone++;
  });
  const grams = session.drinks.reduce((s, d) => s + d.grams, 0);
  return {
    start: session.start,
    end: session.soberAt,
    drinkCount: session.drinks.length,
    grams,
    peak,
    peakAt,
    minutesInZone: inZone * (STEP / MINUTE),
    curve: cv,
  };
}

function maxOf(values, from = 0) {
  let m = -Infinity;
  let at = from;
  for (let i = from; i < values.length; i++) {
    if (values[i] > m) {
      m = values[i];
      at = i;
    }
  }
  return { max: m, index: at };
}

/** Last index where value ≥ threshold, or -1. */
function lastAtOrAbove(values, threshold) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] >= threshold) return i;
  return -1;
}

/**
 * When can the reference drink be had without the peak going over zone.max?
 * Searches forward from `now` in 2-minute steps for up to 10 h.
 * @returns { kind: 'now'|'later'|'too-big', at, peak }
 */
export function nextDrink(drinks, body, now, cNow, zone, ref) {
  const lone = curve([{ ...ref, t: 0 }], body, 0, 4 * HOUR);
  if (maxOf(lone.values).max > zone.max) return { kind: 'too-big', at: null, peak: maxOf(lone.values).max };

  const horizon = 3 * HOUR;
  const base = curve(drinks, body, now, now + 10 * HOUR + horizon, cNow);
  for (let m = 0; m <= 600; m += 2) {
    const at = now + m * MINUTE;
    const cAt = valueAt(base, at);
    const cv = curve([...drinks, { ...ref, t: at }], body, at, at + horizon, cAt);
    const { max } = maxOf(cv.values);
    if (max <= zone.max) return { kind: m === 0 ? 'now' : 'later', at, peak: max };
  }
  return { kind: 'later', at: null, peak: null };
}

function track(drinks, body, start, now) {
  const past = curve(drinks, body, start, now);
  const bac = past.values[past.values.length - 1];
  const soberAt = soberTime(drinks, body, now, bac);
  // Draw the tail a little past "sober" so the projected line visibly lands near zero.
  const future = curve(drinks, body, now, Math.max(soberAt + HOUR, now + 30 * MINUTE), bac);
  return { past, future, bac, soberAt };
}

/**
 * Everything the Now screen needs for the current session.
 * "Sober by" follows the central curve (the one on the graph); the driving-limit time and
 * whether the night is still active use the cautious end of the range.
 * @param session  from splitSessions (the latest one), or null
 * @param bodies   { main, high, low }
 */
export function analyze(session, bodies, now, { zone, drivingLimit }) {
  if (!session || session.start > now) return { active: false, bac: 0 };
  const { drinks, start } = session;
  const high = track(drinks, bodies.high, start, now);
  if (high.soberAt <= now) return { active: false, bac: 0 };
  const main = track(drinks, bodies.main, start, now);
  const low = track(drinks, bodies.low, start, now);
  const { bac, past, future } = main;

  const { max: peak, index: peakIndex } = maxOf(future.values);
  const peakAt = now + peakIndex * STEP;
  const rising = peakIndex > 0 && peak - bac > 0.005;

  let belowLimitAt = null;
  if (drivingLimit > 0) {
    const i = lastAtOrAbove(high.future.values, drivingLimit);
    if (i >= 0) belowLimitAt = now + (i + 1) * STEP;
  }

  const i = lastAtOrAbove(future.values, zone.min);
  const zoneDropAt = i >= 0 ? now + (i + 1) * STEP : null;

  let inZone = 0;
  let sessionPeak = 0;
  for (const v of past.values) {
    if (v >= zone.min && v <= zone.max) inZone++;
    if (v > sessionPeak) sessionPeak = v;
  }

  return {
    active: true,
    bac,
    range: { low: low.bac, high: high.bac },
    rising,
    peak,
    peakAt,
    soberAt: main.soberAt,
    soberCautious: high.soberAt,
    belowLimitAt,
    zoneDropAt,
    minutesInZone: inZone,
    sessionPeak: Math.max(sessionPeak, bac),
    status: statusOf(bac, zone),
    past,
    future,
    band: { low, high },
  };
}

export function statusOf(bac, zone) {
  if (bac < SOBER_BAC) return 'sober';
  if (bac < zone.min) return 'below';
  if (bac <= zone.max) return 'zone';
  if (bac <= Math.max(zone.max + 0.3, 1.0)) return 'above';
  return 'high';
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Personalise the model from breathalyzer readings.
 * One reading can only tell body size apart (a volume factor). Two or more readings on the same
 * night at least 45 minutes apart also reveal how fast *you* burn alcohol, so the elimination
 * rate is fitted too (grid search, 0.08–0.30 ‰/h).
 * @param groups  [{ drinks, readings: [{ t, measured }] }] — one per night with readings
 * @returns { factor, elimination|null, readings }
 */
export function fitCalibration(profile, baseElimination, groups) {
  const all = groups.flatMap((g) => g.readings.map((r) => ({ ...r, drinks: g.drinks })));
  if (!all.length) return { factor: 1, elimination: null, readings: 0 };
  const canFitRate = groups.some((g) => {
    const ts = g.readings.map((r) => r.t);
    return ts.length >= 2 && Math.max(...ts) - Math.min(...ts) >= 45 * MINUTE;
  });

  const solveK = (body, r) => {
    let lo = 0.5;
    let hi = 2.0;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const scaled = { ...body, volumeL: body.volumeL / mid };
      if (bacAt(r.drinks, scaled, r.t) < r.measured) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const evaluate = (elimination) => {
    const body = makeBody(profile, elimination);
    const usable = all.filter((r) => bacAt(r.drinks, body, r.t) >= 0.05 && r.measured >= 0.05);
    if (!usable.length) return null;
    const k = Math.min(1.5, Math.max(0.67, median(usable.map((r) => solveK(body, r)))));
    const fitted = makeBody(profile, elimination, k);
    const error = usable.reduce((e, r) => e + (bacAt(r.drinks, fitted, r.t) - r.measured) ** 2, 0);
    return { k, error, n: usable.length };
  };

  if (!canFitRate) {
    const res = evaluate(baseElimination);
    return res ? { factor: res.k, elimination: null, readings: res.n } : { factor: 1, elimination: null, readings: 0 };
  }
  let best = null;
  for (let e = 0.08; e <= 0.3 + 1e-9; e += 0.01) {
    const res = evaluate(e);
    if (res && (!best || res.error < best.error)) best = { ...res, elimination: Math.round(e * 100) / 100 };
  }
  return best ? { factor: best.k, elimination: best.elimination, readings: best.n } : { factor: 1, elimination: null, readings: 0 };
}

/** Grams per calendar week (weeks start Monday, local time), oldest first. */
export function weeklyGrams(drinks, now, weeks = 8) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const starts = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(d);
    s.setDate(d.getDate() - 7 * i);
    starts.push(s.getTime());
  }
  const out = starts.map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] : Infinity, grams: 0, drinks: 0 }));
  for (const x of drinks) {
    const day = x.t - 6 * HOUR; // drinking day: before 6 am counts as the night before
    const w = out.find((o) => day >= o.start && day < o.end);
    if (w) {
      w.grams += x.grams;
      w.drinks += 1;
    }
  }
  return out;
}
