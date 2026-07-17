// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeField } from './field.js';
import { FIELD, SCORING } from './tokens.js';
import { BIOMES, biomeAt, biomeAtY } from './biome.js';
import { makeRng } from './rng.js';
import { createRun } from './run.js';

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

test('prop 0 is always a tire', () => {
  for (const seed of [1, 2, 3, 4242, 77]) {
    assert.equal(makeField(seed).propAt(0).kind, 'tire');
  }
});

test('propsInRange is access-order independent', () => {
  const jumped = makeField(88);
  jumped.propAt(40);
  const jumpedProps = [];
  for (let i = 0; i <= 40; i++) jumpedProps.push(jumped.propAt(i));

  const sequential = makeField(88);
  const sequentialProps = [];
  for (let i = 0; i <= 40; i++) sequentialProps.push(sequential.propAt(i));

  assert.deepEqual(jumpedProps, sequentialProps);
});

test('every prop kind is one the biome at that height allows', () => {
  const f = makeField(123);
  for (let i = 0; i < 300; i++) {
    const prop = f.propAt(i);
    const biome = biomeAt(prop.y / SCORING.pointsPerMetre);
    assert.ok(
      biome.kinds.some(([k]) => k === prop.kind),
      `prop ${i} kind ${prop.kind} not allowed in biome ${biome.key} at y=${prop.y}`,
    );
  }
});

// --- pickKind: a REAL distribution check, not by-construction membership ---
//
// The membership test above ("every prop kind is one the biome allows") passes
// for ANY implementation that only ever returns members of biome.kinds — including
// a mutant that always returns the first kind (gears would never spawn anywhere in
// the game). It has zero power to catch a broken weighted draw. This test uses an
// INDEPENDENT oracle (the weights declared in BIOMES itself) and a large,
// multi-seed sample so the result is a real statistical check, not a coin flip.
test('pickKind draws each kind at roughly its declared weight (independent oracle)', () => {
  /**
   * Tally kind counts for every spine prop whose height falls in [fromM, toM),
   * across many seeds, so no single unlucky run can make the test flaky —
   * this is a seeded PRNG, so every seed's outcome is itself fully deterministic.
   * @param {number} fromM
   * @param {number} toM
   * @param {number} seedCount
   */
  function tally(fromM, toM, seedCount) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (let seed = 1; seed <= seedCount; seed++) {
      const f = makeField(seed);
      for (let i = 0; ; i++) {
        const prop = f.propAt(i);
        const metres = prop.y / SCORING.pointsPerMetre;
        if (metres >= toM) break;
        if (metres >= fromM) counts[prop.kind] = (counts[prop.kind] || 0) + 1;
      }
    }
    return counts;
  }

  /**
   * @param {string} key
   */
  function checkBiome(key) {
    const idx = BIOMES.findIndex((b) => b.key === key);
    const biome = BIOMES[idx];
    const toM = idx + 1 < BIOMES.length ? BIOMES[idx + 1].fromM : biome.fromM + 500;
    const totalWeight = biome.kinds.reduce((sum, [, w]) => sum + w, 0);

    const counts = tally(biome.fromM, toM, 300);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.ok(total > 500, `${key}: expected a large sample, got ${total}`);

    for (const [kind, weight] of biome.kinds) {
      const expected = weight / totalWeight;
      const observed = (counts[kind] || 0) / total;
      assert.ok(
        Math.abs(observed - expected) < 0.05,
        `${key}: kind ${kind} observed share ${observed.toFixed(3)} strayed from declared ${expected.toFixed(3)}`,
      );
    }
  }

  // factory: tire:2/gear:2 ~= 50/50. highway: tire:3/gear:1 ~= 75/25.
  checkBiome('factory');
  checkBiome('highway');
});

// --- biomeAtY: pins the field generator and the render layer to the SAME
// coordinate space (regression for the "6.2m desync" defect) -----------------
test('biomeAtY (absolute height) agrees with the biome the field itself used to build a prop', () => {
  // field.js keys every prop's biome off ABSOLUTE world height (y / pointsPerMetre)
  // — see propAt's `biomeAtY(y)` call. The render layer used to key the SAME
  // question off the player's score instead (scoreOf: climbed distance from
  // state.startY, the orbit top of prop 0 — a DIFFERENT zero point), which
  // silently disagreed with the field near every biome boundary.
  const field = makeField(4242);
  const state = createRun(field, 852); // viewport height is irrelevant here

  // Walk the field to the absolute height where it first crosses into orchard —
  // the same computation field.js itself performs (biomeAtY, done by hand here
  // as the oracle).
  let crossingY = null;
  for (let i = 0; i < 400; i++) {
    const prop = field.propAt(i);
    if (biomeAtY(prop.y).key === 'orchard') {
      crossingY = prop.y;
      break;
    }
  }
  assert.ok(crossingY !== null, 'expected the field to reach orchard within 400 props');

  // The fix: asking with the player's absolute world height (state.maxY, were
  // Peep to be sitting at this exact prop) agrees with what the field used.
  assert.equal(biomeAtY(crossingY).key, 'orchard');

  // Sanity check that this really reproduces the reported bug: the OLD,
  // buggy computation (biome from START-RELATIVE score) still calls this
  // exact height "roadside", because state.startY offsets the two coordinate
  // spaces by startY/pointsPerMetre metres (6.2m at current tuning — the
  // report's own number).
  const buggyScore = Math.floor((crossingY - state.startY) / SCORING.pointsPerMetre);
  assert.equal(biomeAt(buggyScore).key, 'roadside', 'sanity: reproduces the reported start-relative desync');
});

