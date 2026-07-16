// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { truck } from '../art/truck.js';
import { logo } from '../art/logo.js';
import { icon } from '../art/icon.js';
import { primaryButton, pill, card, TAP_MIN } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getFeathers, markIntroSeen, getEquippedOutfit } from '../../storage.js';

/**
 * A round top-bar entry point, matching the Journey button's style. Used for
 * Journey, Shop and Achievements so all three read as one family of buttons.
 * @param {string} glyph
 * @param {(name: string, arg?: any) => void} go
 * @param {string} screen
 * @returns {HTMLElement}
 */
function navButton(glyph, go, screen) {
  const node = el('div', {
    width: px(TAP_MIN), height: px(TAP_MIN), borderRadius: '50%',
    background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }, icon(glyph, 20, COLORS.orangeD));
  node.addEventListener('click', () => go(screen));
  return node;
}

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function homeScreen(go) {
  // Reaching Home at all means the story has been served, whether watched or skipped.
  markIntroSeen();

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'linear-gradient(180deg,#CFEBFB,#A6DCF6 46%,#8BD450 46%,#6FBB37)',
      animation: 'pFade .4s',
    },
    // sun
    el('div', {
      position: 'absolute', top: px(90), right: px(-30),
      width: px(150), height: px(150), borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 40%,#FFF0B8,#FFDA4A)',
      boxShadow: '0 0 50px 18px rgba(255,218,74,.4)',
    }),
    // top bar
    el(
      'div',
      {
        position: 'absolute', top: px(64), left: px(16), right: px(16), zIndex: '30',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      },
      el('div', { display: 'flex', gap: px(8) },
        pill('feather', String(getFeathers()), COLORS.yellowD),
        pill('flame', '0', COLORS.orangeD),
      ),
      el(
        'div',
        { display: 'flex', gap: px(8) },
        navButton('map', go, 'journey'),
        navButton('shirt', go, 'shop'),
        navButton('trophy', go, 'achievements'),
        // Settings is designed but inert in slice 1.
        el('div', {
          width: px(TAP_MIN), height: px(TAP_MIN), borderRadius: '50%',
          background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: '0.55',
        }, icon('gear', 22, COLORS.ink)),
      ),
    ),
    el('div', { position: 'absolute', top: px(200), left: '50%', transform: 'translateX(-46%) scale(.62)' }, truck(120)),
    el('div', { position: 'absolute', top: px(132), left: '50%', transform: 'translateX(-50%)', zIndex: '6' }, logo(46)),
    el(
      'div',
      {
        position: 'absolute', top: px(178), left: '50%', transform: 'translateX(-50%)', zIndex: '6',
        background: COLORS.cream, padding: `${px(7)} ${px(16)}`, borderRadius: px(20),
        boxShadow: '0 3px 0 rgba(75,53,36,.1)', display: 'flex', alignItems: 'center', gap: px(7),
        whiteSpace: 'nowrap',
      },
      icon('truck', 18, COLORS.orangeD),
      el('span', { font: `800 ${px(14)} 'Nunito'`, color: COLORS.orangeD }, 'Catch up with the truck!'),
    ),
    el('div', { position: 'absolute', bottom: px(392), right: px(34) }, tire(72, 9)),
    el(
      'div',
      { position: 'absolute', bottom: px(398), left: px(48), zIndex: '4' },
      peep(128, 'idle', /** @type {import('../art/peep.js').PeepOutfit} */ (getEquippedOutfit())),
    ),
    el(
      'div',
      {
        position: 'absolute', left: px(20), right: px(20), bottom: px(150), zIndex: '8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(14),
      },
      primaryButton('Play', 'play', () => go('game')),
      el(
        'div',
        { width: '100%', display: 'flex', gap: px(12) },
        card('Daily Run', "Today's route", { disabled: true, badge: 'SOON' }),
        card('Race a Ghost', 'Beat your best', { disabled: true, badge: 'SOON' }),
      ),
    ),
  );
}
