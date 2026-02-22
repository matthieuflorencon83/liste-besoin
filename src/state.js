window.INCREMENT = 52;
window.groupedData = [];
window.filteredData = [];
window.displayCount = window.INCREMENT;
window.favorites = [];
window.needs = [];
window.isRalSelectionMode = false;
window.selectedNeeds = new Set();
try { window.favorites = JSON.parse(localStorage.getItem('art-favs') || '[]'); if (!Array.isArray(window.favorites)) window.favorites = []; } catch (e) { window.favorites = []; }
try { window.needs = JSON.parse(localStorage.getItem('art-needs') || '[]'); if (!Array.isArray(window.needs)) window.needs = []; } catch (e) { window.needs = []; }
window.isDarkMode = localStorage.getItem('theme') !== 'light';
window.showOnlyFavs = false;
window.currentView = 'compact';
window.supplierSortOrder = 'none'; // 'asc', 'desc', 'none'

window.grid = document.getElementById('itemsGrid');
window.searchInput = document.getElementById('globalSearch');
window.loadingOverlay = document.getElementById('loadingOverlay');
window.favCountBadge = document.getElementById('favCountBadge');
window.fFour = document.getElementById('filterFournisseur');
window.fType = document.getElementById('filterType');
window.fSerie = document.getElementById('filterSerie');



if (!window.isDarkMode) document.body.classList.add('light-mode');

window.startApp = () => {
    window.toggleFS();
    document.getElementById('startOverlay').style.transform = 'translateY(-100%)';
    setTimeout(() => document.getElementById('startOverlay').classList.add('hidden'), 1000);
}

// SPRINT 6 — Skip écran de démarrage si chantier ou besoins déjà présents
try {
    const hasNeeds = JSON.parse(localStorage.getItem('art-needs') || '[]').length > 0;
    const hasChantier = !!localStorage.getItem('art-chantier');
    if (hasNeeds || hasChantier) {
        // Auto-skip après un court délai (laisser le temps que le DOM charge)
        setTimeout(() => {
            const overlay = document.getElementById('startOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                overlay.style.transition = 'opacity 0.4s ease';
                overlay.style.opacity = '0';
                setTimeout(() => overlay.classList.add('hidden'), 450);
            }
        }, 600);
    }
} catch (e) { /* ignore */ }

window.toggleFS = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
};

function processData(data) {
    const map = new Map();
    data.forEach(item => {
        const key = `${item.reference}_${item.fournisseur || item.fabricant || ''}_${item.designation}`.toLowerCase();
        if (!map.has(key)) map.set(key, item);
        else {
            const decor = String(item.decor || '').toUpperCase();
            if (decor === '9010') map.set(key, item);
            else if ((decor.includes('BRUT') || decor === 'BT') && String(map.get(key).decor || '').toUpperCase() !== '9010') map.set(key, item);
        }
    });
    return Array.from(map.values());
}

function formatName(name) {
    if (!name) return "";
    return name
        .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
        .replace(/\+/g, ' + ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================================
// SPRINT 6 — SURLIGNAGE DES TERMES DE RECHERCHE
// ============================================================
function highlight(text, query) {
    if (!query || query.length < 2) return escapeHtml(text);
    const safe = escapeHtml(text);
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${safeQ})`, 'gi'),
        '<mark style="background:rgba(99,102,241,0.35);color:white;border-radius:3px;padding:0 2px;">$1</mark>');
}

window.loadProject = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.needs && Array.isArray(data.needs)) {
                window.needs = data.needs;
                localStorage.setItem('art-needs', JSON.stringify(window.needs));
            }

            if (data.favorites && Array.isArray(data.favorites)) {
                window.favorites = data.favorites;
                localStorage.setItem('art-favs', JSON.stringify(window.favorites));
            }

            if (data.chantier) {
                localStorage.setItem('art-chantier', data.chantier);
                const chantierInput = document.getElementById('chantierRef');
                if (chantierInput) chantierInput.value = data.chantier;
            }

            // Refresh view
            window.renderNeeds();
            updateFavCount();
            alert("Projet chargé avec succès !");
        } catch (err) {
            alert("Erreur lors de la lecture du fichier projet : " + err.message);
        }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    input.value = '';
};

window.init = async function () {
    try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
        let retries = 0;
        while (!window.ART_DATA && retries < 40) { await new Promise(r => setTimeout(r, 200)); retries++; }
        if (!window.ART_DATA) throw new Error("Base de données indisponible.");

        window.groupedData = processData(window.ART_DATA);

        // Initial filter options setup
        updateFilterOptions();
        applyFilters();

        updateFavCount();
        const lo = document.getElementById('loadingOverlay');
        if (lo) {
            lo.style.opacity = '0';
            setTimeout(() => lo.classList.add('hidden'), 700);
        }
    } catch (err) {
        console.error("Critical error in init:", err);
        const lo = document.getElementById('loadingOverlay');
        if (lo) lo.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em]">${err.message}</p>`;
    }
}

