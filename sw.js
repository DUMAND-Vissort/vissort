// ============================================================
// sw.js — Service Worker для Vissort
//   • Precache локальных файлов
//   • Network-first для HTML
//   • Cache-first для JS/CSS/шрифтов
//   • Stale-while-revalidate для Supabase REST (GET)
// ============================================================
'use strict';

const CACHE_VERSION = 'vissort-v10';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;
const CACHE_SUPABASE = `${CACHE_VERSION}-supabase`;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/admin.html',
    '/user.html',
    '/player.html',
    '/app.js',
    '/data-layer.js',
    '/user.js',
    '/player.js',
    '/voice.js',
    '/keepalive.js'
];

// Домены/пути, которые НЕ кэшируем
const NEVER_CACHE_PATTERNS = [
    /\/auth\/v1\//,          // Supabase Auth — всегда сеть
    /\/rest\/v1\/rpc\//,     // RPC-вызовы
    /\/storage\/v1\//        // Storage — файлы
];

// ============================================================
// INSTALL: precache локальных файлов
// ============================================================
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_STATIC);
        await Promise.allSettled(
            PRECACHE_URLS.map(url =>
                cache.add(new Request(url, { cache: 'reload' }))
                    .catch(err => console.warn('[SW] precache miss:', url, err.message))
            )
        );
    })());
});

// ============================================================
// ACTIVATE: чистим старые версии
// ============================================================
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(k => !k.startsWith(CACHE_VERSION))
                .map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

// ============================================================
// MESSAGE: ручное управление
// ============================================================
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SKIP_WAITING') self.skipWaiting();

    if (data.type === 'CLEAR_CACHE') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            console.log('[SW] все кэши очищены');
        })());
    }

    if (data.type === 'CLEAR_SUPABASE_CACHE') {
        event.waitUntil((async () => {
            await caches.delete(CACHE_SUPABASE);
            console.log('[SW] кэш Supabase очищен');
        })());
    }
});

// ============================================================
// FETCH: маршрутизация
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Только GET
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // ---------- 1. Supabase ----------
    if (url.hostname === 'hzvypwdpdhsjzaclxmbm.supabase.co') {
        // Никогда не кэшируем auth, rpc, storage
        if (NEVER_CACHE_PATTERNS.some(p => p.test(url.pathname))) {
            return; // пусть идёт напрямую
        }
        // REST GET — stale-while-revalidate
        if (url.pathname.startsWith('/rest/v1/')) {
            event.respondWith(staleWhileRevalidate(request, CACHE_SUPABASE));
            return;
        }
        return; // остальное — напрямую
    }

    // ---------- 2. jsDelivr (Sivtsev, JSZip, face-api) ----------
    if (url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith(staleWhileRevalidate(request, CACHE_RUNTIME));
        return;
    }

    // ---------- 3. Свой origin ----------
    if (url.origin === self.location.origin) {
        // HTML — network-first
        if (request.mode === 'navigate' ||
            request.destination === 'document' ||
            url.pathname.endsWith('.html')) {
            event.respondWith(networkFirstHTML(request));
            return;
        }
        // Остальное (JS, CSS, шрифты) — cache-first со SWR
        event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
        return;
    }

    // Остальные запросы — пропускаем напрямую
});

// ============================================================
// СТРАТЕГИЯ: network-first для HTML
// ============================================================
async function networkFirstHTML(request) {
    const cache = await caches.open(CACHE_STATIC);
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
            cache.put(request, fresh.clone());
        }
        return fresh;
    } catch (err) {
        console.warn('[SW] offline, отдаём кэш для', request.url);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        const root = await cache.match('/admin.html', { ignoreSearch: true });
        if (root) return root;
        const idx = await cache.match('/index.html', { ignoreSearch: true });
        if (idx) return idx;
        return new Response('Офлайн. Откройте страницу при подключении к сети.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

// ============================================================
// СТРАТЕГИЯ: stale-while-revalidate
// ============================================================
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const networkPromise = fetch(request)
        .then(res => {
            if (res && res.ok && res.type !== 'opaque') {
                cache.put(request, res.clone());
            }
            return res;
        })
        .catch(err => {
            console.warn('[SW] fetch error для', request.url, err.message);
            return cached || new Response('', { status: 503 });
        });

    return cached || networkPromise;
}

// ============================================================
// ФОНОВАЯ ОЧИСТКА: держим кэш Supabase не более 200 записей
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TRIM_SUPABASE_CACHE') {
        event.waitUntil(trimCache(CACHE_SUPABASE, 200));
    }
});

async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(k => cache.delete(k)));
    console.log(`[SW] ${cacheName}: удалено ${toDelete.length} старых записей`);
}

console.log('[SW] загружен, версия', CACHE_VERSION);