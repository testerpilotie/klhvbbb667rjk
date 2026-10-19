// Display helpers.

import { MINUTE } from './model.js';

export function bacNumber(permille, unit) {
  return unit === 'percent' ? (permille / 10).toFixed(3) : permille.toFixed(2);
}

export function unitLabel(unit) {
  return unit === 'percent' ? '%' : '‰';
}

export function bac(permille, unit) {
  return `${bacNumber(permille, unit)}${unit === 'percent' ? '%' : ' ‰'}`;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const time = (t) => timeFmt.format(t);
export const hour = (t) => hourFmt.format(t);
export const day = (t) => dayFmt.format(t);

export function duration(ms) {
  const mins = Math.max(0, Math.round(ms / MINUTE));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function relative(t, now) {
  const mins = Math.round((t - now) / MINUTE);
  if (Math.abs(mins) < 1) return 'now';
  return mins > 0 ? `in ${duration(mins * MINUTE)}` : `${duration(-mins * MINUTE)} ago`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Standard drinks, e.g. "3.2". */
export function std(grams, standardGrams) {
  const n = grams / standardGrams;
  return n >= 10 ? n.toFixed(0) : n.toFixed(1);
}

const shortDayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
export const shortDay = (t) => shortDayFmt.format(t);

const weekFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' });
export const weekLabel = (t) => weekFmt.format(t);
