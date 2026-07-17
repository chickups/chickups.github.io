// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIERS, modifierForDay, baseTuning, applyModifier } from './modifier.js';
import { PHYSICS, FIELD, ZONES, ESCAPE, MODIFIER } from './tokens.js';
import { makeField } from './field.js';
import { makeZones } from './zones.js';
import { createRun, step } from './run.js';

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

test('field.js reads tuning.gapMax, not FIELD.gapMax', () => {
  const thinAir = applyModifier(MODIFIERS.find((m) => m.key === 'thinAir') || null);
  const plain = makeField(4242);
  const thin = makeField(4242, thinAir);

  // The spine's gap caps at gapMax once growth has ramped. Walk far enough up
  // that both fields are pinned to their own ceiling, then measure.
  const gapAt = (f, i) => f.propAt(i + 1).y - f.propAt(i).y;
  assert.ok(Math.abs(gapAt(plain, 60) - 200) < 1e-9, `plain gap ${gapAt(plain, 60)}, want 200`);
  assert.ok(Math.abs(gapAt(thin, 60) - 230) < 1e-9, `thin gap ${gapAt(thin, 60)}, want 230`);
});

test('an omitted tuning leaves field.js exactly as it was', () => {
  // Every existing call site passes no tuning. They must generate the same field.
  const a = makeField(777);
  const b = makeField(777, baseTuning());
  for (let i = 0; i < 40; i++) {
    assert.deepEqual(a.propAt(i), b.propAt(i), `prop ${i} drifted`);
    assert.deepEqual(a.padAt(i), b.padAt(i), `pad ${i} drifted`);
  }
});

test('gearWeightBoost changes how OFTEN a gear spawns, never its speed', () => {
  const slick = applyModifier(MODIFIERS.find((m) => m.key === 'slickGears') || null);
  const countGears = (f) => {
    let n = 0;
    // Walk well into factory/highway/escape, the biomes whose `kinds` name a gear.
    for (let i = 30; i < 400; i++) if (f.propAt(i).kind === 'gear') n++;
    return n;
  };
  const plain = countGears(makeField(4242));
  const boosted = countGears(makeField(4242, slick));
  assert.ok(boosted > plain, `slick gears must spawn more gears: ${boosted} vs ${plain}`);
});

test('gearWeightBoost does not change the PRNG DRAW COUNT', () => {
  // pickKind must consume exactly one draw whatever the weights are. If a boost
  // changed the draw count, every later prop's x would shift too — the field would
  // not merely be gearier, it would be a different field.
  const slick = applyModifier(MODIFIERS.find((m) => m.key === 'slickGears') || null);
  const plain = makeField(4242);
  const boosted = makeField(4242, slick);
  for (let i = 0; i < 200; i++) {
    assert.equal(boosted.propAt(i).y, plain.propAt(i).y, `prop ${i} y moved`);
    assert.equal(boosted.propAt(i).x, plain.propAt(i).x, `prop ${i} x moved — draw count changed`);
  }
});

test('zones.js reads tuning.trucksEverywhere — Rush Hour puts traffic in every biome', () => {
  const rush = applyModifier(MODIFIERS.find((m) => m.key === 'rushHour') || null);
  const seed = 4242;
  // Roadside/orchard/ridge/factory are `trucks: false` in biome.js. Below 750m
  // (highway's gate) a plain run has no truck at all.
  const lo = 0;
  const hi = 700 * 10; // 700m in points (SCORING.pointsPerMetre = 10)

  const plain = makeZones(seed, makeField(seed));
  assert.equal(plain.trucksInRange(lo, hi).length, 0, 'a plain run has no trucks below highway');

  const field = makeField(seed);
  const rushZones = makeZones(seed, field, rush);
  assert.ok(rushZones.trucksInRange(lo, hi).length > 0, 'Rush Hour must spawn trucks low down');
});

test('zones.js reads tuning.updraftScale — Tailwind makes updrafts more frequent', () => {
  const tailwind = applyModifier(MODIFIERS.find((m) => m.key === 'tailwind') || null);
  // Measured over the WHOLE climb, not a single 200m band. The spacing formula
  // jitters each gap over 0.75..1.25 of updraftEvery (390-650pt plain), so a 200m
  // band holds only ~4 drafts and that jitter swamps the 1.25x effect: sampled
  // across 60 seeds, a 200m band shows no increase in 16 of them. That would be a
  // test that fails on a correct implementation depending on the seed. The effect
  // is unambiguous once the sample is large enough to average the jitter out.
  // ridge (350m) and escape (1000m) are the only biomes with updrafts.
  for (const seed of [1, 555, 4242, 99999]) {
    const plain = makeZones(seed, makeField(seed)).updraftsInRange(0, 20000).length;
    const windy = makeZones(seed, makeField(seed), tailwind).updraftsInRange(0, 20000).length;
    assert.ok(windy > plain, `seed ${seed}: tailwind must pack drafts closer: ${windy} vs ${plain}`);
  }
});

