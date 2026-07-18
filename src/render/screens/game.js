// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gear } from '../art/gear.js';
import { pad } from '../art/pad.js';
import { gamebg } from '../art/gamebg.js';
import { makeHud } from '../hud.js';
import { hazardTruck } from '../art/hazardTruck.js';
import { updraft } from '../art/updraft.js';
import { makeField } from '../../core/field.js';
import { makeZones, truckX, truckTelling } from '../../core/zones.js';
import { biomeAtY, biomeIndexAtY } from '../../core/biome.js';
import { createRun, step, scoreOf, radiusOf, isLive, endScreenOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS, PROPS, HAZARD, ZONES, RACE } from '../../core/tokens.js';
import { modifierForDay, applyModifier, baseTuning } from '../../core/modifier.js';
import { makeInput } from '../../input.js';
import { makeRecorder, makeGhostPlayer } from '../../core/ghost.js';
import {
  getBest, recordRun, getEquippedOutfit, setDailyBest,
  getStats, getSeenAchievements, markAchievementsSeen, checkMilestones,
  getStreak, setStreak, getSetting, getGhost, setGhost, earnFeathers,
  markTutorialSeen,
} from '../../storage.js';
import { pendingUnlocks } from '../../core/achievements.js';
import { toastAchievement, toastMessage } from '../toast.js';
import { queueReward } from './reward.js';
import { dayNumber, dailySeed } from '../../core/daily.js';
import { advanceStreak } from '../../core/streak.js';
import { viewportPoints } from '../../viewport.js';
import { tap, medium, rigid } from '../../haptics.js';
import { flap, bounce, feather, thud, fanfare } from '../../sound.js';

const DEG = 180 / Math.PI;

/** How far beyond the viewport a pooled object is kept alive. Sized to the
 *  LARGEST half-extent of ANY object this screen pools — never a hardcoded
 *  number, or it goes stale the next time something new is added. Vertical
 *  culling only, so what matters is each object's half-HEIGHT (or radius, for
 *  the circular props, where half-width == half-height):
 *   gear 77.5, tire 62, pad 46, truck 32 — and updraft 130, the actual max.
 *  An updraft used to be culled while its bottom edge was still visibly inside
 *  the viewport (130 - the old 105.5 band = 24.5pt of pop-in) — see final-fixes
 *  report #4. */
const CULL_BAND =
  Math.max(radiusOf('gear'), PROPS.padRadius, HAZARD.truckH / 2, ZONES.updraftH / 2) + PHYSICS.grabTolerance;

