// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, scoreOf, radiusOf, rateOf, endScreenOf } from './run.js';
import { makeField } from './field.js';
import { PHYSICS, SCORING, PROPS, ZONES, HAZARD, FIELD, ESCAPE } from './tokens.js';
import { baseTuning, applyModifier, MODIFIERS } from './modifier.js';
import { BIOMES } from './biome.js';

const VH = 852;
const DT = 1 / 60;

/** Drive the sim for n frames with a constant input. */
function run(state, field, n, pressed) {
  let s = state;
  for (let i = 0; i < n; i++) s = step(s, field, DT, pressed, VH);
  return s;
}

test('a new run starts attached to wheel 0, unpressed, chain 0, mult 1', () => {
  const f = makeField(1);
  const s = createRun(f, VH);
  assert.equal(s.phase, 'orbit');
  assert.equal(s.wheelIndex, 0);
  assert.equal(s.chain, 0);
  assert.equal(s.mult, 1);
  assert.equal(s.feathers, 0);
  assert.equal(s.wasPressed, false);
  assert.equal(scoreOf(s), 0);
});

test('the tire spins with no input at all', () => {
  const f = makeField(1);
  const start = createRun(f, VH);
  const idle = step(start, f, DT, false, VH);
  assert.ok(idle.angle > start.angle, 'orbit must advance unprompted');
  assert.equal(idle.phase, 'orbit');
});

test('a tap launches into flight', () => {
  const f = makeField(1);
  const start = run(createRun(f, VH), f, 10, false);
  const s = step(start, f, DT, true, VH);
  assert.equal(s.phase, 'fly');
  assert.ok(Math.hypot(s.vx, s.vy) > 0);
});

test('holding the button launches once, not every frame', () => {
  const f = makeField(1);
  let s = step(createRun(f, VH), f, DT, true, VH);
  assert.equal(s.phase, 'fly');
  const vx = s.vx;
  const vy = s.vy;
  // Still pressed: no new tap edge, so no second launch impulse.
  s = step(s, f, DT, true, VH);
  assert.ok(s.vy < vy, 'gravity must be the only thing changing velocity');
  assert.equal(s.vx, vx);
});

test('a landing grabs automatically, with no input', () => {
  const f = makeField(1);
  const w1 = f.wheelAt(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: w1.x + PHYSICS.orbitRadius, y: w1.y, vx: 0, vy: 0, lockWheel: -1, wasPressed: false };
  s = step(s, f, DT, false, VH);
  assert.equal(s.phase, 'orbit', 'must glue on contact without being asked');
  assert.equal(s.wheelIndex, 1);
  assert.equal(s.chain, 1);
  assert.equal(s.mult, 1);
  assert.equal(s.feathers, 1);
});

test('landing while still holding does not immediately re-launch', () => {
  const f = makeField(1);
  const w1 = f.wheelAt(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: w1.x + PHYSICS.orbitRadius, y: w1.y, vx: 0, vy: 0, lockWheel: -1, wasPressed: true };
  s = step(s, f, DT, true, VH);
  assert.equal(s.phase, 'orbit');
  s = step(s, f, DT, true, VH);
  assert.equal(s.phase, 'orbit', 'a held button is not a fresh tap');
});

test('multiplier steps every chainPerMult grabs and caps at multMax', () => {
  const f = makeField(1);
  // The spine is attachable-only (tire/gear); gather 20 consecutive props to
  // exercise 20 consecutive grabs. The test is about chain/mult bookkeeping,
  // not any particular field layout.
  const attachable = [];
  for (let i = 1; attachable.length < 20; i++) {
    attachable.push(f.propAt(i));
  }
  let s = createRun(f, VH);
  let feathers = 0;
  let expectedMult = 1;
  for (let grab = 1; grab <= 20; grab++) {
    const w = attachable[grab - 1];
    s = { ...s, phase: 'fly', x: w.x + radiusOf(w.kind), y: w.y, vx: 0, vy: 0, lockWheel: -1, wasPressed: false };
    s = step(s, f, DT, false, VH);
    if (grab % SCORING.chainPerMult === 0) expectedMult = Math.min(SCORING.multMax, expectedMult + 1);
    feathers += expectedMult;
    assert.equal(s.chain, grab, `chain wrong after grab ${grab}`);
    assert.equal(s.mult, expectedMult, `mult wrong after grab ${grab}`);
    assert.equal(s.feathers, feathers, `feathers wrong after grab ${grab}`);
  }
  assert.equal(s.mult, SCORING.multMax);
});

test('the wheel just launched from cannot be instantly re-grabbed', () => {
  const f = makeField(1);
  let s = step(createRun(f, VH), f, DT, true, VH); // tap -> launch
  assert.equal(s.phase, 'fly');
  assert.equal(s.lockWheel, 0);
  // Peep is still sitting inside wheel 0's band; auto-glue must not take it back.
  s = step(s, f, DT, false, VH);
  assert.equal(s.phase, 'fly', 'must not re-grab the wheel it just left');
  assert.equal(s.chain, 0);
});

