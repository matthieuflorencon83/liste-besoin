import './state.js?v=139';
import './calpinage.js?v=139';
import './ui.js?v=139';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('data.json', { signal: controller.signal });
        clearTimeout(timeout);

        window.ART_DATA = await response.json();

        if (typeof window.init === 'function') window.init();

    } catch (e) {
        console.error("Erreur de chargement data.json:", e);
        const lo = document.getElementById('loadingOverlay');
        if (lo) lo.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em] text-center px-10">
            ⚠️ Impossible de charger la base de données.<br>
            <span class="text-xs font-normal text-zinc-500 mt-2 block">Vérifiez que le serveur Python est bien lancé via start_app.bat</span>
        </p>`;
    }
});
