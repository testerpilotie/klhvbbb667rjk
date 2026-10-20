import * as F from '../format.js';
import { describe, iconSvg } from '../drinks.js';
import { ICONS, LIMITS, STANDARDS, ZONE_PRESETS, numberField, plural, seg } from './common.js';
import { recipeSentence, recipesFor } from './recipe.js';

export function profileFields(p) {
  return `<div class="field full"><span class="lbl">Sex</span>${seg('profile-sex', 'sex', p.sex, [['male', 'Male'], ['female', 'Female']])}</div>
    ${numberField('weightKg', 'Weight', p.weightKg, 'kg', 'min="35" max="250" step="1"')}
    ${numberField('heightCm', 'Height', p.heightCm, 'cm', 'min="120" max="230" step="1"')}
    ${numberField('age', 'Age', p.age, 'years', 'min="18" max="110" step="1"')}`;
}

export function zoneFields(min, max, unit, recipes = null, { compact = false, steppersOnly = false } = {}) {
  const stepper = (key, label, value) => `<div class="field"><span class="lbl">${label}</span><div class="stepper">
    <button data-action="zone-step" data-key="${key}" data-dir="-1" aria-label="Lower ${label}">−</button>
    <output>${F.bacNumber(value, unit)}</output>
    <button data-action="zone-step" data-key="${key}" data-dir="1" aria-label="Raise ${label}">+</button></div></div>`;
  const steppers = `${stepper('zoneMin', `From (${F.unitLabel(unit)})`, min)}
    ${stepper('zoneMax', `To (${F.unitLabel(unit)})`, max)}`;
  if (steppersOnly) return steppers;
  const drinks = (z) => {
    const r = recipes?.[`${z.min}-${z.max}`];
    return r ? `<em>${r.in3h ? `≈ ${plural(r.in3h, 'beer', 'beers')}` : '< 1 beer'}<small> / 3 h</small></em>` : '';
  };
  return `<div class="presets full">${ZONE_PRESETS.map(
    (z) => `<button class="preset" data-action="zone-preset" data-min="${z.min}" data-max="${z.max}" aria-pressed="${z.min === min && z.max === max}">
      <b>${z.name}</b>${drinks(z)}<span>${F.bacNumber(z.min, unit)}–${F.bacNumber(z.max, unit)}</span></button>`,
  ).join('')}</div>
    ${compact ? '' : steppers}`;
}

export function limitSelect(current, unit) {
  return `<select class="select" data-field="drivingLimit" aria-label="Driving limit">
    ${LIMITS.map((l) => `<option value="${l.value}" ${l.value === current ? 'selected' : ''}>${l.value ? `${F.bac(l.value, unit)} — ${l.label}` : l.label}</option>`).join('')}
  </select>`;
}

function toggle(action, on, label, sub, disabled = false) {
  return `<button class="toggle-row" data-action="${action}" role="switch" aria-checked="${on}" ${disabled ? 'disabled' : ''}>
    <span><b>${label}</b><small>${sub}</small></span><span class="switch"></span></button>`;
}

/** Never more than a tap from installing, whatever happened to the checklist. */
function appGroup(install) {
  if (install.standalone) return '';
  const body = install.prompt
    ? `<button class="btn btn-primary" data-action="install">${ICONS.download}Install Optihol</button>`
    : `<p class="muted" style="font-size:14.5px">${install.ios ? 'In Safari, tap <b>Share</b> and then <b>Add to Home Screen</b>.' : 'Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.'}</p>`;
  return `<div class="group-title">App</div>
    <section class="group"><div class="group-body">
      <div class="install-head"><img src="icons/icon-192.png" alt=""><div><b>Put Optihol on your home screen</b><span>Opens instantly, works without signal.</span></div></div>
      ${body}
    </div></section>`;
}

