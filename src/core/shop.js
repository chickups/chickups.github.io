// @ts-check

/**
 * The outfit shop: the feathers sink. Feathers are earned in a run (grab chains feed a
 * multiplier on banked feathers) and have had nothing to spend on since slice 1. This
 * module holds the catalogue and the pure purchase rule; `render/` draws the screen.
 *
 * The three keys below are exactly the outfits `src/render/art/peep.js`'s `buildOutfit`
 * knows how to draw ('cowboy', 'goggles', 'cape'). They are copied here rather than
 * imported, because `core/` may not import from `render/` (the Swift-portability rule) —
 * that is intentional, not an oversight, and if the art ever adds or renames an outfit
 * this table must be updated by hand to match.
 *
 * Cost ramp and calibration: a good run banks roughly 40-120 feathers (say ~70-80 on
 * average once the chain multiplier, capped at x5, is in play). The ramp below is chosen
 * so:
 *  - cowboy (120): reachable in about two runs — an early, cheap win that proves the
 *    shop exists and is worth checking after a run.
 *  - goggles (300): roughly four to five runs — a mid-tier goal for a player who is
 *    coming back regularly but isn't grinding.
 *  - cape (700): roughly nine to ten runs of dedicated play — a real target, but still
 *    reachable within a single sitting's worth of runs, not a multi-day grind.
 */

/** @typedef {{key:string, name:string, cost:number}} Outfit */

/** @typedef {{feathers:number, owned:string[]}} Wallet */

/**
 * @typedef {object} PurchaseResult
 * @property {boolean} ok
 * @property {number} feathers
 * @property {string[]} owned
 * @property {string|null} reason
 */

/**
 * The three buyable outfits, ascending cost. Frozen: this is a content table, not a
 * tuning surface — see the module doc above for the cost reasoning.
 * @type {Outfit[]}
 */
export const OUTFITS = Object.freeze([
  Object.freeze({ key: 'cowboy', name: 'Cowboy Hat', cost: 120 }),
  Object.freeze({ key: 'goggles', name: 'Flight Goggles', cost: 300 }),
  Object.freeze({ key: 'cape', name: 'Hero Cape', cost: 700 }),
]);

/**
 * The outfit every player starts with. Always owned, always free, and deliberately not
 * part of {@link OUTFITS} — it is never purchasable, so it needs no cost and no entry.
 * @type {'none'}
 */
export const DEFAULT_OUTFIT = 'none';

const UNKNOWN_OUTFIT = 'unknown-outfit';
const ALREADY_OWNED = 'already-owned';
const INSUFFICIENT_FEATHERS = 'insufficient-feathers';

/**
 * Look up a buyable outfit by key.
 * @param {string} key
 * @returns {Outfit|null}
 */
export function outfitAt(key) {
  for (const outfit of OUTFITS) {
    if (outfit.key === key) return outfit;
  }
  return null;
}

/**
 * Whether a wallet with this many feathers could afford this outfit. Does not consider
 * ownership — an already-owned outfit is still "affordable", it is `purchase` that
 * rejects re-buying it.
 * @param {number} feathers
 * @param {string} key
 * @returns {boolean}
 */
export function canAfford(feathers, key) {
  const outfit = outfitAt(key);
  if (!outfit) return false;
  return feathers >= outfit.cost;
}

/**
 * Buy an outfit. Pure: never mutates `wallet` or `wallet.owned`, always returns a new
 * wallet-shaped result. Rejects an unknown key, an already-owned outfit, or insufficient
 * feathers, each with its own distinct `reason`. On success, feathers are reduced by
 * exactly the outfit's cost (never below zero, since a purchase is only allowed when
 * `wallet.feathers >= cost`) and the key is appended to a fresh `owned` array.
 * @param {Wallet} wallet
 * @param {string} key
 * @returns {PurchaseResult}
 */
export function purchase(wallet, key) {
  const outfit = outfitAt(key);
  if (!outfit) {
    return { ok: false, feathers: wallet.feathers, owned: wallet.owned, reason: UNKNOWN_OUTFIT };
  }
  if (wallet.owned.includes(key)) {
    return { ok: false, feathers: wallet.feathers, owned: wallet.owned, reason: ALREADY_OWNED };
  }
  if (wallet.feathers < outfit.cost) {
    return { ok: false, feathers: wallet.feathers, owned: wallet.owned, reason: INSUFFICIENT_FEATHERS };
  }
  return {
    ok: true,
    feathers: wallet.feathers - outfit.cost,
    owned: [...wallet.owned, key],
    reason: null,
  };
}
