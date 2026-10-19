// Drink presets and the little glass icons used for them.

// sipMin: typical minutes to finish it. The model spreads intake over that time.
export const PRESETS = [
  { id: 'pint', name: 'Beer', volumeMl: 500, abv: 5.0, icon: 'pint', sipMin: 25 },
  { id: 'can', name: 'Beer can', volumeMl: 330, abv: 4.7, icon: 'can', sipMin: 20 },
  { id: 'long', name: 'Long drink', volumeMl: 330, abv: 5.5, icon: 'can', sipMin: 20 },
  { id: 'cider', name: 'Cider', volumeMl: 330, abv: 4.7, icon: 'bottle', sipMin: 20 },
  { id: 'wine12', name: 'Wine', volumeMl: 120, abv: 12.5, icon: 'wine', sipMin: 20 },
  { id: 'wine16', name: 'Large wine', volumeMl: 160, abv: 12.5, icon: 'wine', sipMin: 25 },
  { id: 'shot', name: 'Shot', volumeMl: 40, abv: 40, icon: 'shot', sipMin: 0 },
  { id: 'cocktail', name: 'Cocktail', volumeMl: 60, abv: 40, icon: 'cocktail', sipMin: 15 },
];

const SIP_BY_ICON = { pint: 25, can: 20, bottle: 20, wine: 20, shot: 0, cocktail: 15, glass: 20 };

/** Minutes to drink something that has no explicit sipMin (custom and older entries). */
export function sipMinutesFor(item) {
  if (Number.isFinite(item.sipMin)) return item.sipMin;
  if (item.abv >= 30 && item.volumeMl <= 50) return 0;
  return SIP_BY_ICON[item.icon] ?? 20;
}

const PATHS = {
  pint: 'M7 4h10l-1.2 15.2a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8L7 4Zm.4 4h9.2',
  can: 'M8 4.5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5V19.5c0 .8-.7 1.5-1.5 1.5h-5c-.8 0-1.5-.7-1.5-1.5V4.5Zm0 2.5h8m-8 10h8',
  bottle: 'M10 2.5h4v4l1.6 2.4c.3.5.4 1 .4 1.5V20a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20v-9.6c0-.5.1-1 .4-1.5L10 6.5v-4Zm-2 11h8',
  wine: 'M7.5 3h9l.3 4.2A4.8 4.8 0 0 1 12 12.4a4.8 4.8 0 0 1-4.8-5.2L7.5 3ZM12 12.4V20m-3.5 1h7M7.4 7h9.2',
  shot: 'M7.5 7h9l-1.4 12.3a1.5 1.5 0 0 1-1.5 1.2h-3.2a1.5 1.5 0 0 1-1.5-1.2L7.5 7Zm.6 5h7.8',
  cocktail: 'M4.5 4h15L12 12.5 4.5 4Zm7.5 8.5V20m-4 1h8M7 7h10',
  glass: 'M7 4h10l-1.5 16h-7L7 4Zm.5 5h9',
};

export function iconSvg(name, size = 24) {
  const d = PATHS[name] || PATHS.glass;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

export const ICON_CHOICES = Object.keys(PATHS);

export function describe(d) {
  if (!d.volumeMl) return '';
  const vol = d.volumeMl >= 250 ? `${(d.volumeMl / 1000).toFixed(d.volumeMl % 100 ? 2 : 1)} l` : `${d.volumeMl / 10} cl`;
  return `${vol} · ${+d.abv.toFixed(1)}%`;
}
