// @ts-check
import { DESIGN } from './core/tokens.js';

/**
 * The scale that maps one design point to one CSS pixel.
 *
 * Bounded by BOTH axes, which is the whole point. Scaling on width alone
 * (`w / DESIGN.width`) lets the design HEIGHT float free — and it collapses:
 * a 2560px-wide desktop gives s = 6.5, so `h / s` is about 220 design points
 * and every screen's bottom-anchored content lands on top of its top-anchored
 * content. The same effect in miniature made the celebrating Peep sit on the
 * Go Again button on a 375x667 iPhone SE (699pt tall).
 *
 * Taking the min against `h / DESIGN.refHeight` makes the design space exactly
 * 393x852 everywhere: whichever axis runs out first sets the scale, and the
 * other axis gets a letterbox bar (the body's background shows through). A
 * screen wider than 393:852 gets side bars; a narrower one gets top/bottom bars.
 *
 * @param {number} w window.innerWidth
 * @param {number} h window.innerHeight
 * @returns {number}
 */
function scaleFor(w, h) {
  return Math.min(w / DESIGN.width, h / DESIGN.refHeight);
}

/**
 * The viewport in design points. A CONSTANT: the design space is exactly
 * DESIGN.width x DESIGN.refHeight on every device, and anything left over is a
 * letterbox bar, not extra play area.
 *
 * This is what makes a run device-independent, which it never was before.
 * `viewportH` feeds the camera (`CAMERA.peepAnchor` is a fraction of it), so a
 * height that varied per device meant a taller phone literally saw more field
 * for the same seed — the same route was a different game, and a ghost recorded
 * on one device could desync on another. Both are now impossible by
 * construction.
 *
 * The cost, chosen deliberately: a device whose aspect is not 393:852 shows
 * bars rather than filling its screen. Do NOT "reclaim" them by letting height
 * float again — that silently re-breaks determinism, and the break is invisible
 * until two different phones disagree about a ghost.
 * @returns {{w:number, h:number}}
 */
export function viewportPoints() {
  return { w: DESIGN.width, h: DESIGN.refHeight };
}

/**
 * Scale the stage to fit and centre it on both axes, letterboxing whatever the
 * device's aspect leaves over.
 *
 * The stage keeps `transform-origin: top left`, so centring cannot go through
 * `translate(-50%, -50%)` — that would resolve against the element's own
 * UNSCALED 393x852 box and be wrong at every scale but 1. The offsets are
 * computed here against the scaled size instead.
 * @param {HTMLElement} stage
 */
export function installViewport(stage) {
  const apply = () => {
    const s = scaleFor(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--s', String(s));
    stage.style.height = `${DESIGN.refHeight}px`;
    stage.style.left = `${(window.innerWidth - DESIGN.width * s) / 2}px`;
    stage.style.top = `${(window.innerHeight - DESIGN.refHeight * s) / 2}px`;
  };
  window.addEventListener('resize', apply);
  apply();
}
