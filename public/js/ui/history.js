import * as F from '../format.js';
import * as M from '../model.js';
import * as Sc from '../score.js';
import * as Fe from '../feel.js';
import { gradeStatus, plural, scoreRing, stat } from './common.js';

const { MINUTE, HOUR } = M;

export function sparkline(cv, zone, statusClass, { height = 44, hours = false, feels = [] } = {}) {
  const W = 300;
  const H = height;
  const vals = cv.values.filter((_, i) => i % 3 === 0);
  const max = Math.max(zone.max * 1.25, ...vals, 0.1);
  const x = (i) => (i / Math.max(vals.length - 1, 1)) * W;
  const y = (v) => H - 3 - (v / max) * (H - 6);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  let ticks = '';
  if (hours) {
    const span = (vals.length - 1) * 3 * MINUTE;
    for (let t = Math.ceil(cv.start / HOUR) * HOUR; t <= cv.start + span; t += HOUR) {
      const px = ((t - cv.start) / span) * W;
      ticks += `<line class="spark-tick" x1="${px}" x2="${px}" y1="0" y2="${H}"/>`;
    }
  }
  const span = Math.max((vals.length - 1) * 3 * MINUTE, 1);
  const dots = feels
    .map((f) => {
      const px = ((f.t - cv.start) / span) * W;
      return `<line class="spark-feel feel-${f.feel}" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${y(f.bac).toFixed(1)}" y2="${H}" vector-effect="non-scaling-stroke"/>`;
    })
    .join('');
  const svg = `<svg class="spark ${statusClass}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px" aria-hidden="true">
    ${ticks}<rect class="spark-zone" x="0" width="${W}" y="${y(zone.max)}" height="${y(zone.min) - y(zone.max)}"/>
    <path class="spark-area" d="${d}L${W},${H}L0,${H}Z"/>
    <path class="spark-line" d="${d}" vector-effect="non-scaling-stroke"/>${dots}
  </svg>`;
  if (!feels.length) return svg;
  // Emoji markers sit in an HTML layer so preserveAspectRatio doesn't squash them.
  const pins = feels
    .map((f) => `<span class="spark-pin" style="left:${(((f.t - cv.start) / span) * 100).toFixed(1)}%;top:${((y(f.bac) / H) * 100).toFixed(1)}%">${Fe.FEELS[f.feel].emoji}</span>`)
    .join('');
  return `<div class="spark-wrap">${svg}${pins}</div>`;
}

function weekChart(weeks, standardGrams, now) {
  const values = weeks.map((w) => w.grams / standardGrams);
  const max = Math.max(4, ...values);
  const bars = weeks
    .map((w, i) => {
      const v = values[i];
      const current = now >= w.start && now < w.end;
      return `<div class="wk ${current ? 'current' : ''}" title="${F.shortDay(w.start)}: ${F.std(w.grams, standardGrams)} standard drinks">
        <span class="wk-val">${v ? F.std(w.grams, standardGrams) : ''}</span>
        <span class="wk-bar" style="height:${Math.max(v ? 4 : 2, (v / max) * 100).toFixed(1)}%"></span>
        <span class="wk-label">${current ? 'Now' : F.weekLabel(w.start)}</span>
      </div>`;
    })
    .join('');
  return `<div class="weeks">${bars}</div>`;
}

