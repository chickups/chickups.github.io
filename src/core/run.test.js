// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, scoreOf } from './run.js';
import { makeField } from './field.js';
import { PHYSICS, SCORING } from './tokens.js';

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
  let s = createRun(f, VH);
  let feathers = 0;
  let expectedMult = 1;
  for (let grab = 1; grab <= 20; grab++) {
    const w = f.wheelAt(grab);
    s = { ...s, phase: 'fly', x: w.x + PHYSICS.orbitRadius, y: w.y, vx: 0, vy: 0, lockWheel: -1, wasPressed: false };
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
