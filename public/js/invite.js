// Crew invites without a server: the invite lives in the link itself.
// A link carries only what the friend needs to join: an optional first name, the start
// time, the zone and the drink. No profile, no BAC, no history. Pure functions, no DOM.

const VERSION = 1;
const MAX_NAME = 24;
const HOUR = 3_600_000;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function cleanName(name) {
  return String(name ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME);
}

/** Build the invite token for a planned night. */
export function encodeInvite({ name, start, zone, drinkId }) {
  const payload = { v: VERSION, s: Math.round(start / 60000), z: [zone.min, zone.max] };
  const n = cleanName(name);
  if (n) payload.n = n;
  if (drinkId) payload.d = String(drinkId).slice(0, 32);
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Read an invite token. Returns null for anything malformed or out of range.
 * Starts more than 12 h in the past are kept but flagged, so the friend can still join the crew.
 */
export function decodeInvite(token, now = Date.now()) {
  try {
    if (!token || token.length > 400) return null;
    const p = JSON.parse(fromBase64Url(token));
    if (p.v !== VERSION || !Number.isFinite(p.s) || !Array.isArray(p.z)) return null;
    const [min, max] = p.z.map(Number);
    if (!(min >= 0.2 && max <= 1.0 && max - min >= 0.1 - 1e-9)) return null;
    const start = p.s * 60000;
    if (start > now + 14 * 24 * HOUR) return null;
    return {
      name: cleanName(p.n) || null,
      start,
      past: start < now - 12 * HOUR,
      zone: { min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100 },
      drinkId: typeof p.d === 'string' ? p.d : null,
    };
  } catch {
    return null;
  }
}

export function inviteUrl(origin, token) {
  return `${origin.replace(/\/$/, '')}/?crew=${token}`;
}