test('chain breaks when Peep falls below the wheel he last left', () => {
  const f = makeField(1);
  const w2 = f.wheelAt(2);
  let s = createRun(f, VH);
  // x:0 keeps Peep clear of every wheel column, so nothing can grab him.
  s = { ...s, chain: 5, mult: 3, phase: 'fly', lastWheelY: w2.y, x: 0, y: w2.y + 10, vx: 0, vy: -10, lockWheel: -1 };
  // Fall until he is genuinely below the wheel he left. A single frame moves him
  // well under a point at any sane gravity, so stepping once cannot get there.
  for (let i = 0; i < 60 && s.y >= w2.y; i++) s = step(s, f, DT, false, VH);
  assert.ok(s.y < w2.y, 'precondition: Peep dropped below the wheel');
  assert.equal(s.chain, 0);
  assert.equal(s.mult, 1);
});

test('maxY is a high-water mark and never falls', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, vx: 0, vy: 400, lockWheel: -1 };
  let peak = -Infinity;
  for (let i = 0; i < 300; i++) {
    s = step(s, f, DT, false, VH);
    assert.ok(s.maxY >= peak, 'maxY went backwards');
    peak = s.maxY;
  }
});

test('the camera never descends', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, vx: 0, vy: 400, lockWheel: -1 };
  let cam = -Infinity;
  for (let i = 0; i < 300; i++) {
    s = step(s, f, DT, false, VH);
    assert.ok(s.cameraY >= cam, 'camera scrolled back down');
    cam = s.cameraY;
  }
});

test('falling below the camera ends the run, and a dead run stops changing', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, vx: 0, vy: -2000, lockWheel: -1 };
  s = run(s, f, 600, false);
  assert.equal(s.phase, 'dead');
  const frozen = step(s, f, DT, true, VH);
  assert.deepEqual(frozen, s, 'a dead run must be inert');
});

test('score is metres of high-water height, starting at 0', () => {
  const f = makeField(1);
  const s = createRun(f, VH);
  assert.equal(scoreOf(s), 0);
  const climbed = { ...s, maxY: s.startY + 6760 };
  assert.equal(scoreOf(climbed), 676);
});

test('score never decreases across a whole run', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  let best = 0;
  for (let i = 0; i < 1200; i++) {
    s = step(s, f, DT, i % 40 < 25, VH);
    const sc = scoreOf(s);
    assert.ok(sc >= best, 'score decreased');
    best = sc;
  }
});

test('tutorial flags latch as the player performs each action', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  assert.equal(s.everLaunched, false);
  s = run(s, f, 5, false);
  assert.equal(s.everLaunched, false, 'spinning alone is not launching');
  s = step(s, f, DT, true, VH);
  assert.equal(s.everLaunched, true);
});

// --- radiusOf / rateOf -----------------------------------------------------

test('radiusOf(gear) is bigger than radiusOf(tire); rateOf(gear) reverses the spin', () => {
  assert.ok(radiusOf('gear') > radiusOf('tire'));
  assert.equal(radiusOf('tire'), PHYSICS.orbitRadius);
  assert.equal(radiusOf('gear'), PHYSICS.orbitRadius * PROPS.gearRadiusScale);
  assert.equal(rateOf('tire'), PHYSICS.orbitRate);
  assert.equal(rateOf('gear'), PHYSICS.orbitRate * PROPS.gearRateScale);
  assert.ok(rateOf('gear') < 0, 'a gear must spin the opposite way to a tire');
});

// --- pads --------------------------------------------------------------

/** Find the first field prop index at or after `from` with the given kind. */
function findKind(field, kind, from = 0) {
  for (let i = from; ; i++) {
    if (field.propAt(i).kind === kind) return i;
  }
}

/** Find the first pad-stream index (and its pad) at or after `from`. */
function findPad(field, from = 0) {
  for (let i = from; ; i++) {
    const pad = field.padAt(i);
    if (pad) return { index: i, pad };
  }
}

test('a pad bounce sets vy up, preserves vx, and leaves phase fly with no input', () => {
  const f = makeField(1);
  const { pad } = findPad(f);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: pad.x, y: pad.y, vx: 37, vy: -5, lockWheel: -1, lockPad: -1, wasPressed: false };
  s = step(s, f, DT, false, VH);
  assert.equal(s.phase, 'fly', 'a pad bounce must not attach');
  assert.equal(
    s.vy,
    Math.min(PROPS.padBounceMax, Math.max(PROPS.padBounceMin, Math.abs(-5) * PROPS.padBounceScale)),
  );
  assert.equal(s.vx, 37, 'a pad must not touch horizontal velocity');
  assert.equal(s.lastWheelY, pad.y, 'a pad still counts as upward progress');
});

test('a pad is a chain link: it builds chain, mult and feathers exactly like a grab (spec D6)', () => {
  const f = makeField(1);
  const { pad } = findPad(f);
  let s = createRun(f, VH);
  s = {
    ...s,
    phase: 'fly',
    chain: 2,
    mult: 2,
    feathers: 9,
    x: pad.x,
    y: pad.y,
    vx: 0,
    vy: 0,
    lockWheel: -1,
    lockPad: -1,
    wasPressed: false,
  };
  s = step(s, f, DT, false, VH);
  assert.equal(s.chain, 3, 'a pad must build the chain, same as a grab');
  assert.equal(s.mult, 3, 'the chain crossed a chainPerMult boundary (3), so mult must step');
  assert.equal(s.feathers, 12, 'feathers += mult (the new mult, 3), same rule as a grab');
});

