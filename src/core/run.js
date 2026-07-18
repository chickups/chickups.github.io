// @ts-check
import { PHYSICS, SCORING, CAMERA, PROPS, ZONES, HAZARD, ESCAPE } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';
import { truckX } from './zones.js';
import { baseTuning } from './modifier.js';

/** @typedef {import('./field.js').Field} Field */
/** @typedef {import('./field.js').Prop} Prop */
/** @typedef {import('./field.js').Pad} Pad */
/** @typedef {import('./zones.js').Zones} Zones */
/** @typedef {import('./zones.js').Updraft} Updraft */
/** @typedef {import('./zones.js').Truck} Truck */

/**
 * A no-op zones stream, used when `step` is called without one (call sites
 * that haven't been wired up to `makeZones` yet keep working, just without
 * updrafts or trucks).
 * @type {Zones}
 */
const EMPTY_ZONES = { updraftsInRange: () => [], trucksInRange: () => [] };

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
 * How good launching THIS frame is, 0–1: the fraction of launch speed that points
 * up (max height gained). Pure and read-only — the render layer uses it to pulse a
 * "tap now" cue that peaks at the ideal moment. 0 when not orbiting. Computed from
 * the launch vector, so a gear's reversed rate is handled correctly (its ideal
 * angle differs from a tire's).
 * @param {{phase?:string, wheelIndex?:number, angle?:number}} state
 * @param {{propAt:(i:number)=>{kind:string}}} field
 * @returns {number}
 */
export function launchQuality(state, field) {
  if (state.phase !== 'orbit') return 0;
  const wheel = field.propAt(state.wheelIndex ?? 0);
  const v = launchVelocity(state.angle ?? 0, rateOf(wheel.kind), radiusOf(wheel.kind), PHYSICS.launchBoost);
  const speed = Math.hypot(v.x, v.y);
  return speed === 0 ? 0 : Math.max(0, v.y / speed);
}

/**
 * @typedef {Object} RunState
 * @property {'orbit'|'fly'|'dead'|'won'} phase
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
 * @property {number} t            seconds since the run began; accumulated from `dt`,
 *                                 never read from a clock. Feeds `truckX`.
 * @property {'fall'|'truck'} deathBy  cause of death; meaningless (but always a real
 *                                 value) unless `phase` is `'dead'`. A WIN IS NOT A
 *                                 DEATH — when phase is 'won' this field says nothing
 *                                 at all. Every downstream consumer asks *why did the
 *                                 run end*; encoding a victory as a death would make
 *                                 each of them wrong in a different way (spec D4).
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
    t: 0,
    // 'fall' is the sensible default: it is slice-1's sole failure mode, and
    // this field is meaningless anyway until phase is 'dead'.
    deathBy: 'fall',
  };
}

/**
 * Is the run still being played? Both terminal phases ('dead' and 'won') are
 * final and are stepped no further. Written once, here, rather than as a
 * `!== 'dead'` at each of the four places that used to ask — adding 'won' to
 * three of four is a bug that only shows up on the one run per player that wins.
 * @param {RunState['phase']} phase
 * @returns {boolean}
 */
