// @ts-check

/**
 * The settings table. PURE — the table and a lookup, nothing else. `storage.js`
 * is the only stateful seam; this module never reads or writes anything.
 *
 * Spec D8: only toggles that DO something ship. The AUDIO group is all wired:
 * Sound Effects to `src/sound.js`'s WebAudio engine, and Music / Alternate
 * Music to `src/music.js`'s file-playback engine (Music enables the soundtrack;
 * Alternate Music swaps every track to its second recorded variant). There is
 * one language and no IAP, so Language and Restore Purchases are omitted; the
 * verb is a full-screen tap, so Left-Handed Mode has nothing to mirror. A
 * switch that looks identical to a working one and silently does nothing
 * teaches the player that the game is broken.
 *
 * Adding a row here ships a switch. Do not add one until it takes effect
 * somewhere.
 */

/** @typedef {{key:string, label:string, group:string, def:boolean}} Setting */

/** @type {readonly Setting[]} */
export const SETTINGS = Object.freeze([
  { key: 'haptics', label: 'Haptics', group: 'GAMEPLAY', def: true },
  { key: 'sound', label: 'Sound Effects', group: 'AUDIO', def: true },
  // Default OFF while the soundtrack is still being finished — the author will
  // flip this back to true when Music is ready to ship on by default.
  { key: 'music', label: 'Music', group: 'AUDIO', def: false },
  { key: 'altMusic', label: 'Alternate Music', group: 'AUDIO', def: false },
  { key: 'hints', label: 'Tutorial Hints', group: 'GAMEPLAY', def: true },
  { key: 'motion', label: 'Reduced Motion', group: 'GAMEPLAY', def: false },
  { key: 'contrast', label: 'High Contrast', group: 'GAMEPLAY', def: false },
]);

/**
 * @param {string} key untrusted — may come from a stored settings record
 * @returns {Setting|null}
 */
export function settingAt(key) {
  return SETTINGS.find((s) => s.key === key) ?? null;
}