test('a pad in lockPad does not re-fire every frame while still in contact', () => {
  const f = makeField(1);
  const { index: padIdx, pad } = findPad(f);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: pad.x, y: pad.y, vx: 0, vy: -5, lockWheel: -1, lockPad: -1, wasPressed: false };
  s = step(s, f, DT, false, VH);
  assert.equal(s.lockPad, padIdx, 'the pad must lock itself out on bounce');
  assert.equal(
    s.vy,
    Math.min(PROPS.padBounceMax, Math.max(PROPS.padBounceMin, Math.abs(-5) * PROPS.padBounceScale)),
  );
  // Still sitting inside the pad's radius next frame: must not bounce again.
  const vyAfterGravity = s.vy - PHYSICS.gravity * DT;
  s = { ...s, x: pad.x, y: pad.y };
  s = step(s, f, DT, false, VH);
  assert.ok(Math.abs(s.vy - vyAfterGravity) < 1e-9, 'a locked pad must not re-fire');
});

test('a pad never appears in the grab candidate list — it is never grabbable', () => {
  const f = makeField(1);
  const { pad } = findPad(f);
  let s = createRun(f, VH);
  // Sit exactly on the pad's would-be orbit annulus, at rest, as if trying to grab it.
  s = { ...s, phase: 'fly', x: pad.x + PHYSICS.orbitRadius, y: pad.y, vx: 0, vy: 0, lockWheel: -1, lockPad: -1, wasPressed: false };
  s = step(s, f, DT, false, VH);
  assert.notEqual(s.phase, 'orbit', 'a pad must never be grabbed like a tire');
});

test('bouncing a pad does not lock out a spine prop with the same numeric index', () => {
  // The lock used to be a single `lockWheel` field keyed on spine indices. Pads
  // now live in their own index space (gap index, not spine index), so a pad
  // index and a spine index can collide numerically — e.g. pad 3 and spine prop
  // 3 are unrelated props that happen to share the number 3. Without separate
  // lock fields, bouncing on pad 3 would make spine prop 3 briefly ungrabbable.
  const f = makeField(1);
  const { index: padIdx, pad } = findPad(f);
  const propAtSameIndex = f.propAt(padIdx);

  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: pad.x, y: pad.y, vx: 0, vy: -5, lockWheel: -1, lockPad: -1, wasPressed: false };
  s = step(s, f, DT, false, VH);
  assert.equal(s.lockPad, padIdx, 'precondition: the pad locked itself out');
  assert.equal(s.lockWheel, -1, 'a pad bounce must never touch the wheel lock');

  // Now try to land on the spine prop that shares the pad's numeric index.
  s = {
    ...s,
    phase: 'fly',
    x: propAtSameIndex.x + radiusOf(propAtSameIndex.kind),
    y: propAtSameIndex.y,
    vx: 0,
    vy: 0,
  };
  s = step(s, f, DT, false, VH);
  assert.equal(
    s.phase,
    'orbit',
    'a spine prop must stay grabbable even when its index numerically matches a locked pad',
  );
  assert.equal(s.wheelIndex, padIdx);
});

// --- gears --------------------------------------------------------------

test('a gear grab attaches and increments chain like a tire', () => {
  const f = makeField(1);
  const gearIdx = findKind(f, 'gear');
  const gear = f.propAt(gearIdx);
  let s = createRun(f, VH);
  s = {
    ...s,
    phase: 'fly',
    x: gear.x + radiusOf('gear'),
    y: gear.y,
    vx: 0,
    vy: 0,
    lockWheel: -1,
    wasPressed: false,
  };
  s = step(s, f, DT, false, VH);
  assert.equal(s.phase, 'orbit');
  assert.equal(s.wheelIndex, gearIdx);
  assert.equal(s.chain, 1);
  assert.equal(s.feathers, 1);
});

test('a gear launches with the opposite horizontal direction to a tire at the same angle', () => {
  const f = makeField(1);
  const gearIdx = findKind(f, 'gear');
  let s = createRun(f, VH);
  s = { ...s, phase: 'orbit', wheelIndex: gearIdx, angle: 0.7, wasPressed: false };
  const launched = step(s, f, DT, true, VH);
  assert.equal(launched.phase, 'fly');

  // A tire at the very same angle, for comparison.
  let t = createRun(f, VH);
  t = { ...t, phase: 'orbit', wheelIndex: 0, angle: 0.7, wasPressed: false };
  const tireLaunched = step(t, f, DT, true, VH);

  assert.ok(
    Math.sign(launched.vx) !== Math.sign(tireLaunched.vx),
    'a gear must launch horizontally opposite to a tire released at the same angle',
  );
});

// --- run clock (`t`) -----------------------------------------------------

