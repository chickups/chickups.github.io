// @ts-check
import { el, px, svg } from '../el.js';

/** @typedef {'idle'|'run'|'launch'|'fly'|'celebrate'|'sad'|'frightened'} PeepPose */
/** @typedef {'none'|'cowboy'|'goggles'|'cape'} PeepOutfit */

const C = {
  body: '#FFCE3A',
  bodyD: '#F4B41C',
  bodyL: '#FFE79A',
  orange: '#FF963C',
  orangeD: '#EE6F27',
  ink: '#4B3524',
  white: '#FFFDF6',
  blush: '#FF9B7A',
};

const POSES = {
  idle:       { rot: 0,   sx: 1,    sy: 1,    eye: 'happy', wings: 'side',  legs: 'stand', bob: true },
  run:        { rot: -7,  sx: 1.05, sy: 0.95, eye: 'focus', wings: 'back',  legs: 'run',   bob: false },
  launch:     { rot: -22, sx: 0.82, sy: 1.22, eye: 'focus', wings: 'back',  legs: 'tuck',  bob: false },
  fly:        { rot: -14, sx: 1.08, sy: 0.92, eye: 'happy', wings: 'up',    legs: 'tuck',  bob: false },
  celebrate:  { rot: 0,   sx: 1,    sy: 1.04, eye: 'joy',   wings: 'cheer', legs: 'stand', bob: true },
  sad:        { rot: 0,   sx: 1.06, sy: 0.9,  eye: 'sad',   wings: 'droop', legs: 'sit',   bob: false },
  frightened: { rot: 0,   sx: 0.94, sy: 1.08, eye: 'shock', wings: 'up',    legs: 'stand', bob: false },
};

/** Fractions of S. Deliberately mismatched sizes give the manic, bug-eyed look. */
const EYES = {
  happy: { w: 0.29, h: 0.31, pupilX: 0.5, pupilY: 0.42, pupilR: 0.36, brow: null,    blink: true,  arc: false, vein: false },
  focus: { w: 0.27, h: 0.24, pupilX: 0.6, pupilY: 0.5,  pupilR: 0.34, brow: 'angry', blink: false, arc: false, vein: false },
  // Narrower than the open eyes on purpose. At the shared 0.29-0.30 width the two
  // arcs overlap at the centre (EYE_CENTERS are 0.28 apart) and merge into a single
  // unbroken line — a unibrow. Filled eyes may touch, and do: that is the intended
  // bug-eyed look. Strokes may not.
  joy:   { w: 0.25, h: 0.10, pupilX: 0.5, pupilY: 0.5,  pupilR: 0.38, brow: null,    blink: false, arc: true,  vein: false },
  sad:   { w: 0.27, h: 0.22, pupilX: 0.4, pupilY: 0.66, pupilR: 0.4,  brow: 'sad',   blink: false, arc: false, vein: false },
  shock: { w: 0.34, h: 0.36, pupilX: 0.5, pupilY: 0.5,  pupilR: 0.18, brow: 'up',    blink: false, arc: false, vein: true },
};

const EYE_CENTERS = [0.38, 0.66];

/**
 * @param {number} S
 * @param {string} legs
 * @param {'l'|'r'} side
 * @param {boolean} animate
 * @returns {Record<string, string>}
 */
function legStyle(S, legs, side, animate) {
  const L = side === 'l';
  /** @type {Record<string, string>} */
  const st = {
    position: 'absolute',
    width: px(S * 0.035),
    height: px(S * 0.14),
    background: C.orange,
    borderRadius: px(S * 0.03),
    bottom: px(S * 0.02),
    transformOrigin: 'top center',
  };
  if (legs === 'stand') {
    st.left = px(S * (L ? 0.4 : 0.56));
  } else if (legs === 'run') {
    st.left = px(S * (L ? 0.4 : 0.56));
    if (animate) st.animation = `${L ? 'peepLegL' : 'peepLegR'} .28s ease-in-out infinite`;
  } else if (legs === 'tuck') {
    st.left = px(S * (L ? 0.42 : 0.54));
    st.height = px(S * 0.08);
    st.transform = `rotate(${L ? 35 : -35}deg)`;
  } else if (legs === 'sit') {
    st.left = px(S * (L ? 0.36 : 0.58));
    st.height = px(S * 0.07);
    st.bottom = px(S * 0.05);
    st.transform = `rotate(${L ? 70 : -70}deg)`;
  }
  return st;
}

/**
 * @param {number} S
 * @param {PeepPose} pose
 * @param {string} wings
 * @param {'l'|'r'} side
 * @param {boolean} animate
 * @returns {HTMLElement}
 */
