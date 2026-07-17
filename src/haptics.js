// @ts-check
import { getSetting } from './storage.js';

/**
 * Doc §12's haptic vocabulary. `navigator.vibrate` is a no-op on iOS Safari
 * today, but this is the seam SwiftUI's UIFeedbackGenerator slots into during
 * the native port — so the call sites are correct now even where the effect is not.
 *
 * All gameplay stays understandable without haptics.
 *
 * The Haptics setting is checked HERE rather than at each call site, so every
 * export is gated by construction and a future haptic cannot forget to ask.
 * Read fresh each time rather than cached: a buzz fires on an attach or a
 * launch, never per frame, so a localStorage read costs nothing measurable —
 * and a cache would need an invalidation seam that could silently go stale
 * when the toggle flips.
 * @param {number|number[]} pattern
 */
function buzz(pattern) {
  try {
    if (!getSetting('haptics')) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Never let feedback break a frame.
  }
}

/** Successful attach — light. */
export const tap = () => buzz(8);

/** Strong launch — medium tick. */
export const medium = () => buzz(16);

/** New best / reward unlock — success. */
export const success = () => buzz([12, 40, 12]);

/** Collision — rigid. §12. Wired into the run-end path when deathBy === 'truck'. */
export const rigid = () => buzz([18, 24]);
