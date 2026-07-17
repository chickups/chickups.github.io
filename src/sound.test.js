// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A stub localStorage matching storage.js's real contract (see storage.test.js's
// FakeLocalStorage): getItem returns null for an absent key, values are strings.
// sound.js reads getSetting('sound') live INSIDE every play() call (never cached
// module-side, mirroring haptics.js's `buzz`), so flipping this stub's contents
// between assertions below is enough to observe the toggle without a module reload.
class FakeLocalStorage {
  constructor() {
    /** @type {Map<string, string>} */
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

/** @returns {FakeLocalStorage} */
function makeStubLocalStorage() {
  return new FakeLocalStorage();
}

// Minimal AudioContext stub that records how many oscillators were started.
let started;
class FakeOsc {
  constructor() {
    // Every sound.js export sets a `to` frequency, so play() always calls
    // exponentialRampToValueAtTime here, not just setValueAtTime — omitting it
    // would throw inside play()'s try/catch and get silently swallowed, making
    // "started" never increment even while enabled. Caught by running this test,
    // not by reasoning about it (see the brief's test-discipline rule).
    this.frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    this.type = 'sine';
  }
  connect() {
    return this;
  }
  start() {
    started++;
  }
  stop() {}
}
class FakeGain {
  constructor() {
    this.gain = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
  }
  connect() {
    return this;
  }
}
class FakeCtx {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = 'running';
  }
  createOscillator() {
    return new FakeOsc();
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

test('sound respects the setting and never throws', async () => {
  started = 0;
  globalThis.AudioContext = /** @type {any} */ (FakeCtx);
  const fakeStorage = makeStubLocalStorage();
  // @ts-expect-error deliberately assigning a minimal stub, not a full Storage implementation
  globalThis.localStorage = fakeStorage;
  const { unlock, flap, bounce, feather, thud, chime, fanfare } = await import('./sound.js');
  unlock();

  // setting defaults ON — nothing stored yet, so getSetting('sound') falls back
  // to SETTINGS' `def: true` (src/core/settings.js), exactly like getSetting()
  // does for every other key in storage.test.js.
  flap();
  assert.ok(started >= 1, 'a sound plays when enabled');

  // Turn it OFF. This is the REAL storage.js key format — a single JSON blob
  // under `chickup.settings` holding `{ [key]: boolean }` (see storage.js's
  // `K.settings` / `readSettings` / `setSetting`) — NOT a per-setting key like
  // `chickup.setting.sound`.
  fakeStorage.setItem('chickup.settings', JSON.stringify({ sound: false }));
  const before = started;
  flap();
  assert.equal(started, before, 'no sound when disabled');

  // Every export must obey the same gate, and none may ever throw regardless of
  // the setting.
  assert.doesNotThrow(() => { bounce(); feather(); thud(); chime(); fanfare(); });
  assert.equal(started, before, 'still no sound from any export while disabled');

  // Flip back ON: the gate must be read live, per call, not cached at import time.
  fakeStorage.setItem('chickup.settings', JSON.stringify({ sound: true }));
  flap();
  assert.ok(started > before, 'sound resumes as soon as the setting flips back on');
});
