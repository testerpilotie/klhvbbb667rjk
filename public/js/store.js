// Persistence. Everything lives in this browser's localStorage under one key; nothing is sent anywhere.

import { DEFAULT_ELIMINATION } from './model.js';
import { sipMinutesFor } from './drinks.js';

const KEY = 'optihol.v2';
const listeners = new Set();

export const DEFAULT_SETTINGS = {
  zoneMin: 0.5,
  zoneMax: 0.7,
  drivingLimit: 0.5,
  unit: 'permille', // 'permille' | 'percent'
  elimination: DEFAULT_ELIMINATION,
  theme: 'system', // 'system' | 'dark' | 'light'
  food: 'empty',
  standardGrams: defaultStandardGrams(),
  reminders: false,
  goals: { freeDays: 4, neverOver: true, maxStd: 0 }, // weekly; maxStd 0 = no cap
  nickname: '', // first name shown to friends in crew invites (optional)
};

/** Grams of alcohol in one "standard drink" — differs by country. */
function defaultStandardGrams() {
  const lang = (globalThis.navigator?.language || '').toLowerCase();
  if (lang === 'en-us') return 14;
  if (lang === 'en-gb') return 8;
  if (/^(fi|sv|nb|no|da)/.test(lang)) return 12;
  return 10;
}

export const ZONE_LIMITS = { min: 0.2, max: 1.0 };

function blank() {
  return {
    version: 2,
    acceptedAt: null,
    profile: null,
    settings: { ...DEFAULT_SETTINGS },
    drinks: [],
    customDrinks: [],
    water: [], // [{ id, t }]
    readings: [], // breathalyzer readings: [{ id, t, measured }]
    calibration: null, // fitted from readings: { factor, elimination|null, readings }
    feels: [], // subjective check-ins: [{ id, t, feel: 'under' | 'zone' | 'over' }]
    nights: {}, // per session, keyed by its first drink's id: { name, rating, ratedAt }
    celebrated: [], // first-drink ids of sessions that already got the "in the zone" moment
    doneUntil: null,
    installDismissed: false,
    journey: { planned: false, installed: false, dismissed: false }, // first-nights checklist
    plan: null, // a planned night: { start, itemId, name, icon, count, schedule, peak, soberAt, crew }
    invite: null, // a crew invite waiting to be joined (from a ?crew= link)
    stats: { invitesSent: 0 },
    lastSeen: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    const state = { ...blank(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
    state.settings.goals = { ...DEFAULT_SETTINGS.goals, ...state.settings.goals };
    state.journey = { ...blank().journey, ...state.journey };
    state.stats = { ...blank().stats, ...state.stats };
    // Older entries predate sipping time.
    state.drinks.forEach((d) => Number.isFinite(d.sipMin) || (d.sipMin = sipMinutesFor(d)));
    return state;
  } catch {
    return blank();
  }
}

let state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save Optihol data', err);
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(mutator) {
  const next = structuredClone(state);
  mutator(next);
  state = next;
  persist();
  listeners.forEach((fn) => fn(state));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function addDrink(drink) {
  const entry = { id: uid(), ...drink };
  update((s) => {
    s.drinks.push(entry);
    s.drinks.sort((a, b) => a.t - b.t);
    s.doneUntil = null;
  });
  return entry;
}

export function removeDrink(id) {
  update((s) => {
    s.drinks = s.drinks.filter((d) => d.id !== id);
  });
}

export function restoreDrink(drink) {
  update((s) => {
    s.drinks.push(drink);
    s.drinks.sort((a, b) => a.t - b.t);
  });
}

export function updateDrink(id, patch) {
  update((s) => {
    const d = s.drinks.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    s.drinks.sort((a, b) => a.t - b.t);
  });
}

export function addWater(t = Date.now()) {
  const entry = { id: uid(), t };
  update((s) => {
    s.water.push(entry);
    s.water.sort((a, b) => a.t - b.t);
  });
  return entry;
}

export function restoreWater(entry) {
  update((s) => {
    s.water.push(entry);
    s.water.sort((a, b) => a.t - b.t);
  });
}

export function removeWater(id) {
  update((s) => (s.water = s.water.filter((w) => w.id !== id)));
}

export function addFeel(feel, t = Date.now()) {
  const entry = { id: uid(), t, feel };
  update((s) => s.feels.push(entry));
  return entry;
}

export function removeFeel(id) {
  update((s) => (s.feels = s.feels.filter((f) => f.id !== id)));
}

/** Move a night's name/rating/celebration to another of its drinks (when the key drink goes). */
export function moveNightKey(from, to) {
  update((s) => {
    if (s.nights[from]) {
      s.nights[to] = { ...s.nights[from], ...s.nights[to] };
      delete s.nights[from];
    }
    s.celebrated = s.celebrated.map((id) => (id === from ? to : id));
  });
}

export function setNight(id, patch) {
  update((s) => {
    s.nights[id] = { ...s.nights[id], ...patch };
  });
}

export function exportJson() {
  return JSON.stringify({ app: 'optihol', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.drinks)) throw new Error('Not an Optihol export');
  const clean = blank();
  clean.acceptedAt = data.acceptedAt ?? Date.now();
  clean.profile = data.profile ?? null;
  clean.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  clean.drinks = data.drinks
    .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.grams) && d.grams > 0)
    .map((d) => ({ id: d.id || uid(), t: d.t, grams: d.grams, name: String(d.name || 'Drink'), volumeMl: d.volumeMl ?? null, abv: d.abv ?? null, food: d.food || 'empty', icon: d.icon || 'glass', kind: d.kind ?? null, sipMin: Number.isFinite(d.sipMin) ? d.sipMin : sipMinutesFor(d) }));
  clean.customDrinks = Array.isArray(data.customDrinks) ? data.customDrinks : [];
  clean.water = Array.isArray(data.water) ? data.water.filter((w) => Number.isFinite(w.t)) : [];
  clean.readings = Array.isArray(data.readings) ? data.readings.filter((r) => Number.isFinite(r.t) && Number.isFinite(r.measured)) : [];
  clean.calibration = null; // refitted on load

  clean.feels = Array.isArray(data.feels) ? data.feels.filter((f) => Number.isFinite(f.t) && ['under', 'zone', 'over'].includes(f.feel)) : [];
  clean.nights = data.nights && typeof data.nights === 'object' ? data.nights : {};
  state = clean;
  persist();
  listeners.forEach((fn) => fn(state));
}

export function eraseAll() {
  state = blank();
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((fn) => fn(state));
}

// --- One-time import from Optihol v1 (IndexedDB "OptiholDB" on the same origin) ---------------

const V1_DB = 'OptiholDB';

async function v1Exists() {
  if (!('indexedDB' in window)) return false;
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d.name === V1_DB);
  }
  return true; // Older Safari: try to open and bail out if it gets created.
}

