const CACHE_NAME = 'mp3radio-v1';
const STATIC_ASSETS = [
  '/mp3com-radio/',
  '/mp3com-radio/index.html',
  '/mp3com-radio/app.js',
  '/mp3com-radio/style.css',
  '/mp3com-radio/manifest.json'
];

// Install: cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve shell from cache, stream audio from network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch audio directly from network (Internet Archive)
  if (url.hostname === 'archive.org') {
    event.respondWith(fetch(event.request));
    return;
  }

  // tracks.json: network first, fall back to cache
  if (url.pathname.endsWith('tracks.json')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static shell: cache first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
