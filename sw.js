/* sw.js — офлайн-кэш приложения (service worker). */
const CACHE = 'boygame-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/i18n.js',
  './js/ages.js',
  './js/store.js',
  './js/audio.js',
  './js/ui.js',
  './js/adaptive.js',
  './js/achievements.js',
  './js/app.js',
  './js/main.js',
  './js/games/memory.js',
  './js/games/sequence.js',
  './js/games/sorting.js',
  './js/games/math.js',
  './js/games/odd.js',
  './js/games/find.js',
  './js/games/words.js',
  './js/games/runner.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Навигация: сначала сеть, при офлайне — из кэша index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Остальное: сначала кэш, затем сеть (и кладём в кэш).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
