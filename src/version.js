// @ts-check
/**
 * Human-visible build identity, shown in Settings → Update so a player or tester
 * can confirm which version they are ACTUALLY running. A cache-first PWA can hand
 * back an old bundle after a plain reload (the service worker updates in the
 * background and applies on a later visit), so "did my reload get the latest?"
 * is otherwise unanswerable. If the version shown here is old, the running bundle
 * is old — use the Reload button on the same card to force a fresh fetch.
 *
 * BUMP ON EVERY DEPLOY, in lockstep with sw.js's `CACHE`:
 *   - `APP_VERSION` must equal sw.js `CACHE`'s suffix (i.e. `chickup-<APP_VERSION>`).
 *   - `BUILD_DATE` is the deploy date, `YYYY-MM-DD`.
 */

/** Matches sw.js `CACHE = 'chickup-<APP_VERSION>'`. */
export const APP_VERSION = 'v16';

/** Deploy date, YYYY-MM-DD. */
export const BUILD_DATE = '2026-07-18';
