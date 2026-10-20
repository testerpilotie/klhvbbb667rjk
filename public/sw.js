// Offline-first service worker: the whole app is a handful of static files.
//
// Versions are atomic. Installing a version downloads every app file fresh from the server
// (bypassing the browser's HTTP cache), and app files are then served only from that
// version's cache. Never mix files from two versions: a new app.js with an old model.js
// breaks the app. Bump CACHE on every release so installed copies pick up the update.
const CACHE = 'optihol-v2.9.2';
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
  './js/invite.js',
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
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
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

// Tapping a reminder focuses the open app (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => (all[0] ? all[0].focus() : self.clients.openWindow('./'))),
  );
});

// App files come from this version's cache; anything else goes to the network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Opening the app (/, /?crew=…, /?log=pint) is the app shell.
      const path = new URL(request.url).pathname;
      const key = request.mode === 'navigate' && (path.endsWith('/') || path.endsWith('/index.html')) ? './' : request;
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (err) {
        return (await cache.match('./')) ?? Response.error();
      }
    }),
  );
});
