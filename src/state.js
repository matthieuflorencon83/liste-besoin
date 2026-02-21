window.INCREMENT = 52;
window.groupedData = [];
window.filteredData = [];
window.displayCount = window.INCREMENT;
window.favorites = [];
window.needs = [];
window.isRalSelectionMode = false;
window.selectedNeeds = new Set();
try { window.favorites = JSON.parse(localStorage.getItem('art-favs') || '[]'); if (!Array.isArray(window.favorites)) window.favorites = []; } catch (e) { window.favorites = []; }
try { window.needs = JSON.parse(localStorage.getItem('art-window.needs') || '[]'); if (!Array.isArray(window.needs)) window.needs = []; } catch (e) { window.needs = []; }
window.isDarkMode = localStorage.getItem('theme') !== 'light';
window.showOnlyFavs = false;
window.currentView = 'compact';
window.supplierSortOrder = 'none'; // 'asc', 'desc', 'none'

window.grid = document.getElementById('itemsGrid');
window.searchInput = document.getElementById('globalSearch');
window.loadingOverlay = document.getElementById('window.loadingOverlay');
window.favCountBadge = document.getElementById('window.favCountBadge');
window.fFour = document.getElementById('filterFournisseur');
window.fType = document.getElementById('filterType');
window.fSerie = document.getElementById('filterSerie');



if (!window.isDarkMode) document.body.classList.add('light-mode');

function startApp() {
    toggleFS();
    document.getElementById('startOverlay').style.transform = 'translateY(-100%)';
    setTimeout(() => document.getElementById('startOverlay').classList.add('hidden'), 1000);
}

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

window.loadProject = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.window.needs && Array.isArray(data.window.needs)) {
                window.needs = data.window.needs;
                localStorage.setItem('art-window.needs', JSON.stringify(window.needs));
            }

            if (data.window.favorites && Array.isArray(data.window.favorites)) {
                window.favorites = data.window.favorites;
                localStorage.setItem('art-window.favorites', JSON.stringify(window.favorites));
            }

            if (data.chantier) {
                localStorage.setItem('art-chantier', data.chantier);
                const chantierInput = document.getElementById('chantierRef');
                if (chantierInput) chantierInput.value = data.chantier;
            }

            // Refresh view
            renderNeeds();
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

async function init() {
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
        window.loadingOverlay.style.opacity = '0';
        setTimeout(() => window.loadingOverlay.classList.add('hidden'), 700);
    } catch (err) {
        window.loadingOverlay.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em]">${err.message}</p>`;
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

function changeViewMode(mode) {
    const views = ['window.grid', 'compact', 'mini', 'list'];
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

        const safeImage = escapeHtml(it.image);
        const safeRef = escapeHtml(it.reference);
        const safeType = escapeHtml(it.type || 'Plein');
        const safeFour = escapeHtml(it.fournisseur || '-');
        const safeDes = escapeHtml(formatName(it.designation));
        const safeUnit = escapeHtml(it.unit_condit || 'U');

        const conditHtml = multiplier > 1 ? `
            <div class="flex items-center gap-2 text-[8px] font-black text-indigo-500 underline underline-offset-4 decoration-indigo-500/20 mt-2 uppercase tracking-widest">
                <i data-lucide="package" class="w-3 h-3 text-indigo-500"></i>
                <span>LOT DE ${conditVal} ${safeUnit}</span>
            </div>` : '';

        const img = it.image ?
            `<div class="img-container" onclick="openVisualizer('${safeImage}')"><img src="${safeImage}" alt="${safeDes}" onerror="this.style.display='none'"></div>` :
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

        window.needs.push({
            id,
            reference: it.reference,
            designation: it.designation,
            fournisseur: it.fournisseur || it.fabricant || 'Catalogue',
            ral: '-', // Was: it.decor || '-' => User requested to not default to 9010/Decor
            longueur: it.condit || 1,
            unit_condit: it.unit_condit || 'M',
            type: it.type || (isProfil ? 'Profilé' : 'Accessoire'),
            need: 0,
            stock: 0,
            px_public: it.px_public || 0 // Store initial public price
        });
    }
    localStorage.setItem('art-window.needs', JSON.stringify(window.needs));
    render();
};

function updateFavCount() {
    const c = window.favorites.length; window.favCountBadge.textContent = c; window.favCountBadge.classList.toggle('hidden', c === 0);
}

