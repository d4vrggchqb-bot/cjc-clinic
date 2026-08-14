const CACHE_NAME = 'cjc-clinic-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/cjc-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and API calls from default cache (API handles its own IndexedDB sync)
  if (event.request.method !== 'GET' || url.pathname.includes('/api/')) {
    return;
  }

  // Handle static assets & navigation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stale-while-revalidate for static assets
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If offline and request is HTML navigation, return cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || cachedResponse;
        }
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
