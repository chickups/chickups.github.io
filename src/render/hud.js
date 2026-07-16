// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';

/** The doc's chunky outlined score numeral. */
const SCORE_OUTLINE =
  '-2px 0 #4B3524,2px 0 #4B3524,0 -2px #4B3524,0 2px #4B3524,' +
  '-2px -2px #4B3524,2px 2px #4B3524,-2px 2px #4B3524,2px -2px #4B3524,' +
  '0 6px 0 rgba(75,53,36,.35)';

/**
 * HUD stays out of the interaction area: score top-centre, pause top-left,
 * multiplier below the score, tip bubble near the bottom (doc §04).
 * @param {() => void} onPause
 */
export function makeHud(onPause) {
  const score = el('div', {
    font: `800 ${px(54)} 'Baloo 2'`, color: COLORS.cream,
    lineHeight: '1', textShadow: SCORE_OUTLINE,
  }, '0');

  const mult = el('div', {
    display: 'inline-flex', marginTop: px(4),
    background: COLORS.orange, color: COLORS.cream,
    font: `800 ${px(15)} 'Baloo 2'`,
    padding: `${px(3)} ${px(13)}`, borderRadius: px(14),
    boxShadow: `0 3px 0 ${COLORS.orangeDD}`,
  }, '×1');

  const tipText = el('div', { font: `800 ${px(21)} 'Baloo 2'`, color: COLORS.ink });
  const tip = el('div', {
    position: 'absolute', left: px(44), right: px(44), bottom: px(150),
    zIndex: '30', pointerEvents: 'none', display: 'none',
  }, el('div', {
    position: 'relative', background: COLORS.cream, borderRadius: px(22),
    padding: `${px(14)} ${px(20)}`, boxShadow: '0 8px 0 rgba(75,53,36,.18)',
    textAlign: 'center', animation: 'pPop .3s ease-out',
  }, tipText));

  const pause = el('div', {
    position: 'absolute', top: px(66), left: px(18), zIndex: '30',
    width: px(44), height: px(44), borderRadius: '50%',
    background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }, icon('pause', 20, COLORS.ink));
  pause.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // must not read as a game hold
    onPause();
  });

  const root = el(
    'div',
    { position: 'absolute', inset: '0px', pointerEvents: 'none' },
    pause,
    el('div', {
      position: 'absolute', top: px(66), left: '0px', right: '0px',
      zIndex: '30', textAlign: 'center', pointerEvents: 'none',
    }, score, mult),
    tip,
  );
  pause.style.pointerEvents = 'auto';

  let lastTip = null;

  return {
    root,
    /**
     * @param {number} s metres
     * @param {number} m multiplier
     * @param {string} t tip text; empty hides the bubble
     */
    update(s, m, t) {
      score.textContent = String(s);
      mult.textContent = `×${m}`;
      if (t !== lastTip) {
        lastTip = t;
        tip.style.display = t ? 'block' : 'none';
        if (t) {
          tipText.textContent = t;
          // Restart the pop animation on each new hint.
          const inner = /** @type {HTMLElement} */ (tip.firstElementChild);
          inner.style.animation = 'none';
          void inner.offsetWidth;
          inner.style.animation = 'pPop .3s ease-out';
        }
      }
    },
  };
}
