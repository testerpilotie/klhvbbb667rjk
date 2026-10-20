// The Now screen. Designed for a 5-second glance at a bar: the hero answers "where am I and
// can I have another?", the dock at the bottom is the one place to log, everything else is
// grouped below the fold. See UX.md.

import * as F from '../format.js';
import * as M from '../model.js';
import { describe, iconSvg } from '../drinks.js';
import { gaugeSvg } from '../chart.js';
import { FEELS, feelZone } from '../feel.js';
import * as Sc from '../score.js';
import { FOOD_LABELS, ICONS, STATUS_TEXT, plural, ratingButtons, scoreRing, timelineRows } from './common.js';
import { nightCard } from './history.js';
import { recipeSentence, recipesFor } from './recipe.js';

const { MINUTE } = M;

/** First time the projected curve drops below `threshold` (or null if it never is above it). */
function dropsBelowAt(cv, threshold) {
  for (let i = cv.values.length - 1; i >= 0; i--) {
    if (cv.values[i] >= threshold) return i === cv.values.length - 1 ? null : cv.start + (i + 1) * cv.step;
  }
  return null;
}

export function nowView(ctx) {
  const { d } = ctx;
  if (d.active) {
    // At the bar, the gauge comes first.
    return hero(ctx) + checkinRow(ctx) + tonightCard(ctx) + drinksCard(ctx) + disclaimer();
  }
  const fresh = !d.sessions.length;
  return (
    lastNightCard(ctx) +
    planCard(ctx) +
    // Brand new: the checklist (with your zone in drinks) comes before an empty gauge.
    (fresh ? journeyCard(ctx) + hero(ctx) : hero(ctx) + journeyCard(ctx)) +
    (fresh ? '' : weekCard(ctx)) +
    idleBlocks(ctx) +
    (d.journey ? '' : installCard(ctx)) +
    disclaimer()
  );
}

function disclaimer() {
  return `<p class="disclaimer">Estimates only — real BAC varies person to person. Never use Optihol to decide whether you can drive.</p>`;
}

// ----- Hero: gauge + one-sentence verdict ---------------------------------------------------

function hero(ctx) {
  const { state, d, ui } = ctx;
  const { a, zone } = d;
  const unit = state.settings.unit;
  const status = a.active ? a.status : 'sober';

  let trend = 'No alcohol in your system';
  if (a.active) {
    if (a.rising) trend = `Rising to <b>${F.bac(a.peak, unit)}</b> by ${F.time(a.peakAt)}`;
    else if (status === 'zone' && a.zoneDropAt) trend = `Steady · in your zone until <b>${F.time(a.zoneDropAt)}</b>`;
    else if (status === 'above' || status === 'high') {
      const back = dropsBelowAt(a.future, zone.max);
      trend = back ? `Falling · back in your zone by <b>${F.time(back)}</b>` : 'Falling';
    } else if (status === 'sober') trend = `Almost clear · by <b>${F.time(a.soberAt)}</b>`;
    else trend = `Falling · sober by <b>${F.time(a.soberAt)}</b>`;
  }
  const range = a.active && a.range.high > 0.02
    ? `<div class="range" title="Bodies differ. Your real value is most likely inside this range.">likely ${F.bacNumber(a.range.low, unit)}–${F.bacNumber(a.range.high, unit)}${d.calibrated ? ' · calibrated' : ''}</div>`
    : '';

  return `
    <section class="card hero st-${status} ${ui.celebrateUntil > Date.now() ? 'celebrate' : ''}">
      <div class="gauge">
        ${gaugeSvg({ bac: a.bac, zone, drivingLimit: state.settings.drivingLimit })}
        <div class="gauge-center">
          <div class="bac-value"><span data-num>${F.bacNumber(ui.shownBac ?? 0, unit)}</span><span class="bac-unit">${F.unitLabel(unit)}</span></div>
          <div class="status-pill">${STATUS_TEXT[status]}</div>
          ${range}
        </div>
      </div>
      <p class="trend">${trend}</p>
      ${verdictRow(ctx)}
    </section>`;
}