function readAll(db, storeName) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve([]);
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function migrateFromV1() {
  if (state.profile || state.drinks.length || localStorage.getItem(`${KEY}.v1-checked`)) return false;
  localStorage.setItem(`${KEY}.v1-checked`, '1');
  try {
    if (!(await v1Exists())) return false;
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(V1_DB);
      let created = false;
      req.onupgradeneeded = () => {
        created = true;
        req.transaction.abort();
      };
      req.onsuccess = () => (created ? reject(new Error('no v1 data')) : resolve(req.result));
      req.onerror = () => reject(req.error);
    });
    const [profiles, drinks] = await Promise.all([readAll(db, 'user_profile'), readAll(db, 'drinks')]);
    db.close();
    const p = profiles[0];
    if (!p && !drinks.length) return false;
    update((s) => {
      if (p) {
        s.profile = { sex: p.gender === 'female' ? 'female' : 'male', weightKg: +p.weight_kg, heightCm: +p.height_cm, age: +p.age };
      }
      s.drinks = drinks
        .filter((d) => d.alcohol_grams > 0 && d.timestamp)
        .map((d) => ({
          id: uid(),
          t: typeof d.timestamp === 'number' ? d.timestamp : Date.parse(d.timestamp),
          grams: d.alcohol_grams,
          name: [d.drinkType, d.size].filter(Boolean).join(' ') || 'Drink',
          volumeMl: null,
          abv: null,
          food: 'empty',
          icon: { Beer: 'pint', Wine: 'wine', Spirits: 'shot' }[d.drinkType] || 'glass',
        }))
        .sort((a, b) => a.t - b.t);
    });
    return true;
  } catch {
    return false;
  }
}