function calendarCard(nights, d) {
  const days = Sc.calendar(nights.map((n) => ({ start: n.session.start, peak: n.stats.peak })), d.now, 12);
  const past = days.filter((x) => !x.future);
  const free = past.filter((x) => x.peak === null).length;
  const cells = days
    .map((x) => {
      const st = x.peak === null ? 'free' : M.statusOf(x.peak, d.zone);
      const label = `${F.day(x.t)}: ${x.peak === null ? 'alcohol-free' : `peak ${x.peak.toFixed(2)} ‰`}`;
      return `<span class="cal-day cal-${x.future ? 'future' : st} ${x.today ? 'today' : ''}" title="${label}"></span>`;
    })
    .join('');
  const months = [];
  for (let w = 0; w < 12; w++) {
    const t = days[w * 7].t;
    const first = w === 0 || new Date(t).getMonth() !== new Date(days[(w - 1) * 7].t).getMonth();
    months.push(`<span>${first ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(t) : ''}</span>`);
  }
  return `<section class="card">
    <div class="card-title">Last 12 weeks <small>${free} of ${past.length} days alcohol-free</small></div>
    <div class="cal-months">${months.join('')}</div>
    <div class="cal">${cells}</div>
    <div class="cal-legend"><span><i class="cal-free"></i>free</span><span><i class="cal-below"></i>light</span><span><i class="cal-zone"></i>in zone</span><span><i class="cal-above"></i>over</span><span><i class="cal-high"></i>way over</span></div>
  </section>`;
}

function insightStrip(nights, d) {
  const game = d.game();
  const freeWeek = Sc.alcoholFreeDays(nights.map((n) => ({ start: n.session.start })), d.now, 7);
  const monthAgo = d.now - 30 * 24 * HOUR;
  const top = nights
    .filter((n) => !n.active && n.session.start >= monthAgo && n.score.score != null)
    .reduce((m, n) => (!m || n.score.score > m.score.score ? n : m), null);
  return `<div class="ins-grid strip">
    <button class="ins" data-action="htab" data-value="trophies"><span class="ins-emoji">🔥</span><b>${game.streak.current}</b><small>${game.streak.current === 1 ? 'week' : 'weeks'} streak${game.streak.best > game.streak.current ? ` · best ${game.streak.best}` : ''}</small></button>
    <button class="ins" data-action="htab" data-value="trends"><span class="ins-emoji">🌿</span><b>${freeWeek}/7</b><small>alcohol-free days</small></button>
    <button class="ins" ${top ? `data-action="night" data-id="${top.id}"` : 'disabled'}><span class="ins-emoji">🏆</span><b>${top ? top.score.score : '–'}</b><small>${top ? `best · ${F.shortDay(top.session.start)}` : 'best this month'}</small></button>
  </div>`;
}

function sweetSpotCard(nights, unit) {
  const spot = Sc.sweetSpot(nights.filter((n) => !n.active && n.rating).map((n) => ({ peak: n.stats.peak, rating: n.rating })));
  let line;
  if (!spot.ready) line = `Rate ${plural(spot.needed, 'more morning', 'more mornings')} (☀️ on the Now screen the day after) to find the peak where your mornings stay good.`;
  else if (!spot.found) line = 'So far your peak doesn’t change how your mornings feel. Keep rating — the pattern sharpens.';
  else line = `Mornings average <b>${spot.good.toFixed(1)}/5</b> when you peak under <b>${F.bac(spot.threshold, unit)}</b>, and ${spot.bad.toFixed(1)}/5 above it.`;
  return `<section class="card"><div class="card-title">Sweet spot <small>from your morning ratings</small></div><p class="ins-spot">${line}</p></section>`;
}

function feelStrip(points, fz, zone, unit) {
  const W = 300;
  const rows = { under: 14, zone: 38, over: 62 };
  const maxV = Math.max(1.0, ...points.map((p) => p.bac * 1.08));
  const x = (v) => 8 + (v / maxV) * (W - 16);
  let ticks = '';
  for (let v = 0; v <= maxV + 1e-9; v += 0.2) {
    ticks += `<line class="fs-grid" x1="${x(v)}" x2="${x(v)}" y1="2" y2="74"/><text class="fs-axis" x="${x(v)}" y="88" text-anchor="middle">${unit === 'percent' ? (v / 10).toFixed(2) : v.toFixed(1)}</text>`;
  }
  const set = `<rect class="fs-set" x="${x(zone.min)}" width="${x(zone.max) - x(zone.min)}" y="2" height="72" rx="4"/>`;
  const feel = fz.ready ? `<rect class="fs-feel" x="${x(fz.low)}" width="${Math.max(2, x(fz.high) - x(fz.low))}" y="26" height="24" rx="12"/>` : '';
  const dots = points
    .map((p, i) => `<circle class="fs-dot feel-${p.feel}" cx="${x(p.bac).toFixed(1)}" cy="${rows[p.feel] + ((i % 3) - 1) * 3}" r="4.5"/>`)
    .join('');
  return `<div class="fs-wrap"><div class="fs-labels"><span>🌱</span><span>🎯</span><span>🌀</span></div>
    <svg class="feel-strip" viewBox="0 0 ${W} 92" aria-label="Your check-ins by estimated BAC">${ticks}${set}${feel}${dots}</svg></div>`;
}