function verdict({ state, d }) {
  const { a, guidance: g, ref, zone } = d;
  const unit = state.settings.unit;
  const sized = `${F.esc(ref.name)}${ref.volumeMl ? ` (${describe(ref).split(' · ')[0]})` : ''}`;

  if (g.kind === 'done') {
    return { tone: 'sober', icon: ICONS.moon, title: 'Done for tonight', sub: `Sober by ${F.time(a.soberAt)}. Water before bed.`, act: `<button class="verdict-link" data-action="undone">Undo</button>` };
  }
  if (a.active && a.status === 'high') {
    return { tone: 'high', icon: ICONS.water, title: 'Time for water', sub: `You’re past your ${F.bac(zone.max, unit)} ceiling. No more suggestions tonight until you’re back down.` };
  }
  if (g.kind === 'too-big') {
    return { tone: 'above', icon: ICONS.target, title: `${F.esc(ref.name)} is too strong`, sub: `Alone it reaches ${F.bac(g.peak, unit)}, over your zone. Pick something lighter.` };
  }
  if (!a.active) {
    return { tone: 'zone', icon: ICONS.check, title: d.sessions.length ? 'Ready when you are' : 'Log your first drink below', sub: `A ${sized} peaks around ${F.bac(d.lonePeak, unit)} for you.` };
  }
  if (g.kind === 'now') {
    return { tone: 'zone', icon: ICONS.check, title: 'Next drink fits now', sub: `Another ${sized} peaks at ${F.bac(g.peak, unit)}${g.peak < zone.min ? ' — still below your zone' : ' — in your zone'}.` };
  }
  if (g.at) {
    return {
      tone: a.status === 'sober' ? 'below' : a.status,
      icon: ICONS.clock,
      title: `Next drink at ${F.time(g.at)}`,
      sub: `${F.relative(g.at, d.now)} · keeps you under ${F.bac(zone.max, unit)}`,
      bell: true,
    };
  }
  return { tone: 'above', icon: ICONS.clock, title: 'Next drink: not for a while', sub: 'Your drinks keep you up for hours.' };
}

function verdictRow(ctx) {
  const { state, reminders } = ctx;
  const v = verdict(ctx);
  const on = state.settings.reminders && reminders.permission === 'granted';
  const bell = v.bell && reminders.supported
    ? `<button class="verdict-bell" data-action="toggle-reminder" aria-pressed="${on}" aria-label="${on ? 'Turn off next-drink reminder' : 'Remind me when the next drink fits'}" title="${on ? 'Reminder on' : 'Remind me'}">${ICONS.bell}</button>`
    : '';
  return `<div class="verdict st-${v.tone}" role="status">
    <span class="verdict-icon">${v.icon}</span>
    <div class="verdict-text"><b>${v.title}</b><span>${v.sub}</span></div>
    ${bell}${v.act || ''}
  </div>`;
}

// ----- Check-in: one compact row -----------------------------------------------------------

function checkinRow({ state, d }) {
  const unit = state.settings.unit;
  const tonight = d.feels.filter((f) => f.nightStart === d.active.start);
  const last = tonight.at(-1);
  const fz = feelZone(d.feels);
  const nudge = !last || d.now - last.t > 45 * MINUTE;
  const sub = last
    ? `Last: ${FEELS[last.feel].emoji} ${F.relative(last.t, d.now)}`
    : fz.ready
      ? `You usually feel it at ${F.bacNumber(fz.low, unit)}–${F.bac(fz.high, unit)}`
      : `${plural(fz.needed, 'more 🎯', 'more 🎯s')} to find your real zone`;
  const short = { under: 'Not yet', zone: 'In the zone', over: 'Too much' };
  return `<section class="card checkin ${nudge ? 'nudge' : ''}">
    <div class="checkin-head"><b>How do you feel?</b><small>${sub}</small></div>
    <div class="feel-btns">
      ${['under', 'zone', 'over'].map((k) => `<button class="feel-btn feel-${k}" data-action="feel" data-value="${k}"><span>${FEELS[k].emoji}</span><b>${short[k]}</b></button>`).join('')}
    </div>
  </section>`;
}

// ----- Tonight: stats, timeline, stomach -----------------------------------------------------

