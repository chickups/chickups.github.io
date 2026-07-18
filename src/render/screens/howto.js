// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';

/**
 * Doc's three-step loop, reachable any time from Home (not just first launch).
 * `art()` is a thunk rather than a built node: each `STEPS` row is built once,
 * per screen mount, by `row()` below — a thunk keeps the tire/icon construction
 * lazy and colocated with the copy it illustrates.
 */
const STEPS = [
  { art: () => tire(52, 4), title: 'Ride', body: 'Peep rides a spinning tire.' },
  { art: () => icon('hand', 40, COLORS.ink), title: 'Tap', body: 'Tap at the top of the swing to launch.' },
  { art: () => icon('feather', 40, COLORS.orange), title: 'Chain', body: 'Land on the next tire — each grab’s a feather. Climb to catch the truck!' },
];

/**
 * A revisitable "How to Play" screen (not just a first-launch intro): explains
 * the loop in three steps and offers "Try It", which launches the guided
 * tutorial run via `go('game', { tutorial: true })` — already built.
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function howtoScreen(go) {
  const row = (s) => el('div', {
    display: 'flex', alignItems: 'center', gap: px(16), width: '100%',
    background: COLORS.creamDeep, borderRadius: px(18), padding: px(14),
  },
    el('div', { width: px(56), height: px(56), display: 'flex', alignItems: 'center', justifyContent: 'center' }, s.art()),
    el('div', { flex: '1' },
      el('div', { font: `800 ${px(18)} 'Baloo 2'`, color: COLORS.ink }, s.title),
      el('div', { font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted, lineHeight: '1.4' }, s.body),
    ),
  );
  return el('div', {
    position: 'absolute', inset: '0px', overflowY: 'auto',
    background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`, animation: 'pFade .3s',
  },
    el('div', { position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: px(14), padding: `${px(58)} ${px(24)} ${px(24)}` },
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink }, 'How to Play'),
      el('div', { animation: 'pFloat 2s ease-in-out infinite', margin: `${px(2)} 0` }, peep(84, 'idle')),
      ...STEPS.map(row),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Try It', 'play', () => go('game', { tutorial: true }), { size: 24, lip: 6 }),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
