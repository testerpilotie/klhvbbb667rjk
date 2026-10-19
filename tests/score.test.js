import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, MINUTE } from '../public/js/model.js';
import { alcoholFreeDays, calendar, dayKey, dryWeeks, liveGoals, sessionBadges, sweetSpot, tierOf, tierUps, weekReport, weekStreak, zoneScore } from '../public/js/score.js';

const ZONE = { min: 0.5, max: 0.7 };
const cvOf = (values) => ({ start: 0, step: MINUTE, values });
const flat = (v, n) => Array(n).fill(v);

test('perfect plateau scores 100', () => {
  const s = zoneScore(cvOf([...flat(0.2, 30), ...flat(0.6, 120), ...flat(0.3, 60)]), ZONE);
  assert.equal(s.score, 100);
  assert.equal(s.grade, 'bullseye');
  assert.equal(s.minutesInZone, 120);
});

test('never reaching the zone gives no score (no incentive to drink more)', () => {
  const s = zoneScore(cvOf([...flat(0.3, 120), ...flat(0, 30)]), ZONE);
  assert.equal(s.score, null);
  assert.equal(s.grade, 'easy');
  assert.equal(s.reached, false);
});

test('going over costs points and very high peaks are capped', () => {
  const mild = zoneScore(cvOf([...flat(0.6, 60), ...flat(0.8, 60), ...flat(0.6, 60)]), ZONE);
  assert.ok(mild.score < 70 && mild.score > 0, `mild ${mild.score}`);
  assert.equal(mild.minutesOver, 60);
  const wild = zoneScore(cvOf([...flat(0.6, 170), ...flat(1.3, 10)]), ZONE);
  assert.ok(wild.score <= 40, `wild ${wild.score}`);
});

test('the final decline below the zone does not count against you', () => {
  const s = zoneScore(cvOf([...flat(0.6, 90), ...flat(0.4, 120)]), ZONE);
  assert.equal(s.score, 100);
});

test('badges', () => {
  const t0 = new Date(2026, 9, 16, 19, 0).getTime();
  const drinks = [0, 50, 100].map((m) => ({ t: t0 + m * MINUTE, grams: 20 }));
  const session = { start: t0, soberAt: t0 + 6 * HOUR, drinks };
  const score = { score: 95, reached: true, minutesInZone: 90, minutesOver: 0 };
  const water = [{ t: t0 + 30 * MINUTE }, { t: t0 + 80 * MINUTE }];
  const b = sessionBadges({ session, score, water, rating: 5, calledAt: t0 + 120 * MINUTE });
  for (const id of ['bullseye', 'never-over', 'hydrated', 'slow-sipper', 'called-it', 'fresh']) assert.ok(b.includes(id), id);
  const relapsed = sessionBadges({ session, score, calledAt: t0 + 60 * MINUTE });
  assert.ok(!relapsed.includes('called-it'), 'a drink after “done” loses Called it');
  assert.ok(!b.includes('easy'));
  const easy = sessionBadges({ session, score: { score: null, reached: false, minutesInZone: 0, minutesOver: 0 } });
  assert.ok(easy.includes('easy') && !easy.includes('never-over'));
});

test('drinking days roll over at 6 am', () => {
  assert.equal(dayKey(new Date(2026, 9, 17, 2, 0).getTime()), '2026-10-16');
  assert.equal(dayKey(new Date(2026, 9, 17, 7, 0).getTime()), '2026-10-17');
});

test('calendar, alcohol-free days and dry weeks', () => {
  const now = new Date(2026, 9, 21, 20, 0).getTime(); // Wednesday
  const nights = [
    { start: new Date(2026, 9, 17, 21, 0).getTime(), peak: 0.6 }, // Sat
    { start: new Date(2026, 9, 20, 19, 0).getTime(), peak: 0.9 }, // Tue
    { start: new Date(2026, 8, 1, 19, 0).getTime(), peak: 0.4 }, // long ago
  ];
  const days = calendar(nights, now, 4);
  assert.equal(days.length, 28);
  assert.equal(new Date(days[0].t).getDay(), 1, 'starts on a Monday');
  assert.equal(days.find((d) => d.key === '2026-10-17').peak, 0.6);
  assert.ok(days.find((d) => d.today).key === '2026-10-21');
  assert.ok(days.at(-1).future);
  assert.equal(alcoholFreeDays(nights, now, 7), 5);
  assert.ok(dryWeeks(nights, now) >= 4);
});

