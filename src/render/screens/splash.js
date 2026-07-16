// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { logo } from '../art/logo.js';
import { hasSeenIntro } from '../../storage.js';

/** The prototype's `armSplash()` delay. */
const SPLASH_MS = 1900;

/**
 * @param {(name: string) => void} go
 * @returns {HTMLElement}
 */
export function splashScreen(go) {
  const next = () => go(hasSeenIntro() ? 'home' : 'intro');

  const root = el(
    'div',
    {
      position: 'absolute', inset: '0px', cursor: 'pointer',
      background: 'linear-gradient(180deg,#CFEBFB,#9AD6F3 72%,#BDE6F7)',
      animation: 'pFade .4s',
    },
    // sun
    el('div', {
      position: 'absolute', top: px(96), right: px(-44),
      width: px(180), height: px(180), borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 40%,#FFF0B8,#FFDA4A)',
      boxShadow: '0 0 70px 26px rgba(255,218,74,.45)',
    }),
    el(
      'div',
      {
        position: 'absolute', inset: '0px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: px(30),
      },
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'center' },
        el('div', { animation: 'pFloat 2.4s ease-in-out infinite', marginBottom: px(-42), zIndex: '2' }, peep(150, 'celebrate')),
        // cracked eggshell
        el(
          'div',
          { position: 'relative', width: px(172), height: px(104) },
          el('div', {
            position: 'absolute', bottom: '0px', left: '0px', width: px(172), height: px(100),
            background: 'linear-gradient(#FFFBF0,#EFE0BE)',
            borderRadius: '0 0 74px 74px / 0 0 96px 96px',
            clipPath: 'polygon(0 28%,9% 6%,19% 26%,30% 4%,42% 24%,52% 4%,63% 24%,74% 4%,85% 24%,94% 6%,100% 26%,100% 100%,0 100%)',
          }),
        ),
      ),
      logo(60, true, true),
      el('div', {
        position: 'absolute', bottom: px(64),
        font: `700 ${px(14)} 'Nunito'`, color: '#4B3524', opacity: '0.6',
        animation: 'pFloat 1.8s ease-in-out infinite',
      }, 'tap to start'),
    ),
  );

  const timer = setTimeout(next, SPLASH_MS);
  root.addEventListener('pointerdown', next);
  /** @type {any} */ (root).__dispose = () => clearTimeout(timer);

  return root;
}