test('a fresh run starts at t=0, and t accumulates by dt every step', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  assert.equal(s.t, 0);
  s = step(s, f, DT, false, VH);
  assert.ok(Math.abs(s.t - DT) < 1e-12, 't must advance by exactly dt');
  s = run(s, f, 10, false); // 10 more frames, mix of orbit and (no) flight
  assert.ok(Math.abs(s.t - 11 * DT) < 1e-9, 't must keep accumulating regardless of phase');
});

test('t stops advancing once dead, like everything else', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, vx: 0, vy: -2000, lockWheel: -1 };
  s = run(s, f, 600, false);
  assert.equal(s.phase, 'dead');
  const tAtDeath = s.t;
  s = step(s, f, DT, true, VH);
  assert.equal(s.t, tAtDeath, 'a dead run must not keep ticking its own clock');
});

// --- deathBy ---------------------------------------------------------------

test('a fresh run has a sensible deathBy default', () => {
  const f = makeField(1);
  const s = createRun(f, VH);
  assert.ok(s.deathBy === 'fall' || s.deathBy === 'truck', 'deathBy must be one of the two known causes even before death');
});

test('falling below the camera sets deathBy to fall', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, vx: 0, vy: -2000, lockWheel: -1 };
  s = run(s, f, 600, false);
  assert.equal(s.phase, 'dead');
  assert.equal(s.deathBy, 'fall');
});

// --- updraft zones -----------------------------------------------------

test('inside an updraft, vy rises against gravity beyond what freefall alone would give', () => {
  const f = makeField(1);
  // Deliberately oversized so the test isn't sensitive to Peep's exact position.
  const updraft = { x: 0, y: 0, w: 5000, h: 5000 };
  const zones = { updraftsInRange: () => [updraft], trucksInRange: () => [] };
  let s = createRun(f, VH);
  // x:0 keeps Peep clear of every spine column, same trick other flight tests use.
  s = { ...s, phase: 'fly', x: 0, y: 0, vx: 0, vy: 0, lockWheel: -1 };
  const freefallVy = 0 - PHYSICS.gravity * DT;
  s = step(s, f, DT, false, VH, zones);
  assert.ok(s.vy > freefallVy, 'an updraft must push vy above plain freefall');
  assert.ok(s.vy > 0, 'updraftLift exceeds gravity, so net vy must actually be upward');
});

test('vy inside an updraft clamps to updraftMaxV and never exceeds it', () => {
  const f = makeField(1);
  // Tall enough that 200 frames of climbing at up to updraftMaxV cannot possibly
  // clear the top of the rect (200 * DT * updraftMaxV is far under half of h).
  const updraft = { x: 0, y: 0, w: 5000, h: 1e6 };
  const zones = { updraftsInRange: () => [updraft], trucksInRange: () => [] };
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, y: 0, vx: 0, vy: 0, lockWheel: -1 };
  for (let i = 0; i < 200; i++) {
    s = step(s, f, DT, false, VH, zones);
    assert.ok(s.vy <= ZONES.updraftMaxV + 1e-9, `vy exceeded updraftMaxV at frame ${i}: ${s.vy}`);
  }
  assert.ok(s.vy > ZONES.updraftMaxV - 1, 'sanity: the clamp should actually have been reached, not just never violated');
});

test('leaving the updraft rect drops Peep back to plain freefall immediately', () => {
  const f = makeField(1);
  const updraft = { x: 0, y: 0, w: 200, h: 200 }; // y in [-100, 100]
  const zones = { updraftsInRange: () => [updraft], trucksInRange: () => [] };
  let s = createRun(f, VH);
  // Clearly outside the rect already (y=500 vs the rect's y<=100 extent).
  s = { ...s, phase: 'fly', x: 0, y: 500, vx: 0, vy: 50, lockWheel: -1 };
  const before = s.vy;
  s = step(s, f, DT, false, VH, zones);
  assert.ok(Math.abs(s.vy - (before - PHYSICS.gravity * DT)) < 1e-9, 'outside the rect only gravity may act on vy');
});

test('an updraft never attaches, and never touches chain/mult/feathers', () => {
  const f = makeField(1);
  const updraft = { x: 0, y: 1000, w: 5000, h: 5000 };
  const zones = { updraftsInRange: () => [updraft], trucksInRange: () => [] };
  let s = createRun(f, VH);
  // y well above lastWheelY (0, inherited from createRun): a single frame's
  // semi-implicit-Euler dip (gravity applied before the lift) must not read
  // as falling below the last wheel when starting this far clear of it.
  s = { ...s, phase: 'fly', chain: 4, mult: 2, feathers: 9, x: 0, y: 1000, vx: 0, vy: 0, lockWheel: -1 };
  s = step(s, f, DT, false, VH, zones);
  assert.equal(s.phase, 'fly', 'an updraft must never attach');
  assert.equal(s.chain, 4);
  assert.equal(s.mult, 2);
  assert.equal(s.feathers, 9);
});

// --- trucks: the second failure condition -----------------------------------

