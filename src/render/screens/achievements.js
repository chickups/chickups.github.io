// @ts-check
import { el, px } from '../el.js';
import { icon } from '../art/icon.js';
import { pill, secondaryButton, iconButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { ACHIEVEMENTS, evaluate, earnedCount } from '../../core/achievements.js';
import { getStats } from '../../storage.js';

/**
 * One achievement row: name, hint, and a clear earned/unearned badge.
 * @param {{key: string, name: string, hint: string, done: boolean}} entry
 * @returns {HTMLElement}
 */
function achievementRow(entry) {
  return el(
    'div',
    {
      display: 'flex', alignItems: 'center', gap: px(14),
      background: entry.done ? COLORS.cream : 'rgba(255,251,240,.5)',
      opacity: entry.done ? '1' : '0.75',
      borderRadius: px(20), padding: `${px(12)} ${px(16)}`,
      boxShadow: entry.done ? `0 3px 0 ${COLORS.goldD}` : '0 3px 0 rgba(75,53,36,.1)',
    },
    el(
      'div',
      {
        flex: 'none', width: px(40), height: px(40), borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: entry.done ? `linear-gradient(${COLORS.gold},${COLORS.yellowD})` : COLORS.creamDeep,
      },
      entry.done ? icon('check', 18, COLORS.ink, 3) : icon('lock', 15, COLORS.muted, 2),
    ),
    el(
      'div',
      { flex: '1', minWidth: '0px', display: 'flex', flexDirection: 'column', gap: px(2) },
      el('div', { font: `800 ${px(15)} 'Baloo 2'`, color: COLORS.ink }, entry.name),
      el('div', { font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted }, entry.hint),
    ),
  );
}

/**
 * The achievements list: every entry in `core/achievements.js`'s `ACHIEVEMENTS`
 * table, evaluated against lifetime stats from `storage.js`'s `getStats()`, plus
 * an "N of M" summary via `earnedCount`. Pure presentation — no state lives here.
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function achievementsScreen(go) {
  const stats = getStats();
  const results = evaluate(stats);
  const earned = earnedCount(stats);

  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );

  const rows = results.map(achievementRow);

  return el(
    'div',
    {
      position: 'absolute', inset: '0px', overflow: 'hidden',
      background: `linear-gradient(180deg,${COLORS.skyTop} 0%,${COLORS.skyMid} 55%,${COLORS.grass} 85%,${COLORS.grassD} 100%)`,
      animation: 'pFade .4s',
    },
    backButton,
    el('div', {
      position: 'absolute', top: px(66), left: '0px', right: '0px', textAlign: 'center',
      font: `800 ${px(24)} 'Baloo 2'`, color: COLORS.ink,
    }, 'Achievements'),
    el(
      'div',
      { position: 'absolute', top: px(58), right: px(20) },
      pill('trophy', `${earned} of ${ACHIEVEMENTS.length}`, COLORS.orangeD),
    ),
    el(
      'div',
      {
        position: 'absolute', top: px(130), left: '0px', right: '0px', bottom: px(104),
        overflowY: 'auto', overflowX: 'hidden', padding: `0 ${px(20)}`,
        display: 'flex', flexDirection: 'column', gap: px(10),
      },
      ...rows,
    ),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(40), zIndex: '20', display: 'flex', gap: px(12) },
      secondaryButton('Home', 'home', () => go('home')),
    ),
  );
}
