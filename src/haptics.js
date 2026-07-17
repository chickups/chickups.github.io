// @ts-check

/**
 * Doc §12's haptic vocabulary. `navigator.vibrate` is a no-op on iOS Safari
 * today, but this is the seam SwiftUI's UIFeedbackGenerator slots into during
 * the native port — so the call sites are correct now even where the effect is not.
 *
 * All gameplay stays understandable without haptics.
 * @param {number|number[]} pattern
 */
function buzz(pattern) {
  try {
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
