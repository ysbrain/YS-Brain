const CACHE_NAME = 'ys-brain-v1';

const FILES = [
  '/',
];

self.addEventListener(
  'install',
  event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(FILES);
        })
    );
  }
);

self.addEventListener(
  'fetch',
  event => {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
);