function trendChart(tr, unit) {
  const W = 300;
  const H = 90;
  const t0 = tr.nights[0].t;
  const t1 = tr.nights.at(-1).t;
  const vs = tr.nights.map((n) => n.bac);
  const lo = Math.min(...vs) - 0.05;
  const hi = Math.max(...vs) + 0.05;
  const x = (t) => 12 + ((t - t0) / Math.max(t1 - t0, 1)) * (W - 24);
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 24);
  const day = 24 * HOUR;
  const fit = (t) => tr.intercept + tr.slopePerDay * ((t - t0) / day);
  const dots = tr.nights.map((n) => `<circle class="tr-dot" cx="${x(n.t).toFixed(1)}" cy="${y(n.bac).toFixed(1)}" r="4"/>`).join('');
  return `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" aria-label="Feel-good BAC over time">
    <line class="tr-line tr-${tr.direction}" x1="${x(t0)}" y1="${y(fit(t0)).toFixed(1)}" x2="${x(t1)}" y2="${y(fit(t1)).toFixed(1)}"/>${dots}
    <text class="fs-axis" x="12" y="${H - 2}">${F.shortDay(t0)}</text><text class="fs-axis" x="${W - 12}" y="${H - 2}" text-anchor="end">${F.shortDay(t1)}</text>
    <text class="fs-axis" x="${W - 12}" y="12" text-anchor="end">${F.bac(hi - 0.05, unit)}</text>
  </svg>`;
}

