// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gear } from '../art/gear.js';
import { pad } from '../art/pad.js';
import { gamebg } from '../art/gamebg.js';
import { makeHud } from '../hud.js';
import { makeField } from '../../core/field.js';
import { createRun, step, scoreOf, radiusOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS, PROPS } from '../../core/tokens.js';
import { makeInput } from '../../input.js';
import { getBest, setBest, addFeathers } from '../../storage.js';
import { viewportPoints } from '../../viewport.js';
import { tap, medium } from '../../haptics.js';

const DEG = 180 / Math.PI;

/** How far beyond the viewport a prop is kept alive. Sized to the LARGEST prop —
 *  a gear is wider than a tire, so a tire-sized band pops gears in at the edge. */
const CULL_BAND = Math.max(radiusOf('gear'), PROPS.padRadius) + PHYSICS.grabTolerance;

/** Tip copy, verbatim from doc §04. */
const TIP_TAP = 'Tap to launch!';
const TIP_LAND = 'Land on a tire to keep climbing';

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function gameScreen(go) {
  const vp = viewportPoints();
  // Seeding from the clock lives in render/, never in core/.
  const seed = (Date.now() >>> 0) || 1;
  const field = makeField(seed);
  let state = createRun(field, vp.h);

  const best = getBest();

  // --- world container -------------------------------------------------
  const world = el('div', { position: 'absolute', inset: '0px', willChange: 'transform' });

  const peepEl = el('div', {
    position: 'absolute', left: '0px', top: '0px',
    width: px(PHYSICS.peepSize), height: px(PHYSICS.peepSize),
    zIndex: '6', willChange: 'transform',
  }, peep(PHYSICS.peepSize, 'run', 'none', false));

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
  const root = el('div', { position: 'absolute', inset: '0px', cursor: 'pointer' },
    gamebg(world), hud.root);

  // --- prop pooling ----------------------------------------------------
  /**
   * Pool one stream of world objects: add what entered view, drop what left.
   * A run is unbounded, so nothing may ever accumulate.
   * @param {Map<number, HTMLElement>} pool
   * @param {{index:number, at:{x:number,y:number}, size:number}[]} items
   * @param {(item:{index:number, at:{x:number,y:number}, size:number}) => HTMLElement} build
   */
  function sync(pool, items, build) {
    const live = new Set();
    for (const item of items) {
      live.add(item.index);
      if (!pool.has(item.index)) {
        const node = el('div', {
          position: 'absolute',
          left: px(item.at.x - item.size / 2),
          top: px(-item.at.y - item.size / 2),
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

  /**
   * @param {number} lo world y
   * @param {number} hi world y
   */
  function syncProps(lo, hi) {
    sync(
      propEls,
      field.propsInRange(lo, hi).map(({ index, prop }) => ({
        index,
        at: prop,
        // A gear is a bigger wheel, and the core already knows by how much —
        // read it rather than restating the scale here, or the art and the
        // collision radius drift apart.
        size: radiusOf(prop.kind) * 2,
        kind: prop.kind,
      })),
      (item) => (/** @type {any} */ (item).kind === 'gear'
        ? gear(item.size)
        : tire(item.size, 4)),
    );
    sync(
      padEls,
      field.padsInRange(lo, hi).map(({ index, pad: p }) => ({
        index,
        at: p,
        size: PROPS.padRadius * 2,
      })),
      (item) => pad(item.size),
    );
  }

  // --- painting --------------------------------------------------------
  let pose = 'run';

  function paint() {
    const h = viewportPoints().h;
    world.style.transform = `translateY(${px(h + state.cameraY)})`;

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
      peepEl.replaceChildren(peep(PHYSICS.peepSize, /** @type {any} */ (pose), 'none', false));
    }
    peepEl.style.transform =
      `translate(${px(state.x - PHYSICS.peepSize / 2)},${px(-state.y - PHYSICS.peepSize / 2)}) rotate(${rotation}deg)`;

    let tip = '';
    if (!state.everLaunched) tip = TIP_TAP;
    else if (!state.everGrabbed) tip = TIP_LAND;
    hud.update(scoreOf(state), state.mult, tip);
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
      state = step(state, field, FIXED_DT, input.isPressed(), h);

      if (state.phase === 'fly' && prevPhase === 'orbit') medium();
      if (state.phase === 'orbit' && prevPhase === 'fly') tap();
      prevPhase = state.phase;
    }
    if (ticks >= MAX_TICKS) acc = 0;

    syncProps(state.cameraY - CULL_BAND, state.cameraY + h + CULL_BAND);
    paint();

    if (state.phase === 'dead') {
      stopped = true;
      const metres = scoreOf(state);
      addFeathers(state.feathers);
      const isBest = metres > best;
      if (isBest) setBest(metres);
      go(isBest ? 'best' : 'oops', {
        score: metres,
        best: Math.max(best, metres),
        previousBest: best,
        feathers: state.feathers,
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
