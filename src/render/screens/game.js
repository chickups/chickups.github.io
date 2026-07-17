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
import { makeZones, truckX } from '../../core/zones.js';
import { biomeAtY, biomeIndexAtY } from '../../core/biome.js';
import { createRun, step, scoreOf, radiusOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS, PROPS, HAZARD, ZONES } from '../../core/tokens.js';
import { modifierForDay, applyModifier, baseTuning } from '../../core/modifier.js';
import { makeInput } from '../../input.js';
import {
  getBest, recordRun, getEquippedOutfit, setDailyBest,
  getStats, getSeenAchievements, markAchievementsSeen, checkMilestones,
  getStreak, setStreak,
} from '../../storage.js';
import { pendingUnlocks } from '../../core/achievements.js';
import { toastAchievement } from '../toast.js';
import { queueReward } from './reward.js';
import { dayNumber, dailySeed } from '../../core/daily.js';
import { advanceStreak } from '../../core/streak.js';
import { viewportPoints } from '../../viewport.js';
import { tap, medium, rigid } from '../../haptics.js';

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
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const seed = daily ? dailySeed(day) : ((Date.now() >>> 0) || 1);
  // The route comes from the seed; the RULES come from the modifier. Two separate
  // jobs, deliberately: `dailySeed` identifies which route today is, and
  // `modifierForDay` picks which of the seven modifiers is applied to it. A plain
  // run gets `baseTuning()`, which is every token default — i.e. no change at all.
  const tuning = daily ? applyModifier(modifierForDay(day)) : baseTuning();
  const field = makeField(seed, tuning);
  const zones = makeZones(seed, field, tuning);
  let state = createRun(field, vp.h);

  const best = getBest();
  const outfit = getEquippedOutfit();
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
      (item) => hazardTruck(HAZARD.truckW, HAZARD.truckH, item.truck.dir),
    );
  }

  // --- painting --------------------------------------------------------
  let pose = 'run';

  function paint() {
    const h = viewportPoints().h;
    world.style.transform = `translateY(${px(h + state.cameraY)})`;

    // Trucks are the only world object that moves. Their x is recomputed from
    // truckX(truck, t) rather than integrated, which is exactly what lets a
    // ghost replay reproduce them from the run clock alone.
    for (const { index, truck } of liveTrucks) {
      const node = truckEls.get(index);
      if (node) node.style.left = px(truckX(truck, state.t) - HAZARD.truckW / 2);
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

    let tip = '';
    if (!state.everLaunched) tip = TIP_TAP;
    else if (!state.everGrabbed) tip = TIP_LAND;

    // biomeAtY, not biomeAt(scoreOf(state)): the field generator (field.js/zones.js)
    // always keys a prop's biome off ABSOLUTE world height. scoreOf is climbed
    // distance from state.startY (a different zero point, offset by the orbit
    // radius) — feeding that into biomeAt disagreed with what the field actually
    // built near every boundary. See final-fixes report #5.
    const biome = biomeAtY(state.maxY);
    bg.setSky(biome.key);
    hud.update(scoreOf(state), state.mult, tip, biome.key);
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

  function frame(now) {
    if (stopped) return;
    let elapsed = (now - last) / 1000;
    last = now;
    // Clamp so a backgrounded tab cannot teleport Peep through the field.
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;

    const h = viewportPoints().h;
    let ticks = 0;
    while (acc >= FIXED_DT && ticks < MAX_TICKS && state.phase !== 'dead') {
      acc -= FIXED_DT;
      ticks++;
      // Polled once per TICK, not once per frame: isPressed() consumes the press
      // latch, so a tap that came and went between frames still lands on exactly
      // one tick.
      state = step(state, field, FIXED_DT, input.isPressed(), h, zones, tuning);
      if (state.chain > maxChain) maxChain = state.chain;

      if (state.phase === 'fly' && prevPhase === 'orbit') medium();
      if (state.phase === 'orbit' && prevPhase === 'fly') tap();
      prevPhase = state.phase;
    }
    if (ticks >= MAX_TICKS) acc = 0;

    syncProps(state.cameraY - CULL_BAND, state.cameraY + h + CULL_BAND);
    paint();

    if (state.phase === 'dead') {
      stopped = true;
      // §12: collision · rigid. A fall is not a collision — it fires nothing, by design.
      if (state.deathBy === 'truck') rigid();
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
      });
      if (daily) {
        setDailyBest(day, metres);
        // The streak advances on a FINISHED daily run, not on opening the Daily
        // screen — the ladder pays for playing, not for looking. `advanceStreak`
        // is idempotent for the same day, so a second run today is free of charge
        // and costs nothing to call unconditionally here.
        setStreak(advanceStreak(getStreak(), day));
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

      const isBest = metres > best;
      go(isBest ? 'best' : 'oops', {
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
