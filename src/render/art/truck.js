// @ts-check
import { el, px } from '../el.js';

/**
 * The truck that left without Peep. Rear view.
 * @param {number} size
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function truck(size, animate = true) {
  const W = size;
  const H = size * 0.82;

  const chicks = [0.24, 0.44, 0.64].map((x, i) =>
    el(
      'div',
      {
        position: 'absolute', left: px(W * x), top: px(H * -0.02),
        width: px(W * 0.13), height: px(W * 0.13), borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%,#FFE79A,#F4B41C)',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        animation: animate ? `peekBob ${1.4 + i * 0.3}s ease-in-out infinite` : 'none',
      },
      el('div', { position: 'absolute', left: '30%', top: '34%', width: '12%', height: '12%', borderRadius: '50%', background: '#4B3524' }),
      el('div', { position: 'absolute', left: '58%', top: '34%', width: '12%', height: '12%', borderRadius: '50%', background: '#4B3524' }),
      el('div', {
        position: 'absolute', left: '42%', top: '50%', width: '0px', height: '0px',
        borderLeft: `${px(W * 0.018)} solid transparent`,
        borderRight: `${px(W * 0.018)} solid transparent`,
        borderTop: `${px(W * 0.026)} solid #FF963C`,
      }),
    ),
  );

  return el(
    'div',
    {
      position: 'relative', width: px(W), height: px(H * 1.18),
      animation: animate ? 'truckBob 1.8s ease-in-out infinite' : 'none',
    },
    // exhaust
    el('div', {
      position: 'absolute', left: px(W * 0.02), top: px(H * 0.5),
      width: px(W * 0.12), height: px(W * 0.12), borderRadius: '50%',
      background: 'rgba(120,120,120,.45)',
      animation: animate ? 'puff 1.6s ease-out infinite' : 'none',
    }),
    // cargo box
    el(
      'div',
      {
        position: 'absolute', left: px(W * 0.12), top: px(H * 0.06),
        width: px(W * 0.76), height: px(H * 0.66), borderRadius: px(W * 0.05),
        background: 'linear-gradient(#FFF6E4,#EAD9B4)',
        boxShadow: 'inset 0 -6px 12px rgba(75,53,36,.12), 0 6px 10px rgba(75,53,36,.18)',
      },
      // roof
      el('div', {
        position: 'absolute', top: px(-H * 0.05), left: px(-W * 0.02), right: px(-W * 0.02),
        height: px(H * 0.1), borderRadius: px(W * 0.04),
        background: 'linear-gradient(#FF963C,#EE6F27)',
      }),
      // doors
      el(
        'div',
        {
          position: 'absolute', inset: '14% 8%', borderRadius: px(W * 0.03),
          border: '2px solid rgba(75,53,36,.18)', display: 'flex',
        },
        el('div', { flex: '1', borderRight: '2px solid rgba(75,53,36,.18)' }),
        el('div', { flex: '1' }),
      ),
      // handles
      el('div', { position: 'absolute', left: '44%', top: '44%', width: px(W * 0.03), height: px(W * 0.09), background: '#B79052', borderRadius: '2px' }),
      el('div', { position: 'absolute', left: '53%', top: '44%', width: px(W * 0.03), height: px(W * 0.09), background: '#B79052', borderRadius: '2px' }),
      // tail lights
      el('div', { position: 'absolute', left: '6%', bottom: '8%', width: px(W * 0.08), height: px(W * 0.05), borderRadius: '3px', background: '#FF5A4D', boxShadow: '0 0 8px rgba(255,90,77,.8)' }),
      el('div', { position: 'absolute', right: '6%', bottom: '8%', width: px(W * 0.08), height: px(W * 0.05), borderRadius: '3px', background: '#FF5A4D', boxShadow: '0 0 8px rgba(255,90,77,.8)' }),
    ),
    // bumper
    el('div', { position: 'absolute', left: px(W * 0.1), top: px(H * 0.72), width: px(W * 0.8), height: px(H * 0.06), borderRadius: px(W * 0.03), background: '#8a99a3' }),
    // wheels
    ...[0.24, 0.68].map((x) =>
      el(
        'div',
        {
          position: 'absolute', left: px(W * x), top: px(H * 0.78),
          width: px(W * 0.16), height: px(W * 0.16), borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%,#55555b,#222)',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,.6)',
        },
        el('div', { position: 'absolute', inset: '32%', borderRadius: '50%', background: '#cfcfcf' }),
      ),
    ),
    ...chicks,
  );
}
