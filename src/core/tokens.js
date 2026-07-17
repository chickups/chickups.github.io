// @ts-check

/** Design space. These are iPhone logical points, from the source doc's 393x852pt. */
export const DESIGN = Object.freeze({
  width: 393,
  refHeight: 852,
});

export const COLORS = Object.freeze({
  ink: '#4B3524',
  cream: '#FFFBF0',
  creamDeep: '#FFF0DC',
  yellow: '#FFCE3A',
  yellowD: '#F4B41C',
  yellowL: '#FFE79A',
  gold: '#FFD84D',
  goldD: '#D19412',
  orange: '#FF963C',
  orangeD: '#EE6F27',
  orangeDD: '#C9611B',
  skyTop: '#CFEBFB',
  skyMid: '#A6DCF6',
  grass: '#8BD450',
  grassD: '#7BC93F',
  muted: '#8a7358',
  red: '#E0453A',
  /** The three tones `gamebg.js` hand-tuned for its original (pre-biome) sky,
   *  hoisted verbatim so `BIOME_SKY.roadside` reproduces slice 1's look exactly. */
  skyPale: '#BFE7FB',
  skyPaleMid: '#A9DDF5',
  skyMeadow: '#9ED66B',
  /** A near-black dusk, for The Great Escape's finale sky. `ink` alone reads as
   *  warm brown, not night — this is the one biome that genuinely needs it. */
  nightFall: '#2E1B12',
});

/**
 * Per-biome sky gradient stops (doc §13's six-biome ascent), keyed by `BIOMES[].key`
 * in `core/biome.js`. `gamebg.js` joins these into a `linear-gradient(180deg, ...)`.
 * `roadside` MUST stay pixel-identical to slice 1's baseline sky.
 */
export const BIOME_SKY = Object.freeze({
  roadside: Object.freeze([
    `${COLORS.skyPale} 0%`, `${COLORS.skyPaleMid} 16%`, `${COLORS.skyMeadow} 34%`,
    `${COLORS.grass} 60%`, `${COLORS.grassD} 100%`,
  ]),
  orchard: Object.freeze([
    `${COLORS.skyTop} 0%`, `${COLORS.skyMid} 20%`, `${COLORS.yellowL} 45%`,
    `${COLORS.grass} 72%`, `${COLORS.grassD} 100%`,
  ]),
  ridge: Object.freeze([
    `${COLORS.skyTop} 0%`, `${COLORS.skyMid} 35%`, `${COLORS.creamDeep} 65%`,
    `${COLORS.muted} 100%`,
  ]),
  factory: Object.freeze([
    `${COLORS.muted} 0%`, `${COLORS.goldD} 35%`, `${COLORS.orangeDD} 70%`,
    `${COLORS.ink} 100%`,
  ]),
  highway: Object.freeze([
    `${COLORS.gold} 0%`, `${COLORS.yellowD} 25%`, `${COLORS.orange} 50%`,
    `${COLORS.orangeD} 75%`, `${COLORS.orangeDD} 100%`,
  ]),
  escape: Object.freeze([
    `${COLORS.nightFall} 0%`, `${COLORS.ink} 28%`, `${COLORS.orangeDD} 55%`,
    `${COLORS.red} 78%`, `${COLORS.orange} 100%`,
  ]),
});

/**
 * Physics constants, in points and seconds.
 * NONE of these are derivable from the design doc — the prototype fakes all of them.
 * They are gathered here because they WILL need play-testing. This is the tuning surface.
 */
export const PHYSICS = Object.freeze({
  /**
   * rad/s. ~1.05s per revolution.
   * Not a free knob: launch speed is `orbitRate * orbitRadius`, so this also
   * sets how far Peep can climb. Slowing the spin without also shrinking
   * FIELD.gapStart makes the game unwinnable. See the tuning note below.
   */
  orbitRate: 6.0,
  /** pt. The prototype's `R = 62`. */
  orbitRadius: 62,
  /** pt. Half-width of the annulus in which a grab registers. */
  grabTolerance: 28,
  /** Scales launch speed away from the true tangential speed. 1.0 = physically honest. */
  launchBoost: 1.0,
  /** pt/s^2, positive; applied downward. */
  gravity: 280,
  /** pt. The prototype's `PEEP = 64`. Render size only; not used for collision. */
  peepSize: 64,
});

