// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { pill, secondaryButton, pressable, iconButton, TAP_MIN } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { OUTFITS, DEFAULT_OUTFIT, canAfford, purchase } from '../../core/shop.js';
import {
  getFeathers,
  setFeathers,
  getOwnedOutfits,
  addOwnedOutfit,
  getEquippedOutfit,
  setEquippedOutfit,
} from '../../storage.js';

/** @typedef {{key: string, name: string, cost: number}} ShopEntry */

/**
 * The catalogue row for the free "take it off" option. Not part of `core/shop.js`'s
 * `OUTFITS` — it is never purchasable — but the shop screen shows it first so a
 * player can always get back to a bare Peep.
 * @type {ShopEntry}
 */
const NONE_ENTRY = { key: DEFAULT_OUTFIT, name: 'No Outfit', cost: 0 };

/**
 * One outfit row: a `peep()` preview, name, state text, and a state-dependent
 * action button (Buy / too poor / Equip / Equipped).
 * @param {ShopEntry} entry
 * @param {() => void} refresh re-render the whole shop screen after a state change
 * @param {number} feathers current spendable balance, read once per render
 * @param {string[]} owned outfit keys owned, read once per render
 * @param {string} equipped the currently-equipped outfit key, read once per render
 * @returns {HTMLElement}
 */
function outfitRow(entry, refresh, feathers, owned, equipped) {
  const isDefault = entry.key === DEFAULT_OUTFIT;
  const isOwned = isDefault || owned.includes(entry.key);
  const isEquipped = equipped === entry.key;
  const affordable = isDefault || canAfford(feathers, entry.key);

  /** @type {string} */
  let label;
  /** @type {(() => void)|null} */
  let onTap = null;
  let disabled = false;

  if (isEquipped) {
    label = 'Equipped';
    disabled = true;
  } else if (isOwned) {
    label = 'Equip';
    onTap = () => {
      setEquippedOutfit(entry.key);
      refresh();
    };
  } else if (affordable) {
    label = `Buy · ${entry.cost}`;
    onTap = () => {
      const result = purchase({ feathers, owned }, entry.key);
      if (result.ok) {
        setFeathers(result.feathers);
        addOwnedOutfit(entry.key);
      }
      refresh();
    };
  } else {
    label = 'Need more';
    disabled = true;
  }

  const restShadow = `0 4px 0 ${COLORS.goldD}`;
  const pressShadow = `0 0px 0 ${COLORS.goldD}`;
  const btn = el(
    'div',
    {
      flex: 'none',
      minWidth: px(104),
      minHeight: px(TAP_MIN),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `0 ${px(12)}`,
      borderRadius: px(16),
      font: `800 ${px(13)} 'Baloo 2'`,
      textAlign: 'center',
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? COLORS.creamDeep : `linear-gradient(${COLORS.gold},${COLORS.yellowD})`,
      color: disabled ? COLORS.muted : COLORS.ink,
      boxShadow: disabled ? 'none' : restShadow,
      transition: 'transform .08s, box-shadow .08s',
    },
    label,
  );
  if (!disabled && onTap) pressable(btn, 4, restShadow, pressShadow, onTap);

  const subtitle = isEquipped ? 'Equipped' : isOwned ? 'Owned' : `${entry.cost} feathers`;
  const subtitleColor = isOwned ? COLORS.muted : affordable ? COLORS.orangeD : COLORS.muted;

  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: px(14),
      background: COLORS.cream,
      borderRadius: px(22),
      padding: px(12),
      boxShadow: '0 4px 0 rgba(75,53,36,.1)',
    },
    el(
      'div',
      {
        flex: 'none', width: px(64), height: px(64),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: COLORS.creamDeep, borderRadius: px(18),
      },
      peep(52, 'idle', /** @type {import('../art/peep.js').PeepOutfit} */ (entry.key), false),
    ),
    el(
      'div',
      { flex: '1', minWidth: '0px', display: 'flex', flexDirection: 'column', gap: px(4) },
      el('div', { font: `800 ${px(16)} 'Baloo 2'`, color: COLORS.ink }, entry.name),
      el('div', { font: `700 ${px(12.5)} 'Nunito'`, color: subtitleColor }, subtitle),
    ),
    btn,
  );
}

/**
 * The outfit shop: spend feathers on cosmetics. Every outfit previews live via
 * `peep()`, the whole point of a cosmetic shop being to see it on Peep before
 * buying it. State (owned/equipped/balance) lives in `src/storage.js`; the
 * purchase rule itself is `core/shop.js`'s pure `purchase()`.
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function shopScreen(go) {
  const feathers = getFeathers();
  const owned = getOwnedOutfits();
  const equipped = getEquippedOutfit();

  // The simplest correct way to reflect a storage change: re-mount this screen,
  // which re-reads storage from scratch. No local DOM patching to keep in sync.
  const refresh = () => go('shop');

  // The wrapper owns placement; iconButton owns the lip. Keeping them apart is
  // required — `pressable` writes `transform`, which a positioning transform
  // would silently overwrite.
  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );

  /** @type {ShopEntry[]} */
  const entries = [NONE_ENTRY, ...OUTFITS];
  const rows = entries.map((entry) => outfitRow(entry, refresh, feathers, owned, equipped));

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
    }, 'Shop'),
    el('div', { position: 'absolute', top: px(58), right: px(20) }, pill('feather', String(feathers), COLORS.yellowD)),
    el(
      'div',
      {
        position: 'absolute', top: px(130), left: '0px', right: '0px', bottom: px(104),
        overflowY: 'auto', overflowX: 'hidden', padding: `0 ${px(20)}`,
        display: 'flex', flexDirection: 'column', gap: px(12),
      },
      ...rows,
    ),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(40), zIndex: '20', display: 'flex', gap: px(12) },
      secondaryButton('Home', 'home', () => go('home')),
    ),
  );
}
