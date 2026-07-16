// @ts-check
import { el, px } from '../el.js';

const INK = '#4B3524';

/**
 * @param {number} size
 * @param {boolean} [stack]
 * @param {boolean} [tagline]
 * @returns {HTMLElement}
 */
export function logo(size, stack = false, tagline = false) {
  const S = size;
  /** @type {Record<string, string>} */
  const word = {
    font: `800 ${px(S)} 'Baloo 2', system-ui`,
    color: '#FFD641',
    webkitTextStroke: `${px(Math.max(2, S * 0.055))} ${INK}`,
    paintOrder: 'stroke fill',
    textShadow: `0 ${px(S * 0.07)} 0 #C6871A, 0 ${px(S * 0.12)} ${px(S * 0.06)} rgba(75,53,36,.30)`,
    lineHeight: '.92',
    letterSpacing: '-.02em',
    display: 'block',
    margin: '0px',
  };

  const words = stack
    ? el(
        'div',
        { textAlign: 'center' },
        el('div', word, 'CHICK'),
        el('div', { ...word, color: '#FFB43A' }, 'UP!'),
      )
    : el(
        'div',
        { ...word, whiteSpace: 'nowrap' },
        'CHICK ',
        el('span', { color: '#FFB43A' }, 'UP!'),
      );

  return el(
    'div',
    { display: 'inline-block', transform: 'rotate(-3deg)', textAlign: 'center' },
    words,
    tagline
      ? el(
          'div',
          {
            marginTop: px(S * 0.18),
            font: `700 ${px(S * 0.24)} 'Nunito'`,
            color: INK,
            letterSpacing: '.04em',
            opacity: '0.85',
          },
          'Run. Swing. Wing it.',
        )
      : null,
  );
}
