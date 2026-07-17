// @ts-check
import { makeRng } from './rng.js';
import { ZONES, HAZARD, DESIGN } from './tokens.js';
import { biomeAtY } from './biome.js';

/** @typedef {import('./field.js').Field} Field */
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
 * The truck stream additionally needs `field` — trucks must never spawn with a
 * lane crossing an attachable prop's orbit ring (`HAZARD.truckPropClearance`;
 * see `findSafeTruckY` below), and only the field knows where the props are.
 * Reading `field.propAt` is safe here (via a local sliding window, see
 * `propWindow` below — a performance cache only, not a determinism concern):
 * it is memoised and always materialises in index order regardless of query
 * order (field.js's own access-order-independence contract), and the range
 * queried is a deterministic function of the truck stream's OWN candidate
 * height, never of anything the field materialisation could feed back into.
 * It may materialise spine props further ahead than the caller has otherwise
 * asked for, but never fewer, and never in a different order — so it cannot
 * perturb the spine's sequence.
 *
 * @param {number} seed
 * @param {Field} field the SAME field the run is using, for truck safety checks
 * @returns {Zones}
 */
export function makeZones(seed, field) {
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
   * A sliding window over `field`'s prop stream, for `findSafeTruckY` below.
   * `field.propsInRange` always rescans from index 0 (field.js's own
   * contract only promises memoised, access-order-independent MATERIALISATION,
   * not an indexed lookup), so calling it once per truck candidate at
   * ever-increasing heights is O(n^2) over a long climb. Truck candidate
   * heights are strictly increasing (each is `prevY + a positive amount`), so
   * the window this stream ever needs only ever moves forward: advance
   * `fieldCursor` to pull in newly-relevant props, and drop ones from the
   * front that have fallen behind every future candidate's search range.
   * Purely a performance cache — it still reads `field.propAt` in index
   * order, so it changes nothing about determinism or materialisation order.
   * @type {{index:number, prop:import('./field.js').Prop}[]}
   */
  const propWindow = [];
  let fieldCursor = 0;

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
      const biome = biomeAtY(y);
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
      // Four draws, always, in this order: spacing jitter, direction, phase,
      // nudge tie-break. The nudge draw is consumed even when the candidate
      // height turns out safe and needs no nudge at all — a draw count that
      // depended on whether a nudge is needed would make every later slot's
      // position depend on earlier ones' luck, same as the other three.
      const spacingDraw = truckRng();
      const dirDraw = truckRng();
      const phaseDraw = truckRng();
      const nudgeDraw = truckRng();
      // The CANDIDATE height, used for spacing chaining (prevY above) and for
      // trucksInRange's early-exit below. This is what stays monotonically
      // increasing by construction, unlike the truck's final (possibly
      // nudged) y, so it — not the truck's own y — is what range queries must
      // walk against.
      const y = prevY + HAZARD.truckEvery * (0.75 + 0.5 * spacingDraw);
      truckY.push(y);
      const biome = biomeAtY(y);
      let truck = null;
      if (biome.trucks) {
        const safeY = findSafeTruckY(y, nudgeDraw, field);
        // Landing outside the truck-biome band after a nudge is possible only
        // right at a biome boundary; re-check rather than assume the nudge
        // stayed inside the same biome that admitted the candidate.
        if (safeY !== null && biomeAtY(safeY).trucks) {
          const dir = /** @type {1|-1} */ (dirDraw < 0.5 ? -1 : 1);
          // Starting offset within the wrap span (see truckX), so trucks born
          // at different indices are not phase-locked to each other.
          const span = DESIGN.width + HAZARD.truckW;
          const phase = phaseDraw * span;
          truck = { y: safeY, dir, speed: HAZARD.truckSpeed, phase };
        }
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
      const y = truckY[i]; // candidate height: monotonic, safe for the early-exit
      if (y > maxY) break;
      const truck = truckCache[i];
      if (truck && truck.y >= minY && truck.y <= maxY) out.push(truck);
    }
    return out;
  }

  /**
   * Find the nearest safe height to `candidateY`, within `HAZARD.truckNudgeRange`
   * of it, whose `HAZARD.truckPropClearance` band contains no attachable prop —
   * i.e. a height a truck's lane can occupy without ever sweeping an orbit ring.
   * Returns `null` if the whole search window is blocked, meaning the caller
   * should drop this truck's slot rather than spawn it somewhere unsafe.
   *
   * Trucks sweep the FULL field width as they wrap (see `truckX`), so a prop's x
   * is irrelevant — only vertical distance matters, exactly as measured in the
   * original defect (a truck essentially centred on the wheel). This is pure
   * interval math on `propWindow` (the sliding cache over `field.propAt`
   * above); it draws no additional randomness. `preferUp` (the nudge draw,
   * always consumed by the caller whether or not it ends up mattering) only
   * breaks ties when a safe spot exists on both sides of `candidateY` at
   * equal distance.
   *
   * @param {number} candidateY
   * @param {number} preferUp in [0,1); >= 0.5 prefers the safe spot above candidateY on a tie
   * @param {Field} field
   * @returns {number|null}
   */
  function findSafeTruckY(candidateY, preferUp, field) {
    const clearance = HAZARD.truckPropClearance;
    const range = HAZARD.truckNudgeRange;
    const lo = candidateY - range;
    const hi = candidateY + range;
    const searchLo = lo - clearance;
    const searchHi = hi + clearance;

    // Pull in any newly-relevant props (index order, same as field.propAt
    // anywhere else), then drop ones now behind searchLo — safe because
    // candidateY, and therefore searchLo, only increases call over call.
    while (true) {
      const prop = field.propAt(fieldCursor);
      if (prop.y > searchHi) break;
      propWindow.push({ index: fieldCursor, prop });
      fieldCursor++;
    }
    while (propWindow.length && propWindow[0].prop.y < searchLo) propWindow.shift();
    const nearby = propWindow.filter((e) => e.prop.y >= searchLo && e.prop.y <= searchHi);
    if (nearby.length === 0) return candidateY;

    // Each prop blocks a band of clearance around its own y; merge overlapping
    // bands into a sorted, non-overlapping list.
    const blocked = nearby
      .map(({ prop }) => [prop.y - clearance, prop.y + clearance])
      .sort((a, b) => a[0] - b[0]);
    /** @type {number[][]} */
    const merged = [];
    for (const band of blocked) {
      const last = merged[merged.length - 1];
      if (last && band[0] <= last[1]) last[1] = Math.max(last[1], band[1]);
      else merged.push([...band]);
    }

    const inBlocked = (/** @type {number} */ y) => merged.some(([s, e]) => y >= s && y <= e);
    if (!inBlocked(candidateY)) return candidateY;

    // Walk the gaps around and between the blocked bands, clipped to [lo, hi],
    // and keep whichever free point lands closest to candidateY.
    const edges = [lo, ...merged.flatMap(([s, e]) => [s, e]), hi];
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < edges.length; i += 2) {
      const gapLo = Math.max(lo, edges[i]);
      const gapHi = Math.min(hi, edges[i + 1]);
      if (gapLo > gapHi) continue;
      const point = Math.min(gapHi, Math.max(gapLo, candidateY));
      const dist = Math.abs(point - candidateY);
      const strictlyCloser = dist < bestDist - 1e-9;
      const tiedButPreferred =
        Math.abs(dist - bestDist) <= 1e-9 && point > candidateY === preferUp >= 0.5;
      if (best === null || strictlyCloser || tiedButPreferred) {
        best = point;
        bestDist = dist;
      }
    }
    return best;
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
