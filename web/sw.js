const CACHE_NAME = 'yijing-atlas-v12';
const PRECACHE = [
  './',
  './index.html',
  './styles/main.css',
  './js/main.js',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './js/audio-engine.js',
  './js/data-loader.js',
  './js/evolution-lab.js',
  './js/evolution-state.js',
  './js/hexagram-utils.js',
  './js/relation-animation.js',
  './js/render.js',
  './js/star-map.js',
  './js/star-relations.js',
  './js/storage.js',
  './js/svg-painter.js',
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
