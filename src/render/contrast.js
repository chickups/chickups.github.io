// @ts-check

/**
 * High Contrast (doc §07), the one setting that reaches into `render/art/*`.
 *
 * The mechanism is a single `data-hc` attribute on the document element, which
 * CSS in `styles.js` keys off. That is deliberate: the art modules build their
 * visuals with INLINE styles, and a stylesheet cannot override an inline style
 * without `!important` on every property — so a per-element CSS rework would mean
 * touching every art file for every colour. One attribute plus a filter on the
 * stage does the broad work; art that is genuinely load-bearing for safety (the
 * hazard truck) reads the flag and draws itself differently.
 *
 * Render-only. `core/` may never import this: it touches `document`, and the four
 * insurance greps enforce that.
 */

/** @returns {boolean} */
export function isHighContrast() {
  return document.documentElement.dataset.hc === '1';
}

/**
 * Turn the effect on or off, immediately. Idempotent.
 * @param {boolean} on
 */
export function applyContrast(on) {
  if (on) document.documentElement.dataset.hc = '1';
  else delete document.documentElement.dataset.hc;
}
