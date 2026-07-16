// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';

/** Doc §11: every tappable target is at least this tall. */
export const TAP_MIN = 44;

/**
 * The doc's signature button (§11): a solid bottom "lip" that compresses on press.
 *
 * Both shadow strings are passed in explicitly rather than derived by rewriting
 * `node.style.boxShadow`. Reading that property back does NOT return what you
 * wrote — the browser normalises it, moving the colour first and expanding
 * offsets, so `0 8px 0 #D19412` comes back as `rgb(209, 148, 18) 0px 8px 0px`.
 * Any regex written against the authored form silently fails to match, the
 * pressed shadow ends up identical to the rest shadow, and the lip never
 * compresses at all — with no error anywhere.
 *
 * A tap only counts if the press that triggered it started on this same
 * node — otherwise a finger lifted over the button (e.g. still held from
 * the death that just ended the run) would fire it via a bare `pointerup`,
 * which needs no matching press at all.
 *
 * @param {HTMLElement} node
 * @param {number} lip shadow depth in points
 * @param {string} restShadow
 * @param {string} pressShadow
 * @param {() => void} [onTap]
 */
export function pressable(node, lip, restShadow, pressShadow, onTap) {
  let armed = false;
  node.addEventListener('pointerdown', () => {
    armed = true;
    node.style.transform = `translateY(${px(lip)})`;
    node.style.boxShadow = pressShadow;
  });
  const reset = () => {
    node.style.transform = 'translateY(0px)';
    node.style.boxShadow = restShadow;
  };
  node.addEventListener('pointerup', () => {
    const fire = armed; // only a press that started HERE counts
    armed = false;
    reset();
    if (fire && onTap) onTap();
  });
  node.addEventListener('pointerleave', () => { armed = false; reset(); });
  node.addEventListener('pointercancel', () => { armed = false; reset(); });
}

/**
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @param {{size?: number, lip?: number, disabled?: boolean}} [opts]
 * @returns {HTMLElement}
 */
export function primaryButton(label, glyph, onTap, opts = {}) {
  const size = opts.size ?? 30;
  const lip = opts.lip ?? 8;
  const disabled = opts.disabled ?? false;
  const restShadow = `0 ${px(lip)} 0 ${COLORS.goldD}, 0 ${px(lip * 2)} ${px(24)} rgba(75,53,36,.28)`;
  const pressShadow = `0 0px 0 ${COLORS.goldD}, 0 ${px(lip)} ${px(12)} rgba(75,53,36,.28)`;
  const node = el(
    'div',
    {
      width: '100%',
      minHeight: px(TAP_MIN),
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(10),
      background: disabled ? '#DCD3C0' : `linear-gradient(${COLORS.gold},${COLORS.yellowD})`,
      color: disabled ? '#9c8f7a' : COLORS.ink,
      font: `800 ${px(size)} 'Baloo 2'`,
      padding: `${px(size * 0.73)} 0`,
      borderRadius: px(34),
      boxShadow: disabled ? 'none' : restShadow,
      transition: 'transform .08s, box-shadow .08s',
    },
    glyph ? icon(glyph, size * 0.87, disabled ? '#9c8f7a' : COLORS.ink) : null,
    label,
  );
  if (!disabled) {
    pressable(node, lip, restShadow, pressShadow, onTap);
  }
  return node;
}

/**
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @returns {HTMLElement}
 */
export function secondaryButton(label, glyph, onTap) {
  const restShadow = '0 4px 0 rgba(75,53,36,.12)';
  const pressShadow = '0 0px 0 rgba(75,53,36,.12)';
  const node = el(
    'div',
    {
      flex: '1',
      minHeight: px(TAP_MIN),
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(8),
      background: COLORS.creamDeep, color: COLORS.ink,
      font: `800 ${px(17)} 'Baloo 2'`,
      padding: `${px(13)} 0`,
      borderRadius: px(20),
      boxShadow: restShadow,
      transition: 'transform .08s, box-shadow .08s',
    },
    glyph ? icon(glyph, 18, COLORS.ink) : null,
    label,
  );
  pressable(node, 4, restShadow, pressShadow, onTap);
  return node;
}

/**
 * @param {string} glyph
 * @param {string} text
 * @param {string} [color]
 * @returns {HTMLElement}
 */
export function pill(glyph, text, color = COLORS.ink) {
  return el(
    'div',
    {
      display: 'flex', alignItems: 'center', gap: px(6),
      background: 'rgba(255,251,240,.92)',
      padding: `${px(8)} ${px(14)}`,
      borderRadius: px(20),
      boxShadow: '0 3px 0 rgba(75,53,36,.12)',
    },
    icon(glyph, 16, color),
    el('span', { font: `800 ${px(16)} 'Baloo 2'`, color }, text),
  );
}

/**
 * A labelled stat tile — SCORE / BEST / MULT. Used by Pause and Oops!.
 * @param {string} label
 * @param {string} value
 * @param {number} [size] font size of the value, in points
 * @returns {HTMLElement}
 */
export function statTile(label, value, size = 40) {
  return el(
    'div',
    { flex: '1', background: COLORS.creamDeep, borderRadius: px(20), padding: px(12), textAlign: 'center' },
    el('div', { font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.06em' }, label),
    el('div', { font: `800 ${px(size)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1.1' }, value),
  );
}

const CARD_SHADOW = '0 4px 0 rgba(75,53,36,.1)';
const CARD_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.1)';

/**
 * @param {string} title
 * @param {string} subtitle
 * @param {{disabled?: boolean, badge?: string, onTap?: () => void}} [opts]
 * @returns {HTMLElement}
 */
export function card(title, subtitle, opts = {}) {
  const disabled = opts.disabled ?? false;
  const node = el(
    'div',
    {
      position: 'relative',
      flex: '1',
      background: COLORS.cream,
      borderRadius: px(22),
      padding: `${px(14)} ${px(16)}`,
      boxShadow: CARD_SHADOW,
      opacity: disabled ? '0.55' : '1',
      cursor: !disabled && opts.onTap ? 'pointer' : 'default',
    },
    el('div', { font: `800 ${px(17)} 'Baloo 2'`, color: COLORS.ink }, title),
    el('div', { font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted }, subtitle),
    opts.badge
      ? el('div', {
          position: 'absolute', top: px(-8), right: px(10),
          background: COLORS.muted, color: COLORS.cream,
          font: `800 ${px(10)} 'Nunito'`, letterSpacing: '.06em',
          padding: `${px(3)} ${px(8)}`, borderRadius: px(10),
        }, opts.badge)
      : null,
  );
  if (!disabled && opts.onTap) {
    pressable(node, 4, CARD_SHADOW, CARD_SHADOW_PRESSED, opts.onTap);
  }
  return node;
}