function feelCard(state, d) {
  const unit = state.settings.unit;
  const pts = d.feels;
  const fz = Fe.feelZone(pts);
  const counts = { under: 0, zone: 0, over: 0 };
  pts.forEach((p) => counts[p.feel]++);
  const tally = `${Fe.FEELS.under.emoji} ${counts.under} · ${Fe.FEELS.zone.emoji} ${counts.zone} · ${Fe.FEELS.over.emoji} ${counts.over}`;
  if (!fz.ready) {
    return `<section class="card feel-card">
      <div class="card-title">Your feel zone <small>${tally}</small></div>
      <p class="feel-head">Where do <b>you</b> actually feel in the zone?</p>
      <p class="hint" style="margin-top:4px">During a night, tap <b>🎯 In the zone</b> on the Now screen when it feels just right — and 🌱 or 🌀 when it doesn’t. ${plural(fz.needed, 'more 🎯 check-in', 'more 🎯 check-ins')} and your personal zone appears here, with its trend over time.</p>
      ${pts.length ? feelStrip(pts, fz, d.zone, unit) : ''}
    </section>`;
  }
  const sug = Fe.suggestZone(fz);
  const differs = sug && (Math.abs(sug.min - d.zone.min) >= 0.05 || Math.abs(sug.max - d.zone.max) >= 0.05);
  const agree = Fe.agreement(pts, d.zone);
  const tr = Fe.feelTrend(pts);
  const weeks = tr.ready ? Math.max(1, Math.round(tr.spanDays / 7)) : 0;
  const trendText = !tr.ready
    ? `Check in on ${plural(tr.needed, 'more night', 'more nights')} to see how your feel-good point moves over time.`
    : tr.direction === 'steady'
      ? `<b>Steady</b> — your feel-good point hasn’t moved in ${plural(weeks, 'week', 'weeks')}.`
      : tr.direction === 'up'
        ? `<b>Up ${F.bac(tr.change, unit)}</b> in ${plural(weeks, 'week', 'weeks')}. Needing more for the same feeling is how tolerance shows up — worth noticing, and a good reason for a few dry weeks.`
        : `<b>Down ${F.bac(-tr.change, unit)}</b> in ${plural(weeks, 'week', 'weeks')} — you feel it sooner than before.`;
  return `<section class="card feel-card">
    <div class="card-title">Your feel zone <small>${tally}</small></div>
    <p class="feel-head">You feel in the zone at <b>${F.bacNumber(fz.low, unit)}–${F.bac(fz.high, unit)}</b></p>
    ${feelStrip(pts, fz, d.zone, unit)}
    <div class="fs-legend"><span><i class="fs-feel-sw"></i>how you feel</span><span><i class="fs-set-sw"></i>your set zone</span></div>
    ${
      differs
        ? `<div class="feel-suggest"><span>Your set zone is ${F.bacNumber(d.zone.min, unit)}–${F.bac(d.zone.max, unit)}.</span>
            <button class="btn btn-primary" data-action="use-feel-zone" data-min="${sug.min}" data-max="${sug.max}">Use ${F.bacNumber(sug.min, unit)}–${F.bacNumber(sug.max, unit)}</button></div>`
        : '<p class="hint" style="margin:0">✓ Your set zone matches how you feel.</p>'
    }
    ${agree != null ? `<p class="hint" style="margin:0">Your feeling and the estimate agree <b>${Math.round(agree * 100)}%</b> of the time${agree < 0.6 ? ' — a breathalyzer reading would help the model catch up with you.' : '.'}</p>` : ''}
    <div class="label" style="margin:12px 0 6px">Trend</div>
    ${tr.ready ? trendChart(tr, unit) : ''}
    <p class="hint" style="margin:0">${trendText}</p>
  </section>`;
}

function trophyShelf(d) {
  const counts = d.game().counts;
  const items = Object.entries(Sc.BADGES).map(([id, b]) => ({ id, b, n: counts[id] || 0, tier: Sc.tierOf(counts[id] || 0) }));
  const tiles = items
    .map(({ id, b, n, tier }) => `<button class="trophy tier-${tier.index} ${n ? '' : 'locked'}" data-action="badge" data-id="${id}">
        <span class="t-emoji">${b.emoji}</span>
        <span class="t-body"><span class="t-name">${b.name}${tier.name ? ` <em>${tier.name}</em>` : ''}</span><span class="t-desc">${b.desc}</span>
        <span class="t-bar"><i style="width:${(tier.progress * 100).toFixed(0)}%"></i></span>
        <span class="t-count">${tier.next ? `${n} / ${tier.next.n} for ${tier.next.name}` : `${n} · maxed`}</span></span></button>`)
    .join('');
  const earned = items.filter((x) => x.n).length;
  return `<section class="card">
    <div class="card-title">Trophy shelf <small>${earned} of ${items.length} unlocked · Bronze 1 · Silver 5 · Gold 15</small></div>
    <div class="trophies">${tiles}</div>
  </section>`;
}

function nextUp(d) {
  const counts = d.game().counts;
  const close = Object.entries(Sc.BADGES)
    .map(([id, b]) => ({ id, b, tier: Sc.tierOf(counts[id] || 0) }))
    .filter((x) => x.tier.next)
    .sort((a, b) => a.tier.toNext - b.tier.toNext)
    .slice(0, 3);
  if (!close.length) return '';
  return `<section class="card"><div class="card-title">Next up</div><div class="next-up">${close
    .map((x) => `<button class="next-chip" data-action="badge" data-id="${x.id}">${x.b.emoji}<span><b>${x.tier.toNext} more</b> for ${x.b.name} ${x.tier.next.name}</span></button>`)
    .join('')}</div></section>`;
}

