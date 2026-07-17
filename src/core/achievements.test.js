// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, evaluate, earnedCount, pendingUnlocks } from './achievements.js';
import { BIOMES } from './biome.js';

test('ACHIEVEMENTS is a frozen array of 6-10 entries with unique keys', () => {
  assert.ok(Object.isFrozen(ACHIEVEMENTS));
  assert.ok(ACHIEVEMENTS.length >= 6 && ACHIEVEMENTS.length <= 10, `expected 6-10, got ${ACHIEVEMENTS.length}`);
  const keys = ACHIEVEMENTS.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length, 'achievement keys must be unique');
  for (const a of ACHIEVEMENTS) {
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.hint, 'string');
    assert.equal(typeof a.done, 'function');
  }
});

test('evaluate is total: a zeroed fresh Stats does not throw and nothing is done', () => {
  const fresh = { bestMetres: 0, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0 };
  const results = evaluate(fresh);
  assert.equal(results.length, ACHIEVEMENTS.length);
  for (const r of results) {
    assert.equal(r.done, false, `${r.key} must not be earned from a zeroed run`);
  }
});

test('evaluate is total: an empty object with missing fields does not throw', () => {
  assert.doesNotThrow(() => evaluate({}));
  const results = evaluate({});
  for (const r of results) assert.equal(r.done, false);
});

test('evaluate is total: null, undefined, and garbage-typed fields do not throw', () => {
  // @ts-expect-error deliberately passing a bad shape, as hand-edited localStorage JSON might
  assert.doesNotThrow(() => evaluate(null));
  // @ts-expect-error
  assert.doesNotThrow(() => evaluate(undefined));
  assert.doesNotThrow(() =>
    evaluate({ bestMetres: 'lots', totalFeathers: NaN, runs: null, maxChain: undefined, biomesReached: -Infinity }),
  );
});

test('a maxed-out lifetime stat block earns every achievement', () => {
  const maxed = {
    bestMetres: 1e6,
    totalFeathers: 1e6,
    runs: 1e6,
    maxChain: 1e6,
    biomesReached: BIOMES.length,
  };
  const results = evaluate(maxed);
  for (const r of results) {
    assert.equal(r.done, true, `${r.key} should be earned by a maxed-out player`);
  }
  assert.equal(earnedCount(maxed), ACHIEVEMENTS.length);
});

test('earnedCount matches the number of done:true entries evaluate returns', () => {
  const partial = { bestMetres: 60, totalFeathers: 0, runs: 1, maxChain: 0, biomesReached: 0 };
  const results = evaluate(partial);
  const expected = results.filter((r) => r.done).length;
  assert.equal(earnedCount(partial), expected);
  assert.ok(expected >= 1, 'the distance stat given should earn at least one achievement, or the test is not exercising anything');
});

test('a biome-count achievement threshold never exceeds the number of biomes that exist', () => {
  // Reaching every biome must be achievable; reaching one more than exist must be impossible to require.
  const oneShort = { bestMetres: 0, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: BIOMES.length - 1 };
  const all = { bestMetres: 0, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: BIOMES.length };
  const resultsShort = evaluate(oneShort);
  const resultsAll = evaluate(all);
  const anyNewlyDone = resultsAll.some((r, i) => r.done && !resultsShort[i].done);
  assert.ok(anyNewlyDone, 'reaching the final biome must unlock something that reaching all-but-one does not');
});

test('pendingUnlocks reports earned achievements that have not been announced', () => {
  const stats = { bestMetres: 60, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0 };
  const keys = pendingUnlocks(stats, []).map((a) => a.key);
  assert.deepEqual(keys, ['first-flight'], '50m earns exactly First Flight');
  assert.equal(pendingUnlocks(stats, ['first-flight']).length, 0, 'announcing is idempotent');
});

test('pendingUnlocks never reports an unearned achievement', () => {
  const fresh = { bestMetres: 0, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0 };
  assert.deepEqual(pendingUnlocks(fresh, []), []);
});

test('pendingUnlocks returns ACHIEVEMENTS order, not the order of `seen`', () => {
  // The toast queue shows these in the order returned. That order must come from the
  // table, not from however the caller's storage happened to serialise its keys.
  const all = { bestMetres: 9999, totalFeathers: 9999, runs: 9999, maxChain: 9999, biomesReached: BIOMES.length };
  const table = ACHIEVEMENTS.map((a) => a.key);
  assert.deepEqual(pendingUnlocks(all, []).map((a) => a.key), table);
  // Same query, but `seen` mentions a later key first — must not perturb the result.
  assert.deepEqual(
    pendingUnlocks(all, ['dedicated', 'first-flight']).map((a) => a.key),
    table.filter((k) => k !== 'dedicated' && k !== 'first-flight'),
  );
});

test('pendingUnlocks is total against junk from localStorage', () => {
  // `seen` is untrusted: old builds, hand-edited JSON, a corrupted value.
  const stats = { bestMetres: 60, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0 };
  for (const junk of [null, undefined, 'first-flight', 42, {}, [1, 2], [null]]) {
    assert.deepEqual(
      pendingUnlocks(stats, junk).map((a) => a.key),
      ['first-flight'],
      `junk seen (${JSON.stringify(junk)}) must read as "nothing announced"`,
    );
  }
  assert.deepEqual(pendingUnlocks(null, null), [], 'junk stats too');
});

test('pendingUnlocks carries the name and hint the toast needs', () => {
  const [a] = pendingUnlocks({ bestMetres: 60, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0 }, []);
  assert.equal(a.name, 'First Flight');
  assert.equal(typeof a.hint, 'string');
});