/**
 * TUNING NOTE — the one equation that governs playability.
 *
 *   launch speed  v    = orbitRate * orbitRadius * launchBoost
 *   max rise           = v^2 / (2 * gravity)
 *
 * The binding constraint is VERTICAL CLIMB: `max rise` must exceed `gapMax`
 * with margin, or the field eventually grows a gap Peep cannot clear and the
 * run ends in a wall no skill can pass. It is NOT the 45-degree range (v^2/g,
 * which is horizontal) — assuming that produced an unwinnable build once.
 *
 * At orbitRate 6.0 / gravity 280: v = 372, max rise = 247pt.
 * gapMax 200 therefore keeps a 1.24x margin at maximum difficulty.
 *
 * Difficulty is really the RELEASE WINDOW: the arc of release angles that
 * land a grab, divided by spin rate. Measured at these values: 119ms at
 * gapStart, narrowing to 95ms at gapMax. Below ~70ms the game reads as
 * unfair. Raising orbitRate shrinks that window twice over — fewer viable
 * degrees, sweeping past faster.
 */
export const FIELD = Object.freeze({
  /** The prototype's alternating 118 / 236 columns. */
  columns: [118, 236],
  /** pt of seeded horizontal jitter, +/-. */
  jitter: 28,
  /** pt. Scaled down with orbitRate to hold the climb margin; see TUNING NOTE. */
  gapStart: 160,
  /** Extra pt of gap per pt of height climbed. Difficulty ramps ONLY via spacing (doc §13). */
  gapGrowth: 0.015,
  /** pt. Ceiling on gap. MUST stay below `max rise` (247pt) or the ramp walls off. */
  gapMax: 200,
});

export const SCORING = Object.freeze({
  /** 10 pt = 1 m. At the doc's 250pt gap this makes 676 m ~= 27 wheels. */
  pointsPerMetre: 10,
  /** Grabs per multiplier step. The prototype's `hops % 3`. */
  chainPerMult: 3,
  /** Highest multiplier shown in the doc (§13, The Great Escape). */
  multMax: 5,
});

export const CAMERA = Object.freeze({
  /** Fraction of viewport height, from the bottom, where Peep's high-water mark sits. */
  peepAnchor: 0.45,
});

/**
 * Bounce pads and rotating gears (doc §13). Pads bypass the hold-release verb
 * entirely — no tap, no attach, just a free upward bounce. Gears orbit and
 * launch exactly like tires but at a scaled rate and radius.
 */
export const PROPS = Object.freeze({
  /** Upward speed a pad imparts, pt/s. Chosen so a pad out-climbs a tire launch:
   *  rise = padBounce^2/(2*gravity) = 420^2/560 = 315pt vs a tire's 247pt. */
  padBounce: 420,
  /** pt. Contact radius of a pad. Generous: missing a pad is "no penalty" (doc §13). */
  padRadius: 46,
  /** Gears spin the opposite way to tires, which reverses the launch arc. */
  gearRateScale: -1.0,
  /** Gears are bigger, so they launch faster: v = rate*radius. */
  gearRadiusScale: 1.25,
  /**
   * pt, +/-. Pads are NOT spine props (see biome.js `padChance`) — a pad sits in
   * the gap between spine props `i` and `i+1`, at roughly the midpoint, jittered
   * by these two so it reads as "on the way" rather than snapped to a grid.
   */
  padYJitter: 20,
  /** pt, +/-. Jitter around the midpoint x of the pad's two neighbouring props. */
  padXJitter: 30,
});

/**
 * Updraft zones (doc §13): a column of rising air Peep can fly through. Not a
 * spine prop — no orbit, no attach, no chain/mult/feathers. Only `ridge` and
 * `escape` biomes spawn them.
 */
export const ZONES = Object.freeze({
  /** pt/s^2 of upward push, applied IN ADDITION to gravity while Peep's centre
   *  is inside the rect. MUST exceed PHYSICS.gravity or an updraft cannot lift
   *  — see the guard test in zones.test.js. */
  updraftLift: 620,
  /** pt/s. Terminal upward speed inside a draft, so it cannot fling Peep forever. */
  updraftMaxV: 300,
  updraftW: 90,
  updraftH: 260,
  /** ~one updraft per this many pt of climb, in biomes that have them. */
  updraftEvery: 520,
});

/**
 * Trucks (doc §13): the second failure condition. Moving hazards that drive
 * horizontally across the field and wrap. Only `highway` and `escape` biomes
 * spawn them.
 */
const TRUCK_H = 64;
const TRUCK_EVERY = 600;
const PEEP_HIT_R = 18;
/** pt. Extra breathing room past "just touching", so a graze still counts as unsafe. */
const TRUCK_PROP_MARGIN = 10;
/**
 * pt. The ZERO-THEORETICAL-RISK clearance: the distance at which a truck's rect
 * and Peep's hitbox can just touch while he's at the outermost point of the
 * orbit -- orbit radius (sized for the LARGEST attachable prop, a gear's, via
 * `PHYSICS.orbitRadius * PROPS.gearRadiusScale`; run.js's `radiusOf('gear')`
 * -- a tire's is smaller, so using tire-only sizing would leave gear wheels
 * lethal) + Peep's hit radius + half the truck's height, plus a small margin
 * past "just touching".
 */
