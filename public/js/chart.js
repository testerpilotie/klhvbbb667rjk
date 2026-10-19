// Gauge and timeline, drawn as plain SVG so the app works offline with no chart library.

import { bacNumber, hour, time, unitLabel } from './format.js';
import { HOUR, MINUTE } from './model.js';
import { FEELS } from './feel.js';

// ---------- Gauge ----------

const R = 104;
const C = 130;
const START = 135; // degrees, 0 = 3 o'clock, clockwise
const SWEEP = 270;

function polar(deg, r = R) {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arcPath(from, to, r = R) {
  const [x0, y0] = polar(from, r);
  const [x1, y1] = polar(to, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function gaugeScale(zone) {
  return Math.max(1.2, Math.ceil(zone.max * 1.6 * 10) / 10);
}

export function gaugeSvg({ bac, zone, drivingLimit }) {
  const scale = gaugeScale(zone);
  const pct = (v) => Math.min(100, Math.max(0, (v / scale) * 100));
  const full = arcPath(START, START + SWEEP);
  const zoneFrom = START + (SWEEP * pct(zone.min)) / 100;
  const zoneTo = START + (SWEEP * pct(zone.max)) / 100;
  const value = pct(bac);
  let tick = '';
  if (drivingLimit > 0 && drivingLimit < scale) {
    const deg = START + (SWEEP * pct(drivingLimit)) / 100;
    const [x0, y0] = polar(deg, R - 22);
    const [x1, y1] = polar(deg, R - 14);
    tick = `<line class="limit-tick" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 260 260" role="img" aria-label="Gauge">
    <path class="track" d="${full}" fill="none" stroke-width="16" stroke-linecap="round"/>
    <path class="zone-arc" d="${arcPath(zoneFrom, zoneTo, R + 15)}" fill="none" stroke-width="4" stroke-linecap="round"/>
    <path class="value-arc" d="${full}" pathLength="100" fill="none" stroke-width="16" stroke-linecap="round"
      stroke-dasharray="${value.toFixed(2)} 200" ${value < 0.5 ? 'stroke-opacity="0"' : ''}/>
    ${tick}
  </svg>`;
}

// ---------- Timeline ----------

const PAD = { l: 36, r: 10, t: 22, b: 24 };

function niceStep(max) {
  if (max <= 0.6) return 0.1;
  if (max <= 1.6) return 0.2;
  return 0.5;
}

/**
 * Mount (or re-mount) the timeline into `el`.
 * data: { points: [[t, v]], band: [[t, low, high]], now, start, end, zone, drivingLimit, drinks: [t], unit }
 */
export function mountTimeline(el, data) {
  el._data = data;
  if (!el._ro) {
    el._ro = new ResizeObserver(() => draw(el));
    el._ro.observe(el);
  }
  draw(el);
}

function draw(el) {
  const d = el._data;
  const W = el.clientWidth;
  const H = el.clientHeight;
  if (!W || !d) return;

  const { points, now, start, end, zone, drivingLimit, unit } = d;
  const band = d.band || [];
  const maxV = Math.max(points.reduce((m, p) => Math.max(m, p[1]), 0), band.reduce((m, p) => Math.max(m, p[2]), 0) * 0.92);
  const step = niceStep(Math.max(maxV, zone.max));
  const yMax = Math.ceil((Math.max(maxV * 1.12, zone.max * 1.25, 0.3) + 1e-9) / step) * step;
  const x = (t) => PAD.l + ((t - start) / (end - start)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const baseY = y(0);

  const past = points.filter((p) => p[0] <= now);
  const future = points.filter((p) => p[0] >= now);
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');

  let grid = '';
  for (let v = 0; v <= yMax + 1e-9; v += step) {
    grid += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis-label" x="${PAD.l - 8}" y="${y(v) + 4}" text-anchor="end">${unit === 'percent' ? (v / 10).toFixed(2) : v.toFixed(1)}</text>`;
  }

  let hours = '';
  const firstHour = Math.ceil(start / HOUR) * HOUR;
  const span = end - start;
  const every = span > 10 * HOUR ? 3 : span > 5 * HOUR ? 2 : 1;
  for (let t = firstHour; t <= end; t += HOUR) {
    const h = new Date(t).getHours();
    if (h % every) continue;
    hours += `<text class="axis-label" x="${x(t)}" y="${H - 6}" text-anchor="middle">${hour(t)}</text>`;
  }

  const zoneBand = `<rect class="zone-band" x="${PAD.l}" width="${W - PAD.l - PAD.r}" y="${y(zone.max)}" height="${y(zone.min) - y(zone.max)}"/>
    <line class="zone-edge" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(zone.max)}" y2="${y(zone.max)}"/>
    <line class="zone-edge" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(zone.min)}" y2="${y(zone.min)}"/>
    <text class="zone-label" x="${W - PAD.r - 4}" y="${y(zone.max) - 5}" text-anchor="end">your zone</text>`;

  const limit =
    drivingLimit > 0 && drivingLimit <= yMax
      ? `<line class="limit-line" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(drivingLimit)}" y2="${y(drivingLimit)}"/>
         <text class="limit-label" x="${PAD.l + 4}" y="${y(drivingLimit) - 5}">driving limit</text>`
      : '';

  const bandPath = band.length > 1
    ? `<path class="range-band" d="${band.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(Math.min(p[2], yMax)).toFixed(1)}`).join('')}${band
        .slice()
        .reverse()
        .map((p) => `L${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`)
        .join('')}Z"/>`
    : '';
  const area = past.length > 1 ? `<path class="area" d="${line(past)}L${x(past.at(-1)[0])},${baseY}L${x(past[0][0])},${baseY}Z"/>` : '';
  const nowV = past.length ? past.at(-1)[1] : 0;
  const showNow = now >= start && now <= end;

  const feelMarks = (d.feels || [])
    .filter((f) => f.t >= start && f.t <= end)
    .map((f) => {
      const fx = x(f.t);
      const fy = y(Math.min(f.bac, yMax));
      return `<g class="feel-mark feel-${f.feel}"><line x1="${fx}" x2="${fx}" y1="${fy - 6}" y2="${fy - 16}"/><circle cx="${fx}" cy="${fy}" r="5"/>
        <text x="${fx}" y="${fy - 20}" text-anchor="middle">${FEELS[f.feel].emoji}</text></g>`;
    })
    .join('');

  const marks = d.drinks
    .filter((t) => t >= start && t <= end)
    .map((t) => `<circle class="drink-mark" cx="${x(t)}" cy="${baseY}" r="4.5"/>`)
    .join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="BAC timeline">
    <defs><linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="var(--fg)" stop-opacity="0.16"/><stop offset="1" stop-color="var(--fg)" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}${zoneBand}${limit}${hours}
    ${bandPath}${area}
    <path class="future" d="${line(future)}"/>
    <path class="past" d="${line(past)}"/>
    ${showNow ? `<line class="now-line" x1="${x(now)}" x2="${x(now)}" y1="${PAD.t - 8}" y2="${baseY}"/>` : ''}
    ${marks}${feelMarks}
    ${showNow ? `<circle class="now-dot" cx="${x(now)}" cy="${y(nowV)}" r="6"/>` : ''}
    <g class="scrub" style="display:none"><line class="scrub-line" y1="${PAD.t - 8}" y2="${baseY}"/><circle class="scrub-dot" r="4"/></g>
  </svg><div class="tip" style="display:none"></div>`;

  const svg = el.querySelector('svg');
  const scrub = el.querySelector('.scrub');
  const tip = el.querySelector('.tip');
  const show = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const px = Math.min(Math.max(clientX - rect.left, PAD.l), W - PAD.r);
    const t = start + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (end - start);
    let best = points[0];
    for (const p of points) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    if (!best) return;
    const bx = x(best[0]);
    const by = y(best[1]);
    scrub.style.display = '';
    scrub.querySelector('line').setAttribute('x1', bx);
    scrub.querySelector('line').setAttribute('x2', bx);
    const dot = scrub.querySelector('circle');
    dot.setAttribute('cx', bx);
    dot.setAttribute('cy', by);
    tip.style.display = '';
    tip.style.left = `${Math.min(Math.max(bx, 60), W - 60)}px`;
    const tag = best[0] > now + MINUTE ? ' <small>projected</small>' : '';
    tip.innerHTML = `${time(best[0])} · ${bacNumber(best[1], unit)}${unitLabel(unit)}${tag}`;
  };
  const hide = () => {
    scrub.style.display = 'none';
    tip.style.display = 'none';
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && setTimeout(hide, 1200));
}
