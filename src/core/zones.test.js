// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeZones, truckX } from './zones.js';
import { makeField } from './field.js';
import { biomeAt, BIOMES } from './biome.js';
import { ZONES, HAZARD, PHYSICS, PROPS, SCORING, DESIGN } from './tokens.js';

const HI = 1e7; // metres-equivalent-in-pt ceiling wide enough to cover every biome

/** Real usage (game.js) always pairs a zones stream with the field built from
 *  the same seed — the truck stream needs it for the safe-harbour clearance
 *  check. Tests below build a fresh field per makeZones call for isolation. */
function zonesFor(seed) {
  return makeZones(seed, makeField(seed));
}

// --- guard: an updraft that cannot lift is a silent bug --------------------

test('GUARD: updraftLift exceeds gravity, or an updraft cannot lift Peep at all', () => {
  assert.ok(
    ZONES.updraftLift > PHYSICS.gravity,
    `updraftLift (${ZONES.updraftLift}) must exceed PHYSICS.gravity (${PHYSICS.gravity})`,
  );
});

// This guard is deliberately INDEPENDENT of the behavioural SAFE HARBOUR test
// below: that test checks the truck stream respects whatever
// HAZARD.truckPropClearance currently says, which would trivially "pass" if
// the token itself were mutated down to 0 (every distance is >= 0) even
// though the safety property it is supposed to express would be gone. This
// guard instead bounds the TOKEN's own value against an independent
// yardstick -- the orbit radius of the largest attachable prop (a gear's,
// bigger than a tire's; see run.js's radiusOf) -- so a clearance too small to
// even cover a gear's own orbit ring gets caught here.
test('GUARD: truckPropClearance covers at least the largest attachable prop\'s orbit radius', () => {
  const gearRadius = PHYSICS.orbitRadius * PROPS.gearRadiusScale;
  assert.ok(
    HAZARD.truckPropClearance >= gearRadius,
    `truckPropClearance (${HAZARD.truckPropClearance}) must be at least the gear orbit radius ` +
      `(${gearRadius}), or a truck could sit directly on a gear's own orbit ring with zero clearance`,
  );
});

// --- updrafts: determinism, access-order independence, biome restriction ---

test('same seed produces identical updraft streams', () => {
  const a = zonesFor(4242);
  const b = zonesFor(4242);
  assert.deepEqual(a.updraftsInRange(-1, HI), b.updraftsInRange(-1, HI));
});

test('different seeds produce different updraft streams', () => {
  const a = zonesFor(1).updraftsInRange(-1, HI);
  const b = zonesFor(2).updraftsInRange(-1, HI);
  assert.notDeepEqual(a, b);
});

test('updraftsInRange is access-order independent', () => {
  const jumped = zonesFor(88);
  jumped.updraftsInRange(50000, 60000); // force materialisation deep into the stream first
  const jumpedAll = jumped.updraftsInRange(-1, HI);

  const sequential = zonesFor(88);
  const sequentialAll = sequential.updraftsInRange(-1, HI);

  assert.deepEqual(jumpedAll, sequentialAll);
});

test('updrafts only ever appear in ridge or escape biomes', () => {
  for (const seed of [1, 2, 3, 4242, 77]) {
    const z = zonesFor(seed);
    const updrafts = z.updraftsInRange(-1, HI);
    assert.ok(updrafts.length > 0, `seed ${seed}: expected at least one updraft across such a wide range`);
    for (const u of updrafts) {
      const biome = biomeAt(u.y / SCORING.pointsPerMetre);
      assert.ok(
        biome.key === 'ridge' || biome.key === 'escape',
        `updraft at y=${u.y} landed in biome ${biome.key}, not ridge/escape`,
      );
    }
  }
});

test('updrafts never spawn in the four non-ridge/escape biomes', () => {
  // Walk every biome band and assert no updraft's y falls inside a disallowed one.
  const z = zonesFor(9001);
  const updrafts = z.updraftsInRange(-1, HI);
  const disallowed = BIOMES.filter((b) => b.key !== 'ridge' && b.key !== 'escape').map((b) => b.key);
  for (const u of updrafts) {
    const biome = biomeAt(u.y / SCORING.pointsPerMetre);
    assert.ok(!disallowed.includes(biome.key), `updraft leaked into disallowed biome ${biome.key}`);
  }
});

test('updraft rects stay within the design width', () => {
  const z = zonesFor(55);
  for (const u of z.updraftsInRange(-1, HI)) {
    assert.ok(u.x - u.w / 2 >= -1e-6, `updraft x=${u.x} spills off the left edge`);
    assert.ok(u.x + u.w / 2 <= DESIGN.width + 1e-6, `updraft x=${u.x} spills off the right edge`);
    assert.equal(u.w, ZONES.updraftW);
    assert.equal(u.h, ZONES.updraftH);
  }
});

// --- trucks: determinism, access-order independence, biome restriction -----

