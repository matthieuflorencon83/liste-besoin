const INCREMENT = 52;
let groupedData = [], filteredData = [], displayCount = INCREMENT;
let favorites = [];
let needs = [];
let isRalSelectionMode = false;
let selectedNeeds = new Set();
try { favorites = JSON.parse(localStorage.getItem('art-favs') || '[]'); if (!Array.isArray(favorites)) favorites = []; } catch (e) { favorites = []; }
try { needs = JSON.parse(localStorage.getItem('art-needs') || '[]'); if (!Array.isArray(needs)) needs = []; } catch (e) { needs = []; }
let isDarkMode = localStorage.getItem('theme') !== 'light';
let showOnlyFavs = false;
let currentView = 'compact';
let supplierSortOrder = 'none'; // 'asc', 'desc', 'none'

const grid = document.getElementById('itemsGrid');
const searchInput = document.getElementById('globalSearch');
const loadingOverlay = document.getElementById('loadingOverlay');
const favCountBadge = document.getElementById('favCountBadge');
const fFour = document.getElementById('filterFournisseur');
const fType = document.getElementById('filterType');
const fSerie = document.getElementById('filterSerie');



if (!isDarkMode) document.body.classList.add('light-mode');

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

            if (data.needs && Array.isArray(data.needs)) {
                needs = data.needs;
                localStorage.setItem('art-needs', JSON.stringify(needs));
            }

            if (data.favorites && Array.isArray(data.favorites)) {
                favorites = data.favorites;
                localStorage.setItem('art-favorites', JSON.stringify(favorites));
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

        groupedData = processData(window.ART_DATA);

        // Initial filter options setup
        updateFilterOptions();
        applyFilters();

        updateFavCount();
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.classList.add('hidden'), 700);
    } catch (err) {
        loadingOverlay.innerHTML = `<p class="text-red-500 font-black uppercase tracking-[0.2em]">${err.message}</p>`;
    }
}

function updateFilterOptions() {
    const currentFour = fFour.value;
    const currentType = fType.value;
    const currentSerie = fSerie.value;

    const availableFours = new Set();
    const availableTypes = new Set();
    const availableSeries = new Set();

    groupedData.forEach(d => {
        const matchFour = !currentFour || d.fournisseur === currentFour;
        const matchType = !currentType || d.type === currentType;
        const matchSerie = !currentSerie || d.serie === currentSerie;

        if (matchType && matchSerie) if (d.fournisseur) availableFours.add(d.fournisseur);
        if (matchFour && matchSerie) if (d.type) availableTypes.add(d.type);
        if (matchFour && matchType) if (d.serie) availableSeries.add(d.serie);
    });

    fillSelect(fFour, Array.from(availableFours).sort(), "TOUS LES FOURNISSEURS", currentFour);
    fillSelect(fType, Array.from(availableTypes).sort(), "TYPE D'ARTICLE", currentType);
    fillSelect(fSerie, Array.from(availableSeries).sort(), "SÉRIE / GAMME", currentSerie);
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

    const q = searchInput.value.toLowerCase().trim();
    const four = fFour.value, type = fType.value, serie = fSerie.value;

    filteredData = groupedData.filter(item => {
        const id = `${item.reference}_${item.fournisseur || item.fabricant || ''}`.toLowerCase();
        if (showOnlyFavs && !favorites.includes(id)) return false;
        const matchSearch = !q || String(item.reference).toLowerCase().includes(q) || String(item.designation).toLowerCase().includes(q);
        return matchSearch && (!four || item.fournisseur === four) && (!type || item.type === type) && (!serie || item.serie === serie);
    });


    document.getElementById('matchCount').textContent = filteredData.length;
    displayCount = INCREMENT;
    render();
}

function changeViewMode(mode) {
    const views = ['grid', 'compact', 'mini', 'list'];
    views.forEach(v => grid.classList.remove(`view-${v}`));
    grid.classList.add(`view-${mode}`);
    currentView = mode;
    render();
}