/** Tip copy, verbatim from doc §04. */
const TIP_TAP = 'Tap to launch!';
const TIP_LAND = 'Land on a tire to keep climbing';

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function gameScreen(go, arg) {
  const vp = viewportPoints();
  // Seeding from the clock lives in render/, never in core/. A Daily Run swaps
  // the clock-seed for the date-seed, which is the whole trick: the field is a
  // pure function of its seed, so every player gets the same route with no
  // server involved. Only a leaderboard would need one.
  const daily = Boolean(arg && arg.daily);
  // A tutorial run is a guided PRACTICE run: it narrates the loop with callouts,
  // forgives an early death by restarting, and graduates to normal play after
  // GRAD_GRABS grabs. It must touch NO stats — see the tutorial branch in the
  // run-end block below.
  const tutorial = !!(arg && arg.tutorial);
  const GRAD_GRABS = 2;      // grabs needed before the tutorial "graduates" to normal play
  let grabs = 0;             // grabs made this run (fly → orbit rising edges)
  // Prefer the day the Daily screen already computed and passed in. Reading the
  // clock fresh here would let a dwell across local midnight play a different
  // route/modifier than the one the screen advertised. A plain run has no
  // arg.day and reads the clock (its `day` only feeds the daily-only branches).
  const day =
    daily && arg && Number.isFinite(arg.day)
      ? arg.day
      : dayNumber(Date.now(), new Date().getTimezoneOffset());
  // A race must run on the GHOST'S OWN seed: a ghost is only valid against the
  // field it was recorded on (ghost.js), and replaying it against any other one
  // reproduces nothing. getGhost() has already run it past isValidGhost, so a
  // corrupt or hand-edited recording arrives here as null and this is an
  // ordinary run — a tampered store must never be able to drive the simulation.
  const ghost = arg && arg.race ? getGhost() : null;
  const seed = ghost ? ghost.seed : (daily ? dailySeed(day) : ((Date.now() >>> 0) || 1));
  // The route comes from the seed; the RULES come from the modifier. Two separate
  // jobs, deliberately: `dailySeed` identifies which route today is, and
  // `modifierForDay` picks which of the seven modifiers is applied to it. A plain
  // run gets `baseTuning()`, which is every token default — i.e. no change at all.
  //
  // A ghost is only ever recorded from a NON-daily run (see the `setGhost` call
  // below) — a Ghost is `{seed, taps, metres}` with no tuning field, and a daily
  // run's modifier changes the field layout itself (e.g. Thin Air's gapMax), not
  // just the physics. A race is never `daily`, so this is `baseTuning()` here too,
  // matching the tuning the recording was made under. If a ghost could ever come
  // from a modified run, this line would have to recover which modifier — and it
  // cannot, because the Ghost shape (locked, core/ghost.js) does not carry one.
  const tuning = daily ? applyModifier(modifierForDay(day)) : baseTuning();
  const field = makeField(seed, tuning);
  const zones = makeZones(seed, field, tuning);
  let state = createRun(field, vp.h);

  // Record EVERY (non-daily) run, not just races: the ghost is "my best run",
  // and the run that becomes the best is an ordinary one. Only tap FRAMES are
  // stored — the rest replays from the simulation, so a long run is a few
  // hundred bytes. Restricted to non-daily runs for the tuning reason above.
  const recorder = makeRecorder(seed);
  /** The fixed-timestep frame counter. NOT the rAF frame: rAF's rate varies with
   *  the display and with every hitch, and a recording indexed by it would mean
   *  nothing on another machine. */
  let frameNo = 0;

  const ghostPlayer = ghost ? makeGhostPlayer(ghost) : null;
  /** The ghost's own simulation: same field, same zones, same fixed step, its
   *  own state. It is a second run, not an animation of a stored path — which is
   *  the whole trick, and why a few hundred bytes are enough. */
  let ghostState = ghostPlayer ? createRun(field, vp.h) : null;

  const best = getBest();
  const outfit = getEquippedOutfit();
  // Read once per run, not per frame: flipping the toggle mid-run is not a case
  // that exists — Settings is only reachable from Home and Pause, and Pause
  // rebuilds the screen on resume.
  const hints = getSetting('hints');
  /** The run's peak chain, for the achievement stats. `state.chain` resets on a
   *  drop, so the maximum has to be watched from outside the sim. */
  let maxChain = 0;

  // --- world container -------------------------------------------------
  const world = el('div', { position: 'absolute', inset: '0px', willChange: 'transform' });

  const peepEl = el('div', {
    position: 'absolute', left: '0px', top: '0px',
    width: px(PHYSICS.peepSize), height: px(PHYSICS.peepSize),
    zIndex: '6', willChange: 'transform',
  }, peep(PHYSICS.peepSize, 'run', outfit, false));

  const ghostEl = ghostPlayer
    ? el('div', {
        position: 'absolute', left: '0px', top: '0px',
        width: px(PHYSICS.peepSize), height: px(PHYSICS.peepSize),
        zIndex: '5', opacity: '0.45', filter: 'grayscale(1)', willChange: 'transform',
        pointerEvents: 'none',
      }, peep(PHYSICS.peepSize, 'fly', 'none', false))
    : null;

  // The doc's red-dashed BEST line: a real place in the world, only drawable
  // because the camera never descends.
  const bestY = state.startY + best * SCORING.pointsPerMetre;
  const bestLine = best > 0
    ? el(
        'div',
        {
          position: 'absolute', left: '0px', width: px(vp.w), top: px(-bestY),
          height: '0px', borderTop: `3px dashed ${COLORS.red}`, zIndex: '3',
        },
        el('div', {
          position: 'absolute', right: px(8), top: px(-18),
          font: `800 ${px(12)} 'Nunito'`, color: COLORS.red, letterSpacing: '.06em',
        }, `BEST ${best}`),
      )
    : null;
  if (bestLine) world.appendChild(bestLine);
  if (ghostEl) world.appendChild(ghostEl);   // before peepEl — zIndex 5 sits under Peep's 6
  world.appendChild(peepEl);

  const hud = makeHud(() => go('pause', { state, seed }));
  const bg = gamebg(world);
  const root = el('div', { position: 'absolute', inset: '0px', cursor: 'pointer' },
    bg.root, hud.root);

  // --- prop pooling ----------------------------------------------------
  /**
   * Pool one stream of world objects: add what entered view, drop what left.
   * A run is unbounded, so nothing may ever accumulate.
   *
   * Every stream positions by CENTRE, because that is what core's containment
   * maths uses (`|s.x - u.x| <= u.w/2`). Positioning art by a corner here would
   * put every prop half its own size away from the thing it collides with.
   * @param {Map<number, HTMLElement>} pool
   * @param {{index:number, at:{x:number,y:number}, w:number, h:number}[]} items
   * @param {(item:any) => HTMLElement} build
   */
  function sync(pool, items, build) {
    const live = new Set();
    for (const item of items) {
      live.add(item.index);
      if (!pool.has(item.index)) {
        const node = el('div', {
          position: 'absolute',
          left: px(item.at.x - item.w / 2),
          top: px(-item.at.y - item.h / 2),
        }, build(item));
        world.insertBefore(node, peepEl);
        pool.set(item.index, node);
      }
    }
    for (const [index, node] of pool) {
      if (!live.has(index)) {
        node.remove();
        pool.delete(index);
      }
    }
  }

  /** @type {Map<number, HTMLElement>} */
  const propEls = new Map();
  /** @type {Map<number, HTMLElement>} */
  const padEls = new Map();
  /** @type {Map<number, HTMLElement>} */
  const draftEls = new Map();
  /** @type {Map<number, HTMLElement>} */
  const truckEls = new Map();
  /** Trucks move every frame, so their nodes need repositioning, not just pooling. */
  /** @type {{index:number, truck:any}[]} */
  let liveTrucks = [];
  /** Last tell state painted per truck, so the art is only rebuilt on the edge —
   *  60 rebuilds a second would be a new node per frame per truck. */
  /** @type {Map<number, boolean>} */
  const truckTells = new Map();

  /**
   * @param {number} lo world y
   * @param {number} hi world y
   */
  function syncProps(lo, hi) {
    // Updrafts sit behind everything; draw them first.
    //
    // Keyed by y, NOT by position in the returned array. `field` hands out stable
    // stream indices but `zones` returns bare arrays, and an array index from a
    // range query shifts as the camera climbs — so pooling on it would quietly
    // recycle one zone's node for a different zone. Each stream places at most one
    // object per `updraftEvery`/`truckEvery` points, so y is a unique, stable id.
    sync(
      draftEls,
      zones.updraftsInRange(lo, hi).map((u) => ({ index: Math.round(u.y), at: u, w: u.w, h: u.h })),
      (item) => updraft(item.w, item.h),
    );
    sync(
      propEls,
      field.propsInRange(lo, hi).map(({ index, prop }) => {
        // A gear is a bigger wheel, and the core already knows by how much —
        // read it rather than restating the scale here, or the art and the
        // collision radius drift apart.
        const d = radiusOf(prop.kind) * 2;
        return { index, at: prop, w: d, h: d, kind: prop.kind };
      }),
      (item) => (item.kind === 'gear' ? gear(item.w) : tire(item.w, 4)),
    );
    sync(
      padEls,
      field.padsInRange(lo, hi).map(({ index, pad: p }) => ({
        index, at: p, w: PROPS.padRadius * 2, h: PROPS.padRadius * 2,
      })),
      (item) => pad(item.w),
    );

    liveTrucks = zones.trucksInRange(lo, hi).map((truck) => ({ index: Math.round(truck.y), truck }));
    sync(
      truckEls,
      liveTrucks.map(({ index, truck }) => ({
        index,
        at: { x: truckX(truck, state.t), y: truck.y },
        w: HAZARD.truckW,
        h: HAZARD.truckH,
        truck,
      })),
      (item) => hazardTruck(HAZARD.truckW, HAZARD.truckH, item.truck.dir, true, truckTelling(item.truck, state.t)),
    );
    // A truck that just entered the pool was built with its current tell above;
    // drop tell entries for trucks that left, so the cache cannot grow unbounded
    // over a long climb or go stale if an index is ever reused.
    for (const index of truckTells.keys()) {
      if (!truckEls.has(index)) truckTells.delete(index);
    }
  }

  // --- painting --------------------------------------------------------
  let pose = 'run';

  function paint() {
    const h = viewportPoints().h;
    world.style.transform = `translateY(${px(h + state.cameraY)})`;

    // Trucks are the only world object that moves. Their x is recomputed from
    // truckX(truck, t) rather than integrated, which is exactly what lets a
    // ghost replay reproduce them from the run clock alone. The tell is the same
    // deal: truckTelling(truck, t) is pure core state, so the glow replays too.
    for (const { index, truck } of liveTrucks) {
      const node = truckEls.get(index);
      if (!node) continue;
      const tell = truckTelling(truck, state.t);
      // During the tell the truck is parked off-field at its EXIT edge — truckX
      // returns the far edge once a crossing finishes. The glow is this node's
      // child, so positioning by truckX would pulse the warning on the side the
      // truck just LEFT. Park the (still invisible, still off-field) node at the
      // ENTRY edge instead — dir=1 enters from the left, dir=-1 from the right —
      // so the glow peeks onto the field exactly where the truck is about to
      // appear. This is the truck's own cyclePhase=0 position, computed here to
      // avoid a second core call: dir=1 -> -truckW, dir=-1 -> field width.
      node.style.left = px(
        tell
          ? (truck.dir === 1 ? -HAZARD.truckW : vp.w)
          : truckX(truck, state.t) - HAZARD.truckW / 2,
      );
      if (tell !== truckTells.get(index)) {
        truckTells.set(index, tell);
        node.replaceChildren(hazardTruck(HAZARD.truckW, HAZARD.truckH, truck.dir, true, tell));
      }
    }

    let rotation;
    let wanted;
    if (state.phase === 'orbit') {
      rotation = -state.angle * DEG;
      wanted = 'run';
    } else {
      rotation = Math.atan2(state.vx, state.vy) * DEG;
      wanted = state.vy > 0 ? 'launch' : 'fly';
    }
    if (wanted !== pose) {
      pose = wanted;
      peepEl.replaceChildren(peep(PHYSICS.peepSize, /** @type {any} */ (pose), outfit, false));
    }
    peepEl.style.transform =
      `translate(${px(state.x - PHYSICS.peepSize / 2)},${px(-state.y - PHYSICS.peepSize / 2)}) rotate(${rotation}deg)`;

    if (ghostEl && ghostState) {
      // Hidden once dead rather than left lying at its last position, where it
      // would read as a live rival standing still.
      // Hide the ghost once it is no longer live — dead OR won. A ghost recorded
      // from a winning run reaches the truck and stops; `!isLive` covers both so it
      // never freezes on screen (a bare `=== 'dead'` left a winning ghost stuck).
      ghostEl.style.display = (!isLive(ghostState.phase) || state.phase === 'won') ? 'none' : 'block';
      const gRot = ghostState.phase === 'orbit'
        ? -ghostState.angle * DEG
        : Math.atan2(ghostState.vx, ghostState.vy) * DEG;
      ghostEl.style.transform =
        `translate(${px(ghostState.x - PHYSICS.peepSize / 2)},${px(-ghostState.y - PHYSICS.peepSize / 2)}) rotate(${gRot}deg)`;
    }

    // Tutorial Hints off means no bubble at all. `hud.update` already treats an
    // empty string as "hide the bubble", so this needs no HUD change.
    let tip = '';
    if (tutorial) {
      if (grabs >= GRAD_GRABS) tip = 'You’ve got it — climb to catch the truck at the top!';
      else if (!state.everLaunched) tip = 'Tap at the top of the swing to launch.';
      else if (!state.everGrabbed) tip = 'Now drop onto the next tire!';
      else tip = 'Nice! Land again to chain — each grab’s a feather.';
    } else if (hints) {
      if (!state.everLaunched) tip = TIP_TAP;
      else if (!state.everGrabbed) tip = TIP_LAND;
    }

    // biomeAtY, not biomeAt(scoreOf(state)): the field generator (field.js/zones.js)
    // always keys a prop's biome off ABSOLUTE world height. scoreOf is climbed
    // distance from state.startY (a different zero point, offset by the orbit
    // radius) — feeding that into biomeAt disagreed with what the field actually
    // built near every boundary. See final-fixes report #5.
    const biome = biomeAtY(state.maxY);
    bg.setSky(biome.key);
    // The meter only exists in the final band: `tuning.truckHeightM` is the
    // live escape height (metres), already adjusted for the Low Ceiling daily
    // modifier — so `progress` tracks the actual truck, not a hardcoded 1200.
    const progress = biome.key === 'escape' ? scoreOf(state) / tuning.truckHeightM : null;
    hud.update(scoreOf(state), state.mult, tip, biome.key, progress);
  }

  // --- loop ------------------------------------------------------------
  // The simulation runs on a FIXED timestep, decoupled from the display's frame
  // rate. rAF's dt varies with refresh rate (60Hz vs 120Hz) and with every hitch,
  // and feeding that straight to `step` made the physics resolution-dependent:
  // the same taps gave different arcs on different phones. A fixed step also makes
  // a run reproducible from its seed plus its tap frames, which is what lets a
  // ghost replay exist at all.
  const FIXED_DT = 1 / 60;
  /** Ticks per rAF frame. Beyond this we drop simulated time rather than spiral:
   *  catching up costs more than it earns, and each extra tick makes the next
   *  frame later still. */
  const MAX_TICKS = 5;

  const input = makeInput(root);
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let stopped = false;
  let prevPhase = state.phase;
  // Pads and feathers have no haptic equivalent to piggyback on (only phase
  // transitions do, via prevPhase above), so their sound cues watch the same
  // core-computed fields directly: lockPad's -1-to-index rising edge is exactly
  // "just touched a pad" (run.js clears it back to -1 once Peep clears the
  // pad's own band), and a feathers increase is exactly "just earned some" —
  // true on both a grab and a pad bounce, so `feather()` is a chain-reward
  // ting layered on top of `flap()`/`bounce()`, not a replacement for them.
  let prevLockPad = state.lockPad;
  let prevFeathers = state.feathers;

  function frame(now) {
    if (stopped) return;
    let elapsed = (now - last) / 1000;
    last = now;
    // Clamp so a backgrounded tab cannot teleport Peep through the field.
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;

    const h = viewportPoints().h;
    let ticks = 0;
    while (acc >= FIXED_DT && ticks < MAX_TICKS && isLive(state.phase)) {
      acc -= FIXED_DT;
      ticks++;
      // Polled once per TICK, not once per frame: isPressed() consumes the press
      // latch, so a tap that came and went between frames still lands on exactly
      // one tick.
      const pressed = input.isPressed();
      // Note the EDGE, before stepping — `step` derives `tapped` the same way
      // (run.js) and then overwrites `wasPressed`, so asking afterwards would
      // record the wrong thing. A one-frame press per recorded frame reproduces
      // the identical edge sequence; see ghost.js's header.
      recorder.note(frameNo, pressed && !state.wasPressed);
      state = step(state, field, FIXED_DT, pressed, h, zones, tuning);
      frameNo++;
      if (state.chain > maxChain) maxChain = state.chain;

      // Stepped on the SAME tick with the SAME dt, so the two runs share a frame
      // index and the recording's frame numbers mean what they meant when it was
      // made. `step` returns its input unchanged once phase is 'dead' (run.js),
      // so a ghost that dies first simply stops moving. `frameNo - 1`: the
      // counter has already advanced past the frame just simulated, and the
      // ghost must be asked about THAT frame.
      if (ghostState && ghostPlayer) {
        ghostState = step(ghostState, field, FIXED_DT, ghostPlayer.pressedAt(frameNo - 1), h, zones, tuning);
      }

      if (state.phase === 'fly' && prevPhase === 'orbit') medium();
      if (state.phase === 'orbit' && prevPhase === 'fly') { tap(); flap(); grabs++; }
      prevPhase = state.phase;

      if (state.lockPad >= 0 && state.lockPad !== prevLockPad) bounce();
      prevLockPad = state.lockPad;

      if (state.feathers > prevFeathers) feather();
      prevFeathers = state.feathers;
    }
    if (ticks >= MAX_TICKS) acc = 0;

    syncProps(state.cameraY - CULL_BAND, state.cameraY + h + CULL_BAND);
    paint();

    if (!isLive(state.phase)) {
      stopped = true;
      // §12: collision · rigid. A fall is not a collision — it fires nothing, by
      // design. A win is not a collision either: `state.deathBy` is meaningless
      // once phase is 'won' (run.js) — gated on phase === 'dead' so a win can
      // never be misread as a truck hit and buzz rigid over what is meant to be
      // a triumph.
      if (state.phase === 'dead' && state.deathBy === 'truck') rigid();
      // thud() fires for ANY death (unlike rigid(), truck-only above) — a fall
      // and a truck hit both end the run the same unhappy way.
      if (state.phase === 'dead') thud();
      if (state.phase === 'won') fanfare();

      if (tutorial) {
        // Practice: no stats, feathers, ghost, best, daily, or achievements.
        if (grabs < GRAD_GRABS) {
          // Forgiveness: an early death restarts the guided run instead of a death screen.
          toastMessage('Let’s try that again');
          go('game', { tutorial: true });
        } else {
          // Graduated: they can do the loop. End practice and hand off to Home.
          markTutorialSeen();
          toastMessage('You’re ready — go for it!');
          go('home');
        }
        return;
      }

      const metres = scoreOf(state);
      // recordRun does setBest and addFeathers itself. Calling those here too
      // would credit the feathers twice — addFeathers is not idempotent.
      recordRun({
        metres,
        feathers: state.feathers,
        maxChain,
        // Absolute height again (see the biomeAtY call in paint()), so the
        // biome credited for achievements matches the one the field and the
        // live HUD actually showed, not a start-relative reading of it.
        biomeIndex: biomeIndexAtY(state.maxY),
        won: state.phase === 'won',
        // A daily run always carries a modifier, so a daily win is a "modded win"
        // for the Against the Odds achievement.
        daily,
      });

      // A race prize is EARNED feathers: it must count toward lifetime totals and
      // may itself cross a milestone, so it is credited here — before the
      // achievement and milestone checks below read getStats().
      const raceWon = ghost ? scoreOf(state) > ghost.metres : false;
      if (raceWon) earnFeathers(RACE.winReward);

      if (daily) {
        setDailyBest(day, metres);
        // The streak advances on a FINISHED daily run, not on opening the Daily
        // screen — the ladder pays for playing, not for looking. `advanceStreak`
        // is idempotent for the same day, so a second run today is free of charge
        // and costs nothing to call unconditionally here.
        setStreak(advanceStreak(getStreak(), day));
      } else if (metres > best || (!getGhost() && metres > 0)) {
        // Store the recording when the run is the new best — the ghost IS the best
        // run. `metres > best` is the same comparison the New Best screen makes
        // below, deliberately: the two must never disagree about which run was the
        // best one. The `!getGhost()` clause is a bootstrap: a player who has a best
        // from before ghosts existed (or whose ghost was cleared) would otherwise
        // never have anything to race until they beat that best — so any first real
        // run self-heals a missing ghost. Restricted to non-daily runs: a Ghost
        // carries no tuning, so only a baseTuning() run (never a modified daily one)
        // can ever be replayed back with the tuning it was recorded under.
        setGhost(recorder.finish(metres));
      }

      // Read stats back only AFTER recordRun has written them — an achievement is a
      // fact about the new totals, so asking any earlier tests the previous run.
      // Marking seen immediately (not when the toast finishes) keeps this correct
      // if the player leaves mid-animation: the toast is a courtesy, the record of
      // having earned it is not.
      const unlocked = pendingUnlocks(getStats(), getSeenAchievements());
      if (unlocked.length > 0) {
        markAchievementsSeen(unlocked.map((a) => a.key));
        for (const a of unlocked) toastAchievement(a.name);
      }

      // A milestone is the same kind of fact, about the same new totals, and marks
      // itself seen at grant time for the same reason (see checkMilestones). It only
      // QUEUES here: §05 sequences the score first, so the reward interstitials when
      // the player leaves the terminal screen, never on top of it.
      const rungs = checkMilestones(getStats());
      if (rungs.length > 0) queueReward(rungs[rungs.length - 1].grant);

      if (ghost) {
        // The race result owns a race's ending: New Best would be a strange
        // second screen arguing about the same run, and the record is kept
        // either way — recordRun ran above. Same shape as the spec's
        // won-over-best precedence: the larger event owns the screen. The
        // prize itself was already credited above, before the achievement and
        // milestone checks, so it is not paid again here.
        go('race', { result: { metres, ghostMetres: ghost.metres, won: raceWon } });
        return;
      }

      // endScreenOf, not a local ternary: a WIN takes precedence over a NEW BEST
      // (spec D4). The first escape is necessarily also a best, so both screens
      // would claim that run — the won screen wins, and the best is still
      // recorded above by recordRun. That rule fires once per player and lives in
      // core/ because it is untestable from here.
      go(endScreenOf(state, best), {
        score: metres,
        best: Math.max(best, metres),
        previousBest: best,
        feathers: state.feathers,
        deathBy: state.deathBy,
      });
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  syncProps(state.cameraY - CULL_BAND, state.cameraY + vp.h + CULL_BAND);
  paint();
  raf = requestAnimationFrame(frame);

  /** @type {any} */ (root).__dispose = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    input.dispose();
  };

  return root;
}
