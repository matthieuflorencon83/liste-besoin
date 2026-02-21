import './state.js?v=129';
import './calpinage.js?v=129';
import './ui.js?v=129';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data.json');
        window.ART_DATA = await response.json();

        // Expose to window manually for any inline HTML usage
        if (typeof window.init === 'function') window.init();

    } catch (e) {
        console.error("Erreur de chargement data.json:", e);
    }
});
