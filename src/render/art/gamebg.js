// @ts-check
import { el, px } from '../el.js';

/**
 * @param {number} w
 * @param {number} h
 * @param {number} left
 * @param {number} bottom
 * @param {string} color
 * @returns {HTMLElement}
 */
function tuft(w, h, left, bottom, color) {
  return el('div', {
    position: 'absolute', bottom: px(bottom), left: px(left),
    width: px(w), height: px(h), background: color,
    borderRadius: '50% 50% 0 0/100% 100% 0 0',
  });
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} baseH
 * @param {number} c1x
 * @param {number} c1s
 * @param {number} c2x
 * @param {number} c2s
 * @returns {HTMLElement}
 */
function cloud(w, h, baseH, c1x, c1s, c2x, c2s) {
  return el(
    'div',
    { position: 'relative', width: px(w), height: px(h) },
    el('div', { position: 'absolute', bottom: '0px', width: px(w), height: px(baseH), background: '#fff', borderRadius: px(baseH * 0.62) }),
    el('div', { position: 'absolute', bottom: px(6), left: px(c1x), width: px(c1s), height: px(c1s), background: '#fff', borderRadius: '50%' }),
    el('div', { position: 'absolute', bottom: px(4), left: px(c2x), width: px(c2s), height: px(c2s), background: '#fff', borderRadius: '50%' }),
  );
}

/**
 * The static gameplay backdrop. Children are appended on top.
 * @param {...(Node|null)} children
 * @returns {HTMLElement}
 */
export function gamebg(...children) {
  return el(
    'div',
    {
      position: 'absolute',
      inset: '0px',
      overflow: 'hidden',
      background: 'linear-gradient(180deg,#BFE7FB 0%,#A9DDF5 16%,#9ED66B 34%,#8BD450 60%,#7BC93F 100%)',
    },
    // distant hills
    el('div', { position: 'absolute', top: px(190), left: px(-40), width: px(260), height: px(150), background: '#8ECB5C', borderRadius: '50%' }),
    el('div', { position: 'absolute', top: px(210), right: px(-60), width: px(300), height: px(160), background: '#82C34E', borderRadius: '50%' }),
    // clouds
    el('div', { position: 'absolute', top: px(96), left: px(40), opacity: '0.92', animation: 'gbCloud 8s ease-in-out infinite alternate' },
      cloud(120, 44, 26, 14, 42, 50, 56)),
    el('div', { position: 'absolute', top: px(158), right: px(36), opacity: '0.8', animation: 'gbCloud 11s ease-in-out infinite alternate' },
      cloud(94, 36, 22, 12, 34, 42, 44)),
    // travel path
    el('div', {
      position: 'absolute', top: px(300), bottom: '0px', left: '50%',
      transform: 'translateX(-50%)', width: px(150),
      background: 'linear-gradient(90deg,rgba(255,246,228,0),rgba(255,246,228,.5) 20%,rgba(255,246,228,.5) 80%,rgba(255,246,228,0))',
      borderLeft: '3px dashed rgba(255,251,240,.5)',
      borderRight: '3px dashed rgba(255,251,240,.5)',
    }),
    // grass tufts
    tuft(40, 26, 24, 60, '#6FBB37'),
    tuft(52, 30, 393 - 30 - 52, 120, '#6FBB37'),
    tuft(34, 22, 40, 280, '#79C544'),
    ...children,
  );
}
