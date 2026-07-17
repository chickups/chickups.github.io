// @ts-check
import { SCORING } from './tokens.js';

/**
 * @typedef {{
 *   key:string, name:string, fromM:number,
 *   kinds:ReadonlyArray<readonly [string, number]>,
 *   padChance:number,
 *   trucks:boolean,
 * }} Biome
 */

/**
 * The biome table. Ascending `fromM`, first entry starts at 0. `biomeAt` picks the
 * last biome whose `fromM` is at or below the given height, so the final biome
 * ("The Great Escape") runs forever.
 *
 * `kinds` is ATTACHABLE-ONLY (`tire`/`gear`) — it is the spine's ladder of rungs, and
 * every rung must be a prop Peep can actually land on. Pads are not a kind and never
 * occupy a spine index; they live in their own stream (see field.js's `padsInRange`),
 * spawned in the GAP between two consecutive spine props at probability `padChance`
 * (0..1). This is deliberate: the design doc calls pads an optional boost with "no
 * penalty" for a miss, so they must never be the only way past a rung — see the
 * slice-2 task-2b defect writeup for the reachability math that forced this split.
 *
 * `kinds` is an ARRAY of `[kind, weight]` pairs, deliberately NOT a `Record<string,
 * number>`. `pickKind` (field.js) walks it in order, subtracting weights until the
 * running remainder goes negative — and that walk order is part of the field's
 * deterministic output for a given seed. A plain object would work identically in
 * JS (string keys preserve insertion order here), but this table is meant to
 * transliterate to Swift, and Swift's `[String: Int]` is UNORDERED with
 * per-process hash seeding: the same weights would walk in a different, run-to-run
 * random order, so the same seed could pick a different kind at the same index —
 * a different field every launch, even though every marginal probability stays
 * correct. Keep this an array so the order is data, not an accident of the host
 * language. Do NOT "tidy" this back into a `Record`.
 *
 * @type {Biome[]}
 */
export const BIOMES = Object.freeze([
  Object.freeze({ key: 'roadside', name: 'Roadside', fromM: 0, kinds: Object.freeze([['tire', 1]]), padChance: 0, trucks: false }),
  Object.freeze({ key: 'orchard', name: 'Orchard Hop', fromM: 150, kinds: Object.freeze([['tire', 3]]), padChance: 0.55, trucks: false }),
  Object.freeze({ key: 'ridge', name: 'Windmill Ridge', fromM: 350, kinds: Object.freeze([['tire', 3]]), padChance: 0.35, trucks: false }),
  Object.freeze({ key: 'factory', name: 'Factory Floor', fromM: 550, kinds: Object.freeze([['tire', 2], ['gear', 2]]), padChance: 0.2, trucks: false }),
  Object.freeze({ key: 'highway', name: 'Highway', fromM: 750, kinds: Object.freeze([['tire', 3], ['gear', 1]]), padChance: 0.4, trucks: true }),
  Object.freeze({ key: 'escape', name: 'The Great Escape', fromM: 1000, kinds: Object.freeze([['tire', 2], ['gear', 1]]), padChance: 0.5, trucks: true }),
]);

/**
 * The biome active at a given height, in metres. Clamps below 0 to the first
 * biome; the last biome runs forever above its `fromM`.
 *
 * @param {number} metres
 * @returns {Biome}
 */
export function biomeAt(metres) {
  return BIOMES[biomeIndexAt(metres)];
}

/**
 * The biome active at a given ABSOLUTE world height, in points (world-space y,
 * same units `field.js`/`zones.js` generate from). This is the ONE seam every
 * caller that needs to agree with what the field generator actually built
 * should use, rather than re-deriving `metres` its own way.
 *
 * `biomeAt(metres)` takes a metres value the caller already computed, and
 * different callers computed it from different zero points — `field.js` and
 * `zones.js` always use absolute `y / pointsPerMetre`, but the score shown to
 * the player (`run.js`'s `scoreOf`) is climbed distance from `startY`
 * (the orbit top of prop 0), a DIFFERENT zero point. Feeding a score into
 * `biomeAt` therefore disagrees with the field near every biome boundary by
 * `startY / pointsPerMetre` metres. Use `biomeAtY` (or `biomeIndexAtY`) with
 * the player's raw world `y`/`maxY` instead of `scoreOf(state)` wherever the
 * answer must match what the field actually generated.
 *
 * @param {number} y world y, points
 * @returns {Biome}
 */
export function biomeAtY(y) {
  return biomeAt(y / SCORING.pointsPerMetre);
}

/**
 * Index into `BIOMES` active at a given height, in metres.
 *
 * @param {number} metres
 * @returns {number}
 */
export function biomeIndexAt(metres) {
  let idx = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    if (BIOMES[i].fromM <= metres) idx = i;
    else break;
  }
  return idx;
}

/**
 * Index into `BIOMES` active at a given ABSOLUTE world height, in points. See
 * `biomeAtY` above for why this differs from `biomeIndexAt(scoreOf(state))`.
 *
 * @param {number} y world y, points
 * @returns {number}
 */
export function biomeIndexAtY(y) {
  return biomeIndexAt(y / SCORING.pointsPerMetre);
}
