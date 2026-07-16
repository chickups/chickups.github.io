// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from './rng.js';

test('same seed produces an identical sequence', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b(), `diverged at draw ${i}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('all draws lie in [0, 1)', () => {
  const r = makeRng(99);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('draws are reasonably uniform across 10 buckets', () => {
  const r = makeRng(7);
  const buckets = new Array(10).fill(0);
  const n = 100000;
  for (let i = 0; i < n; i++) buckets[Math.floor(r() * 10)]++;
  for (const b of buckets) {
    assert.ok(Math.abs(b - n / 10) < n / 100, `bucket skew: ${b}`);
  }
});

test('golden vector — the contract the Swift port must reproduce', () => {
  // Generated from this implementation. If this test ever fails, the PRNG
  // changed and every stored best-score field seed now means something else.
  const GOLDEN = [0.9797282677609473,0.3067522644996643,0.484205421525985,0.817934412509203,0.5094283693470061,0.34747186047025025,0.07375754183158278,0.7663964673411101];
  const r = makeRng(12345);
  const got = Array.from({ length: GOLDEN.length }, () => r());
  assert.deepEqual(got, GOLDEN);
});
