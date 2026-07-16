// @ts-check

/**
 * @typedef {{
 *   key:string, name:string, fromM:number,
 *   kinds:Record<string,number>,
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
 * @type {Biome[]}
 */
export const BIOMES = Object.freeze([
  Object.freeze({ key: 'roadside', name: 'Roadside', fromM: 0, kinds: { tire: 1 }, padChance: 0, trucks: false }),
  Object.freeze({ key: 'orchard', name: 'Orchard Hop', fromM: 150, kinds: { tire: 3 }, padChance: 0.55, trucks: false }),
  Object.freeze({ key: 'ridge', name: 'Windmill Ridge', fromM: 350, kinds: { tire: 3 }, padChance: 0.35, trucks: false }),
  Object.freeze({ key: 'factory', name: 'Factory Floor', fromM: 550, kinds: { tire: 2, gear: 2 }, padChance: 0.2, trucks: false }),
  Object.freeze({ key: 'highway', name: 'Highway', fromM: 750, kinds: { tire: 3, gear: 1 }, padChance: 0.4, trucks: true }),
  Object.freeze({ key: 'escape', name: 'The Great Escape', fromM: 1000, kinds: { tire: 2, gear: 1 }, padChance: 0.5, trucks: true }),
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
