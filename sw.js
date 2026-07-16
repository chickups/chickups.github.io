// @ts-check
/* Service worker. Cache-first: the game is fully static, so once installed it
   works offline permanently. Bump CACHE on every deploy to invalidate. */

const CACHE = 'chickup-v2';

/** Everything needed to run with no network at all. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/viewport.js',
  './src/storage.js',
  './src/input.js',
  './src/haptics.js',
  './src/core/tokens.js',
  './src/core/rng.js',
  './src/core/physics.js',
  './src/core/field.js',
  './src/core/run.js',
  './src/render/el.js',
  './src/render/styles.js',
  './src/render/ui.js',
  './src/render/hud.js',
  './src/render/art/peep.js',
  './src/render/art/tire.js',
  './src/render/art/gamebg.js',
  './src/render/art/truck.js',
  './src/render/art/logo.js',
  './src/render/art/icon.js',
  './src/render/screens/router.js',
  './src/render/screens/splash.js',
  './src/render/screens/intro.js',
  './src/render/screens/home.js',
  './src/render/screens/game.js',
  './src/render/screens/pause.js',
  './src/render/screens/oops.js',
  './src/render/screens/best.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './fonts/baloo2-latin.woff2',
  './fonts/nunito-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Cache same-origin successes as they are discovered (e.g. fonts).
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
