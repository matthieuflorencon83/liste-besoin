// db.js - Gestionnaire IndexedDB pour le catalogue
const DB_NAME = 'ArtsAluDB';
const DB_VERSION = 1;
const STORE_CATALOG = 'catalogStore';

let dbInstance = null;

export async function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Store pour les données catalogue ("arcelor" -> array of items)
            if (!db.objectStoreNames.contains(STORE_CATALOG)) {
                db.createObjectStore(STORE_CATALOG);
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('Erreur IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Récupérer un élément depuis le Store Catalog (par ex. pour une clé file_name ou "catalog_index")
export async function getFromDB(key) {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_CATALOG, 'readonly');
        const store = tx.objectStore(STORE_CATALOG);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Sauvegarder un élément dans le Store Catalog
export async function saveToDB(key, data) {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Vider l'intégralité du Store Catalog (pour forcer une maj cache globale)
export async function clearCatalogDB() {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
