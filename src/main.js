import { initDB, getFromDB, saveToDB, clearCatalogDB } from './db.js?v=157';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        // 1. Fetch de l'index du catalogue
        const indexResponse = await fetch('catalog_index.json?v=' + new Date().getTime(), { signal: controller.signal });
        const catalogIndex = await indexResponse.json();

        // 2. Vérification IndexedDB (version)
        try { await initDB(); } catch (e) { console.warn("IndexedDB non dispo, mode lent."); }

        let storedVersion = await getFromDB('catalog_version').catch(() => null);
        if (storedVersion !== catalogIndex.version) {
            console.log("Nouvelle version du catalogue détectée. Nettoyage du cache IndexedDB...");
            await clearCatalogDB().catch(() => { });
            await saveToDB('catalog_version', catalogIndex.version).catch(() => { });
        }

        // 3. Chargement prioritaire : Arcelor (ou le 1er dispo)
        const arcelorSrc = catalogIndex.sources.find(s => s.fournisseur.toLowerCase().includes('arcelor'));
        const primarySrc = arcelorSrc || catalogIndex.sources[0];

        let primaryData = await getFromDB(primarySrc.file).catch(() => null);
        if (!primaryData) {
            console.log(`[Réseau] Chargement prioritaire de ${primarySrc.file}...`);
            const res = await fetch(primarySrc.file, { signal: controller.signal });
            primaryData = await res.json();
            await saveToDB(primarySrc.file, primaryData).catch(() => { });
        } else {
            console.log(`[Cache] Chargement prioritaire de ${primarySrc.file}`);
        }

        clearTimeout(timeout);

        // On libère l'interface immédiatement avec les données prioritaires
        AppState.catalogData = primaryData;
        if (typeof window.init === 'function') window.init();

        // 4. Chargement paresseux (Lazy Loading) du reste en parallèle !
        const restSources = catalogIndex.sources.filter(s => s.file !== primarySrc.file);

        setTimeout(async () => {
            const promises = restSources.map(async (src) => {
                let data = await getFromDB(src.file).catch(() => null);
                if (!data) {
                    try {
                        const res = await fetch(src.file);
                        data = await res.json();
                        await saveToDB(src.file, data).catch(() => { });
                    } catch (err) {
                        console.error(`Erreur chargement background de ${src.file}`, err);
                        return [];
                    }
                }
                return data || [];
            });

            // On attend que tout soit dispo pour n'update le state qu'UNE seule fois
            const results = await Promise.all(promises);
            let combinedData = [];
            results.forEach(arr => combinedData = combinedData.concat(arr));

            if (combinedData.length > 0 && typeof window.appendCatalogData === 'function') {
                window.appendCatalogData(combinedData, true);
            }
        }, 150); // Léger retard pour ne pas concurrencer le rendu initial de l'UI

    } catch (e) {
        console.error("Erreur de chargement data.json:", e);
        const lo = document.getElementById('loadingOverlay');
        if (lo) lo.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em] text-center px-10">
            ⚠️ Impossible de charger la base de données.<br>
            <span class="text-xs font-normal text-zinc-500 mt-2 block">Vérifiez que le serveur Python est bien lancé via start_app.bat</span>
        </p>`;
    }
});
