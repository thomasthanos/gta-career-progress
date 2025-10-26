// sw.js - Βελτιωμένο version
const CACHE_NAME = 'career-challenges-v2';
const PRECACHE_URLS = [
  './',
  'index.html',
  'style.css',
  'responsive.css',
  'timer.js',
  'setup-button.js',
  'app.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();  // Προσθήκη αυτής της γραμμής
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),  // Προσθήκη αυτής της γραμμής
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});