function wing(S, pose, wings, side, animate) {
  const L = side === 'l';
  /** @type {Record<string, string>} */
  const st = {
    position: 'absolute',
    width: px(S * 0.2),
    height: px(S * 0.3),
    background: `linear-gradient(${C.bodyD},${C.orangeD})`,
    top: px(S * 0.42),
    transformOrigin: L ? 'top right' : 'top left',
    boxShadow: `0 ${px(S * 0.01)} ${px(S * 0.03)} rgba(75,53,36,.25)`,
    borderRadius: L ? '60% 40% 45% 55% / 60% 60% 40% 40%' : '40% 60% 55% 45% / 60% 60% 40% 40%',
  };
  if (wings === 'side') {
    st.left = px(S * (L ? 0.06 : 0.74));
    st.transform = `rotate(${L ? 18 : -18}deg)`;
    if (animate && pose === 'idle') st.animation = `peepBob ${L ? 2.6 : 2.9}s ease-in-out infinite`;
  } else if (wings === 'back') {
    st.left = px(S * (L ? 0.05 : 0.75));
    st.transform = `rotate(${L ? 55 : -55}deg)`;
    st.height = px(S * 0.24);
  } else if (wings === 'up') {
    st.left = px(S * (L ? 0.02 : 0.78));
    st.top = px(S * 0.3);
    st.transform = `rotate(${L ? -35 : 35}deg)`;
    if (animate) st.animation = 'peepWingFlap .22s ease-in-out infinite';
  } else if (wings === 'cheer') {
    st.left = px(S * (L ? 0.0 : 0.8));
    st.top = px(S * 0.24);
    st.transform = `rotate(${L ? -55 : 55}deg)`;
  } else if (wings === 'droop') {
    st.left = px(S * (L ? 0.08 : 0.72));
    st.top = px(S * 0.55);
    st.transform = `rotate(${L ? 30 : -30}deg)`;
    st.height = px(S * 0.22);
  }
  return el('div', st);
}

/**
 * @param {number} S
 * @param {PeepPose} pose
 * @param {string} eyeName
 * @param {boolean} animate
 * @returns {HTMLElement}
 */