function updateFilterOptions() {
    const currentFour = window.fFour.value;
    const currentType = window.fType.value;
    const currentSerie = window.fSerie.value;

    const availableFours = new Set();
    const availableTypes = new Set();
    const availableSeries = new Set();

    window.groupedData.forEach(d => {
        const matchFour = !currentFour || d.fournisseur === currentFour;
        const matchType = !currentType || d.type === currentType;
        const matchSerie = !currentSerie || d.serie === currentSerie;

        if (matchType && matchSerie) if (d.fournisseur) availableFours.add(d.fournisseur);
        if (matchFour && matchSerie) if (d.type) availableTypes.add(d.type);
        if (matchFour && matchType) if (d.serie) availableSeries.add(d.serie);
    });

    fillSelect(window.fFour, Array.from(availableFours).sort(), "TOUS LES FOURNISSEURS", currentFour);
    fillSelect(window.fType, Array.from(availableTypes).sort(), "TYPE D'ARTICLE", currentType);
    fillSelect(window.fSerie, Array.from(availableSeries).sort(), "SÉRIE / GAMME", currentSerie);
}

function fillSelect(sel, vals, lab, currentVal) {
    sel.innerHTML = `<option value="">${lab}</option>`;
    vals.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (v === currentVal) o.selected = true;
        sel.appendChild(o);
    });
}

function applyFilters(sourceElement) {
    if (sourceElement) updateFilterOptions();

    const q = window.searchInput.value.toLowerCase().trim();
    const four = window.fFour.value, type = window.fType.value, serie = window.fSerie.value;

    window.filteredData = window.groupedData.filter(item => {
        const id = `${item.reference}_${item.fournisseur || item.fabricant || ''}`.toLowerCase();
        if (window.showOnlyFavs && !window.favorites.includes(id)) return false;
        const matchSearch = !q || String(item.reference).toLowerCase().includes(q) || String(item.designation).toLowerCase().includes(q);
        return matchSearch && (!four || item.fournisseur === four) && (!type || item.type === type) && (!serie || item.serie === serie);
    });


    document.getElementById('matchCount').textContent = window.filteredData.length;
    window.displayCount = window.INCREMENT;
    render();
}

window.changeViewMode = function (mode) {
    const views = ['grid', 'compact', 'mini', 'list'];
    views.forEach(v => window.grid.classList.remove(`view-${v}`));
    window.grid.classList.add(`view-${mode}`);
    window.currentView = mode;
    render();
}

