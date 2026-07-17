// @ts-check
/* Service worker. Cache-first: the game is fully static, so once installed it
   works offline permanently. Bump CACHE on every deploy to invalidate. */

const CACHE = 'chickup-v10';

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
  './src/sound.js',
  './src/core/tokens.js',
  './src/core/rng.js',
  './src/core/physics.js',
  './src/core/field.js',
  './src/core/biome.js',
  './src/core/zones.js',
  './src/core/run.js',
  './src/core/daily.js',
  './src/core/ghost.js',
  './src/core/shop.js',
  './src/core/achievements.js',
  './src/core/milestone.js',
  './src/core/streak.js',
  './src/core/modifier.js',
  './src/core/settings.js',
  './src/render/el.js',
  './src/render/styles.js',
  './src/render/contrast.js',
  './src/render/ui.js',
  './src/render/hud.js',
  './src/render/toast.js',
  './src/render/art/peep.js',
  './src/render/art/tire.js',
  './src/render/art/gear.js',
  './src/render/art/pad.js',
  './src/render/art/updraft.js',
  './src/render/art/gamebg.js',
  './src/render/art/truck.js',
  './src/render/art/hazardTruck.js',
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
  './src/render/screens/journey.js',
  './src/render/screens/shop.js',
  './src/render/screens/achievements.js',
  './src/render/screens/settings.js',
  './src/render/screens/reward.js',
  './src/render/screens/daily.js',
  './src/render/screens/race.js',
  './src/render/screens/won.js',
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
        .catch(() => {
          // Only a NAVIGATION may fall back to the shell. Handing index.html to a
          // failed script request makes the browser report a MIME-type error
          // ("expected a JavaScript module, got text/html") that says nothing about
          // the real problem, and turns one missing module into a mystery. Let
          // non-navigation misses fail as themselves.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    }),
  );
});
