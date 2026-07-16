// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeZones, truckX } from './zones.js';
import { makeField } from './field.js';
import { biomeAt, BIOMES } from './biome.js';
import { ZONES, HAZARD, PHYSICS, SCORING, DESIGN } from './tokens.js';

const HI = 1e7; // metres-equivalent-in-pt ceiling wide enough to cover every biome

// --- guard: an updraft that cannot lift is a silent bug --------------------

test('GUARD: updraftLift exceeds gravity, or an updraft cannot lift Peep at all', () => {
  assert.ok(
    ZONES.updraftLift > PHYSICS.gravity,
    `updraftLift (${ZONES.updraftLift}) must exceed PHYSICS.gravity (${PHYSICS.gravity})`,
  );
});

// --- updrafts: determinism, access-order independence, biome restriction ---

test('same seed produces identical updraft streams', () => {
  const a = makeZones(4242);
  const b = makeZones(4242);
  assert.deepEqual(a.updraftsInRange(-1, HI), b.updraftsInRange(-1, HI));
});

test('different seeds produce different updraft streams', () => {
  const a = makeZones(1).updraftsInRange(-1, HI);
  const b = makeZones(2).updraftsInRange(-1, HI);
  assert.notDeepEqual(a, b);
});

test('updraftsInRange is access-order independent', () => {
  const jumped = makeZones(88);
  jumped.updraftsInRange(50000, 60000); // force materialisation deep into the stream first
  const jumpedAll = jumped.updraftsInRange(-1, HI);

  const sequential = makeZones(88);
  const sequentialAll = sequential.updraftsInRange(-1, HI);

  assert.deepEqual(jumpedAll, sequentialAll);
});

test('updrafts only ever appear in ridge or escape biomes', () => {
  for (const seed of [1, 2, 3, 4242, 77]) {
    const z = makeZones(seed);
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
  const z = makeZones(9001);
  const updrafts = z.updraftsInRange(-1, HI);
  const disallowed = BIOMES.filter((b) => b.key !== 'ridge' && b.key !== 'escape').map((b) => b.key);
  for (const u of updrafts) {
    const biome = biomeAt(u.y / SCORING.pointsPerMetre);
    assert.ok(!disallowed.includes(biome.key), `updraft leaked into disallowed biome ${biome.key}`);
  }
});

test('updraft rects stay within the design width', () => {
  const z = makeZones(55);
  for (const u of z.updraftsInRange(-1, HI)) {
    assert.ok(u.x - u.w / 2 >= -1e-6, `updraft x=${u.x} spills off the left edge`);
    assert.ok(u.x + u.w / 2 <= DESIGN.width + 1e-6, `updraft x=${u.x} spills off the right edge`);
    assert.equal(u.w, ZONES.updraftW);
    assert.equal(u.h, ZONES.updraftH);
  }
});

// --- trucks: determinism, access-order independence, biome restriction -----

test('same seed produces identical truck streams', () => {
  const a = makeZones(4242);
  const b = makeZones(4242);
  assert.deepEqual(a.trucksInRange(-1, HI), b.trucksInRange(-1, HI));
});

test('trucksInRange is access-order independent', () => {
  const jumped = makeZones(88);
  jumped.trucksInRange(50000, 60000);
  const jumpedAll = jumped.trucksInRange(-1, HI);

  const sequential = makeZones(88);
  const sequentialAll = sequential.trucksInRange(-1, HI);

  assert.deepEqual(jumpedAll, sequentialAll);
});

test('trucks NEVER spawn in a non-truck biome, checked across all six biomes', () => {
  for (const seed of [1, 2, 3, 4242, 77, 999]) {
    const z = makeZones(seed);
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
  const z = makeZones(seed);
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
