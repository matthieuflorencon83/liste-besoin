import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        proxy: {
            // Proxy les requêtes API vers le serveur Python
            '/add-article': 'http://localhost:8000',
            '/edit-article': 'http://localhost:8000',
            // Proxy les images servies par le serveur Python
            '/images': 'http://localhost:8000'
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    test: {
        environment: 'jsdom',
        globals: true
    }
});
