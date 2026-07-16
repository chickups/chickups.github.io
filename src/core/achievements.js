// @ts-check
import { BIOMES } from './biome.js';

/**
 * Pure predicates over run/lifetime stats. `evaluate` is deliberately total: `stats`
 * comes from localStorage, which is not a trusted channel — a fresh install, an old
 * build's stats shape, or hand-edited JSON can all reach this code, so every field is
 * read defensively and nothing here may throw.
 */

/**
 * @typedef {object} Stats
 * @property {number} bestMetres
 * @property {number} totalFeathers
 * @property {number} runs
 * @property {number} maxChain
 * @property {number} biomesReached
 */

/** @typedef {{key:string, name:string, hint:string, done:(s:Stats)=>boolean}} Achievement */

/**
 * Coerce an arbitrary field into a finite, non-negative number, defaulting to 0. Used so
 * `evaluate` never throws or misbehaves on missing, wrong-typed, or hostile input.
 * @param {unknown} v
 * @returns {number}
 */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Fill in a possibly-partial, possibly-garbage stats object with safe defaults.
 * @param {unknown} stats
 * @returns {Stats}
 */
function normalize(stats) {
  const s = stats && typeof stats === 'object' ? /** @type {Record<string, unknown>} */ (stats) : {};
  return {
    bestMetres: num(s.bestMetres),
    totalFeathers: num(s.totalFeathers),
    runs: num(s.runs),
    maxChain: num(s.maxChain),
    biomesReached: num(s.biomesReached),
  };
}

/**
 * The achievement table. Spans distance, feathers, chains, biomes and persistence.
 * The biome-count entry reads {@link BIOMES}.length rather than a hardcoded number, so it
 * can never demand more biomes than the game actually has.
 * @type {Achievement[]}
 */
export const ACHIEVEMENTS = Object.freeze([
  Object.freeze({
    key: 'first-flight',
    name: 'First Flight',
    hint: 'Climb 50m in a single run.',
    done: (s) => s.bestMetres >= 50,
  }),
  Object.freeze({
    key: 'high-flyer',
    name: 'High Flyer',
    hint: 'Climb 500m in a single run.',
    done: (s) => s.bestMetres >= 500,
  }),
  Object.freeze({
    key: 'nest-egg',
    name: 'Nest Egg',
    hint: 'Bank 100 feathers over your lifetime.',
    done: (s) => s.totalFeathers >= 100,
  }),
  Object.freeze({
    key: 'feather-fortune',
    name: 'Feather Fortune',
    hint: 'Bank 1000 feathers over your lifetime.',
    done: (s) => s.totalFeathers >= 1000,
  }),
  Object.freeze({
    key: 'combo-starter',
    name: 'Combo Starter',
    hint: 'Chain 5 grabs in a row.',
    done: (s) => s.maxChain >= 5,
  }),
  Object.freeze({
    key: 'chain-master',
    name: 'Chain Master',
    hint: 'Chain 15 grabs in a row.',
    done: (s) => s.maxChain >= 15,
  }),
  Object.freeze({
    key: 'world-traveler',
    name: 'World Traveler',
    hint: 'Reach every biome.',
    done: (s) => s.biomesReached >= BIOMES.length,
  }),
  Object.freeze({
    key: 'dedicated',
    name: 'Dedicated',
    hint: 'Play 25 runs.',
    done: (s) => s.runs >= 25,
  }),
]);

/**
 * Evaluate every achievement against a stats object. Total: never throws, even on a
 * zeroed fresh Stats or a partial/garbage object from localStorage.
 * @param {unknown} stats
 * @returns {{key:string, name:string, hint:string, done:boolean}[]}
 */
export function evaluate(stats) {
  const s = normalize(stats);
  return ACHIEVEMENTS.map((a) => ({ key: a.key, name: a.name, hint: a.hint, done: a.done(s) }));
}

/**
 * How many achievements are earned for this stats object.
 * @param {unknown} stats
 * @returns {number}
 */
export function earnedCount(stats) {
  return evaluate(stats).filter((r) => r.done).length;
}
