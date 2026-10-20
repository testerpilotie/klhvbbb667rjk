import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, decodeInvite, encodeInvite, inviteUrl } from '../public/js/invite.js';

const NOW = Date.UTC(2026, 9, 23, 15, 0);
const START = Date.UTC(2026, 9, 23, 18, 0);

test('invite round-trips name, start, zone and drink', () => {
  const token = encodeInvite({ name: 'Joonas', start: START, zone: { min: 0.5, max: 0.7 }, drinkId: 'pint' });
  assert.match(token, /^[A-Za-z0-9_-]+$/, 'URL-safe');
  const inv = decodeInvite(token, NOW);
  assert.deepEqual(inv, { name: 'Joonas', start: START, past: false, zone: { min: 0.5, max: 0.7 }, drinkId: 'pint' });
  assert.equal(inviteUrl('https://optihol.com/', token), `https://optihol.com/?crew=${token}`);
});

test('names are optional, trimmed and stripped of markup', () => {
  assert.equal(cleanName('  <b>Äijä</b>  '), 'bÄijä/b');
  assert.equal(cleanName('x'.repeat(40)).length, 24);
  const inv = decodeInvite(encodeInvite({ start: START, zone: { min: 0.3, max: 0.5 } }), NOW);
  assert.equal(inv.name, null);
  assert.equal(inv.drinkId, null);
});

test('malformed or out-of-range invites are rejected', () => {
  assert.equal(decodeInvite('not-base64!!', NOW), null);
  assert.equal(decodeInvite('', NOW), null);
  const bad = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.equal(decodeInvite(bad({ v: 2, s: START / 60000, z: [0.5, 0.7] }), NOW), null, 'unknown version');
  assert.equal(decodeInvite(bad({ v: 1, s: START / 60000, z: [0.5, 2.0] }), NOW), null, 'zone above 1.0 ‰');
  assert.equal(decodeInvite(bad({ v: 1, s: START / 60000, z: [0.6, 0.62] }), NOW), null, 'zone too narrow');
  assert.equal(decodeInvite(bad({ v: 1, s: (NOW + 30 * 864e5) / 60000, z: [0.5, 0.7] }), NOW), null, 'a month ahead');
});

test('old invites still decode but are flagged as past', () => {
  const inv = decodeInvite(encodeInvite({ name: 'A', start: NOW - 20 * 3600e3, zone: { min: 0.5, max: 0.7 } }), NOW);
  assert.equal(inv.past, true);
});
