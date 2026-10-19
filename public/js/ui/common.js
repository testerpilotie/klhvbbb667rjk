// Shared bits for the views: icons, small components, labels.

import * as F from '../format.js';
import { PRESETS, describe, iconSvg } from '../drinks.js';

export const ICONS = {
  now: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5.6 18.4a9 9 0 1 1 12.8 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>',
  history: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 7.5V12l3 2"/></svg>',
  settings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  water: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/></svg>',
  moon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/></svg>',
  pulse: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 5 12 2.5-6h4"/></svg>',
  lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  target: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  gauge: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M10 7h4M10 11h4"/><circle cx="12" cy="16.5" r="1.5"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 20h14"/></svg>',
  share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5m-4 4 4-4 4 4"/><path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11h-1"/></svg>',
  bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/></svg>',
};

export const FOOD_LABELS = {
  empty: { long: 'Empty stomach', short: 'Empty' },
  snack: { long: 'After a snack', short: 'Snack' },
  meal: { long: 'After a meal', short: 'Meal' },
};

export const STATUS_TEXT = {
  sober: 'Sober',
  below: 'Below your zone',
  zone: 'In your zone',
  above: 'Above your zone',
  high: 'Well above your zone',
};

export const LIMITS = [
  { value: 0.2, label: 'e.g. Sweden, Norway, Poland' },
  { value: 0.5, label: 'e.g. Finland, most of the EU' },
  { value: 0.8, label: 'e.g. England & Wales' },
  { value: 0, label: 'Don’t show' },
];

export const STANDARDS = [
  { value: 8, label: '8 g — UK unit' },
  { value: 10, label: '10 g — EU, Australia' },
  { value: 12, label: '12 g — Finland, Nordics' },
  { value: 14, label: '14 g — US' },
];

export const ZONE_PRESETS = [
  { name: 'Mellow', min: 0.3, max: 0.5 },
  { name: 'Social', min: 0.5, max: 0.7 },
  { name: 'Lively', min: 0.7, max: 0.9 },
];

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function seg(action, key, current, options) {
  return `<div class="seg" role="group">${options
    .map(([value, label]) => `<button data-action="${action}" data-key="${key}" data-value="${value}" aria-pressed="${String(current) === String(value)}">${label}</button>`)
    .join('')}</div>`;
}

export function numberField(key, label, value, suffix, attrs) {
  return `<div class="field"><label for="f-${key}">${label}</label><div class="input-wrap">
    <input id="f-${key}" type="number" inputmode="decimal" data-field="${key}" value="${value ?? ''}" ${attrs}><span class="suffix">${suffix}</span></div></div>`;
}

/** Display name for a logged drink: presets by id, everything else by its stored name. */
export function drinkName(x) {
  return PRESETS.find((p) => p.id === x.kind)?.name ?? x.name;
}

export function drinkRow(x, { compact = false, editable = true } = {}) {
  const sub = [describe(x), compact ? '' : FOOD_LABELS[x.food]?.long].filter(Boolean).join(' · ');
  const name = F.esc(drinkName(x));
  const main = `<div class="row-icon">${iconSvg(x.icon || 'glass', 22)}</div>
    <div class="row-main"><div class="row-title">${name}</div><div class="row-sub">${sub || `${Math.round(x.grams)} g alcohol`}</div></div>
    <div class="row-end">${F.time(x.t)}</div>`;
  return `<div class="row">
    ${editable ? `<button class="row-tap" data-action="edit-drink" data-id="${x.id}" aria-label="Edit ${name} at ${F.time(x.t)}">${main}</button>` : main}
    <button class="icon-btn" data-action="delete-drink" data-id="${x.id}" aria-label="Delete ${name} at ${F.time(x.t)}">${ICONS.close}</button>
  </div>`;
}

export function waterRow(w) {
  return `<div class="row">
    <div class="row-icon water">${ICONS.water}</div>
    <div class="row-main"><div class="row-title">Water</div><div class="row-sub">a glass</div></div>
    <div class="row-end">${F.time(w.t)}</div>
    <button class="icon-btn" data-action="delete-water" data-id="${w.id}" aria-label="Delete water at ${F.time(w.t)}">${ICONS.close}</button>
  </div>`;
}

/** Drinks and water glasses, newest first. */
export function timelineRows(drinks, water, opts, limit = Infinity) {
  return [...drinks.map((x) => ({ t: x.t, html: () => drinkRow(x, opts) })), ...water.map((w) => ({ t: w.t, html: () => waterRow(w) }))]
    .sort((a, b) => b.t - a.t)
    .slice(0, limit)
    .map((r) => r.html())
    .join('');
}

export function stat({ label, value, sub, warn }) {
  return `<div class="stat ${warn ? 'warn' : ''}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
}

export const RATINGS = [
  { value: 1, emoji: '😵', label: 'Rough' },
  { value: 2, emoji: '🥴', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😎', label: 'Fresh' },
];

/** Colour family for a grade, reusing the status palette. */
export function gradeStatus(grade) {
  return { bullseye: 'zone', dialed: 'zone', wobbly: 'above', overshot: 'high', patchy: 'below', easy: 'below' }[grade] || 'below';
}

/** Circular zone-score badge. `score` null renders the "took it easy" leaf. */
export function scoreRing(score, grade, size = 52) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : score / 100;
  return `<span class="score-ring st-${gradeStatus(grade)}" style="width:${size}px;height:${size}px;font-size:${size}px">
    <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" class="sr-track"/>
      <circle cx="26" cy="26" r="${r}" class="sr-fill" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 26 26)"/></svg>
    <b>${score == null ? '🍃' : score}</b></span>`;
}

export function ratingButtons(id, current) {
  return `<div class="faces" role="group" aria-label="How was the morning after?">${RATINGS.map(
    (r) => `<button data-action="rate" data-id="${id}" data-value="${r.value}" aria-pressed="${current === r.value}" title="${r.label}"><span>${r.emoji}</span><small>${r.label}</small></button>`,
  ).join('')}</div>`;
}
