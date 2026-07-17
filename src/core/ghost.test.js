// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecorder, makeGhostPlayer, isValidGhost } from './ghost.js';
import { createRun, step, scoreOf } from './run.js';
import { makeField } from './field.js';
import { makeZones } from './zones.js';

const VH = 852;
const FIXED_DT = 1 / 60;

/**
 * Drive a whole run on a fixed timestep, asking `pressedAt` what the input was.
 * This is the shape the real game loop must take for a ghost to mean anything.
 * @param {number} seed
 * @param {(frame:number)=>boolean} pressedAt
 */
function playFixed(seed, pressedAt) {
  const field = makeField(seed);
  let s = createRun(field, VH);
  const rec = makeRecorder(seed);
  let frame = 0;
  for (; frame < 60 * 60 && s.phase !== 'dead'; frame++) {
    const pressed = pressedAt(frame);
    // The tap edge is what the recording stores; derive it the same way run.js does.
    rec.note(frame, pressed && !s.wasPressed);
    s = step(s, field, FIXED_DT, pressed, VH);
  }
  return { ghost: rec.finish(scoreOf(s)), deathFrame: frame, state: s };
}

/**
 * A tap pattern that actually climbs, found by search.
 *
 * The phase offset matters and is not cosmetic. Any pattern that is true at frame 0
 * launches Peep on his very first frame from the spawn angle — the top of the wheel,
 * where the tangent is horizontal — so he flies sideways and free-falls to his death
 * at frame 100 having climbed 0m, identically for every seed. A test recording THAT
 * run would replay perfectly while exercising almost nothing.
 *
 * The orbit period is 2*PI/orbitRate ~= 63 frames, and the upward launch is at angle 0.
 */
const pattern = (f) => f % 71 === 42;

test('a replayed ghost reproduces the run exactly', () => {
  const live = playFixed(4242, pattern);
  // Preconditions: a trivial run would replay perfectly while proving nothing.
  assert.ok(live.ghost.taps.length > 3, 'precondition: the run must contain taps');
  assert.ok(live.ghost.metres > 0, 'precondition: the run must actually climb');
  assert.ok(live.state.phase === 'dead', 'precondition: the run must end by dying');

  const player = makeGhostPlayer(live.ghost);
  const replay = playFixed(4242, (f) => player.pressedAt(f));

  assert.equal(replay.ghost.metres, live.ghost.metres, 'metres must match');
  assert.equal(replay.deathFrame, live.deathFrame, 'must die on the same frame');
  assert.deepEqual(replay.state.x, live.state.x, 'must end at the same place');
  assert.deepEqual(replay.ghost.taps, live.ghost.taps, 'taps must round-trip');
});

test('a ghost replayed against the wrong seed does not reproduce', () => {
  const live = playFixed(4242, pattern);
  const player = makeGhostPlayer(live.ghost);
  const other = playFixed(9999, (f) => player.pressedAt(f));
  // Different field, same inputs: the run must diverge. If this ever passes, the
  // field is not actually seed-dependent and the whole daily-run premise is broken.
  assert.notEqual(other.ghost.metres + '/' + other.deathFrame, live.ghost.metres + '/' + live.deathFrame);
});

test('a recording round-trips through JSON', () => {
  const { ghost } = playFixed(7, pattern);
  const back = JSON.parse(JSON.stringify(ghost));
  assert.ok(isValidGhost(back, 7));
  assert.deepEqual(back, ghost);

  const replay = playFixed(7, (f) => makeGhostPlayer(back).pressedAt(f));
  assert.equal(replay.ghost.metres, ghost.metres, 'a decoded ghost must still replay');
});

test('recorded tap frames are strictly ascending and never adjacent', () => {
  // The storage format relies on this: a tap is replayed as a one-frame press, which
  // is only faithful because two rising edges can never land on consecutive frames.
  const { ghost } = playFixed(31337, (f) => f % 5 < 3);
  for (let i = 1; i < ghost.taps.length; i++) {
    assert.ok(ghost.taps[i] > ghost.taps[i - 1], 'ascending');
    assert.ok(ghost.taps[i] - ghost.taps[i - 1] >= 2, `taps ${i - 1},${i} landed adjacent`);
  }
});

