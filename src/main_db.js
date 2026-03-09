document.addEventListener('DOMContentLoaded', async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for DB

        console.log("[Réseau] Récupération de tous les articles depuis MySQL...");
        
        // Appeler la nouvelle API
        const res = await fetch('http://localhost:8001/api/articles', { signal: controller.signal });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        clearTimeout(timeout);

        console.log(`[Réseau] Chargement réussi : ${data.length} articles récupérés.`);

        // On assigne les données à l'état global exactement comme attendu par l'application
        AppState.catalogData = data;
        
        if (typeof window.init === 'function') {
            window.init();
        }

    } catch (e) {
        console.error("Erreur de chargement depuis MySQL (/api/articles):", e);
        const lo = document.getElementById('loadingOverlay');
        if (lo) lo.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em] text-center px-10">
            ⚠️ Impossible de charger la base de données MySQL.<br>
            <span class="text-xs font-normal text-zinc-500 mt-2 block">Vérifiez que "server_mysql.py" (port 8001) est bien lancé.</span>
        </p>`;
    }
});
