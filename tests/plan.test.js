import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, MINUTE, curve, gramsOf, makeBody } from '../public/js/model.js';
import { planNight, toIcs, zoneRecipe } from '../public/js/plan.js';

const MAN = { sex: 'male', weightKg: 85, heightCm: 182, age: 34 };
const WOMAN = { sex: 'female', weightKg: 60, heightCm: 165, age: 30 };
const ZONE = { min: 0.5, max: 0.7 };
const BEER = { grams: gramsOf(500, 5), food: 'empty', sipMin: 25 };
const T0 = Date.UTC(2026, 9, 23, 17, 0);

test('a planned night never leaves the zone and gets there', () => {
  for (const p of [MAN, WOMAN]) {
    const body = makeBody(p);
    const plan = planNight(body, ZONE, BEER, T0, 5);
    assert.equal(plan.schedule.length, 5);
    assert.equal(plan.schedule[0], T0, 'first drink right at the start');
    assert.ok(plan.schedule.every((t, i) => i === 0 || t - plan.schedule[i - 1] >= 25 * MINUTE), 'each drink finished before the next');
    assert.ok(plan.peak <= ZONE.max + 1e-9, `${p.sex} peak ${plan.peak}`);
    assert.ok(plan.zoneFrom > T0 && plan.zoneUntil > plan.zoneFrom);
    assert.ok(plan.soberAt > plan.zoneUntil);
    const check = curve(plan.drinks, body, T0, plan.soberAt);
    assert.ok(Math.max(...check.values) <= ZONE.max + 1e-9);
  }
});

test('a drink too strong for the zone is flagged instead of planned', () => {
  const plan = planNight(makeBody(WOMAN), ZONE, { grams: gramsOf(500, 12), food: 'empty', sipMin: 20 }, T0, 3);
  assert.equal(plan.tooBig, true);
  assert.equal(plan.schedule.length, 0);
});

test('zone recipe speaks in drinks', () => {
  const r = zoneRecipe(makeBody(MAN), ZONE, BEER);
  assert.ok(r.toReach >= 2 && r.toReach <= 4, `toReach ${r.toReach}`);
  // Staying level means replacing what the liver clears: roughly a pint every 2 hours.
  assert.ok(r.keepEveryMin >= 60 && r.keepEveryMin <= 240, `every ${r.keepEveryMin}`);
  assert.ok(r.reachMin > 30 && r.reachMin < 4 * 60, `reach after ${r.reachMin} min`);
  // A lighter body needs fewer drinks to reach the same zone.
  const w = zoneRecipe(makeBody(WOMAN), ZONE, BEER);
  assert.ok(w.toReach <= r.toReach);
  // A higher zone needs more.
  const lively = zoneRecipe(makeBody(MAN), { min: 0.7, max: 0.9 }, BEER);
  assert.ok(lively.toReach >= r.toReach);
  // Over a 3-hour evening, a higher zone never means fewer drinks.
  const mellow = zoneRecipe(makeBody(MAN), { min: 0.3, max: 0.5 }, BEER);
  assert.ok(mellow.in3h <= r.in3h && r.in3h <= lively.in3h, `${mellow.in3h} ${r.in3h} ${lively.in3h}`);
  assert.ok(mellow.in3h < lively.in3h, 'presets are distinguishable');
});

test('calendar file is valid-looking iCalendar with an alarm and a link', () => {
  const ics = toIcs({ start: T0, title: 'Night out, plan', description: '20:00 Beer\n20:50 Beer', url: 'https://optihol.com/', uid: 'abc' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART:20261023T170000Z'));
  assert.ok(ics.includes('DTEND:20261023T210000Z'));
  assert.ok(ics.includes('SUMMARY:Night out\\, plan'));
  assert.ok(ics.includes('DESCRIPTION:20:00 Beer\\n20:50 Beer'));
  assert.ok(ics.includes('BEGIN:VALARM') && ics.includes('URL:https://optihol.com/'));
  assert.ok(!/[^\r]\n/.test(ics), 'CRLF line endings only');
});

test('plans show a central sober time before the cautious one', () => {
  const plan = planNight(makeBody(MAN), ZONE, BEER, T0, 3);
  assert.ok(plan.soberLikely < plan.soberAt, 'likely comes before cautious');
  const hours = (plan.soberLikely - T0) / HOUR;
  assert.ok(hours > 5 && hours < 10, `3 beers: sober after ${hours.toFixed(1)} h`);
});
