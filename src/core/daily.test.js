// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, dailySeed } from './daily.js';
import { makeRng } from './rng.js';

const MS_DAY = 86400000;

test('the same day gives the same seed, always', () => {
  const a = dayNumber(Date.UTC(2026, 6, 17, 9, 30), 0);
  const b = dayNumber(Date.UTC(2026, 6, 17, 21, 15), 0);
  assert.equal(a, b, 'same calendar day');
  assert.equal(dailySeed(a), dailySeed(b));
});

test('the day rolls over at LOCAL midnight, not UTC midnight', () => {
  // UTC+3 (getTimezoneOffset reports -180). 22:00 UTC is already 01:00 next day local.
  const tz = -180;
  const beforeLocalMidnight = dayNumber(Date.UTC(2026, 6, 17, 20, 0), tz); // 23:00 local
  const afterLocalMidnight = dayNumber(Date.UTC(2026, 6, 17, 22, 0), tz); // 01:00 local, next day
  assert.equal(afterLocalMidnight, beforeLocalMidnight + 1, 'must tick at local midnight');

  // And the same instant in UTC is still the 17th.
  assert.equal(dayNumber(Date.UTC(2026, 6, 17, 22, 0), 0), dayNumber(Date.UTC(2026, 6, 17, 20, 0), 0));
});

/** Mean |a-b| of the first draw across N consecutive day pairs. */
function meanAdjacentGap(seedOf, n) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.abs(makeRng(seedOf(i))() - makeRng(seedOf(i + 1))());
  }
  return total / n;
}

test('adjacent days give uncorrelated routes', () => {
  // For two INDEPENDENT uniforms, E|a-b| = 1/3. Testing per-pair distance instead
  // would be wrong: genuinely random draws land close together ~2% of the time, so
  // a "never within 0.01" assertion fails on coincidence rather than on a defect.
  const gap = meanAdjacentGap((i) => dailySeed(i), 2000);
  assert.ok(gap > 0.3 && gap < 0.37, `day seeds look correlated (mean gap ${gap}, want ~0.333)`);
});

test('a day seed is a uint32 and is stable across calls', () => {
  for (const d of [0, 1, -1, 20000, 999999]) {
    const s = dailySeed(d);
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff, `bad seed ${s} for day ${d}`);
    assert.equal(s, dailySeed(d), 'dailySeed must be pure');
  }
});

test('seeds spread out rather than colliding', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(dailySeed(i));
  assert.equal(seen.size, 2000, 'day seeds must not collide over five years');
});

test('dayNumber advances by exactly one per day', () => {
  const base = Date.UTC(2026, 6, 17, 12, 0);
  for (let i = 0; i < 10; i++) {
    assert.equal(dayNumber(base + i * MS_DAY, 0), dayNumber(base, 0) + i);
  }
});
