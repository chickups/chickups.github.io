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

/** `COLORS.cream` at 92% — there is no alpha token; `pill()` above hardcodes the same value. */
const ICON_BUTTON_BG = 'rgba(255,251,240,.92)';
const ICON_BUTTON_SHADOW = `0 ${px(3)} 0 rgba(75,53,36,.12)`;
const ICON_BUTTON_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.12)';

/**
 * §11's Icon button. Hoisted from four near-identical copies (home's `navButton`,
 * and the back buttons in shop / achievements / journey), which differed only in
 * glyph size (20 vs 22 — unified to a derived 21) and glyph colour (an opt).
 *
 * Positioning is deliberately NOT this component's job: `pressable` writes
 * `node.style.transform`, so a positioning transform here would fight the lip.
 * Callers that need placement wrap this in a positioned `el('div', …)`.
 *
 * @param {string} glyph a key from `render/art/icon.js` — only glyphs that exist
 * @param {() => void} onTap
 * @param {{size?: number, bg?: string, color?: string}} [opts]
 * @returns {HTMLElement}
 */
export function iconButton(glyph, onTap, opts = {}) {
  // Floored, not defaulted: §11's >=44pt target is not a caller's to opt out of.
  const size = Math.max(TAP_MIN, opts.size ?? TAP_MIN);
  const bg = opts.bg ?? ICON_BUTTON_BG;
  const color = opts.color ?? COLORS.ink;
  const node = el(
    'div',
    {
      flex: 'none',
      width: px(size), height: px(size), borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: ICON_BUTTON_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    icon(glyph, Math.round(size * 0.47), color),
  );
  pressable(node, 3, ICON_BUTTON_SHADOW, ICON_BUTTON_SHADOW_PRESSED, onTap);
  return node;
}

/** The lip under a destructive fill. Brown, matching `primaryButton`'s ambient
 *  shadow family — there is no dark-red token and `ui.js` may not invent one. */
const DESTRUCTIVE_SHADOW = `0 ${px(4)} 0 rgba(75,53,36,.28)`;
const DESTRUCTIVE_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.28)';

/**
 * §11's Destructive button. Same footprint as `secondaryButton` — `flex: '1'`,
 * so it drops into the same action rows — but a red fill rather than cream, so
 * "Quit Run" never reads as just another neutral choice.
 *
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @returns {HTMLElement}
 */
export function destructiveButton(label, glyph, onTap) {
  const node = el(
    'div',
    {
      flex: '1',
      minHeight: px(TAP_MIN),
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(8),
      background: COLORS.red, color: COLORS.cream,
      font: `800 ${px(17)} 'Baloo 2'`,
      padding: `${px(13)} 0`,
      borderRadius: px(20),
      boxShadow: DESTRUCTIVE_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    glyph ? icon(glyph, 18, COLORS.cream) : null,
    label,
  );
  pressable(node, 4, DESTRUCTIVE_SHADOW, DESTRUCTIVE_SHADOW_PRESSED, onTap);
  return node;
}

/**
 * §11's Progress. A labelled track with a fill — used for the Oops screen's
 * "Feathers to next milestone" and the streak ladder.
 *
 * @param {number} value
 * @param {number} max clamped to >=1 so a zero max cannot divide by zero
 * @param {{label?: string, trailing?: string, height?: number}} [opts]
 * @returns {HTMLElement}
 */
export function progressBar(value, max, opts = {}) {
  const height = opts.height ?? 14;
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  // A percentage, NOT px() — the track's width is not known here.
  const fillWidth = `${ratio * 100}%`;
  const header =
    opts.label || opts.trailing
      ? el(
          'div',
          {
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: px(6),
          },
          el('div', {
            font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.06em',
          }, opts.label ?? ''),
          el('div', {
            font: `800 ${px(14)} 'Baloo 2'`, color: COLORS.ink,
          }, opts.trailing ?? ''),
        )
      : null;
  return el(
    'div',
    { width: '100%' },
    header,
    el(
      'div',
      {
        width: '100%', height: px(height),
        background: COLORS.creamDeep,
        borderRadius: px(height / 2),
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 0 rgba(75,53,36,.1)',
      },
      el('div', {
        width: fillWidth, height: '100%',
        background: `linear-gradient(90deg,${COLORS.gold},${COLORS.yellowD})`,
        borderRadius: px(height / 2),
      }),
    ),
  );
}

const TOGGLE_SHADOW = `0 ${px(4)} 0 rgba(75,53,36,.1)`;
const TOGGLE_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.1)';

/**
 * §11's Toggle. §07 requires that state is NOT carried by colour alone, so the
 * track shows "ON"/"OFF" as text in addition to its fill colour and the knob's
 * side. Do not "tidy" that text away — it is the accessibility contract.
 *
 * The whole ROW is the tap target (>= TAP_MIN tall), not just the little track.
 *
 * @param {string} label
 * @param {boolean} isOn
 * @param {(next: boolean) => void} onChange
 * @returns {HTMLElement}
 */
