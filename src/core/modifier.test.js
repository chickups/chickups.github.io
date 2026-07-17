// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIERS, modifierForDay, baseTuning, applyModifier } from './modifier.js';
import { PHYSICS, FIELD, PROPS, ZONES, ESCAPE, MODIFIER } from './tokens.js';

test('there are exactly seven modifiers, one per weekday', () => {
  assert.equal(MODIFIERS.length, 7);
});

test('MODIFIERS is an ORDERED ARRAY, not an object', () => {
  // biome.js's `kinds` doc comment explains why this matters and is not pedantry:
  // this table is indexed by weekday, so its ORDER IS DATA. A Record would work
  // identically in JS (string keys keep insertion order) but this code is meant to
  // transliterate to Swift, whose dictionaries are UNORDERED with per-process hash
  // seeding — the same day would draw a different modifier every launch.
  assert.ok(Array.isArray(MODIFIERS), 'must be an array');
  assert.ok(Object.isFrozen(MODIFIERS), 'must be frozen');
});

test('every modifier has a key, a name and a blurb', () => {
  for (const m of MODIFIERS) {
    assert.equal(typeof m.key, 'string', `bad key: ${JSON.stringify(m)}`);
    assert.ok(m.key.length > 0);
    assert.ok(m.name.length > 0, `${m.key} has no name`);
    assert.ok(m.blurb.length > 0, `${m.key} has no blurb`);
  }
});

