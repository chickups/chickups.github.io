// @ts-check
import { makeRng } from './rng.js';
import { FIELD } from './tokens.js';

/** @typedef {{x:number, y:number}} Wheel */
/** @typedef {{wheelAt:(index:number)=>Wheel, wheelsInRange:(minY:number,maxY:number)=>{index:number,wheel:Wheel}[]}} Field */

/**
 * An infinite, lazily generated, fully deterministic stream of wheels.
 *
 * Wheels are always materialised in index order because each gap depends on the
 * previous wheel's height and each x consumes exactly one PRNG draw. Memoising
 * keeps this cheap; the field is therefore lazy AND access-order independent.
 *
 * @param {number} seed
 * @returns {Field}
 */
export function makeField(seed) {
  const rng = makeRng(seed);
  /** @type {Wheel[]} */
  const cache = [];

  /**
   * @param {number} index
   * @returns {Wheel}
   */
  function wheelAt(index) {
    while (cache.length <= index) {
      const i = cache.length;
      let y = 0;
      if (i > 0) {
        const prev = cache[i - 1];
        const gap = Math.min(FIELD.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
        y = prev.y + gap;
      }
      const col = FIELD.columns[i % FIELD.columns.length];
      const x = col + (rng() * 2 - 1) * FIELD.jitter;
      cache.push({ x, y });
    }
    return cache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {{index:number, wheel:Wheel}[]}
   */
  function wheelsInRange(minY, maxY) {
    /** @type {{index:number, wheel:Wheel}[]} */
    const out = [];
    for (let i = 0; ; i++) {
      const wheel = wheelAt(i);
      if (wheel.y > maxY) break;
      if (wheel.y >= minY) out.push({ index: i, wheel });
    }
    return out;
  }

  return { wheelAt, wheelsInRange };
}
