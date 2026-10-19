import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR,
  MINUTE,
  analyze,
  bacAt,
  curve,
  gramsOf,
  makeBody,
  nextDrink,
  rangeBodies,
  sessionStats,
  soberTime,
  splitSessions,
  statusOf,
  totalBodyWater,
  valueAt,
  weeklyGrams,
} from '../public/js/model.js';

const MAN = { sex: 'male', weightKg: 95, heightCm: 180, age: 40 };
const WOMAN = { sex: 'female', weightKg: 60, heightCm: 165, age: 30 };
const ZONE = { min: 0.5, max: 0.7 };
const T0 = Date.UTC(2026, 9, 17, 18, 0);
const pint = (t, food = 'empty') => ({ t, grams: gramsOf(500, 5), food });
const bodiesOf = (body, calibrated = false) => ({ main: body, ...rangeBodies(body, calibrated) });

const peakOf = (cv) => {
  let max = 0;
  let at = 0;
  cv.values.forEach((v, i) => {
    if (v > max) [max, at] = [v, i];
  });
  return { max, minutes: at };
};

test('grams of ethanol', () => {
  assert.ok(Math.abs(gramsOf(500, 5) - 19.725) < 1e-9);
  assert.ok(Math.abs(gramsOf(40, 40) - 12.624) < 1e-9);
});

test('distribution volume gives a Widmark r in the textbook range', () => {
  const r = makeBody(MAN).volumeL / MAN.weightKg;
  assert.ok(r > 0.62 && r < 0.72, `male r=${r}`);
  const rf = makeBody(WOMAN).volumeL / WOMAN.weightKg;
  assert.ok(rf > 0.55 && rf < 0.65, `female r=${rf}`);
  assert.ok(totalBodyWater(MAN) > totalBodyWater({ ...MAN, age: 70 }));
});

test('a single drink on an empty stomach peaks within an hour near the Widmark value', () => {
  const body = makeBody(MAN);
  const cv = curve([pint(T0)], body, T0, T0 + 4 * HOUR);
  const { max, minutes } = peakOf(cv);
  // Widmark A / (r·W) − β·t assumes instant absorption, so it's an upper bound on the peak.
  const widmark = gramsOf(500, 5) / body.volumeL - 0.15 * (minutes / 60);
  assert.ok(minutes >= 25 && minutes <= 75, `peak at ${minutes} min`);
  assert.ok(max <= widmark + 0.01 && max > widmark * 0.8, `peak ${max} vs widmark ${widmark}`);
});

test('burn-off runs near the configured rate at normal levels', () => {
  const body = makeBody(MAN, 0.15);
  const drinks = [0, 1, 2, 3].map((i) => pint(T0 + i * 10 * MINUTE));
  const cv = curve(drinks, body, T0, T0 + 6 * HOUR);
  const drop = valueAt(cv, T0 + 3 * HOUR) - valueAt(cv, T0 + 4 * HOUR);
  assert.ok(drop > 0.13 && drop < 0.16, `dropped ${drop}‰/h`);
});

test('burn-off slows down near zero (Michaelis–Menten tail)', () => {
  const body = makeBody(MAN, 0.15);
  const drinks = [0, 1, 2, 3].map((i) => pint(T0 + i * 10 * MINUTE));
  const cv = curve(drinks, body, T0, T0 + 10 * HOUR);
  const i = cv.values.findIndex((v, k) => k > 120 && v < 0.1);
  const slope = (cv.values[i] - cv.values[i + 15]) * 4; // ‰/h around 0.1 ‰
  assert.ok(slope < 0.13, `slope near 0.1‰ was ${slope}`);
});

test('the curve reaches exactly zero and sober time is found', () => {
  const body = makeBody(MAN);
  const drinks = [pint(T0), pint(T0 + 30 * MINUTE)];
  const sober = soberTime(drinks, body, T0, 0);
  const hours = (sober - T0) / HOUR;
  assert.ok(hours > 2 && hours < 6, `sober after ${hours} h`);
  const cv = curve(drinks, body, T0, sober + HOUR);
  assert.equal(valueAt(cv, sober + 30 * MINUTE), 0);
});

test('food lowers and delays the peak', () => {
  const body = makeBody(MAN);
  const empty = peakOf(curve([pint(T0, 'empty')], body, T0, T0 + 5 * HOUR));
  const meal = peakOf(curve([pint(T0, 'meal')], body, T0, T0 + 5 * HOUR));
  assert.ok(meal.max < empty.max * 0.9);
  assert.ok(meal.minutes > empty.minutes);
});