export function toggleRow(label, isOn, onChange) {
  const knob = el('div', {
    flex: 'none',
    width: px(26), height: px(26), borderRadius: '50%',
    background: COLORS.cream,
    boxShadow: `0 ${px(2)} 0 rgba(75,53,36,.18)`,
  });
  const stateText = el('span', {
    font: `800 ${px(11)} 'Nunito'`, letterSpacing: '.06em',
    color: isOn ? COLORS.cream : COLORS.muted,
    padding: `0 ${px(3)}`,
  }, isOn ? 'ON' : 'OFF');
  const track = el(
    'div',
    {
      flex: 'none',
      display: 'flex', alignItems: 'center',
      justifyContent: isOn ? 'flex-end' : 'flex-start',
      gap: px(4),
      width: px(68), height: px(32), borderRadius: px(16),
      padding: `0 ${px(3)}`,
      background: isOn ? COLORS.grass : COLORS.creamDeep,
      boxShadow: 'inset 0 2px 0 rgba(75,53,36,.12)',
    },
    // On: text then knob (knob ends up right). Off: knob then text (knob left).
    ...(isOn ? [stateText, knob] : [knob, stateText]),
  );
  const node = el(
    'div',
    {
      width: '100%',
      minHeight: px(TAP_MIN),
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: px(12),
      background: COLORS.cream,
      borderRadius: px(20),
      padding: `${px(8)} ${px(14)}`,
      cursor: 'pointer',
      boxShadow: TOGGLE_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    el('div', { font: `800 ${px(16)} 'Baloo 2'`, color: COLORS.ink }, label),
    track,
  );
  pressable(node, 4, TOGGLE_SHADOW, TOGGLE_SHADOW_PRESSED, () => onChange(!isOn));
  return node;
}

const TAB_SHADOW = `0 ${px(3)} 0 rgba(75,53,36,.16)`;
const TAB_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.16)';

/**
 * §11's tabs — a segmented control. An item may be `disabled` (Race a Player has
 * no backend and ships disabled): it renders, takes no press lip, and never
 * fires `onChange`.
 *
 * @param {{label: string, disabled?: boolean}[]} items
 * @param {number} activeIndex
 * @param {(index: number) => void} onChange
 * @returns {HTMLElement}
 */
export function tabs(items, activeIndex, onChange) {
  const row = el('div', {
    display: 'flex', gap: px(4),
    width: '100%',
    background: COLORS.creamDeep,
    borderRadius: px(22),
    padding: px(4),
  });
  items.forEach((item, i) => {
    const active = i === activeIndex;
    const disabled = item.disabled ?? false;
    const rest = active ? TAB_SHADOW : 'none';
    const press = active ? TAB_SHADOW_PRESSED : 'none';
    const node = el(
      'div',
      {
        flex: '1',
        minHeight: px(TAP_MIN),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: px(18),
        background: active ? COLORS.cream : 'transparent',
        color: COLORS.ink,
        opacity: disabled ? '0.45' : '1',
        cursor: disabled ? 'default' : 'pointer',
        font: `800 ${px(15)} 'Baloo 2'`,
        boxShadow: rest,
        transition: 'transform .08s, box-shadow .08s',
      },
      item.label,
    );
    if (!disabled) {
      // Both shadow strings are passed explicitly — reading boxShadow back does
      // not return what was written, so deriving `press` from `rest` is a trap.
      pressable(node, 3, rest, press, () => onChange(i));
    }
    row.appendChild(node);
  });
  return row;
}

/** Every glyph below EXISTS in `render/art/icon.js` — do not swap in one that does not. */
const ITEM_STATES = Object.freeze({
  selected: { glyph: 'check', bg: COLORS.grass, fg: COLORS.cream },
  new: { glyph: 'star', bg: COLORS.orange, fg: COLORS.cream },
  rewarded: { glyph: 'gift', bg: COLORS.yellowD, fg: COLORS.ink },
  locked: { glyph: 'lock', bg: COLORS.creamDeep, fg: COLORS.muted },
});

/**
 * §11's item states — `Selected`, `NEW`, `Rewarded`, and the locked condition
 * badge (`1,000 m`). A badge, not a control: it is never tapped, so it carries
 * no TAP_MIN. An unknown kind falls back to `locked` rather than throwing —
 * a badge must never take a screen down.
 *
 * @param {'selected'|'new'|'rewarded'|'locked'} kind
 * @param {string} text
 * @returns {HTMLElement}
 */
export function itemState(kind, text) {
  const s = ITEM_STATES[kind] ?? ITEM_STATES.locked;
  return el(
    'div',
    {
      display: 'inline-flex', alignItems: 'center', gap: px(5),
      background: s.bg, color: s.fg,
      font: `800 ${px(11)} 'Nunito'`, letterSpacing: '.06em',
      padding: `${px(4)} ${px(9)}`,
      borderRadius: px(11),
      whiteSpace: 'nowrap',
    },
    icon(s.glyph, 12, s.fg),
    el('span', null, text),
  );
}
