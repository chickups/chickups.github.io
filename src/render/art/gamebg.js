// @ts-check
import { el, px } from '../el.js';
import { BIOME_SKY } from '../../core/tokens.js';

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
 * @param {string} key a `BIOME_SKY` key
 * @returns {string}
 */
function gradientFor(key) {
  const stops = BIOME_SKY[key] || BIOME_SKY.roadside;
  return `linear-gradient(180deg,${stops.join(',')})`;
}

/**
 * The rolling green hills and grass tufts are ground-level dressing — they
 * read fine low down (`roadside`, `orchard`, both still grass-floored) but
 * clash hard once the sky goes rocky/industrial/dusk, painting a saturated
 * green landscape over a palette that no longer has any green in it. They
 * fade out with everything else above that band.
 */
const GROUND_DECOR_BIOMES = new Set(['roadside', 'orchard']);

/**
 * The static gameplay backdrop. Children are appended on top of the sky.
 *
 * The sky is two stacked, full-bleed layers that cross-fade on `setSky`: the
 * incoming biome's gradient is painted on the hidden layer, then its opacity
 * is transitioned to 1 while the other fades to 0. `prefers-reduced-motion`
 * needs no special-casing here — the global stylesheet (`styles.js`) already
 * forces `transition-duration: .01ms` on everything under that setting, which
 * makes the cross-fade cut instantly for free.
 *
 * @param {...(Node|null)} children
 * @returns {{root: HTMLElement, setSky: (key: string) => void}}
 */
export function gamebg(...children) {
  const SKY_STYLE = {
    position: 'absolute', inset: '0px',
    transition: 'opacity .6s ease',
  };
  const skyA = el('div', { ...SKY_STYLE, opacity: '1', background: gradientFor('roadside') });
  const skyB = el('div', { ...SKY_STYLE, opacity: '0' });
  let shown = skyA;
  let currentKey = 'roadside';

  const groundDecor = el(
    'div',
    { position: 'absolute', inset: '0px', transition: 'opacity .6s ease', opacity: '1' },
    // distant hills
    el('div', { position: 'absolute', top: px(190), left: px(-40), width: px(260), height: px(150), background: '#8ECB5C', borderRadius: '50%' }),
    el('div', { position: 'absolute', top: px(210), right: px(-60), width: px(300), height: px(160), background: '#82C34E', borderRadius: '50%' }),
    // grass tufts
    tuft(40, 26, 24, 60, '#6FBB37'),
    tuft(52, 30, 393 - 30 - 52, 120, '#6FBB37'),
    tuft(34, 22, 40, 280, '#79C544'),
  );

  const root = el(
    'div',
    {
      position: 'absolute',
      inset: '0px',
      overflow: 'hidden',
    },
    skyA,
    skyB,
    groundDecor,
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
    ...children,
  );

  return {
    root,
    /**
     * Cross-fade to a new biome's sky (and fade the ground dressing in/out
     * with it). A no-op if `key` is already showing.
     * @param {string} key
     */
    setSky(key) {
      if (key === currentKey) return;
      currentKey = key;
      const next = shown === skyA ? skyB : skyA;
      next.style.background = gradientFor(key);
      next.style.opacity = '1';
      shown.style.opacity = '0';
      shown = next;
      groundDecor.style.opacity = GROUND_DECOR_BIOMES.has(key) ? '1' : '0';
    },
  };
}
