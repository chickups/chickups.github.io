// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { primaryButton, secondaryButton, card } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getEquippedOutfit } from '../../storage.js';

/** Cache name prefix owned by this app; see sw.js. */
const CACHE_PREFIX = 'chickup-';

/**
 * Throw away every cached asset and re-fetch the app from the network.
 *
 * The service worker is cache-first, which is exactly what makes the game work
 * offline — and exactly what makes a new version invisible until the worker
 * happens to update itself. That is correct for players and miserable for
 * testing, so this is the escape hatch: drop the workers, drop the caches, and
 * come back from the network.
 *
 * Only caches this app owns are deleted — the origin may host other things.
 *
 * @returns {Promise<void>}
 */
async function reloadApp() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
    }
  } catch {
    // Storage can be unavailable (private browsing, embedded webviews). Reloading
    // is still worth a try, and is the whole point of the button.
  }
  // A bare reload can be served straight back out of the HTTP cache, which would
  // defeat the whole button. A URL the cache has never seen forces a real trip to
  // the network. The `?fresh=` sticks around in the address bar until the next
  // navigation; installed to the home screen it never shows, because the manifest
  // launches `start_url` instead.
  location.replace(`${location.pathname}?fresh=${Date.now()}`);
}

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function settingsScreen(go) {
  const outfit = getEquippedOutfit();

  const status = el('div', {
    font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted,
    textAlign: 'center', marginTop: px(10), minHeight: px(18),
  }, '');

  const reload = primaryButton('Reload app', 'refresh', () => {
    status.textContent = 'Clearing…';
    reloadApp();
  }, { size: 22, lip: 6 });

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`,
      animation: 'pFade .3s', overflowY: 'auto',
    },
    el(
      'div',
      { position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column', padding: `${px(58)} ${px(24)} ${px(24)}` },
      el('div', {
        font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center',
      }, 'Settings'),

      el('div', { display: 'flex', justifyContent: 'center', margin: `${px(6)} 0 ${px(14)}` },
        peep(96, 'idle', outfit, false)),

      el(
        'div',
        {
          background: COLORS.cream, borderRadius: px(24),
          padding: `${px(20)} ${px(18)}`, boxShadow: '0 6px 0 rgba(75,53,36,.12)',
        },
        el('div', { font: `800 ${px(18)} 'Baloo 2'`, color: COLORS.ink }, 'Update'),
        el('div', {
          font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted,
          margin: `${px(4)} 0 ${px(16)}`, lineHeight: '1.4',
        }, 'Chick Up keeps itself on your phone so it works with no signal. If you are not seeing the newest version, clear it and fetch again.'),
        reload,
        status,
      ),

      el('div', { flex: '1' }),
      el('div', { display: 'flex', justifyContent: 'center' },
        secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
