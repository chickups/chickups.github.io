// @ts-check

/**
 * The daily streak: how many consecutive calendar days the player has run the
 * Daily Route, and what each rung of the ladder pays.
 *
 * Core never reads a clock. `today` is passed in, exactly as `daily.js`'s
 * `dayNumber(msSinceEpoch, tzOffsetMinutes)` hands it out — that keeps this
 * module pure, testable at any date, and portable to Swift unchanged.
 */

/** @typedef {{day:number, length:number}} StreakState */
/** @typedef {{kind:'feathers', amount:number}|{kind:'outfit'}} StreakReward */

/**
 * The design's §08 ladder, verbatim: Day 1 · 20, Day 2 · 30, Day 3 · 40,
 * Day 4 · 50, Day 5 · +100, Day 6 · 150, Day 7 · Outfit.
 *
 * Indexed by `length - 1`. Day 7 pays an outfit rather than feathers, granted
 * through `core/milestone.js`'s `grantFor` — the same path a feather milestone
 * uses, so there is exactly one mechanism that can hand out an outfit for
 * playing rather than paying.
 *
 * @type {ReadonlyArray<number|'outfit'>}
 */
export const STREAK_LADDER = Object.freeze([20, 30, 40, 50, 100, 150, 'outfit']);

/** The ladder is a loop, not an open-ended counter. */
export const STREAK_MAX = 7;

/**
 * Clamp a stored length into the ladder's own 1..STREAK_MAX range.
 * localStorage is untrusted, so a length of 0, -5, 99 or NaN is a real input.
 * @param {number} length
 * @returns {number}
 */
function clampLength(length) {
  if (!Number.isFinite(length)) return 1;
  return Math.min(STREAK_MAX, Math.max(1, Math.floor(length)));
}

/**
 * Is this a shape we can reason about at all?
 * @param {any} prev
 * @returns {prev is StreakState}
 */
function isState(prev) {
  return (
    !!prev &&
    typeof prev === 'object' &&
    Number.isFinite(prev.day) &&
    typeof prev.length === 'number' &&
    !Number.isNaN(prev.length)
  );
}

/**
 * Advance the streak for `today`.
 *
 * Four cases, and each one is a real thing a player does:
 *  - **same day** — playing twice in a day must not advance (idempotent).
 *  - **the next day** — advance, wrapping day 7 back to day 1.
 *  - **a gap** — a missed day resets to day 1 (spec D10).
 *  - **before `prev.day`** — clock tampering or timezone travel. CLAMP: return
 *    `prev` untouched. Never grant a streak for time going backwards, and
 *    never rewind `day` either, or the player could re-walk the same calendar
 *    step and collect the same rung twice.
 *
 * @param {StreakState|null} prev the stored streak, or null for a first-ever play
 * @param {number} today from `dayNumber()`
 * @returns {StreakState}
 */
export function advanceStreak(prev, today) {
  if (!isState(prev)) return { day: today, length: 1 };

  const length = clampLength(prev.length);

  // Time going backwards, or standing still: nothing changes. Returning a
  // normalised copy rather than `prev` itself keeps a corrupt length from
  // surviving a round trip through storage.
  if (today <= prev.day) return { day: prev.day, length };

  if (today === prev.day + 1) {
    const next = length + 1;
    return { day: today, length: next > STREAK_MAX ? 1 : next };
  }

  // A gap. Spec D10.
  return { day: today, length: 1 };
}

/**
 * What day `length` of the ladder pays.
 * @param {number} length 1..STREAK_MAX
 * @returns {StreakReward}
 */
export function rewardForDay(length) {
  const rung = STREAK_LADDER[clampLength(length) - 1];
  return rung === 'outfit' ? { kind: 'outfit' } : { kind: 'feathers', amount: /** @type {number} */ (rung) };
}
