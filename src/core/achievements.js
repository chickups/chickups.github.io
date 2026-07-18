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
 * @property {number} wins
 * @property {number} moddedWins  lifetime wins on a daily (modified) run
 * @property {number} totalMetres lifetime metres climbed, summed over every run
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
    wins: num(s.wins),
    moddedWins: num(s.moddedWins),
    totalMetres: num(s.totalMetres),
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
  Object.freeze({
    key: 'escape',
    name: 'The Great Escape',
    hint: 'Catch the escape truck',
    done: (s) => s.wins >= 1,
  }),
  Object.freeze({
    key: 'escapeMany',
    name: 'Serial Escapee',
    hint: 'Escape 10 times',
    done: (s) => s.wins >= 10,
  }),
  Object.freeze({
    key: 'featherBaron',
    name: 'Feather Baron',
    hint: 'Earn 5000 feathers all-time',
    done: (s) => s.totalFeathers >= 5000,
  }),
  Object.freeze({
    key: 'reach-escape',
    name: 'So Close',
    hint: 'Reach The Great Escape (1000m) in a single run.',
    done: (s) => s.bestMetres >= 1000,
  }),
  Object.freeze({
    key: 'escape-artist',
    name: 'Escape Artist',
    hint: 'Catch the escape truck 50 times.',
    done: (s) => s.wins >= 50,
  }),
  Object.freeze({
    key: 'centurion',
    name: 'Centurion',
    hint: 'Play 100 runs.',
    done: (s) => s.runs >= 100,
  }),
  Object.freeze({
    key: 'unbroken',
    name: 'Unbroken',
    hint: 'Chain 30 grabs in a row.',
    done: (s) => s.maxChain >= 30,
  }),
  Object.freeze({
    key: 'feather-tycoon',
    name: 'Feather Tycoon',
    hint: 'Bank 10000 feathers over your lifetime.',
    done: (s) => s.totalFeathers >= 10000,
  }),
  Object.freeze({
    key: 'against-odds',
    name: 'Against the Odds',
    hint: 'Win a Daily Run under its modifier.',
    done: (s) => s.moddedWins >= 1,
  }),
  Object.freeze({
    key: 'frequent-flyer',
    name: 'Frequent Flyer',
    hint: 'Climb 25000m over your lifetime.',
    done: (s) => s.totalMetres >= 25000,
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

/**
 * Which achievements are earned but have not been announced yet.
 *
 * Achievements have no unlock event: `evaluate` re-derives them from stats every
 * time, so "earned" is a fact about the present, not a moment in the past. The
 * moment is reconstructed by remembering which keys the player has already been
 * told about, and diffing. That makes announcing idempotent — the caller can ask
 * as often as it likes and only ever gets what it has not shown.
 *
 * Results come back in {@link ACHIEVEMENTS} order, never in `seen`'s order or a
 * Set's: the announcement order is data, not a side effect of how the caller's
 * storage happened to serialise. `seen` is untrusted (localStorage), so anything
 * that is not an array of strings is read as "nothing announced yet".
 *
 * @param {unknown} stats
 * @param {unknown} seen keys already announced
 * @returns {{key:string, name:string, hint:string}[]}
 */
export function pendingUnlocks(stats, seen) {
  const announced = new Set(
    Array.isArray(seen) ? seen.filter((k) => typeof k === 'string') : [],
  );
  return evaluate(stats)
    .filter((r) => r.done && !announced.has(r.key))
    .map(({ key, name, hint }) => ({ key, name, hint }));
}
