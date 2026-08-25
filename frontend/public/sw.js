// frontend/public/sw.js
//
// Service Worker for GarinKood PWA & Offline Support.
// Caches essential static assets and agricultural reference data (dose tables, locations)
// so farmers in remote areas with poor or no cellular connectivity can still access
// the dosage calculator and offline farm tools.

const CACHE_NAME = 'garinkood-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/site.webmanifest',
  '/images/hero-farm.jpg',
];

const OFFLINE_API_ROUTES = [
  '/api/locations/',
  '/api/agri/inputs/',
  '/api/agri/crops/',
  '/api/categories/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Stale-While-Revalidate for offline agricultural reference data
  if (OFFLINE_API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Network-First with Cache Fallback for navigation and other assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && (event.request.destination === 'image' || event.request.destination === 'font' || event.request.destination === 'style' || event.request.destination === 'script')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('/')))
  );
});
