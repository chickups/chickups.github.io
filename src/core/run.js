// @ts-check
import { PHYSICS, SCORING, CAMERA } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';

/** @typedef {import('./field.js').Field} Field */

/**
 * @typedef {Object} RunState
 * @property {'orbit'|'fly'|'dead'} phase
 * @property {number} wheelIndex   wheel currently orbited (meaningless while flying)
 * @property {number} angle        orbit angle, radians
 * @property {number} x            world x, points
 * @property {number} y            world y, points, y-up
 * @property {number} vx
 * @property {number} vy
 * @property {number} startY       y at spawn; the score baseline
 * @property {number} maxY         high-water mark
 * @property {number} cameraY      world y of the viewport's bottom edge; never decreases
 * @property {number} chain        consecutive grabs without dropping
 * @property {number} mult         current multiplier, 1..SCORING.multMax
 * @property {number} feathers     banked this run
 * @property {number} lastWheelY   y of the wheel last launched from; chain-break threshold
 * @property {number} lockWheel    wheel index that cannot be re-grabbed yet, or -1
 * @property {boolean} wasHolding  previous frame's input, for edge detection
 * @property {boolean} everHeld
 * @property {boolean} everLaunched
 * @property {boolean} everGrabbed
 */

/**
 * @param {Field} field
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function createRun(field, viewportH) {
  const wheel = field.wheelAt(0);
  const angle = Math.PI / 2; // top of the wheel
  const p = orbitPosition(wheel, angle, PHYSICS.orbitRadius);
  return {
    phase: 'orbit',
    wheelIndex: 0,
    angle,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    startY: p.y,
    maxY: p.y,
    cameraY: p.y - viewportH * CAMERA.peepAnchor,
    chain: 0,
    mult: 1,
    feathers: 0,
    lastWheelY: wheel.y,
    lockWheel: -1,
    wasHolding: false,
    everHeld: false,
    everLaunched: false,
    everGrabbed: false,
  };
}

/**
 * Advance the run by one frame. Pure: returns a new state.
 * @param {RunState} state
 * @param {Field} field
 * @param {number} dt seconds
 * @param {boolean} holding
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function step(state, field, dt, holding, viewportH) {
  if (state.phase === 'dead') return state;

  const s = { ...state };
  if (holding) s.everHeld = true;

  if (s.phase === 'orbit') {
    const wheel = field.wheelAt(s.wheelIndex);
    if (holding) {
      s.angle = stepOrbit(s.angle, dt, PHYSICS.orbitRate);
      const p = orbitPosition(wheel, s.angle, PHYSICS.orbitRadius);
      s.x = p.x;
      s.y = p.y;
    } else if (s.wasHolding) {
      const v = launchVelocity(s.angle, PHYSICS.orbitRate, PHYSICS.orbitRadius, PHYSICS.launchBoost);
      s.vx = v.x;
      s.vy = v.y;
      s.phase = 'fly';
      s.lastWheelY = wheel.y;
      s.lockWheel = s.wheelIndex;
      s.everLaunched = true;
    }
  } else if (s.phase === 'fly') {
    const f = stepFly({ x: s.x, y: s.y, vx: s.vx, vy: s.vy }, dt, PHYSICS.gravity);
    s.x = f.x;
    s.y = f.y;
    s.vx = f.vx;
    s.vy = f.vy;

    // Falling below the wheel you last left breaks the chain: the multiplier
    // measures sustained upward progress, not grabs in total.
    if (s.chain > 0 && s.y < s.lastWheelY) {
      s.chain = 0;
      s.mult = 1;
    }

    const band = PHYSICS.orbitRadius + PHYSICS.grabTolerance;

    // Release the re-grab lock once Peep is clear of that wheel's band.
    if (s.lockWheel >= 0) {
      const lw = field.wheelAt(s.lockWheel);
      if (Math.hypot(s.x - lw.x, s.y - lw.y) > band) s.lockWheel = -1;
    }

    if (holding) {
      const entries = field
        .wheelsInRange(s.y - band, s.y + band)
        .filter((e) => e.index !== s.lockWheel);
      const hit = findGrab({ x: s.x, y: s.y }, entries, PHYSICS.orbitRadius, PHYSICS.grabTolerance);
      if (hit) {
        const wheel = field.wheelAt(hit.index);
        const p = orbitPosition(wheel, hit.angle, PHYSICS.orbitRadius);
        s.phase = 'orbit';
        s.wheelIndex = hit.index;
        s.angle = hit.angle;
        s.x = p.x;
        s.y = p.y;
        s.vx = 0;
        s.vy = 0;
        s.lockWheel = -1;
        s.chain += 1;
        if (s.chain % SCORING.chainPerMult === 0) {
          s.mult = Math.min(SCORING.multMax, s.mult + 1);
        }
        s.feathers += s.mult;
        s.everGrabbed = true;
      }
    }
  }

  if (s.y > s.maxY) s.maxY = s.y;
  const desiredCamera = s.maxY - viewportH * CAMERA.peepAnchor;
  if (desiredCamera > s.cameraY) s.cameraY = desiredCamera;
  if (s.y < s.cameraY) s.phase = 'dead';

  s.wasHolding = holding;
  return s;
}

/**
 * Distance climbed, in metres. Always literally true — the multiplier feeds
 * feathers, never this number.
 * @param {RunState} state
 * @returns {number}
 */
export function scoreOf(state) {
  return Math.max(0, Math.floor((state.maxY - state.startY) / SCORING.pointsPerMetre));
}
