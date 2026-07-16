// @ts-check
import { el, px } from '../el.js';
import { COLORS } from '../../core/tokens.js';

/** COLORS.ink as decimal RGB, for shadow/opacity compositing without new colour literals. */
const INK_RGB = '75,53,36';
/** COLORS.gold as decimal RGB. */
const GOLD_RGB = '255,216,77';

const TEETH = 10;
const BOLTS = 6;

/**
 * A rotating metal cog. Built like `tire()`: a shaded body disc, an inset
 * face, a bore hole, and bolt holes — plus teeth standing proud of the rim.
 * @param {number} size
 * @param {number} [speed] seconds per revolution
 * @param {boolean} [spin]
 * @param {'l'|'r'} [dir]
 * @returns {HTMLElement}
 */
export function gear(size, speed = 9, spin = true, dir = 'l') {
  const S = size;
  const anim = spin ? `${dir === 'r' ? 'tireSpinR' : 'tireSpin'} ${speed}s linear infinite` : 'none';
  const bodyR = S * 0.34;
  const toothR = S * 0.44;

  const teeth = [];
  for (let i = 0; i < TEETH; i++) {
    const a = (i / TEETH) * Math.PI * 2;
    teeth.push(
      el('div', {
        position: 'absolute', left: '50%', top: '50%',
        width: px(S * 0.1), height: px(S * 0.14),
        background: `linear-gradient(${COLORS.gold}, ${COLORS.goldD})`,
        borderRadius: px(S * 0.015),
        boxShadow: `inset 0 0 ${px(S * 0.012)} rgba(${INK_RGB},.35)`,
        transform: `translate(-50%,-50%) rotate(${(a * 180) / Math.PI}deg) translateY(${px(-toothR)})`,
        transformOrigin: '50% 50%',
      }),
    );
  }

  const bolts = [];
  for (let i = 0; i < BOLTS; i++) {
    const a = (i / BOLTS) * Math.PI * 2 + Math.PI / BOLTS;
    bolts.push(
      el('div', {
        position: 'absolute', left: '50%', top: '50%',
        width: px(S * 0.04), height: px(S * 0.04),
        borderRadius: '50%', background: COLORS.ink,
        transform: `translate(-50%,-50%) translate(${px(Math.cos(a) * bodyR * 0.62)},${px(Math.sin(a) * bodyR * 0.62)})`,
        boxShadow: `inset 0 ${px(S * 0.005)} ${px(S * 0.01)} rgba(${GOLD_RGB},.4)`,
      }),
    );
  }

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S),
      animation: anim,
    },
    ...teeth,
    // body: shaded disc
    el('div', {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: px(bodyR * 2), height: px(bodyR * 2), borderRadius: '50%',
      background: `radial-gradient(circle at 38% 32%, ${COLORS.muted}, ${COLORS.ink})`,
      boxShadow: `0 ${px(S * 0.02)} ${px(S * 0.04)} rgba(${INK_RGB},.35)`,
    }),
    // face: raised inner ring
    el('div', {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: px(bodyR * 1.62), height: px(bodyR * 1.62), borderRadius: '50%',
      background: `radial-gradient(circle at 38% 32%, ${COLORS.goldD}, ${COLORS.muted})`,
      boxShadow: `inset 0 ${px(S * 0.01)} ${px(S * 0.02)} rgba(${GOLD_RGB},.5)`,
    }),
    ...bolts,
    // bore hole
    el('div', {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: px(bodyR * 0.62), height: px(bodyR * 0.62), borderRadius: '50%',
      background: COLORS.ink,
      boxShadow: `inset 0 ${px(-S * 0.008)} ${px(S * 0.016)} rgba(${GOLD_RGB},.3)`,
    }),
  );
}