const TRUCK_PROP_CLEARANCE_IDEAL =
  PHYSICS.orbitRadius * PROPS.gearRadiusScale + PEEP_HIT_R + TRUCK_H / 2 + TRUCK_PROP_MARGIN;
/**
 * pt. Attachable props sit on a spine spaced at a CONSTANT `FIELD.gapMax` in
 * every truck biome -- growth caps out around 267m, long before highway's
 * 750m start (see FIELD.gapGrowth) -- so no candidate height can EVER be more
 * than `FIELD.gapMax / 2` from its two nearest neighbouring props; that is a
 * hard geometric ceiling on what any nudge search can achieve, independent of
 * the algorithm. `TRUCK_PROP_CLEARANCE_IDEAL` (~137.5pt) exceeds that ceiling
 * (100pt) -- verified empirically: requiring it leaves literally zero safe
 * height anywhere in a truck biome, and every truck gets dropped, which is
 * exactly the "different bug" (trucks silently vanishing) this fix must not
 * cause; see the slice-2 truck-harbour report for the measurement. This
 * buffer keeps the cap strictly below that ceiling so a nudge search always
 * has genuine room to land a safe height, not just barely graze the edge.
 */
const TRUCK_PROP_CLEARANCE_BUFFER = 10;

export const HAZARD = Object.freeze({
  truckW: 130,
  truckH: TRUCK_H,
  /** pt/s. */
  truckSpeed: 90,
  /** one truck per this many pt of climb, in truck biomes. */
  truckEvery: TRUCK_EVERY,
  /** pt. Peep's collision box is deliberately smaller than his art: near-misses
   *  should feel near, and the base game's only failure is falling. */
  peepHitR: PEEP_HIT_R,
  /**
   * pt. SAFE-HARBOUR clearance (see `zones.js`'s truck stream): a truck's lane
   * must never come within this vertical distance of an attachable prop's
   * centre. Peep cannot stop orbiting -- the tire/gear spins on its own -- so a
   * truck sweeping through the wheel he is forced to sit on turns the one perch
   * the truck design assumes he can wait on into an unavoidable death trap. That
   * was the measured fairness defect: attachable props in truck biomes had a
   * truck lane crossing their orbit ring, closest approach well under 1pt --
   * see the slice-2 truck-harbour report for the exact reproduction.
   *
   * `Math.min` of the physically-ideal figure and what the field's own prop
   * density can actually support -- see `TRUCK_PROP_CLEARANCE_IDEAL` and
   * `TRUCK_PROP_CLEARANCE_BUFFER` above for why the cap exists and its exact
   * derivation. Neither term is a bare magic number. If `FIELD.gapMax` in
   * truck biomes is ever widened, this cap loosens automatically toward the
   * full ideal figure with no further change needed here.
   */
  /*
   * HONEST STATUS, MEASURED — this is a mitigation, not a safe harbour, and the
   * gap is not fixable by tuning this number.
   *
   * The ideal is unreachable BY GEOMETRY. Props sit on a 200pt spine, so the
   * furthest any truck can ever be from one is 100pt (the midpoint). A tire's
   * ring needs 112pt of clearance and a gear's needs 127.5pt. Put another way:
   * a 155pt gear plus a 64pt truck is 219pt of hardware in a 200pt gap. Widening
   * the gap cannot rescue it either — gears would need a 255pt gap, and Peep's
   * maximum climb is 247pt, so the field would become unwinnable first.
   *
   * What the cap DOES buy, measured over 6 seeds x 600 props: the closest a
   * truck comes to a prop goes from 0.01pt — a truck sitting dead on the wheel,
   * an unwinnable perch Peep cannot leave because he cannot stop orbiting — to a
   * flat 90pt. The indefensible case is gone.
   *
   * What remains: 413/2198 tire props and 238/1162 gear props still have a truck
   * whose lane crosses the ring Peep is forced to travel. He can always launch
   * early and can always see the truck coming (his landing target is on-screen at
   * launch), so this is a demand on timing, not a wall.
   *
   * Genuinely fixing it needs a DESIGN decision, not a constant: shorter trucks,
   * no gears in truck biomes, or trucks that only occupy part of the lane. That
   * call belongs to a human at a controller.
   */
  truckPropClearance: Math.min(
    TRUCK_PROP_CLEARANCE_IDEAL,
    FIELD.gapMax / 2 - TRUCK_PROP_CLEARANCE_BUFFER,
  ),
  /**
   * pt, each direction. How far a candidate truck height may be nudged while
   * searching for a safe one (see zones.js's `findSafeTruckY`), before giving up
   * and dropping that truck's slot instead. Bounded under half of the smallest
   * gap between candidate heights (`truckEvery * 0.75`, the spacing formula's own
   * floor) so a nudge stays inside this truck's own slot rather than drifting
   * into a neighbour's.
   */
  truckNudgeRange: TRUCK_EVERY * 0.35,
});

