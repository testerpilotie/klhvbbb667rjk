// First open. Goal: a personal "aha" in under a minute, without needing to be drinking.
// One consent tap, the body basics, then the zone chosen in drinks rather than ‰. See UX.md.

import { gaugeSvg } from '../chart.js';
import { ICONS, seg } from './common.js';
import { recipeSentence, recipesFor } from './recipe.js';
import { limitSelect, profileFields, zoneFields } from './settings.js';

export function profileValid(p) {
  return p.weightKg >= 35 && p.weightKg <= 250 && p.heightCm >= 120 && p.heightCm <= 230 && p.age >= 18 && p.age <= 110;
}

export function onboardingView(ob) {
  const steps = `<div class="ob-steps">${[0, 1, 2].map((i) => `<span class="${i <= ob.step ? 'on' : ''}"></span>`).join('')}</div>`;
  const back = ob.step ? `<button class="btn btn-ghost" data-action="ob-back">Back</button>` : '';

  if (ob.step === 0) {
    return `<div class="ob">${steps}
      <div class="ob-demo" aria-hidden="true">
        <div class="gauge demo st-zone">${gaugeSvg({ bac: 0.6, zone: { min: 0.5, max: 0.7 }, drivingLimit: 0 })}
          <div class="gauge-center"><div class="bac-value">0.60<span class="bac-unit">‰</span></div><div class="status-pill">In your zone</div></div></div>
      </div>
      <div><h1>Stay in your zone.</h1><p class="lead" style="margin-top:10px">Know how much, and when. Optihol paces your drinks so the night stays fun — not foggy.</p></div>
      <div class="features compact">
        <div class="feature"><div class="fi">${ICONS.target}</div><div><b>Next drink at 20:50</b><span>Pacing that never pushes you past your limit.</span></div></div>
        <div class="feature"><div class="fi">${ICONS.lock}</div><div><b>No account, nothing uploaded</b><span>Everything stays on this phone.</span></div></div>
      </div>
      <div class="ob-foot">
        <label class="check"><input type="checkbox" data-ob="consent" ${ob.consent ? 'checked' : ''}><span>I’m of legal drinking age, and I know Optihol shows <b>estimates</b> — never a reason to drive.</span></label>
        <button class="btn btn-primary btn-block" data-action="ob-next" ${ob.consent ? '' : 'disabled'}>Get started</button>
      </div></div>`;
  }
  if (ob.step === 1) {
    return `<div class="ob">${steps}
      <div><h1>About you</h1><p class="lead" style="margin-top:10px">Bodies handle alcohol differently. This is how Optihol works out yours.</p></div>
      <div class="form-grid" data-scope="ob-profile">${profileFields(ob.profile)}</div>
      <p class="hint" style="margin:0">${ICONS.lock} Stays on this phone. Change it any time in Settings.</p>
      <div class="ob-foot"><div class="guide-actions">${back}<button class="btn btn-primary btn-grow" data-action="ob-next" ${profileValid(ob.profile) ? '' : 'disabled'}>Continue</button></div></div>
    </div>`;
  }
  const zone = { min: ob.zoneMin, max: ob.zoneMax };
  const recipes = recipesFor(ob.profile, zone);
  return `<div class="ob">${steps}
    <div><h1>Pick your zone</h1><p class="lead" style="margin-top:10px">Where you like to be. Optihol paces you to stay there.</p></div>
    <div class="form-grid" data-scope="ob-zone">
      ${zoneFields(ob.zoneMin, ob.zoneMax, ob.unit, recipes, { compact: true })}
    </div>
    <div class="recipe">${ICONS.check}<p>${recipeSentence(recipes[`${zone.min}-${zone.max}`])}</p></div>
    <details class="ob-more"><summary>Fine-tune, units and driving line</summary>
      <div class="form-grid" data-scope="ob-zone" style="margin-top:12px">
        ${zoneFields(ob.zoneMin, ob.zoneMax, ob.unit, null, { steppersOnly: true })}
        <div class="field full"><span class="lbl">Units</span>${seg('ob-unit', 'unit', ob.unit, [['permille', 'Promille ‰'], ['percent', 'Percent %']])}</div>
        <div class="field full"><span class="lbl">Show driving limit line</span>${limitSelect(ob.drivingLimit, ob.unit)}</div>
      </div>
    </details>
    <div class="ob-foot"><div class="guide-actions">${back}<button class="btn btn-primary btn-grow" data-action="ob-finish">Show me my night</button></div></div>
  </div>`;
}
