// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, statTile, progressBar } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { MILESTONES, passedMilestones } from '../../core/milestone.js';
import { getStats } from '../../storage.js';
import { leaveTo } from './reward.js';

/**
 * Subtitle per cause of death. Both stay on the right side of doc §05: warm,
 * no death wording, and pointed back at the next run rather than at the loss.
 * @type {Record<string, string>}
 */
const FLAVOUR = {
  fall: 'One more flap?',
  truck: 'Mind the traffic!',
};

/**
 * §05's `Feathers to next milestone` bar, or the plain feathers row once the ladder is
 * finished.
 *
 * Measured against LIFETIME feathers (`statTotalFeathers`), not the run's or the
 * spendable balance — the rungs are lifetime, and a bar that fell backwards when the
 * player bought a hat would be a lie.
 *
 * The bar spans the CURRENT rung's segment, not 0..rung: after passing 250, a bar drawn
 * from zero would already be a third full for a player who has earned nothing since.
 * Progress reads as "since the last reward", which is what the player is actually doing.
 *
 * Once every rung is passed there is no next one. Rather than divide by zero, or pin a
 * full bar on screen forever as a permanent lie, the bar is not drawn at all and the row
 * falls back to the honest `+N feathers` it replaced.
 * @param {number} runFeathers
 * @returns {HTMLElement}
 */
function milestoneRow(runFeathers) {
  const total = getStats().totalFeathers;
  const nextIndex = passedMilestones(total).length;

  if (nextIndex >= MILESTONES.length) {
    return el(
      'div',
      { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(6), marginBottom: px(16) },
      icon('feather', 16, COLORS.yellowD),
      el('span', { font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted }, `+${runFeathers} feathers`),
    );
  }

  const floor = nextIndex === 0 ? 0 : MILESTONES[nextIndex - 1];
  const span = MILESTONES[nextIndex] - floor;
  const into = Math.max(0, Math.min(span, total - floor));

  return el(
    'div',
    { marginBottom: px(16) },
    progressBar(into, span, {
      label: 'Feathers to next milestone',
      trailing: `+${runFeathers}`,
    }),
  );
}

/**
 * Doc §05: no death-screen wording — a friendly Oops!, and one tap back into a run.
 * @param {(name: string) => void} go
 * @param {{score: number, best: number, feathers: number, deathBy?: 'fall'|'truck'}} arg
 * @returns {HTMLElement}
 */
export function oopsScreen(go, arg) {
  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'linear-gradient(180deg,#CFEBFB,#A6DCF6 50%,#8BD450 50%,#72C23A)',
      animation: 'pFade .4s',
    },
    el(
      'div',
      { position: 'absolute', top: px(150), left: '0px', right: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
      el(
        'div',
        { position: 'relative', animation: 'pPop .5s ease-out both' },
        el('div', { position: 'absolute', top: px(-6), left: px(-18), animation: 'pTwinkle 1.3s ease-in-out infinite' }, icon('star', 22, '#FFCE3A')),
        el('div', { position: 'absolute', top: px(2), right: px(-20), animation: 'pTwinkle 1.6s ease-in-out infinite' }, icon('star', 16, COLORS.orange)),
        peep(150, 'sad'),
      ),
    ),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(52),
        background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
      },
      el('div', { textAlign: 'center', font: `800 ${px(40)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1' }, 'Oops!'),
      el('div', { textAlign: 'center', font: `700 ${px(15)} 'Nunito'`, color: COLORS.orangeD, margin: `${px(4)} 0 ${px(18)}` }, FLAVOUR[arg.deathBy || 'fall'] || FLAVOUR.fall),
      el('div', { display: 'flex', gap: px(14), marginBottom: px(14) }, statTile('SCORE', String(arg.score)), statTile('BEST', String(arg.best))),
      milestoneRow(arg.feathers),
      primaryButton('Try Again', 'refresh', () => leaveTo(go, 'game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      secondaryButton('Home', 'home', () => leaveTo(go, 'home')),
    ),
  );
}
