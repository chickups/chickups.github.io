// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gamebg } from '../art/gamebg.js';
import { makeHud } from '../hud.js';
import { makeField } from '../../core/field.js';
import { createRun, step, scoreOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS } from '../../core/tokens.js';
import { makeInput } from '../../input.js';
import { getBest, setBest, addFeathers } from '../../storage.js';
import { viewportPoints } from '../../viewport.js';

const WHEEL_SIZE = PHYSICS.orbitRadius * 2;
const DEG = 180 / Math.PI;

/** Tip copy, verbatim from doc §04. */
const TIP_HOLD = 'Hold to run around';
const TIP_RELEASE = 'Release to launch → keep moving up!';

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

  // --- wheel pooling ---------------------------------------------------
  /** @type {Map<number, HTMLElement>} */
  const wheelEls = new Map();

  /**
   * Add wheels entering the view, drop those that have left. A run is
   * unbounded, so nothing may accumulate.
   * @param {number} lo world y
   * @param {number} hi world y
   */
  function syncWheels(lo, hi) {
    const live = new Set();
    for (const { index, wheel } of field.wheelsInRange(lo, hi)) {
      live.add(index);
      if (!wheelEls.has(index)) {
        const node = el(
          'div',
          {
            position: 'absolute',
            left: px(wheel.x - WHEEL_SIZE / 2),
            top: px(-wheel.y - WHEEL_SIZE / 2),
          },
          tire(WHEEL_SIZE, 4),
        );
        world.insertBefore(node, peepEl);
        wheelEls.set(index, node);
      }
    }
    for (const [index, node] of wheelEls) {
      if (!live.has(index)) {
        node.remove();
        wheelEls.delete(index);
      }
    }
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
    if (!state.everHeld) tip = TIP_HOLD;
    else if (!state.everGrabbed && state.everLaunched) tip = TIP_RELEASE;
    hud.update(scoreOf(state), state.mult, tip);
  }

  // --- loop ------------------------------------------------------------
  const input = makeInput(root);
  let raf = 0;
  let last = performance.now();
  let stopped = false;

  function frame(now) {
    if (stopped) return;
    let dt = (now - last) / 1000;
    last = now;
    // Clamp so a backgrounded tab cannot teleport Peep through the field.
    if (dt > 0.05) dt = 0.05;

    const h = viewportPoints().h;
    state = step(state, field, dt, input.isHolding(), h);

    const band = PHYSICS.orbitRadius + PHYSICS.grabTolerance;
    syncWheels(state.cameraY - band, state.cameraY + h + band);
    paint();

    if (state.phase === 'dead') {
      stopped = true;
      const metres = scoreOf(state);
      addFeathers(state.feathers);
      const isBest = metres > best;
      if (isBest) setBest(metres);
      go(isBest ? 'best' : 'oops', { score: metres, best: Math.max(best, metres), feathers: state.feathers });
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  syncWheels(state.cameraY - 200, state.cameraY + vp.h + 200);
  paint();
  raf = requestAnimationFrame(frame);

  /** @type {any} */ (root).__dispose = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    input.dispose();
  };

  return root;
}