test('isValidGhost rejects junk from storage', () => {
  // localStorage is not a trusted channel: old builds, hand-edited JSON, other seeds.
  assert.equal(isValidGhost(null), false);
  assert.equal(isValidGhost({}), false);
  assert.equal(isValidGhost({ seed: 1, taps: 'nope', metres: 2 }), false);
  assert.equal(isValidGhost({ seed: 1, taps: [3, 1], metres: 2 }), false, 'must be ascending');
  assert.equal(isValidGhost({ seed: 1, taps: [1.5], metres: 2 }), false, 'must be integers');
  assert.equal(isValidGhost({ seed: 1, taps: [-1], metres: 2 }), false, 'no negative frames');
  assert.equal(
    isValidGhost({ seed: 1, taps: [1, 2], metres: 2 }),
    false,
    'two rising edges can never land on adjacent frames — an edge at N requires pressed=false at N-1',
  );
  assert.equal(isValidGhost({ seed: 1, taps: [1, 5], metres: 2 }), true);
  assert.equal(isValidGhost({ seed: 1, taps: [1, 5], metres: 2 }, 2), false, 'seed must match');
  assert.equal(isValidGhost({ seed: 1, taps: [1, 5], metres: 2 }, 1), true);
});

test('an empty run still produces a valid ghost', () => {
  const { ghost } = playFixed(5, () => false);
  assert.deepEqual(ghost.taps, []);
  assert.ok(isValidGhost(ghost, 5));
  assert.equal(makeGhostPlayer(ghost).pressedAt(0), false);
});

test('a ghost replays faithfully through zones — trucks and updrafts included', () => {
  // The tests above call step() with five arguments, so zones defaults to
  // EMPTY_ZONES and no truck or updraft has ever been on a replayed path. The
  // live loop passes zones (game.js), and the race screen replays through the
  // very same call. Trucks are the one moving object in the world; they only
  // replay because truckX(truck, t) is a PURE function of the run clock and is
  // never integrated. If that ever changes, this test is the thing that catches
  // it — and a race would silently kill a ghost the player never saw die.
  //
  // `pattern` (above, f % 71 === 42) will NOT do here: on seed 4242 it dies of
  // a fall at frame 850 having climbed 48m, nowhere near a truck (first one at
  // 776m) or an updraft (first one at 375m) — it would pass with zones deleted
  // entirely, proving nothing. `TAP_FRAMES` below is a genuine skilled run on
  // seed 7, found offline by a greedy angle-search bot (simulate every launch
  // delay, keep the one that lands and climbs highest, repeat) so it climbs
  // 857m and is actually killed BY A TRUCK, having passed through an updraft on
  // the way up. Confirmed by hand: replaying this exact tap list through `step`
  // WITHOUT zones dies of a fall at frame 1798 / 384m instead — a different
  // frame, a different cause, a different endpoint. That divergence is what
  // proves zones are load-bearing here, and it is what this test pins.
  const seed = 7;
  const TAP_FRAMES = new Set([
    47, 134, 184, 344, 390, 553, 602, 772, 822, 1007, 1126, 1196, 1286, 1343,
    1453, 1500, 1622, 1716, 1802, 1849, 1960, 2048, 2224, 2296, 2369, 2484,
    2513, 2564, 2713, 2747, 2792, 2880, 2909,
  ]);
  const skilledPattern = (f) => TAP_FRAMES.has(f);

  const field = makeField(seed);
  const zones = makeZones(seed, field);

  /** @param {(f:number)=>boolean} pressedAt */
  const playWithZones = (pressedAt) => {
    let s = createRun(field, VH);
    const rec = makeRecorder(seed);
    let frame = 0;
    for (; frame < 60 * 60 && s.phase !== 'dead'; frame++) {
      const pressed = pressedAt(frame);
      rec.note(frame, pressed && !s.wasPressed);
      s = step(s, field, FIXED_DT, pressed, VH, zones);
    }
    return { ghost: rec.finish(scoreOf(s)), deathFrame: frame, state: s };
  };

  const live = playWithZones(skilledPattern);
  assert.ok(live.ghost.taps.length > 3, 'precondition: the run must contain taps');
  assert.ok(live.ghost.metres > 800, 'precondition: the run must climb well past the first truck (776m)');
  assert.equal(live.state.deathBy, 'truck', 'precondition: this run must actually die to a truck, not a fall');

  const player = makeGhostPlayer(live.ghost);
  const replay = playWithZones((f) => player.pressedAt(f));

  assert.equal(replay.ghost.metres, live.ghost.metres, 'metres must match');
  assert.equal(replay.deathFrame, live.deathFrame, 'must die on the same frame');
  assert.equal(replay.state.deathBy, live.state.deathBy, 'must die the same way');
  assert.equal(replay.state.x, live.state.x, 'must end at the same place');
});
