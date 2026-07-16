// @ts-check
import { el, px } from '../el.js';
import { COLORS } from '../../core/tokens.js';

/** COLORS.cream as decimal RGB, for translucency without new colour literals. */
const CREAM_RGB = '255,251,240';
/** COLORS.skyMid as decimal RGB. */
const SKYMID_RGB = '166,220,246';

const WISPS = 6;

/**
 * A column of rising air. A translucent vertical channel (the same
 * dashed-edge technique `gamebg()` uses for its travel path) with wisps
 * drifting up and fading, reusing the `puff` keyframe.
 * @param {number} w
 * @param {number} h
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function updraft(w, h, animate = true) {
  const W = w;
  const H = h;

  const wisps = [];
  for (let i = 0; i < WISPS; i++) {
    const x = W * (0.16 + (i % 3) * 0.32);
    const delay = (i / WISPS) * 1.6;
    const wSize = W * (0.22 + (i % 2) * 0.06);
    wisps.push(
      el('div', {
        position: 'absolute',
        left: px(x - wSize / 2),
        bottom: px((i / WISPS) * H * 0.7),
        width: px(wSize),
        height: px(wSize * 0.4),
        borderRadius: '50%',
        background: `rgba(${CREAM_RGB},.7)`,
        animation: animate ? `puff ${2.4 + (i % 3) * 0.4}s ease-out ${delay}s infinite` : 'none',
      }),
    );
  }

  const chevrons = [];
  for (let i = 0; i < 5; i++) {
    chevrons.push(
      el('div', {
        position: 'absolute',
        left: '50%',
        bottom: px(H * 0.1 + i * H * 0.16),
        width: '0px', height: '0px',
        transform: 'translateX(-50%)',
        borderLeft: `${px(W * 0.16)} solid transparent`,
        borderRight: `${px(W * 0.16)} solid transparent`,
        borderBottom: `${px(W * 0.1)} solid rgba(${SKYMID_RGB},.55)`,
      }),
    );
  }

  return el(
    'div',
    {
      position: 'relative', width: px(W), height: px(H), overflow: 'hidden',
    },
    // channel: translucent column fading at top and bottom, edges dashed
    el('div', {
      position: 'absolute', inset: '0px',
      background: `linear-gradient(rgba(${SKYMID_RGB},0), rgba(${SKYMID_RGB},.4) 12%, rgba(${SKYMID_RGB},.4) 88%, rgba(${SKYMID_RGB},0))`,
      borderLeft: `${px(W * 0.02)} dashed rgba(${CREAM_RGB},.6)`,
      borderRight: `${px(W * 0.02)} dashed rgba(${CREAM_RGB},.6)`,
      borderRadius: px(W * 0.4),
    }),
    ...chevrons,
    ...wisps,
  );
}
