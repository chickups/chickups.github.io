// @ts-check
import { DEFAULT_OUTFIT, outfitAt } from './core/shop.js';

const K = {
  best: 'chickup.best',
  feathers: 'chickup.feathers',
  seenIntro: 'chickup.seenIntro',
  outfitsOwned: 'chickup.outfitsOwned',
  outfitEquipped: 'chickup.outfitEquipped',
  statRuns: 'chickup.stat.runs',
  statMaxChain: 'chickup.stat.maxChain',
  statBiomesReached: 'chickup.stat.biomesReached',
  // Lifetime feathers ever earned. Deliberately separate from `feathers` (the
  // spendable balance): spending in the shop must not un-earn a feather achievement.
  statTotalFeathers: 'chickup.stat.totalFeathers',
};

/**
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    // Private browsing and some embedded webviews throw on localStorage access.
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do — the run still played, it just will not be remembered.
  }
}

/**
 * Read a string list stored as JSON. Treats anything that is not a JSON array of
 * strings as absent — localStorage holds data from older builds and can be
 * hand-edited, so a corrupt value (a string, `null`, an object, an array of numbers)
 * must fall back cleanly rather than throw or poison the result.
 * @param {string} key
 * @returns {string[]}
 */
function readStringArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string');
  } catch {
    return [];
  }
}

/**
 * @param {string} key
 * @param {string[]} value
 */
function writeStringArray(key, value) {
  write(key, JSON.stringify(value));
}

/**
 * @param {string} key
 * @returns {string|null}
 */
function readString(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @returns {number} best distance in metres */
export const getBest = () => readNumber(K.best, 0);

/** @param {number} metres */
export function setBest(metres) {
  if (metres > getBest()) write(K.best, String(Math.floor(metres)));
}

/** @returns {number} */
export const getFeathers = () => readNumber(K.feathers, 0);

/** @param {number} n */
export function addFeathers(n) {
  write(K.feathers, String(getFeathers() + Math.floor(n)));
}

/** @returns {boolean} */
export const hasSeenIntro = () => readNumber(K.seenIntro, 0) === 1;

export function markIntroSeen() {
  write(K.seenIntro, '1');
}

/**
 * Set the spendable feather balance directly (as opposed to `addFeathers`, which
 * adds a delta). Used by the shop after `core/shop.js`'s `purchase()` computes the
 * new absolute balance. Clamped to a non-negative integer, since untrusted callers
 * or corrupt state must never be able to push the balance below zero.
 * @param {number} n
 */
export function setFeathers(n) {
  write(K.feathers, String(Math.max(0, Math.floor(n))));
}

/**
 * Outfits the player has purchased. Filters out anything that is not a real
 * buyable outfit key — localStorage is untrusted, and an old build or hand-edited
 * JSON could reference a renamed or removed outfit.
 * @returns {string[]}
 */
export function getOwnedOutfits() {
  return readStringArray(K.outfitsOwned).filter((key) => outfitAt(key) !== null);
}

/**
 * Record a purchased outfit as owned. Idempotent and defensive: unknown keys are
 * ignored, and re-buying an already-owned outfit is a no-op.
 * @param {string} key
 */
export function addOwnedOutfit(key) {
  if (!outfitAt(key)) return;
  const owned = getOwnedOutfits();
  if (owned.includes(key)) return;
  writeStringArray(K.outfitsOwned, [...owned, key]);
}

/**
 * The currently-equipped outfit. Always a safe value to hand `peep()`: `'none'` is
 * always valid, and anything else is validated against the owned list, so a
 * corrupt or stale stored key (an outfit that was renamed, or was never actually
 * bought) falls back to `'none'` rather than showing a broken or unearned outfit.
 * @returns {string}
 */
export function getEquippedOutfit() {
  const key = readString(K.outfitEquipped);
  if (key === null || key === DEFAULT_OUTFIT) return DEFAULT_OUTFIT;
  return getOwnedOutfits().includes(key) ? key : DEFAULT_OUTFIT;
}

/**
 * Equip an outfit. Refuses to equip anything the player does not own (`'none'` is
 * always allowed, since it must always be possible to take an outfit off).
 * @param {string} key
 */
export function setEquippedOutfit(key) {
  if (key !== DEFAULT_OUTFIT && !getOwnedOutfits().includes(key)) return;
  write(K.outfitEquipped, key);
}

/**
 * Lifetime stats in the shape `core/achievements.js`'s `evaluate()` wants.
 * `bestMetres` is sourced from `getBest()` — no separate copy is kept. The other
 * four fields are lifetime counters, updated only by `recordRun`.
 * @returns {import('./core/achievements.js').Stats}
 */
export function getStats() {
  return {
    bestMetres: getBest(),
    totalFeathers: readNumber(K.statTotalFeathers, 0),
    runs: readNumber(K.statRuns, 0),
    maxChain: readNumber(K.statMaxChain, 0),
    biomesReached: readNumber(K.statBiomesReached, 0),
  };
}

/**
 * Record the outcome of a finished run: updates the best-distance line, the
 * spendable feather balance, and every lifetime stat achievements read. This is
 * the single call site meant to replace ad hoc `setBest`/`addFeathers` calls at
 * the end of a run — calling both that and this would double-credit feathers.
 * @param {{metres: number, feathers: number, maxChain: number, biomeIndex: number}} run
 */
export function recordRun({ metres, feathers, maxChain, biomeIndex }) {
  setBest(metres);
  addFeathers(feathers);
  write(K.statRuns, String(readNumber(K.statRuns, 0) + 1));
  write(K.statTotalFeathers, String(readNumber(K.statTotalFeathers, 0) + Math.max(0, Math.floor(feathers))));
  write(K.statMaxChain, String(Math.max(readNumber(K.statMaxChain, 0), Math.floor(maxChain) || 0)));
  const reached = Math.max(0, Math.floor(biomeIndex) + 1);
  write(K.statBiomesReached, String(Math.max(readNumber(K.statBiomesReached, 0), reached)));
}
