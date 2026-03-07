// Service Worker — Arts Alu Zen PWA
// Stratégie : Network First — le réseau est prioritaire, le cache sert de fallback offline
const CACHE_NAME = 'arts-alu-zen-v3';
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

// Installation — pré-cache les fichiers pour le mode offline
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Force le nouveau SW à prendre le contrôle immédiatement
    self.skipWaiting();
});

// Activation — supprime TOUS les anciens caches
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

// Fetch — NETWORK FIRST pour tout : toujours chercher le fichier frais
self.addEventListener('fetch', (event) => {
    // Ignorer les requêtes non-GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Succès réseau : mettre à jour le cache et retourner la réponse fraîche
                const cloned = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                return response;
            })
            .catch(() => {
                // Échec réseau (offline) : fallback sur le cache
                return caches.match(event.request);
            })
    );
});
