import * as F from '../format.js';
import * as M from '../model.js';
import { ICON_CHOICES, describe, iconSvg, sipMinutesFor } from '../drinks.js';
import * as Sc from '../score.js';
import * as Fe from '../feel.js';
import { ICONS, drinkName, plural, ratingButtons, scoreRing, stat, timelineRows } from './common.js';
import { sparkline } from './history.js';
import { MAX_PLANNED, planNight } from '../plan.js';

const { MINUTE, HOUR } = M;
const WHEN = [0, 10, 20, 30, 45, 60, 90, 120];

const head = (title) =>
  `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Close">${ICONS.close}</button></div>`;

export function sheetTitle(type) {
  return { add: 'Add drink', custom: 'Custom drink', edit: 'Edit drink', reading: 'Breathalyzer reading', night: 'Night recap', plan: 'Plan a night' }[type];
}

export function sheetView(sheet, ctx) {
  if (sheet.type === 'add') return addSheet(sheet, ctx);
  if (sheet.type === 'custom') return customSheet(sheet);
  if (sheet.type === 'edit') return editSheet(sheet, ctx);
  if (sheet.type === 'night') return nightSheet(sheet, ctx);
  if (sheet.type === 'plan') return planSheet(sheet, ctx);
  return readingSheet(sheet, ctx);
}

function whenLabel(m) {
  if (m === 0) return 'Now';
  if (m < 60) return `${m} min ago`;
  return `${m / 60} h ago`.replace('1.5', '1½');
}

function addSheet(sheet, { state, d, catalogue }) {
  const isWater = sheet.selId === 'water';
  const sel = isWater ? null : catalogue.find((i) => i.id === sheet.selId) || catalogue[0];
  const tiles = catalogue
    .map((i) => `<button class="drink-tile" data-action="pick" data-id="${i.id}" aria-pressed="${!isWater && i.id === sel.id}">
      ${iconSvg(i.icon, 26)}<b>${F.esc(i.name)}</b><span>${describe(i)}</span></button>`)
    .join('');
  const waterTile = `<button class="drink-tile water-tile" data-action="pick" data-id="water" aria-pressed="${isWater}">${ICONS.water}<b>Water</b><span>a glass</span></button>`;
  const when = WHEN.map((m) => `<button data-action="when" data-value="${m}" aria-pressed="${sheet.minsAgo === m}">${whenLabel(m)}</button>`).join('');
  const sips = d.sessionWater.length;
  const waterNote = `<div class="preview st-below"><div>No alcohol — it just counts toward your water. ${
    d.active ? `${sips ? `${plural(sips, 'glass', 'glasses')} so far tonight.` : 'Your first glass tonight.'} One for every two drinks earns 💧 Hydrated.` : 'Logged water counts once a night is underway.'
  }</div></div>`;
  return `${head('Add drink')}
    <div class="drink-grid">${tiles}${waterTile}<button class="drink-tile add" data-action="new-custom">${ICONS.plus}<span>Custom</span></button></div>
    <div class="label">${isWater ? 'When did you have it?' : 'When did you start it?'}</div>
    <div class="chips">${when}</div>
    ${isWater ? waterNote : preview(state, d, { t: d.now - sheet.minsAgo * MINUTE, grams: M.gramsOf(sel.volumeMl, sel.abv), food: d.food, sipMin: sipMinutesFor(sel) })}
    <button class="btn btn-primary btn-block" style="margin-top:16px" data-action="confirm-add">Add ${isWater ? 'water' : F.esc(sel.name)}</button>`;
}

/** What adding (or moving) a drink does to the projected peak. */
export function preview(state, d, drink, excludeId = null) {
  const unit = state.settings.unit;
  const now = d.now;
  const all = [...(d.active ? d.active.drinks.filter((x) => x.id !== excludeId) : []), drink];
  const start = Math.min(...all.map((x) => x.t));
  const cv = M.curve(all, d.body, start, now + 6 * HOUR);
  const from = Math.round((now - start) / MINUTE);
  let peak = 0;
  let peakIdx = from;
  for (let i = from; i < cv.values.length; i++) if (cv.values[i] > peak) [peak, peakIdx] = [cv.values[i], i];
  const st = M.statusOf(peak, d.zone);
  const where = { below: 'below your zone', zone: 'inside your zone', above: 'above your zone', high: 'well above your zone', sober: 'back to zero' }[st];
  const when = peakIdx === from ? 'right now' : `around ${F.time(start + peakIdx * MINUTE)}`;
  return `<div class="preview st-${st}"><div>Peaks at <b>${F.bac(peak, unit)}</b> ${when} — ${where}.${
    st === 'above' || st === 'high' ? ' Consider waiting or picking something lighter.' : ''
  }</div></div>`;
}