/**
 * The Great Escape's finale. Spec D5: the truck sits at 1200m, giving the escape
 * biome (which opens at 1000m — `biome.js`) a 200m final gauntlet.
 *
 * A GUESS, made against physics constants nobody has playtested. It lives here
 * precisely because it is a tuning knob: `core/modifier.js`'s `baseTuning()`
 * reads it, and Low Ceiling overrides it.
 */
export const ESCAPE = Object.freeze({
  truckHeightM: 1200,
});

/**
 * The seven Daily Run modifiers' magnitudes. Kept here, not in `core/modifier.js`,
 * for the same reason every other number is: `modifier.js` holds the RULES, tokens
 * holds the TUNING SURFACE.
 *
 * Read the TUNING NOTE above before touching `thinAirGapScale`. It is the only
 * entry here that can make the game unwinnable, and `modifier.test.js` has a test
 * that fails if it does.
 */
export const MODIFIER = Object.freeze({
  /** Bouncy Hay. Multiplies the pad bounce: 420 -> 546, a 532pt rise vs 315pt. */
  bouncyHayMod: 1.3,
  /** Feather Frenzy. The doc's "Double feathers". */
  featherFrenzyScale: 2,
  /**
   * Thin Air. 200 -> 230 against a max rise of 247pt: a 1.07x margin, the tightest
   * the field has ever been (base is 1.24x). DO NOT WIDEN without re-measuring —
   * `every modifier leaves the field winnable` in modifier.test.js is the guard.
   *
   * Note on trucks: `HAZARD.truckPropClearance` is derived from `FIELD.gapMax` (200)
   * at module load and does NOT track this override. That is the safe direction —
   * Thin Air spreads the props FURTHER apart, so the nudge search has MORE room to
   * land a safe truck height, not less. Raising the clearance to match would only
   * make it stricter than the geometry can satisfy and start dropping trucks, which
   * is the "trucks silently vanish" bug the harbour work already paid for once.
   */
  thinAirGapScale: 1.15,
  /**
   * Tailwind. Scales updraft lift AND updraft max speed AND updraft frequency.
   * Scaling lift alone would do almost nothing: `run.js` clamps to `ZONES.updraftMaxV`,
   * so a stronger push just reaches the same 300 pt/s ceiling a few frames sooner.
   */
  tailwindScale: 1.25,
  /**
   * Slick Gears. Multiplies the GEAR weight in a biome's `kinds` table — so
   * factory's [tire 2, gear 2] becomes [tire 2, gear 6]. It changes how OFTEN a
   * gear spawns and NOTHING else. Spec D2: gear speed is untouchable, because
   * launch speed is derived from it and slowing a gear collapses max rise from
   * 386pt to 6.6pt.
   */
  slickGearsWeightBoost: 3,
  /**
   * Low Ceiling. 1100m, NOT 1000m. The Great Escape *begins* at 1000m
   * (`biome.js`), so a 1000m truck would sit exactly on the biome gate and the
   * player would win the instant they entered it — deleting the very gauntlet
   * this modifier is meant to shorten.
   */
  lowCeilingHeightM: 1100,
});

/**
 * The lifetime-feather ladder (spec D7). Read against `statTotalFeathers`, NOT the
 * spendable balance — spending in the shop must never un-earn a milestone.
 *
 * Calibrated against shop.js's cost ramp (a good run banks ~70-80 feathers):
 *  - 250  — about three runs. Lands just after cowboy (120) is affordable, so the
 *           first rung grants goggles-or-better to a player who bought the hat, and
 *           the hat itself to one who saved. Either way it is a real gift, not a dupe.
 *  - 750  — about ten runs. Roughly where cape (700) comes into range.
 *  - 1500 — about twenty runs. Past the last shop price, so this rung usually pays
 *           `allOwnedBonus` — a soft landing rather than a fourth outfit that has no art.
 * Ascending. `passedMilestones` walks this in index order and that order is data.
 */
export const MILESTONE = Object.freeze({
  rungs: Object.freeze([250, 750, 1500]),
  /**
   * Feathers granted when every outfit is already owned (D7). Sized at roughly three
   * runs' banking — enough to feel like a reward, not enough to be a farm. Granted via
   * `addFeathers` (spendable only), which deliberately does NOT move `statTotalFeathers`:
   * if it did, a bonus could push the player over the next rung and cascade.
   */
  allOwnedBonus: 200,
});
