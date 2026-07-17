// @ts-check
import { el, px } from '../el.js';
import { primaryButton, secondaryButton, destructiveButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getBest } from '../../storage.js';
import { scoreOf } from '../../core/run.js';

/**
 * @param {(name: string, arg?: any) => void} go
 * @param {{state: any}} arg
 * @returns {HTMLElement}
 */
export function pauseScreen(go, arg) {
  const s = arg.state;

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'rgba(75,53,36,.55)', backdropFilter: 'blur(4px)',
      animation: 'pFade .2s', display: 'flex', alignItems: 'center', padding: `0 ${px(24)}`,
    },
    el(
      'div',
      {
        width: '100%', background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
        animation: 'pPop .25s ease-out',
      },
      el('div', { textAlign: 'center', font: `800 ${px(36)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1' }, 'Paused'),
      // §05's three tiles. Three across 345pt of inner width is ~108pt each, so
      // the value size drops 32 -> 26 to keep a four-digit best on one line.
      el(
        'div',
        { display: 'flex', gap: px(10), margin: `${px(18)} 0` },
        statTile('SCORE', String(scoreOf(s)), 26),
        statTile('BEST', String(getBest()), 26),
        statTile('MULT.', `×${s.mult}`, 26),
      ),
      primaryButton('Resume', 'play', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el(
        'div',
        { display: 'flex', gap: px(12) },
        secondaryButton('Restart', 'refresh', () => go('game')),
        secondaryButton('Settings', 'gear', () => go('settings')),
      ),
      el('div', { height: px(12) }),
      // §11 gives Quit Run its own destructive style. It also gets its own full-
      // width row rather than sharing one: three 44pt targets across 345pt would
      // put the two safe actions and the one destructive action within a thumb's
      // width of each other.
      el(
        'div',
        { display: 'flex' },
        destructiveButton('Quit Run', 'home', () => go('home')),
      ),
    ),
  );
}
