/* sw.js — согласованные версии оболочки, ленивых модулей и офлайн-кэша. */
const CACHE = 'boygame-v76';
const BUILD = 'fbf6d51bd9f510f4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './css/styles.css',
  './css/games/learning.css',
  './css/app-ui.css',
  './css/games/arcade.css',
  './css/games/board.css',
  './css/animations.css',
  './css/theme.css',
  './js/release.js',
  './js/i18n.js',
  './js/ages.js',
  './js/task-history.js',
  './js/usage-store.js',
  './js/store.js',
  './js/analytics-config.js',
  './js/analytics.js',
  './js/audio.js',
  './js/ui.js',
  './js/adaptive.js',
  './js/achievements.js',
  './js/game-catalog.js',
  './js/game-session.js',
  './js/game-loader.js',
  './js/play-time.js',
  './js/app.js',
  './js/app/profiles.js',
  './js/app/home.js',
  './js/app/parents.js',
  './js/app/privacy.js',
  './js/app/admin.js',
  './js/app/rewards.js',
  './js/app/dialogs.js',
  './js/app/play-time.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
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
  './js/engines/checkers.js',
  './js/games/checkers.js',
  './js/engines/chess.js',
  './js/games/chess.js'
];
const CACHE_NAME = CACHE + '-' + BUILD;
const SCOPE = self.registration.scope;
const PATHS = new Set(ASSETS.map(asset => new URL(asset, SCOPE).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(ASSETS.map(asset => new Request(new URL(asset, SCOPE).href, { cache: 'reload' })))
  ));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => {
    const old = keys.filter(key => /^boygame-v\d+(?:-|$)/.test(key) && key !== CACHE_NAME);
    // Предыдущая сборка нужна вкладкам, которые ещё завершают переход на новую.
    const previous = old[old.length - 1];
    return Promise.all(old.filter(key => key !== previous).map(key => caches.delete(key)));
  }).then(() => self.clients.claim()));
});

async function resource(request, build) {
  let name = CACHE_NAME;
  if (build && build !== BUILD) {
    const keys = await caches.keys();
    name = keys.find(key => /^boygame-v\d+-/.test(key) && key.endsWith('-' + build));
    if (!name) return new Response('Application update required', { status: 409 });
  }
  const cache = await caches.open(name);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  // Временная утрата браузерного кэша: текущие файлы можно восстановить по сети.
  // Старую сборку подменять текущими файлами нельзя.
  if (build) return new Response('Application update required', { status: 409 });
  return fetch(request);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url, SCOPE);
  if (url.origin !== new URL(SCOPE).origin) return;
  const scopePath = new URL(SCOPE).pathname;
  if (request.mode === 'navigate') {
    if (url.pathname !== scopePath && url.pathname !== scopePath + 'index.html') return;
    // Оболочка и модули берутся из одной активной сборки до принятия обновления.
    event.respondWith(resource(new Request(new URL('./index.html', SCOPE).href), null));
  } else if (PATHS.has(url.pathname)) {
    event.respondWith(resource(request, url.searchParams.get('build')));
  }
  // API и посторонние ресурсы не сохраняются в офлайн-кэш.
});
