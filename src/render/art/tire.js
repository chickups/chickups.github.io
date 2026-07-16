// @ts-check
import { el, px } from '../el.js';

/** Rim colour -> its highlight. From the source's `lighten()` lookup. */
const LIGHTEN = {
  '#FFCE3A': '#FFE79A',
  '#8BD450': '#C6EE9B',
  '#FF963C': '#FFC28A',
  '#E8DFC8': '#FFFBF0',
};

const TREADS = 22;

/**
 * @param {number} size
 * @param {number} [speed] seconds per revolution
 * @param {boolean} [spin]
 * @param {'l'|'r'} [dir]
 * @param {string} [rim]
 * @returns {HTMLElement}
 */
export function tire(size, speed = 6, spin = true, dir = 'l', rim = '#FFCE3A') {
  const S = size;
  const anim = spin ? `${dir === 'r' ? 'tireSpinR' : 'tireSpin'} ${speed}s linear infinite` : 'none';
  const light = LIGHTEN[rim] || '#FFFBF0';

  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bolts.push(
      el('div', {
        position: 'absolute', left: '50%', top: '50%',
        width: px(S * 0.045), height: px(S * 0.045),
        borderRadius: '50%', background: '#8a6b3f',
        transform: `translate(-50%,-50%) translate(${px(Math.cos(a) * S * 0.14)},${px(Math.sin(a) * S * 0.14)})`,
      }),
    );
  }

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S),
      borderRadius: '50%',
      background: `repeating-conic-gradient(#2b2b2e 0deg ${(360 / TREADS) * 0.55}deg, #46464b ${(360 / TREADS) * 0.55}deg ${360 / TREADS}deg)`,
      boxShadow: `inset 0 0 ${px(S * 0.08)} rgba(0,0,0,.6), 0 ${px(S * 0.03)} ${px(S * 0.06)} rgba(0,0,0,.25)`,
      animation: anim,
    },
    // rubber inner ring
    el('div', {
      position: 'absolute', inset: px(S * 0.09), borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 32%, #55555b, #26262a)',
    }),
    // rim
    el('div', {
      position: 'absolute', inset: px(S * 0.2), borderRadius: '50%',
      background: `radial-gradient(circle at 38% 32%, ${light}, ${rim})`,
      boxShadow: `inset 0 ${px(S * 0.02)} ${px(S * 0.04)} rgba(255,255,255,.5)`,
    }),
    // hub
    el('div', {
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%,-50%)',
      width: px(S * 0.22), height: px(S * 0.22), borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 32%, #a9834d, #6f5330)',
      boxShadow: 'inset 0 1px 2px rgba(255,255,255,.4)',
    }),
    ...bolts,
  );
}