test('same seed produces identical truck streams', () => {
  const a = zonesFor(4242);
  const b = zonesFor(4242);
  assert.deepEqual(a.trucksInRange(-1, HI), b.trucksInRange(-1, HI));
});

test('trucksInRange is access-order independent', () => {
  const jumped = zonesFor(88);
  jumped.trucksInRange(50000, 60000);
  const jumpedAll = jumped.trucksInRange(-1, HI);

  const sequential = zonesFor(88);
  const sequentialAll = sequential.trucksInRange(-1, HI);

  assert.deepEqual(jumpedAll, sequentialAll);
});

test('trucks NEVER spawn in a non-truck biome, checked across all six biomes', () => {
  for (const seed of [1, 2, 3, 4242, 77, 999]) {
    const z = zonesFor(seed);
    const trucks = z.trucksInRange(-1, HI);
    assert.ok(trucks.length > 0, `seed ${seed}: expected at least one truck across such a wide range`);
    for (const t of trucks) {
      const biome = biomeAt(t.y / SCORING.pointsPerMetre);
      assert.ok(biome.trucks, `truck at y=${t.y} landed in biome ${biome.key}, which has trucks:false`);
    }
  }
  // Cross-check every biome's own flag against the table directly.
  const truckBiomes = BIOMES.filter((b) => b.trucks).map((b) => b.key);
  assert.deepEqual(truckBiomes, ['highway', 'escape']);
});

// --- SAFE HARBOUR: trucks must never threaten the perch Peep is forced to
// orbit on (the fairness defect this task fixes) -------------------------

test('SAFE HARBOUR: no truck ever comes within HAZARD.truckPropClearance of an attachable prop, tires and gears alike', () => {
  // Bounded (not the 1e7 "wide enough" ceiling used above): every truck-prop
  // distance check below is O(trucks * props) in this range, and this range
  // already covers ~200 truck candidates and ~1000 spine props per seed --
  // comfortably past the point where the fix's behaviour has stabilised.
  const MAXY = 120000;
  for (const seed of [1, 2, 3, 4242, 77, 999]) {
    const field = makeField(seed);
    const z = makeZones(seed, field);
    const trucks = z.trucksInRange(-1, MAXY);
    assert.ok(trucks.length > 0, `seed ${seed}: expected at least one surviving truck in [0, ${MAXY}]`);

    // Independent oracle: plain distance math against field.propAt directly,
    // never against zones.js's own findSafeTruckY -- a test that re-asked the
    // implementation "was this safe?" would prove nothing (see truckX's own
    // oracle test above for the same pattern in this file).
    const props = [];
    for (let i = 0; ; i++) {
      const prop = field.propAt(i);
      if (prop.y > MAXY + HAZARD.truckPropClearance) break;
      props.push(prop);
    }
    assert.ok(props.length > 0, `seed ${seed}: expected attachable props in range to check against`);
    assert.ok(
      props.some((p) => p.kind === 'gear'),
      `seed ${seed}: expected at least one gear prop in range -- gears have the larger orbit radius ` +
        `(radiusOf('gear') > radiusOf('tire')), and this invariant must hold for them too, not just tires`,
    );

    let checkedPairs = 0;
    for (const truck of trucks) {
      for (const prop of props) {
        const d = Math.abs(truck.y - prop.y);
        checkedPairs++;
        assert.ok(
          d >= HAZARD.truckPropClearance,
          `seed ${seed}: truck at y=${truck.y} is only ${d.toFixed(2)}pt from a ${prop.kind} at ` +
            `y=${prop.y} -- HAZARD.truckPropClearance requires >= ${HAZARD.truckPropClearance}pt. ` +
            `Peep cannot stop orbiting, so this prop's wheel would be a death trap he cannot wait out.`,
        );
      }
    }
    assert.ok(checkedPairs > 0, `seed ${seed}: no truck-prop pairs were actually exercised by this test`);
  }
});

// --- the spine and pad streams must stay byte-identical once zones exist ---

test('adding zones does not disturb the spine or pad streams', () => {
  const seed = 321;
  const withoutZones = makeField(seed);
  const spineOnly = [];
  const padsOnly = [];
  for (let i = 0; i < 150; i++) {
    spineOnly.push(withoutZones.propAt(i));
    padsOnly.push(withoutZones.padAt(i));
  }

  // Now touch the zone streams for the very same seed and re-derive the field.
  const z = zonesFor(seed);
  z.updraftsInRange(-1, HI);
  z.trucksInRange(-1, HI);
  const withZonesTouched = makeField(seed);
  for (let i = 0; i < 150; i++) {
    assert.deepEqual(withZonesTouched.propAt(i), spineOnly[i], `spine prop ${i} diverged after zones were read`);
    assert.deepEqual(withZonesTouched.padAt(i), padsOnly[i], `pad ${i} diverged after zones were read`);
  }
});

// --- truckX: pure function of (truck, t), never integrated state -----------

