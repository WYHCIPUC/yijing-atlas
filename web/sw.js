const CACHE_NAME = 'yijing-atlas-v28';
const PRECACHE = [
  './',
  './index.html',
  './styles/main.css?v=28',
  './js/main.js?v=28',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/academy-astrolabe-bg.webp',
  './assets/taiji-mechanism.webp',
  './js/audio-engine.js',
  './js/data-loader.js',
  './js/evolution-lab.js',
  './js/evolution-semantics.js',
  './js/evolution-state.js',
  './js/guaxu-wheel.js',
  './js/hexagram-utils.js',
  './js/learning-assessment.js',
  './js/learning-assessment-page.js',
  './js/learning-curriculum.js',
  './js/learning-progress.js',
  './js/learning-review.js',
  './js/motion-system.js',
  './js/relation-animation.js',
  './js/render.js',
  './js/share-card.js',
  './js/star-map.js',
  './js/star-relations.js',
  './js/storage.js',
  './js/svg-painter.js',
  './js/modes/guaxu-mode.js',
  './lib/d3-force.js',
  './data/hexagrams.json',
  './data/trigrams.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
    );
    return;
  }

  // HTML 与入口模块必须同代更新，避免新版结构加载到旧版 JS/CSS。
  if (['script', 'style', 'worker'].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const refreshed = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    if (!cached) return refreshed;
    event.waitUntil(refreshed.catch(() => {}));
    return cached;
  }));
});