export function isLive(phase) {
  return phase === 'orbit' || phase === 'fly';
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
 * @param {Zones} [zones] updraft/truck streams; omit for a plain run with neither
 * @param {import('./modifier.js').RunTuning} [tuning] Daily Run modifiers. Three knobs
 *   reach here — `padBounceMod`, `featherScale` and `updraftScale`. Omitted, it is a
 *   plain unmodified run, identical to what this function did before modifiers existed.
 *   `createRun` takes no tuning: it reads none of the seven knobs.
 * @returns {RunState}
 */
export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES, tuning = baseTuning()) {
  if (!isLive(state.phase)) return state;

  const s = { ...state };
  s.t = state.t + dt;
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

    // Updraft zones: a column of rising air, not a spine prop — no attach,
    // no chain/mult/feathers. While Peep's centre sits inside the rect, add
    // lift on top of the gravity `stepFly` already applied, clamped to
    // updraftMaxV. Leaving the rect (checked fresh every frame, nothing
    // latched) returns him to plain freefall immediately, per doc §13.
    const zoneBand = ZONES.updraftH / 2 + ZONES.updraftW / 2;
    const inUpdraft = zones
      .updraftsInRange(s.y - zoneBand, s.y + zoneBand)
      .some(
        (u) => Math.abs(s.x - u.x) <= u.w / 2 && Math.abs(s.y - u.y) <= u.h / 2,
      );
    if (inUpdraft) {
      // Tailwind scales the lift AND the ceiling. Scaling the lift alone would do
      // almost nothing visible: vy clamps at updraftMaxV either way, so a stronger
      // push would just reach the same 300 pt/s a few frames sooner.
      s.vy = Math.min(
        ZONES.updraftMaxV * tuning.updraftScale,
        s.vy + ZONES.updraftLift * tuning.updraftScale * dt,
      );
    }

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
      // No tap, no attach: a pad is automatic. `vx` is untouched, so it grants
      // no steering.
      //
      // Contact speed carries into the bounce (doc §13) — see PROPS.padBounceScale
      // in tokens.js for why the clamp is mandatory and where both bounds come
      // from. Short version: unbounded, this doubles Peep's height every
      // pad-to-pad cycle.
      //
      // `tuning.padBounceMod` is a DIFFERENT quantity: the Daily Run's Bouncy Hay
      // dial (1.0 at base, 1.3 on Bouncy Hay), not this contact factor. It is
      // applied AFTER the clamp deliberately — inside it, padBounceMax would eat
      // the 1.3 on exactly the fast falls Bouncy Hay exists to reward. Applied
      // here, the fixed point moves to 480 * mod and the series still terminates.
      s.vy = Math.min(
        PROPS.padBounceMax,
        Math.max(PROPS.padBounceMin, Math.abs(s.vy) * PROPS.padBounceScale),
      ) * tuning.padBounceMod;
      s.lastWheelY = padHit.pad.y;
      s.lockPad = padHit.index;
      // Spec D6: a pad is a CHAIN LINK, exactly like a grab — same counter, same
      // chainPerMult rule, same multMax cap. The doc's literal "x2 pad streak"
      // was rejected because it would DOWNGRADE a player already at x4 under the
      // rule below, and because "without touching ground" is meaningless in a
      // game with no ground.
      s.chain += 1;
      if (s.chain % SCORING.chainPerMult === 0) {
        s.mult = Math.min(SCORING.multMax, s.mult + 1);
      }
      s.feathers += s.mult;
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
        // Feather Frenzy doubles the take. Rounded, because a fractional feather
        // would render as "12.5" in the HUD and round differently in the wallet.
        s.feathers += Math.round(s.mult * tuning.featherScale);
        s.everGrabbed = true;
      }
    }
  }

  if (s.y > s.maxY) s.maxY = s.y;
  const desiredCamera = s.maxY - viewportH * CAMERA.peepAnchor;
  if (desiredCamera > s.cameraY) s.cameraY = desiredCamera;

  // THE WIN — checked FIRST, and it is a third phase, not a death with a happy
  // screen (spec D4). The escape truck is PLACED at `tuning.truckHeightM`: a fixed,
  // deterministic feature at a known height, never a member of zones.js's
  // wrapping hazard stream, so it can never be missed by generation. It spans the
  // full field width — reaching its height IS catching it, and there is nothing
  // to aim at and nothing to miss.
  //
  // Read from `tuning`, NOT the raw ESCAPE token: the Low Ceiling daily modifier
  // lowers the ceiling to 1100m through `RunTuning.truckHeightM`, and a bare
  // `ESCAPE.truckHeightM` here would silently ignore it — the modifier would
  // advertise "the truck leaves early" and change nothing. `baseTuning()` seeds
  // it from ESCAPE.truckHeightM, so a plain run is unchanged.
  //
  // Ordering matters: this runs before the fall and truck checks so that a frame
  // which both reaches the truck and grazes a hazard is a win. Peep is aboard;
  // the traffic is no longer his problem.
  const escapeY = tuning.truckHeightM * SCORING.pointsPerMetre;
  if (s.y + HAZARD.peepHitR >= escapeY - HAZARD.truckH / 2) {
    s.phase = 'won';
  }

  if (isLive(s.phase) && s.y < s.cameraY) {
    s.phase = 'dead';
    s.deathBy = 'fall';
  }

  // Truck contact: the second failure condition. A rect-vs-circle test —
  // Peep's hitbox (`peepHitR`) is deliberately smaller than his art, so
  // near-misses read as near. Checked in every live phase (orbit or fly): a truck
  // can clip Peep off a wheel just as easily as out of the air. `truckX` is
  // the pure function of `(truck, s.t)`, never integrated, so this is exactly
  // reproducible from the run clock alone (the point of the whole exercise —
  // a future ghost replay).
  if (isLive(s.phase)) {
    const trucks = zones.trucksInRange(s.y - HAZARD.truckH, s.y + HAZARD.truckH);
    for (const truck of trucks) {
      const tx = truckX(truck, s.t);
      const halfW = HAZARD.truckW / 2;
      const halfH = HAZARD.truckH / 2;
      const cx = Math.max(tx - halfW, Math.min(s.x, tx + halfW));
      const cy = Math.max(truck.y - halfH, Math.min(s.y, truck.y + halfH));
      const dx = s.x - cx;
      const dy = s.y - cy;
      if (dx * dx + dy * dy <= HAZARD.peepHitR * HAZARD.peepHitR) {
        s.phase = 'dead';
        s.deathBy = 'truck';
        break;
      }
    }
  }

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

/**
 * Which terminal screen a finished run routes to.
 *
 * This lives in core/, not in game.js, for one reason: the WON-OVER-BEST rule
 * fires exactly ONCE per player and is unreachable in ordinary testing, and the
 * render layer has no test harness. A rule nobody can test is a rule nobody can
 * trust.
 *
 * The rule (spec D4): a player's FIRST escape is necessarily also a new best —
 * the truck is the permanent ceiling, so 1200m beats anything before it. Both
 * screens have a claim on that run. The won screen always wins: escaping is the
 * larger event, and New Best would be a strange anticlimax announcing a record
 * the player can never break again. The new best is still RECORDED by the
 * caller's recordRun — only the SCREEN is suppressed.
 *
 * After the first escape `best` sits at the ceiling permanently, so every later
 * win is a win and never a new best, and this rule never fires again.
 *
 * @param {RunState} state a finished run
 * @param {number} best the previous best, in metres, from before this run
 * @returns {'won'|'best'|'oops'}
 */
export function endScreenOf(state, best) {
  if (state.phase === 'won') return 'won';
  return scoreOf(state) > best ? 'best' : 'oops';
}
