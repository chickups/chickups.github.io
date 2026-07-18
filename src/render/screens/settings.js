// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { primaryButton, secondaryButton, toggleRow } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { SETTINGS } from '../../core/settings.js';
import { getEquippedOutfit, getSetting, setSetting } from '../../storage.js';
import { setReducedMotion } from '../styles.js';
import { applyContrast } from '../contrast.js';
import { APP_VERSION, BUILD_DATE } from '../../version.js';

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
 * NOTE: this card appears NOWHERE in the design doc. It is kept deliberately as
 * a PWA escape hatch; it is an addition, not a design requirement. Do not go
 * looking for it in §07.
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
 * Everything a toggle does the instant it flips, beyond being stored.
 *
 * `haptics` and `hints` are absent on purpose and that is not an oversight:
 * `haptics.js` asks `getSetting('haptics')` inside `buzz` on every call, and
 * `game.js` reads `getSetting('hints')` when a run starts — both read the store
 * directly, so storing the value IS the effect. `contrast` (doc §07, spec
 * Component 8) is the odd one out: its effect is a document-level attribute
 * rather than a value read at use-time, so it is applied here like `motion`.
 *
 * @type {Record<string, (on: boolean) => void>}
 */
const EFFECTS = {
  motion: (on) => setReducedMotion(on),
  contrast: (on) => applyContrast(on),
};

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function settingsScreen(go) {
  const outfit = getEquippedOutfit();

  // Same pattern as shop.js's `outfitRow`: toggleRow renders its ON/OFF text and
  // knob position from the `isOn` it was built with once, and does not update
  // itself on tap. Without rebuilding the whole screen after every flip, the row
  // would keep showing the OLD state — storage and behaviour would be correct,
  // but the switch would look broken, which is its own flavour of dead switch.
  const refresh = () => go('settings');

  const status = el('div', {
    font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted,
    textAlign: 'center', marginTop: px(10), minHeight: px(18),
  }, '');

  const reload = primaryButton('Reload app', 'refresh', () => {
    status.textContent = 'Clearing…';
    reloadApp();
  }, { size: 22, lip: 6 });

  /** @param {string} text */
  const groupHeader = (text) => el('div', {
    font: `800 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.08em',
    margin: `${px(18)} 0 ${px(8)} ${px(6)}`,
  }, text);

  /** Rendered from the table, so dropping a row drops its switch and nothing else. */
  const groups = [...new Set(SETTINGS.map((s) => s.group))].map((group) =>
    el(
      'div',
      {},
      groupHeader(group),
      el(
        'div',
        {
          background: COLORS.cream, borderRadius: px(24),
          padding: `${px(6)} ${px(16)}`, boxShadow: '0 6px 0 rgba(75,53,36,.12)',
        },
        ...SETTINGS.filter((s) => s.group === group).map((s) =>
          toggleRow(s.label, getSetting(s.key), (next) => {
            setSetting(s.key, next);
            const effect = EFFECTS[s.key];
            if (effect) effect(next);
            refresh();
          }),
        ),
      ),
    ),
  );

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

      el('div', { display: 'flex', justifyContent: 'center', margin: `${px(6)} 0 0` },
        peep(72, 'idle', outfit, false)),

      ...groups,

      groupHeader('APP'),
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
        // The running build's identity. If this looks old after a reload, the
        // service worker is still serving a cached bundle — tap Reload above.
        el('div', {
          font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted,
          margin: `${px(14)} 0 0`, textAlign: 'center', letterSpacing: '.02em',
        }, `Chick Up ${APP_VERSION} · built ${BUILD_DATE}`),
      ),

      el('div', { flex: '1', minHeight: px(20) }),
      el('div', { display: 'flex', justifyContent: 'center' },
        secondaryButton('Close', 'close', () => go('home'))),
    ),
  );
}
