// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';

/** Doc §11: every tappable target is at least this tall. */
export const TAP_MIN = 44;

/**
 * The doc's signature button: a solid bottom "lip" that compresses on press.
 * @param {HTMLElement} node
 * @param {number} lip shadow depth in points
 */
function pressable(node, lip) {
  // Capture both states once, at rest. Recomputing the pressed shadow from the
  // live style would compound: press twice and the lip is gone for good.
  const restShadow = node.style.boxShadow;
  const pressShadow = restShadow.replace(/0 [\d.]+px 0/, '0 0px 0');
  node.addEventListener('pointerdown', () => {
    node.style.transform = `translateY(${px(lip)})`;
    node.style.boxShadow = pressShadow;
  });
  const release = () => {
    node.style.transform = 'translateY(0px)';
    node.style.boxShadow = restShadow;
  };
  node.addEventListener('pointerup', release);
  node.addEventListener('pointerleave', release);
  node.addEventListener('pointercancel', release);
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
      boxShadow: disabled
        ? 'none'
        : `0 ${px(lip)} 0 ${COLORS.goldD}, 0 ${px(lip * 2)} ${px(24)} rgba(75,53,36,.28)`,
      transition: 'transform .08s',
    },
    glyph ? icon(glyph, size * 0.87, disabled ? '#9c8f7a' : COLORS.ink) : null,
    label,
  );
  if (!disabled) {
    pressable(node, lip);
    node.addEventListener('pointerup', onTap);
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
      boxShadow: '0 4px 0 rgba(75,53,36,.12)',
      transition: 'transform .08s',
    },
    glyph ? icon(glyph, 18, COLORS.ink) : null,
    label,
  );
  pressable(node, 4);
  node.addEventListener('pointerup', onTap);
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

/**
 * @param {string} title
 * @param {string} subtitle
 * @param {{disabled?: boolean, badge?: string}} [opts]
 * @returns {HTMLElement}
 */
export function card(title, subtitle, opts = {}) {
  const disabled = opts.disabled ?? false;
  return el(
    'div',
    {
      position: 'relative',
      flex: '1',
      background: COLORS.cream,
      borderRadius: px(22),
      padding: `${px(14)} ${px(16)}`,
      boxShadow: '0 4px 0 rgba(75,53,36,.1)',
      opacity: disabled ? '0.55' : '1',
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
}