function render() {
    window.grid.innerHTML = '';
    const items = window.filteredData.slice(0, window.displayCount);
    if (!items.length) { document.getElementById('emptyState').classList.remove('hidden'); return; }
    document.getElementById('emptyState').classList.add('hidden');

    items.forEach((it, idx) => {
        const id = `${it.reference}_${it.fournisseur || it.fabricant || ''}`.toLowerCase();
        const isFav = window.favorites.includes(id), isNeed = window.needs.some(n => n.id === id);

        const conditVal = Number(it.condit || it.conditionnement || 1);
        const unitVente = String(it.unit_vente || '').toUpperCase();
        const multiplier = (unitVente === 'M' || unitVente === 'PC' || unitVente === 'ML') ? conditVal : 1;

        const pxP = (Number(it.px_public || 0) * multiplier).toFixed(2);
        const pxR = (Number(it.px_remise || 0) * multiplier).toFixed(2);

        const card = document.createElement('div');
        card.className = `item-card animate-fade ${window.currentView === 'list' ? 'flex-row items-center' : ''}`;
        card.style.animationDelay = `${(idx % 40) * 15}ms`;

        const q = window.searchInput.value.toLowerCase().trim();
        const safeImage = escapeHtml(it.image);
        const cleanDes = formatName(it.designation);
        const safeDesAttr = escapeHtml(cleanDes);
        const safeDes = highlight(cleanDes, q);
        const safeRef = highlight(it.reference, q);
        const safeUnit = escapeHtml(it.unit_condit || 'U');
        const safeType = escapeHtml(it.type || 'Plein');
        const safeFour = highlight(it.fournisseur || '-', q);

        const conditHtml = multiplier > 1 ? `
            <div class="flex items-center gap-2 text-[8px] font-black text-indigo-500 underline underline-offset-4 decoration-indigo-500/20 mt-2 uppercase tracking-widest">
                <i data-lucide="package" class="w-3 h-3 text-indigo-500"></i>
                <span>LOT DE ${conditVal} ${safeUnit}</span>
            </div>` : '';

        const img = it.image ?
            `<div class="img-container" onclick="openVisualizer('${safeImage}')"><img src="${safeImage}" alt="${safeDesAttr}" onerror="this.style.display='none'"></div>` :
            `<div class="img-container opacity-5"><i data-lucide="image" class="w-6 h-6"></i></div>`;

        if (window.currentView === 'list') {
            card.innerHTML = `
                <div class="flex items-center gap-6 w-full">
                    ${img}
                    <span class="mono shrink-0">${safeRef}</span>
                    ${window.currentView !== 'mini' ? `<span class="badge uppercase shrink-0">${safeType}</span>` : ''}
                    <span class="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.2em] shrink-0 w-32 truncate">${safeFour}</span>
                    <h3 class="truncate flex-1">${safeDes}</h3>
                    ${conditHtml}
                    <div class="price-window.grid">
                        <div class="flex flex-col"><span class="price-label">Catalogue</span><span class="price-value">${pxP}€</span></div>
                        <div class="flex flex-col items-end"><span class="price-label text-emerald-500 font-black">Net HT</span><span class="price-remise">${pxR}€</span></div>
                    </div>
                    <div class="relative flex flex-row gap-3 z-50">
                        <button class="action-btn fav-btn ${isFav ? 'active' : ''}" onclick="toggleF(event, '${id}')"><i data-lucide="star" class="w-4 h-4 ${isFav ? 'fill-current' : ''}"></i></button>
                        <button class="action-btn ${isNeed ? 'active' : ''}" onclick="toggleN(event, '${id}', ${idx})"><i data-lucide="${isNeed ? 'check-circle' : 'plus-circle'}" class="w-4 h-4"></i></button>
                    </div>
                </div>`;
        } else {
            card.innerHTML = `
                <div class="absolute top-4 right-4 flex flex-col gap-3 z-50">
                    <button class="action-btn fav-btn ${isFav ? 'active' : ''}" onclick="toggleF(event, '${id}')"><i data-lucide="star" class="w-4 h-4 ${isFav ? 'fill-current' : ''}"></i></button>
                    <button class="action-btn ${isNeed ? 'active' : ''}" onclick="toggleN(event, '${id}', ${idx})"><i data-lucide="${isNeed ? 'check-circle' : 'plus-circle'}" class="w-4 h-4"></i></button>
                </div>
                ${img}
                <div class="card-content flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="mono">${safeRef}</span>
                        ${window.currentView !== 'mini' ? `<span class="badge uppercase">${safeType}</span>` : ''}
                    </div>
                    <div class="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.2em] mb-2">${safeFour}</div>
                    <h3>${safeDes}</h3>
                    ${conditHtml}
                    <div class="price-window.grid mt-auto">
                        <div class="flex flex-col"><span class="price-label">Catalogue</span><span class="price-value">${pxP}€</span></div>
                        <div class="flex flex-col items-end"><span class="price-label text-emerald-500 font-black">Net HT</span><span class="price-remise">${pxR}€</span></div>
                    </div>
                </div>`;
        }
        window.grid.appendChild(card);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('loadMoreContainer').classList.toggle('hidden', window.displayCount >= window.filteredData.length);
}

window.toggleF = (e, id) => {
    e.stopPropagation(); const i = window.favorites.indexOf(id);
    if (i > -1) window.favorites.splice(i, 1); else window.favorites.push(id);
    localStorage.setItem('art-favs', JSON.stringify(window.favorites));
    updateFavCount(); if (window.showOnlyFavs) applyFilters(); else render();
};

window.toggleN = (e, id, idx) => {
    e.stopPropagation();
    const it = window.filteredData[idx];
    const i = window.needs.findIndex(n => n.id === id);
    if (i > -1) {
        window.needs.splice(i, 1);
    } else {
        const des = (it.designation || '').toUpperCase();
        const type = (it.type || '').toUpperCase();
        const fam = (it.famille || '').toUpperCase();
        const isProfil = type.includes('PROFIL') || fam.includes('PROFIL') ||
            des.includes('PROFIL') || des.includes('CHEVRON') ||
            des.includes('SABLIERE') || des.includes('PARCLOSE') ||
            des.includes('RAIL') || des.includes('BARRE') ||
            des.includes('TUBE') || des.includes('COULISSE') ||
            des.includes('TRAVERSE') || des.includes('MONTANT');

        let ral = '-';
        let pureDesignation = it.designation || '';

        // Extraction automatique (spécialement pour Akraplast et similaires)
        // 1. Détecter et retirer la longueur (ex: Lg7000, Lg 7000, L=3000)
        const lgRegex = /(?:Lg|L)\s*=?\s*(\d{3,4})/i;
        const lgMatch = pureDesignation.match(lgRegex);
        if (lgMatch) {
            pureDesignation = pureDesignation.replace(lgMatch[0], '').trim();
        }

        // 2. Détecter et retirer la finition RAL (ex: 9010, 7016, 7016EM)
        const ralRegex = /\b(1013|1015|2100|3004|7012|7015|7016[A-Z]*|7021|7022|7035|7039|8014|8019|9005|9006|9007|9010[A-Z]*|9016[A-Z]*)\b/i;
        const ralMatch = pureDesignation.match(ralRegex);
        if (ralMatch) {
            ral = ralMatch[1].toUpperCase();
            pureDesignation = pureDesignation.replace(ralMatch[0], '').trim();
        }

        // Nettoyage final des doubles espaces éventuels
        pureDesignation = pureDesignation.replace(/\s{2,}/g, ' ').trim();

        window.needs.push({
            id,
            reference: it.reference,
            designation: pureDesignation,
            fournisseur: it.fournisseur || it.fabricant || 'Catalogue',
            ral: ral,
            longueur: it.condit || 1,
            unit_condit: it.unit_condit || 'M',
            type: it.type || (isProfil ? 'Profilé' : 'Accessoire'),
            need: 1,
            stock: 0,
            px_public: it.px_public || 0, // Store initial public price
            px_remise: it.px_remise || it.px_public || 0 // Store initial discounted price
        });
    }
    localStorage.setItem('art-needs', JSON.stringify(window.needs));
    // Toast de confirmation (Sprint 6)
    const label = it ? (it.designation || it.reference || 'Article') : 'Article';
    if (i > -1) {
        window.showToast(`❌ Retiré des besoins`, 'zinc');
    } else {
        window.showToast(`✅ Ajouté aux besoins — ${label.slice(0, 40)}`, 'indigo');
    }
    render();
};

function updateFavCount() {
    const c = window.favorites.length; window.favCountBadge.textContent = c; window.favCountBadge.classList.toggle('hidden', c === 0);
}

// ============================================================
// SPRINT 6 — TOAST DE CONFIRMATION
// ============================================================
window.showToast = function (message, color = 'indigo') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const colors = { indigo: '#4f46e5', zinc: '#52525b', emerald: '#059669', red: '#dc2626', amber: '#d97706' };
    const bg = colors[color] || colors.indigo;
    toast.style.cssText = `background:${bg};color:white;padding:10px 16px;border-radius:12px;font-size:12px;font-weight:700;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,0.4);transform:translateX(120%);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; }); });
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    }, 2500);
};

window.switchView = (v) => {
    document.getElementById('catalogueView').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsListView').classList.toggle('hidden', v !== 'needs');
    document.getElementById('tabCatalogue').classList.toggle('active', v === 'catalogue');
    document.getElementById('tabNeeds').classList.toggle('active', v === 'needs');
    document.getElementById('filterBar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('catalogueToolbar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsToolbar').classList.toggle('hidden', v !== 'needs');
    if (v === 'needs') window.renderNeeds();
};

// renderNeeds supprimé de state.js (la bonne version est dans ui.js)

window.updateNeedV = (i, f, v) => { window.needs[i][f] = parseInt(v) || 0; localStorage.setItem('art-needs', JSON.stringify(window.needs)); window.renderNeeds(); };
window.removeN = (i) => { window.needs.splice(i, 1); localStorage.setItem('art-needs', JSON.stringify(window.needs)); window.renderNeeds(); };
window.deleteNeed = window.removeN; // Fix for generated HTML calling deleteNeed
window.clearNeeds = () => { if (confirm("Supprimer toute la sélection ?")) { window.needs = []; localStorage.setItem('art-needs', "[]"); window.renderNeeds(); } };


window.toggleSupplierSort = () => {
    if (window.supplierSortOrder === 'asc') {
        window.supplierSortOrder = 'desc';
        window.needs.sort((a, b) => b.fournisseur.localeCompare(a.fournisseur));
    } else {
        window.supplierSortOrder = 'asc';
        window.needs.sort((a, b) => a.fournisseur.localeCompare(b.fournisseur));
    }
    window.renderNeeds();

    // Update icon rotation
    const icon = document.getElementById('sortIcon');
    if (icon) {
        icon.classList.remove('opacity-0');
        icon.classList.add('opacity-100');
        icon.style.transform = window.supplierSortOrder === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.openVisualizer = (s) => {
    if (!s) return;
    const m = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    img.src = s; m.classList.remove('hidden');
    setTimeout(() => img.classList.remove('scale-95'), 10);
};
// window.openCalpinage removed - replaced by toggle

window.closeVisualizer = () => {
    const m = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    img.classList.add('scale-95');
    setTimeout(() => m.classList.add('hidden'), 500);
};

// ============================================================
// SPRINT 4 — PERFORMANCE : Debounce
// ============================================================
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const debouncedApplyFilters = debounce(applyFilters, 250);
window.searchInput.addEventListener('input', debouncedApplyFilters);
window.fFour.addEventListener('change', (e) => applyFilters(e.target));
window.fType.addEventListener('change', (e) => applyFilters(e.target));
window.fSerie.addEventListener('change', (e) => applyFilters(e.target));
document.getElementById('resetFilters').addEventListener('click', () => { window.fFour.value = ""; window.fType.value = ""; window.fSerie.value = ""; window.searchInput.value = ""; applyFilters(); });
document.getElementById('toggleFavFilter').addEventListener('click', () => { window.showOnlyFavs = !window.showOnlyFavs; document.getElementById('toggleFavFilter').classList.toggle('active', window.showOnlyFavs); applyFilters(); });
document.getElementById('modeToggle').addEventListener('click', () => { window.isDarkMode = !window.isDarkMode; document.body.classList.toggle('light-mode', !window.isDarkMode); localStorage.setItem('theme', window.isDarkMode ? 'dark' : 'light'); });
document.getElementById('loadMoreBtn').addEventListener('click', () => { window.displayCount += window.INCREMENT; render(); });
