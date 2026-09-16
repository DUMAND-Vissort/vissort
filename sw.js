const CACHE_VERSION = 'vissort-v7';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/user.html',
  '/app.js',
  '/user.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await Promise.allSettled(
      PRECACHE_URLS.map((url) =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch((err) => console.warn('[SW] precache miss:', url, err))
      )
    );
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'cdn.jsdelivr.net'
        && url.pathname.includes('/sivtsev-font/')) {
      event.respondWith(staleWhileRevalidate(request, CACHE_RUNTIME));
    }
    return;
  }
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstHTML(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
});

async function networkFirstHTML(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const root = await cache.match('/');
    if (root) return root;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type !== 'opaque') {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  return cached || networkPromise;
}