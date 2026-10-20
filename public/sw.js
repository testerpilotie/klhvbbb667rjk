// Offline-first service worker: the whole app is a handful of static files.
const CACHE = 'optihol-v2.7.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/model.js',
  './js/store.js',
  './js/drinks.js',
  './js/chart.js',
  './js/format.js',
  './js/score.js',
  './js/share.js',
  './js/feel.js',
  './js/plan.js',
  './js/ui/recipe.js',
  './js/ui/common.js',
  './js/ui/now.js',
  './js/ui/history.js',
  './js/ui/settings.js',
  './js/ui/onboarding.js',
  './js/ui/sheets.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Tapping a reminder focuses the open app (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => (all[0] ? all[0].focus() : self.clients.openWindow('./'))),
  );
});

// Stale-while-revalidate for same-origin GETs.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