export function customValid(c) {
  return c.name.trim() && c.volumeMl > 0 && c.volumeMl <= 2000 && c.abv > 0 && c.abv <= 80;
}

export function gramsHint(c) {
  return customValid(c) ? `${M.gramsOf(c.volumeMl, c.abv).toFixed(1)} g of alcohol` : 'Fill in name, volume and strength.';
}

function customSheet(sheet) {
  const c = sheet.draft;
  const valid = customValid(c);
  return `${head('Custom drink')}
    <div class="form-grid" data-scope="custom">
      <div class="field full"><label for="c-name">Name</label><div class="input-wrap"><input id="c-name" data-cfield="name" value="${F.esc(c.name)}" placeholder="e.g. Hazy IPA" maxlength="40" autocomplete="off"></div></div>
      <div class="field"><label for="c-vol">Volume</label><div class="input-wrap"><input id="c-vol" type="number" inputmode="decimal" data-cfield="volumeMl" value="${c.volumeMl || ''}" min="1" max="2000"><span class="suffix">ml</span></div></div>
      <div class="field"><label for="c-abv">Strength</label><div class="input-wrap"><input id="c-abv" type="number" inputmode="decimal" step="0.1" data-cfield="abv" value="${c.abv || ''}" min="0.1" max="80"><span class="suffix">%</span></div></div>
      <div class="field full"><span class="lbl">Glass</span><div class="chips">${ICON_CHOICES.map(
        (i) => `<button data-action="custom-icon" data-value="${i}" aria-pressed="${c.icon === i}" aria-label="${i}" style="padding:0 10px">${iconSvg(i, 22)}</button>`,
      ).join('')}</div></div>
    </div>
    <p class="hint" id="c-grams">${gramsHint(c)}</p>
    <button class="btn btn-primary btn-block" style="margin-top:16px" data-action="save-custom" ${valid ? '' : 'disabled'}>Save drink</button>`;
}

function editSheet(sheet, { state, d }) {
  const x = state.drinks.find((dr) => dr.id === sheet.id);
  if (!x) return `${head('Edit drink')}<p class="empty">That drink is gone.</p>`;
  const nudges = [-30, -10, -5, 5, 10, 30]
    .map((m) => `<button data-action="nudge" data-value="${m}" ${sheet.t + m * MINUTE > d.now ? 'disabled' : ''}>${m > 0 ? '+' : '−'}${Math.abs(m)} min</button>`)
    .join('');
  return `${head('Edit drink')}
    <div class="edit-drink"><div class="row-icon">${iconSvg(x.icon || 'glass', 24)}</div>
      <div><b>${F.esc(drinkName(x))}</b><div class="row-sub">${describe(x) || `${Math.round(x.grams)} g alcohol`}</div></div></div>
    <div class="label">Started at</div>
    <div class="big-time num">${F.time(sheet.t)}<small>${F.relative(sheet.t, d.now)}</small></div>
    <div class="chips nudges">${nudges}</div>
    ${preview(state, d, { ...x, t: sheet.t }, x.id)}
    <div class="guide-actions" style="margin-top:16px">
      <button class="btn btn-danger" data-action="delete-from-edit">Delete</button>
      <button class="btn btn-primary btn-grow" data-action="save-edit" ${sheet.t === x.t ? 'disabled' : ''}>Save time</button>
    </div>`;
}

const READING_WHEN = [0, 5, 10, 20, 30];

function readingSheet(sheet, { state, d }) {
  const unit = state.settings.unit;
  const t = d.now - sheet.minsAgo * MINUTE;
  const lastDrink = d.active ? Math.max(...d.active.drinks.filter((x) => x.t <= t).map((x) => x.t)) : -Infinity;
  const tooSoon = t - lastDrink < 15 * MINUTE;
  const estimate = d.active ? M.bacAt(d.active.drinks, d.body, t) : 0;
  const when = READING_WHEN.map((m) => `<button data-action="reading-when" data-value="${m}" aria-pressed="${sheet.minsAgo === m}">${whenLabel(m)}</button>`).join('');
  const step = unit === 'percent' ? '0.001' : '0.01';
  return `${head('Breathalyzer reading')}
    <p class="prose">Blow into your breathalyzer and enter what it shows. Optihol fits the model to your body — every later estimate gets closer to you.</p>
    <div class="field" style="margin-top:14px"><label for="r-val">Reading</label><div class="input-wrap">
      <input id="r-val" type="number" inputmode="decimal" step="${step}" min="0" data-rfield="value" value="${sheet.value ?? ''}" placeholder="${F.bacNumber(estimate, unit)}"><span class="suffix">${F.unitLabel(unit)}</span></div></div>
    <div class="label">When</div>
    <div class="chips">${when}</div>
    <div class="preview st-${tooSoon ? 'above' : 'zone'}"><div>${
      tooSoon
        ? '<b>Wait 15 minutes after your last sip.</b> Alcohol left in your mouth makes the reading far too high.'
        : `Optihol currently estimates <b>${F.bac(estimate, unit)}</b> for that time.`
    }</div></div>
    <p class="hint" id="r-hint"></p>
    <button class="btn btn-primary btn-block" style="margin-top:12px" data-action="save-reading" data-toosoon="${tooSoon ? 1 : 0}" ${sheet.value > 0 && !tooSoon ? '' : 'disabled'}>Calibrate</button>`;
}

