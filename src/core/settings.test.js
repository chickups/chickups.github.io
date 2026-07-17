// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, settingAt } from './settings.js';

test('only the five toggles that actually do something ship (spec D8)', () => {
  // Sound Effects is wired to src/sound.js's WebAudio engine, so it ships.
  // Music (a loop, not an effect) is still out of scope, one language, no IAP,
  // and a full-screen tap has nothing to mirror. A switch that does nothing is
  // worse than no switch: the player concludes the mute is broken, or that the
  // game is.
  assert.deepEqual(SETTINGS.map((s) => s.key), ['haptics', 'sound', 'hints', 'motion', 'contrast']);
  for (const banned of ['music', 'sfx', 'leftHanded', 'language', 'restore']) {
    assert.equal(settingAt(banned), null, `${banned} must not ship — D8`);
  }
});

test('every setting carries a label, a group and a boolean default', () => {
  for (const s of SETTINGS) {
    assert.equal(typeof s.key, 'string');
    assert.ok(s.label.length > 0);
    assert.equal(s.group, 'GAMEPLAY');
    assert.equal(typeof s.def, 'boolean');
  }
});

test('the defaults are the friendly ones', () => {
  // Haptics and hints ON: a new player gets help and feel. Motion and contrast
  // OFF: they are accommodations, and the OS media query already covers motion
  // for anyone who asked the OS.
  assert.equal(settingAt('haptics')?.def, true);
  assert.equal(settingAt('sound')?.def, true);
  assert.equal(settingAt('hints')?.def, true);
  assert.equal(settingAt('motion')?.def, false);
  assert.equal(settingAt('contrast')?.def, false);
});

test('settingAt tolerates junk — its argument comes from localStorage', () => {
  assert.equal(settingAt(''), null);
  assert.equal(settingAt('nope'), null);
  assert.equal(settingAt(/** @type {any} */ (null)), null);
  assert.equal(settingAt(/** @type {any} */ (42)), null);
});

test('the table is frozen — a screen must never mutate it', () => {
  assert.ok(Object.isFrozen(SETTINGS));
  assert.throws(() => /** @type {any} */ (SETTINGS).push({}));
});