function tonightCard({ state, d }) {
  const { a, active } = d;
  const unit = state.settings.unit;
  const limit = state.settings.drivingLimit;
  const live = d.nightOf(active).score;
  const cells = [
    { label: 'Zone score', value: live.score ?? '—', sub: live.reached ? `${F.duration(a.minutesInZone * MINUTE)} in zone` : 'starts in your zone' },
    { label: 'Peak', value: F.bac(Math.max(a.sessionPeak, a.peak), unit), sub: a.peak > a.sessionPeak ? `at ${F.time(a.peakAt)}` : 'so far' },
    limit > 0
      ? { label: `Under ${F.bac(limit, unit)}`, value: a.belowLimitAt ? F.time(a.belowLimitAt) : 'Now', sub: 'cautious estimate', warn: !!a.belowLimitAt }
      : { label: 'Drinks', value: active.drinks.length, sub: `${F.std(active.drinks.reduce((m, x) => m + x.grams, 0), state.settings.standardGrams)} standard` },
    { label: 'Sober by', value: F.time(a.soberAt), sub: F.relative(a.soberAt, d.now) },
  ];
  const food = d.food;
  return `<section class="card tonight st-${a.status}">
    <div class="card-title">Tonight <small>${F.duration(d.now - active.start)}</small></div>
    <div class="mini-stats">${cells
      .map((c) => `<div class="mini ${c.warn ? 'warn' : ''}"><span>${c.label}</span><b>${c.value}</b><small>${c.sub}</small></div>`)
      .join('')}</div>
    ${liveRow(d)}
    <div class="timeline" id="timeline"></div>
    <div class="legend"><span><i></i>so far</span><span><i class="dash"></i>projected</span><span><i class="range-sw"></i>likely</span><span><i class="band"></i>zone</span></div>
    <div class="inline-setting"><span title="Eating now affects drinks from the last hour on">Ate?</span>
      <div class="seg seg-sm" role="group" aria-label="Stomach contents">
        ${Object.entries(FOOD_LABELS).map(([k, v]) => `<button data-action="food" data-value="${k}" aria-pressed="${food === k}">${v.short}</button>`).join('')}
      </div>
    </div>
  </section>`;
}

const COLLAPSED_ROWS = 4;

function drinksCard({ d, ui }) {
  const { active } = d;
  const waterCount = d.sessionWater.length;
  const total = active.drinks.length + waterCount;
  const rows = timelineRows(active.drinks, d.sessionWater, {}, ui.showAllDrinks ? Infinity : COLLAPSED_ROWS);
  const toggle = total > COLLAPSED_ROWS
    ? `<button class="show-all" data-action="toggle-drinks">${ui.showAllDrinks ? 'Show fewer' : `Show all ${total}`}</button>`
    : '';
  return `<section class="card">
    <div class="card-title">Drinks <small>${plural(active.drinks.length, 'drink', 'drinks')}${waterCount ? ` · ${plural(waterCount, 'water', 'waters')}` : ''} · tap to edit</small></div>
    <div class="list">${rows}</div>${toggle}
    <div class="card-foot">
      <button class="btn btn-ghost btn-sm" data-action="done">${ICONS.moon}Done for tonight</button>
      <button class="btn btn-ghost btn-sm" data-action="reading">${ICONS.gauge}${d.calibrated ? 'New reading' : 'Breathalyzer'}</button>
    </div>
  </section>`;
}

// ----- Not drinking right now ---------------------------------------------------------------

function idleBlocks({ state, d }) {
  const last = d.sessions.at(-1);
  if (!last) {
    return `<section class="card"><div class="card-title">On the night</div><div class="prose">
      <p><b>Tap a drink in the bar below</b> as you start it. ＋ has everything else, including ones you forgot.</p>
      <p><b>Follow the next-drink time</b> under the gauge. It never pushes you past your zone.</p>
    </div></section>`;
  }
  return `<h2 class="list-title">Last night out</h2>
    ${nightCard(d.nightOf(last), d, state.settings.unit, state.settings.standardGrams)}`;
}

/** First nights: a short checklist where every step says what it unlocks. */
function journeyCard({ state, d }) {
  const j = d.journey;
  if (!j) return '';
  const zone = { min: state.settings.zoneMin, max: state.settings.zoneMax };
  const recipe = !d.sessions.length
    ? `<div class="recipe">${ICONS.check}<p>${recipeSentence(recipesFor(state.profile, zone)[`${zone.min}-${zone.max}`])}</p></div>`
    : '';
  const rows = j.steps
    .map((st) => {
      const isNext = st === j.next;
      const button = isNext && st.action ? `<button class="btn ${st.primary ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="${st.action}">${st.cta}</button>` : '';
      return `<li class="${st.done ? 'done' : isNext ? 'next' : 'todo'}"><span class="j-dot">${st.done ? '✓' : ''}</span>
        <div class="j-text"><b>${st.label}</b><small>${st.done ? 'Done' : isNext && st.hint ? st.hint : `Unlocks ${st.unlock}`}</small></div>${button}</li>`;
    })
    .join('');
  return `<section class="card journey">
    <div class="card-title">${j.complete ? 'You’re all set' : 'Getting to know you'} <small>${j.done} of ${j.total}</small></div>
    <div class="j-bar"><i style="width:${((j.done / j.total) * 100).toFixed(0)}%"></i></div>
    ${recipe}
    <ol class="j-steps">${rows}</ol>
    <div class="j-foot">${j.complete ? '<button class="btn btn-primary btn-sm" data-action="journey-hide">Nice</button>' : '<button class="link" data-action="journey-hide">Hide this</button>'}</div>
  </section>`;
}

