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
export const HAZARD = Object.freeze({
  truckW: 130,
  truckH: 64,
  /** pt/s. */
  truckSpeed: 90,
  /** one truck per this many pt of climb, in truck biomes. */
  truckEvery: 600,
  /** pt. Peep's collision box is deliberately smaller than his art: near-misses
   *  should feel near, and the base game's only failure is falling. */
  peepHitR: 18,
});
