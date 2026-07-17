// @ts-check
import { el, px } from '../el.js';
import { icon } from '../art/icon.js';
import { secondaryButton, pill, iconButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getBest } from '../../storage.js';
import { BIOMES, biomeIndexAt } from '../../core/biome.js';

/**
 * Extra metres of headroom drawn above the last biome's `fromM`, so the endless
 * final biome does not pin its node to the very top of the scale.
 */
const HEADROOM_M = 300;

/** Total vertical span the scale renders across, in points. */
const TRACK_H = 560;

/** Horizontal position of the vertical track/nodes, in points from the content edge. */
const TRACK_X = 26;

/** The scale runs from 0 to the last biome's `fromM` plus headroom. */
const SCALE_MAX = BIOMES[BIOMES.length - 1].fromM + HEADROOM_M;

/**
 * Map a height in metres to a y offset from the top of the track, in points.
 * Clamps so a best far beyond the last biome still draws at the top of the scale.
 * @param {number} metres
 * @returns {number}
 */
function yFor(metres) {
  const clamped = Math.max(0, Math.min(metres, SCALE_MAX));
  return TRACK_H * (1 - clamped / SCALE_MAX);
}

/**
 * The Journey map: a vertical scale of the six biomes from Roadside (bottom, 0m)
 * to The Great Escape (top, 1000m+), with the player's best metres marked at the
 * current biome's rung. Pure presentation over `getBest()` — no new game state.
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function journeyScreen(go) {
  const best = getBest();
  const reachedIdx = biomeIndexAt(best);
  const reachedY = yFor(best);

  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );

  const nodes = BIOMES.map((biome, i) => {
    const reached = i <= reachedIdx;
    const current = i === reachedIdx;
    const y = yFor(biome.fromM);

    const dot = el(
      'div',
      {
        flex: 'none', marginLeft: px(TRACK_X - 10),
        width: px(20), height: px(20), borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: reached ? `linear-gradient(${COLORS.gold},${COLORS.yellowD})` : COLORS.creamDeep,
        boxShadow: current
          ? `0 0 0 ${px(4)} rgba(255,216,77,.4), 0 2px 0 ${COLORS.goldD}`
          : reached
            ? `0 2px 0 ${COLORS.goldD}`
            : '0 2px 0 rgba(75,53,36,.15)',
      },
      reached ? icon('check', 11, COLORS.ink, 3) : icon('lock', 10, COLORS.muted, 2),
    );

    const subtitle = current
      ? `${Math.floor(best)} M · YOU ARE HERE`
      : reached
        ? `FROM ${biome.fromM} M`
        : `UNLOCKS AT ${biome.fromM} M`;

    const label = el(
      'div',
      {
        flex: '1', minHeight: px(46),
        background: current ? COLORS.yellowL : reached ? COLORS.cream : 'rgba(255,251,240,.5)',
        opacity: reached ? '1' : '0.62',
        borderRadius: px(16), padding: `${px(8)} ${px(14)}`,
        boxShadow: current ? `0 3px 0 ${COLORS.goldD}` : '0 3px 0 rgba(75,53,36,.1)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      },
      el('div', { font: `800 ${px(15)} 'Baloo 2'`, color: COLORS.ink }, biome.name),
      el('div', {
        font: `700 ${px(11)} 'Nunito'`, letterSpacing: '.04em',
        color: current ? COLORS.orangeD : COLORS.muted,
      }, subtitle),
    );

    return el(
      'div',
      {
        position: 'absolute', top: px(y - 25), left: '0px', right: '0px',
        display: 'flex', alignItems: 'center', gap: px(12),
      },
      dot,
      label,
    );
  });

  const track = el(
    'div',
    { position: 'relative', width: '100%', height: px(TRACK_H + 40), margin: `${px(20)} 0` },
    // unreached (above best) segment
    el('div', {
      position: 'absolute', left: px(TRACK_X - 2), top: '0px',
      width: px(4), height: px(reachedY), borderRadius: px(2),
      background: COLORS.creamDeep, opacity: '.8',
    }),
    // reached (0..best) segment
    el('div', {
      position: 'absolute', left: px(TRACK_X - 2), top: px(reachedY),
      width: px(4), height: px(TRACK_H - reachedY), borderRadius: px(2),
      background: `linear-gradient(${COLORS.gold},${COLORS.yellowD})`,
    }),
    ...nodes,
  );

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
    }, 'Journey'),
    el('div', { position: 'absolute', top: px(58), right: px(20) }, pill('map', `${Math.floor(best)} M`, COLORS.orangeD)),
    el(
      'div',
      {
        position: 'absolute', top: px(130), left: '0px', right: '0px', bottom: px(104),
        overflowY: 'auto', overflowX: 'hidden', padding: `0 ${px(24)}`,
      },
      track,
    ),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(40), zIndex: '20', display: 'flex', gap: px(12) },
      secondaryButton('Home', 'home', () => go('home')),
    ),
  );
}
