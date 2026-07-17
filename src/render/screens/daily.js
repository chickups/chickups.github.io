// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gear } from '../art/gear.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, card, pill, iconButton, TAP_MIN } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { dayNumber, dailySeed } from '../../core/daily.js';
import { modifierForDay, applyModifier } from '../../core/modifier.js';
import { rewardForDay, STREAK_LADDER, STREAK_MAX } from '../../core/streak.js';
import { grantFor } from '../../core/milestone.js';
import { makeField } from '../../core/field.js';
import {
  getDailyBest, getStreak, getStreakClaimed, setStreakClaimed,
  getEquippedOutfit, addFeathers, getOwnedOutfits, addOwnedOutfit,
} from '../../storage.js';

/**
 * Date-header copy tables. Spelled out rather than taken from
 * `toLocaleDateString`, which would render this header in whatever language the
 * device is set to while every other string in the game stays English — the doc
 * ships one language (spec D8 drops the Language setting for exactly this reason).
 */
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** How many spine props the route preview shows. */
const PREVIEW_PROPS = 5;
/** pt. Preview art is drawn small; the real props are 124/155pt across. */
const PREVIEW_SIZE = 30;

/**
 * The design's `TUESDAY · JULY 16` header, from a real Date.
 *
 * The clock is read here in `render/`, never in `core/` — same discipline as
 * `home.js`'s `todaysRouteLabel`. `core/daily.js` takes the time as an argument
 * precisely so it can stay pure.
 * @param {Date} now
 * @returns {string}
 */
