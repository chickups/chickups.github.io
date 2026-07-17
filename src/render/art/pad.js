// @ts-check
import { el, px } from '../el.js';
import { COLORS } from '../../core/tokens.js';

/** COLORS.ink as decimal RGB, for shadow/opacity compositing without new colour literals. */
const INK_RGB = '75,53,36';
/** COLORS.cream as decimal RGB. */
const CREAM_RGB = '255,251,240';

const SPRING_COUNT = 16;

/**
 * A round trampoline pad Peep bounces off. Built the same way as `tire()`:
 * a spring rim (repeating-conic-gradient), an inset mat, and a hub — plus
 * a couple of legs so it reads as resting on the ground.
 * @param {number} size
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function pad(size, animate = true) {
  const S = size;
  const legH = S * 0.16;

  const legs = [0.22, 0.78].map((x) =>
    el('div', {
      position: 'absolute',
      left: px(S * x - S * 0.02),
      top: px(S - legH * 0.4),
      width: px(S * 0.045),
      height: px(legH),
      background: `linear-gradient(${COLORS.muted}, ${COLORS.ink})`,
      borderRadius: px(S * 0.02),
    }),
  );

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S + legH * 0.7),
      animation: animate ? 'peepBob 3.2s ease-in-out infinite' : 'none',
    },
    // ground shadow
    el('div', {
      position: 'absolute', left: px(S * 0.1), top: px(S + legH * 0.42),
      width: px(S * 0.8), height: px(S * 0.09), borderRadius: '50%',
      background: `rgba(${INK_RGB},.2)`,
    }),
    ...legs,
    // spring rim: alternating wedges stand in for individual coil springs
    el('div', {
      position: 'absolute', left: '0px', top: '0px', width: px(S), height: px(S),
      borderRadius: '50%',
      background: `repeating-conic-gradient(${COLORS.muted} 0deg ${(360 / SPRING_COUNT) * 0.5}deg, ${COLORS.ink} ${(360 / SPRING_COUNT) * 0.5}deg ${360 / SPRING_COUNT}deg)`,
      boxShadow: `0 ${px(S * 0.03)} ${px(S * 0.06)} rgba(${INK_RGB},.3)`,
    }),
    // frame ring, between the springs and the mat
    el('div', {
      position: 'absolute', inset: px(S * 0.09), borderRadius: '50%',
      background: COLORS.muted,
      boxShadow: `inset 0 0 ${px(S * 0.03)} rgba(${INK_RGB},.4)`,
    }),
    // mat
    el('div', {
      position: 'absolute', inset: px(S * 0.15), borderRadius: '50%',
      background: `radial-gradient(115% 120% at 34% 28%, ${COLORS.yellowL} 0%, ${COLORS.gold} 45%, ${COLORS.goldD} 100%)`,
      boxShadow: `inset 0 ${px(S * 0.02)} ${px(S * 0.05)} rgba(${CREAM_RGB},.6), inset 0 ${px(-S * 0.02)} ${px(S * 0.04)} rgba(${INK_RGB},.25)`,
    }),
    // weave texture: two crossing sets of faint lines, trampoline-style
    el('div', {
      position: 'absolute', inset: px(S * 0.15), borderRadius: '50%', overflow: 'hidden',
      background: `repeating-linear-gradient(45deg, rgba(${CREAM_RGB},.35) 0px, rgba(${CREAM_RGB},.35) ${px(S * 0.01)}, transparent ${px(S * 0.01)}, transparent ${px(S * 0.09)})`,
    }),
    el('div', {
      position: 'absolute', inset: px(S * 0.15), borderRadius: '50%', overflow: 'hidden',
      background: `repeating-linear-gradient(-45deg, rgba(${INK_RGB},.12) 0px, rgba(${INK_RGB},.12) ${px(S * 0.01)}, transparent ${px(S * 0.01)}, transparent ${px(S * 0.09)})`,
    }),
    // centre emblem
    el('div', {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: px(S * 0.16), height: px(S * 0.16), borderRadius: '50%',
      background: `radial-gradient(circle at 38% 32%, ${COLORS.orange}, ${COLORS.orangeD})`,
      boxShadow: `inset 0 ${px(S * 0.008)} ${px(S * 0.016)} rgba(${CREAM_RGB},.5)`,
    }),
  );
}
