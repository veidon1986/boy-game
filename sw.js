/* sw.js — офлайн-кэш приложения (service worker). */
const CACHE = 'boygame-v70';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/i18n.js',
  './js/ages.js',
  './js/store.js',
  './js/analytics-config.js',
  './js/analytics.js',
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
  './js/games/puzzle.js',
  './js/games/shadow.js',
  './js/games/story.js',
  './js/games/maze.js',
  './js/games/symmetry.js',
  './js/games/robot.js',
  './js/games/wordbuild.js',
  './js/games/brain.js',
  './js/games/words.js',
  './js/games/runner.js',
  './js/games/blocks.js',
  './js/games/checkers.js',
  './js/games/chess.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
      fetch(new Request(req, { cache: 'reload' })).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // При сети обновляем файлы сразу, чтобы не задерживать новые версии приложения.
  // Если сети нет, продолжаем отдавать сохранённый офлайн-кэш.
  event.respondWith(
    fetch(new Request(req, { cache: 'reload' })).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        return caches.open(CACHE).then((cache) =>
          cache.put(req, res.clone()).then(() => res)
        );
      }
      return res;
    }).catch(() => {
      return caches.match(req).then((cached) => {
        return cached;
      });
    })
  );
});