function nightSheet(sheet, { state, d, ui }) {
  const n = d.nights().find((x) => x.id === sheet.id);
  if (!n) return `${head('Night recap')}<p class="empty">That night is gone.</p>`;
  const unit = state.settings.unit;
  const st = n.stats;
  const sc = n.score;
  const grade = Sc.GRADES[sc.grade].label;
  const explain = !sc.reached
    ? 'You stayed under your zone the whole night. Easy nights never break a streak.'
    : `${F.duration(sc.minutesInZone * MINUTE)} inside your zone, ${sc.minutesOver ? `${F.duration(sc.minutesOver * MINUTE)} above it` : 'never above it'}.`;
  const game = d.game();
  const reveal = ui.revealing === n.id;
  const ups = n.active ? [] : Sc.tierUps(game.countsWithout(n), game.counts);
  const badges = n.active
    ? '<p class="hint" style="margin:0">Badges are handed out when the night is over — watch the row in Tonight.</p>'
    : n.badges.length
      ? `<div class="badge-chips ${reveal ? 'reveal' : ''}">${n.badges
          .map((b, i) => {
            const up = ups.find((u) => u.id === b);
            return `<button class="badge-chip ${up ? 'up' : ''}" style="--i:${i}" data-action="badge" data-id="${b}">${Sc.BADGES[b].emoji} ${Sc.BADGES[b].name}${up ? ` <em>${up.tier}!</em>` : ''}</button>`;
          })
          .join('')}</div>`
      : '<p class="hint" style="margin:0">No badges this time — there’s always next weekend.</p>';
  const best = !n.active && sc.score != null && sc.score >= game.best && game.best > 0;
  const context = sc.score == null || n.active ? '' : best ? '🏆 Personal best' : game.average != null ? `Your average is ${game.average}` : '';
  const drinks = timelineRows(n.session.drinks, n.waterList, { compact: true });
  return `${head(n.active ? 'Tonight so far' : 'Night recap')}
    <div class="recap-hero ${reveal ? 'reveal' : ''}">
      ${scoreRing(sc.score, sc.grade, 92)}
      <div><div class="recap-grade">${n.active ? 'Live score' : grade}</div>${context ? `<div class="recap-context">${context}</div>` : ''}<div class="recap-date">${F.day(st.start)} · ${F.time(st.start)}–${n.active ? 'now' : F.time(st.end)}</div><p class="recap-explain">${explain}</p></div>
    </div>
    <div class="field" style="margin-top:14px"><div class="input-wrap"><input data-night-name="${n.id}" value="${F.esc(n.name)}" maxlength="40" placeholder="Name this night — e.g. Sauna with the crew" aria-label="Name this night" autocomplete="off"></div></div>
    <div class="recap-chart">${sparkline(st.curve, d.zone, 'st-zone', { height: 120, hours: true, feels: n.feels })}</div>
    ${
      n.feels.length
        ? `<div class="label">How you felt</div><div class="feel-list">${n.feels
            .map((f) => `<span class="feel-chip">${Fe.FEELS[f.feel].emoji} ${F.time(f.t)} · ${F.bac(f.bac, unit)}<button data-action="delete-feel" data-id="${f.id}" aria-label="Remove check-in">×</button></span>`)
            .join('')}</div>`
        : ''
    }
    <div class="stats" style="margin-top:12px">
      ${stat({ label: 'Peak', value: F.bac(st.peak, unit), sub: F.time(st.peakAt) })}
      ${stat({ label: 'In zone', value: F.duration(sc.minutesInZone * MINUTE) })}
      ${stat({ label: 'Drinks', value: st.drinkCount, sub: `${F.std(st.grams, state.settings.standardGrams)} standard${n.water ? ` · ${n.water} water` : ''}` })}
      ${stat({ label: 'Length', value: F.duration((n.active ? d.now : st.end) - st.start) })}
    </div>
    <div class="label">Badges</div>
    ${badges}
    ${n.active ? '' : `<div class="label">The morning after</div>${ratingButtons(n.id, n.rating)}`}
    <div class="label">${plural(st.drinkCount, 'drink', 'drinks')}${n.water ? ` · ${plural(n.water, 'water', 'waters')}` : ''}</div>
    <div class="list">${drinks}</div>
    <button class="btn btn-primary btn-block" style="margin-top:18px" data-action="share" data-id="${n.id}">${ICONS.share}Share recap</button>`;
}