test('Tailwind tightens the updraft SPACING itself, to within the scaled ceiling', () => {
  // The count test above proves "more drafts"; this pins down the MECHANISM — that
  // updraftScale divides the spacing rather than moving some other term.
  //
  // It cannot compare draft-to-draft against the plain stream: `updraftsInRange`
  // yields only ridge/escape drafts, and since Tailwind moves every draft DOWN, a
  // given list position maps to a different underlying index in each stream. So this
  // asserts against the spacing formula's own algebraic ceiling instead.
  //
  // Inside ridge (3500-5500pt) every index yields a draft, so consecutive drafts are
  // consecutive indices and each gap is exactly `updraftEvery/scale * (0.75+0.5*draw)`
  // — bounded above by `updraftEvery * 1.25 / scale` = 520pt. A plain run's own
  // ceiling is 650pt, and plain gaps DO exceed 520 on these seeds (587.9, 570.7,
  // 580.4), so an implementation that ignored updraftScale would breach this bound.
  const tailwind = applyModifier(MODIFIERS.find((m) => m.key === 'tailwind') || null);
  const ceiling = (ZONES.updraftEvery * 1.25) / MODIFIER.tailwindScale;
  for (const seed of [1, 555, 4242, 99999]) {
    const ys = makeZones(seed, makeField(seed), tailwind).updraftsInRange(3500, 5500).map((u) => u.y);
    assert.ok(ys.length > 2, `seed ${seed} needs drafts in ridge to measure`);
    for (let i = 1; i < ys.length; i++) {
      const gap = ys[i] - ys[i - 1];
      assert.ok(
        gap <= ceiling + 1e-9,
        `seed ${seed} draft ${i}: gap ${gap.toFixed(1)}pt exceeds the Tailwind ceiling ` +
          `${ceiling}pt — updraftScale is not dividing the spacing.`,
      );
    }
  }
});

test('an omitted tuning leaves zones.js exactly as it was', () => {
  const a = makeZones(555, makeField(555));
  const b = makeZones(555, makeField(555), baseTuning());
  assert.deepEqual(a.updraftsInRange(0, 20000), b.updraftsInRange(0, 20000));
  assert.deepEqual(a.trucksInRange(0, 20000), b.trucksInRange(0, 20000));
});

const DT = 1 / 60;
const VH = 852;

/**
 * The lowest index that actually carries a pad. NOT a fixed index: roadside's
 * `padChance` is 0 and orchard (the first biome with pads) does not open until
 * 150m, so seed 4242's first pad is at index 10 and every index below it is null.
 * @param {import('./field.js').Field} f
 */
function firstPadIndex(f) {
  for (let i = 0; i < 60; i++) if (f.padAt(i)) return i;
  throw new Error('no pad in the first 60 indices — this field cannot test a bounce');
}

/**
 * A tap at frame 0 launches off the starting orbit at an angle that flies Peep
 * into open air, and the run dies ~98 frames later having grabbed nothing. The
 * orbit has to come round to a launching angle first — hence the wait. Any frame
 * in ~42..49 works on every seed tried; 45 sits in the middle of that window.
 */
const TAP_FRAME = 45;

test('run.js reads tuning.padBounceMod — Bouncy Hay launches farther off a pad', () => {
  const bouncy = applyModifier(MODIFIERS.find((m) => m.key === 'bouncyHay') || null);
  // Drive Peep onto a pad and compare the bounce speed the frame it fires.
  const bounceSpeed = (tuning) => {
    const f = makeField(4242, tuning);
    const pad = f.padAt(firstPadIndex(f));
    assert.ok(pad, 'seed 4242 must have a pad for this test to mean anything');
    let s = createRun(f, VH);
    // Teleport onto the pad: this tests the bounce rule, not the flight to it.
    s = { ...s, phase: 'fly', x: pad.x, y: pad.y, vx: 0, vy: -100, lockPad: -1, lockWheel: -1 };
    const after = step(s, f, DT, false, VH, undefined, tuning);
    return after.vy;
  };
  const plain = bounceSpeed(baseTuning());
  const boosted = bounceSpeed(bouncy);
  assert.ok(plain > 0, `a pad must bounce Peep upward, got ${plain}`);
  assert.ok(
    Math.abs(boosted / plain - MODIFIER.bouncyHayMod) < 1e-6,
    `Bouncy Hay must scale the bounce by ${MODIFIER.bouncyHayMod}: ${boosted} vs ${plain}`,
  );
});

test('run.js reads tuning.featherScale — Feather Frenzy doubles the take', () => {
  const frenzy = applyModifier(MODIFIERS.find((m) => m.key === 'featherFrenzy') || null);
  const feathersAfterAGrab = (tuning) => {
    const f = makeField(1, tuning);
    let s = createRun(f, VH);
    for (let i = 0; i < TAP_FRAME; i++) s = step(s, f, DT, false, VH, undefined, tuning);
    s = step(s, f, DT, true, VH, undefined, tuning); // tap -> launch
    // Fly until the automatic re-attach banks a chain link.
    for (let i = 0; i < 600 && s.feathers === 0 && s.phase !== 'dead'; i++) {
      s = step(s, f, DT, false, VH, undefined, tuning);
    }
    return s.feathers;
  };
  const plain = feathersAfterAGrab(baseTuning());
  assert.ok(plain > 0, 'the plain run must bank a feather to compare against');
  assert.equal(feathersAfterAGrab(frenzy), plain * MODIFIER.featherFrenzyScale);
});

