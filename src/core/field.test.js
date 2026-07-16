// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeField } from './field.js';
import { FIELD } from './tokens.js';

test('wheel 0 sits at the world origin height', () => {
  assert.equal(makeField(1).wheelAt(0).y, 0);
});

test('same seed produces identical wheels', () => {
  const a = makeField(4242);
  const b = makeField(4242);
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(a.wheelAt(i), b.wheelAt(i), `diverged at wheel ${i}`);
  }
});

test('different seeds produce different wheels', () => {
  const a = makeField(1);
  const b = makeField(2);
  const xa = Array.from({ length: 30 }, (_, i) => a.wheelAt(i).x);
  const xb = Array.from({ length: 30 }, (_, i) => b.wheelAt(i).x);
  assert.notDeepEqual(xa, xb);
});

test('access order does not change the field', () => {
  const sequential = makeField(77);
  for (let i = 0; i <= 50; i++) sequential.wheelAt(i);
  const jumped = makeField(77);
  assert.deepEqual(jumped.wheelAt(50), sequential.wheelAt(50));
});

test('wheels climb — y strictly increases', () => {
  const f = makeField(5);
  for (let i = 1; i < 80; i++) {
    assert.ok(f.wheelAt(i).y > f.wheelAt(i - 1).y, `wheel ${i} did not climb`);
  }
});

test('gaps never shrink — difficulty ramps only upward', () => {
  const f = makeField(5);
  let prevGap = -Infinity;
  for (let i = 1; i < 200; i++) {
    const gap = f.wheelAt(i).y - f.wheelAt(i - 1).y;
    assert.ok(gap >= prevGap - 1e-9, `gap shrank at wheel ${i}: ${gap} < ${prevGap}`);
    prevGap = gap;
  }
});

test('first gap is gapStart and gaps are capped at gapMax', () => {
  const f = makeField(5);
  const first = f.wheelAt(1).y - f.wheelAt(0).y;
  assert.equal(first, FIELD.gapStart);
  for (let i = 1; i < 500; i++) {
    const gap = f.wheelAt(i).y - f.wheelAt(i - 1).y;
    assert.ok(gap <= FIELD.gapMax + 1e-9, `gap exceeded cap at wheel ${i}: ${gap}`);
  }
  // Far enough up, the cap must actually be reached.
  const late = f.wheelAt(499).y - f.wheelAt(498).y;
  assert.equal(late, FIELD.gapMax);
});

test('x alternates between columns with jitter inside bounds', () => {
  const f = makeField(9);
  for (let i = 0; i < 60; i++) {
    const col = FIELD.columns[i % FIELD.columns.length];
    const x = f.wheelAt(i).x;
    assert.ok(Math.abs(x - col) <= FIELD.jitter, `wheel ${i} x=${x} strayed from column ${col}`);
  }
});

test('wheelsInRange returns only wheels inside the band, with field indices', () => {
  const f = makeField(3);
  const lo = f.wheelAt(4).y;
  const hi = f.wheelAt(7).y;
  const got = f.wheelsInRange(lo, hi);
  assert.deepEqual(got.map((e) => e.index), [4, 5, 6, 7]);
  for (const { wheel } of got) {
    assert.ok(wheel.y >= lo && wheel.y <= hi);
  }
});

test('wheelsInRange is empty when the band sits below the field', () => {
  const f = makeField(3);
  assert.deepEqual(f.wheelsInRange(-5000, -1000), []);
});
