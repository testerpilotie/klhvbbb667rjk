// Shareable "night recap" image, drawn on a canvas so it works offline.

import * as F from './format.js';
import { MINUTE } from './model.js';
import { BADGES, GRADES } from './score.js';

const W = 1080;
const H = 1350;
const C = {
  bg: '#0c0f14',
  surface: '#141922',
  line: '#262e3b',
  fg: '#eef1f5',
  muted: '#8d97a7',
  mint: '#5ee6b0',
  amber: '#ffbe5c',
  red: '#ff6b6b',
  sky: '#72b9ff',
};
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function gradeColor(grade) {
  return { bullseye: C.mint, dialed: C.mint, wobbly: C.amber, overshot: C.red, patchy: C.sky, easy: C.sky }[grade];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawNight(canvas, night, { zone, unit, standardGrams }) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { stats: st, score: sc } = night;
  const accent = gradeColor(sc.grade);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 380, 40, W / 2, 380, 620);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = C.muted;
  ctx.font = `700 34px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('OPTIHOL', 80, 110);
  ctx.textAlign = 'right';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(F.day(st.start), W - 80, 110);
  if (night.name) {
    ctx.textAlign = 'center';
    ctx.fillStyle = C.fg;
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(night.name, W / 2, 190, W - 160);
  }

  // Score ring
  const cx = W / 2;
  const cy = 400;
  const r = 165;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (sc.score) {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * sc.score) / 100);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = C.fg;
  ctx.font = `800 ${sc.score == null ? 120 : 150}px ${FONT}`;
  ctx.fillText(sc.score == null ? '🍃' : String(sc.score), cx, cy + 50);
  ctx.fillStyle = C.muted;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('ZONE SCORE', cx, cy + 105);
  ctx.fillStyle = accent;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(GRADES[sc.grade].label, cx, cy + r + 105);

  // Curve
  const gx = 80;
  const gy = 720;
  const gw = W - 160;
  const gh = 230;
  roundRect(ctx, gx - 20, gy - 30, gw + 40, gh + 60, 28);
  ctx.fillStyle = C.surface;
  ctx.fill();
  const vals = st.curve.values;
  const max = Math.max(zone.max * 1.3, ...vals, 0.1);
  const x = (i) => gx + (i / Math.max(vals.length - 1, 1)) * gw;
  const y = (v) => gy + gh - (v / max) * gh;
  ctx.fillStyle = `${C.mint}26`;
  ctx.fillRect(gx, y(zone.max), gw, y(zone.min) - y(zone.max));
  ctx.beginPath();
  vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineTo(x(vals.length - 1), gy + gh);
  ctx.lineTo(gx, gy + gh);
  ctx.closePath();
  ctx.fillStyle = `${accent}30`;
  ctx.fill();
  ctx.beginPath();
  vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = accent;
  ctx.stroke();

  // Stats
  const cells = [
    ['PEAK', F.bac(st.peak, unit)],
    ['IN ZONE', F.duration(sc.minutesInZone * MINUTE)],
    ['DRINKS', `${st.drinkCount} · ${F.std(st.grams, standardGrams)} std`],
  ];
  cells.forEach(([label, value], i) => {
    const sx = 80 + i * ((W - 160) / 3) + (W - 160) / 6;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.muted;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(label, sx, 1060);
    ctx.fillStyle = C.fg;
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText(value, sx, 1115, (W - 160) / 3 - 20);
  });

  // Badges
  if (night.badges.length) {
    ctx.font = `64px ${FONT}`;
    ctx.fillText(night.badges.map((b) => BADGES[b].emoji).join('  '), W / 2, 1220, W - 160);
  }

  ctx.fillStyle = C.muted;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('optihol.com · estimates only · never drink and drive', W / 2, H - 50);
}

function summaryText(night, unit) {
  const sc = night.score;
  const head = sc.score == null ? '🍃 Took it easy tonight' : `🎯 Zone score ${sc.score} — ${GRADES[sc.grade].label}`;
  return `${head}. Peak ${F.bac(night.stats.peak, unit)}, ${F.duration(sc.minutesInZone * MINUTE)} in the zone. Tracked with Optihol.`;
}

/** Share the recap as an image (Web Share) or download it. Returns 'shared' | 'downloaded'. */
export async function shareNight(night, opts) {
  const canvas = document.createElement('canvas');
  drawNight(canvas, night, opts);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], `optihol-${F.weekLabel(night.stats.start).replace(/\D+/g, '-')}.png`, { type: 'image/png' });
  const text = summaryText(night, opts.unit);
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'My night on Optihol', text });
    return 'shared';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'downloaded';
}