/** A planned night, from planning until you start drinking. */
function planCard({ state, d }) {
  const p = d.upcomingPlan;
  if (!p) return '';
  const soon = d.now >= p.start - 60 * MINUTE;
  const when = p.start > d.now ? `starts ${F.relative(p.start, d.now)}` : 'ready when you are';
  return `<section class="card plan-card">
    <div class="card-title">Your plan <small>${when}</small></div>
    <div class="plan-times">${p.schedule
      .map((t, i) => `<span class="${i === 0 && soon ? 'now' : ''}">${iconSvg(p.icon, 18)}<b>${F.time(t)}</b></span>`)
      .join('<i></i>')}</div>
    <p class="hint" style="margin:0">${plural(p.schedule.length, F.esc(p.name), F.esc(p.name) + 's')} · peak ${F.bac(p.peak, state.settings.unit)} · ${p.soberLikely ? `sober around ${F.time(p.soberLikely)} (cautious ${F.time(p.soberAt)})` : `sober by ${F.time(p.soberAt)} (cautious)`}</p>
    <div class="guide-actions">
      ${soon ? `<button class="btn btn-primary btn-grow" data-action="plan-go">${iconSvg(p.icon, 18)}Start: log the first</button>` : ''}
      <button class="btn btn-ghost ${soon ? '' : 'btn-grow'}" data-action="plan">Edit</button>
      <button class="btn btn-ghost" data-action="plan-clear">Clear</button>
    </div>
  </section>`;
}

/** Badges you can still earn tonight — only for good behaviour. */
function liveRow(d) {
  if (!d.live) return '';
  return `<div class="live-goals" aria-label="Tonight's badges">${d.live
    .map((g) => {
      const b = Sc.BADGES[g.id];
      return `<span class="live ${g.done ? 'done' : ''} ${g.failed ? 'failed' : ''}" title="${b.name}: ${b.desc}">${b.emoji}<b>${g.done ? '✓' : g.label}</b></span>`;
    })
    .join('')}</div>`;
}

/** The morning after: reveal last night's score and badges, and ask how you feel. */
function lastNightCard({ state, d, ui }) {
  const n = d.reveal || d.morning;
  if (!n) return '';
  const needsRating = d.morning && d.morning.id === n.id;
  const game = d.game();
  const ups = Sc.tierUps(game.countsWithout(n), game.counts).filter((u) => n.badges.includes(u.id));
  const badges = n.badges
    .map((b) => {
      const up = ups.find((u) => u.id === b);
      return `<span class="reveal-badge ${up ? 'up' : ''}" title="${Sc.BADGES[b].name}">${Sc.BADGES[b].emoji}${up ? `<small>${up.tier}</small>` : ''}</span>`;
    })
    .join('');
  const best = n.score.score != null && n.score.score >= game.best && game.best > 0;
  const greet = new Date(d.now).getHours() < 12 ? 'Good morning!' : 'Hey!';
  queueMicrotask(() => (ui.popped = n.id)); // pop the badges once, not on every refresh
  return `<section class="card morning">
    <div class="morning-head">
      ${scoreRing(n.score.score, n.score.grade)}
      <div><b>${n.revealed ? `${greet} How was the morning after?` : `Last night: ${Sc.GRADES[n.score.grade].label}${best ? ' · personal best 🏆' : ''}`}</b>
      <small>${n.name ? F.esc(n.name) : F.day(n.stats.start)} · peak ${F.bac(n.stats.peak, state.settings.unit)}${n.badges.length ? ` · ${plural(n.badges.length, 'badge', 'badges')}` : ''}</small></div>
    </div>
    ${badges && !n.revealed ? `<div class="reveal-badges ${ui.popped === n.id ? '' : 'pop'}">${badges}</div>` : ''}
    ${needsRating ? ratingButtons(n.id, null) : ''}
    <div class="morning-foot">
      <button class="btn btn-ghost btn-sm" data-action="dismiss-reveal" data-id="${n.id}" ${needsRating ? 'data-skip-rating="1"' : ''}>${needsRating ? 'Skip' : 'Later'}</button>
      ${n.revealed ? '' : `<button class="btn btn-primary btn-sm" data-action="night" data-id="${n.id}">See the recap</button>`}
    </div>
  </section>`;
}

