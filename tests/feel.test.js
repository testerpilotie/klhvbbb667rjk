import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, MINUTE, gramsOf, makeBody, splitSessions } from '../public/js/model.js';
import { agreement, feelPoints, feelTrend, feelZone, suggestZone } from '../public/js/feel.js';

const DAY = 24 * HOUR;
const ZONE = { min: 0.5, max: 0.7 };
const pt = (feel, bac, night = 'n1', t = 0) => ({ feel, bac, night, nightStart: t, t });

test('check-ins get the estimated BAC of their session', () => {
  const body = makeBody({ sex: 'male', weightKg: 85, heightCm: 182, age: 34 });
  const t0 = Date.UTC(2026, 9, 17, 18);
  const drinks = [0, 30, 60].map((m, i) => ({ id: `d${i}`, t: t0 + m * MINUTE, grams: gramsOf(500, 5), food: 'empty' }));
  const sessions = splitSessions(drinks, body);
  const pts = feelPoints([{ t: t0 + 90 * MINUTE, feel: 'zone' }, { t: t0 + 3 * DAY, feel: 'zone' }], sessions, body);
  assert.equal(pts.length, 1, 'check-in outside any session is dropped');
  assert.ok(pts[0].bac > 0.3 && pts[0].bac < 0.8, `bac ${pts[0].bac}`);
  assert.equal(pts[0].nightStart, sessions[0].start);
});

test('feel zone needs three zone check-ins and uses the middle half', () => {
  assert.equal(feelZone([pt('zone', 0.5), pt('zone', 0.6)]).ready, false);
  const fz = feelZone([0.48, 0.52, 0.55, 0.58, 0.6, 0.66].map((b) => pt('zone', b)));
  assert.equal(fz.ready, true);
  assert.ok(fz.low > 0.5 && fz.low < 0.54, `low ${fz.low}`);
  assert.ok(fz.high > 0.58 && fz.high < 0.62, `high ${fz.high}`);
});

test('"too much" taps pull the upper edge down', () => {
  const zone = [0.5, 0.55, 0.6, 0.7, 0.75].map((b) => pt('zone', b));
  const plain = feelZone(zone);
  const tight = feelZone([...zone, pt('over', 0.62), pt('over', 0.64), pt('over', 0.9)]);
  assert.ok(tight.high < plain.high, `${tight.high} < ${plain.high}`);
});

test('suggested zone is rounded, wide enough and clamped', () => {
  assert.deepEqual(suggestZone({ ready: true, low: 0.53, high: 0.66 }), { min: 0.55, max: 0.65 });
  assert.deepEqual(suggestZone({ ready: true, low: 0.6, high: 0.62 }), { min: 0.55, max: 0.65 });
  assert.deepEqual(suggestZone({ ready: true, low: 0.95, high: 1.2 }), { min: 0.9, max: 1.0 });
  assert.equal(suggestZone({ ready: false }), null);
});

test('agreement counts check-ins the estimate agrees with', () => {
  const a = agreement([pt('zone', 0.6), pt('zone', 0.4), pt('under', 0.3), pt('over', 0.9)], ZONE);
  assert.equal(a, 0.75);
});

test('trend detects a rising feel-good point', () => {
  const nights = [0, 20, 40, 60, 80].map((d, i) => pt('zone', 0.5 + i * 0.03, `n${i}`, d * DAY));
  const tr = feelTrend(nights);
  assert.equal(tr.ready, true);
  assert.equal(tr.direction, 'up');
  assert.ok(Math.abs(tr.change - 0.12) < 0.01, `change ${tr.change}`);
  const flat = feelTrend([0, 20, 40, 60].map((d, i) => pt('zone', 0.58 + (i % 2) * 0.01, `n${i}`, d * DAY)));
  assert.equal(flat.direction, 'steady');
  assert.equal(feelTrend(nights.slice(0, 3)).ready, false);
});
