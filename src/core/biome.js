// @ts-check

/** @typedef {{key:string, name:string, fromM:number, kinds:Record<string,number>, trucks:boolean}} Biome */

/**
 * The biome table. Ascending `fromM`, first entry starts at 0. `biomeAt` picks the
 * last biome whose `fromM` is at or below the given height, so the final biome
 * ("The Great Escape") runs forever.
 *
 * @type {Biome[]}
 */
export const BIOMES = Object.freeze([
  Object.freeze({ key: 'roadside', name: 'Roadside', fromM: 0, kinds: { tire: 1 }, trucks: false }),
  Object.freeze({ key: 'orchard', name: 'Orchard Hop', fromM: 150, kinds: { tire: 3, pad: 1 }, trucks: false }),
  Object.freeze({ key: 'ridge', name: 'Windmill Ridge', fromM: 350, kinds: { tire: 3, pad: 1 }, trucks: false }),
  Object.freeze({ key: 'factory', name: 'Factory Floor', fromM: 550, kinds: { tire: 2, gear: 2 }, trucks: false }),
  Object.freeze({ key: 'highway', name: 'Highway', fromM: 750, kinds: { tire: 3, gear: 1, pad: 1 }, trucks: true }),
  Object.freeze({ key: 'escape', name: 'The Great Escape', fromM: 1000, kinds: { tire: 2, gear: 1, pad: 1 }, trucks: true }),
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