test('modifier keys are unique', () => {
  const keys = MODIFIERS.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${keys.join(', ')}`);
});

test('a modifier is picked by dayNumber % 7, and every one appears once a week', () => {
  // ANY seven consecutive days must show all seven. The whole point of indexing
  // rather than drawing from dailySeed: a pseudorandom draw would repeat modifiers
  // within a week and skip others, making "one per day of the week" simply false.
  for (const start of [0, 19999, 20000, 20003, 24601]) {
    const week = [];
    for (let d = start; d < start + 7; d++) week.push(modifierForDay(d).key);
    assert.equal(new Set(week).size, 7, `week from ${start} must show all seven: ${week.join(', ')}`);
  }
});

test('the index is literally dayNum % 7 into MODIFIERS, in table order', () => {
  // Note 20000 % 7 === 1 — the epoch offset means day N does NOT start at index 0.
  // That is fine and is exactly why this is spelled out rather than eyeballed.
  for (const d of [0, 1, 6, 7, 19999, 20000, 20001]) {
    assert.equal(modifierForDay(d).key, MODIFIERS[d % 7].key, `day ${d}`);
  }
});

test('modifierForDay is deterministic and repeats every 7 days', () => {
  for (let d = 19990; d < 20050; d++) {
    assert.equal(modifierForDay(d).key, modifierForDay(d).key, 'must be pure');
    assert.equal(modifierForDay(d).key, modifierForDay(d + 7).key, 'must be weekly');
  }
});

test('a NEGATIVE day number still picks a real modifier', () => {
  // dayNumber() is an epoch day index, so any date before 1970 is negative — and
  // `-3 % 7` is -3 in JS, which would index off the front of the array and return
  // undefined. A player with a badly-set clock must not crash the daily screen.
  for (const d of [-1, -3, -7, -8, -700]) {
    const m = modifierForDay(d);
    assert.ok(m && typeof m.key === 'string', `day ${d} gave ${JSON.stringify(m)}`);
    assert.ok(MODIFIERS.includes(m), `day ${d} gave a modifier not in the table`);
  }
});

/**
 * The physics contract, recomputed from tokens rather than hardcoded — the whole
 * point is that this tracks the constants, so that changing orbitRate or gravity
 * makes this test speak up rather than go quietly stale.
 *
 *   launch speed v = orbitRate * orbitRadius * launchBoost
 *   max rise       = v^2 / (2 * gravity)
 *
 * The binding constraint is VERTICAL CLIMB. It is NOT the 45-degree range (v^2/g,
 * which is HORIZONTAL) — assuming that produced an unwinnable build once.
 */
function maxRise() {
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  return (v * v) / (2 * PHYSICS.gravity);
}

test('the physics contract still reads as the spec says it does', () => {
  // If this fails, someone moved orbitRate/orbitRadius/launchBoost/gravity and the
  // margins below were re-measured against numbers that no longer exist.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  assert.equal(v, 372, 'launch speed');
  assert.ok(Math.abs(maxRise() - 247.11) < 0.02, `max rise ${maxRise()}, want ~247pt`);
  assert.equal(FIELD.gapMax, 200, 'base gapMax');
});

test('EVERY modifier leaves the field winnable', () => {
  // The one test that stands between a future "Thin Air could be spicier" and a
  // player wedged against a gap no skill can clear. `max rise` must exceed the
  // modified gapMax, or the field grows a wall.
  const rise = maxRise();
  for (const mod of MODIFIERS) {
    const t = applyModifier(mod);
    assert.ok(
      t.gapMax < rise,
      `${mod.key}: gapMax ${t.gapMax} >= max rise ${rise.toFixed(1)}pt — UNWINNABLE. ` +
        'No modifier may widen the gap past what a launch can climb.',
    );
  }
  // And the plain run, which is the case every modifier is measured against.
  assert.ok(baseTuning().gapMax < rise, 'the base field must be winnable too');
});

test('Thin Air is winnable at 1.07x, the tightest the field has ever been', () => {
  const t = applyModifier(MODIFIERS.find((m) => m.key === 'thinAir') || null);
  // A tolerance, not assert.equal(t.gapMax, 230): 200 * 1.15 is 229.99999999999997
  // in binary floating point, and an exact comparison against 230 fails.
  assert.ok(Math.abs(t.gapMax - 230) < 1e-9, `Thin Air widens gapMax 200 -> 230, got ${t.gapMax}`);
  const margin = maxRise() / t.gapMax;
  assert.ok(margin > 1.0, `Thin Air is unwinnable at a ${margin.toFixed(3)}x margin`);
  assert.ok(Math.abs(margin - 1.074) < 0.01, `expected ~1.07x, measured ${margin.toFixed(3)}x`);
  // Base is 1.24x. Thin Air is the floor. If a future change makes some OTHER
  // modifier tighter than this, the assertion above it will already have fired.
});

test('baseTuning is every token default — a plain run is unmodified', () => {
  assert.deepEqual(baseTuning(), {
    padBounceMod: 1,
    gapMax: FIELD.gapMax,
    featherScale: 1,
    truckHeightM: ESCAPE.truckHeightM,
    trucksEverywhere: false,
    updraftScale: 1,
    gearWeightBoost: 1,
  });
});

test('applyModifier(null) is baseTuning', () => {
  assert.deepEqual(applyModifier(null), baseTuning());
});

test('an UNKNOWN modifier key falls back to baseTuning and never throws', () => {
  // A save written by a future version of the game, or a hand-edited store.
  for (const key of ['fromTheFuture', '', 'BOUNCYHAY', 'padBounceMod', '__proto__']) {
    const t = applyModifier({ key, name: 'Who?', blurb: 'Unknown.' });
    assert.deepEqual(t, baseTuning(), `unknown key "${key}" must be inert`);
  }
});

test('each modifier moves EXACTLY the knobs it claims and no others', () => {
  const expected = {
    bouncyHay: { padBounceMod: MODIFIER.bouncyHayMod },
    rushHour: { trucksEverywhere: true },
    featherFrenzy: { featherScale: MODIFIER.featherFrenzyScale },
    thinAir: { gapMax: FIELD.gapMax * MODIFIER.thinAirGapScale },
    tailwind: { updraftScale: MODIFIER.tailwindScale },
    slickGears: { gearWeightBoost: MODIFIER.slickGearsWeightBoost },
    lowCeiling: { truckHeightM: MODIFIER.lowCeilingHeightM },
  };
  const base = baseTuning();
  for (const mod of MODIFIERS) {
    const t = applyModifier(mod);
    const want = expected[mod.key];
    assert.ok(want, `${mod.key} is untested — add it to this table`);
    for (const knob of Object.keys(base)) {
      const wanted = knob in want ? want[knob] : base[knob];
      assert.equal(t[knob], wanted, `${mod.key}.${knob}`);
    }
  }
});

test('Low Ceiling drops the truck to 1100m, NOT 1000m', () => {
  const t = applyModifier(MODIFIERS.find((m) => m.key === 'lowCeiling') || null);
  assert.equal(t.truckHeightM, 1100);
  // The Great Escape BEGINS at 1000m. A truck at exactly 1000 would sit on the
  // biome gate, so the player would win the instant they entered it — deleting
  // the gauntlet this modifier is supposed to merely shorten.
  assert.ok(t.truckHeightM > 1000, 'the truck must sit ABOVE the escape biome gate');
  assert.ok(t.truckHeightM < ESCAPE.truckHeightM, 'Low Ceiling must actually be lower');
});

test('a tuning is frozen — one run cannot leak its modifier into the next', () => {
  for (const mod of [null, ...MODIFIERS]) {
    assert.ok(Object.isFrozen(applyModifier(mod)), `${mod ? mod.key : 'base'} is mutable`);
  }
});