test('sessions split once you were sober again', () => {
  const body = makeBody(MAN);
  const drinks = [pint(T0), pint(T0 + 20 * MINUTE), pint(T0 + 48 * HOUR), pint(T0 + 49 * HOUR)];
  const sessions = splitSessions(drinks, body);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map((s) => s.drinks.length), [2, 2]);
  const stats = sessionStats(sessions[0], body, ZONE);
  assert.equal(stats.drinkCount, 2);
  assert.ok(stats.peak > 0.3 && stats.peak < 0.7);
});

test('following the next-drink guidance never overshoots the zone', () => {
  for (const profile of [MAN, WOMAN]) {
    const body = makeBody(profile);
    const drinks = [];
    let now = T0;
    for (let i = 0; i < 12; i++) {
      const cNow = drinks.length ? valueAt(curve(drinks, body, T0, now), now) : 0;
      const advice = nextDrink(drinks, body, now, cNow, ZONE, pint(0));
      assert.notEqual(advice.kind, 'too-big');
      assert.ok(advice.at !== null);
      now = advice.at;
      drinks.push(pint(now));
    }
    const cv = curve(drinks, body, T0, now + 4 * HOUR);
    const { max } = peakOf(cv);
    assert.ok(max <= ZONE.max + 1e-9, `${profile.sex}: max ${max}`);
    const inZone = cv.values.filter((v) => v >= ZONE.min && v <= ZONE.max).length;
    assert.ok(inZone > 3 * 60, `${profile.sex}: only ${inZone} min in zone`);
  }
});

test('a drink bigger than the zone allows is flagged', () => {
  const body = makeBody(WOMAN);
  const advice = nextDrink([], body, T0, 0, ZONE, { grams: gramsOf(500, 12), food: 'empty' });
  assert.equal(advice.kind, 'too-big');
});

test('analyze reports a range and conservative safety times', () => {
  const body = makeBody(MAN);
  const drinks = [0, 15, 30, 45].map((m) => pint(T0 + m * MINUTE));
  const [session] = splitSessions(drinks, body);
  const now = T0 + 50 * MINUTE;
  const a = analyze(session, bodiesOf(body), now, { zone: ZONE, drivingLimit: 0.5 });
  assert.equal(a.active, true);
  assert.equal(a.rising, true);
  assert.ok(a.range.low < a.bac && a.bac < a.range.high, JSON.stringify(a.range));
  assert.ok(a.peakAt > now);
  assert.ok(a.belowLimitAt > a.peakAt);
  // Safety times come from the high end, so they're later than the central estimate.
  assert.ok(a.soberAt > session.soberAt);
  const later = analyze(session, bodiesOf(body), a.soberAt + MINUTE, { zone: ZONE, drivingLimit: 0.5 });
  assert.equal(later.active, false);
});

test('a calibrated range is narrower', () => {
  const body = makeBody(MAN);
  const drinks = [0, 20, 40].map((m) => pint(T0 + m * MINUTE));
  const [session] = splitSessions(drinks, body);
  const now = T0 + 90 * MINUTE;
  const wide = analyze(session, bodiesOf(body, false), now, { zone: ZONE, drivingLimit: 0 });
  const narrow = analyze(session, bodiesOf(body, true), now, { zone: ZONE, drivingLimit: 0 });
  assert.ok(narrow.range.high - narrow.range.low < wide.range.high - wide.range.low);
});

test('one reading calibrates body size and reproduces the reading', async () => {
  const { fitCalibration } = await import('../public/js/model.js');
  const base = makeBody(MAN);
  const drinks = [0, 20, 40].map((m) => pint(T0 + m * MINUTE));
  const t = T0 + 90 * MINUTE;
  const measured = bacAt(drinks, base, t) * 1.2;
  const fit = fitCalibration(MAN, 0.15, [{ drinks, readings: [{ t, measured }] }]);
  assert.ok(fit.factor > 1.05 && fit.factor < 1.35, `factor ${fit.factor}`);
  assert.equal(fit.elimination, null);
  assert.ok(Math.abs(bacAt(drinks, makeBody(MAN, 0.15, fit.factor), t) - measured) < 0.01);
  const none = fitCalibration(MAN, 0.15, [{ drinks, readings: [{ t: T0 + 20 * HOUR, measured: 0.3 }] }]);
  assert.equal(none.readings, 0, 'a reading with no estimate to compare against is ignored');
  assert.equal(none.factor, 1);
});