test('weekly goals: dry weeks win, overshoot loses, current week reports what it needs', () => {
  const goals = { freeDays: 4, neverOver: true, maxStd: 0 };
  const day = (y, m, d, h = 20) => new Date(y, m, d, h).getTime();
  const night = (t, over = false) => ({ start: t, grams: 40, over, peak: over ? 0.9 : 0.6 });
  const now = day(2026, 9, 21, 20); // Wednesday 21 Oct
  const nights = [
    // week of 28 Sep: 2 drinking nights, none over → won
    night(day(2026, 8, 30)), night(day(2026, 9, 3)),
    // week of 5 Oct: dry → won automatically
    // week of 12 Oct: one night over → lost
    night(day(2026, 9, 16), true),
    // this week: Monday drank
    night(day(2026, 9, 19)),
  ];
  const weeks = weekReport(nights, now, goals, 10, day(2026, 8, 28, 9));
  assert.equal(weeks.length, 4);
  assert.deepEqual(weeks.slice(0, 3).map((w) => w.won), [true, true, false]);
  const cur = weeks.at(-1);
  assert.equal(cur.complete, false);
  assert.equal(cur.free, 1, 'Tuesday was free');
  assert.equal(cur.need, 3);
  assert.equal(cur.status, 'on-track', '5 days left incl. today, needs 3');
  assert.deepEqual(weekStreak(weeks), { current: 0, best: 2 });
  const strict = weekReport(nights, now, { ...goals, freeDays: 6 }, 10, day(2026, 8, 28, 9)).at(-1);
  assert.equal(strict.status, 'tight', 'every remaining day must be free');
  const capped = weekReport(nights, now, { ...goals, maxStd: 3 }, 10, day(2026, 8, 28, 9)).at(-1);
  assert.equal(capped.status, 'lost', '4 standard drinks already over a cap of 3');
});

test('badge tiers and tier-ups', () => {
  assert.equal(tierOf(0).index, -1);
  assert.equal(tierOf(1).name, 'Bronze');
  assert.equal(tierOf(4).toNext, 1);
  assert.equal(tierOf(5).name, 'Silver');
  assert.equal(tierOf(15).name, 'Gold');
  assert.equal(tierOf(15).next, null);
  assert.deepEqual(tierUps({ hydrated: 4, easy: 2 }, { hydrated: 5, easy: 3, 'tuned-in': 1 }), [
    { id: 'hydrated', tier: 'Silver' },
    { id: 'tuned-in', tier: 'Bronze' },
  ]);
});

test('live goals during a night', () => {
  const g = liveGoals({ drinks: 3, water: 1, checkins: 2, score: { reached: true, minutesOver: 0 }, calledAt: null });
  const by = Object.fromEntries(g.map((x) => [x.id, x]));
  assert.equal(by.hydrated.label, '1/2');
  assert.equal(by.hydrated.done, false);
  assert.equal(by['tuned-in'].done, true);
  assert.equal(by['never-over'].label, 'on track');
  const over = liveGoals({ drinks: 1, water: 0, checkins: 0, score: { reached: true, minutesOver: 12 }, calledAt: 1 });
  assert.equal(over.find((x) => x.id === 'never-over').failed, true);
  assert.equal(over.find((x) => x.id === 'called-it').done, true);
});

test('sweet spot finds where mornings get worse', () => {
  assert.equal(sweetSpot([{ peak: 0.5, rating: 5 }]).ready, false);
  const s = sweetSpot([
    { peak: 0.55, rating: 5 },
    { peak: 0.62, rating: 4 },
    { peak: 0.9, rating: 2 },
    { peak: 1.0, rating: 1 },
  ]);
  assert.equal(s.found, true);
  assert.equal(s.threshold, 0.65);
  const flatRatings = sweetSpot([{ peak: 0.5, rating: 3 }, { peak: 0.7, rating: 3 }, { peak: 0.9, rating: 3 }]);
  assert.equal(flatRatings.found, false);
});
