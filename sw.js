// Service Worker — Arts Alu Zen PWA
const CACHE_NAME = 'arts-alu-zen-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/src/db.js',
    '/src/store.js',
    '/src/state.js',
    '/src/calpinage.js',
    '/src/export.js',
    '/src/modals.js',
    '/src/ral.js',
    '/src/ui.js',
    '/src/main.js'
];

// Installation — mise en cache des fichiers statiques
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch — stratégie Network First pour les JSON, Cache First pour les assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Les fichiers de données JSON -> Network First
    if (url.pathname.endsWith('.json') && url.pathname.includes('data')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Tout le reste -> Cache First
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                const cloned = fetchResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                return fetchResponse;
            });
        })
    );
});
