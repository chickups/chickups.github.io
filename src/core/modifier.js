// @ts-check
import { FIELD, ESCAPE, MODIFIER } from './tokens.js';

/**
 * The seven Daily Run modifiers, and the tuning they produce.
 *
 * A modifier is APPLIED TO a run; `daily.js`'s `dailySeed` merely IDENTIFIES one.
 * They change for different reasons, so they live in different modules.
 *
 * @typedef {{key:string, name:string, blurb:string}} Modifier
 */

/**
 * The knobs a modifier may move — and the ONLY seam through which a modifier
 * reaches the engine. `run.js`, `field.js` and `zones.js` read tuning, never
 * tokens, for these seven values.
 *
 * Why a seam at all: those three modules read `tokens.js` directly, and tokens is
 * a frozen module-level constant. Without this object a modifier would have to
 * mutate a frozen global — which cannot work, and if it could would leak one run's
 * modifier into the next.
 *
 * @typedef {Object} RunTuning
 * @property {number} padBounceMod  MULTIPLIER on the pad bounce speed run.js computes.
 *   NOT the same thing as `PROPS.padBounceScale` (the contact-speed factor). This one is
 *   a modifier's dial and is 1.0 at base; that one is a physics constant.
 * @property {number} gapMax          pt. Replaces `FIELD.gapMax` in field.js's spine spacing.
 *   MUST stay below max rise (247pt) — see `applyModifier` and the winnability test.
 * @property {number} featherScale    Multiplier on feathers banked per chain link.
 * @property {number} truckHeightM    m. Where the escape truck sits. Spec D5.
 *   DATA ONLY until the win task reads it; nothing in this task consumes it.
 * @property {boolean} trucksEverywhere  Ignore `biome.trucks` and spawn trucks in every biome.
 * @property {number} updraftScale    Multiplier on updraft lift, max speed, AND frequency.
 * @property {number} gearWeightBoost Multiplier on the `gear` weight in a biome's `kinds`
 *   table. Changes how OFTEN a gear spawns. Spec D2: it does NOT touch gear SPEED, ever.
 */

/**
 * One per day of the week. **ORDER IS DATA** — `modifierForDay` indexes this by
 * `dayNumber % 7`, so moving an entry changes which modifier Tuesday gets.
 *
 * Deliberately an ARRAY and not a `Record<string, Modifier>`. Read `biome.js`'s
 * `kinds` doc comment: this repo has a critical bug in its history from relying on
 * object-key iteration order. A plain object behaves identically in JS, but this
 * table is meant to transliterate to Swift, whose `[String: Modifier]` is UNORDERED
 * with per-process hash seeding — the same weekday would land on a different
 * modifier run to run. Do NOT "tidy" this into a Record.
 *
 * Only `Bouncy Hay` is named by the design doc; the other six are chosen by the spec.
 *
 * @type {ReadonlyArray<Modifier>}
 */
export const MODIFIERS = Object.freeze([
  Object.freeze({ key: 'bouncyHay', name: 'Bouncy Hay', blurb: 'Hay bales launch you farther.' }),
  Object.freeze({ key: 'rushHour', name: 'Rush Hour', blurb: 'Traffic everywhere.' }),
  Object.freeze({ key: 'featherFrenzy', name: 'Feather Frenzy', blurb: 'Double feathers.' }),
  Object.freeze({ key: 'thinAir', name: 'Thin Air', blurb: 'The rungs are further apart.' }),
  Object.freeze({ key: 'tailwind', name: 'Tailwind', blurb: 'The wind is with you.' }),
  Object.freeze({ key: 'slickGears', name: 'Slick Gears', blurb: 'The factory took over.' }),
  Object.freeze({ key: 'lowCeiling', name: 'Low Ceiling', blurb: 'The truck leaves early.' }),
]);

/**
 * The modifier for a calendar day.
 *
 * `MODIFIERS[dayNumber % 7]` — **not** drawn from `dailySeed`, and the two are not
 * interchangeable. A seed-derived draw is pseudorandom: it would repeat modifiers
 * within a week and skip others entirely, so "seven, one per day of the week" would
 * simply be false. Indexing the day guarantees each modifier appears exactly once
 * per seven days, is trivially deterministic across devices with no shared state,
 * and is what lets a player say "Tuesday was the bouncy one" and be right.
 * `dailySeed` keeps its one existing job — identifying the route — and gains no
 * second responsibility.
 *
 * @param {number} dayNum from `dayNumber()` in core/daily.js
 * @returns {Modifier}
 */
export function modifierForDay(dayNum) {
  // dayNum is an epoch day index and is NEGATIVE for any date before 1970 (a
  // badly-set clock is a real input). JS's % keeps the sign of the dividend, so
  // -3 % 7 is -3 and would index off the front of the array. Normalise first.
  const i = (((Math.floor(dayNum) % MODIFIERS.length) + MODIFIERS.length) % MODIFIERS.length);
  return MODIFIERS[i];
}

/**
 * The tuning a plain (non-daily) run uses: every knob at its token default, so
 * `applyModifier(null)` and today's hardcoded behaviour are the same run.
 *
 * Returns a shared frozen object rather than a fresh one. `step` takes this as a
 * default parameter and runs 60 times a second; allocating a new object per frame
 * to hold seven constants would be pure waste. Frozen, so no caller can turn the
 * default into a mutable global by accident.
 * @type {RunTuning}
 */
const BASE = Object.freeze({
  padBounceMod: 1,
  gapMax: FIELD.gapMax,
  featherScale: 1,
  truckHeightM: ESCAPE.truckHeightM,
  trucksEverywhere: false,
  updraftScale: 1,
  gearWeightBoost: 1,
});

/**
 * Tuning with no modifier applied.
 * @returns {RunTuning}
 */
export function baseTuning() {
  return BASE;
}

/**
 * The tuning a modifier produces.
 *
 * An UNKNOWN KEY falls through to `baseTuning()` and NEVER throws. This is not
 * defensive padding: a save written by a future version of the game, or a
 * hand-edited store, can name a modifier this build has never heard of, and the
 * right answer is "run the plain route", not "the daily screen crashes".
 *
 * @param {Modifier|null} mod
 * @returns {RunTuning}
 */
export function applyModifier(mod) {
  if (!mod) return baseTuning();
  switch (mod.key) {
    case 'bouncyHay':
      return Object.freeze({ ...BASE, padBounceMod: MODIFIER.bouncyHayMod });
    case 'rushHour':
      return Object.freeze({ ...BASE, trucksEverywhere: true });
    case 'featherFrenzy':
      return Object.freeze({ ...BASE, featherScale: MODIFIER.featherFrenzyScale });
    case 'thinAir':
      return Object.freeze({ ...BASE, gapMax: FIELD.gapMax * MODIFIER.thinAirGapScale });
    case 'tailwind':
      return Object.freeze({ ...BASE, updraftScale: MODIFIER.tailwindScale });
    case 'slickGears':
      return Object.freeze({ ...BASE, gearWeightBoost: MODIFIER.slickGearsWeightBoost });
    case 'lowCeiling':
      return Object.freeze({ ...BASE, truckHeightM: MODIFIER.lowCeilingHeightM });
    default:
      return baseTuning();
  }
}