function buildFace(S, pose, eyeName, animate) {
  const cfg = EYES[eyeName];
  const eyeY = S * 0.28;
  /** @type {HTMLElement[]} */
  const parts = [];

  for (let i = 0; i < 2; i++) {
    const w = S * cfg.w;
    const h = S * cfg.h;
    const ex = S * EYE_CENTERS[i] - w / 2;

    if (cfg.arc) {
      // A joy eye is ONE curved stroke (^ ^) — an eye squeezed shut by grinning.
      // It is the only feature on Peep that is a STROKE rather than a filled shape,
      // and CSS borders cannot draw one: a bordered box shows its left and right
      // sides as vertical legs (which reads as a spectacle rim), and dropping them
      // to zero width makes the curve taper to sharp points that slope down toward
      // the beak — an angry brow. Both were tried; both were wrong. A path with an
      // even stroke and round caps is the actual shape, and it ports straight to
      // SwiftUI's Path.addQuadCurve + StrokeStyle(lineCap: .round).
      // The viewBox does the scaling, so this stays correct at every icon size.
      parts.push(
        el(
          'div',
          {
            position: 'absolute',
            left: px(ex),
            // Centred on where the OPEN eye sits (its span is eyeY .. eyeY+0.31S), so
            // the grin closes the eye in place. Sitting it lower drags the arcs down
            // toward the beak, which reads as a scowl rather than a squeeze.
            top: px(eyeY + S * 0.09),
            width: px(w),
            height: px(w * 0.42),
          },
          svg(
            'svg',
            { width: '100%', height: '100%', viewBox: '0 0 100 42', fill: 'none' },
            // A gentle arc. Pulling the control point higher sharpens the peak into
            // a "∧", which is how an angry brow is drawn — the difference between
            // delighted and furious here is about fifteen units of control point.
            svg('path', {
              d: 'M8 30 Q50 12 92 30',
              stroke: C.ink,
              'stroke-width': 11,
              'stroke-linecap': 'round',
            }),
          ),
        ),
      );
      continue;
    }

    /** @type {HTMLElement[]} */
    const inside = [];
    if (cfg.vein) {
      inside.push(
        el('div', {
          position: 'absolute', left: '6%', top: '30%', width: '40%',
          height: px(S * 0.012), background: 'rgba(224,69,58,.55)',
          borderRadius: '2px', transform: 'rotate(8deg)',
        }),
        el('div', {
          position: 'absolute', right: '8%', top: '55%', width: '34%',
          height: px(S * 0.012), background: 'rgba(224,69,58,.5)',
          borderRadius: '2px', transform: 'rotate(-10deg)',
        }),
      );
    }
    inside.push(
      el(
        'div',
        {
          position: 'absolute',
          width: px(w * cfg.pupilR),
          height: px(w * cfg.pupilR),
          background: C.ink,
          borderRadius: '50%',
          left: `${cfg.pupilX * 100 - cfg.pupilR * 50}%`,
          top: `${cfg.pupilY * 100 - cfg.pupilR * 50}%`,
        },
        el('div', {
          position: 'absolute', width: '40%', height: '40%',
          background: C.white, borderRadius: '50%', left: '14%', top: '12%',
        }),
      ),
    );

    parts.push(
      el(
        'div',
        {
          position: 'absolute',
          left: px(ex),
          top: px(eyeY),
          width: px(w),
          height: px(h),
          background: C.white,
          borderRadius: '50%',
          border: `${px(S * 0.016)} solid rgba(75,53,36,.7)`,
          boxShadow: `inset 0 ${px(S * 0.014)} ${px(S * 0.03)} rgba(75,53,36,.18)`,
          animation: animate && cfg.blink ? `peepBlink ${4 + i * 0.6}s ease-in-out infinite` : 'none',
          overflow: 'hidden',
        },
        ...inside,
      ),
    );

    if (cfg.brow) {
      const bw = w * 1.05;
      const bh = S * 0.03;
      const br =
        cfg.brow === 'angry' ? (i === 0 ? 22 : -22)
        : cfg.brow === 'sad' ? (i === 0 ? -22 : 22)
        : (i === 0 ? -10 : 10);
      parts.push(
        el('div', {
          position: 'absolute',
          left: px(ex - w * 0.03),
          top: px(eyeY - S * 0.065),
          width: px(bw),
          height: px(bh),
          background: C.ink,
          borderRadius: px(bh),
          transform: `rotate(${br}deg)`,
        }),
      );
    }
  }

  const beakOpen = pose === 'launch' || pose === 'celebrate' || pose === 'frightened';
  const beakY = S * 0.68;
  if (beakOpen) {
    parts.push(
      el(
        'div',
        { position: 'absolute', left: px(S * 0.44), top: px(beakY), width: px(S * 0.14), height: px(S * 0.15) },
        el('div', {
          position: 'absolute', top: '0px', left: '0px', width: '100%', height: '45%',
          background: `linear-gradient(${C.orange},${C.orangeD})`, borderRadius: '50% 50% 20% 20%',
        }),
        el('div', {
          position: 'absolute', bottom: '0px', left: '12%', width: '76%', height: '45%',
          background: C.orangeD, borderRadius: '20% 20% 50% 50%',
        }),
      ),
    );
  } else {
    // The CSS border-triangle trick: a zero-size box with transparent sides.
    parts.push(
      el('div', {
        position: 'absolute',
        left: px(S * 0.46),
        top: px(beakY),
        width: '0px',
        height: '0px',
        borderLeft: `${px(S * 0.055)} solid transparent`,
        borderRight: `${px(S * 0.055)} solid transparent`,
        borderTop: `${px(S * 0.075)} solid ${C.orange}`,
        filter: `drop-shadow(0 ${px(S * 0.006)} 0 ${C.orangeD})`,
      }),
    );
  }

  if (eyeName === 'happy' || eyeName === 'joy') {
    for (const bx of [0.2, 0.68]) {
      parts.push(
        el('div', {
          position: 'absolute', left: px(S * bx), top: px(S * 0.66),
          width: px(S * 0.1), height: px(S * 0.06),
          background: C.blush, opacity: '0.5', borderRadius: '50%',
          filter: `blur(${px(S * 0.008)})`,
        }),
      );
    }
  }

  if (pose === 'sad' || pose === 'frightened') {
    parts.push(
      el('div', {
        position: 'absolute',
        left: px(S * (pose === 'sad' ? 0.78 : 0.08)),
        top: px(S * 0.24),
        width: px(S * 0.07),
        height: px(S * 0.1),
        background: '#8FD3F4',
        borderRadius: '50% 50% 50% 50% / 65% 65% 35% 35%',
        transform: `rotate(${pose === 'sad' ? 20 : -20}deg)`,
        opacity: '0.9',
      }),
    );
  }

  return el('div', { position: 'absolute', inset: '0px' }, ...parts);
}

