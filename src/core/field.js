// @ts-check
import { makeRng } from './rng.js';
import { FIELD, SCORING } from './tokens.js';
import { biomeAt } from './biome.js';

/** @typedef {{x:number, y:number}} Wheel */
/** @typedef {{x:number, y:number, kind:'tire'|'gear'|'pad'}} Prop */
/**
 * @typedef {{
 *   propAt:(index:number)=>Prop,
 *   propsInRange:(minY:number,maxY:number)=>{index:number,prop:Prop}[],
 *   wheelAt:(index:number)=>Wheel,
 *   wheelsInRange:(minY:number,maxY:number)=>{index:number,wheel:Wheel}[],
 * }} Field
 */

/**
 * An infinite, lazily generated, fully deterministic stream of typed props
 * (tire/gear/pad), chosen per-index by the biome active at that prop's height.
 *
 * Props are always materialised in index order because each gap depends on the
 * previous prop's height and each index consumes exactly two PRNG draws, in a
 * fixed order: x-jitter first, then kind. Memoising keeps this cheap; the field
 * is therefore lazy AND access-order independent.
 *
 * `wheelAt`/`wheelsInRange` are thin aliases of `propAt`/`propsInRange` kept for
 * slice-1 call sites; they return the very same objects.
 *
 * @param {number} seed
 * @returns {Field}
 */
export function makeField(seed) {
  const rng = makeRng(seed);
  /** @type {Prop[]} */
  const cache = [];

  /**
   * @param {number} index
   * @returns {Prop}
   */
  function propAt(index) {
    while (cache.length <= index) {
      const i = cache.length;
      let y = 0;
      if (i > 0) {
        const prev = cache[i - 1];
        const gap = Math.min(FIELD.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
        y = prev.y + gap;
      }
      const col = FIELD.columns[i % FIELD.columns.length];
      // x-jitter draw first, then kind draw — always exactly one of each, in
      // this order, regardless of biome. Reordering or skipping a draw would
      // make the PRNG sequence depend on the biome table.
      const x = col + (rng() * 2 - 1) * FIELD.jitter;
      const biome = biomeAt(y / SCORING.pointsPerMetre);
      let kind = pickKind(biome, rng);
      // Invariant: a pad is never followed by another pad. Two-plus pads in a
      // row leave the player with zero horizontal control (a pad preserves vx
      // and grants no tap), which can be an unwinnable death sentence. The
      // draw above is always consumed first — this only overrides the result,
      // exactly like the index-0-is-always-tire rule below, so the PRNG
      // sequence stays independent of this rule.
      if (i > 0 && cache[i - 1].kind === 'pad' && kind === 'pad') {
        kind = attachableKind(biome);
      }
      cache.push({ x, y, kind: i === 0 ? 'tire' : kind });
    }
    return cache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {{index:number, prop:Prop}[]}
   */
  function propsInRange(minY, maxY) {
    /** @type {{index:number, prop:Prop}[]} */
    const out = [];
    for (let i = 0; ; i++) {
      const prop = propAt(i);
      if (prop.y > maxY) break;
      if (prop.y >= minY) out.push({ index: i, prop });
    }
    return out;
  }

  return {
    propAt,
    propsInRange,
    wheelAt: propAt,
    wheelsInRange: (minY, maxY) =>
      propsInRange(minY, maxY).map(({ index, prop }) => ({ index, wheel: prop })),
  };
}

/**
 * Weighted pick of a prop kind from a biome's `kinds` table. Always consumes
 * exactly one PRNG draw, even when the biome names only one kind — the draw
 * must not depend on the shape of the table, or editing it would silently
 * shift every later prop's PRNG sequence.
 *
 * @param {import('./biome.js').Biome} biome
 * @param {() => number} rng
 * @returns {'tire'|'gear'|'pad'}
 */
function pickKind(biome, rng) {
  const keys = Object.keys(biome.kinds);
  const total = keys.reduce((sum, k) => sum + biome.kinds[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= biome.kinds[k];
    if (r < 0) return /** @type {'tire'|'gear'|'pad'} */ (k);
  }
  return /** @type {'tire'|'gear'|'pad'} */ (keys[keys.length - 1]);
}

/**
 * The attachable kind (tire preferred, else gear) a biome falls back to when
 * the "no two pads in a row" invariant forces a re-pick. Every biome that
 * names `pad` also names `tire`, so this always resolves within that biome's
 * own kind table — the forced prop is still one the biome allows.
 *
 * @param {import('./biome.js').Biome} biome
 * @returns {'tire'|'gear'}
 */
function attachableKind(biome) {
  if (biome.kinds.tire) return 'tire';
  if (biome.kinds.gear) return 'gear';
  return 'tire';
}
