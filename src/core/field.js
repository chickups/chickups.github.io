// @ts-check
import { makeRng } from './rng.js';
import { FIELD, PROPS } from './tokens.js';
import { biomeAtY } from './biome.js';
import { baseTuning } from './modifier.js';

/** @typedef {{x:number, y:number}} Wheel */
/** @typedef {{x:number, y:number, kind:'tire'|'gear'}} Prop */
/** @typedef {{x:number, y:number}} Pad */
/**
 * @typedef {{
 *   propAt:(index:number)=>Prop,
 *   propsInRange:(minY:number,maxY:number)=>{index:number,prop:Prop}[],
 *   padAt:(index:number)=>(Pad|null),
 *   padsInRange:(minY:number,maxY:number)=>{index:number,pad:Pad}[],
 *   wheelAt:(index:number)=>Wheel,
 *   wheelsInRange:(minY:number,maxY:number)=>{index:number,wheel:Wheel}[],
 * }} Field
 */

/**
 * An infinite, lazily generated, fully deterministic stream of typed props
 * (tire/gear), chosen per-index by the biome active at that prop's height.
 *
 * `kinds` is ATTACHABLE-ONLY — this is the climbing ladder's rungs. Props are always
 * materialised in index order because each gap depends on the previous prop's height
 * and each index consumes exactly two PRNG draws, in a fixed order: x-jitter first,
 * then kind. Memoising keeps this cheap; the field is therefore lazy AND access-order
 * independent.
 *
 * Bounce pads are a SEPARATE, optional stream (see `padAt`/`padsInRange` below) — they
 * are never a spine prop and never occupy a spine index. See biome.js for why.
 *
 * `wheelAt`/`wheelsInRange` are thin aliases of `propAt`/`propsInRange` kept for
 * slice-1 call sites; they return the very same objects.
 *
 * @param {number} seed
 * @param {import('./modifier.js').RunTuning} [tuning] Daily Run modifiers. The spine
 *   reads `tuning.gapMax` and `tuning.gearWeightBoost` INSTEAD of `FIELD.gapMax` and a
 *   biome's raw gear weight — those are the only two knobs a modifier moves here.
 *   Omitted, it is a plain unmodified run.
 * @returns {Field}
 */
export function makeField(seed, tuning = baseTuning()) {
  const rng = makeRng(seed);
  /** @type {Prop[]} */
  const cache = [];

  /**
   * A second, independent PRNG for the pad stream, derived from the same seed by
   * XOR-ing with a fixed odd constant. This is the whole point of the split: adding,
   * removing, or reweighting pads must never disturb the spine's own draw sequence,
   * and vice versa. Two RNGs seeded from the same integer but mixed differently give
   * two decorrelated streams from one run seed.
   */
  const padRng = makeRng((seed ^ 0x85ebca6b) >>> 0);
  /** @type {(Pad|null)[]} */
  const padCache = [];

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
        // tuning.gapMax, not FIELD.gapMax: Thin Air widens the ceiling 200 -> 230.
        // The test in modifier.test.js guarantees no modifier can push this past
        // what a launch can actually climb.
        const gap = Math.min(tuning.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
        y = prev.y + gap;
      }
      const col = FIELD.columns[i % FIELD.columns.length];
      // x-jitter draw first, then kind draw — always exactly one of each, in
      // this order, regardless of biome. Reordering or skipping a draw would
      // make the PRNG sequence depend on the biome table.
      const x = col + (rng() * 2 - 1) * FIELD.jitter;
      const biome = biomeAtY(y);
      const kind = pickKind(biome, rng, tuning.gearWeightBoost);
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

  /**
   * Pad `index` belongs to the gap between spine props `index` and `index+1`. It
   * exists only if that gap's biome (the one active at spine prop `index`'s own
   * height, same convention the spine itself uses) has `padChance > 0` and the draw
   * succeeds; otherwise this index has no pad, and `null` is memoised for it.
   *
   * Consumes exactly THREE draws per index, always, whether or not a pad results:
   * chance, then x-jitter, then y-jitter. A draw count that depends on the outcome
   * would make every later pad's position depend on earlier ones' luck — the same
   * determinism hole the spine avoids by always drawing kind unconditionally.
   *
   * @param {number} index
   * @returns {Pad|null}
   */
  function padAt(index) {
    while (padCache.length <= index) {
      const i = padCache.length;
      const propI = propAt(i);
      const propNext = propAt(i + 1);
      const biome = biomeAtY(propI.y);
      const chanceDraw = padRng();
      const xDraw = padRng();
      const yDraw = padRng();
      let pad = null;
      if (biome.padChance > 0 && chanceDraw < biome.padChance) {
        const midY = (propI.y + propNext.y) / 2;
        const midX = (propI.x + propNext.x) / 2;
        pad = {
          x: midX + (xDraw * 2 - 1) * PROPS.padXJitter,
          y: midY + (yDraw * 2 - 1) * PROPS.padYJitter,
        };
      }
      padCache.push(pad);
    }
    return padCache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {{index:number, pad:Pad}[]}
   */
  function padsInRange(minY, maxY) {
    /** @type {{index:number, pad:Pad}[]} */
    const out = [];
    // Walk from index 0, same pattern as propsInRange: cheap once memoised, and
    // access-order independent. Break once the GAP'S OWN spine prop is past maxY —
    // a pad's y is always >= its gap's starting prop's y (jitter is far smaller
    // than half the minimum gap), so no in-range pad can appear after that.
    for (let i = 0; ; i++) {
      const propI = propAt(i);
      if (propI.y > maxY) break;
      const pad = padAt(i);
      if (pad && pad.y >= minY && pad.y <= maxY) out.push({ index: i, pad });
    }
    return out;
  }

  return {
    propAt,
    propsInRange,
    padAt,
    padsInRange,
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
 * @param {number} gearWeightBoost multiplies the `gear` weight (Slick Gears). 1 = untouched.
 *   Re-weighting changes WHICH kind a given draw selects; it never changes how MANY
 *   draws happen, so a boosted field has the same props in the same places, just more
 *   of them gears. Spec D2: this is how often a gear spawns, NEVER how fast it spins.
 * @returns {'tire'|'gear'}
 */
function pickKind(biome, rng, gearWeightBoost = 1) {
  // Walk `biome.kinds` (an ordered array of [kind, weight] pairs — see biome.js
  // for why it must not be a Record) in its own declared order. That order is
  // part of the deterministic output for a seed, exactly like everything else
  // in this file. `.map` preserves it.
  const weights = biome.kinds.map(
    ([k, w]) => /** @type {readonly [string, number]} */ ([k, k === 'gear' ? w * gearWeightBoost : w]),
  );
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [k, w] of weights) {
    r -= w;
    if (r < 0) return /** @type {'tire'|'gear'} */ (k);
  }
  return /** @type {'tire'|'gear'} */ (weights[weights.length - 1][0]);
}
