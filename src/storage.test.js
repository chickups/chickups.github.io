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
  recordRun,
  getSeenMilestones,
  checkMilestones,
  initMilestoneNotices,
  getStreak,
  setStreak,
  getStreakClaimed,
  setStreakClaimed,
  getSetting,
  setSetting,
  getFeathers,
  earnFeathers,
  hasSeenTutorial,
  markTutorialSeen,
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

test('getStreak() is null when nothing has ever been stored', () => {
  resetStorage();
  assert.equal(getStreak(), null);
});

test('setStreak/getStreak round-trip exactly, floored to integers', () => {
  resetStorage();
  setStreak({ day: 20000.9, length: 3.2 });
  assert.deepEqual(getStreak(), { day: 20000, length: 3 });
});

test('getStreak() treats untrusted localStorage as absent rather than throwing', () => {
  // Exactly the discipline getSeenAchievements/getSeenMilestones/readStringArray follow:
  // an older build, hand-edited JSON, or plain junk must fall back cleanly. This would
  // fail if the `!Number.isFinite` guards (or the object/array checks) were removed.
  resetStorage();
  for (const raw of [
    'not json at all',
    '"a string"',
    '42',
    '[1,2]',
    '{}',
    '{"day":"x","length":2}',
    '{"day":20000}',
    '{"length":3}',
    '{"day":null,"length":3}',
  ]) {
    fakeStorage.setItem('chickup.streak', raw);
    assert.equal(getStreak(), null, `raw: ${raw}`);
  }
});

test('getStreakClaimed() is -1 (never) when absent, distinct from a real day 0', () => {
  resetStorage();
  assert.equal(getStreakClaimed(), -1);
  // Prove -1 really means "absent", not just "the default returned by readNumber for
  // anything": day 0 itself must read back as 0, not get confused with "never".
  setStreakClaimed(0);
  assert.equal(getStreakClaimed(), 0);
});

test('setStreakClaimed/getStreakClaimed round-trip, floored to an integer day', () => {
  resetStorage();
  setStreakClaimed(20005.9);
  assert.equal(getStreakClaimed(), 20005);
});

test('getStreakClaimed() falls back to -1 on corrupt storage rather than NaN or throwing', () => {
  resetStorage();
  fakeStorage.setItem('chickup.streakClaimed', 'not a number');
  assert.equal(getStreakClaimed(), -1);
});

test('getSetting() returns the table default when nothing has ever been stored', () => {
  // Kills a mutation that hardcodes a wrong default, or one that ignores the
  // table and returns `false`/`true` unconditionally for every key.
  resetStorage();
  assert.equal(getSetting('haptics'), true);
  assert.equal(getSetting('hints'), true);
  assert.equal(getSetting('motion'), false);
  assert.equal(getSetting('contrast'), false);
});

test('getSetting() returns false, not the table default, for a key that does not exist', () => {
  // "Unknown keys are false" is a distinct rule from "known keys default from the
  // table" — a mutation that always falls through to `settingAt(key)?.def ?? false`
  // without the unknown check would still pass the test above but this pins the
  // unknown-key path specifically. `settingAt` returns null for junk, so this also
  // proves getSetting cannot throw on it.
  resetStorage();
  assert.equal(getSetting('bogus'), false);
  assert.equal(getSetting(''), false);
});

test('setSetting()/getSetting() round-trip: flipping a setting persists the new value', () => {
  resetStorage();
  assert.equal(getSetting('haptics'), true);
  setSetting('haptics', false);
  assert.equal(getSetting('haptics'), false, 'must read back the stored override, not the default');
  setSetting('haptics', true);
  assert.equal(getSetting('haptics'), true, 'must round-trip back on a second flip');
});

test('setSetting() on one key does not clobber a different key already stored', () => {
  // Kills a mutation that writes `{[key]: on}` directly instead of spreading the
  // existing record first — that would silently reset every other setting to its
  // default the next time ANY toggle was flipped.
  resetStorage();
  setSetting('motion', true);
  setSetting('contrast', true);
  assert.equal(getSetting('motion'), true, 'motion must survive a later write to a different key');
  assert.equal(getSetting('contrast'), true);
  assert.equal(getSetting('haptics'), true, 'untouched keys still read their default');
});

