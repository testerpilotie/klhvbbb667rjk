// Your zone in plain drinks ("≈ 2 beers"), shared by onboarding, Settings and the planner.

import * as F from '../format.js';
import { makeBody, gramsOf } from '../model.js';
import { zoneRecipe } from '../plan.js';
import { PRESETS } from '../drinks.js';
import { ZONE_PRESETS, plural } from './common.js';

const BEER = PRESETS.find((p) => p.id === 'pint');
export const BEER_REF = { grams: gramsOf(BEER.volumeMl, BEER.abv), food: 'empty', sipMin: BEER.sipMin };

let recipeMemo = { key: null, map: null };

/** "≈ N beers" for each zone preset (and the chosen zone), for this body. */
export function recipesFor(profile, extraZone) {
  const key = JSON.stringify([profile, extraZone]);
  if (recipeMemo.key === key) return recipeMemo.map;
  const body = makeBody(profile);
  const map = {};
  for (const z of [...ZONE_PRESETS, extraZone].filter(Boolean)) map[`${z.min}-${z.max}`] = zoneRecipe(body, z, BEER_REF);
  recipeMemo = { key, map };
  return map;
}

/** One plain sentence: what the zone means in beers for this person. */
export function recipeSentence(r) {
  if (!r || r.tooBig) return 'A single beer already overshoots this range. Try a wider zone.';
  if (!r.toReach) return 'This range sits below even one beer for you — any drink takes you past it.';
  const keep = r.keepEveryMin ? `, then <b>one every ~${F.duration(r.keepEveryMin * 60_000)}</b> keeps you there` : '';
  return `For you, <b>${plural(r.toReach, 'beer', 'beers')}</b> (0.5 l) paced over ~${F.duration(r.reachMin * 60_000)} get you there${keep}.`;
}
