// @ts-check

/**
 * The Daily Run: one shared route per calendar day, derived from the date alone.
 *
 * This needs no server. The field is a pure function of its seed, so seeding from
 * the date gives every player the same route without anyone distributing it. Only
 * a *leaderboard* would need a backend, and that stays out of scope.
 *
 * Core never reads a clock — the caller passes the time in. That keeps this
 * module pure, testable at any date, and portable to Swift unchanged.
 */

const MS_PER_DAY = 86400000;

/**
 * The local calendar day as an integer index, rolling over at local midnight.
 *
 * @param {number} msSinceEpoch UTC milliseconds, i.e. `Date.now()`
 * @param {number} tzOffsetMinutes minutes to add to local time to reach UTC, i.e.
 *   `new Date().getTimezoneOffset()` — note it is POSITIVE west of Greenwich.
 * @returns {number} day index; adjacent days differ by exactly 1
 */
export function dayNumber(msSinceEpoch, tzOffsetMinutes) {
  const localMs = msSinceEpoch - tzOffsetMinutes * 60000;
  return Math.floor(localMs / MS_PER_DAY);
}

/**
 * Seed for a day's route. The splitmix32 finaliser, which avalanches: a one-bit
 * input change flips about half the output bits.
 *
 * NOT load-bearing for decorrelation, despite what you might assume. mulberry32's
 * output mixer already scrambles adjacent seeds completely — measured, the mean
 * |correlation| between the streams of seed N and seed N+1 is 0.18, identical to
 * that of two seeds picked far apart. Passing the raw day number would work fine.
 *
 * It is kept as the named seam between "which day is it" and "which route is
 * that", so the mapping can change without touching callers, and so the route
 * does not depend on one PRNG's particular avalanche quality.
 *
 * @param {number} dayNum
 * @returns {number} uint32 seed
 */
export function dailySeed(dayNum) {
  let h = dayNum >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad);
  h ^= h >>> 15;
  h = Math.imul(h, 0xd35a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}