/**
 * @param {PeepOutfit} outfit
 * @param {number} S
 * @returns {HTMLElement|null}
 */
function buildOutfit(outfit, S) {
  if (outfit === 'cowboy') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '5' },
      el('div', {
        position: 'absolute', left: px(S * 0.24), top: px(S * 0.02),
        width: px(S * 0.52), height: px(S * 0.09), background: '#9A5B33', borderRadius: '50%',
      }),
      el('div', {
        position: 'absolute', left: px(S * 0.36), top: px(S * -0.06),
        width: px(S * 0.28), height: px(S * 0.16), background: '#B26B3C', borderRadius: '40% 40% 30% 30%',
      }),
      el('div', {
        position: 'absolute', left: px(S * 0.36), top: px(S * 0.045),
        width: px(S * 0.28), height: px(S * 0.02), background: '#7A4423', borderRadius: px(S * 0.02),
      }),
    );
  }
  if (outfit === 'goggles') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '5' },
      el('div', {
        position: 'absolute', left: px(S * 0.22), top: px(S * 0.16),
        width: px(S * 0.56), height: px(S * 0.06), background: '#6B4A2E', borderRadius: px(S * 0.03),
      }),
      ...[0.26, 0.52].map((gx) =>
        el('div', {
          position: 'absolute', left: px(S * gx), top: px(S * 0.12),
          width: px(S * 0.22), height: px(S * 0.2), borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #CFE9FF, #8FB8D6)',
          border: `${px(S * 0.02)} solid #6B4A2E`,
        }),
      ),
    );
  }
  if (outfit === 'cape') {
    return el('div', {
      position: 'absolute', left: px(S * 0.16), top: px(S * 0.4),
      width: px(S * 0.68), height: px(S * 0.5),
      background: 'linear-gradient(#FF5A4D,#D63A2E)', borderRadius: '40% 40% 20% 20%',
      zIndex: '-1', clipPath: 'polygon(0 0,100% 0,88% 100%,50% 82%,12% 100%)',
    });
  }
  return null;
}

/**
 * @param {number} size
 * @param {PeepPose} [pose]
 * @param {PeepOutfit} [outfit]
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function peep(size, pose = 'idle', outfit = 'none', animate = true) {
  const S = size;
  const P = POSES[pose] || POSES.idle;

  /** @type {(HTMLElement|null)[]} */
  const parts = [
    el('div', legStyle(S, P.legs, 'l', animate)),
    el('div', legStyle(S, P.legs, 'r', animate)),
    el('div', {
      position: 'absolute',
      left: px(S * 0.13),
      top: px(S * 0.16),
      width: px(S * 0.74),
      height: px(S * 0.72),
      borderRadius: '50% 50% 47% 47%',
      background: `radial-gradient(115% 120% at 32% 22%, ${C.bodyL} 0%, ${C.body} 46%, ${C.bodyD} 100%)`,
      boxShadow:
        `inset ${px(S * 0.05)} ${px(-S * 0.06)} ${px(S * 0.08)} rgba(255,255,255,.55), ` +
        `inset ${px(-S * 0.04)} ${px(S * 0.05)} ${px(S * 0.09)} ${C.bodyD}, ` +
        `0 ${px(S * 0.03)} ${px(S * 0.05)} rgba(75,53,36,.18)`,
    }),
    el(
      'div',
      { position: 'absolute', inset: '0px' },
      ...[-24, 0, 24].map((r, i) =>
        el('div', {
          position: 'absolute',
          left: px(S * (0.44 + i * 0.03 - 0.03)),
          top: px(S * 0.1),
          width: px(S * 0.055),
          height: px(S * 0.14),
          background: `linear-gradient(${C.bodyL},${C.body})`,
          borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
          transform: `rotate(${r + (pose === 'sad' ? (i - 1) * 10 + 8 : 0)}deg)`,
          transformOrigin: 'bottom center',
        }),
      ),
    ),
    wing(S, pose, P.wings, 'l', animate),
    wing(S, pose, P.wings, 'r', animate),
    buildFace(S, pose, P.eye, animate),
    buildOutfit(outfit, S),
  ];

  const inner = el(
    'div',
    {
      position: 'absolute',
      inset: '0px',
      transform: `rotate(${P.rot}deg) scale(${P.sx},${P.sy})`,
      transformOrigin: '50% 70%',
    },
    ...parts,
  );

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S),
      animation: animate && P.bob ? 'peepBob 2.4s ease-in-out infinite' : 'none',
    },
    inner,
  );
}