window.switchView = (v) => {
    document.getElementById('catalogueView').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsListView').classList.toggle('hidden', v !== 'window.needs');
    document.getElementById('tabCatalogue').classList.toggle('active', v === 'catalogue');
    document.getElementById('tabNeeds').classList.toggle('active', v === 'window.needs');
    document.getElementById('filterBar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('catalogueToolbar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsToolbar').classList.toggle('hidden', v !== 'window.needs');
    if (v === 'window.needs') renderNeeds();
};

window.renderNeeds = () => {
    const b = document.getElementById('needsTableBody');
    if (window.needs.length === 0) {
        b.innerHTML = '<tr><td colspan="10" class="p-12 text-center opacity-40">Votre liste de besoins est vide. Ajoutez des articles depuis le catalogue.</td></tr>';
        return;
    }
    b.innerHTML = '';
    window.needs.forEach((item, idx) => {
        const toCmd = Math.max(0, item.need - item.stock);
        const row = document.createElement('tr');
        row.className = 'table-row';
        // Checkbox logic
        let checkboxCell = '';
        if (window.isRalSelectionMode) {
            const isSelected = window.selectedNeeds.has(item.id);
            checkboxCell = `
                <td class="table-cell w-12 p-2 text-center border-r border-zinc-800/50">
                    <div class="flex items-center justify-center h-full">
                        <input type="checkbox" 
                               onchange="toggleNeedSelection('${item.id}', this.checked)"
                               ${isSelected ? 'checked' : ''}
                               class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600">
                    </div>
                </td>
            `;
        }

        row.innerHTML = `
            ${checkboxCell}
            <td class="table-cell text-zinc-400 font-bold text-xs uppercase tracking-wider">${item.fournisseur}</td>
            <td class="table-cell font-mono text-indigo-400 font-bold">${item.reference}</td>
            <td class="table-cell font-medium">${item.designation}</td>
            <td class="table-cell">
                <div class="flex flex-col">
                    <span class="px-2 py-1 bg-zinc-800 rounded text-xs font-mono mb-1">${item.ral || '-'}</span>
                    <span class="text-[10px] text-zinc-500 uppercase">${item.ral_finish || ''}</span>
                </div>
            </td>
            <td class="table-cell text-right font-mono text-xs">${(item.px_public || 0).toFixed(2)}€</td>
            <td class="table-cell text-zinc-500 text-sm">${item.longueur || 1} ${item.unit_condit || 'M'}</td>
            <td class="table-cell text-center">
                <input type="number" class="table-input" value="${item.need}" 
                       onchange="updateNeedV(${idx}, 'need', this.value)">
            </td>
            <td class="table-cell text-center">
                <input type="number" class="table-input" value="${item.stock}" 
                       onchange="updateNeedV(${idx}, 'stock', this.value)">
            </td>
            <td class="table-cell text-center font-bold text-lg ${toCmd > 0 ? 'text-orange-500' : 'text-zinc-700'}">
                ${toCmd}
            </td>
            <td class="table-cell text-center relative">
                <button onclick="removeN(${idx})" class="text-zinc-600 hover:text-red-500 transition-colors z-10 relative">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;

        const isProfil = getIsProfil(item);
        const isExpanded = (window.isCalpinageMode && isProfil) || (window.activeCalpinageId === item.id);

        // Add click event for accordion if is detailed view
        if (isProfil) {
            row.style.cursor = 'pointer';
            row.onclick = (e) => {
                if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                toggleCalpinageRow(item.id);
            };
            row.classList.add('hover:bg-indigo-900/10');
            if (isExpanded) {
                row.classList.add('bg-indigo-900/20');
            }
        }

        b.appendChild(row);

        if (isExpanded) {
            const detailRow = document.createElement('tr');
            detailRow.innerHTML = `
                <td colspan="${window.isRalSelectionMode ? 10 : 9}" class="p-0 border-b border-indigo-900/50 relative">
                    <div class="absolute inset-y-0 left-0 w-1 bg-indigo-500"></div>
                    <div id="calpContainer_${idx}" class="p-4 bg-black/40 min-h-[200px]">
                        <!-- Calpinage UI injected here -->
                        <div class="flex items-center justify-center h-full text-indigo-400 gap-2">
                            <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Chargement du module...
                        </div>
                    </div>
                </td>
            `;
            b.appendChild(detailRow);
        }
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Re-init ALL active calpinage rows
    window.needs.forEach((item, idx) => {
        const isExpanded = (window.isCalpinageMode && getIsProfil(item)) || (window.activeCalpinageId === item.id);
        if (isExpanded) {
            setTimeout(() => CalpinageSystem.initRow(idx), 50);
        }
    });
};

window.updateNeedV = (i, f, v) => { window.needs[i][f] = parseInt(v) || 0; localStorage.setItem('art-window.needs', JSON.stringify(window.needs)); renderNeeds(); };
window.removeN = (i) => { window.needs.splice(i, 1); localStorage.setItem('art-window.needs', JSON.stringify(window.needs)); renderNeeds(); };
window.deleteNeed = window.removeN; // Fix for generated HTML calling deleteNeed
window.clearNeeds = () => { if (confirm("Supprimer toute la sélection ?")) { window.needs = []; localStorage.setItem('art-window.needs', "[]"); renderNeeds(); } };


window.toggleSupplierSort = () => {
    if (window.supplierSortOrder === 'asc') {
        window.supplierSortOrder = 'desc';
        window.needs.sort((a, b) => b.fournisseur.localeCompare(a.fournisseur));
    } else {
        window.supplierSortOrder = 'asc';
        window.needs.sort((a, b) => a.fournisseur.localeCompare(b.fournisseur));
    }
    renderNeeds();

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

window.searchInput.addEventListener('input', applyFilters);
window.fFour.addEventListener('change', (e) => applyFilters(e.target));
window.fType.addEventListener('change', (e) => applyFilters(e.target));
window.fSerie.addEventListener('change', (e) => applyFilters(e.target));
document.getElementById('resetFilters').addEventListener('click', () => { window.fFour.value = ""; window.fType.value = ""; window.fSerie.value = ""; window.searchInput.value = ""; applyFilters(); });
document.getElementById('toggleFavFilter').addEventListener('click', () => { window.showOnlyFavs = !window.showOnlyFavs; document.getElementById('toggleFavFilter').classList.toggle('active', window.showOnlyFavs); applyFilters(); });
document.getElementById('modeToggle').addEventListener('click', () => { window.isDarkMode = !window.isDarkMode; document.body.classList.toggle('light-mode', !window.isDarkMode); localStorage.setItem('theme', window.isDarkMode ? 'dark' : 'light'); });
document.getElementById('loadMoreBtn').addEventListener('click', () => { window.displayCount += window.INCREMENT; render(); });