function render() {
    grid.innerHTML = '';
    const items = filteredData.slice(0, displayCount);
    if (!items.length) { document.getElementById('emptyState').classList.remove('hidden'); return; }
    document.getElementById('emptyState').classList.add('hidden');

    items.forEach((it, idx) => {
        const id = `${it.reference}_${it.fournisseur || it.fabricant || ''}`.toLowerCase();
        const isFav = favorites.includes(id), isNeed = needs.some(n => n.id === id);

        const conditVal = Number(it.condit || it.conditionnement || 1);
        const unitVente = String(it.unit_vente || '').toUpperCase();
        const multiplier = (unitVente === 'M' || unitVente === 'PC' || unitVente === 'ML') ? conditVal : 1;

        const pxP = (Number(it.px_public || 0) * multiplier).toFixed(2);
        const pxR = (Number(it.px_remise || 0) * multiplier).toFixed(2);

        const card = document.createElement('div');
        card.className = `item-card animate-fade ${currentView === 'list' ? 'flex-row items-center' : ''}`;
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

        if (currentView === 'list') {
            card.innerHTML = `
                <div class="flex items-center gap-6 w-full">
                    ${img}
                    <span class="mono shrink-0">${safeRef}</span>
                    ${currentView !== 'mini' ? `<span class="badge uppercase shrink-0">${safeType}</span>` : ''}
                    <span class="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.2em] shrink-0 w-32 truncate">${safeFour}</span>
                    <h3 class="truncate flex-1">${safeDes}</h3>
                    ${conditHtml}
                    <div class="price-grid">
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
                        ${currentView !== 'mini' ? `<span class="badge uppercase">${safeType}</span>` : ''}
                    </div>
                    <div class="text-[8px] font-black text-indigo-500/40 uppercase tracking-[0.2em] mb-2">${safeFour}</div>
                    <h3>${safeDes}</h3>
                    ${conditHtml}
                    <div class="price-grid mt-auto">
                        <div class="flex flex-col"><span class="price-label">Catalogue</span><span class="price-value">${pxP}€</span></div>
                        <div class="flex flex-col items-end"><span class="price-label text-emerald-500 font-black">Net HT</span><span class="price-remise">${pxR}€</span></div>
                    </div>
                </div>`;
        }
        grid.appendChild(card);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('loadMoreContainer').classList.toggle('hidden', displayCount >= filteredData.length);
}

window.toggleF = (e, id) => {
    e.stopPropagation(); const i = favorites.indexOf(id);
    if (i > -1) favorites.splice(i, 1); else favorites.push(id);
    localStorage.setItem('art-favs', JSON.stringify(favorites));
    updateFavCount(); if (showOnlyFavs) applyFilters(); else render();
};

window.toggleN = (e, id, idx) => {
    e.stopPropagation();
    const it = filteredData[idx];
    const i = needs.findIndex(n => n.id === id);
    if (i > -1) {
        needs.splice(i, 1);
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

        needs.push({
            id,
            reference: it.reference,
            designation: it.designation,
            fournisseur: it.fournisseur || it.fabricant || 'Catalogue',
            ral: it.decor || '-',
            longueur: it.condit || 1,
            unit_condit: it.unit_condit || 'M',
            type: it.type || (isProfil ? 'Profilé' : 'Accessoire'),
            need: 0,
            stock: 0
        });
    }
    localStorage.setItem('art-needs', JSON.stringify(needs));
    render();
};

function updateFavCount() {
    const c = favorites.length; favCountBadge.textContent = c; favCountBadge.classList.toggle('hidden', c === 0);
}

window.switchView = (v) => {
    document.getElementById('catalogueView').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsListView').classList.toggle('hidden', v !== 'needs');
    document.getElementById('tabCatalogue').classList.toggle('active', v === 'catalogue');
    document.getElementById('tabNeeds').classList.toggle('active', v === 'needs');
    document.getElementById('filterBar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('catalogueToolbar').classList.toggle('hidden', v !== 'catalogue');
    document.getElementById('needsToolbar').classList.toggle('hidden', v !== 'needs');
    if (v === 'needs') renderNeeds();
};

window.renderNeeds = () => {
    const b = document.getElementById('needsTableBody');
    if (needs.length === 0) {
        b.innerHTML = '<tr><td colspan="9" class="p-12 text-center opacity-40">Votre liste de besoins est vide. Ajoutez des articles depuis le catalogue.</td></tr>';
        return;
    }
    b.innerHTML = '';
    needs.forEach((item, idx) => {
        const toCmd = Math.max(0, item.need - item.stock);
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.innerHTML = `
            <td class="table-cell text-zinc-400 font-bold text-xs uppercase tracking-wider">${item.fournisseur}</td>
            <td class="table-cell font-mono text-indigo-400 font-bold">${item.reference}</td>
            <td class="table-cell font-medium">${item.designation}</td>
            <td class="table-cell"><span class="px-2 py-1 bg-zinc-800 rounded text-xs font-mono">${item.ral || '-'}</span></td>
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
        const isExpanded = (isCalpinageMode && isProfil) || (activeCalpinageId === item.id);

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
                <td colspan="9" class="p-0 border-b border-indigo-900/50 relative">
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
    needs.forEach((item, idx) => {
        const isExpanded = (isCalpinageMode && getIsProfil(item)) || (activeCalpinageId === item.id);
        if (isExpanded) {
            setTimeout(() => CalpinageSystem.initRow(idx), 50);
        }
    });
};

window.updateNeedV = (i, f, v) => { needs[i][f] = parseInt(v) || 0; localStorage.setItem('art-needs', JSON.stringify(needs)); renderNeeds(); };
window.removeN = (i) => { needs.splice(i, 1); localStorage.setItem('art-needs', JSON.stringify(needs)); renderNeeds(); };
window.clearNeeds = () => { if (confirm("Supprimer toute la sélection ?")) { needs = []; localStorage.setItem('art-needs', "[]"); renderNeeds(); } };

window.toggleSupplierSort = () => {
    if (supplierSortOrder === 'asc') {
        supplierSortOrder = 'desc';
        needs.sort((a, b) => b.fournisseur.localeCompare(a.fournisseur));
    } else {
        supplierSortOrder = 'asc';
        needs.sort((a, b) => a.fournisseur.localeCompare(b.fournisseur));
    }
    renderNeeds();

    // Update icon rotation
    const icon = document.getElementById('sortIcon');
    if (icon) {
        icon.classList.remove('opacity-0');
        icon.classList.add('opacity-100');
        icon.style.transform = supplierSortOrder === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
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

searchInput.addEventListener('input', applyFilters);
fFour.addEventListener('change', (e) => applyFilters(e.target));
fType.addEventListener('change', (e) => applyFilters(e.target));
fSerie.addEventListener('change', (e) => applyFilters(e.target));
document.getElementById('resetFilters').addEventListener('click', () => { fFour.value = ""; fType.value = ""; fSerie.value = ""; searchInput.value = ""; applyFilters(); });
document.getElementById('toggleFavFilter').addEventListener('click', () => { showOnlyFavs = !showOnlyFavs; document.getElementById('toggleFavFilter').classList.toggle('active', showOnlyFavs); applyFilters(); });
document.getElementById('modeToggle').addEventListener('click', () => { isDarkMode = !isDarkMode; document.body.classList.toggle('light-mode', !isDarkMode); localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); });
document.getElementById('loadMoreBtn').addEventListener('click', () => { displayCount += INCREMENT; render(); });

// --- MODULE CALPINAGE (INLINE) ---
let isCalpinageMode = localStorage.getItem('art-calpinage-mode') === 'true';
let activeCalpinageId = localStorage.getItem('art-active-calpinage-id') || null;

function getIsProfil(item) {
    if (!item) return false;
    const des = (item.designation || '').toUpperCase();
    const type = (item.type || '').toUpperCase();
    const fam = (item.famille || '').toUpperCase();
    return type.includes('PROFIL') || fam.includes('PROFIL') ||
        des.includes('PROFIL') || des.includes('CHEVRON') ||
        des.includes('SABLIERE') || des.includes('PARCLOSE') ||
        des.includes('RAIL') || des.includes('BARRE') ||
        des.includes('TUBE') || des.includes('COULISSE') ||
        des.includes('TRAVERSE') || des.includes('MONTANT') ||
        des.includes('CORNIERE') || des.includes('MEPLAT') ||
        String(item.reference).toUpperCase().startsWith('WA'); // Extra catch for Akraplast
}

window.toggleCalpinageMode = () => {
    isCalpinageMode = !isCalpinageMode;
    localStorage.setItem('art-calpinage-mode', isCalpinageMode);
    // Clicking the main button resets individual focus
    activeCalpinageId = null;
    localStorage.removeItem('art-active-calpinage-id');

    const btn = document.getElementById('mainCalpinageBtn');
    if (btn) {
        if (isCalpinageMode) {
            btn.classList.add('bg-orange-500', 'text-white', 'border-orange-600');
            btn.classList.remove('bg-white', 'text-zinc-900', 'border-zinc-200');
        } else {
            btn.classList.remove('bg-orange-500', 'text-white', 'border-orange-600');
            btn.classList.add('bg-white', 'text-zinc-900', 'border-zinc-200');
        }
    }
    renderNeeds();
};

window.toggleCalpinageRow = (id) => {
    const idx = needs.findIndex(n => n.id === id);
    if (idx === -1) return;

    if (activeCalpinageId === id) {
        activeCalpinageId = null;
        localStorage.removeItem('art-active-calpinage-id');
    } else {
        activeCalpinageId = id;
        localStorage.setItem('art-active-calpinage-id', id);
        // Individual focus collapses others (turn off global mode)
        if (isCalpinageMode) {
            isCalpinageMode = false;
            localStorage.setItem('art-calpinage-mode', false);
            const btn = document.getElementById('mainCalpinageBtn');
            if (btn) {
                btn.classList.remove('bg-orange-500', 'text-white', 'border-orange-600');
                btn.classList.add('bg-white', 'text-zinc-900', 'border-zinc-200');
            }
        }
        setTimeout(() => CalpinageSystem.initRow(idx), 50);
    }
    renderNeeds();
};

const CalpinageSystem = {
    initRow(idx) {
        try {
            if (!needs[idx].calpinageData) {
                needs[idx].calpinageData = { cuts: [], lastSolution: null };
            }
            this.renderRowUI(idx);

            // Re-show last results if any
            if (needs[idx].calpinageData.lastSolution) {
                this.renderResults(idx, needs[idx].calpinageData.lastSolution);
            }
        } catch (e) {
            console.error("Error initRow:", e);
            const c = document.getElementById(`calpContainer_${idx}`);
            if (c) c.innerHTML = `<div class="text-red-500 p-4">Erreur d'initialisation: ${e.message}</div>`;
        }
    },

    renderRowUI(idx) {
        try {
            const item = needs[idx];
            const container = document.getElementById(`calpContainer_${idx}`);
            if (!container) return;

            // Find group
            const groups = this.getGroupedProfiles();
            const cleanRef = this.getCleanRoot(item.reference);
            const group = groups.find(g => g.rootRef === cleanRef || g.displayRef === item.reference);

            if (!group) {
                container.innerHTML = `<div class="p-4 text-center text-zinc-500 italic">Profil non compatible ou non trouvé dans le catalogue pour le calpinage. <br><span class="text-xs">Ref: ${item.reference} / Root: ${cleanRef}</span></div>`;
                return;
            }

            // Render UI
            container.innerHTML = `
                <div class="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <!-- 1. Saisie Débits -->
                    <div class="w-full lg:w-1/3 bg-zinc-900/50 p-4 rounded border border-zinc-800 flex flex-col">
                        <h4 class="text-xs font-bold text-zinc-500 uppercase mb-3 flex justify-between">
                            <span>Débits (Coupes)</span>
                        </h4>
                        <div class="flex-1 overflow-y-auto max-h-40 mb-3 bg-black/20 rounded border border-zinc-800/50">
                            <table class="w-full text-left text-sm">
                                <tbody id="calpTable_${idx}"></tbody>
                            </table>
                        </div>
                        <div class="flex gap-2">
                            <input type="number" id="cutLen_${idx}" placeholder="Long (mm)" step="1" class="w-32 bg-zinc-800 border-zinc-700 rounded text-white px-2 py-1 text-sm focus:border-indigo-500 outline-none transition-colors">
                            <input type="number" id="cutQty_${idx}" placeholder="Qté" value="1" class="w-16 bg-zinc-800 border-zinc-700 rounded text-white px-2 py-1 text-sm focus:border-indigo-500 outline-none transition-colors">
                            <button onclick="CalpinageSystem.addCut(${idx})" class="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-bold transition-colors">+</button>
                        </div>
                        <div class="mt-2 flex justify-end">
                                <button id="btnCalc_${idx}" onclick="CalpinageSystem.optimize(${idx})" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all">CALCULER</button>
                        </div>
                    </div>

                    <!-- 2. Résultats -->
                    <div class="flex-1 bg-zinc-900/50 p-4 rounded border border-zinc-800 flex flex-col">
                        <h4 class="text-xs font-bold text-zinc-500 uppercase mb-3">Optimisation & Chutes</h4>
                        <div id="calpRes_${idx}" class="flex-1 overflow-y-auto max-h-60 bg-black/20 rounded border border-zinc-800/50 p-3 text-xs text-zinc-400">
                            <div class="flex items-center justify-center h-full opacity-50">Ajoutez des coupes puis cliquez sur CALCULER.</div>
                        </div>
                    </div>
                </div>
            `;
            this.renderCutsTable(idx);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {
            console.error(e);
            const c = document.getElementById(`calpContainer_${idx}`);
            if (c) c.innerHTML = `<div class="text-red-500 p-4">Erreur de rendu: ${e.message}</div>`;
        }
    },

    addCut(idx) {
        const lenInput = document.getElementById(`cutLen_${idx}`);
        const qtyInput = document.getElementById(`cutQty_${idx}`);
        const length = parseFloat(lenInput.value);
        const quantity = parseInt(qtyInput.value);

        if (length > 0 && quantity > 0) {
            if (!needs[idx].calpinageData) needs[idx].calpinageData = { cuts: [] };
            const cuts = needs[idx].calpinageData.cuts || [];
            cuts.push({ length: length / 1000, quantity });
            cuts.sort((a, b) => b.length - a.length);
            needs[idx].calpinageData.cuts = cuts;

            localStorage.setItem('art-needs', JSON.stringify(needs));

            this.renderCutsTable(idx);
            lenInput.value = ""; qtyInput.value = "1"; lenInput.focus();
        } else {
            alert("Veuillez saisir une longueur et une quantité valides.");
        }
    },

    removeCut(idx, cutIdx) {
        const cuts = needs[idx].calpinageData.cuts;
        cuts.splice(cutIdx, 1);
        localStorage.setItem('art-needs', JSON.stringify(needs));
        this.renderCutsTable(idx);
    },

    renderCutsTable(idx) {
        const tbody = document.getElementById(`calpTable_${idx}`);
        if (!tbody) return;
        const cuts = (needs[idx].calpinageData && needs[idx].calpinageData.cuts) ? needs[idx].calpinageData.cuts : [];
        tbody.innerHTML = cuts.map((c, i) => `
            <tr class="border-b border-zinc-800/50 last:border-0 hover:bg-white/5 transition-colors">
                <td class="p-2 text-indigo-300 font-mono">${Math.round(c.length * 1000)}mm</td>
                <td class="p-2 font-bold text-white">x${c.quantity}</td>
                <td class="p-2 text-right"><button onclick="CalpinageSystem.removeCut(${idx}, ${i})" class="text-zinc-600 hover:text-red-500 transition-colors">x</button></td>
            </tr>
        `).join('');
    },

    optimize(idx) {
        try {
            const item = needs[idx];
            const groups = this.getGroupedProfiles();
            const cleanRef = this.getCleanRoot(item.reference);

            // Match by root and normalize RAL for comparison
            const group = groups.find(g => {
                const rootMatch = (g.rootRef === cleanRef || g.displayRef === item.reference);
                const fourMatch = (g.fournisseur === item.fournisseur);
                const ralA = (g.decor || '-');
                const ralB = (item.ral || '-');
                return rootMatch && fourMatch && ralA === ralB;
            });

            if (!group) {
                alert("Profil non trouvé ou non compatible pour le calpinage. (Ref: " + item.reference + " / RAL: " + (item.ral || '-') + ")");
                return;
            }

            const cuts = (item.calpinageData && item.calpinageData.cuts) ? item.calpinageData.cuts : [];
            if (cuts.length === 0) {
                alert("Veuillez ajouter des débits (longueur + quantité) avant de calculer.");
                return;
            }

            // Stocks : AUTOMATICALLY USE ALL VARIANTS
            const availableStock = [...group.variants];
            // Sort longest first to favor using long bars (usually better optimization)
            availableStock.sort((a, b) => b.length - a.length);

            if (availableStock.length === 0) { alert("Aucun stock trouvé pour ce profil."); return; }

            // Algo
            let requiredCuts = [];
            cuts.forEach(c => { for (let i = 0; i < c.quantity; i++) requiredCuts.push(c.length); });
            requiredCuts.sort((a, b) => b - a);

            const solution = [];
            const TRIM = 0.02; const KERF = 0.004;

            for (const cutLen of requiredCuts) {
                let bestBar = null; let bestResidue = Infinity;

                for (let i = 0; i < solution.length; i++) {
                    const bar = solution[i];
                    const free = bar.stockVariant.length - bar.usedLength;
                    if (free >= (cutLen + KERF)) {
                        const res = free - (cutLen + KERF);
                        if (res < bestResidue) { bestResidue = res; bestBar = bar; }
                    }
                }

                if (bestBar) {
                    bestBar.cuts.push(cutLen); bestBar.usedLength += (cutLen + KERF);
                } else {
                    // Open new bar - Best Fit Strategy
                    let selectedStock = null; let minW = Infinity;
                    availableStock.forEach(s => {
                        if ((s.length - TRIM) >= cutLen) {
                            const w = (s.length - TRIM) - cutLen;
                            if (w < minW) { minW = w; selectedStock = s; }
                        }
                    });

                    if (!selectedStock) {
                        // Cut is too long for any available bar
                        const maxBar = availableStock[0].length;
                        this.showSplitUI(idx, cutLen, maxBar);
                        return; // EXIT optimize immediately to let user split
                    }
                    solution.push({ stockVariant: selectedStock, usedLength: TRIM + cutLen + KERF, cuts: [cutLen] });
                }
            }

            this.renderResults(idx, solution);
        } catch (e) {
            const resContainer = document.getElementById(`calpRes_${idx}`);
            if (resContainer) resContainer.innerHTML = `<div class="p-3 bg-red-900/20 text-red-400 rounded text-xs">Erreur de calcul : ${e.message}</div>`;
            console.error(e);
        }
    },

    showSplitUI(idx, cutLen, maxBar) {
        const container = document.getElementById(`calpRes_${idx}`);
        if (!container) return;

        const mm = Math.round(cutLen * 1000);
        const maxMm = Math.round(maxBar * 1000);

        let html = `
            <div class="p-4 bg-orange-950/20 border border-orange-500/30 rounded-lg">
                <div class="flex items-center gap-2 text-orange-400 mb-3 font-bold">
                    <i data-lucide="scissors" class="w-5 h-5"></i>
                    COUPE TROP LONGUE (${mm}mm)
                </div>
                <p class="text-xs text-orange-300/80 mb-4">
                    Cette pièce est plus longue que la plus grande barre disponible (${maxMm}mm). 
                    Où souhaitez-vous effectuer la coupe de raccord ?
                </p>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-[10px] uppercase text-zinc-500 mb-1">Partie A (mm)</label>
                        <input type="number" id="splitA_${idx}" value="${Math.min(mm - 500, maxMm - 100)}" 
                               class="w-full bg-black/40 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:border-orange-500 outline-none"
                               oninput="document.getElementById('splitB_${idx}').value = ${mm} - this.value">
                    </div>
                    <div>
                        <label class="block text-[10px] uppercase text-zinc-500 mb-1">Partie B (mm)</label>
                        <input type="number" id="splitB_${idx}" value="${mm - Math.min(mm - 500, maxMm - 100)}" 
                               class="w-full bg-black/40 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:border-orange-500 outline-none"
                               oninput="document.getElementById('splitA_${idx}').value = ${mm} - this.value">
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button onclick="CalpinageSystem.confirmSplit(${idx}, ${cutLen})" 
                            class="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold transition-colors">
                        VALIDER LA SCISSION
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    confirmSplit(idx, originalCut) {
        const valA = parseFloat(document.getElementById(`splitA_${idx}`).value) / 1000;
        const valB = parseFloat(document.getElementById(`splitB_${idx}`).value) / 1000;

        if (isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) {
            alert("Valeurs de scission invalides.");
            return;
        }

        // Replace one instance of originalCut with the two new ones
        const epsilon = 0.0001;
        const cuts = needs[idx].calpinageData.cuts;
        const cIdx = cuts.findIndex(c => Math.abs(c.length - originalCut) < epsilon && c.quantity > 0);
        if (cIdx > -1) {
            if (cuts[cIdx].quantity > 1) {
                cuts[cIdx].quantity--;
            } else {
                cuts.splice(cIdx, 1);
            }

            // Add Part A (Float safety: round to 4 decimals for keys/matching)
            const vA = Math.round(valA * 10000) / 10000;
            const vB = Math.round(valB * 10000) / 10000;

            const existA = cuts.find(c => Math.abs(c.length - vA) < epsilon);
            if (existA) existA.quantity++; else cuts.push({ length: vA, quantity: 1 });

            // Add Part B
            const existB = cuts.find(c => Math.abs(c.length - vB) < epsilon);
            if (existB) existB.quantity++; else cuts.push({ length: vB, quantity: 1 });

            // Save and Refresh
            needs[idx].calpinageData.cuts = cuts;
            localStorage.setItem('art-needs', JSON.stringify(needs));
            this.renderCutsTable(idx);
            this.optimize(idx);
        }
    },

    renderResults(idx, solution) {
        const container = document.getElementById(`calpRes_${idx}`);

        // Synthesis
        const synthesis = {};
        let totalBars = 0;
        solution.forEach(bar => {
            const k = bar.stockVariant.ref;
            if (!synthesis[k]) synthesis[k] = { count: 0, length: bar.stockVariant.length };
            synthesis[k].count++;
            totalBars++;
        });

        let html = `<div class="mb-4 flex items-center justify-between bg-zinc-800/50 p-2 rounded">`;
        html += `<div class="flex flex-wrap gap-2">`;
        Object.values(synthesis).forEach(s => {
            html += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-500/30">
                <span class="font-bold mr-1">${s.count}x</span> Barre ${s.length}m
                </span>`;
        });
        html += `</div>`;
        // Serializing solution to pass it back to applyToRow
        // Save solution to prevent disappearance upon re-opening
        if (!needs[idx].calpinageData) needs[idx].calpinageData = {};
        needs[idx].calpinageData.lastSolution = solution;
        localStorage.setItem('art-needs', JSON.stringify(needs));

        const solJson = JSON.stringify(solution).replace(/"/g, '&quot;');
        html += `<button onclick="CalpinageSystem.applyToRow(${idx}, '${solJson}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20">APPLIQUER</button>`;
        html += `</div>`;

        // Bars visual
        solution.forEach((bar, i) => {
            const total = bar.stockVariant.length;
            const waste = total - (bar.usedLength - 0.004);
            const color = this.getBarColor(total);

            html += `
                <div class="mb-3 relative group">
                    <div class="h-9 w-full bg-zinc-900/60 rounded-md flex overflow-hidden relative border border-white/5">
                        <!-- Info Overlay (Inside) -->
                        <div class="absolute inset-x-0 h-full flex items-center justify-between px-3 pointer-events-none z-30 text-[10px] font-bold">
                            <span class="text-white/70 drop-shadow-sm">BARRE ${i + 1} (${total}m)</span>
                            <span class="text-white/60 italic drop-shadow-sm">Chute: ${(waste * 1000).toFixed(0)}mm</span>
                        </div>

                        <!-- Trim (Initial 20mm) -->
                        <div class="h-full bg-red-500/10 border-r border-red-500/20 z-0" style="width:${(0.02 / total) * 100}%" title="Coupe propre (20mm)"></div>
                        
                        ${bar.cuts.map(c => `
                            <div class="h-full border-r border-black/30 flex items-center justify-center text-[11px] text-white font-black z-20 shadow-inner" 
                                    style="width:${(c / total) * 100}%; background-color:${color}; filter: brightness(0.9);">
                                <span class="drop-shadow-md">${Math.round(c * 1000)}</span>
                            </div>
                            <div class="h-full bg-black/40 w-px z-20" style="width:${(0.004 / total) * 100}%"></div>
                        `).join('')}
                        
                        <!-- Empty Space (Waste) -->
                        <div class="h-full flex-1 bg-black/30"></div>
                    </div>
                </div>
                `;
        });

        container.innerHTML = html;
    },

    getBarColor(len) {
        if (len >= 7.0) return "#d97706"; // Amber 600
        if (len >= 6.5) return "#2563eb"; // Blue 600
        if (len >= 6.0) return "#7c3aed"; // Violet 600
        if (len >= 5.0) return "#db2777"; // Pink 600
        if (len >= 4.0) return "#059669"; // Emerald 600
        return "#4f46e5"; // Indigo 600
    },

    applyToRow(idx, solutionJson) {
        try {
            const solution = JSON.parse(solutionJson.replace(/&quot;/g, '"'));
            const originalItem = needs[idx];
            const originalCalpData = originalItem.calpinageData;

            // 1. Group solution by explicit references (variants)
            const barsToOrder = {};
            solution.forEach(bar => {
                const ref = bar.stockVariant.ref;
                if (!barsToOrder[ref]) barsToOrder[ref] = 0;
                barsToOrder[ref]++;
            });

            // 2. Add/Update items in needs
            // We remove the original generic row and replace it with specific bars
            needs.splice(idx, 1);

            for (const [vRef, qty] of Object.entries(barsToOrder)) {
                const itData = window.ART_DATA.find(it => {
                    const refMatch = String(it.reference) === String(vRef);
                    const fourMatch = (it.fournisseur === originalItem.fournisseur);
                    const ralMatch = ((it.decor || '-') === (originalItem.ral || '-'));
                    const gammeA = (it.gamme || '').trim().toUpperCase();
                    const gammeB = (originalItem.gamme || '').trim().toUpperCase();
                    return refMatch && fourMatch && ralMatch && (gammeA === gammeB || !gammeB);
                });

                if (itData) {
                    const newId = `${itData.reference}_${itData.fournisseur || itData.fabricant || ''}`.toLowerCase();
                    const existingIdx = needs.findIndex(n => n.id === newId && n.ral === originalItem.ral);

                    // FILTER DATA FOR THIS SPECIFIC VARIANT
                    const specificSolution = solution.filter(bar => String(bar.stockVariant.ref) === String(vRef));
                    const specificCuts = [];
                    specificSolution.forEach(bar => {
                        bar.cuts.forEach(c => specificCuts.push({ length: c, quantity: 1 }));
                    });
                    // Merge identical cuts for cleaner display
                    const mergedCuts = [];
                    specificCuts.forEach(c => {
                        const exist = mergedCuts.find(mc => Math.abs(mc.length - c.length) < 0.0001);
                        if (exist) exist.quantity++; else mergedCuts.push(c);
                    });
                    mergedCuts.sort((a, b) => b.length - a.length);

                    const newCalpData = {
                        cuts: mergedCuts,
                        lastSolution: specificSolution
                    };

                    if (existingIdx > -1) {
                        needs[existingIdx].need += qty;
                        needs[existingIdx].calpinageData = newCalpData;
                    } else {
                        needs.push({
                            id: newId,
                            reference: itData.reference,
                            designation: itData.designation,
                            fournisseur: itData.fournisseur || itData.fabricant || 'Catalogue',
                            ral: itData.decor || originalItem.ral || '-',
                            longueur: itData.condit || itData.conditionnement || 1,
                            unit_condit: itData.unit_condit || 'M',
                            type: itData.type || 'Profilé',
                            need: qty,
                            stock: 0,
                            calpinageData: newCalpData
                        });
                    }
                }
            }

            localStorage.setItem('art-needs', JSON.stringify(needs));
            activeCalpinageId = null;
            localStorage.removeItem('art-active-calpinage-id');
            renderNeeds();
        } catch (e) {
            alert("Erreur lors de l'application : " + e.message);
        }
    },

    // Utils
    getCleanRoot(ref, length) {
        if (!ref) return "";
        let root = String(ref).toUpperCase().trim();
        // Strip common length suffixes (/4.5, /6.5, /4.7)
        root = root.replace(/\/[\d\.]+(th|TH)?$/i, '');

        // Strip TH suffix
        root = root.replace(/(TH|th)$/i, '');

        // Specific Akraplast/numeric suffix stripping
        // If ref ends with the length in mm (e.g. 4500, 7000)
        if (length) {
            const mm = Math.round(length * 1000);
            const mmStr = String(mm);
            // Search for mmStr at the end of the root
            if (root.endsWith(mmStr)) {
                root = root.substring(0, root.lastIndexOf(mmStr));
            } else if (mm % 100 === 0 && root.endsWith(String(mm / 10))) {
                root = root.substring(0, root.lastIndexOf(String(mm / 10)));
            }
        }

        // Final aggressive cleaning for Akraplast (remove trailing numbers that look like lengths if any)
        // e.g. WA15-B7000 becomes WA15-B
        // IMPORTANT: Don't do this for pure numeric short references (like 7073)
        const isShortNumeric = /^\d{4,5}$/.test(root);
        if (!isShortNumeric && !length) {
            root = root.replace(/\d{3,4}$/, '');
        }

        return root.replace(/[\/-]+$/, ''); // Strip trailing separators
    },

    getGroupedProfiles() {
        const groups = new Map();
        // Use window.ART_DATA instead of groupedData to see all lengths
        window.ART_DATA.forEach(item => {
            const des = (item.designation || '').toUpperCase();
            const type = (item.type || '').toUpperCase();
            const fam = (item.famille || '').toUpperCase();
            const isProfil = type.includes('PROFIL') || fam.includes('PROFIL') ||
                des.includes('PROFIL') || des.includes('CHEVRON') ||
                des.includes('SABLIERE') || des.includes('PARCLOSE') ||
                des.includes('RAIL') || des.includes('BARRE') ||
                des.includes('TUBE') || des.includes('COULISSE') ||
                des.includes('TRAVERSE') || des.includes('MONTANT') ||
                des.includes('CORNIERE') || des.includes('MEPLAT');

            if (!isProfil) return;

            let length = parseFloat(item.conditionnement || item.longueur);
            if (!length || isNaN(length)) {
                const match = String(item.reference).match(/\/([\d\.]+)/);
                if (match) length = parseFloat(match[1]);
            }

            const root = this.getCleanRoot(item.reference, length);
            const decorNorm = (item.decor || '-');
            const gammeNorm = (item.gamme || '').trim().toUpperCase();
            const key = `${root}|${item.fournisseur}|${gammeNorm}|${decorNorm}`;
            if (!groups.has(key)) {
                groups.set(key, { key, rootRef: root, displayRef: item.reference, designation: item.designation, fournisseur: item.fournisseur, decor: decorNorm, variants: [] });
            }
            if (length > 0) {
                groups.get(key).variants.push({ ref: item.reference, length: length, stock: item.stock || 999 });
            }
        });
        return Array.from(groups.values()).filter(g => g.variants.length > 0);
    }
};


window.saveProject = () => {
    const chantierVal = document.getElementById('chantierRef') ? document.getElementById('chantierRef').value : '';
    const defaultName = chantierVal ? `Projet_${chantierVal.replace(/[^a-z0-9]/gi, '_')}` : 'Projet_ArtsAlu';

    // Prompt handled by browser "Save As" usually, but we can set default name
    // To strictly force "Save As" dialog in some browsers requires stream saver or checking browser settings,
    // but 'download' attribute is the standard web way.

    const data = {
        timestamp: new Date().toISOString(),
        chantier: chantierVal,
        needs: needs,
        favorites: favorites
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${defaultName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.saveChantier = (v) => {
    localStorage.setItem('art-chantier', v);
};

// Initialisation supprimée car le bouton est supprimé
init();

// Initialize main button state
if (isCalpinageMode) {
    const btn = document.getElementById('mainCalpinageBtn');
    if (btn) {
        btn.classList.add('bg-orange-500', 'text-white', 'border-orange-600');
        btn.classList.remove('bg-white', 'text-zinc-900', 'border-zinc-200');
    }
}

// Load chantier ref
const cRef = localStorage.getItem('art-chantier');
if (cRef) {
    const el = document.getElementById('chantierRef');
    if (el) el.value = cRef;
}
/* --- EXPORT / ORDER FORM SYSTEM --- */

function openExportModal() {
    const modal = document.getElementById('exportModal');
    const tabsContainer = document.getElementById('exportTabs');
    const previewContainer = document.getElementById('exportPreview');
    const chantier = document.getElementById('chantierRef').value || "Chantier Inconnu";

    // Group by Supplier
    const groups = {};
    needs.forEach(item => {
        // Fix: Use item.need instead of item.qty and force number conversion
        const needVal = parseFloat(item.need) || 0;
        const stockVal = parseFloat(item.stock) || 0;
        const toOrder = Math.max(0, needVal - stockVal);

        if (toOrder > 0) {
            const supplier = item.fournisseur || "Autres";
            if (!groups[supplier]) groups[supplier] = [];
            groups[supplier].push({ ...item, toOrder });
        }
    });

    if (Object.keys(groups).length === 0) {
        alert("Aucun article à commander (Besoin <= Stock partout).");
        return;
    }

    // Generate Tabs
    tabsContainer.innerHTML = '';
    const suppliers = Object.keys(groups).sort();
    let activeSupplier = suppliers[0];

    suppliers.forEach(supplier => {
        const btn = document.createElement('div');
        btn.className = `export-tab ${supplier === activeSupplier ? 'active' : ''}`;
        btn.textContent = `${supplier} (${groups[supplier].length})`;
        btn.onclick = () => {
            document.querySelectorAll('.export-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderBDC(supplier, groups[supplier], chantier);
        };
        tabsContainer.appendChild(btn);
    });

    // Render Initial BDC
    renderBDC(activeSupplier, groups[activeSupplier], chantier);

    // Show Modal
    modal.classList.remove('hidden');
}

function renderBDC(supplier, items, chantier) {
    const container = document.getElementById('exportPreview');
    const date = new Date().toLocaleDateString('fr-FR');

    const rows = items.map(item => `
        <tr>
            <td>${item.reference}</td>
            <td>${item.designation}</td>
            <td>${item.decor || '-'}</td>
            <td>${item.conditionnement || '-'}</td>
            <td style="text-align: center; font-size: 1.1em; font-weight: bold;">${item.toOrder}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="bdc-header">
            <div>
                <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 5px;">ARTS ALU</h1>
                <p style="font-size: 12px; color: #666;">BON DE COMMANDE</p>
            </div>
            <div style="text-align: right;">
                <p style="font-weight: bold; font-size: 14px;">CHANTIER : ${chantier}</p>
                <p style="font-size: 12px;">Date : ${date}</p>
            </div>
        </div>

        <div style="margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #999;">FOURNISSEUR</p>
            <h2 style="font-size: 18px; font-weight: 800;">${supplier}</h2>
        </div>

        <table class="bdc-table">
            <thead>
                <tr>
                    <th style="width: 20%;">RÉFÉRENCE</th>
                    <th>DÉSIGNATION</th>
                    <th style="width: 15%;">RAL</th>
                    <th style="width: 15%;">CONDIT.</th>
                    <th style="width: 10%; text-align: center;">QTÉ</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid;">
            <div style="width: 40%; border-top: 1px solid #ccc; padding-top: 10px;">
                <p style="font-size: 10px; font-weight: bold;">Date et Signature Commandeur :</p>
            </div>
            <div style="width: 40%; border-top: 1px solid #ccc; padding-top: 10px; text-align: right;">
                <p style="font-size: 10px; font-weight: bold;">Bon pour accord :</p>
            </div>
        </div>
    `;
}


// ... existing code ...

/* --- BATCH RAL MANAGEMENT --- */

let currentRalFamily = 'std';

window.toggleFinitionMode = function () {
    try {
        console.log("Toggle Finition Mode. Current:", isRalSelectionMode);

        // 1. If not in mode -> Enter mode
        if (!isRalSelectionMode) {
            toggleRalSelectionMode();
            // alert("Mode Finition ACTIVÉ");
            return;
        }

        // 2. If in mode
        const count = selectedNeeds.size;

        if (count > 0) {
            // If items selected -> Apply (Open Modal)
            openRalModal();
        } else {
            // If no items selected -> Cancel (Exit mode)
            toggleRalSelectionMode();
            // alert("Mode Finition DÉSACTIVÉ");
        }
    } catch (e) {
        alert("Erreur Finition: " + e.message);
        console.error(e);
    }
}

function toggleRalSelectionMode() {
    isRalSelectionMode = !isRalSelectionMode;
    // Clear selection when exiting
    if (!isRalSelectionMode) {
        selectedNeeds.clear();
    }
    updateRalModeUI();
    renderNeeds();
}


function updateRalModeUI() {
    console.log("Updating UI. Mode:", isRalSelectionMode);
    const btn = document.getElementById('ralModeBtn');
    const btnText = document.getElementById('ralBtnText');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    // Safety check if elements exist
    if (!btn || !btnText) return;

    if (isRalSelectionMode) {
        const count = selectedNeeds.size;

        if (count > 0) {
            // Mode: Apply
            btn.className = "flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all border border-indigo-600 shadow-sm shadow-indigo-500/20";
            btnText.textContent = `APPLIQUER (${count})`;

            // Allow clicking to Apply
        } else {
            // Mode: Active but empty (Cancel option)
            btn.className = "flex items-center gap-2 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-xs font-bold transition-all border border-zinc-600 shadow-sm";
            btnText.textContent = "ANNULER";
        }

        // Show Select All Checkbox header
        if (selectAllCheckbox) {
            const th = selectAllCheckbox.parentElement.parentElement;
            th.classList.remove('hidden');
            th.classList.add('table-header', 'w-12', 'p-2', 'text-center');
        }

    } else {
        // Mode: Default (Inactive)
        btn.className = "flex items-center gap-2 px-6 py-3 bg-white hover:bg-zinc-50 text-zinc-900 rounded-lg text-xs font-bold transition-all border border-zinc-200 shadow-sm";
        btnText.textContent = "FINITIONS";

        // Ensure icon is purple
        const icon = btn.querySelector('svg') || btn.querySelector('i');
        if (icon) {
            icon.classList.remove('text-white', 'text-zinc-300');
            icon.classList.add('text-purple-600');
        }

        // Hide Select All Checkbox header
        if (selectAllCheckbox) {
            const th = selectAllCheckbox.parentElement.parentElement;
            th.classList.add('hidden');
            th.classList.remove('table-header', 'w-12', 'p-2', 'text-center');
        }
    }

    // Sync Select All checkbox state
    if (selectAllCheckbox) {
        const count = selectedNeeds.size;
        selectAllCheckbox.checked = (needs.length > 0 && count === needs.length);
        selectAllCheckbox.indeterminate = (count > 0 && count < needs.length);
    }
}

function toggleSelectAll() {
    if (!isRalSelectionMode) return; // Only work in mode

    const allSelected = selectedNeeds.size === needs.length && needs.length > 0;
    selectedNeeds.clear();

    if (!allSelected) {
        needs.forEach((_, idx) => selectedNeeds.add(idx));
    }

    renderNeeds();
    updateRalModeUI();
}

function toggleSelection(idx) {
    if (!isRalSelectionMode) return;

    if (selectedNeeds.has(idx)) {
        selectedNeeds.delete(idx);
    } else {
        selectedNeeds.add(idx);
    }
    renderNeeds();
    updateRalModeUI();
}

// Reuse toggleSelection for row click if clicking checkbox OR row in mode
function handleRowClick(e, idx) {
    if (isRalSelectionMode) {
        // If in mode, clicking anywhere toggles selection (unless clicking delete or edit specific inputs)
        // Also ignore checkbox to prevent double toggle (onchange handles it)
        if (e.target.closest('button') ||
            e.target.closest('input[type="number"]') ||
            e.target.closest('input[type="checkbox"]')) return;

        toggleSelection(idx);
        return; // Stop further processing (like expansion) if in selection mode
    }
    // ... existing logic for expanding row ...
}


/* --- RAL MODAL --- */

function openRalModal() {
    if (selectedNeeds.size === 0) return;

    document.getElementById('ralModalCount').textContent = selectedNeeds.size;
    document.getElementById('ralModal').classList.remove('hidden');

    // Reset inputs
    selectRalFamily('std');
    document.getElementById('ralCodeInput').value = '';
    document.getElementById('ralFinishSelect').value = 'Brillant';
}

function closeRalModal() {
    document.getElementById('ralModal').classList.add('hidden');
}

function selectRalFamily(family) {
    currentRalFamily = family;
    document.getElementById('selectedRalFamily').value = family;

    // Update UI
    document.querySelectorAll('.ral-family-btn').forEach(btn => btn.classList.remove('active'));
    // Find button by onclick attribute (simple way)
    const btn = document.querySelector(`button[onclick="selectRalFamily('${family}')"]`);
    if (btn) btn.classList.add('active');

    // Auto-fill defaults based on family
    const ralInput = document.getElementById('ralCodeInput');
    const finishSelect = document.getElementById('ralFinishSelect');

    if (family === 'std') {
        ralInput.placeholder = "Ex: 9010";
        finishSelect.value = "Brillant";
    } else if (family === 'anod') {
        ralInput.value = "NATUREL";
        finishSelect.value = "Satiné";
    } else if (family === 'wood') {
        ralInput.value = "CHENE";
        finishSelect.value = "Satiné";
    }
}

function applyRalToSelection() {
    const family = currentRalFamily;
    const code = document.getElementById('ralCodeInput').value.trim().toUpperCase();
    const finish = document.getElementById('ralFinishSelect').value;

    if (!code && family !== 'std') { // Allow empty for standard if just setting finish? No, require code.
        // Actually for 'std' maybe we want to just set finish if code is empty? 
        // Let's require code for now or default to "STD"
    }

    const finalCode = code || (family === 'std' ? '9010' : 'UNDEFINED');

    // Apply to selected items
    selectedNeeds.forEach(idx => {
        if (needs[idx]) {
            needs[idx].ral = finalCode;
            needs[idx].ral_finish = finish;
            needs[idx].ral_family = family;
        }
    });

    saveNeeds();
    renderNeeds();
    closeRalModal();

    // Optional: Clear selection after apply?
    // selectedNeeds.clear();
    // updateBatchRalButton();
    // renderNeeds();

    // Show confirmation
    // TODO: Toast notification
}


/* --- RENDER NEEDS UPDATE --- */

function renderNeeds() {
    const tbody = document.getElementById('needsTableBody');
    if (!tbody) return;

    // Handle header checkbox visibility and width
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const th = selectAllCheckbox.parentElement.parentElement;
        if (isRalSelectionMode) {
            th.classList.remove('hidden');
            th.classList.add('table-header', 'w-12', 'p-2', 'text-center');
        } else {
            th.classList.add('hidden');
            th.classList.remove('table-header', 'w-12', 'p-2', 'text-center');
        }
    }

    tbody.innerHTML = needs.map((item, index) => {
        const isSelected = selectedNeeds.has(index);
        const ref = item.reference || '-';
        const des = item.designation || '-';

        let ralDisplay = '<span class="text-zinc-500">-</span>';
        if (item.ral) {
            ralDisplay = `<div class="flex flex-col">
                <span class="font-bold text-white">${item.ral}</span>
                ${item.ral_finish ? `<span class="text-[10px] text-zinc-400 capitalize">${item.ral_finish}</span>` : ''}
            </div>`;
        } else if (item.decor) {
            ralDisplay = `<span class="text-zinc-400">${item.decor}</span>`;
        }

        // Dynamic classes
        const rowBg = isSelected
            ? 'bg-indigo-500/20 border-l-2 border-l-indigo-500'
            : 'hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 border-l-2 border-l-transparent';

        // Checkbox column cell
        const checkboxCellClass = isRalSelectionMode
            ? 'p-2 w-12 text-center'
            : 'hidden';

        return `
        <tr onclick="handleRowClick(event, ${index})" 
            class="group transition-all cursor-pointer ${rowBg}">
            
            <!-- CHECKBOX -->
            <td class="text-center ${checkboxCellClass}">
                <div class="flex items-center justify-center w-12 mx-auto">
                    <input type="checkbox" 
                        onchange="toggleSelection(${index})" 
                        ${isSelected ? 'checked' : ''} 
                        class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600">
                </div>
            </td>

            <!-- SUPPLIER -->
            <td class="p-4 w-32">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-8 rounded-full bg-indigo-500/50"></div>
                    <span class="font-bold text-xs uppercase tracking-wider text-zinc-400">${item.fournisseur || 'AUTRE'}</span>
                </div>
            </td>

            <!-- REFERENCE -->
            <td class="p-4 w-48 font-mono text-indigo-300 font-bold">${ref}</td>

            <!-- DESIGNATION -->
            <td class="p-4">
                <div class="text-sm font-medium text-zinc-300 line-clamp-2">${des}</div>
            </td>

            <!-- RAL / FINISH -->
            <td class="p-4 w-24">
                ${ralDisplay}
            </td>

            <!-- CONDIT -->
            <td class="p-4 w-32">
               <div class="text-xs text-zinc-500">${item.conditionnement || '-'}</div>
            </td>

            <!-- NEED -->
            <td class="p-4 w-24 text-center">
                <div class="inline-flex items-center justify-center min-w-[30px] h-8 px-2 bg-zinc-800 rounded-lg text-white font-bold border border-zinc-700">
                    ${item.need || 0}
                </div>
            </td>

            <!-- STOCK -->
            <td class="p-4 w-24 text-center">
                 <span class="text-zinc-500 font-mono">${item.stock || 0}</span>
            </td>

            <!-- ORDER -->
            <td class="p-4 w-24 text-center">
                <span class="text-emerald-500 font-bold font-mono">${Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0))}</span>
            </td>

            <!-- ACTIONS -->
            <td class="p-4 w-16 text-right">
                <button onclick="deleteNeed(${index})" class="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    // Re-init icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateRalModeUI();
}

// ... existing export functions ...

/* --- EXPORT / ORDER FORM SYSTEM V2 --- */
// (Keep the existing V2 export functions)

function openExportModalV2() {

    const modal = document.getElementById('exportModal');
    const tabsContainer = document.getElementById('exportTabs');
    const chantier = document.getElementById('chantierRef').value || "Chantier Inconnu";

    // 1. Group by Supplier (Standard BDC)
    const groups = {};
    const allItems = [];
    const calpinageItems = [];

    needs.forEach(item => {
        const needVal = parseFloat(item.need) || 0;
        const stockVal = parseFloat(item.stock) || 0;
        const toOrder = Math.max(0, needVal - stockVal);

        // Add to All Items list
        allItems.push({ ...item, toOrder });

        // Add to Supplier Groups if toOrder > 0
        if (toOrder > 0) {
            const supplier = item.fournisseur || "Autres";
            if (!groups[supplier]) groups[supplier] = [];
            groups[supplier].push({ ...item, toOrder });
        }

        // Add to Calpinage list if it has cuts or is a profile
        if (getIsProfil(item)) {
            calpinageItems.push({ ...item, toOrder });
        }
    });

    // Generate Tabs
    tabsContainer.innerHTML = '';

    // Helper to create tab
    const createTab = (id, label, data, type = 'bdc') => {
        const btn = document.createElement('div');
        btn.className = `export-tab`;
        btn.textContent = label;
        btn.onclick = () => {
            document.querySelectorAll('.export-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderBDCV2(id, data, chantier, type);
        };
        return btn;
    };

    // A. Special Tabs
    if (allItems.length > 0) {
        const tabAll = createTab('ALL', `TOUT LE CHANTIER (${allItems.length})`, allItems, 'list');
        tabsContainer.appendChild(tabAll);
    }

    if (calpinageItems.length > 0) {
        const tabCalp = createTab('CALP', `DÉTAIL CALPINAGE (${calpinageItems.length})`, calpinageItems, 'calpinage');
        tabsContainer.appendChild(tabCalp);
    }

    // Separator
    if (Object.keys(groups).length > 0) {
        const sep = document.createElement('div');
        sep.className = 'my-2 border-t border-zinc-200';
        tabsContainer.appendChild(sep);
        const title = document.createElement('div');
        title.className = 'px-4 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider';
        title.textContent = 'Par Fournisseur (Besoin > Stock)';
        tabsContainer.appendChild(title);
    }

    // B. Supplier Tabs
    const suppliers = Object.keys(groups).sort();
    suppliers.forEach(supplier => {
        const tab = createTab(supplier, `${supplier} (${groups[supplier].length})`, groups[supplier], 'bdc');
        tabsContainer.appendChild(tab);
    });

    // Default Selection
    const firstTab = tabsContainer.querySelector('.export-tab');
    if (firstTab) firstTab.click();

    // Show Modal
    modal.classList.remove('hidden');
}

function renderBDCV2(title, items, chantier, type) {
    const container = document.getElementById('exportPreview');
    const date = new Date().toLocaleDateString('fr-FR');

    let contentHtml = '';

    if (type === 'calpinage') {
        const calpRows = items.map(item => {
            let cutsHtml = '';
            if (item.cuts && item.cuts.length > 0) {
                var validCuts = item.cuts.filter(c => c > 0);
                if (validCuts.length > 0) {
                    cutsHtml = `
                        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
                            ${validCuts.map(c => `
                                <span style="padding: 2px 6px; background: #eee; border: 1px solid #ddd; border-radius: 4px; font-size: 10px;">
                                    ${c} ${item.unit_condit || 'mm'}
                                </span>
                            `).join('')}
                        </div>
                        ${item.chutes && item.chutes.length > 0 ? `
                            <div style="margin-top: 2px; font-size: 10px; color: #d66;">
                                Chutes: ${item.chutes.map(c => Math.round(c)).join(', ')}
                            </div>
                        ` : ''}
                    `;
                } else {
                    cutsHtml = `<span style="color: #999; font-style: italic; font-size: 10px;">Pas de coupe définie</span>`;
                }
            } else {
                cutsHtml = `<span style="color: #999; font-style: italic; font-size: 10px;">Pas de coupe définie</span>`;
            }

            return `
            <tr style="page-break-inside: avoid;">
                <td>
                    <div style="font-weight: bold;">${item.reference}</div>
                    <div style="font-size: 10px; color: #666;">${item.fournisseur}</div>
                </td>
                <td>
                    <div>${item.designation}</div>
                    <div style="font-size: 10px; color: #666;">${item.ral || '-'}</div>
                </td>
                <td style="text-align: center;">${item.longueur || '-'}</td>
                <td style="text-align: center; font-weight: bold;">${item.need}</td>
                <td>${cutsHtml}</td>
            </tr>`;
        }).join('');

        contentHtml = `
            <table class="bdc-table">
                <thead>
                    <tr>
                        <th style="width: 15%;">REF/FRN</th>
                        <th style="width: 30%;">DÉSIGNATION/RAL</th>
                        <th style="width: 10%; text-align: center;">LONG.</th>
                        <th style="width: 10%; text-align: center;">BESOIN</th>
                        <th>DÉTAIL DÉBITS (Coupes)</th>
                    </tr>
                </thead>
                <tbody>${calpRows}</tbody>
            </table>
        `;
    } else {
        // Standard BDC or Full List
        const rows = items.map(item => `
            <tr>
                <td>${item.reference}</td>
                <td>${item.designation}</td>
                <td>${item.ral || '-'}</td>
                <td>${item.conditionnement || '-'}</td>
                <td style="text-align: center;">${item.need}</td>
                <td style="text-align: center;">${item.stock}</td>
                <td style="text-align: center; font-weight: bold; color: ${item.toOrder > 0 ? '#000' : '#ccc'};">
                    ${item.toOrder}
                </td>
            </tr>
        `).join('');

        contentHtml = `
            <table class="bdc-table">
                <thead>
                    <tr>
                        <th style="width: 15%;">RÉFÉRENCE</th>
                        <th>DÉSIGNATION</th>
                        <th style="width: 10%;">RAL</th>
                        <th style="width: 15%;">CONDIT.</th>
                        <th style="width: 8%; text-align: center;">BESOIN</th>
                        <th style="width: 8%; text-align: center;">STOCK</th>
                        <th style="width: 8%; text-align: center;">CDE</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    container.innerHTML = `
        <div class="bdc-header">
            <div>
                <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 5px;">ARTS ALU</h1>
                <p style="font-size: 12px; color: #666;">${type === 'calpinage' ? 'DÉTAIL CALPINAGE' : (type === 'list' ? 'LISTE COMPLÈTE' : 'BON DE COMMANDE')}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-weight: bold; font-size: 14px;">CHANTIER : ${chantier}</p>
                <p style="font-size: 12px;">Date : ${date}</p>
            </div>
        </div>

        <div style="margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #999;">${type === 'bdc' ? 'FOURNISSEUR' : 'DOCUMENT'}</p>
            <h2 style="font-size: 18px; font-weight: 800;">${type === 'bdc' ? title : (title === 'ALL' ? 'Tout le Chantier' : 'Feuille de Débits ')}</h2>
        </div>

        ${contentHtml}

        <div style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid;">
            <div style="width: 40%; border-top: 1px solid #ccc; padding-top: 10px;">
                <p style="font-size: 10px; font-weight: bold;">Date et Signature ${type === 'bdc' ? 'Commandeur' : 'Chef Atelier'} :</p>
            </div>
            ${type === 'bdc' ? `
            <div style="width: 40%; border-top: 1px solid #ccc; padding-top: 10px; text-align: right;">
                <p style="font-size: 10px; font-weight: bold;">Bon pour accord :</p>
            </div>` : ''}
        </div>
    `;
}

// Map the new function to the export action
window.exportToCSV = openExportModalV2;


