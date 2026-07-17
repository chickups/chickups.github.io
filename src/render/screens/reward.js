// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { setEquippedOutfit } from '../../storage.js';
import { success } from '../../haptics.js';
import { chime } from '../../sound.js';

/**
 * §05's Reward Unlocked! screen, and the interstitial gate that decides when it shows.
 *
 * ## Why a screen and not a toast
 *
 * `toast.js` parents to `#stage` precisely because `router.go()` disposes the outgoing
 * screen's subtree — a toast born on the game screen would die on the frame it was born.
 * That trick buys a toast the right to OUTLIVE a navigation and land on top of whatever
 * arrives next.
 *
 * A reward is not that. §05 gives it a full screen with two decisions on it (`Equip Now`
 * / `Continue`), so it cannot ride above another screen — it IS the screen, and it must
 * be navigated TO. Its constraint is therefore the mirror image of the toast's: not "how
 * do I survive the dispose?" but "where does the pending state live, given that every
 * screen node is disposable?"
 *
 * The answer is the same shape as `toast.js`'s queue — a module-level variable. It lives
 * in the module, not in any DOM subtree, so `router.go()` cannot reach it: the game
 * screen is torn down, the terminal screen is built and torn down in turn, and `pending`
 * is still sitting here. Nothing races it, and a fast tap on `Go Again` cannot skip it,
 * because the tap goes through `leaveTo` and `leaveTo` reads this variable.
 *
 * ## Why an interstitial and not a competitor
 *
 * §05 sequences New Best -> Reward Unlocked. The score has the player's attention at the
 * moment a run ends; a reward shown at the same instant is two celebrations fighting.
 * So the reward waits, and fires when the player LEAVES the terminal screen:
 * `Go Again`/`Home` -> `reward` -> the original destination.
 */

/** @typedef {import('../../core/milestone.js').Grant} Grant */

/**
 * The reward waiting to be shown, if any. Module-level, like `toast.js`'s queue, and for
 * the same reason: it must survive every `router.go()` between earning it and showing it.
 * @type {Grant|null}
 */
let pending = null;

/**
 * Hold a granted reward until the player leaves the terminal screen. The grant itself has
 * ALREADY happened by the time this is called (see `checkMilestones` in storage.js) — this
 * only queues the celebration, so dropping it would cost a screen, never an outfit.
 *
 * Only one is held: two rungs in one run is possible but vanishingly rare, and a queue of
 * reward screens is the parade we are trying not to build. The last grant wins because it
 * is the bigger one (rungs ascend).
 * @param {Grant} grant
 */
export function queueReward(grant) {
  pending = grant;
}

/**
 * Leave a terminal screen. If a reward is waiting, it interstitials in front of the
 * destination; otherwise this is a plain `go`.
 *
 * Takes `dest` as an argument and never enumerates screen names, so a terminal screen
 * added later (`won`, Task 14) needs no change here.
 * @param {(name: string, arg?: any) => void} go
 * @param {string} dest
 * @param {any} [destArg]
 */
export function leaveTo(go, dest, destArg) {
  if (pending === null) {
    go(dest, destArg);
    return;
  }
  const grant = pending;
  // Cleared BEFORE navigating: `go` synchronously builds the reward screen, and a
  // reward left in the variable would fire again the moment the player left it.
  pending = null;
  go('reward', { grant, then: dest, thenArg: destArg });
}

/**
 * @param {Grant} grant
 * @returns {string} the §05 headline body — the outfit's real name, or the bonus
 */
function rewardLabel(grant) {
  // §05 names "Aviator Goggles". The shipped outfit (shop.js:44) is "Flight Goggles".
  // The CODE is the source of truth for the name the player sees on the hat itself, so
  // the real name wins and the doc's is a recorded divergence, not a rename to make.
  return grant.kind === 'outfit' ? grant.name : `+${grant.amount} Feathers`;
}

/**
 * §05: `Reward Unlocked!` / the outfit name / "Ready for takeoff." / `Equip Now` +
 * `Continue`.
 * @param {(name: string, arg?: any) => void} go
 * @param {{grant: Grant, then: string, thenArg?: any}} arg
 * @returns {HTMLElement}
 */
export function rewardScreen(go, arg) {
  // §12: reward unlock is a success haptic, same as a new best, plus the reward
  // chime. Both are gated internally (haptics/sound settings), so this is silent
  // for a player who has turned either off.
  success();
  chime();

  const { grant } = arg;
  const onwards = () => go(arg.then, arg.thenArg);

  const confetti = [
    { top: 110, left: 36, size: 18, dur: 2.5, delay: 0, color: COLORS.cream },
    { top: 86, left: 150, size: 15, dur: 2.9, delay: 0.35, color: COLORS.creamDeep },
    { top: 118, left: 296, size: 21, dur: 2.6, delay: 0.7, color: COLORS.cream },
    { top: 96, left: 232, size: 13, dur: 3.1, delay: 1.05, color: COLORS.creamDeep },
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
      background: 'radial-gradient(120% 80% at 50% 30%,#FFE08A,#FFB43A 55%,#FF963C)',
      animation: 'pFade .4s',
    },
    ...confetti,
    el(
      'div',
      { position: 'absolute', top: px(130), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        display: 'inline-block', background: COLORS.ink, color: '#FFDA4A',
        font: `800 ${px(22)} 'Baloo 2'`, padding: `${px(8)} ${px(24)}`,
        borderRadius: px(22), transform: 'rotate(-3deg)',
      }, 'Reward Unlocked!'),
    ),
    // Peep wears the reward if it is one, so the screen shows the thing it names.
    el('div', {
      position: 'absolute', top: px(196), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(150, 'celebrate', grant.kind === 'outfit' ? grant.outfitKey : undefined)),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(52), zIndex: '5',
        background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
      },
      el('div', {
        textAlign: 'center', font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1',
      }, rewardLabel(grant)),
      el('div', {
        textAlign: 'center', font: `700 ${px(15)} 'Nunito'`, color: COLORS.orangeD,
        margin: `${px(6)} 0 ${px(18)}`,
      }, 'Ready for takeoff.'),
      // A feather bonus has nothing to equip. §05's two-button pair collapses to the
      // one action that means anything rather than showing a dead `Equip Now`.
      grant.kind === 'outfit'
        ? primaryButton('Equip Now', 'check', () => {
            setEquippedOutfit(grant.outfitKey);
            onwards();
          }, { size: 24, lip: 6 })
        : null,
      grant.kind === 'outfit' ? el('div', { height: px(12) }) : null,
      grant.kind === 'outfit'
        ? secondaryButton('Continue', 'play', onwards)
        : primaryButton('Continue', 'play', onwards, { size: 24, lip: 6 }),
    ),
  );
}
