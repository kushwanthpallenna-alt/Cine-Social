const CACHE_NAME = 'cinesocial-static-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Fail gracefully if any static asset fails to cache on install
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. CRITICAL: Never intercept or cache API routes, especially /api/auth/*
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
    return;
  }

  // 2. CRITICAL: Never intercept or cache external image domains or image requests (TMDB, Unsplash, Google, etc.)
  if (
    url.hostname.includes('image.tmdb.org') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('googleusercontent.com') ||
    request.destination === 'image' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // 3. Only handle GET requests for same-origin static assets
  if (request.method !== 'GET') {
    return;
  }

  // Network-first or cache-fallback for same-origin static assets only
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to keep static cache updated
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache static JS/CSS/_next files
        if (
          url.pathname.startsWith('/_next/static') ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.json')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }

        return networkResponse;
      }).catch((err) => {
        throw err;
      });
    })
  );
});
