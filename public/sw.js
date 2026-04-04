// Service Worker for iMYNTED PWA
// Version management
const CACHE_VERSION = 'v1';
const CACHE_NAME = `imynted-cache-${CACHE_VERSION}`;

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  '/manifest.json',
  '/brand/logo.svg',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
];

// API cache TTLs (in milliseconds)
const API_CACHE_TTL = {
  '/api/market': 60 * 60 * 1000,      // 1 hour
  '/api/crypto': 60 * 60 * 1000,      // 1 hour
  '/api/scanner': 60 * 60 * 1000,     // 1 hour
  '/api/news': 4 * 60 * 60 * 1000,    // 4 hours
};

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => url)); // Filter empty
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] Pre-cache failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('imynted-cache-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip chrome-extension and other non-app requests
  if (url.origin !== self.location.origin) return;

  // Strategy selection based on request type
  if (url.pathname.startsWith('/api/')) {
    // API requests: Network-first with cache fallback
    event.respondWith(networkFirstWithCache(request, url));
  } else if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/)
  ) {
    // Static assets: Cache-first
    event.respondWith(cacheFirstWithNetwork(request));
  } else if (url.pathname === '/' || !url.pathname.includes('.')) {
    // HTML pages: Network-first for freshness
    event.respondWith(networkFirstWithCache(request, url));
  }
});

// Cache-first strategy with network fallback
async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network fetch failed:', error);
    // Return offline fallback if available
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy with cache fallback
async function networkFirstWithCache(request, url) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);

      // For API responses, store with timestamp for TTL checking
      if (url.pathname.startsWith('/api/')) {
        const responseToCache = networkResponse.clone();
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cached-at', Date.now().toString());

        const body = await responseToCache.blob();
        const cachedResponse = new Response(body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers,
        });

        cache.put(request, cachedResponse);
      } else {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache for:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check TTL for API responses
      const cachedAt = parseInt(cachedResponse.headers.get('sw-cached-at') || '0', 10);
      if (cachedAt > 0) {
        const ttl = getApiTTL(url.pathname);
        const age = Date.now() - cachedAt;

        if (age > ttl) {
          console.log('[SW] Cached response expired:', url.pathname);
          // Still return stale data rather than nothing
        }

        console.log('[SW] Returning cached response (age: ' + Math.round(age/1000) + 's)');
      }

      return cachedResponse;
    }

    // No cache available
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Get TTL for API path
function getApiTTL(pathname) {
  for (const [prefix, ttl] of Object.entries(API_CACHE_TTL)) {
    if (pathname.startsWith(prefix)) {
      return ttl;
    }
  }
  return 60 * 60 * 1000; // Default 1 hour
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