export function nightCard(n, d, unit, stdG) {
  const st = n.stats;
  const title = n.name ? F.esc(n.name) : F.day(st.start);
  const sub = n.name ? `${F.day(st.start)} · ` : '';
  const grade = Sc.GRADES[n.score.grade].label;
  return `<button class="card session-card" data-action="night" data-id="${n.id}">
    <div class="session-top">
      ${scoreRing(n.score.score, n.score.grade)}
      <div class="session-head">
        <div class="session-date">${title}${n.active ? '<span class="badge">NOW</span>' : ''}</div>
        <div class="session-meta">${sub}${F.time(st.start)} – ${n.active ? 'now' : F.time(st.end)} · ${plural(st.drinkCount, 'drink', 'drinks')} · ${F.std(st.grams, stdG)} std</div>
        <div class="session-grade">${n.active ? 'In progress' : grade}${n.badges.length ? ` <span class="emojis">${n.badges.map((b) => Sc.BADGES[b].emoji).join('')}</span>` : ''}${n.rating ? ` <span class="emojis">· ${['', '😵', '🥴', '😐', '🙂', '😎'][n.rating]}</span>` : ''}</div>
      </div>
      <div class="session-peak st-${M.statusOf(st.peak, d.zone)}"><b>${F.bacNumber(st.peak, unit)}</b><span>peak ${F.unitLabel(unit)}</span></div>
    </div>
    <div class="session-spark">${sparkline(st.curve, d.zone, `st-${gradeStatus(n.score.grade)}`)}</div>
  </button>`;
}

export function historyView({ state, d, ui }) {
  const unit = state.settings.unit;
  const stdG = state.settings.standardGrams;
  if (!d.sessions.length) {
    return `<h1 class="section-title">History</h1><div class="card empty">No nights yet. Each one shows up here with a zone score, badges and a recap you can share.</div>`;
  }
  const nights = d.nights();
  const tab = ui.historyTab;
  const tabs = `<div class="seg htabs" role="tablist">${[
    ['nights', 'Nights'],
    ['trends', 'Trends'],
    ['trophies', 'Trophies'],
  ]
    .map(([k, label]) => `<button role="tab" data-action="htab" data-value="${k}" aria-pressed="${tab === k}" aria-selected="${tab === k}">${label}</button>`)
    .join('')}</div>`;

  let body;
  if (tab === 'trends') {
    const weeks = M.weeklyGrams(state.drinks, d.now, 8);
    const thisWeek = weeks.at(-1);
    const avg = weeks.slice(0, -1).reduce((m, w) => m + w.grams, 0) / 7;
    body = `${feelCard(state, d)}
      ${sweetSpotCard(nights, unit)}
      ${calendarCard(nights, d)}
      <section class="card">
        <div class="card-title">Standard drinks per week <small>${stdG} g each</small></div>
        ${weekChart(weeks, stdG, d.now)}
        <p class="hint">This week <b>${F.std(thisWeek.grams, stdG)}</b> · 7-week average ${F.std(avg, stdG)}${thisWeek.grams > avg * 1.5 && avg > 0 ? ' · heavier than usual' : ''}</p>
      </section>`;
  } else if (tab === 'trophies') {
    const game = d.game();
    const won = game.weeks.filter((w) => w.complete && w.won).length;
    const done = game.weeks.filter((w) => w.complete).length;
    body = `<div class="summary">
        ${stat({ label: '🔥 Week streak', value: game.streak.current, sub: `best ${game.streak.best}` })}
        ${stat({ label: '🗓️ Goal weeks', value: `${won}/${done}`, sub: 'weeks won' })}
        ${stat({ label: '🎯 Avg score', value: game.average ?? '–', sub: game.best ? `best ${game.best}` : 'no scores yet' })}
      </div>
      ${nextUp(d)}
      ${trophyShelf(d)}`;
  } else {
    const cards = [...nights].reverse().slice(0, 60).map((n) => nightCard(n, d, unit, stdG)).join('');
    body = `${insightStrip(nights, d)}${cards}`;
  }
  return `<h1 class="section-title">History</h1>${tabs}${body}`;
}
