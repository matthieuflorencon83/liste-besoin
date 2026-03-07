window.INCREMENT = 52;
window.groupedData = [];
AppState.filteredData = [];
window.displayCount = window.INCREMENT;
AppState.favorites = [];
AppState.needs = [];
AppState.isRalSelectionMode = false;
AppState.selectedNeeds = new Set();
try { AppState.favorites = JSON.parse(localStorage.getItem('art-favs') || '[]'); if (!Array.isArray(AppState.favorites)) AppState.favorites = []; } catch (e) { AppState.favorites = []; }
try { AppState.needs = JSON.parse(localStorage.getItem('art-needs') || '[]'); if (!Array.isArray(AppState.needs)) AppState.needs = []; } catch (e) { AppState.needs = []; }
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
        if (item.fournisseur) {
            item.fournisseur = item.fournisseur.toString().trim().toUpperCase();
        }
        if (item.fabricant) {
            item.fabricant = item.fabricant.toString().trim().toUpperCase();
        }

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
                AppState.needs = data.needs;
                localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
            }

            if (data.favorites && Array.isArray(data.favorites)) {
                AppState.favorites = data.favorites;
                localStorage.setItem('art-favs', JSON.stringify(AppState.favorites));
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

        // init est mtn appelé par main.js dès que le 1er chunk (Arcelor) est dispo.
        if (!AppState.catalogData) AppState.catalogData = [];
        window.groupedData = processData(AppState.catalogData);

        // Initial filter options setup
        updateFilterOptions();
        applyFilters();

        window.initScrollObserver();
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

// SPRINT 10 - Ajout progressif des données JSON
window.appendCatalogData = function (newItems, isLastBatch = false) {
    if (!AppState.catalogData) AppState.catalogData = [];

    // Check what is currently visible
    const getVisibleIds = () => AppState.filteredData.slice(0, window.displayCount).map(it => `${it.reference}_${it.fournisseur || ''}`);
    const currentVisibles = AppState.filteredData ? getVisibleIds() : [];

    AppState.catalogData = AppState.catalogData.concat(newItems);
    window.groupedData = processData(AppState.catalogData);

    // Mettre à jour silencieusement les options des filtres
    updateFilterOptions();

    const q = window.searchInput.value.toLowerCase().trim();
    const four = window.fFour.value, type = window.fType.value, serie = window.fSerie.value;

    AppState.filteredData = window.groupedData.filter(item => {
        const id = `${item.reference}_${item.fournisseur || item.fabricant || ''}`.toLowerCase();
        if (window.showOnlyFavs && !AppState.favorites.includes(id)) return false;
        const matchSearch = !q || String(item.reference).toLowerCase().includes(q) || String(item.designation).toLowerCase().includes(q);
        return matchSearch && (!four || item.fournisseur === four) && (!type || item.type === type) && (!serie || item.serie === serie);
    });

    document.getElementById('matchCount').textContent = AppState.filteredData.length;

    const newVisibles = getVisibleIds();

    let changed = currentVisibles.length !== newVisibles.length;
    if (!changed) {
        for (let i = 0; i < currentVisibles.length; i++) {
            if (currentVisibles[i] !== newVisibles[i]) { changed = true; break; }
        }
    }

    if (changed) {
        render(); // Ne refait le rendu que si les élèments visibles ont changé
    }

    document.getElementById('loadMoreContainer').classList.toggle('hidden', window.displayCount >= AppState.filteredData.length);

    if (isLastBatch) {
        console.log("Catalogue complet chargé : " + AppState.catalogData.length + " articles");
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

    AppState.filteredData = window.groupedData.filter(item => {
        const id = `${item.reference}_${item.fournisseur || item.fabricant || ''}`.toLowerCase();
        if (window.showOnlyFavs && !AppState.favorites.includes(id)) return false;
        const matchSearch = !q || String(item.reference).toLowerCase().includes(q) || String(item.designation).toLowerCase().includes(q);
        return matchSearch && (!four || item.fournisseur === four) && (!type || item.type === type) && (!serie || item.serie === serie);
    });


    document.getElementById('matchCount').textContent = AppState.filteredData.length;
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

function render(append = false) {
    if (!append) {
        window.grid.innerHTML = '';
        window._renderedCount = 0;
    }
    const startIndex = window._renderedCount || 0;
    const items = AppState.filteredData.slice(startIndex, window.displayCount);

    if (!append && !items.length) { document.getElementById('emptyState').classList.remove('hidden'); return; }
    if (!append) document.getElementById('emptyState').classList.add('hidden');

    const fragment = document.createDocumentFragment();

    items.forEach((it, loopIdx) => {
        const idx = startIndex + loopIdx; // L'index VRAI dans filteredData
        const id = `${it.reference}_${it.fournisseur || it.fabricant || ''}`.toLowerCase();
        const isFav = AppState.favorites.includes(id), isNeed = AppState.needs.some(n => n.id === id);

        const conditVal = Number(it.condit || it.conditionnement || 1);
        const unitVente = String(it.unit_vente || '').toUpperCase();
        const multiplier = (unitVente === 'M' || unitVente === 'PC' || unitVente === 'ML') ? conditVal : 1;

        const pxP = (Number(it.px_public || 0) * multiplier).toFixed(2);
        const pxR = (Number(it.px_remise || 0) * multiplier).toFixed(2);

        const safeJsId = id.replace(/'/g, "\\'");

        const card = document.createElement('div');
        card.className = `item-card animate-fade ${window.currentView === 'list' ? 'flex-row items-center' : ''} cursor-pointer`;
        card.style.animationDelay = `${(loopIdx % 40) * 15}ms`;
        card.onclick = () => window.handleCatalogItemClick(it);

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
            <div class="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">
                <i data-lucide="package" class="w-3 h-3 text-indigo-500"></i>
                <span>LOT DE ${conditVal} ${safeUnit}</span>
            </div>` : '';

        const img = it.image ?
            `<div class="img-container" onclick="openVisualizer('${safeImage}', event)"><img src="${safeImage}" alt="${safeDesAttr}" loading="lazy" decoding="async" onerror="this.style.display='none'"></div>` :
            `<div class="img-container opacity-5"><i data-lucide="image" class="w-6 h-6"></i></div>`;

        if (window.currentView === 'list') {
            // Ultra-compact List View card (64px height)
            card.innerHTML = `
                <div class="flex items-center w-full h-full text-sm">
                    ${img}
                    <div class="flex-1 min-w-0 flex items-center py-1 px-4 gap-4">
                        <div class="w-32 shrink-0 flex flex-col justify-center">
                            <div class="mono text-[10px] font-bold text-indigo-400 truncate">${safeRef}</div>
                            <div class="text-[9px] font-black text-indigo-500/50 uppercase truncate mt-0.5">${safeFour}</div>
                        </div>
                        <h3 class="flex-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis text-[0.8rem]" title="${safeDesAttr}">${safeDes}</h3>
                        <div class="w-20 shrink-0 text-center">
                            <span class="badge uppercase">${safeType}</span>
                        </div>
                        <div class="w-32 shrink-0">
                            ${conditHtml}
                        </div>
                        <div class="w-20 shrink-0 text-right">
                            <div class="flex flex-col"><span class="price-value text-[10px] line-through">${pxP}€</span></div>
                        </div>
                        <div class="w-24 shrink-0 text-right">
                            <div class="flex flex-col"><span class="price-remise text-[1.05rem]">${pxR}€</span></div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 border-l border-[var(--border)] px-3 h-full bg-[var(--card-hover)]">
                        <button class="action-btn fav-btn ${isFav ? 'active' : ''} !rounded-full !w-7 !h-7" onclick="toggleF(event, '${safeJsId}')" title="Favori"><i data-lucide="star" class="w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}"></i></button>
                        <button class="action-btn ${isNeed ? 'active' : ''} !rounded-full !w-7 !h-7" onclick="toggleN(event, '${safeJsId}', ${idx})" title="Ajouter au besoin"><i data-lucide="${isNeed ? 'check-circle' : 'plus-circle'}" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>`;
        } else {
            // Grid views (compact/normal/mini)
            const isMini = window.currentView === 'mini';
            const isCompact = window.currentView === 'compact';

            card.innerHTML = `
                <div class="${isMini ? 'p-2' : 'p-3'} border-b border-[var(--border)] flex justify-between items-start gap-2 shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 ${isMini ? 'mb-0.5' : 'mb-1'} whitespace-nowrap overflow-hidden">
                            <span class="mono ${isMini ? 'text-[9px]' : 'text-xs'} font-black text-indigo-400 shrink-0">${safeRef}</span>
                            ${!isMini ? `<span class="badge uppercase shrink-0">${safeType}</span>` : ''}
                        </div>
                        <h3 class="${isMini ? 'text-[0.7rem]' : 'text-[0.95rem]'} font-bold leading-tight line-clamp-2" title="${safeDesAttr}">${safeDes}</h3>
                        ${!isMini ? `<div class="text-[9px] font-black text-indigo-500/50 uppercase tracking-[0.1em] mt-1.5 truncate">${safeFour}</div>` : ''}
                    </div>
                    <div class="flex flex-col gap-1.5 shrink-0">
                        <button class="action-btn fav-btn ${isFav ? 'active' : ''} !rounded-full ${isMini ? '!w-6 !h-6' : 'w-8 h-8'}" onclick="toggleF(event, '${safeJsId}')" title="Favori"><i data-lucide="star" class="${isMini ? 'w-3 h-3' : 'w-4 h-4'} ${isFav ? 'fill-current' : ''}"></i></button>
                        <button class="action-btn ${isNeed ? 'active' : ''} !rounded-full ${isMini ? '!w-6 !h-6' : 'w-8 h-8'}" onclick="toggleN(event, '${safeJsId}', ${idx})" title="Ajouter au besoin"><i data-lucide="${isNeed ? 'check-circle' : 'plus-circle'}" class="${isMini ? 'w-3 h-3' : 'w-4 h-4'}"></i></button>
                    </div>
                </div>
                ${img}
                <div class="${isMini ? 'p-2' : 'p-3'} mt-auto border-t border-[var(--border)] bg-[var(--card-hover)] flex ${(isCompact || isMini) ? 'flex-col justify-center items-center text-center gap-1' : 'justify-between items-end gap-2'} shrink-0">
                    ${!(isCompact || isMini) ? `
                    <div class="flex-1 min-w-0 flex items-center">
                        ${conditHtml}
                    </div>
                    ` : ''}
                    <div class="${(isCompact || isMini) ? 'flex items-end gap-4 justify-center' : 'text-right shrink-0'}">
                        ${!isMini ? `<div class="flex flex-col"><span class="price-label">Catalogue</span><span class="price-value text-[10px] line-through mb-0.5">${pxP}€</span></div>` : ''}
                        <div class="flex flex-col"><span class="price-label text-emerald-500 font-black">Net HT</span><span class="price-remise ${isMini ? 'text-sm' : 'text-[1.1rem]'} leading-none">${pxR}€</span></div>
                    </div>
                    ${(isCompact || isMini) && multiplier > 1 ? `
                    <div class="flex items-center justify-center gap-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap bg-indigo-500/10 px-2 py-1 rounded-md mt-0.5 w-full">
                        <i data-lucide="package" class="w-3 h-3 text-indigo-500"></i>
                        <span>${conditVal} ${safeUnit}</span>
                    </div>
                    ` : ''}
                </div>`;
        }
        fragment.appendChild(card);
    });

    requestAnimationFrame(() => {
        window.grid.appendChild(fragment);

        window._renderedCount = Math.min(window.displayCount, AppState.filteredData.length);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Gestion dynamique du Sentinel pour qu'il soit bien dans le parent qui défile
        let sentinel = document.getElementById('scrollSentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'scrollSentinel';
            sentinel.className = 'w-full h-40 shrink-0 col-span-full'; // col-span-full prend toute la largeur de la grille

            // Si on recrée l'élément, on doit relancer l'observateur
            if (window._scrollObserver) window._scrollObserver.disconnect();
        }

        // On s'assure qu'il est toujours le dernier élément de la grille
        window.grid.appendChild(sentinel);

        if (window.displayCount >= AppState.filteredData.length) {
            sentinel.style.display = 'none';
        } else {
            sentinel.style.display = 'block';
        }

        // Ré-attachement de l'observateur si besoin
        if (window._scrollObserver) {
            window._scrollObserver.observe(sentinel);
        } else {
            window.initScrollObserver();
        }
    });
}

// Initialisation de l'observateur pour l'Infinite Scrolling
window.initScrollObserver = function () {
    const sentinel = document.getElementById('scrollSentinel');
    if (!sentinel) return;

    if (window._scrollObserver) {
        window._scrollObserver.disconnect();
    }

    window._scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            if (window.displayCount < AppState.filteredData.length) {
                // Requête de la frame suivante pour désengorger le main thread
                requestAnimationFrame(() => {
                    window.displayCount += window.INCREMENT;
                    render(true);
                });
            }
        }
    }, { root: document.getElementById('itemsGrid'), rootMargin: '0px 0px 400px 0px' });

    window._scrollObserver.observe(sentinel);
};

window.toggleF = (e, id) => {
    if (window.isCatalogEditMode) return;
    e.stopPropagation(); const i = AppState.favorites.indexOf(id);
    if (i > -1) AppState.favorites.splice(i, 1); else AppState.favorites.push(id);
    localStorage.setItem('art-favs', JSON.stringify(AppState.favorites));
    updateFavCount(); if (window.showOnlyFavs) applyFilters(); else render();
};

window.toggleN = (e, id, idx) => {
    if (window.isCatalogEditMode) return;
    e.stopPropagation();
    const it = AppState.filteredData[idx];
    const i = AppState.needs.findIndex(n => n.id === id);
    if (i > -1) {
        AppState.needs.splice(i, 1);
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

        AppState.needs.push({
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
            px_remise: it.px_remise || it.px_public || 0, // Store initial discounted price
            image: it.image // Transfer image property to Needs list
        });
    }
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
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
    const c = AppState.favorites.length; window.favCountBadge.textContent = c; window.favCountBadge.classList.toggle('hidden', c === 0);
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

window.updateNeedV = (i, f, v) => { AppState.needs[i][f] = parseInt(v) || 0; localStorage.setItem('art-needs', JSON.stringify(AppState.needs)); window.renderNeeds(); };
window.removeN = (i) => { AppState.needs.splice(i, 1); localStorage.setItem('art-needs', JSON.stringify(AppState.needs)); window.renderNeeds(); };
window.deleteNeed = window.removeN; // Fix for generated HTML calling deleteNeed
window.clearNeeds = () => { if (confirm("Supprimer toute la sélection ?")) { AppState.needs = []; localStorage.setItem('art-needs', "[]"); window.renderNeeds(); } };


window.toggleSupplierSort = () => {
    if (window.supplierSortOrder === 'asc') {
        window.supplierSortOrder = 'desc';
        AppState.needs.sort((a, b) => b.fournisseur.localeCompare(a.fournisseur));
    } else {
        window.supplierSortOrder = 'asc';
        AppState.needs.sort((a, b) => a.fournisseur.localeCompare(b.fournisseur));
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

window.openVisualizer = (s, e) => {
    if (window.isCatalogEditMode) return;
    if (e) e.stopPropagation();
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
if (window.searchInput) window.searchInput.addEventListener('input', debouncedApplyFilters);
if (window.fFour) window.fFour.addEventListener('change', (e) => applyFilters(e.target));
if (window.fType) window.fType.addEventListener('change', (e) => applyFilters(e.target));
if (window.fSerie) window.fSerie.addEventListener('change', (e) => applyFilters(e.target));
const _resetBtn = document.getElementById('resetFilters');
if (_resetBtn) _resetBtn.addEventListener('click', () => { window.fFour.value = ""; window.fType.value = ""; window.fSerie.value = ""; window.searchInput.value = ""; applyFilters(); });
const _favBtn = document.getElementById('toggleFavFilter');
if (_favBtn) _favBtn.addEventListener('click', () => { window.showOnlyFavs = !window.showOnlyFavs; _favBtn.classList.toggle('active', window.showOnlyFavs); applyFilters(); });
const _modeToggle = document.getElementById('modeToggle');
if (_modeToggle) _modeToggle.addEventListener('click', () => { window.isDarkMode = !window.isDarkMode; document.body.classList.toggle('light-mode', !window.isDarkMode); localStorage.setItem('theme', window.isDarkMode ? 'dark' : 'light'); });
const _loadMoreBtn = document.getElementById('loadMoreBtn');
if (_loadMoreBtn) _loadMoreBtn.addEventListener('click', () => { window.displayCount += window.INCREMENT; render(true); });

