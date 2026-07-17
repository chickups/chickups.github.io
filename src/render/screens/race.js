// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, statTile, tabs } from '../ui.js';
import { COLORS, RACE } from '../../core/tokens.js';
import { getGhost, getEquippedOutfit } from '../../storage.js';

/**
 * Race a Ghost (doc §06).
 *
 * `core/ghost.js` has been complete and tested since slice 2 — this screen and
 * the wiring in game.js are all that were ever missing, which is why Home said
 * `SOON`. No backend is involved and none could be: the field is a pure function
 * of its seed and the core is deterministic, so a run is fully described by its
 * seed plus the frames the player tapped on. A few hundred bytes of localStorage.
 *
 * Spec D9: `Race a Player` needs a server and ships as a DISABLED tab. Only
 * `Race My Best` works.
 */

/** Doc §06, verbatim. */
const BLURB = 'Chase the path of a previous run.';

/** Spec D9: a backend does not exist, so the second tab does not work. */
const TAB_ITEMS = [{ label: 'Race My Best' }, { label: 'Race a Player', disabled: true }];

/**
 * A `GHOST` / `YOU` lane pair. The ghost's lane carries its recorded distance;
 * before a race the player's is a dash, because there is nothing true to put there.
 * @param {string} ghostValue
 * @param {string} youValue
 * @returns {HTMLElement}
 */
function lanes(ghostValue, youValue) {
  return el(
    'div',
    { display: 'flex', gap: px(12), width: '100%' },
    statTile('GHOST', ghostValue, 34),
    statTile('YOU', youValue, 34),
  );
}

/**
 * @param {string} label
 * @param {string} value
 * @param {string} [note]
 * @returns {HTMLElement}
 */
function metaRow(label, value, note) {
  return el(
    'div',
    {
      display: 'flex', alignItems: 'center', gap: px(8),
      background: COLORS.creamDeep, borderRadius: px(18),
      padding: `${px(12)} ${px(16)}`, width: '100%',
    },
    el('div', {
      font: `800 ${px(11)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.08em',
    }, label),
    el('div', { flex: '1' }),
    el('div', { font: `800 ${px(17)} 'Baloo 2'`, color: COLORS.ink }, value),
    note ? el('div', { font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted }, note) : null,
  );
}

/**
 * @param {(name: string, arg?: any) => void} go
 * @param {{result?: {metres:number, ghostMetres:number, won:boolean}}} [arg]
 * @returns {HTMLElement}
 */
export function raceScreen(go, arg) {
  const result = arg && arg.result ? arg.result : null;
  const ghost = getGhost();
  const outfit = getEquippedOutfit();

  const shell = (/** @type {(HTMLElement|null)[]} */ children) => el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`,
      animation: 'pFade .3s', overflowY: 'auto',
    },
    el(
      'div',
      {
        position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: px(14), padding: `${px(58)} ${px(24)} ${px(24)}`,
      },
      ...children,
    ),
  );

  if (result) {
    return shell([
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center' },
        result.won ? 'You win!' : 'So close!'),
      el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' },
        result.won ? 'You beat the ghost.' : 'The ghost stayed ahead. One more flap?'),
      el('div', { margin: `${px(4)} 0` }, peep(96, result.won ? 'idle' : 'fly', outfit, false)),
      lanes(`${result.ghostMetres} m`, `${result.metres} m`),
      result.won
        ? metaRow('WIN REWARD', `+${RACE.winReward}`)
        : metaRow('WIN REWARD', `+${RACE.winReward}`, 'Beat the ghost to claim'),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Race Again', 'ghost', () => go('game', { race: true })),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ]);
  }

  // No stored ghost: the player has never finished a run, so there is nothing to
  // chase. Saying so is the whole job — a Start Race button that started an
  // ordinary run would be a lie about what the screen does.
  if (!ghost) {
    return shell([
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center' }, 'Race a Ghost'),
      el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' }, BLURB),
      el('div', { margin: `${px(4)} 0` }, peep(96, 'idle', outfit, false)),
      el('div', {
        font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted,
        textAlign: 'center', lineHeight: '1.5', padding: `0 ${px(10)}`,
      }, 'Play a run first. Your best one becomes the ghost you race.'),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Play', 'play', () => go('game')),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ]);
  }

  const start = primaryButton('Start Race', 'ghost', () => go('game', { race: true }));

  return shell([
    el('div', {
      display: 'flex', alignItems: 'center', gap: px(8),
      font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink,
    }, icon('ghost', 26, COLORS.muted), 'Race a Ghost'),
    el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' }, BLURB),
    // The second tab is disabled, never hidden: a player who has heard of racing
    // a friend deserves to see that it exists and is not here yet. Task 3's
    // `tabs` never fires onChange for a disabled item, so this needs no guard.
    tabs(TAB_ITEMS, 0, () => {}),
    el('div', { margin: `${px(2)} 0` }, peep(88, 'idle', outfit, false)),
    lanes(`${ghost.metres} m`, '—'),
    metaRow('GHOST TO BEAT', `${ghost.metres} m`, 'Your best'),
    metaRow('WIN REWARD', `+${RACE.winReward}`),
    el('div', { flex: '1', minHeight: px(10) }),
    start,
    el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
  ]);
}
