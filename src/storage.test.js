// @ts-check
// A stub localStorage, assigned to globalThis BEFORE importing storage.js. storage.js
// reads `localStorage` lazily, inside try/catch, only from within its exported functions
// (readNumber/readString/write/...) — never at module-load time — so the stub only has to
// exist by the time a storage.js function actually runs, not before the import executes.
// That is verified below rather than assumed: see the "import order" test.
//
// The stub must return `null` from `getItem` for an absent key, exactly like the real
// Web Storage API, because that `null` is the entire absent-vs-empty distinction this
// suite exists to pin (see `initMilestoneNotices`'s doc comment in storage.js).
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

const fakeStorage = new FakeLocalStorage();
// @ts-expect-error deliberately assigning a minimal stub, not a full Storage implementation
globalThis.localStorage = fakeStorage;

// Imported AFTER the stub is installed above. Node's static import hoisting still runs
// this at the top of the module's evaluation, but since storage.js does nothing with
// localStorage at its own module-load time (no top-level reads/writes — only function
// bodies touch it), the stub only needs to be in place before a storage.js FUNCTION is
// CALLED, which happens later, inside the tests below. Confirmed by the "import order"
// test, which calls a storage.js function immediately after import and it does not throw.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStats,
  getSeenMilestones,
  checkMilestones,
  initMilestoneNotices,
} from './storage.js';

/** Reset the stub between tests so each test starts from a clean, empty store. */
function resetStorage() {
  fakeStorage.clear();
}

/** Set lifetime totalFeathers directly, the way recordRun's own writes would leave it. */
function seedTotalFeathers(n) {
  fakeStorage.setItem('chickup.stat.totalFeathers', String(n));
}

test('import order: storage.js does not touch localStorage at module-load time', () => {
  // If storage.js read localStorage at the top level (outside a function body), the
  // stub installed above — before the `import` statement is hoisted-evaluated — would
  // still need to already exist, and it does. This test just confirms calling a
  // storage.js function works at all with the stub in place; it does not by itself
  // prove module-load-time safety (that was verified by reading storage.js: every
  // localStorage access is inside try/catch helper functions, never at module scope).
  resetStorage();
  assert.doesNotThrow(() => getStats());
});

test('THE BACKFILL — the existing player (the parade): a big lifetime total, msSeen absent, gets ZERO reward screens', () => {
  resetStorage();
  seedTotalFeathers(5000); // past all three rungs (250, 750, 1500)
  assert.equal(fakeStorage.getItem('chickup.msSeen'), null, 'msSeen must be absent before init');

  initMilestoneNotices();

  assert.deepEqual(getSeenMilestones(), [0, 1, 2], 'every currently-passed rung must be backfilled');
  assert.deepEqual(checkMilestones(getStats()), [], 'zero reward screens for work done before this code shipped');
});

test('THE BACKFILL — the fresh install: msSeen becomes present-and-empty ("[]"), not absent', () => {
  resetStorage();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), null, 'absent before init');

  initMilestoneNotices();

  assert.equal(
    fakeStorage.getItem('chickup.msSeen'),
    '[]',
    'the raw stored value must be the string "[]" — present and empty, not absent',
  );
});

test('THE MUTATION-KILLER — after a fresh-install backfill to "[]", a rung crossed before the NEXT launch must still be granted, not swallowed by a re-backfill', () => {
  // This is the exact scenario the review's mutation exposes. Sequence matters: the
  // buggy guard `if (getSeenMilestones().length > 0) return;` and the correct guard
  // `if (readString(K.msSeen) !== null) return;` behave IDENTICALLY once checkMilestones
  // has already marked a rung seen (both then see a non-empty list and no-op). They only
  // diverge while msSeen is still the freshly-backfilled "[]" (length 0, but PRESENT) —
  // i.e. between a fresh install's first launch and the moment a rung is actually
  // granted. A real app calls initMilestoneNotices() on every launch, so that window is
  // exactly "the player earns feathers during a session, then relaunches before the run
  // that crosses the rung ends" — or more simply, initMilestoneNotices() running again
  // while totalFeathers has already crossed 250 but checkMilestones has not yet fired.
  resetStorage();

  // Fresh install: backfills to "[]" (present, empty — nothing earned yet).
  initMilestoneNotices();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), '[]');

  // The player crosses rung 0 (totalFeathers >= 250) ...
  seedTotalFeathers(250);

  // ...and the app launches again BEFORE checkMilestones has run for this new total.
  // Correct guard: msSeen is present ("[]" !== null), so this must be a complete no-op.
  // Buggy guard: getSeenMilestones() on "[]" is still length 0, so it WOULD re-backfill
  // here — recomputing passedMilestones(250) = [0] and writing "[0]" directly, without
  // ever going through checkMilestones's grant path (no outfit/feathers awarded, no
  // reward screen). That is the swallow: rung 0 gets marked "seen" by a bogus backfill,
  // so checkMilestones later finds nothing pending and the player is never rewarded.
  initMilestoneNotices();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), '[]', 'msSeen must be untouched — this must NOT re-backfill');

  // Now the run ends and checkMilestones actually runs. The reward must still fire.
  const grants = checkMilestones(getStats());
  assert.deepEqual(grants.map((g) => g.index), [0], 'rung 0 must be granted here, not silently swallowed');
  assert.deepEqual(getSeenMilestones(), [0], 'rung 0 is recorded as seen only now, via the real grant path');

  // A further init call is still a no-op (ordinary idempotence, now that msSeen is "[0]").
  initMilestoneNotices();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), '[0]', 'no further change');
  assert.deepEqual(checkMilestones(getStats()), [], 'rung 0 must not be re-announced');
});

test('idempotence: calling initMilestoneNotices() twice on an existing player changes nothing', () => {
  resetStorage();
  seedTotalFeathers(1200);

  initMilestoneNotices();
  const afterFirst = fakeStorage.getItem('chickup.msSeen');
  assert.equal(afterFirst, '[0,1]');

  initMilestoneNotices();
  const afterSecond = fakeStorage.getItem('chickup.msSeen');
  assert.equal(afterSecond, afterFirst, 'a second call must not alter the stored value at all');
  assert.deepEqual(getSeenMilestones(), [0, 1]);
});

test('idempotence: calling initMilestoneNotices() twice on a fresh install changes nothing', () => {
  resetStorage();

  initMilestoneNotices();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), '[]');

  initMilestoneNotices();
  assert.equal(fakeStorage.getItem('chickup.msSeen'), '[]', 'still "[]", not re-derived or touched');
});
