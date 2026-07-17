// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, evaluate, earnedCount } from './achievements.js';
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
