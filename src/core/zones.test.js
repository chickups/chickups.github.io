// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeZones, truckX, truckTelling, TRUCK_CYCLE_S, TRUCK_BEATS_PER_CYCLE } from './zones.js';
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

// --- trucks: a shared beat with a tell ------------------------------------

const SPAN = DESIGN.width + HAZARD.truckW;
const CROSS_S = SPAN / HAZARD.truckSpeed;

test('every truck derives its crossing from ONE shared beat grid', () => {
  // Spec C4 / doc §13: "trucks cross lanes on a fixed beat (every 1.8s)". Slice 2
  // gave each truck an independent random phase — the exact opposite. A truck's
  // only per-truck freedom now is WHICH beat slot it enters on.
  const trucks = zonesFor(7).trucksInRange(0, HI).slice(0, 40);
  assert.ok(trucks.length >= 10, `expected plenty of trucks, got ${trucks.length}`);
  for (const t of trucks) {
    assert.ok(Number.isInteger(t.beat), `beat must be an integer slot, got ${t.beat}`);
    assert.ok(t.beat >= 0 && t.beat < TRUCK_BEATS_PER_CYCLE, `beat out of range: ${t.beat}`);
    assert.equal(t.phase, undefined, 'the per-truck random phase is gone');
  }
});

test('a truck ENTERS the field exactly on a multiple of truckBeatS', () => {
  const half = HAZARD.truckW / 2;
  for (const dir of /** @type {(1|-1)[]} */ ([1, -1])) {
    for (let beat = 0; beat < TRUCK_BEATS_PER_CYCLE; beat++) {
      const truck = { y: 0, dir, speed: HAZARD.truckSpeed, beat };
      const entryT = beat * HAZARD.truckBeatS;
      const x = truckX(truck, entryT);
      const expected = dir === 1 ? -half : SPAN - half;
      assert.ok(
        Math.abs(x - expected) < 1e-9,
        `dir ${dir} beat ${beat}: entry x ${x}, expected ${expected}`,
      );
      // And every later entry is still on the grid: the cycle is a whole number
      // of beats by construction (see TRUCK_CYCLE_S).
      const x2 = truckX(truck, entryT + TRUCK_CYCLE_S);
      assert.ok(Math.abs(x2 - expected) < 1e-9, 'entries must stay on the beat, not drift');
    }
  }
  assert.ok(
    Math.abs(TRUCK_CYCLE_S / HAZARD.truckBeatS - Math.round(TRUCK_CYCLE_S / HAZARD.truckBeatS)) < 1e-9,
    'the cycle MUST be a whole number of beats or every truck drifts off the grid',
  );
});

test('truckX stays a pure closed form of (truck, t) — ghost replay depends on it', () => {
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 2 };
  // Called out of order, repeatedly, with no state carried between calls.
  const a = truckX(truck, 3.3);
  const b = truckX(truck, 11.9);
  assert.equal(truckX(truck, 3.3), a);
  assert.equal(truckX(truck, 11.9), b);
  assert.equal(truckX(truck, 3.3), a);
  // And it is periodic in the cycle, never integrated.
  assert.ok(Math.abs(truckX(truck, 3.3 + TRUCK_CYCLE_S * 5) - a) < 1e-9);
});

test('truckTelling is true for exactly truckTellS before entry, and never while crossing', () => {
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 0 };
  // Entry is at t = 0, TRUCK_CYCLE_S, 2*TRUCK_CYCLE_S ... The tell is the window
  // that CLOSES at each entry.
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - 0.001), true, 'telling just before entry');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - HAZARD.truckTellS + 0.001), true, 'telling at the window start');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - HAZARD.truckTellS - 0.001), false, 'silent before the window opens');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S), false, 'entry itself is not a tell — it is the event');
  assert.equal(truckTelling(truck, 0.5), false, 'never telling mid-crossing');
  assert.equal(truckTelling(truck, CROSS_S + 0.05), false, 'never telling while parked, until the window');
});

test('a beat truck is fully OFF the field for part of every cycle — occupancy DROPS', () => {
  // The safety argument for the beat, and it is monotone: a truck now waits
  // off-field between crossings instead of wrapping continuously, so it is
  // present LESS of the time than before, never more. See the harbour note.
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 0 };
  const half = HAZARD.truckW / 2;
  let onField = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TRUCK_CYCLE_S;
    const x = truckX(truck, t);
    if (x + half > 0 && x - half < DESIGN.width) onField++;
  }
  const duty = onField / N;
  assert.ok(duty < 0.95, `a beat truck must idle off-field; duty cycle was ${duty}`);
  assert.ok(
    Math.abs(duty - CROSS_S / TRUCK_CYCLE_S) < 0.02,
    `duty ${duty} should be ~${CROSS_S / TRUCK_CYCLE_S} (one crossing per cycle)`,
  );
});