/** When you're not drinking: how the week is going against your own goals. */
function weekCard({ state, d }) {
  const game = d.game();
  const w = game.week;
  const g = game.goals;
  if (!w) return '';
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dots = w.days
    .map((x, i) => {
      const cls = x.drank ? `drank st-${M.statusOf(x.peak, d.zone)}` : x.state === 'past' ? 'free' : x.state;
      return `<span class="wd ${cls}" title="${F.day(x.t)}"><i></i><small>${letters[i]}</small></span>`;
    })
    .join('');
  const msg = {
    met: `Alcohol-free goal met — ${w.free} free days so far.`,
    'on-track': w.free ? `${w.free} of ${g.freeDays} alcohol-free days banked · ${w.need} to go, ${w.pending} days left.` : `Fresh week. An alcohol-free tonight banks day 1 of ${g.freeDays}.`,
    tight: `Every day left needs to be alcohol-free to hit ${g.freeDays}. Tonight counts.`,
    lost: w.over && g.neverOver ? 'This week went over your zone once. Fresh start on Monday.' : `Not this week — ${g.freeDays} free days is out of reach. Fresh start Monday.`,
  }[w.status];
  const checks = [
    { ok: w.free >= g.freeDays, pending: w.status !== 'lost' && w.free < g.freeDays, label: `${g.freeDays} alcohol-free days` },
    ...(g.neverOver ? [{ ok: !w.over, pending: false, label: 'Never over my zone' }] : []),
    ...(g.maxStd ? [{ ok: w.std <= g.maxStd, pending: false, label: `≤ ${g.maxStd} standard drinks (${F.std(w.std * state.settings.standardGrams, state.settings.standardGrams)} so far)` }] : []),
  ];
  return `<section class="card week st-${w.status === 'lost' ? 'above' : 'zone'}">
    <div class="card-title">This week <small>${game.streak.current ? `🔥 ${plural(game.streak.current, 'week', 'weeks')} streak` : game.streak.best ? `best streak ${game.streak.best}` : 'start a streak'}</small></div>
    <div class="week-dots">${dots}</div>
    <p class="week-msg">${msg}</p>
    <ul class="week-goals">${checks.map((c) => `<li class="${c.ok ? 'ok' : c.pending ? 'pending' : 'no'}">${c.label}</li>`).join('')}</ul>
    <button class="link" data-action="tab" data-tab="settings" style="padding:0">Change goals</button>
  </section>`;
}

function installCard({ state, install }) {
  if (state.installDismissed || install.standalone || !(install.prompt || install.ios)) return '';
  const body = install.prompt
    ? `<button class="btn btn-primary" data-action="install">${ICONS.download}Install</button>`
    : `<p class="guide-sub">In Safari, tap <b>Share</b> and then <b>Add to Home Screen</b>.</p>`;
  return `<section class="card install">
    <div class="install-head"><img src="icons/icon-192.png" alt=""><div><b>Put Optihol on your home screen</b><span>Opens instantly, works without signal.</span></div></div>
    <div class="guide-actions">${body}<button class="btn btn-ghost" data-action="dismiss-install">Not now</button></div>
  </section>`;
}

// ----- The dock: the one place to log --------------------------------------------------------

export function dockView({ d }) {
  const chips = d.quick
    .map((q, i) => `<button class="dock-chip" data-action="quick" data-index="${i}" aria-label="Log ${F.esc(q.name)} ${describe(q).split(' · ')[0]}">
      ${iconSvg(q.icon, 22)}<span><b>${F.esc(q.name)}</b><small>${describe(q).split(' · ')[0] || ''}</small></span></button>`)
    .join('');
  const thirsty = d.active && (d.drinksSinceWater >= 2 || d.a.status === 'high');
  const water = `<button class="dock-chip water ${thirsty ? 'thirsty' : ''}" data-action="water" aria-label="Log a glass of water${thirsty ? ` — ${d.drinksSinceWater} drinks since your last` : ''}">
    ${ICONS.water}<span><b>Water</b><small>${thirsty ? `${d.drinksSinceWater} since last` : 'glass'}</small></span>${thirsty ? '<i class="dock-dot"></i>' : ''}</button>`;
  return `<div class="dock" role="toolbar" aria-label="Log a drink">
    <div class="dock-scroll">${water}${chips}</div>
    <button class="dock-add" data-action="add" aria-label="All drinks, custom, or log one you forgot">${ICONS.plus}</button>
  </div>`;
}