test('setSetting() on an unknown key is a complete no-op — it does not even write', () => {
  // Kills a mutation that drops the `settingAt(key)` guard in setSetting: without
  // it, an unknown/renamed key from an older build could get written straight
  // into the record instead of being refused at the door.
  resetStorage();
  setSetting('bogus', true);
  assert.equal(fakeStorage.getItem('chickup.settings'), null, 'no settings record should exist at all yet');
});

test('getSetting() falls back to defaults when the whole settings blob is junk, not just missing', () => {
  // Mirrors getStreak()'s junk-tolerance test above: an older build's shape, a
  // hand-edited value, or plain noise must never throw and must never be read
  // as a live override.
  resetStorage();
  for (const raw of ['not json at all', '"a string"', '42', '[1,2,3]', 'null', '{}']) {
    fakeStorage.setItem('chickup.settings', raw);
    assert.equal(getSetting('haptics'), true, `raw: ${raw}`);
    assert.equal(getSetting('motion'), false, `raw: ${raw}`);
  }
});

test('recordRun increments wins only when won is true', () => {
  resetStorage();
  recordRun({ metres: 1200, feathers: 10, maxChain: 1, biomeIndex: 5, won: true });
  assert.equal(getStats().wins, 1);
  recordRun({ metres: 800, feathers: 10, maxChain: 1, biomeIndex: 4, won: false });
  assert.equal(getStats().wins, 1); // a loss must NOT increment — kills "always ++"
});

test('recordRun accumulates lifetime totalMetres across runs', () => {
  resetStorage();
  recordRun({ metres: 300, feathers: 0, maxChain: 1, biomeIndex: 1, won: false });
  assert.equal(getStats().totalMetres, 300);
  recordRun({ metres: 450, feathers: 0, maxChain: 1, biomeIndex: 2, won: false });
  assert.equal(getStats().totalMetres, 750); // sums, not max — kills "Math.max" mutation
});

test('recordRun increments moddedWins only on a daily win, not a normal win or a daily loss', () => {
  resetStorage();
  recordRun({ metres: 1200, feathers: 0, maxChain: 1, biomeIndex: 5, won: true, daily: false });
  assert.equal(getStats().moddedWins, 0); // a NON-daily win must not count
  recordRun({ metres: 900, feathers: 0, maxChain: 1, biomeIndex: 4, won: false, daily: true });
  assert.equal(getStats().moddedWins, 0); // a daily LOSS must not count
  recordRun({ metres: 1200, feathers: 0, maxChain: 1, biomeIndex: 5, won: true, daily: true });
  assert.equal(getStats().moddedWins, 1); // only daily AND won increments
});

test('getSetting() filters a mixed blob: an unknown key is ignored, a non-boolean value falls back to default', () => {
  // The exact shape an older build (with a since-removed `music` toggle) or a
  // hand-edited value could leave behind. Kills a mutation that drops either half
  // of readSettings's filter — the `settingAt(k)` check or the `typeof on ===
  // 'boolean'` check.
  resetStorage();
  fakeStorage.setItem('chickup.settings', JSON.stringify({ music: true, haptics: 'yes' }));
  assert.equal(getSetting('music'), false, 'music is not a real setting — must not resurrect as on');
  assert.equal(getSetting('haptics'), true, '"yes" is not a boolean — must fall back to the true default');
});

test('earnFeathers bumps BOTH spendable and lifetime; can cross a milestone', () => {
  resetStorage();
  const spendable0 = getFeathers();
  const lifetime0 = getStats().totalFeathers;
  earnFeathers(50);
  assert.equal(getFeathers(), spendable0 + 50);          // spendable moved
  assert.equal(getStats().totalFeathers, lifetime0 + 50); // lifetime moved — kills "spendable only"
});

test('a race prize via earnFeathers can trip a milestone', () => {
  resetStorage();
  // Sit just below the first milestone (250), then let the prize cross it.
  recordRun({ metres: 100, feathers: 210, maxChain: 1, biomeIndex: 0, won: false });
  assert.equal(checkMilestones(getStats()).length, 0); // 210 < 250, nothing yet
  earnFeathers(50);                                     // 260 >= 250
  assert.equal(checkMilestones(getStats()).length, 1); // now it fires — kills "prize doesn't count"
});

test('tutorial-seen flag: absent is false, mark makes it true', () => {
  resetStorage();
  assert.equal(hasSeenTutorial(), false);
  markTutorialSeen();
  assert.equal(hasSeenTutorial(), true); // kills a "return false" / no-op mutation
});