export function settingsView({ state, d, reminders, install }) {
  const s = state.settings;
  const customs = state.customDrinks.length
    ? `<div class="list">${state.customDrinks
        .map((c) => `<div class="row"><div class="row-icon">${iconSvg(c.icon, 22)}</div><div class="row-main"><div class="row-title">${F.esc(c.name)}</div><div class="row-sub">${describe(c)}</div></div>
          <button class="icon-btn" data-action="delete-custom" data-id="${c.id}" aria-label="Delete ${F.esc(c.name)}">${ICONS.close}</button></div>`)
        .join('')}</div>`
    : '<p class="muted" style="font-size:14.5px">Save the drinks you have most — your local IPA, a house wine — for one-tap logging.</p>';

  const factor = d.factor;
  const learned = d.learnedElimination;
  const calibText = state.readings.length
    ? `From ${plural(state.readings.length, 'reading', 'readings')}: you read about <b>${Math.abs(Math.round((factor - 1) * 100))}% ${factor >= 1 ? 'higher' : 'lower'}</b> than the average body your size${
        learned != null ? `, and you burn about <b>${F.bac(learned, s.unit)} per hour</b>` : '. Two readings 45+ minutes apart on the same night also teach Optihol your burn-off rate'
      }.`
    : 'Optihol starts from population averages. A breathalyzer reading during a night tunes the model to your body; two readings 45+ minutes apart also learn how fast you burn alcohol.';

  return `<h1 class="section-title">Settings</h1>
    ${appGroup(install)}
    <div class="group-title">You</div>
    <section class="group"><div class="group-body form-grid" data-scope="profile">${profileFields(state.profile)}</div></section>

    <div class="group-title">Your zone</div>
    <section class="group"><div class="group-body form-grid" data-scope="settings">
      ${zoneFields(s.zoneMin, s.zoneMax, s.unit, recipesFor(state.profile))}
      <p class="hint full" style="margin:0">${recipeSentence(recipesFor(state.profile, { min: s.zoneMin, max: s.zoneMax })[`${s.zoneMin}-${s.zoneMax}`])}</p>
      <div class="field full"><span class="lbl">Driving limit line</span>${limitSelect(s.drivingLimit, s.unit)}</div>
    </div></section>

    <div class="group-title">Weekly goals</div>
    <section class="group"><div class="group-body">
      <div class="setting-row"><div><b>Alcohol-free days</b><div class="sub">per week, Monday to Sunday</div></div>
        <div class="stepper" style="min-width:150px"><button data-action="goal" data-key="freeDays" data-dir="-1" aria-label="Fewer">−</button><output>${s.goals.freeDays}</output><button data-action="goal" data-key="freeDays" data-dir="1" aria-label="More">+</button></div></div>
      <button class="toggle-row" data-action="goal" data-key="neverOver" role="switch" aria-checked="${s.goals.neverOver}">
        <span><b>Never over my zone</b><small>A week with a night above your zone doesn’t count.</small></span><span class="switch"></span></button>
      <div class="field"><label class="lbl" for="f-maxstd">Weekly drink cap</label>
        <select id="f-maxstd" class="select" data-field="maxStd">${[0, 5, 7, 10, 14, 21]
          .map((v) => `<option value="${v}" ${v === s.goals.maxStd ? 'selected' : ''}>${v ? `At most ${v} standard drinks` : 'No cap'}</option>`)
          .join('')}</select></div>
      <p class="hint" style="margin:0">Meet every goal and the week counts toward your 🔥 streak. A dry week always does.</p>
    </div></section>

    <div class="group-title">Breathalyzer calibration</div>
    <section class="group"><div class="group-body">
      <p class="calib-text">${calibText}</p>
      <div class="guide-actions">
        <button class="btn btn-ghost btn-grow" data-action="reading" ${d.active ? '' : 'disabled'}>${ICONS.gauge}Add reading</button>
        ${state.readings.length ? '<button class="btn btn-ghost" data-action="reset-calibration">Reset</button>' : ''}
      </div>
      ${d.active ? '' : '<p class="hint" style="margin:0">Available during a session.</p>'}
    </div></section>

    <div class="group-title">Display</div>
    <section class="group"><div class="group-body">
      <div class="field"><span class="lbl">Units</span>${seg('setting', 'unit', s.unit, [['permille', 'Promille ‰'], ['percent', 'Percent %']])}</div>
      <div class="field"><label class="lbl" for="f-std">Standard drink</label>
        <select id="f-std" class="select" data-field="standardGrams">${STANDARDS.map((o) => `<option value="${o.value}" ${o.value === s.standardGrams ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Theme</span>${seg('setting', 'theme', s.theme, [['system', 'Auto'], ['dark', 'Dark'], ['light', 'Light']])}</div>
    </div></section>

    <div class="group-title">Notifications</div>
    <section class="group"><div class="group-body">
      ${toggle('toggle-reminder', s.reminders && reminders.permission === 'granted', 'Next-drink reminder',
        reminders.supported ? 'A nudge when your next drink fits. Works while Optihol is open or in the background.' : 'This browser doesn’t support notifications. Install Optihol to your home screen first.',
        !reminders.supported)}
      ${reminders.permission === 'denied' ? '<p class="hint" style="margin:0">Notifications are blocked for this site in your browser settings.</p>' : ''}
    </div></section>

    <div class="group-title">My drinks</div>
    <section class="group"><div class="group-body">${customs}
      <button class="btn btn-ghost" data-action="new-custom">${ICONS.plus}Add a custom drink</button></div></section>

    <div class="group-title">Model</div>
    <section class="group"><div class="group-body">
      <div class="field"><div class="setting-row"><span class="lbl">Burn-off rate</span><span class="num" id="elim-out">${F.bac(learned ?? s.elimination, s.unit)}/h${learned != null ? ' · learned' : ''}</span></div>
        <input type="range" min="0.10" max="0.25" step="0.01" value="${learned ?? s.elimination}" data-field="elimination" aria-label="Burn-off rate" ${learned != null ? 'disabled' : ''}>
        <p class="hint">${learned != null ? 'Learned from your breathalyzer readings. Reset calibration to set it by hand.' : 'Most people clear 0.10–0.20 ‰ per hour. Leave it at 0.15 unless you know better — or let two breathalyzer readings measure it.'}</p></div>
      <details><summary>How Optihol calculates</summary><div class="prose" style="margin-top:10px">
        <p>Your body water is estimated from sex, age, height and weight (Watson formula). Each drink is absorbed gradually — faster on an empty stomach, slower and less completely after a meal.</p>
        <p>Your liver clears a roughly fixed amount per hour, slowing down as you approach zero (Michaelis–Menten kinetics). Breathalyzer readings scale the model to your body.</p>
        <p>The <b>likely range</b> shows where you’d be if your body is lighter or heavier on alcohol than average. The driving-limit time uses the cautious end of it.</p>
        <p><b>Sober</b> means below 0.05 ‰ — what a breathalyzer shows as 0.00. “Sober by” is when the curve on your timeline drops below that.</p>
        <p>The next-drink time is the earliest moment your usual drink can be added without the projected peak going above your zone.</p>
        <p>It’s a model, not a measurement. Medication, fatigue, illness, genetics and how fast you drink all change the real number.</p>
      </div></details>
    </div></section>

    <div class="group-title">Your data</div>
    <section class="group"><div class="group-body">
      <p class="muted" style="font-size:14.5px">${ICONS.lock} Everything is stored only on this device. No account, no tracking.</p>
      <div class="guide-actions">
        <button class="btn btn-ghost btn-grow" data-action="export">Export</button>
        <button class="btn btn-ghost btn-grow" data-action="import">Import</button>
        <input type="file" accept="application/json,.json" id="import-file" hidden>
      </div>
      <button class="btn btn-danger" data-action="erase">Erase all data</button>
    </div></section>
    <p class="disclaimer">Optihol 2.1 · Estimates only. Don’t drink and drive. Not medical advice. 18+.</p>`;
}
