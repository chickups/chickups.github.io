// @ts-check

/**
 * mulberry32. Deterministic, seeded, 32-bit state.
 *
 * SWIFT PORT CONTRACT: this must transliterate exactly, using UInt32 and
 * overflow operators (&+, &*). The golden vector in rng.test.js locks the
 * sequence; the Swift implementation must reproduce it bit for bit.
 *
 * @param {number} seed
 * @returns {() => number} yields floats in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
