// @ts-check

/** @typedef {(go: (name: string, arg?: any) => void, arg?: any) => HTMLElement} Screen */

/** @type {Record<string, Screen>} */
let screens = {};
/** @type {HTMLElement|null} */
let host = null;
/** @type {HTMLElement|null} */
let current = null;

/**
 * @param {HTMLElement} hostEl
 * @param {Record<string, Screen>} map
 */
export function registerScreens(hostEl, map) {
  host = hostEl;
  screens = map;
}

/**
 * Mount a screen, disposing whatever was there.
 * @param {string} name
 * @param {any} [arg]
 */
export function go(name, arg) {
  const make = screens[name];
  if (!make) throw new Error(`unknown screen: ${name}`);
  if (current) {
    const dispose = /** @type {any} */ (current).__dispose;
    if (typeof dispose === 'function') dispose();
    current.remove();
  }
  current = make(go, arg);
  /** @type {HTMLElement} */ (host).appendChild(current);
}
