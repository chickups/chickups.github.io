// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { success } from '../../haptics.js';

/**
 * @param {(name: string) => void} go
 * @param {{score: number, best: number, previousBest: number, feathers: number}} arg
 * @returns {HTMLElement}
 */
export function bestScreen(go, arg) {
  success();

  const confetti = [
    { top: 120, left: 30, size: 20, dur: 2.4, delay: 0, color: COLORS.cream },
    { top: 90, left: 160, size: 16, dur: 2.9, delay: 0.3, color: COLORS.creamDeep },
    { top: 110, left: 300, size: 22, dur: 2.6, delay: 0.6, color: COLORS.cream },
    { top: 100, left: 80, size: 14, dur: 3.1, delay: 0.9, color: COLORS.creamDeep },
    { top: 130, left: 240, size: 18, dur: 2.7, delay: 1.2, color: COLORS.cream },
  ].map((c) =>
    el('div', {
      position: 'absolute', top: px(c.top), left: px(c.left),
      animation: `pConf ${c.dur}s linear infinite ${c.delay}s`,
    }, icon('feather', c.size, c.color)),
  );

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'radial-gradient(120% 80% at 50% 30%,#FFE08A,#FFB43A 55%,#FF963C)',
      animation: 'pFade .4s',
    },
    ...confetti,
    el(
      'div',
      { position: 'absolute', top: px(130), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        display: 'inline-block', background: COLORS.ink, color: '#FFDA4A',
        font: `800 ${px(22)} 'Baloo 2'`, padding: `${px(8)} ${px(24)}`,
        borderRadius: px(22), transform: 'rotate(-3deg)',
      }, 'NEW BEST!'),
    ),
    el(
      'div',
      { position: 'absolute', top: px(196), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        font: `800 ${px(108)} 'Baloo 2'`, color: COLORS.cream, lineHeight: '1',
        textShadow: '0 6px 0 #D9701E,0 12px 16px rgba(75,53,36,.3)',
      }, String(arg.score)),
    ),
    arg.previousBest > 0
      ? el('div', {
          position: 'absolute', top: px(310), left: '0px', right: '0px',
          textAlign: 'center', zIndex: '4', font: `800 ${px(13)} 'Nunito'`,
          letterSpacing: '.06em', color: '#7A3E12', opacity: '.75',
        }, `PREVIOUS ${arg.previousBest}`)
      : null,
    el('div', {
      position: 'absolute', top: px(330), left: '0px', right: '0px',
      textAlign: 'center', zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: '#7A3E12',
    }, 'You flew farther than ever!'),
    el('div', {
      position: 'absolute', top: px(352), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(150, 'celebrate')),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(52), zIndex: '5' },
      primaryButton('Go Again', 'play', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
