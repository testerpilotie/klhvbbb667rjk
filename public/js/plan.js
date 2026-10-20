// Planning a night before it starts: when each drink fits, what the curve will look like,
// and what your zone means in actual drinks. Pure functions, no DOM.

import { HOUR, MINUTE, bacAt, curve, nextDrink, rangeBodies, soberTime } from './model.js';

export const MAX_PLANNED = 8;

/**
 * Pace `count` drinks of `ref` from `start` so the projected peak never leaves the zone.
 * @returns { tooBig, schedule: ms[], peak, peakAt, zoneFrom, zoneUntil, soberLikely, soberAt (cautious), curve }
 */
export function planNight(body, zone, ref, start, count) {
  const drinks = [];
  const schedule = [];
  let t = start;
  const finishMs = Math.max(ref.sipMin ?? 0, 10) * MINUTE; // you finish one before starting the next
  for (let i = 0; i < Math.min(count, MAX_PLANNED); i++) {
    if (i > 0) t = schedule[i - 1] + finishMs;
    const c = drinks.length ? bacAt(drinks, body, t) : 0;
    const advice = nextDrink(drinks, body, t, c, zone, ref);
    if (advice.kind === 'too-big') return { tooBig: true, schedule: [], peak: advice.peak };
    if (advice.at == null) break;
    drinks.push({ ...ref, t: advice.at });
    schedule.push(advice.at);
  }
  if (!drinks.length) return { tooBig: false, schedule: [] };
  const soberMain = soberTime(drinks, body, start, 0);
  const cv = curve(drinks, body, start, soberMain);
  let peak = 0;
  let peakIdx = 0;
  let first = -1;
  let last = -1;
  cv.values.forEach((v, i) => {
    if (v > peak) [peak, peakIdx] = [v, i];
    if (v >= zone.min) {
      if (first < 0) first = i;
      last = i;
    }
  });
  const at = (i) => start + i * cv.step;
  return {
    tooBig: false,
    schedule,
    drinks,
    peak,
    peakAt: at(peakIdx),
    zoneFrom: first >= 0 ? at(first) : null,
    zoneUntil: last >= 0 ? at(last + 1) : null,
    soberLikely: soberMain, // central estimate
    // The cautious end of the likely range, like everywhere else safety is concerned.
    soberAt: soberTime(drinks, rangeBodies(body).high, start, 0),
    curve: cv,
  };
}

/**
 * Your zone in plain drinks: how many it takes to get there, and how often one keeps you there.
 * @returns { toReach|null, keepEveryMin|null, reachMin|null, in3h } — in3h: drinks over a 3-hour evening
 */
export function zoneRecipe(body, zone, ref) {
  const plan = planNight(body, zone, ref, 0, MAX_PLANNED);
  const in3h = plan.schedule.filter((t) => t < 3 * HOUR).length;
  if (plan.tooBig || !plan.zoneFrom) return { toReach: null, keepEveryMin: null, reachMin: null, in3h, tooBig: !!plan.tooBig };
  // Drinks started before you reach the zone are the ones that got you there.
  const toReach = plan.schedule.filter((t) => t < plan.zoneFrom).length;
  const after = plan.schedule.filter((t) => t >= plan.zoneFrom);
  const gaps = after.slice(1).map((t, i) => t - after[i]);
  const keepEveryMin = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / MINUTE / 5) * 5 : null;
  return { toReach, keepEveryMin, reachMin: Math.round(plan.zoneFrom / MINUTE / 5) * 5, in3h };
}

function icsDate(t) {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** A calendar event for a planned night, with an alarm at the start and a link back. */
export function toIcs({ start, end, title, description, url, uid }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Optihol//Night plan//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}@optihol.com`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end ?? start + 4 * HOUR)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