test('same seed twice gives identical kind sequences', () => {
  const a = makeField(555);
  const b = makeField(555);
  for (let i = 0; i < 200; i++) {
    assert.equal(a.propAt(i).kind, b.propAt(i).kind, `kind diverged at prop ${i}`);
  }
});

test('the x-jitter draw sequence is exactly the (2N)-th raw draw of makeRng(seed)', () => {
  // Draw order is always x-jitter then kind, one of each per index, always.
  // Prop N's x must therefore be exactly the (2N)-th raw draw. This is
  // load-bearing: the pad stream (its own, separately-seeded RNG) must never
  // be able to disturb this sequence.
  const seed = 4242;
  const rng = makeRng(seed);
  const f = makeField(seed);
  for (let i = 0; i < 200; i++) {
    const col = FIELD.columns[i % FIELD.columns.length];
    const dx = rng(); // x-jitter draw
    rng(); // kind draw, consumed but not reimplemented here
    const expectedX = col + (dx * 2 - 1) * FIELD.jitter;
    assert.equal(f.propAt(i).x, expectedX, `prop ${i} x diverged from raw draw sequence`);
  }
});

test('consecutive spine props are never more than FIELD.gapMax apart', () => {
  // This is the invariant that makes the game winnable: every attachable prop's
  // distance to the next attachable prop must stay under the max rise (247pt at
  // current tuning), and gapMax (200pt) is the guardrail for that. If pads (or
  // anything else) ever get added back onto the spine, or gapMax is loosened,
  // this must fail loudly rather than let an unreachable gap slip in silently.
  for (const seed of [1, 2, 3, 4242, 77, 555, 123, 7]) {
    const f = makeField(seed);
    for (let i = 1; i < 500; i++) {
      const gap = f.propAt(i).y - f.propAt(i - 1).y;
      assert.ok(
        gap <= FIELD.gapMax + 1e-9,
        `seed ${seed}: gap between spine props ${i - 1} and ${i} was ${gap}, exceeding gapMax ${FIELD.gapMax}`,
      );
    }
  }
});

// --- pads (their own stream, off the spine) --------------------------------

test('pads only ever appear where their gap biome allows a nonzero padChance', () => {
  for (const seed of [1, 2, 3, 4242, 77]) {
    const f = makeField(seed);
    const pads = f.padsInRange(-1, 1e7);
    assert.ok(pads.length > 0, `seed ${seed}: expected at least one pad across such a wide range`);
    for (const { index, pad } of pads) {
      const gapStartProp = f.propAt(index);
      const biome = biomeAt(gapStartProp.y / SCORING.pointsPerMetre);
      assert.ok(biome.padChance > 0, `pad ${index} appeared in biome ${biome.key}, which has padChance 0`);
      assert.ok(pad.y > gapStartProp.y, `pad ${index} y must sit above its gap's starting prop`);
    }
  }
});

test('same seed twice gives identical pad streams', () => {
  const a = makeField(999);
  const b = makeField(999);
  for (let i = 0; i < 200; i++) {
    assert.deepEqual(a.padAt(i), b.padAt(i), `pad ${i} diverged`);
  }
});

test('padsInRange is access-order independent, exactly like propsInRange', () => {
  const jumped = makeField(88);
  jumped.padAt(40);
  const jumpedPads = [];
  for (let i = 0; i <= 40; i++) jumpedPads.push(jumped.padAt(i));

  const sequential = makeField(88);
  const sequentialPads = [];
  for (let i = 0; i <= 40; i++) sequentialPads.push(sequential.padAt(i));

  assert.deepEqual(jumpedPads, sequentialPads);
});

test('the pad stream does not disturb the spine draw sequence', () => {
  // Reading pads first (which forces the spine to materialise ahead, since
  // padAt(i) reads propAt(i) and propAt(i+1)) must not change a single spine
  // x value versus reading the spine cold. Same load-bearing check as above,
  // just via the pad stream's back door into the spine.
  const seed = 321;
  const withPadReads = makeField(seed);
  for (let i = 0; i < 100; i++) withPadReads.padAt(i);

  const spineOnly = makeField(seed);

  for (let i = 0; i < 100; i++) {
    assert.deepEqual(withPadReads.propAt(i), spineOnly.propAt(i), `spine prop ${i} diverged after pad reads`);
  }
});