test('feathers stay whole numbers under every modifier', () => {
  // The HUD and the wallet both count feathers; a fractional feather would render
  // as "12.5" and round differently in two places.
  for (const mod of [null, ...MODIFIERS]) {
    const tuning = applyModifier(mod);
    const f = makeField(1, tuning);
    let s = createRun(f, VH);
    for (let i = 0; i < TAP_FRAME; i++) s = step(s, f, DT, false, VH, undefined, tuning);
    s = step(s, f, DT, true, VH, undefined, tuning);
    for (let i = 0; i < 600 && s.phase !== 'dead'; i++) {
      s = step(s, f, DT, false, VH, undefined, tuning);
      assert.ok(Number.isInteger(s.feathers), `${mod ? mod.key : 'base'} banked ${s.feathers}`);
    }
    // Integer-ness alone is a test that passes on a run that banks NOTHING — zero is
    // a fine integer. The run must actually reach the code under test.
    assert.ok(s.feathers > 0, `${mod ? mod.key : 'base'} banked no feather — this proved nothing`);
  }
});

test('an omitted tuning leaves run.js exactly as it was', () => {
  const f = makeField(1);
  const run = (tuning) => {
    const go = (s, pressed) =>
      tuning ? step(s, f, DT, pressed, VH, undefined, tuning) : step(s, f, DT, pressed, VH);
    let s = createRun(f, VH);
    for (let i = 0; i < TAP_FRAME; i++) s = go(s, false);
    s = go(s, true);
    for (let i = 0; i < 300 && s.phase !== 'dead'; i++) s = go(s, false);
    return s;
  };
  const omitted = run(null);
  // The run has to actually exercise a grab, or "identical" is only a claim about
  // two runs that both did nothing.
  assert.ok(omitted.feathers > 0, 'the comparison run must bank a feather to be worth comparing');
  assert.deepEqual(omitted, run(baseTuning()));
});

test('run.js reads tuning.updraftScale — Tailwind lifts harder AND raises the ceiling', () => {
  // The brief threads updraftScale into run.js's lift but specifies no test for it.
  // Without this, run.js ignoring updraftScale altogether passes the whole suite —
  // zones.js's Tailwind tests only cover where drafts SIT, never how hard they push.
  const tailwind = applyModifier(MODIFIERS.find((m) => m.key === 'tailwind') || null);
  const f = makeField(1);

  // A hand-built zones stub holding Peep permanently inside one updraft. Driving the
  // real stream here would test the spawn geometry, not the lift rule.
  const inDraft = (y) => ({
    updraftsInRange: () => [{ x: 100, y, w: 400, h: 4000 }],
    trucksInRange: () => [],
  });

  const flyAt = (vy) => ({
    ...createRun(f, VH),
    phase: 'fly',
    x: 100,
    y: 5000,
    vx: 0,
    vy,
    lockPad: -1,
    lockWheel: -1,
  });

  // One frame of lift from rest, before any clamp can bind. NOT a ratio: the same
  // frame also applies gravity, so vy is (updraftLift - gravity) * dt and the RATIO
  // of the two results is 1.46, not 1.25. The LIFT term is what scales, so compare
  // the difference — gravity is common to both and cancels exactly.
  const oneFrame = (tuning) => step(flyAt(0), f, DT, false, VH, inDraft(5000), tuning).vy;
  const plainVy = oneFrame(baseTuning());
  const windyVy = oneFrame(tailwind);
  assert.ok(plainVy > 0, `an updraft must push Peep up, got ${plainVy}`);
  const extraLift = ZONES.updraftLift * (MODIFIER.tailwindScale - 1) * DT;
  assert.ok(
    Math.abs(windyVy - plainVy - extraLift) < 1e-9,
    `Tailwind must add ${extraLift} pt/s of lift in a frame: ${windyVy} vs ${plainVy}`,
  );

  // And the CEILING moves too. Scaling the lift alone would be nearly invisible:
  // vy clamps at updraftMaxV either way, so a stronger push reaches the same
  // 300 pt/s a few frames sooner and then stops. Hold Peep in the draft until vy
  // saturates and read the plateau.
  const terminal = (tuning) => {
    let s = flyAt(0);
    for (let i = 0; i < 400; i++) s = step({ ...s, y: 5000 }, f, DT, false, VH, inDraft(5000), tuning);
    return s.vy;
  };
  assert.ok(Math.abs(terminal(baseTuning()) - ZONES.updraftMaxV) < 1e-9, 'plain tops out at updraftMaxV');
  assert.ok(
    Math.abs(terminal(tailwind) - ZONES.updraftMaxV * MODIFIER.tailwindScale) < 1e-9,
    `Tailwind's ceiling must be ${ZONES.updraftMaxV * MODIFIER.tailwindScale}, got ${terminal(tailwind)}`,
  );
});