function dateHeader(now) {
  return `${WEEKDAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

/**
 * A small-caps section label — `TODAY'S ROUTE`, `TODAY'S MODIFIER`.
 * @param {string} text
 * @returns {HTMLElement}
 */
function sectionLabel(text) {
  return el('div', {
    font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted,
    letterSpacing: '.08em', marginBottom: px(8),
  }, text);
}

/**
 * The route preview: the first few rungs of today's actual spine, drawn small.
 *
 * Built from the same `makeField(dailySeed(day), tuning)` the run itself will
 * build, so this is a genuine preview of the route rather than decoration — if
 * Slick Gears is today's modifier, the preview shows gears, because the field
 * really will have them.
 * @param {import('../../core/field.js').Field} field
 * @returns {HTMLElement}
 */
function routePreview(field) {
  const props = [];
  for (let i = 0; i < PREVIEW_PROPS; i++) props.push(field.propAt(i));
  return el(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(10) },
    ...props.flatMap((prop, i) => {
      const art = el(
        'div',
        { flex: 'none', display: 'flex', alignItems: 'center' },
        prop.kind === 'gear' ? gear(PREVIEW_SIZE) : tire(PREVIEW_SIZE, 4),
      );
      // A connector between rungs, so the row reads as a ladder rather than a set.
      const link = i < props.length - 1
        ? el('div', {
            flex: 'none', width: px(12), height: px(3), borderRadius: px(2),
            background: 'rgba(75,53,36,.18)',
          })
        : null;
      return link ? [art, link] : [art];
    }),
  );
}

/**
 * One rung of the §08 ladder. Day 7 shows a gift rather than a number.
 * @param {number} day 1..STREAK_MAX
 * @param {number} length the streak the player currently holds
 * @returns {HTMLElement}
 */
function ladderRung(day, length) {
  const rung = STREAK_LADDER[day - 1];
  const earned = day <= length;
  const isToday = day === length;
  return el(
    'div',
    {
      flex: '1', minWidth: '0px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(3),
      background: earned ? `linear-gradient(${COLORS.gold},${COLORS.yellowD})` : COLORS.creamDeep,
      // Not colour alone: the current rung carries a ring as well, so the ladder
      // still reads for a player who cannot tell the gold from the cream.
      boxShadow: isToday ? `0 0 0 ${px(2)} ${COLORS.orangeD}` : 'none',
      borderRadius: px(12), padding: `${px(7)} ${px(2)}`,
    },
    el('div', {
      font: `700 ${px(9)} 'Nunito'`, color: earned ? COLORS.ink : COLORS.muted,
      letterSpacing: '.04em',
    }, `DAY ${day}`),
    rung === 'outfit'
      ? icon('gift', 14, earned ? COLORS.ink : COLORS.muted)
      : el('div', {
          font: `800 ${px(13)} 'Baloo 2'`, color: earned ? COLORS.ink : COLORS.muted,
        }, String(rung)),
  );
}

/**
 * The Daily Run screen.
 *
 * One shared route per calendar day, and one of seven modifiers applied to it. The
 * route needs no server — the field is a pure function of its seed, so seeding from
 * the date gives every player the same route without anyone distributing it.
 *
 * The design's LEADERBOARD block is deliberately omitted: it is the one part of this
 * screen that genuinely needs a backend, and the game ships as a static site. See the
 * spec's Out of Scope table.
 *
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function dailyScreen(go) {
  const now = new Date();
  const day = dayNumber(now.getTime(), now.getTimezoneOffset());
  const modifier = modifierForDay(day);
  // The same field the run will build: same seed, same tuning. A preview that
  // built a plain field would lie on Slick Gears and Thin Air days.
  const field = makeField(dailySeed(day), applyModifier(modifier));
  const best = getDailyBest(day);

  const streak = getStreak();
  // A streak whose last day is older than yesterday is already dead — the next
  // play resets it to 1 (spec D10) — so it shows as 0 rather than as a number
  // the next run will not honour. Matches `home.js`'s flame pill exactly.
  const length = streak && day - streak.day <= 1 ? streak.length : 0;
  // The rung is paid for PLAYING today, so it is claimable only once today's run
  // is on the board, and only once.
  const playedToday = !!streak && streak.day === day;
  const claimable = playedToday && getStreakClaimed() !== day && length >= 1;
  const reward = rewardForDay(length || 1);

  const claimLabel = reward.kind === 'outfit' ? 'Claim Outfit' : `Claim +${reward.amount}`;

  const streakNote = el('div', {
    font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted, textAlign: 'center', minHeight: px(16),
  }, playedToday ? '' : 'Finish today’s run to claim');

  const claimRow = el('div', { width: '100%' });

  function renderClaim(enabled) {
    claimRow.replaceChildren(
      primaryButton(claimLabel, 'gift', () => {
        if (!enabled) return;
        // Day 7 pays an outfit through the MILESTONE grant path — the one
        // mechanism in the game that hands out an outfit for playing rather than
        // paying. `grantFor` returns the cheapest unowned outfit, or a feather
        // bonus when all three are already owned, so this can never "unlock" a
        // hat the player already has.
        if (reward.kind === 'outfit') {
          const grant = grantFor(getOwnedOutfits());
          if (grant.kind === 'outfit') addOwnedOutfit(grant.outfitKey);
          else addFeathers(grant.amount);
        } else {
          addFeathers(reward.amount);
        }
        setStreakClaimed(day);
        // Rebuild from storage rather than patching this node: re-entering the
        // screen is the same code path, so there is only one way it can look.
        go('daily');
      }, { size: 18, lip: 6, disabled: !enabled }),
    );
  }
  renderClaim(claimable);

  return el(
    'div',
    {
      position: 'absolute', inset: '0px', overflow: 'hidden',
      background: `linear-gradient(180deg,${COLORS.skyTop} 0%,${COLORS.skyMid} 52%,${COLORS.grass} 84%,${COLORS.grassD} 100%)`,
      animation: 'pFade .4s',
    },
    el('div', { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
      iconButton('chevL', () => go('home'))),
    el('div', { position: 'absolute', top: px(58), right: px(20), zIndex: '30' },
      pill('flame', String(length), COLORS.orangeD)),

    el(
      'div',
      {
        position: 'absolute', top: px(112), left: px(20), right: px(20),
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4),
      },
      el('div', {
        font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.1em',
      }, dateHeader(now)),
      el('div', {
        font: `800 ${px(28)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center',
      }, 'Daily Run'),
      el('div', {
        font: `700 ${px(13.5)} 'Nunito'`, color: COLORS.ink, textAlign: 'center', opacity: '.8',
      }, 'Same route. One day. How far can you go?'),
    ),

    el(
      'div',
      {
        position: 'absolute', top: px(210), left: px(20), right: px(20), bottom: px(150),
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: px(16),
      },
      // --- TODAY'S ROUTE -------------------------------------------------
      el(
        'div',
        { background: COLORS.cream, borderRadius: px(22), padding: px(16), boxShadow: '0 4px 0 rgba(75,53,36,.1)' },
        sectionLabel("TODAY'S ROUTE"),
        routePreview(field),
        el('div', {
          font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted,
          textAlign: 'center', marginTop: px(10),
        }, best > 0 ? `Today's best ${best} m` : 'Not run yet today'),
      ),
      // --- TODAY'S MODIFIER ----------------------------------------------
      el(
        'div',
        {},
        sectionLabel("TODAY'S MODIFIER"),
        card(modifier.name, modifier.blurb),
      ),
      // --- the §08 streak ladder -----------------------------------------
      el(
        'div',
        {},
        sectionLabel(`${length}-DAY STREAK`),
        el(
          'div',
          { display: 'flex', gap: px(4) },
          ...Array.from({ length: STREAK_MAX }, (_, i) => ladderRung(i + 1, length)),
        ),
        el('div', { marginTop: px(10), display: 'flex', flexDirection: 'column', gap: px(6) },
          claimRow,
          streakNote,
        ),
      ),
    ),

    el(
      'div',
      { position: 'absolute', bottom: px(112), right: px(24), zIndex: '4' },
      peep(72, 'idle', /** @type {import('../art/peep.js').PeepOutfit} */ (getEquippedOutfit())),
    ),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(40), zIndex: '20',
        display: 'flex', flexDirection: 'column', gap: px(10),
      },
      primaryButton('Start Daily Run', 'play', () => go('game', { daily: true }), { size: 22 }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