test('weekly totals bucket by Monday-start weeks', () => {
  const now = new Date(2026, 9, 21, 20, 0).getTime(); // Wednesday
  const monday = new Date(2026, 9, 19, 12, 0).getTime();
  const prevSunday = new Date(2026, 9, 18, 23, 0).getTime();
  const weeks = weeklyGrams([{ t: monday, grams: 10 }, { t: prevSunday, grams: 20 }, { t: now, grams: 5 }], now, 4);
  assert.equal(weeks.length, 4);
  assert.equal(weeks[3].grams, 15);
  assert.equal(weeks[2].grams, 20);
  assert.equal(weeks[3].drinks, 2);
});

test('status buckets', () => {
  assert.equal(statusOf(0, ZONE), 'sober');
  assert.equal(statusOf(0.3, ZONE), 'below');
  assert.equal(statusOf(0.6, ZONE), 'zone');
  assert.equal(statusOf(0.85, ZONE), 'above');
  assert.equal(statusOf(1.4, ZONE), 'high');
});

test('sipping a drink spreads intake: slower rise, later peak, same total', async () => {
  const body = makeBody(MAN);
  const bolus = curve([pint(T0)], body, T0, T0 + 6 * HOUR);
  const sipped = curve([{ ...pint(T0), sipMin: 25 }], body, T0, T0 + 6 * HOUR);
  assert.ok(sipped.values[10] < bolus.values[10] * 0.6, 'much less in the blood 10 min in');
  assert.ok(peakOf(sipped).minutes > peakOf(bolus).minutes + 8, 'peak comes later');
  // Once it's all absorbed, sipping over 25 min looks like the whole drink arriving ~12 min later.
  const late = valueAt(sipped, T0 + 3 * HOUR);
  const shifted = valueAt(bolus, T0 + 3 * HOUR - 12.5 * MINUTE);
  assert.ok(Math.abs(late - shifted) < 0.01, `late ${late} vs shifted bolus ${shifted}`);
});

test('two readings on one night teach the burn-off rate', async () => {
  const { fitCalibration } = await import('../public/js/model.js');
  // Truth: a body that reads 15% higher and burns 0.20 ‰/h.
  const truth = makeBody(MAN, 0.2, 1.15);
  const drinks = [0, 20, 40, 60].map((m) => ({ ...pint(T0 + m * MINUTE), sipMin: 20 }));
  const readings = [T0 + 2 * HOUR, T0 + 3.5 * HOUR].map((t) => ({ t, measured: bacAt(drinks, truth, t) }));
  const fit = fitCalibration(MAN, 0.15, [{ drinks, readings }]);
  assert.ok(Math.abs(fit.elimination - 0.2) <= 0.02, `elimination ${fit.elimination}`);
  assert.ok(Math.abs(fit.factor - 1.15) < 0.08, `factor ${fit.factor}`);
  // One reading: only the factor is learned.
  const one = fitCalibration(MAN, 0.15, [{ drinks, readings: readings.slice(0, 1) }]);
  assert.equal(one.elimination, null);
  assert.ok(one.factor > 1);
});

test('weeks follow drinking days: 2 am Monday belongs to last week', () => {
  const now = new Date(2026, 9, 21, 20, 0).getTime();
  const lateSunday = new Date(2026, 9, 19, 2, 0).getTime(); // Monday 02:00
  const weeks = weeklyGrams([{ t: lateSunday, grams: 10 }], now, 2);
  assert.equal(weeks[0].grams, 10);
  assert.equal(weeks[1].grams, 0);
});

test('next-drink guidance still never overshoots with sipped drinks and food', () => {
  for (const food of ['empty', 'meal']) {
    const body = makeBody(WOMAN);
    const ref = { grams: gramsOf(330, 5.5), food, sipMin: 20 };
    const drinks = [];
    let now = T0;
    for (let i = 0; i < 10; i++) {
      const cNow = drinks.length ? valueAt(curve(drinks, body, T0, now), now) : 0;
      const advice = nextDrink(drinks, body, now, cNow, ZONE, ref);
      now = advice.at;
      drinks.push({ ...ref, t: now });
    }
    const { max } = peakOf(curve(drinks, body, T0, now + 4 * HOUR));
    assert.ok(max <= ZONE.max + 1e-9, `${food}: max ${max}`);
  }
});
