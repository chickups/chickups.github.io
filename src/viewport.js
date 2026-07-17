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
 * Taking the min against `h / DESIGN.refHeight` floors the design height at
 * refHeight on every device, and letterboxes horizontally instead. Taller
 * phones still see more sky (h stays > refHeight when the screen is narrower
 * than the design aspect) — only screens that are WIDER than 393:852 get bars.
 *
 * @param {number} w window.innerWidth
 * @param {number} h window.innerHeight
 * @returns {number}
 */
function scaleFor(w, h) {
  return Math.min(w / DESIGN.width, h / DESIGN.refHeight);
}

/**
 * The viewport in design points. Width is always DESIGN.width; height is at
 * least DESIGN.refHeight and grows on phones narrower than the design aspect,
 * so taller phones see more sky.
 *
 * Because height can no longer fall below refHeight, this is also what makes a
 * run device-independent: `viewportH` feeds the camera, so a floating height
 * meant a taller phone literally saw more field for the same seed — and a
 * ghost recorded on one device could desync on another.
 * @returns {{w:number, h:number}}
 */
export function viewportPoints() {
  const s = scaleFor(window.innerWidth, window.innerHeight);
  return { w: DESIGN.width, h: window.innerHeight / s };
}

/**
 * Scale the stage to fit, and centre it horizontally when the screen is wider
 * than the scaled design width (desktop, landscape, short phones).
 *
 * The stage keeps `transform-origin: top left`, so centring cannot go through
 * `translateX(-50%)` — that would resolve against the element's own unscaled
 * 393px and be wrong at every scale but 1. The offset is computed here instead.
 * @param {HTMLElement} stage
 */
export function installViewport(stage) {
  const apply = () => {
    const s = scaleFor(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--s', String(s));
    stage.style.height = `${window.innerHeight / s}px`;
    stage.style.left = `${Math.max(0, (window.innerWidth - DESIGN.width * s) / 2)}px`;
  };
  window.addEventListener('resize', apply);
  apply();
}
