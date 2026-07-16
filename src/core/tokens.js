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
});

/**
 * Physics constants, in points and seconds.
 * NONE of these are derivable from the design doc — the prototype fakes all of them.
 * They are gathered here because they WILL need play-testing. This is the tuning surface.
 */
export const PHYSICS = Object.freeze({
  /** rad/s. ~1.05s per revolution. */
  orbitRate: 10.0,
  /** pt. The prototype's `R = 62`. */
  orbitRadius: 62,
  /** pt. Half-width of the annulus in which a grab registers. */
  grabTolerance: 22,
  /** Scales launch speed away from the true tangential speed. 1.0 = physically honest. */
  launchBoost: 1.0,
  /** pt/s^2, positive; applied downward. */
  gravity: 500,
  /** pt. The prototype's `PEEP = 64`. Render size only; not used for collision. */
  peepSize: 64,
});

export const FIELD = Object.freeze({
  /** The prototype's alternating 118 / 236 columns. */
  columns: [118, 236],
  /** pt of seeded horizontal jitter, +/-. */
  jitter: 28,
  /** pt. The prototype's `GAP = 250`. */
  gapStart: 250,
  /** Extra pt of gap per pt of height climbed. Difficulty ramps ONLY via spacing (doc §13). */
  gapGrowth: 0.06,
  /** pt. Ceiling on gap so the game stays possible. */
  gapMax: 420,
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