/**
 * Build a test truck whose CENTRE lands at world x `cx` (at height `y`) exactly
 * when `step` evaluates the collision — i.e. at `s.t === DT`, the clock after a
 * fresh run's first step.
 *
 * Slice 2 parked a stationary test truck with `speed: 0, phase: cx`, reading x
 * straight off `phase`. Task 13's beat model removed `phase`: a truck's x is now
 * the closed form `truckX(truck, t)` = -halfW + min(cyclePhase, cross)*speed for
 * dir 1. With `beat: 0` the cyclePhase at t=DT is just DT, so choosing
 * `speed = (cx + halfW) / DT` lands the centre precisely on `cx`. These tests
 * exercise run.js's overlap maths, not truck motion, so pinning the rectangle
 * where they mean to is all that changed.
 */
const truckCentredAt = (/** @type {number} */ cx, /** @type {number} */ y) => ({
  y,
  dir: /** @type {1} */ (1),
  speed: (cx + HAZARD.truckW / 2) / DT,
  beat: 0,
});

test('a truck overlapping Peep kills, sets deathBy to truck, and then stays inert', () => {
  const f = makeField(1);
  const truck = truckCentredAt(200, 500);
  const zones = { updraftsInRange: () => [], trucksInRange: () => [truck] };
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 200, y: 500, vx: 0, vy: 0, lockWheel: -1 };
  s = step(s, f, DT, false, VH, zones);
  assert.equal(s.phase, 'dead');
  assert.equal(s.deathBy, 'truck');

  const frozen = step(s, f, DT, true, VH, zones);
  assert.deepEqual(frozen, s, 'a run killed by a truck must stay inert too');
});

test('a truck clearly clear of Peep does not kill', () => {
  const f = makeField(1);
  const truck = truckCentredAt(200, 500);
  const zones = { updraftsInRange: () => [], trucksInRange: () => [truck] };
  let s = createRun(f, VH);
  const clearX = 200 + HAZARD.truckW / 2 + HAZARD.peepHitR + 50;
  s = { ...s, phase: 'fly', x: clearX, y: 500, vx: 0, vy: 0, lockWheel: -1 };
  s = step(s, f, DT, false, VH, zones);
  assert.notEqual(s.phase, 'dead');
  assert.notEqual(s.deathBy, 'truck');
});

test('a truck one pixel clear of Peep hitbox does not kill (edge precision)', () => {
  const f = makeField(1);
  const truckCx = 200;
  const truck = truckCentredAt(truckCx, 0);
  const zones = { updraftsInRange: () => [], trucksInRange: () => [truck] };
  let s = createRun(f, VH);
  // Just past the combined half-width + hitbox radius, straight out to the side.
  const edgeX = truckCx + HAZARD.truckW / 2 + HAZARD.peepHitR + 1;
  s = { ...s, phase: 'fly', x: edgeX, y: truck.y, vx: 0, vy: 0, lockWheel: -1 };
  s = step(s, f, DT, false, VH, zones);
  assert.notEqual(s.phase, 'dead');
});

test('without a zones argument, step behaves exactly as before (no trucks/updrafts)', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: 0, y: 0, vx: 0, vy: 0, lockWheel: -1 };
  const withoutZones = step(s, f, DT, false, VH);
  assert.equal(withoutZones.phase, 'fly');
  assert.ok(Math.abs(withoutZones.vy - (0 - PHYSICS.gravity * DT)) < 1e-9);
});

// --- pads: 1.4x contact speed, bounded ------------------------------------

/** A viewport tall enough that `cameraY` can never catch a falling Peep: the
 *  pad-tower tests below drop him hundreds of points on purpose, and the real
 *  852pt viewport would kill him for it before the second bounce. */
const BIG_VH = 1e6;

/**
 * A stub Field holding exactly one pad at (0, padY) and no reachable spine
 * props. `step` calls `field.propAt(0)` via createRun and `field.padAt` for the
 * lock release, so both must answer; the props sit far below every query range
 * so `propsInRange` never offers a grab and the pad is the only thing Peep can
 * touch.
 * @param {number} padY
 * @returns {import('./field.js').Field}
 */
function padTower(padY) {
  const far = { x: 0, y: -1e9, kind: /** @type {'tire'} */ ('tire') };
  const pad = { x: 0, y: padY };
  return {
    propAt: () => far,
    propsInRange: () => [],
    padAt: (i) => (i === 0 ? pad : null),
    padsInRange: (lo, hi) => (padY >= lo && padY <= hi ? [{ index: 0, pad }] : []),
    wheelAt: () => far,
    wheelsInRange: () => [],
  };
}

/**
 * Drop Peep from `dropH` above the pad and collect the upward speed of every
 * bounce over `frames` frames. A bounce is the frame where vy flips from
 * non-positive to positive.
 * @param {number} dropH
 * @param {number} frames
 * @param {import('./modifier.js').RunTuning} [tuning]
 * @returns {number[]}
 */
