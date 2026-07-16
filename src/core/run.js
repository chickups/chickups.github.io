// @ts-check
import { PHYSICS, SCORING, CAMERA, PROPS } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';

/** @typedef {import('./field.js').Field} Field */
/** @typedef {import('./field.js').Prop} Prop */
/** @typedef {import('./field.js').Pad} Pad */

/**
 * Orbit radius for a prop kind. Gears are bigger than tires; pads have no
 * orbit at all (a pad's contact test is a plain disc, not this annulus), so
 * this is only meaningful for the two attachable kinds.
 * @param {Prop['kind']} kind
 * @returns {number}
 */
export function radiusOf(kind) {
  return kind === 'gear' ? PHYSICS.orbitRadius * PROPS.gearRadiusScale : PHYSICS.orbitRadius;
}

/**
 * Orbit/launch rate for a prop kind. Gears spin the opposite way to tires
 * (`gearRateScale` is negative), which reverses their launch arc too — the
 * same signed rate feeds both `stepOrbit` and `launchVelocity` so the two
 * stay consistent.
 * @param {Prop['kind']} kind
 * @returns {number}
 */
export function rateOf(kind) {
  return kind === 'gear' ? PHYSICS.orbitRate * PROPS.gearRateScale : PHYSICS.orbitRate;
}

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
 * @property {number} lockWheel    spine prop index that cannot be re-grabbed yet, or -1
 * @property {number} lockPad      pad-stream index that cannot re-fire yet, or -1. Pads have
 *                                 their own index space (gap index, not spine index), so this
 *                                 must NOT share a field with `lockWheel` — a pad index and a
 *                                 spine index can collide numerically and lock the wrong prop.
 * @property {boolean} wasPressed  previous frame's input, for tap edge detection
 * @property {boolean} everLaunched
 * @property {boolean} everGrabbed
 */

/**
 * @param {Field} field
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function createRun(field, viewportH) {
  const wheel = field.propAt(0);
  const angle = Math.PI / 2; // top of the wheel
  const p = orbitPosition(wheel, angle, radiusOf(wheel.kind));
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
    lockPad: -1,
    wasPressed: false,
    everLaunched: false,
    everGrabbed: false,
  };
}

/**
 * Advance the run by one frame. Pure: returns a new state.
 *
 * One verb: TAP. Peep orbits on his own, a tap launches him, and landing on a
 * wheel re-attaches automatically. `pressed` is the raw button state; the tap
 * edge is derived here rather than in the input layer so that the whole verb
 * lives in core/ and ports with it.
 *
 * @param {RunState} state
 * @param {Field} field
 * @param {number} dt seconds
 * @param {boolean} pressed raw input: is the button down this frame?
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function step(state, field, dt, pressed, viewportH) {
  if (state.phase === 'dead') return state;

  const s = { ...state };
  const tapped = pressed && !s.wasPressed;

  if (s.phase === 'orbit') {
    const wheel = field.propAt(s.wheelIndex);
    // A gear's rate is negative (gearRateScale), which both spins it the
    // opposite way and reverses the tangential launch — the same signed rate
    // must feed both, or a gear would spin one way and launch as if it spun
    // the other.
    const rate = rateOf(wheel.kind);
    const radius = radiusOf(wheel.kind);
    if (tapped) {
      // Launch from the angle the player actually saw when they tapped, rather
      // than one frame further along.
      const v = launchVelocity(s.angle, rate, radius, PHYSICS.launchBoost);
      s.vx = v.x;
      s.vy = v.y;
      s.phase = 'fly';
      s.lastWheelY = wheel.y;
      s.lockWheel = s.wheelIndex;
      s.everLaunched = true;
    } else {
      // The tire spins by itself; staying on is not something the player sustains.
      s.angle = stepOrbit(s.angle, dt, rate);
      const p = orbitPosition(wheel, s.angle, radius);
      s.x = p.x;
      s.y = p.y;
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

    // Release the re-grab lock once Peep is clear of the locked prop's own
    // contact band. Wheel and pad locks live in separate index spaces (a pad
    // index and a spine index can collide numerically) and so are tracked and
    // released independently.
    if (s.lockWheel >= 0) {
      const lw = field.propAt(s.lockWheel);
      const lockBand = radiusOf(lw.kind) + PHYSICS.grabTolerance;
      if (Math.hypot(s.x - lw.x, s.y - lw.y) > lockBand) s.lockWheel = -1;
    }
    if (s.lockPad >= 0) {
      const lp = field.padAt(s.lockPad);
      if (!lp || Math.hypot(s.x - lp.x, s.y - lp.y) > PROPS.padRadius) s.lockPad = -1;
    }

    // Pads are touched, not grabbed: a simple distance check against a disc,
    // scanned separately from findGrab because their contact test differs
    // entirely from the orbitable annulus test below. Pads are their own
    // deterministic stream (field.padsInRange), never a spine prop.
    const padHit = field
      .padsInRange(s.y - PROPS.padRadius, s.y + PROPS.padRadius)
      .find(
        (e) =>
          e.index !== s.lockPad &&
          Math.hypot(s.x - e.pad.x, s.y - e.pad.y) <= PROPS.padRadius,
      );

    if (padHit) {
      // No tap, no attach: a pad bypasses the hold-release verb entirely.
      // vx is untouched, so it grants no steering.
      s.vy = PROPS.padBounce;
      s.lastWheelY = padHit.pad.y;
      s.lockPad = padHit.index;
    } else {
      // Touching an orbitable prop's band attaches automatically — the player
      // times the launch, never the catch. Each candidate carries its own
      // radius (a gear's differs from a tire's). The spine only ever contains
      // tire/gear now, so no kind filter is needed here.
      const maxRadius = Math.max(radiusOf('tire'), radiusOf('gear'));
      const band = maxRadius + PHYSICS.grabTolerance;
      const entries = field
        .propsInRange(s.y - band, s.y + band)
        .filter((e) => e.index !== s.lockWheel)
        .map((e) => ({ index: e.index, wheel: e.prop, radius: radiusOf(e.prop.kind) }));
      const hit = findGrab({ x: s.x, y: s.y }, entries, PHYSICS.grabTolerance);
      if (hit) {
        const wheel = field.propAt(hit.index);
        const p = orbitPosition(wheel, hit.angle, radiusOf(wheel.kind));
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

  s.wasPressed = pressed;
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