test('truckX is pure: direct evaluation equals walking t forward in steps', () => {
  const truck = { y: 12345, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, phase: 17.3 };
  const direct = truckX(truck, 5);

  let walked = 0;
  const dt = 1 / 60;
  let x = truckX(truck, 0);
  while (walked < 5 - 1e-9) {
    x = truckX(truck, walked + dt);
    walked += dt;
  }
  // truckX at the final walked time must equal a direct call at that same t —
  // proving the function is a pure closed form, not integrated state.
  assert.ok(Math.abs(x - truckX(truck, walked)) < 1e-6);
  assert.ok(Math.abs(walked - 5) < 1e-6);
  assert.ok(Math.abs(direct - truckX(truck, 5)) < 1e-9);
});

test('truckX out-of-order calls never drift: repeated evaluation at the same t is stable', () => {
  const truck = { y: 500, dir: /** @type {-1} */ (-1), speed: HAZARD.truckSpeed, phase: 200 };
  const a = truckX(truck, 3.7);
  const b = truckX(truck, 0.1);
  const c = truckX(truck, 3.7);
  assert.equal(a, c, 'evaluating an earlier t in between must not perturb a later t');
  assert.notEqual(a, b);
});

test('truckX wraps around instead of running off to infinity', () => {
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, phase: 0 };
  const xs = [];
  for (let t = 0; t < 30; t += 0.25) xs.push(truckX(truck, t));
  for (const x of xs) {
    assert.ok(x >= -HAZARD.truckW / 2 - 1e-6 && x <= DESIGN.width + HAZARD.truckW / 2 + 1e-6, `x=${x} escaped the wrap span`);
  }
  // Over a long enough run at a fixed speed the truck must actually wrap (not just sit at an edge).
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  assert.ok(max - min > DESIGN.width * 0.5, 'truck never traversed a meaningful span — wrap may be broken');
});

test('truckX direction: dir=1 moves +x before any wrap, dir=-1 moves -x', () => {
  const t1 = { y: 0, dir: /** @type {1} */ (1), speed: 50, phase: 0 };
  const tm1 = { y: 0, dir: /** @type {-1} */ (-1), speed: 50, phase: 0 };
  assert.ok(truckX(t1, 0.1) > truckX(t1, 0), 'dir 1 should move rightward');
  assert.ok(truckX(tm1, 0.1) < truckX(tm1, 0), 'dir -1 should move leftward');
});

// --- truckX: checked against an INDEPENDENT oracle, not against itself -----
//
// The tests above compare truckX(...) to other calls of truckX(...) — direct vs.
// stepped, repeated calls at the same t, before/after a small dt. None of them
// ever compute an expected x by any means OTHER than calling truckX, so a pure
// but WRONG implementation (e.g. scaling t by a tiny, wrong factor) passes all
// of them: the self-comparisons stay internally consistent even while every
// value is off. That is enough to silently desync a ghost replay against the
// live truck it's supposed to reproduce. This test computes the expected x by
// hand from truck.phase/dir/speed and the wrap span (DESIGN.width + HAZARD.truckW),
// without ever calling truckX for the expected value.
test('truckX matches an independently computed expectation (oracle), including the wrap', () => {
  const span = DESIGN.width + HAZARD.truckW;
  const half = HAZARD.truckW / 2;

  /**
   * Hand-written closed form, deliberately re-derived rather than delegated to
   * truckX: centre = phase + dir*speed*t, wrapped into [-half, span - half).
   * @param {{dir:1|-1, speed:number, phase:number}} truck
   * @param {number} t
   */
  function oracleX(truck, t) {
    const raw = truck.phase + truck.dir * truck.speed * t + half;
    const wrapped = ((raw % span) + span) % span;
    return wrapped - half;
  }

  const trucks = [
    { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, phase: 0 },
    { y: 0, dir: /** @type {-1} */ (-1), speed: HAZARD.truckSpeed, phase: 200 },
    { y: 500, dir: /** @type {1} */ (1), speed: 37, phase: 411.7 },
    { y: 500, dir: /** @type {-1} */ (-1), speed: 123.4, phase: 88.8 },
  ];
  for (const truck of trucks) {
    for (let t = 0; t < 40; t += 0.37) {
      const expected = oracleX(truck, t);
      const actual = truckX(truck, t);
      assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `truck=${JSON.stringify(truck)} t=${t}: expected ${expected}, got ${actual}`,
      );
    }
  }

  // Explicitly cover the wrap: pick a t guaranteed to wrap the span several
  // times over, so a broken modulo (or a broken accumulation feeding it)
  // can't hide by staying inside one lap.
  const wrapTruck = { y: 0, dir: /** @type {1} */ (1), speed: 100, phase: 0 };
  const bigT = (span * 3.5) / wrapTruck.speed;
  assert.ok(Math.abs(truckX(wrapTruck, bigT) - oracleX(wrapTruck, bigT)) < 1e-6, 'wrap case diverged from the oracle');
});
