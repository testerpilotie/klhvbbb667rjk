import { ICONS, seg } from './common.js';
import { limitSelect, profileFields, zoneFields } from './settings.js';

export function profileValid(p) {
  return p.weightKg >= 35 && p.weightKg <= 250 && p.heightCm >= 120 && p.heightCm <= 230 && p.age >= 18 && p.age <= 110;
}

export function onboardingView(ob) {
  const steps = `<div class="ob-steps">${[0, 1, 2].map((i) => `<span class="${i <= ob.step ? 'on' : ''}"></span>`).join('')}</div>`;
  const back = ob.step ? `<button class="btn btn-ghost" data-action="ob-back">Back</button>` : '';

  if (ob.step === 0) {
    return `<div class="ob">${steps}
      <div class="ob-hero"><img src="icons/icon-192.png" alt=""></div>
      <div><h1>Stay in your zone.</h1><p class="lead" style="margin-top:10px">Optihol estimates your blood alcohol in real time and tells you when your next drink fits — so the night stays fun, not foggy.</p></div>
      <div class="features">
        <div class="feature"><div class="fi">${ICONS.pulse}</div><div><b>Live estimate</b><span>Where you are, where you’re heading, and how sure that is.</span></div></div>
        <div class="feature"><div class="fi">${ICONS.target}</div><div><b>Smart pacing</b><span>A next-drink time that never pushes you past your limit.</span></div></div>
        <div class="feature"><div class="fi">${ICONS.gauge}</div><div><b>Learns your body</b><span>Got a breathalyzer? One reading tunes the model to you.</span></div></div>
        <div class="feature"><div class="fi">${ICONS.lock}</div><div><b>Private by design</b><span>No account. Your data never leaves this phone.</span></div></div>
      </div>
      <div class="ob-foot">
        <label class="check"><input type="checkbox" data-ob="age18" ${ob.age18 ? 'checked' : ''}><span>I’m of legal drinking age where I live.</span></label>
        <label class="check"><input type="checkbox" data-ob="estimates" ${ob.estimates ? 'checked' : ''}><span>I understand Optihol shows <b>estimates</b> and I’ll never use it to decide whether I can drive.</span></label>
        <button class="btn btn-primary btn-block" data-action="ob-next" ${ob.age18 && ob.estimates ? '' : 'disabled'}>Get started</button>
      </div></div>`;
  }
  if (ob.step === 1) {
    return `<div class="ob">${steps}
      <div><h1>About you</h1><p class="lead" style="margin-top:10px">Used to estimate how alcohol spreads through your body. Stays on this device.</p></div>
      <div class="form-grid" data-scope="ob-profile">${profileFields(ob.profile)}</div>
      <div class="ob-foot"><div class="guide-actions">${back}<button class="btn btn-primary btn-grow" data-action="ob-next" ${profileValid(ob.profile) ? '' : 'disabled'}>Continue</button></div></div>
    </div>`;
  }
  return `<div class="ob">${steps}
    <div><h1>Pick your zone</h1><p class="lead" style="margin-top:10px">The range you’d like to stay in. Optihol paces your drinks to keep you inside it.</p></div>
    <div class="form-grid" data-scope="ob-zone">
      ${zoneFields(ob.zoneMin, ob.zoneMax, ob.unit)}
      <div class="field full"><span class="lbl">Units</span>${seg('ob-unit', 'unit', ob.unit, [['permille', 'Promille ‰'], ['percent', 'Percent %']])}</div>
      <div class="field full"><span class="lbl">Show driving limit line</span>${limitSelect(ob.drivingLimit, ob.unit)}</div>
    </div>
    <div class="ob-foot"><div class="guide-actions">${back}<button class="btn btn-primary btn-grow" data-action="ob-finish">Start tracking</button></div></div>
  </div>`;
}
