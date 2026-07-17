// @ts-check

/**
 * The settings table. PURE — the table and a lookup, nothing else. `storage.js`
 * is the only stateful seam; this module never reads or writes anything.
 *
 * Spec D8: only toggles that DO something ship. Sound Effects is wired to
 * `src/sound.js`'s WebAudio engine, so it ships; Music remains omitted — a
 * music loop needs asset files and a mix, out of proportion for this game.
 * There is one language and no IAP, so Language and Restore Purchases are
 * omitted; the verb is a full-screen tap, so Left-Handed Mode has nothing to
 * mirror. A switch that looks identical to a working one and silently does
 * nothing teaches the player that the game is broken.
 *
 * Adding a row here ships a switch. Do not add one until it takes effect
 * somewhere.
 */

/** @typedef {{key:string, label:string, group:string, def:boolean}} Setting */

/** @type {readonly Setting[]} */
export const SETTINGS = Object.freeze([
  { key: 'haptics', label: 'Haptics', group: 'GAMEPLAY', def: true },
  { key: 'sound', label: 'Sound Effects', group: 'GAMEPLAY', def: true },
  { key: 'hints', label: 'Tutorial Hints', group: 'GAMEPLAY', def: true },
  { key: 'motion', label: 'Reduced Motion', group: 'GAMEPLAY', def: false },
  // WIRED HERE, EFFECTED IN TASK 15. Task 15 is droppable (spec Component 8).
  // If it is dropped, DELETE THIS ROW — D8 forbids a switch with no effect.
  { key: 'contrast', label: 'High Contrast', group: 'GAMEPLAY', def: false },
]);

/**
 * @param {string} key untrusted — may come from a stored settings record
 * @returns {Setting|null}
 */
export function settingAt(key) {
  return SETTINGS.find((s) => s.key === key) ?? null;
}
