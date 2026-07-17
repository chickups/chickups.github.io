// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { truck } from '../art/truck.js';
import { primaryButton, secondaryButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { success } from '../../haptics.js';
import { leaveTo } from './reward.js';

/**
 * The Great Escape, caught. Peep is on the truck.
 *
 * This is NOT a death screen with better adjectives — it is the ending, and it
 * takes precedence over New Best (see `endScreenOf` in core/run.js). Never the
 * words "game over" here or anywhere else.
 *
 * `art/truck.js` is the right truck: the rear-view one full of chicks that left
 * Peep behind in the intro. He has caught it. `art/hazardTruck.js` is the side-on
 * traffic and would be the wrong truck entirely.
 *
 * Buttons route through `leaveTo`, exactly like `best.js`/`oops.js`: a milestone
 * earned by THIS run must still get its interstitial before the player leaves,
 * and `leaveTo` takes the destination as an argument, so this terminal screen
 * needed no change to that seam.
 *
 * @param {(name: string, arg?: any) => void} go
 * @param {{score: number, feathers: number}} arg
 * @returns {HTMLElement}
 */
export function wonScreen(go, arg) {
  success();

  const confetti = [
    { top: 90, left: 24, size: 22, dur: 2.5, delay: 0, color: COLORS.gold },
    { top: 70, left: 150, size: 16, dur: 3.0, delay: 0.35, color: COLORS.cream },
    { top: 96, left: 296, size: 24, dur: 2.6, delay: 0.7, color: COLORS.gold },
    { top: 78, left: 72, size: 14, dur: 3.2, delay: 1.0, color: COLORS.creamDeep },
    { top: 110, left: 232, size: 18, dur: 2.8, delay: 1.3, color: COLORS.cream },
    { top: 64, left: 200, size: 20, dur: 2.4, delay: 1.6, color: COLORS.yellowL },
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
      background: `radial-gradient(120% 80% at 50% 26%, ${COLORS.yellowL}, ${COLORS.orange} 52%, ${COLORS.orangeDD})`,
      animation: 'pFade .4s',
    },
    ...confetti,
    el(
      'div',
      { position: 'absolute', top: px(112), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        display: 'inline-block', background: COLORS.ink, color: COLORS.gold,
        font: `800 ${px(22)} 'Baloo 2'`, padding: `${px(8)} ${px(24)}`,
        borderRadius: px(22), transform: 'rotate(-3deg)',
      }, 'YOU MADE IT!'),
    ),
    el('div', {
      position: 'absolute', top: px(168), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pPop .5s ease-out both',
    }, truck(210)),
    el('div', {
      position: 'absolute', top: px(258), left: px(232),
      zIndex: '5', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(96, 'celebrate')),
    el('div', {
      position: 'absolute', top: px(384), left: '0px', right: '0px', textAlign: 'center',
      zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: COLORS.ink,
    }, 'Peep caught the truck. Room for one more!'),
    el(
      'div',
      {
        position: 'absolute', top: px(424), left: px(24), right: px(24), zIndex: '4',
        display: 'flex', gap: px(12), justifyContent: 'center',
      },
      statTile('HEIGHT', `${arg.score} m`),
      statTile('FEATHERS', String(arg.feathers)),
    ),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(52), zIndex: '5' },
      primaryButton('Go Again', 'play', () => leaveTo(go, 'game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => leaveTo(go, 'home'))),
    ),
  );
}
