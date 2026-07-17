// @ts-check
import { OUTFITS, outfitAt } from './shop.js';
import { MILESTONE } from './tokens.js';

/**
 * The lifetime-feather ladder and what each rung grants (spec D7).
 *
 * Pure, and deliberately total: every input here arrives from localStorage, which is
 * not a trusted channel — a fresh install, an older build's shape, or hand-edited JSON
 * can all reach this code, so nothing may throw and nothing may be assumed well-typed.
 *
 * Read against `statTotalFeathers` (lifetime), never the spendable balance: buying a hat
 * must not un-earn a milestone. See the comment on `K.statTotalFeathers` in storage.js.
 */

/** @typedef {{kind:'outfit', outfitKey:string, name:string}|{kind:'feathers', amount:number}} Grant */

/** Lifetime-feather rungs. Ascending. The values live in tokens.js. */
export const MILESTONES = MILESTONE.rungs;

/** Feather bonus when every outfit is already owned. */
export const ALL_OWNED_BONUS = MILESTONE.allOwnedBonus;

/**
 * Indices of every rung at or below `totalFeathers`, ASCENDING.
 *
 * Built by walking {@link MILESTONES} by index, never by filtering a Set or a caller's
 * list — the order rungs are announced in is data, not a side effect of how someone's
 * storage happened to serialise. (`core/biome.js`'s `kinds` doc explains what unordered
 * iteration cost this codebase once: Swift dictionaries are unordered with per-process
 * hash seeding, so the same data walks in a different order every launch.)
 *
 * @param {unknown} totalFeathers
 * @returns {number[]}
 */
export function passedMilestones(totalFeathers) {
  const n =
    typeof totalFeathers === 'number' && Number.isFinite(totalFeathers) && totalFeathers >= 0
      ? totalFeathers
      : 0;
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < MILESTONES.length; i++) {
    if (n >= MILESTONES[i]) out.push(i);
  }
  return out;
}

/**
 * What a rung grants: the cheapest UNOWNED outfit, else feathers (spec D7).
 *
 * This is why a milestone can never fire "Reward Unlocked!" for a hat the player already
 * has — the grant is defined as the cheapest thing they lack, so "already owned" is
 * unreachable by construction rather than by a check. With only three outfits, a fourth
 * rung would have nothing to give; that case pays {@link ALL_OWNED_BONUS} instead.
 *
 * Walks {@link OUTFITS} in table order and takes the first unowned. That is "cheapest"
 * only because OUTFITS ascends by cost — asserted by a test rather than re-sorted here.
 *
 * `owned` is untrusted: anything that is not an array of real outfit keys reads as
 * "owns nothing", which grants the cheapest outfit — the safe direction to be wrong in.
 *
 * @param {unknown} owned
 * @returns {Grant}
 */
export function grantFor(owned) {
  const have = new Set(
    Array.isArray(owned) ? owned.filter((k) => typeof k === 'string' && outfitAt(k) !== null) : [],
  );
  for (const outfit of OUTFITS) {
    if (!have.has(outfit.key)) return { kind: 'outfit', outfitKey: outfit.key, name: outfit.name };
  }
  return { kind: 'feathers', amount: ALL_OWNED_BONUS };
}

/**
 * Rungs passed but not yet announced, ASCENDING.
 *
 * Milestones have no unlock event: a rung is re-derived from lifetime feathers every
 * time, so "passed" is a fact about the present, not a moment in the past. The moment is
 * reconstructed by remembering which rungs the player has already been told about, and
 * diffing — which makes announcing idempotent.
 *
 * `seen` is UNTRUSTED localStorage. Only integer indices inside the real ladder count: a
 * rung index left behind by a build with a longer ladder must not silence a rung that
 * exists now. Note `[1, 2]` is NOT junk here — unlike achievement keys, a milestone's
 * identity IS a number, so `[1, 2]` legitimately means "rungs 1 and 2 announced".
 *
 * @param {unknown} totalFeathers
 * @param {unknown} seen
 * @returns {number[]}
 */
export function pendingMilestones(totalFeathers, seen) {
  const announced = new Set(
    Array.isArray(seen)
      ? seen.filter((v) => Number.isInteger(v) && v >= 0 && v < MILESTONES.length)
      : [],
  );
  return passedMilestones(totalFeathers).filter((i) => !announced.has(i));
}