function bounceSpeeds(dropH, frames, tuning) {
  const padY = 0;
  const f = padTower(padY);
  let s = {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 0,
    y: padY + dropH,
    vx: 0,
    vy: 0,
    startY: 0,
    maxY: padY + dropH,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
  const out = [];
  for (let i = 0; i < frames; i++) {
    const prev = s.vy;
    s = tuning ? step(s, f, DT, false, BIG_VH, undefined, tuning) : step(s, f, DT, false, BIG_VH);
    if (prev <= 0 && s.vy > 0) out.push(s.vy);
  }
  return out;
}

test('pad bounces CONVERGE to padBounceMax rather than doubling every cycle', () => {
  // Unbounded 1.4x diverges: rise = v^2/560, so a bounce to height h means
  // falling back at sqrt(560h) and relaunching at 1.4*sqrt(560h), i.e. 1.96h.
  // Four cycles and Peep leaves the field in one frame. This test is the only
  // thing standing between a future "this clamp looks arbitrary" and that bug.
  const speeds = bounceSpeeds(100, 60 * 30);
  assert.ok(speeds.length >= 6, `expected several bounces, got ${speeds.length}`);
  assert.ok(
    speeds.every((v) => v <= PROPS.padBounceMax + 1e-9),
    `no bounce may exceed padBounceMax (${PROPS.padBounceMax}); got ${JSON.stringify(speeds)}`,
  );
  assert.ok(
    speeds.every((v) => v >= PROPS.padBounceMin - 1e-9),
    `no bounce may fall below padBounceMin (${PROPS.padBounceMin}); got ${JSON.stringify(speeds)}`,
  );
  const tail = speeds.slice(-3);
  assert.deepEqual(
    tail,
    [PROPS.padBounceMax, PROPS.padBounceMax, PROPS.padBounceMax],
    `the series must settle ON the cap, not merely under it; tail was ${JSON.stringify(tail)}`,
  );
});

test('a fast fall bounces higher than a slow one, inside the governed band', () => {
  // The 1.4x only governs contact speeds of 243..343 pt/s; outside that band the
  // clamps take over and the two drops would read identically. Pick two drops
  // whose contact speeds land inside it: rise = v^2/560, so 110pt -> ~248 and
  // 200pt -> ~335.
  const slow = bounceSpeeds(110, 60 * 4)[0];
  const fast = bounceSpeeds(200, 60 * 4)[0];
  assert.ok(fast > slow, `a faster fall must bounce higher: fast ${fast} vs slow ${slow}`);
});

test('brushing a pad at the apex of a fall still clears the next rung', () => {
  // Contact speed ~0 with no floor gives a bounce of ~0 and the pad reads as
  // broken. padBounceMin exists exactly for this: clearing gapMax (200pt) needs
  // sqrt(560*200) = 335 pt/s.
  const first = bounceSpeeds(1, 60 * 4)[0];
  assert.equal(first, PROPS.padBounceMin);
  const rise = (first * first) / (2 * PHYSICS.gravity);
  assert.ok(rise > FIELD.gapMax, `a pad must always clear gapMax: rise ${rise} vs gap ${FIELD.gapMax}`);
});

test('padBounceMod (Bouncy Hay) is applied AFTER the clamp, not swallowed by it', () => {
  // Same fall, base tuning vs Bouncy Hay (padBounceMod: 1.3). If the mod were
  // applied inside the clamp, padBounceMax would eat the difference and these
  // would read identically — that is exactly the bug the controller note warns
  // against.
  const base = bounceSpeeds(200, 60 * 4, baseTuning())[0];
  const bouncy = bounceSpeeds(200, 60 * 4, { ...baseTuning(), padBounceMod: 1.3 })[0];
  assert.ok(bouncy > base, `Bouncy Hay must bounce higher than base off the same fall: bouncy ${bouncy} vs base ${base}`);
  assert.ok(
    Math.abs(bouncy - base * 1.3) < 1e-9,
    `the mod must multiply the (already-clamped) base bounce exactly: expected ${base * 1.3}, got ${bouncy}`,
  );
});

test('the bounce series still converges with padBounceMod: 1.3 (fixed point moves to padBounceMax * 1.3)', () => {
  const tuning = { ...baseTuning(), padBounceMod: 1.3 };
  const speeds = bounceSpeeds(100, 60 * 30, tuning);
  assert.ok(speeds.length >= 6, `expected several bounces, got ${speeds.length}`);
  const fixedPoint = PROPS.padBounceMax * 1.3;
  assert.ok(
    speeds.every((v) => v <= fixedPoint + 1e-9),
    `no bounce may exceed the modified fixed point (${fixedPoint}); got ${JSON.stringify(speeds)}`,
  );
  const tail = speeds.slice(-3);
  assert.deepEqual(
    tail,
    [fixedPoint, fixedPoint, fixedPoint],
    `the series must settle on the modified fixed point, not merely under it; tail was ${JSON.stringify(tail)}`,
  );
});

test('a pad is a chain link: it steps chain, mult and feathers exactly like a grab', () => {
  const padY = 0;
  const f = padTower(padY);
  let s = {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 0,
    y: padY + 100,
    vx: 0,
    vy: 0,
    startY: 0,
    maxY: padY + 100,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
  const seen = [];
  for (let i = 0; i < 60 * 30; i++) {
    const prev = s.vy;
    s = step(s, f, DT, false, BIG_VH);
    if (prev <= 0 && s.vy > 0) seen.push({ chain: s.chain, mult: s.mult, feathers: s.feathers });
    if (seen.length >= 3) break;
  }
  assert.deepEqual(seen.map((e) => e.chain), [1, 2, 3], 'each pad is one chain link');
  // SCORING.chainPerMult is 3: the third link steps the multiplier, same rule as
  // a grab, same SCORING.multMax cap. Spec D6 — NOT a separate "x2 pad streak",
  // which would downgrade a player already at x4.
  assert.deepEqual(seen.map((e) => e.mult), [1, 1, 2]);
  // feathers += mult at each link, with mult still 1 on the third (it steps
  // after banking is not the rule — the grab path steps mult first, then banks).
  assert.deepEqual(seen.map((e) => e.feathers), [1, 2, 4]);
});

// --- the win state ---------------------------------------------------------

/** World y of the escape truck's centre. */
const ESCAPE_Y = ESCAPE.truckHeightM * SCORING.pointsPerMetre;

/** Peep at `y`, mid-flight, on a real field, with a camera that cannot kill him. */
function flyingAt(f, y) {
  return {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 100,
    y,
    vx: 0,
    vy: 10,
    maxY: y,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
}

test('a run reaching the escape truck ends WON, not dead, and banks its distance', () => {
  const f = makeField(1);
  // Just below contact, still climbing — at a real launch speed. flyingAt's
  // default vy:10 is fine for the "already past the truck" tests below (they
  // start well above contact), but at vy:10 Peep is essentially at the apex of
  // his arc already (max further rise = 10^2/(2*280) = 0.18pt) and can never
  // close a 5pt gap, in one frame or a thousand. A launch's actual climbing
  // speed (orbitRate * orbitRadius * launchBoost, the same v the REACHABILITY
  // test below uses) can.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  const s0 = { ...flyingAt(f, ESCAPE_Y - HAZARD.truckH / 2 - HAZARD.peepHitR - 5), vy: v };
  assert.equal(s0.phase, 'fly');
  const s1 = step(s0, f, DT, false, BIG_VH);
  assert.equal(s1.phase, 'won', 'reaching the truck is a WIN — a third phase, not a death');
  // Contact fires at the truck rect's BOTTOM edge, not its centre, and scoreOf
  // measures climbed distance from startY (the TOP of wheel 0's orbit, one
  // orbitRadius above the wheel) rather than raw world height. Both are legitimate,
  // permanent offsets from ESCAPE.truckHeightM — roughly (truckH/2 + peepHitR +
  // orbitRadius)/pointsPerMetre =~ 11.2m here — not slack to shave the tolerance to
  // near zero.
  assert.ok(scoreOf(s1) >= ESCAPE.truckHeightM - 20, `distance must be banked, got ${scoreOf(s1)}m`);
});

test('a won run is terminal and never becomes a death', () => {
  const f = makeField(1);
  let s = step(flyingAt(f, ESCAPE_Y), f, DT, false, BIG_VH);
  assert.equal(s.phase, 'won');
  // Drive it hard: gravity, the fall check and the truck check all get their
  // chance. A win must survive every one of them.
  for (let i = 0; i < 600; i++) s = step(s, f, DT, true, 852);
  assert.equal(s.phase, 'won', 'a win must be terminal — step returns it untouched');
});

test('Low Ceiling actually lowers the win height — the win reads tuning, not the raw token', () => {
  // The whole point of the RunTuning seam: the win check must read
  // `tuning.truckHeightM`, which Low Ceiling overrides to 1100m. A bare
  // `ESCAPE.truckHeightM` (1200) would ignore the modifier entirely — Low
  // Ceiling would advertise "the truck leaves early" and change nothing.
  // `step`'s zones default is a private const, so mirror it here to reach the
  // 7th (tuning) argument.
  const emptyZones = { updraftsInRange: () => [], trucksInRange: () => [] };
  const f = makeField(1);
  const lowCeiling = applyModifier(MODIFIERS.find((m) => m.key === 'lowCeiling'));
  assert.ok(lowCeiling.truckHeightM < ESCAPE.truckHeightM, 'guard: Low Ceiling really is lower');

  // Peep at the 1100m contact height, climbing. This is ~1000pt BELOW the 1200m
  // ceiling, so the choice of ceiling is unambiguous. x is parked far off the
  // spine so no prop can grab him this frame — the win check runs AFTER the grab
  // logic, and a grab would snap his y down below the truck line. In a real run
  // he reaches the truck flying through the gap, not atop a prop; the truck
  // spans the full width, so the win check ignores x anyway.
  const clearX = 100000;
  const lowY = lowCeiling.truckHeightM * SCORING.pointsPerMetre - HAZARD.truckH / 2 - HAZARD.peepHitR;
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;

  // Under Low Ceiling: this IS the truck. Peep wins.
  const won = step({ ...flyingAt(f, lowY), x: clearX, vy: v }, f, DT, false, BIG_VH, emptyZones, lowCeiling);
  assert.equal(won.phase, 'won', 'at 1100m under Low Ceiling, Peep catches the truck');

  // Under baseTuning (1200m): the same height is still 1000pt short. This is the
  // mutation-kill — the OLD code read ESCAPE.truckHeightM and would have WON here
  // too, making Low Ceiling inert. Peep must still be flying.
  const flying = step({ ...flyingAt(f, lowY), x: clearX, vy: v }, f, DT, false, BIG_VH, emptyZones, baseTuning());
  assert.equal(flying.phase, 'fly', 'at 1100m under the DEFAULT ceiling, the truck is not there yet');
});

test('the escape truck is PLACED, not rolled: no seed can generate a run past it', () => {
  // It is a fixed deterministic feature at a known height, NOT a member of the
  // wrapping hazard-truck stream in zones.js. It must never be missable-by-
  // generation, so every seed must stop at exactly the same ceiling.
  for (const seed of [1, 2, 3, 7, 99, 12345]) {
    const f = makeField(seed);
    const s = step(flyingAt(f, ESCAPE_Y), f, DT, false, BIG_VH);
    assert.equal(s.phase, 'won', `seed ${seed} must hit the same ceiling`);
  }
});

test('REACHABILITY: the escape truck is reachable from the spine props below it', () => {
  // THE critical risk of this task. Get this wrong and the game's ending is
  // literally unreachable — the player climbs to a wall and the run can only
  // ever end in a fall.
  //
  // From the TUNING NOTE: v = orbitRate * orbitRadius * launchBoost; maxRise =
  // v^2 / (2*gravity). Launching straight up from the TOP of an orbit starts one
  // orbit radius above the prop's centre, so the highest y a launch from prop p
  // can reach is p.y + orbitRadius + maxRise.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  const maxRise = (v * v) / (2 * PHYSICS.gravity);
  const contactY = ESCAPE_Y - HAZARD.truckH / 2 - HAZARD.peepHitR;

  for (const seed of [1, 2, 3, 4, 5, 7, 11, 99, 12345, 65535]) {
    const f = makeField(seed);
    // The highest spine prop strictly below the contact height.
    let highest = null;
    for (let i = 0; ; i++) {
      const p = f.propAt(i);
      if (p.y >= contactY) break;
      highest = p;
    }
    assert.ok(highest, `seed ${seed}: no prop below the truck at all`);
    // A tire's radius is the SMALLER of the two (a gear's is 1.25x), so using it
    // is the conservative reading whatever kind the prop turns out to be.
    const reach = highest.y + PHYSICS.orbitRadius + maxRise;
    assert.ok(
      reach >= contactY,
      `seed ${seed}: UNREACHABLE ENDING. Highest prop ${highest.y.toFixed(1)} reaches ` +
        `${reach.toFixed(1)}, truck contact at ${contactY.toFixed(1)} — short by ` +
        `${(contactY - reach).toFixed(1)}pt`,
    );
  }
});

test('GUARD: the spine can never grow a gap that walls the truck off', () => {
  // The reachability test above samples seeds. This one is the invariant behind
  // it, and it is what actually keeps the ending safe as gapMax gets tuned:
  // props sit at most FIELD.gapMax apart, so the highest prop below the truck is
  // at most gapMax below it. Reaching it needs maxRise >= gapMax.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  const maxRise = (v * v) / (2 * PHYSICS.gravity);
  assert.ok(
    maxRise > FIELD.gapMax,
    `maxRise (${maxRise}) must exceed FIELD.gapMax (${FIELD.gapMax}) or the ending walls off`,
  );
});

test('the escape truck sits inside The Great Escape, above where it opens', () => {
  const escape = BIOMES[BIOMES.length - 1];
  assert.equal(escape.key, 'escape');
  assert.ok(
    ESCAPE.truckHeightM > escape.fromM,
    `the truck (${ESCAPE.truckHeightM}m) must sit inside its own biome (opens ${escape.fromM}m)`,
  );
});

test('WON TAKES PRECEDENCE OVER BEST', () => {
  // Fires exactly ONCE per player and is therefore unreachable in ordinary
  // testing, which is precisely why it is written down and tested here.
  //
  // A player's first escape is NECESSARILY also a new best — the truck is the
  // ceiling (spec D4), so 1200m beats anything before it. Both screens have a
  // claim on that run. The won screen wins; the best is still RECORDED, only the
  // screen is suppressed.
  const won = { phase: /** @type {'won'} */ ('won'), maxY: 12000, startY: 0 };
  assert.equal(endScreenOf(won, 0), 'won', 'a first escape is also a new best — won still wins');
  assert.equal(endScreenOf(won, 500), 'won');
  assert.equal(endScreenOf(won, 99999), 'won', 'and a win is a win even when it is not a best');

  const dead = { phase: /** @type {'dead'} */ ('dead'), maxY: 8420, startY: 0 };
  assert.equal(endScreenOf(dead, 500), 'best', 'a death that beats the record is still a best');
  assert.equal(endScreenOf(dead, 900), 'oops', 'a death that does not is an oops');
  assert.equal(endScreenOf(dead, 842), 'oops', 'ties are not bests — best is a strict max');
});
