// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { truck } from '../art/truck.js';
import { logo } from '../art/logo.js';
import { icon } from '../art/icon.js';
import { primaryButton, pill, card, iconButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getFeathers, markIntroSeen, getEquippedOutfit, getDailyBest, getStreak, getGhost } from '../../storage.js';
import { dayNumber } from '../../core/daily.js';

/**
 * The daily route's subtitle. Reads the clock here in render/, never in core/:
 * `dayNumber` takes the time as an argument precisely so core stays pure.
 * @returns {string}
 */
function todaysRouteLabel() {
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const best = getDailyBest(day);
  return best > 0 ? `Today's best ${best} m` : "Today's route";
}

/**
 * The flame pill's number: the streak the player currently holds.
 *
 * Was hardcoded `'0'` — a literal, permanently. Like `todaysRouteLabel` above,
 * the clock is read here in `render/`; `core/streak.js` only ever takes a day
 * number that someone else looked up.
 *
 * A streak whose last day is older than yesterday is already dead — `advanceStreak`
 * would reset it to 1 on the next play — so it reads as 0 rather than showing a
 * number the next run will not honour.
 * @returns {string}
 */
function streakLabel() {
  const today = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const streak = getStreak();
  if (!streak) return '0';
  // today - streak.day is 0 (played today) or 1 (played yesterday, still alive).
  // Negative means the clock moved backwards; the streak is still the player's.
  if (today - streak.day > 1) return '0';
  return String(streak.length);
}

/**
 * The ghost card's subtitle. Reads the store here in render/, never in core/.
 * @returns {string}
 */
function raceCardLabel() {
  const ghost = getGhost();
  return ghost ? `Beat ${ghost.metres} m` : 'Beat your best';
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
        pill('flame', streakLabel(), COLORS.orangeD),
      ),
      el(
        'div',
        { display: 'flex', gap: px(8) },
        iconButton('hand', () => go('howto'), { color: COLORS.orangeD }),
        iconButton('map', () => go('journey'), { color: COLORS.orangeD }),
        iconButton('shirt', () => go('shop'), { color: COLORS.orangeD }),
        iconButton('trophy', () => go('achievements'), { color: COLORS.orangeD }),
        iconButton('gear', () => go('settings'), { color: COLORS.orangeD }),
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
        // The daily route needs no server: the field is a pure function of its
        // seed, so seeding from the date gives everyone the same route without
        // anyone distributing it. Only a leaderboard would need a backend.
        //
        // The card opens the Daily screen; the Daily screen starts the run. It has
        // the day's modifier and the streak ladder to show first — jumping straight
        // into `game` was the placeholder while that screen did not exist.
        card('Daily Run', todaysRouteLabel(), { onTap: () => go('daily') }),
        // No longer SOON: core/ghost.js has been complete since slice 2, and the
        // screen it was waiting for now exists.
        card('Race a Ghost', raceCardLabel(), { onTap: () => go('race') }),
      ),
    ),
  );
}
