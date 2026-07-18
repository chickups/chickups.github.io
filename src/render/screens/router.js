// @ts-check

/** @typedef {(go: (name: string, arg?: any) => void, arg?: any) => HTMLElement} Screen */

/** @type {Record<string, Screen>} */
let screens = {};
/** @type {HTMLElement|null} */
let host = null;
/** @type {HTMLElement|null} */
let current = null;
/** Fired after every mount with (name, arg). One listener; see `onNavigate`. */
/** @type {((name: string, arg?: any) => void)|null} */
let navListener = null;

/**
 * @param {HTMLElement} hostEl
 * @param {Record<string, Screen>} map
 */
export function registerScreens(hostEl, map) {
  host = hostEl;
  screens = map;
}

/**
 * Register the one navigation listener, fired after each screen mounts. Kept
 * out of the screens themselves so cross-cutting concerns (music) live in one
 * place and `router.js` stays a generic mounter. Render-only — never core.
 * @param {(name: string, arg?: any) => void} fn
 */
export function onNavigate(fn) {
  navListener = fn;
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
  if (navListener) {
    try {
      navListener(name, arg);
    } catch {
      // a listener fault (e.g. audio) must never abort a navigation
    }
  }
}
