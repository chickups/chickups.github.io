// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';
import { success, tap } from '../haptics.js';

/**
 * Achievement toasts: a banner that drops in from the top, celebrates, and leaves.
 *
 * The host lives on the stage rather than inside a screen. A toast is triggered by
 * the run ending, which is the exact moment `game.js` navigates away — and
 * `router.go()` disposes the outgoing screen's subtree. A toast parented to the
 * game screen would be destroyed on the frame it was born. Parented to the stage,
 * it outlives the navigation and lands on the Oops/New Best screen, where the
 * player is actually looking.
 */

const IN_MS = 420;
const HOLD_MS = 2600;
const OUT_MS = 320;

/**
 * Confetti spilling out from behind the banner. Fixed, not random: art direction.
 *
 * `top` starts them UNDER the opaque card (which is ~62pt tall) so they emerge from
 * behind it rather than popping out of thin air — but they must travel far enough to
 * clear its bottom edge, or the whole effect plays out invisibly behind the card.
 * `delay` is measured from the banner's arrival, not the toast's, so the burst reads
 * as caused by the landing.
 */
const CONFETTI = Object.freeze([
  { left: 44, dx: -16, size: 13, dur: 1.5, delay: 0.06, color: COLORS.gold },
  { left: 108, dx: 10, size: 10, dur: 1.8, delay: 0.22, color: COLORS.orange },
  { left: 176, dx: -7, size: 15, dur: 1.4, delay: 0.0, color: COLORS.yellowD },
  { left: 246, dx: 13, size: 11, dur: 1.9, delay: 0.3, color: COLORS.gold },
  { left: 312, dx: -11, size: 14, dur: 1.6, delay: 0.14, color: COLORS.orange },
  { left: 350, dx: 8, size: 10, dur: 1.7, delay: 0.38, color: COLORS.yellowD },
]);

/** Where confetti starts: behind the card, near its lower edge. */
const CONF_TOP = 34;

/** @type {HTMLElement|null} */
let host = null;
/**
 * One shared queue for both toast kinds, so an achievement and a plain message
 * never overlap on screen — they simply take turns.
 * @type {Array<{text: string, kind: 'achievement'|'message'}>}
 */
const queue = [];
let showing = false;

/**
 * Create the toast layer. Call once, after the stage exists.
 * @param {HTMLElement} stage
 */
export function installToasts(stage) {
  if (host) return;
  host = el('div', {
    position: 'absolute', top: '0px', left: '0px', right: '0px',
    // Above every screen, including the game's HUD.
    zIndex: '9999',
    // The layer spans the top of the stage to give confetti room to fall, but must
    // never eat a tap meant for the screen underneath it.
    pointerEvents: 'none',
  });
  stage.appendChild(host);
}

/**
 * Queue an achievement toast. Safe to call before `installToasts` (the toast is
 * simply dropped) and safe to call with several at once — they show in sequence
 * rather than stacking on top of each other.
 * @param {string} name the achievement's display name
 */
export function toastAchievement(name) {
  if (!host) return;
  queue.push({ text: name, kind: 'achievement' });
  pump();
}

/**
 * Queue a plain confirmation toast — no trophy badge, no confetti, no
 * "Achievement" eyebrow. Used for feedback that isn't a celebration, e.g. sharing's
 * "Copied to clipboard" fallback. Same host/queue/choreography as
 * `toastAchievement`, so the two never stack.
 * @param {string} text
 */
export function toastMessage(text) {
  if (!host) return;
  queue.push({ text, kind: 'message' });
  pump();
}

/** Show the next queued toast, if one is waiting and none is on screen. */
function pump() {
  if (showing || queue.length === 0 || !host) return;
  const item = /** @type {{text: string, kind: 'achievement'|'message'}} */ (queue.shift());
  showing = true;

  const node = item.kind === 'achievement' ? banner(item.text) : messageBanner(item.text);
  host.appendChild(node);
  if (item.kind === 'achievement') success(); else tap();

  setTimeout(() => {
    node.style.animation = `toastOut ${OUT_MS}ms ease-in forwards`;
    setTimeout(() => {
      node.remove();
      showing = false;
      // Chain rather than recurse into a live toast: the next one starts only
      // once this one is gone.
      pump();
    }, OUT_MS);
  }, IN_MS + HOLD_MS);
}

/**
 * One toast banner, animation and all.
 * @param {string} name
 * @returns {HTMLElement}
 */
function banner(name) {
  const confetti = CONFETTI.map((c) => {
    const bit = el('div', {
      position: 'absolute', top: px(CONF_TOP), left: px(c.left), zIndex: '1',
      animation: `toastConf ${c.dur}s ease-out ${IN_MS / 1000 + c.delay}s`,
      opacity: '0',
    }, icon('feather', c.size, c.color));
    // A custom property CANNOT go through `el`'s style object: like the numeric
    // lengths `px()` exists for, `Object.assign(style, {'--dx': '4px'})` silently
    // sets nothing. setProperty is the only way in.
    bit.style.setProperty('--dx', px(c.dx));
    return bit;
  });

  const badge = el(
    'div',
    {
      position: 'relative',
      width: px(42), height: px(42), borderRadius: '50%',
      background: `linear-gradient(180deg,${COLORS.yellow},${COLORS.yellowD})`,
      boxShadow: `0 2px 0 ${COLORS.goldD}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flex: '0 0 auto',
      animation: `toastBadge 900ms ease-out ${IN_MS}ms`,
    },
    icon('trophy', 24, COLORS.ink),
  );

  return el(
    'div',
    {
      position: 'absolute',
      // Clear of the notch/status bar, matching the top bars on Home and the HUD.
      top: px(56), left: px(16), right: px(16),
      animation: `toastIn ${IN_MS}ms cubic-bezier(.2,1.5,.5,1) both`,
    },
    ...confetti,
    el(
      'div',
      {
        position: 'relative', zIndex: '2',
        display: 'flex', alignItems: 'center', gap: px(12),
        background: COLORS.cream, borderRadius: px(20),
        padding: `${px(10)} ${px(16)}`,
        boxShadow: '0 5px 0 rgba(75,53,36,.14), 0 10px 24px rgba(75,53,36,.18)',
      },
      badge,
      el(
        'div',
        { minWidth: '0px' },
        el('div', {
          font: `800 ${px(11)} 'Nunito'`, color: COLORS.orangeD,
          letterSpacing: px(0.6), textTransform: 'uppercase',
        }, 'Achievement'),
        el('div', {
          font: `800 ${px(17)} 'Baloo 2'`, color: COLORS.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }, name),
      ),
    ),
  );
}

/**
 * A plain confirmation toast — same drop-in/hold/drop-out choreography and CSS
 * keyframes as the achievement banner, but visually quiet: a small check glyph
 * instead of the trophy badge, no "Achievement" eyebrow, no confetti.
 * @param {string} text
 * @returns {HTMLElement}
 */
function messageBanner(text) {
  return el(
    'div',
    {
      position: 'absolute',
      top: px(56), left: px(16), right: px(16),
      animation: `toastIn ${IN_MS}ms cubic-bezier(.2,1.5,.5,1) both`,
    },
    el(
      'div',
      {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(10),
        background: COLORS.cream, borderRadius: px(20),
        padding: `${px(10)} ${px(16)}`,
        boxShadow: '0 5px 0 rgba(75,53,36,.14), 0 10px 24px rgba(75,53,36,.18)',
      },
      icon('check', 20, COLORS.orangeD),
      el('div', {
        font: `800 ${px(15)} 'Nunito'`, color: COLORS.ink,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }, text),
    ),
  );
}