/** Start-time choices: now, then the next five whole hours (never earlier than 17:00). */
export function planStarts(now) {
  const out = [now];
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getHours() < 17 && d.getHours() > 4) d.setHours(17);
  for (let i = 0; i < 5; i++) {
    out.push(d.getTime());
    d.setHours(d.getHours() + 1);
  }
  return out;
}

export function planFor(sheet, { d, catalogue }) {
  const item = catalogue.find((c) => c.id === sheet.itemId) || catalogue[0];
  const start = planStarts(d.now)[sheet.startIndex] ?? d.now;
  const ref = { grams: M.gramsOf(item.volumeMl, item.abv), food: 'empty', sipMin: sipMinutesFor(item) };
  return { item, start, plan: planNight(d.body, d.zone, ref, start, sheet.count) };
}

function planSheet(sheet, ctx) {
  const { state, d, catalogue } = ctx;
  const unit = state.settings.unit;
  const { item, start, plan } = planFor(sheet, ctx);
  const starts = planStarts(d.now)
    .map((t, i) => `<button data-action="plan-start" data-value="${i}" aria-pressed="${sheet.startIndex === i}">${i === 0 ? 'Now' : F.time(t)}</button>`)
    .join('');
  const items = catalogue
    .map((c) => `<button class="mini-tile" data-action="plan-item" data-id="${c.id}" aria-pressed="${c.id === item.id}">${iconSvg(c.icon, 20)}<span>${F.esc(c.name)}</span></button>`)
    .join('');
  let result;
  if (plan.tooBig) {
    result = `<div class="preview st-above"><div>${F.esc(item.name)} alone would take you to about ${F.bac(plan.peak, unit)}, over your zone. Pick something lighter.</div></div>`;
  } else {
    const rows = plan.schedule
      .map((t, i) => `<li><span class="p-n">${i + 1}</span><b>${F.time(t)}</b><span>${F.esc(item.name)}</span>${i && t - plan.schedule[i - 1] > 60 * MINUTE ? `<small>wait ${F.duration(t - plan.schedule[i - 1])}</small>` : ''}</li>`)
      .join('');
    const zoneLine = plan.zoneFrom
      ? `In your zone <b>${F.time(plan.zoneFrom)}–${F.time(plan.zoneUntil)}</b>`
      : 'This stays under your zone';
    result = `<ol class="plan-list">${rows}</ol>
      <div class="recap-chart">${sparkline(plan.curve, d.zone, 'st-zone', { height: 80, hours: true })}</div>
      <p class="plan-sum">${zoneLine} · peak ${F.bac(plan.peak, unit)} · sober around <b>${F.time(plan.soberLikely)}</b> <small>(cautious ${F.time(plan.soberAt)})</small></p>`;
  }
  const isNow = sheet.startIndex === 0;
  const actions = plan.tooBig || !plan.schedule?.length
    ? ''
    : isNow
      ? `<button class="btn btn-primary btn-block" data-action="plan-go">${iconSvg(item.icon, 20)}Log the first one now</button>`
      : `<div class="guide-actions"><button class="btn btn-ghost btn-grow" data-action="plan-ics">${ICONS.clock}Add to calendar</button><button class="btn btn-primary btn-grow" data-action="plan-save">Save plan</button></div>`;
  return `${head('Plan a night')}
    <div class="label" style="margin-top:0">Start</div>
    <div class="chips">${starts}</div>
    <div class="label">Drink</div>
    <div class="mini-tiles">${items}</div>
    <div class="label">How many</div>
    <div class="stepper" style="max-width:200px"><button data-action="plan-count" data-dir="-1" aria-label="Fewer">−</button><output>${sheet.count}</output><button data-action="plan-count" data-dir="1" aria-label="More" ${sheet.count >= MAX_PLANNED ? 'disabled' : ''}>+</button></div>
    ${result}
    <div style="margin-top:16px">${actions}</div>
    <p class="hint" style="text-align:center">Paced so you never go over your zone. Plans are estimates — never drive after drinking.</p>`;
}
