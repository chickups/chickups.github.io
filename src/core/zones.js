// @ts-check
import { makeRng } from './rng.js';
import { ZONES, HAZARD, SCORING, DESIGN } from './tokens.js';
import { biomeAt } from './biome.js';

/** @typedef {{x:number, y:number, w:number, h:number}} Updraft */
/** @typedef {{y:number, dir:1|-1, speed:number, phase:number}} Truck */
/**
 * @typedef {{
 *   updraftsInRange:(minY:number,maxY:number)=>Updraft[],
 *   trucksInRange:(minY:number,maxY:number)=>Truck[],
 * }} Zones
 */

/**
 * Two more deterministic streams layered on top of the run seed, each with
 * its OWN PRNG (mixed with a fixed constant, never the pad's or each other's)
 * so that adding, removing, or retuning zones can never disturb the spine or
 * pad draw sequences, or each other's. See field.js's pad stream for the
 * pattern this copies.
 *
 * Both streams are candidate-position streams, exactly like the pad stream:
 * a candidate slot exists at every index regardless of biome, spaced by
 * `updraftEvery`/`truckEvery` (with jitter), and consumes a FIXED number of
 * draws per index always — whether or not the biome at that height actually
 * allows the thing to spawn. A draw count that depends on the outcome would
 * make every later slot's position depend on earlier ones' luck.
 *
 * @param {number} seed
 * @returns {Zones}
 */
export function makeZones(seed) {
  // Different constants from field.js's pad stream (0x85ebca6b) and from each
  // other, so none of these four streams (spine, pads, updrafts, trucks) can
  // ever become correlated.
  const updraftRng = makeRng((seed ^ 0xc2b2ae35) >>> 0);
  const truckRng = makeRng((seed ^ 0x27d4eb2f) >>> 0);

  /** @type {(Updraft|null)[]} */
  const updraftCache = [];
  /** candidate y per index, tracked even for indices that spawned nothing */
  /** @type {number[]} */
  const updraftY = [];

  /** @type {(Truck|null)[]} */
  const truckCache = [];
  /** @type {number[]} */
  const truckY = [];

  /**
   * @param {number} index
   * @returns {Updraft|null}
   */
  function updraftAt(index) {
    while (updraftCache.length <= index) {
      const i = updraftCache.length;
      const prevY = i === 0 ? 0 : updraftY[i - 1];
      // Two draws, always, in this order: spacing jitter, then x position.
      const spacingDraw = updraftRng();
      const xDraw = updraftRng();
      const y = prevY + ZONES.updraftEvery * (0.75 + 0.5 * spacingDraw);
      updraftY.push(y);
      const biome = biomeAt(y / SCORING.pointsPerMetre);
      let zone = null;
      if (biome.key === 'ridge' || biome.key === 'escape') {
        const x = ZONES.updraftW / 2 + xDraw * (DESIGN.width - ZONES.updraftW);
        zone = { x, y, w: ZONES.updraftW, h: ZONES.updraftH };
      }
      updraftCache.push(zone);
    }
    return updraftCache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {Updraft[]}
   */
  function updraftsInRange(minY, maxY) {
    /** @type {Updraft[]} */
    const out = [];
    for (let i = 0; ; i++) {
      updraftAt(i);
      const y = updraftY[i];
      if (y > maxY) break;
      const zone = updraftCache[i];
      if (zone && y >= minY) out.push(zone);
    }
    return out;
  }

  /**
   * @param {number} index
   * @returns {Truck|null}
   */
  function truckAt(index) {
    while (truckCache.length <= index) {
      const i = truckCache.length;
      const prevY = i === 0 ? 0 : truckY[i - 1];
      // Three draws, always, in this order: spacing jitter, direction, phase.
      const spacingDraw = truckRng();
      const dirDraw = truckRng();
      const phaseDraw = truckRng();
      const y = prevY + HAZARD.truckEvery * (0.75 + 0.5 * spacingDraw);
      truckY.push(y);
      const biome = biomeAt(y / SCORING.pointsPerMetre);
      let truck = null;
      if (biome.trucks) {
        const dir = /** @type {1|-1} */ (dirDraw < 0.5 ? -1 : 1);
        // Starting offset within the wrap span (see truckX), so trucks born
        // at different indices are not phase-locked to each other.
        const span = DESIGN.width + HAZARD.truckW;
        const phase = phaseDraw * span;
        truck = { y, dir, speed: HAZARD.truckSpeed, phase };
      }
      truckCache.push(truck);
    }
    return truckCache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {Truck[]}
   */
  function trucksInRange(minY, maxY) {
    /** @type {Truck[]} */
    const out = [];
    for (let i = 0; ; i++) {
      truckAt(i);
      const y = truckY[i];
      if (y > maxY) break;
      const truck = truckCache[i];
      if (truck && y >= minY) out.push(truck);
    }
    return out;
  }

  return { updraftsInRange, trucksInRange };
}

/**
 * A truck's x position at run-time `t`, in seconds since the run began.
 *
 * PURE — a closed form of `(truck, t)` only, never integrated frame by
 * frame. This is load-bearing: a ghost replay (a later task) reproduces
 * truck positions purely from the run clock, and an integrated position
 * could never be replayed exactly.
 *
 * The truck travels at constant `speed` in direction `dir`, wrapping inside
 * a span one truck-width wider than the field on each side (`DESIGN.width +
 * HAZARD.truckW`), so it fully clears the field before reappearing on the
 * other edge rather than popping in/out at the boundary.
 *
 * @param {Truck} truck
 * @param {number} t seconds since the run began
 * @returns {number} world x of the truck's centre
 */
export function truckX(truck, t) {
  const span = DESIGN.width + HAZARD.truckW;
  const half = HAZARD.truckW / 2;
  const raw = truck.phase + truck.dir * truck.speed * t;
  // Wrap into [-half, span - half), i.e. the truck's centre ranges from just
  // off the left edge to just off the right edge.
  return (((raw + half) % span) + span) % span - half;
}
