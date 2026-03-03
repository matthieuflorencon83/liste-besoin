window.saveProject = () => {
    const chantierVal = document.getElementById('chantierRef') ? document.getElementById('chantierRef').value : '';
    const defaultName = chantierVal ? `Projet_${chantierVal.replace(/[^a-z0-9]/gi, '_')}` : 'Projet_ArtsAlu';

    const data = {
        timestamp: new Date().toISOString(),
        chantier: chantierVal,
        needs: AppState.needs,
        favorites: AppState.favorites
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

    // Historique des projets récents
    try {
        const hist = JSON.parse(localStorage.getItem('art-project-history') || '[]');
        const entry = { name: defaultName, chantier: chantierVal, date: new Date().toISOString(), count: AppState.needs.length };
        const filtered = hist.filter(h => h.name !== entry.name);
        filtered.unshift(entry);
        localStorage.setItem('art-project-history', JSON.stringify(filtered.slice(0, 5)));
    } catch (e) { /* ignore */ }
};

window.saveChantier = (v) => {
    localStorage.setItem('art-chantier', v);
};

// Initialisation supprimée car le bouton est supprimé
// window.init();

// Initialize main button state
if (window.isCalpinageMode) {
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
    AppState.needs.forEach(item => {
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
        console.log("Toggle Finition Mode. Current:", AppState.isRalSelectionMode);

        // 1. If not in mode -> Enter mode
        if (!AppState.isRalSelectionMode) {
            toggleRalSelectionMode();
            // alert("Mode Finition ACTIVÉ");
            return;
        }

        // 2. If in mode
        const count = AppState.selectedNeeds.size;

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
    AppState.isRalSelectionMode = !AppState.isRalSelectionMode;
    // Clear selection when exiting
    if (!AppState.isRalSelectionMode) {
        AppState.selectedNeeds.clear();
    }
    updateRalModeUI();
    window.renderNeeds();
}


function updateRalModeUI() {
    console.log("Updating UI. Mode:", AppState.isRalSelectionMode);
    const btn = document.getElementById('ralModeBtn');
    const btnText = document.getElementById('ralBtnText');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    // Safety check if elements exist
    if (!btn || !btnText) return;

    if (AppState.isRalSelectionMode) {
        const count = AppState.selectedNeeds.size;

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
            const th = document.getElementById('thSelectAllCheck') || selectAllCheckbox.parentElement.parentElement;
            th.classList.remove('opacity-0', 'pointer-events-none');
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
            const th = document.getElementById('thSelectAllCheck') || selectAllCheckbox.parentElement.parentElement;
            th.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    // Sync Select All checkbox state
    if (selectAllCheckbox) {
        const count = AppState.selectedNeeds.size;
        selectAllCheckbox.checked = (AppState.needs.length > 0 && count === AppState.needs.length);
        selectAllCheckbox.indeterminate = (count > 0 && count < AppState.needs.length);
    }
}

// NEW FUNCTION
window.toggleNeedSelection = function (id, isChecked) {
    if (!AppState.isRalSelectionMode) return;

    // Ensure ID is string to match Map/Set keys
    const safeId = String(id);

    if (isChecked) {
        AppState.selectedNeeds.add(safeId);
    } else {
        AppState.selectedNeeds.delete(safeId);
    }

    // Update UI (Button text)
    updateRalModeUI();

    // Optional: Log for debug
    console.log("Selection updated:", AppState.selectedNeeds.size, AppState.selectedNeeds);
}

window.toggleSelectAll = function () {
    if (!AppState.isRalSelectionMode) return; // Only work in mode

    const allSelected = AppState.selectedNeeds.size === AppState.needs.length && AppState.needs.length > 0;
    AppState.selectedNeeds.clear();

    if (!allSelected) {
        AppState.needs.forEach((item) => AppState.selectedNeeds.add(String(item.id)));
    }

    window.renderNeeds();
    updateRalModeUI();
}

window.toggleSelection = function (idx) {
    if (!AppState.isRalSelectionMode) return;

    // Fix: Use ID instead of Index to match applyRalToSelection expectation
    const item = AppState.needs[idx];
    if (!item) return;
    const id = String(item.id);

    if (AppState.selectedNeeds.has(id)) {
        AppState.selectedNeeds.delete(id);
    } else {
        AppState.selectedNeeds.add(id);
    }
    window.renderNeeds();
    updateRalModeUI();
}

window.handleRowClick = function (e, idx) {
    if (AppState.isRalSelectionMode) {
        // If in mode, clicking anywhere toggles selection (unless clicking delete or edit specific inputs)
        // Also ignore checkbox to prevent double toggle (onchange handles it)
        if (e.target.closest('button') ||
            e.target.closest('input[type="number"]') ||
            e.target.closest('input[type="checkbox"]')) return;

        window.toggleSelection(idx);
        return; // Stop further processing (like expansion) if in selection mode
    }

    // Normal mode: Expand row for Calpinage (only if it's a profile)
    if (e.target.closest('button') || e.target.closest('input')) return;

    const item = AppState.needs[idx];
    if (item && window.getIsProfil && window.getIsProfil(item)) {
        window.toggleCalpinageRow(item.id);
    }
};


/* --- RAL MODAL --- */

// --- RAL COLORS MAPPING ---
const RAL_COLORS = {
    '1013': '#e3d9c6', '1015': '#e6d2b5', '2100': '#5e605d', '3004': '#6b3531',
    '7012': '#595f61', '7015': '#51565c', '7016': '#383e42', '7021': '#2f3234',
    '7022': '#4d4d4b', '7035': '#d7d7d7', '7039': '#6c6960', '8014': '#49392d',
    '8019': '#3d3635', '9005': '#0a0a0a', '9006': '#a5a5a5', '9007': '#8f8f8f',
    '9010': '#f3f1e9', '9016': '#f6f9f6', '9016EM': '#f6f9f6', '9010EM': '#f3f1e9'
};

window.updateRalPreview = (val) => {
    const code = val.trim().toUpperCase();
    const preview = document.getElementById('ralPreview');
    if (!preview) return;

    if (RAL_COLORS[code]) {
        preview.style.backgroundColor = RAL_COLORS[code];
        preview.innerHTML = '';
        // Add light/dark text contrast logic if needed, but for now simple block
    } else {
        preview.style.backgroundColor = '#27272a'; // Zinc-800
        preview.innerHTML = '<span class="text-xs text-zinc-600 font-mono">?</span>';
    }
};

window.inferFamilyFromRal = (ral) => {
    const r = ral.toUpperCase();
    if (['9010', '9016', '7016', '9005', '9010EM', '9016EM', '2100'].includes(r)) return 'std';
    if (r.startsWith('AN') || r.includes('NATUEL') || r.includes('INOX')) return 'anod';
    if (r.startsWith('CHENE') || r.includes('BOIS')) return 'wood';
    return 'other';
};

function openRalModal() {
    if (AppState.selectedNeeds.size === 0) return;

    document.getElementById('ralModalCount').textContent = AppState.selectedNeeds.size;
    document.getElementById('ralModal').classList.remove('hidden');

    // Reset inputs directly without using selectRalFamily
    const ralInput = document.getElementById('ralCodeInput');
    if (ralInput) {
        ralInput.value = '';
        updateRalPreview('');
    } else {
        console.warn('ralCodeInput not found');
    }

    const finishSelect = document.getElementById('ralFinishSelect');
    if (finishSelect) {
        finishSelect.value = 'Brillant';
    }
}

window.closeRalModal = function () {
    document.getElementById('ralModal').classList.add('hidden');
}

// selectRalFamily removed as requested




window.applyRalToSelection = () => {
    try {
        const ralCode = document.getElementById('ralCodeInput').value.trim() || '-';
        const finish = document.getElementById('ralFinishSelect').value;
        const family = inferFamilyFromRal(ralCode);

        if (AppState.selectedNeeds.size === 0) return;

        let count = 0;
        AppState.needs.forEach(item => {
            // Ensure ID comparison is safe (String vs Number)
            if (AppState.selectedNeeds.has(String(item.id)) || AppState.selectedNeeds.has(item.id)) {
                item.ral = ralCode;
                item.ral_finish = finish;

                // --- Auto-Pricing & Attributes Logic ---
                // We find the matched variant object to update price, units and packaging
                const variantMatch = findVariantMatch(item, ralCode, finish, family);
                if (variantMatch) {
                    item.px_public = Number(variantMatch.px_public || 0);
                    if (variantMatch.px_remise !== undefined && variantMatch.px_remise !== null) {
                        item.px_remise = Number(variantMatch.px_remise);
                    }

                    // Force complete price recalculation (removing user overridden pieces)
                    delete item.px_piece;

                    // Update packaging and unit attributes
                    const fields = ['unit_vente', 'condit', 'unit_condit', 'conditionnement', 'unite_qte', 'unite___prix', 'poids_kg', 'poids__kg_unit_'];
                    fields.forEach(f => {
                        if (variantMatch[f] !== undefined && variantMatch[f] !== null) {
                            item[f] = variantMatch[f];
                        }
                    });
                }

                count++;
            }
        });

        localStorage.setItem('art-needs', JSON.stringify(AppState.needs));

        // Reset Logic
        AppState.selectedNeeds.clear();
        AppState.isRalSelectionMode = false;
        closeRalModal();
        window.renderNeeds();
        alert(`${count} articles mis à jour avec la finition ${ralCode} (${finish}) et attributs recalculés.`);
    } catch (e) {
        console.error(e);
        alert("Erreur: " + e.message);
    }
};

/**
 * Finds the best variant object for an item based on the selected finish.
 * Strategy: Exact Match > Family Match > Fallback Specific
 */
window.findVariantMatch = (item, ralCode, finish, family) => {
    if (!AppState.catalogData) return null;

    // Filter all variants of this article (same reference, same supplier)
    const variants = AppState.catalogData.filter(it =>
        String(it.reference) === String(item.reference) &&
        (it.fournisseur === item.fournisseur || it.fabricant === item.fournisseur)
    );

    if (variants.length === 0) return null;

    // 1. Exact Match (e.g. User typed "9010", data has decor="9010")
    const exactMatch = variants.find(v => String(v.decor || '').toUpperCase() === String(ralCode).toUpperCase());
    if (exactMatch) return exactMatch;

    // 2. Composite Match (RAL + Finish, e.g. "9016" + "EM" -> "9016EM")
    if (finish) {
        const compositeCode = (String(ralCode) + String(finish)).toUpperCase();
        const compositeMatch = variants.find(v => String(v.decor || '').toUpperCase() === compositeCode);
        if (compositeMatch) return compositeMatch;

        if (finish === 'MG') {
            const mgPrefixCode = ('MG' + String(ralCode)).toUpperCase();
            const mgMatch = variants.find(v => String(v.decor || '').toUpperCase() === mgPrefixCode);
            if (mgMatch) return mgMatch;
        }
    }

    // 3. Family Mapping (Directly query the variants for 'STANDARD', 'SPECIFIQ', 'AS20', 'BT')
    let targetDecor = null;
    const rTrimmed = String(ralCode).toUpperCase().trim();

    if (['BT', 'BRUT', 'SANS'].includes(rTrimmed)) {
        targetDecor = 'BT';
    } else if (['9010', '9016', '7016', '9005', '9010EM', '9016EM', '2100'].includes(rTrimmed)) {
        targetDecor = 'STANDARD';
    } else if (rTrimmed.startsWith('AN') || rTrimmed.startsWith('AS') || rTrimmed.includes('NATUEL') || rTrimmed.includes('INOX')) {
        targetDecor = 'AS20';
    } else if (rTrimmed.startsWith('CHENE') || rTrimmed.includes('BOIS')) {
        targetDecor = 'WOOD'; // Unlikely to find in Arcelor, but just in case
    } else {
        targetDecor = 'SPECIFIQ';
    }

    // Attempt to find the matching family in the variants
    let familyMatch = variants.find(v => {
        const d = String(v.decor || '').toUpperCase().trim();
        if (targetDecor === 'STANDARD') return d === 'STANDARD' || d === 'TARIF STANDARD' || d === '9010';
        if (targetDecor === 'SPECIFIQ') return d === 'SPECIFIQ' || d === 'TARIF SPÉCIFIQUE' || d === 'TARIF SPECIFIQUE';
        if (targetDecor === 'AS20') return d === 'AS20' || d === 'AN0001' || d === 'AS';
        if (targetDecor === 'BT') return d === 'BT' || d === 'BRUT';
        return d === targetDecor;
    });

    // Fallbacks
    if (!familyMatch && targetDecor === 'STANDARD') {
        // If Standard not found, fallback to Specifique
        familyMatch = variants.find(v => {
            const d = String(v.decor || '').toUpperCase().trim();
            return d === 'SPECIFIQ' || d === 'TARIF SPÉCIFIQUE' || d === 'TARIF SPECIFIQUE';
        });
    }

    if (familyMatch) {
        return familyMatch;
    }

    return null;
};


// Supprimé : fonction en double (la bonne est dans state.js)

// ... existing export functions ...

/* --- EXPORT / ORDER FORM SYSTEM V2 --- */
// Les fonctions openExportModalV2 et renderBDCV2 ont été migrées vers export.js



// Les fonctions de la modale d'ajout manuel ont été déplacées vers modals.js




// ============================================================
// HELPERS POUR LE PRIX DE LA PIÈCE
// ============================================================
window.getPuPiece = function (item) {
    if (item.px_piece !== undefined) return parseFloat(item.px_piece) || 0;

    // Rétro-compatibilité V142+ pour les articles en cache qui n'ont pas px_remise
    if (item.px_remise === undefined && AppState.catalogData) {
        const catItem = AppState.catalogData.find(a => String(a.reference) === String(item.reference) && String(a.decor || '') === String(item.ral || ''));
        if (catItem) {
            item.px_remise = catItem.px_remise || catItem.px_public || 0;
            if (AppState.needs) localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
        } else {
            item.px_remise = item.px_public || 0;
        }
    }

    const mult = window.getMult(item);
    const px_base = parseFloat(item.px_remise) || parseFloat(item.px_public) || 0;
    return px_base * mult;
};

window.getMult = function (item) {
    const conditVal = parseFloat(item.longueur) || parseFloat(item.conditionnement) || 1;
    // Analyse l'unité prix en testant tous les champs possibles
    const u = String(item.unite___prix || item.unite_qte || item.unit_condit || item.unit_vente || '').toUpperCase();

    // Directive utilisateur : "ca doit etre le prix remisé x par le conditionnement"
    // Par exemple, même si l'unité est "BARRE", "UN" ou "M", appliquer le conditionnement comme multiplicateur
    return conditVal;
};

window.renderNeeds = function () {
    const tbody = document.getElementById('needsTableBody');
    if (!tbody) return;

    // Handle header checkbox visibility
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const th = document.getElementById('thSelectAllCheck') || selectAllCheckbox.parentElement.parentElement;
        if (AppState.isRalSelectionMode) {
            th.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            th.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    // Mettre à jour le badge de l'onglet Besoins
    const badge = document.getElementById('needsBadge');
    if (badge) {
        const count = AppState.needs.length;
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }

    // Base data
    let displayedNeeds = AppState.needs;

    // Tri par colonne si actif
    const sortCol = AppState.needsSortCol;
    const sortDir = AppState.needsSortDir || 'asc';
    let sortedNeeds = [...displayedNeeds];
    if (sortCol) {
        sortedNeeds.sort((a, b) => {
            let va, vb;
            if (sortCol === 'need' || sortCol === 'stock' || sortCol === 'px_public') {
                va = parseFloat(a[sortCol]) || 0;
                vb = parseFloat(b[sortCol]) || 0;
            } else {
                va = (a[sortCol] || '').toString().toLowerCase();
                vb = (b[sortCol] || '').toString().toLowerCase();
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    tbody.innerHTML = sortedNeeds.map((item, index) => {
        // Retrouver l'index réel dans AppState.needs pour les actions
        const realIndex = AppState.needs.indexOf(item);
        const isSelected = AppState.selectedNeeds.has(String(item.id));
        const ref = item.reference || '-';
        const des = item.designation || '-';

        // Indicateur de couverture besoin/stock
        const need = parseFloat(item.need) || 0;
        const stock = parseFloat(item.stock) || 0;
        let coverageIndicator = '';
        if (need > 0) {
            if (stock >= need) {
                coverageIndicator = 'border-l-emerald-500'; // vert = couvert
            } else if (stock > 0) {
                coverageIndicator = 'border-l-amber-500';  // orange = partiel
            } else {
                coverageIndicator = 'border-l-red-500';    // rouge = rien en stock
            }
        }

        let ralDisplay = '<span class="text-[var(--text-muted)]">-</span>';
        if (item.ral) {
            const finishLabel = item.ral_finish ? ` <span class="text-[9px] text-[var(--text-muted)] font-normal">${item.ral_finish}</span>` : '';
            ralDisplay = `<span class="font-bold text-[var(--text-main)] text-xs">${item.ral}</span>${finishLabel}`;
        } else if (item.decor) {
            ralDisplay = `<span class="text-[var(--text-muted)]">${item.decor}</span>`;
        }

        const bgOddEven = index % 2 === 0 ? 'bg-[var(--border)]' : '';
        const rowBg = isSelected
            ? 'bg-[var(--indigo-soft)]'
            : `${bgOddEven} hover:bg-[var(--card-hover)] border-b border-[var(--border)] last:border-0`;

        // Classe de la bordure gauche (indicateur couverture ou sélection)
        const borderLeft = isSelected ? 'border-l-indigo-500' : (coverageIndicator || 'border-l-transparent');

        // Checkbox column cell
        const checkboxCellClass = AppState.isRalSelectionMode
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none';

        return `
        <tr onclick="window.handleRowClick(event, ${realIndex})" 
            class="group transition-all cursor-pointer ${rowBg} border-l-2 ${borderLeft}">

            <!-- # (numéro de ligne) -->
            <td class="p-2 w-8 text-center text-[10px] font-black text-[var(--text-muted)] select-none">${index + 1}</td>
            
            <!-- CHECKBOX -->
            <td class="text-center p-2 w-12 transition-opacity ${checkboxCellClass}">
                <div class="flex items-center justify-center w-12 mx-auto">
                    <input type="checkbox" 
                        onchange="window.toggleSelection(${realIndex})" 
                        ${isSelected ? 'checked' : ''} 
                        class="w-4 h-4 rounded border-[var(--border)] bg-[var(--card)] text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600">
                </div>
            </td>

            <!-- SUPPLIER -->
            <td class="p-4 w-32">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-8 rounded-full bg-[var(--indigo)] opacity-50"></div>
                    <span class="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">${item.fournisseur || 'AUTRE'}</span>
                </div>
            </td>

            <!-- REFERENCE -->
            <td class="p-4 w-48 font-mono text-[var(--indigo)] font-bold">${ref}</td>

            <!-- IMAGE -->
            <td class="p-2 w-16 text-center" onclick="event.stopPropagation()">
                ${item.image
                ? `<img src="${item.image}" class="w-12 h-12 object-contain rounded-lg bg-white p-1 cursor-pointer hover:scale-150 transition-transform shadow-sm" onclick="window.openVisualizer('${item.image}', event)" title="Agrandir l'image">`
                : `<div class="w-12 h-12 bg-[var(--card)] rounded-lg border border-white/5 flex items-center justify-center" title="Pas d'image"><i data-lucide="image-off" class="w-4 h-4 text-[var(--text-muted)] opacity-30"></i></div>`
            }
            </td>

            <!-- DESIGNATION -->
            <td class="p-4">
                <div class="text-sm font-medium text-[var(--text-main)] line-clamp-2">${des}</div>
            </td>

            <!-- RAL / FINISH -->
            <td class="p-4 w-24">
                ${ralDisplay}
            </td>

            <!-- P.U. PIÈCE HT (Remisé) — Éditable inline -->
            <td class="p-2 w-28 text-right" onclick="event.stopPropagation()">
                <div class="inline-flex items-center justify-end gap-1 group cursor-text rounded-lg px-2 py-1 hover:bg-[var(--card-hover)] transition-colors">
                    <input type="number"
                        step="0.01" min="0"
                        value="${window.getPuPiece(item).toFixed(2)}"
                        onclick="event.stopPropagation(); this.select()"
                        onchange="window.saveNeedField(${realIndex}, 'px_piece', parseFloat(this.value) || 0)"
                        class="w-20 bg-transparent border-none text-right font-mono text-[var(--emerald)] focus:text-[var(--text-main)] focus:outline-none focus:ring-0 p-0 cursor-text
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        title="Cliquer pour modifier le prix de la pièce">
                    <span class="text-[var(--text-muted)] text-[10px] uppercase font-bold group-focus-within:text-[var(--text-main)]">€ / PCE</span>
                </div>
                ${(() => {
                const mult = window.getMult(item);
                if (mult > 1) {
                    const puBase = window.getPuPiece(item) / mult;
                    const u = String(item.unit_condit || item.unit_vente || '').toUpperCase();
                    return `<div class="text-[9px] text-[var(--text-muted)] mt-1 mr-2 text-right">soit ${puBase.toFixed(2)} € / ${u}</div>`;
                }
                return '';
            })()}
            </td>

            <!-- CONDIT -->
            <td class="p-4 w-28 text-center">
               <div class="text-xs text-[var(--text-muted)] font-mono font-bold">${item.longueur || item.conditionnement || 1} ${String(item.unit_condit || item.unit_vente || 'U').toUpperCase()}</div>
            </td>

            <!-- BESOIN — Éditable inline PREMIUM (Sprint 7) -->
            <td class="p-2 w-32 text-center" onclick="event.stopPropagation()">
                <div class="inline-flex items-center justify-center gap-2">
                    <button onclick="event.stopPropagation(); window.adjustNeedField(${realIndex}, 'need', -1)"
                        class="w-6 h-6 rounded-md bg-[var(--card-hover)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all flex items-center justify-center text-sm font-black leading-none shrink-0">-</button>
                    <input type="number"
                        min="0"
                        value="${item.need || 0}"
                        id="needInput_${realIndex}"
                        onclick="event.stopPropagation(); this.select()"
                        onchange="window.saveNeedField(${realIndex}, 'need', parseInt(this.value) || 0)"
                        class="w-12 text-center font-black text-[var(--text-main)] bg-[var(--card)] border border-[var(--border)] rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all p-1 text-sm
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none">
                    <button onclick="event.stopPropagation(); window.adjustNeedField(${realIndex}, 'need', +1)"
                        class="w-6 h-6 rounded-md bg-[var(--card-hover)] hover:bg-indigo-600 text-[var(--text-muted)] hover:text-white transition-all flex items-center justify-center text-sm font-black leading-none">+</button>
                </div>
            </td>

            <!-- STOCK — Éditable inline PREMIUM (Sprint 7) -->
            <td class="p-2 w-32 text-center" onclick="event.stopPropagation()">
                <div class="inline-flex items-center justify-center gap-2">
                    <button onclick="event.stopPropagation(); window.adjustNeedField(${realIndex}, 'stock', -1)"
                        class="w-6 h-6 rounded-md bg-[var(--card-hover)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all flex items-center justify-center text-sm font-black leading-none shrink-0">-</button>
                    <input type="number"
                        min="0"
                        value="${item.stock || 0}"
                        id="stockInput_${realIndex}"
                        onclick="event.stopPropagation(); this.select()"
                        onchange="window.saveNeedField(${realIndex}, 'stock', parseInt(this.value) || 0)"
                        class="w-12 text-center font-mono text-[var(--emerald)] bg-[var(--card)] border border-[var(--border)] rounded-lg focus:border-[var(--emerald)] focus:ring-1 focus:ring-[var(--emerald)] outline-none transition-all p-1 text-sm
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none">
                    <button onclick="event.stopPropagation(); window.adjustNeedField(${realIndex}, 'stock', +1)"
                        class="w-6 h-6 rounded-md bg-[var(--card-hover)] hover:bg-emerald-700 text-[var(--text-muted)] hover:text-white transition-all flex items-center justify-center text-sm font-black leading-none">+</button>
                </div>
            </td>

            <!-- ORDER -->
            <td class="p-4 w-24 text-center">
                <span class="text-[var(--emerald)] font-bold font-mono">${Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0))}</span>
            </td>

            <!-- TOTAL HT -->
            <td class="p-4 w-20 text-right">
                ${(() => {
                const toOrder = Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0));
                const prixU = window.getPuPiece(item);
                const isPriceEstimated = window.isEstimatedPrice ? window.isEstimatedPrice(item) : false;
                const totalHT = toOrder * prixU;
                const star = isPriceEstimated ? '*' : '';

                if (totalHT > 0) return `<span class="font-black text-[var(--amber)] text-xs">${totalHT.toFixed(2)} €${star}</span>`;
                return `<span class="text-[var(--text-muted)] text-xs">—</span>`;
            })()}
            </td>


            <!-- ACTIONS : menu déroulant -->
            <td class="p-2 w-16 text-right relative">
                <button onclick="event.stopPropagation(); window.toggleNeedsActionMenu(${realIndex})" 
                    class="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--card-hover)] rounded-lg transition-colors inline-block" title="Actions">
                    <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
                
                <!-- Menu dropdown -->
                <div id="needsActionMenu_${realIndex}" class="hidden absolute right-10 top-1/2 -translate-y-1/2 z-50 min-w-[160px] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-1 overflow-hidden" onclick="event.stopPropagation()">
                    <button onclick="window.showArticleCard(${realIndex}); window.toggleNeedsActionMenu(${realIndex})" class="w-full px-4 py-2 text-left text-[11px] font-bold tracking-wide uppercase text-[var(--text-muted)] hover:text-[var(--indigo)] hover:bg-[var(--indigo-soft)] flex items-center gap-3 transition-colors">
                        <i data-lucide="info" class="w-4 h-4"></i> Fiche technique
                    </button>
                    <button onclick="window.toggleNoteRow(${realIndex}); window.toggleNeedsActionMenu(${realIndex})" class="w-full px-4 py-2 text-left text-[11px] font-bold tracking-wide uppercase ${item.note ? 'text-[var(--amber)]' : 'text-[var(--text-muted)] hover:text-[var(--amber)]'} hover:bg-[var(--emerald-soft)] flex items-center gap-3 transition-colors">
                        <i data-lucide="${item.note ? 'message-square' : 'message-square-plus'}" class="w-4 h-4"></i> Note
                    </button>
                    <button onclick="window.duplicateNeed(${realIndex}); window.toggleNeedsActionMenu(${realIndex})" class="w-full px-4 py-2 text-left text-[11px] font-bold tracking-wide uppercase text-[var(--text-muted)] hover:text-[var(--emerald)] hover:bg-[var(--emerald-soft)] flex items-center gap-3 transition-colors">
                        <i data-lucide="copy" class="w-4 h-4"></i> Dupliquer
                    </button>
                    <div class="h-px bg-[var(--border)] my-1"></div>
                    <button onclick="window.deleteNeed(${realIndex}); window.toggleNeedsActionMenu(${realIndex})" class="w-full px-4 py-2 text-left text-[11px] font-bold tracking-wide uppercase text-[var(--rose)] hover:bg-rose-500/10 flex items-center gap-3 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i> Supprimer
                    </button>
                </div>
            </td>
        </tr>

        <!-- NOTE ROW -->
        <tr id="noteRow_${realIndex}" class="${item.note || window.activeNoteRow === realIndex ? '' : 'hidden'} bg-[var(--emerald-soft)] border-b border-[var(--border)]">
            <td colspan="12" class="px-6 py-3">
                <div class="flex items-start gap-3">
                    <i data-lucide="message-square" class="w-4 h-4 text-amber-400 mt-1 shrink-0"></i>
                    <textarea
                        id="noteInput_${realIndex}"
                        onclick="event.stopPropagation()"
                        onchange="window.saveNote(${realIndex}, this.value)"
                        placeholder="Ajouter une note ou un commentaire sur cet article..."
                        class="flex-1 bg-transparent border-none resize-none text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:ring-0 outline-none leading-relaxed min-h-[2rem]"
                        rows="2">${item.note || ''}</textarea>
                </div>
            </td>
        </tr>

        <!-- EXPANSION ROW FOR CALPINAGE -->
        <tr id="calpRow_${realIndex}" class="${(window.activeCalpinageId === String(item.id) || (window.isCalpinageMode && window.getIsProfil && window.getIsProfil(item))) ? '' : 'hidden'} bg-[var(--card-hover)] border-b border-[var(--border)]">
            <td colspan="12" class="p-0">
                <div id="calpContainer_${realIndex}" class="p-4 border-l-2 border-orange-500"></div>
            </td>
        </tr>
        `;
    }).join('');

    // Re-init icons — ciblé sur tbody uniquement (optimisation Sprint 4)
    if (typeof lucide !== 'undefined') {
        const tbody = document.getElementById('needsTableBody');
        if (tbody) lucide.createIcons({ nameAttr: 'data-lucide', nodes: [tbody] });
    }

    // Auto-init Calpinage if Global Mode or specific active
    if (window.CalpinageSystem && AppState.needs) {
        AppState.needs.forEach((it, i) => {
            if (window.activeCalpinageId === String(it.id) || (window.isCalpinageMode && window.getIsProfil && window.getIsProfil(it))) {
                setTimeout(() => window.CalpinageSystem.initRow(i), 10);
            }
        });
    }

    updateRalModeUI();

    // Ligne de total général
    const totalNeed = AppState.needs.reduce((s, i) => s + (parseFloat(i.need) || 0), 0);
    const totalCde = AppState.needs.reduce((s, i) => s + Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0)), 0);
    const totalHT = AppState.needs.reduce((s, i) => {
        const cde = Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0));
        return s + cde * window.getPuPiece(i);
    }, 0);

    // Injecter ou mettre à jour la ligne de totaux sous le tableau
    let totalRow = document.getElementById('needsTotalRow');
    if (!totalRow) {
        const table = document.querySelector('#needsTableBody')?.closest('table');
        if (table) {
            let tfoot = table.querySelector('tfoot');
            if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
            tfoot.innerHTML = `<tr id="needsTotalRow" class="border-t-2 border-[var(--border)] bg-[var(--card-hover)]">
                <td colspan="9" class="px-4 py-3 text-right text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                    ${AppState.needs.length} article${AppState.needs.length > 1 ? 's' : ''}
                </td>
                <td class="p-3 text-center text-xs font-black text-[var(--text-main)]">${totalNeed}</td>
                <td class="p-3 text-center text-xs text-[var(--text-muted)]">—</td>
                <td class="p-3 text-center text-xs font-black text-emerald-500">${totalCde}</td>
                <td class="p-3 text-right text-sm font-black text-amber-500">${totalHT.toFixed(2)} €</td>
                <td></td>
            </tr>`;
        }
    } else {
        totalRow.innerHTML = `
            <td colspan="9" class="px-4 py-3 text-right text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                ${AppState.needs.length} article${AppState.needs.length > 1 ? 's' : ''}
            </td>
            <td class="p-3 text-center text-xs font-black text-[var(--text-main)]">${totalNeed}</td>
            <td class="p-3 text-center text-xs text-[var(--text-muted)]">—</td>
            <td class="p-3 text-center text-xs font-black text-emerald-500">${totalCde}</td>
            <td class="p-3 text-right text-sm font-black text-amber-500">${totalHT.toFixed(2)} €</td>
            <td></td>
        `;
    }
}



// ============================================================
// SPRINT 3 — NOTES PAR LIGNE
// ============================================================
window.toggleNoteRow = function (realIndex) {
    if (window.activeNoteRow === realIndex) {
        window.activeNoteRow = null;
    } else {
        window.activeNoteRow = realIndex;
    }
    window.renderNeeds();
    // Focus sur la textarea après rendu
    if (window.activeNoteRow !== null) {
        setTimeout(() => {
            const ta = document.getElementById(`noteInput_${realIndex}`);
            if (ta) ta.focus();
        }, 50);
    }
};

window.saveNote = function (realIndex, value) {
    if (AppState.needs[realIndex]) {
        AppState.needs[realIndex].note = value.trim();
        localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
        // Mettre à jour l'icône du bouton sans re-render complet
        const noteBtn = document.querySelector(`#noteRow_${realIndex}`)?.previousElementSibling?.querySelector('[title="Note"]');
        // simple re-render ciblé
        window.renderNeeds();
    }
};

// Les fonctions showArticleCard et closeArticleCard ont été déplacées vers modals.js

// Les fonctions openBudgetChart et closeBudgetChart ont été déplacées vers modals.js

// ============================================================
// SPRINT 7 — ÉDITION INLINE (saveNeedField + adjustNeedField)
// ============================================================

// Sauvegarde un champ modifié directement dans AppState.needs
// et met à jour les totaux en bas du tableau sans re-render complet
let _saveNeedDebounceTimer = null;
window.saveNeedField = function (realIndex, field, value) {
    if (!AppState.needs[realIndex]) return;
    AppState.needs[realIndex][field] = value;
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));

    // Mettre à jour la ligne ORDER et TOTAL HT en live sans re-render global
    clearTimeout(_saveNeedDebounceTimer);
    _saveNeedDebounceTimer = setTimeout(() => {
        window.renderNeeds();
    }, 600);
};

// Incrémentation +/- fluide (boutons +/-)
window.adjustNeedField = function (realIndex, field, delta) {
    if (!AppState.needs[realIndex]) return;
    const current = parseFloat(AppState.needs[realIndex][field]) || 0;
    const newVal = Math.max(0, current + delta);
    AppState.needs[realIndex][field] = (field === 'px_public' || field === 'px_piece') ? newVal : Math.round(newVal);
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));

    // MAJ directe du champ input sans re-render
    const inputId = field === 'need' ? `needInput_${realIndex}` : `stockInput_${realIndex}`;
    const input = document.getElementById(inputId);
    if (input) input.value = AppState.needs[realIndex][field];

    // Re-render avec debounce court pour les totaux
    clearTimeout(_saveNeedDebounceTimer);
    _saveNeedDebounceTimer = setTimeout(() => {
        window.renderNeeds();
    }, 500);
};

// Afficher ou masquer le menu d'actions (3 petits points)
window.toggleNeedsActionMenu = function (realIndex) {
    const allMenus = document.querySelectorAll('[id^="needsActionMenu_"]');
    const targetMenu = document.getElementById(`needsActionMenu_${realIndex}`);

    // Fermer tous les autres
    allMenus.forEach(m => {
        if (m !== targetMenu) m.classList.add('hidden');
    });

    // Basculer celui-ci
    if (targetMenu) {
        targetMenu.classList.toggle('hidden');
    }
};

// Fermer les menus si clic en dehors
document.addEventListener('click', function (e) {
    const menus = document.querySelectorAll('[id^="needsActionMenu_"]');
    menus.forEach(m => {
        if (!m.contains(e.target)) {
            m.classList.add('hidden');
        }
    });
});

// ============================================================
// SPRINT 5 — DUPLICATION DE LIGNE
// ============================================================
window.duplicateNeed = function (realIndex) {
    const original = AppState.needs[realIndex];
    if (!original) return;
    const copy = { ...original, id: original.id + '_copy_' + Date.now(), note: '' };
    AppState.needs.splice(realIndex + 1, 0, copy);
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
    window.renderNeeds();
};

// ============================================================
// SPRINT 5 — TRI PAR COLONNE (appelé depuis les headers)
// ============================================================
window.sortNeedsBy = function (col) {
    if (AppState.needsSortCol === col) {
        AppState.needsSortDir = AppState.needsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        AppState.needsSortCol = col;
        AppState.needsSortDir = 'asc';
    }
    // Mettre à jour les indicateurs visuels des headers
    document.querySelectorAll('[data-sort-col]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (th.dataset.sortCol === col) {
            icon.textContent = AppState.needsSortDir === 'asc' ? ' ↑' : ' ↓';
            th.classList.add('text-indigo-400');
        } else {
            icon.textContent = '';
            th.classList.remove('text-indigo-400');
        }
    });
    window.renderNeeds();
};

// Les fonctions d'historique de projet ont été déplacées vers modals.js

// ============================================================
// SPRINT 5 — RACCOURCIS CLAVIER
// ============================================================
document.addEventListener('keydown', function (e) {
    // Ignorer si focus dans un input ou textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
    }

    // Ctrl+S — Sauvegarder le projet
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        window.saveProject();
        // Flash visuel
        const btn = document.querySelector('[onclick="window.saveProject()"]');
        if (btn) { btn.classList.add('ring-2', 'ring-emerald-500'); setTimeout(() => btn.classList.remove('ring-2', 'ring-emerald-500'), 800); }
        return;
    }

    // Ctrl+F — Focus sur la barre de recherche active
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const needsVisible = !document.getElementById('needsListView')?.classList.contains('hidden');
        if (needsVisible) {
            document.getElementById('needsSearch')?.focus();
        } else {
            document.getElementById('globalSearch')?.focus();
        }
        return;
    }

    // Échap — Fermer toutes les modales ouvertes
    if (e.key === 'Escape') {
        ['exportModal', 'ralModal', 'manualAddModal', 'imageModal', 'articleCardModal', 'budgetChartModal', 'projectHistoryPanel'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
        });
        return;
    }
});

// Fin ui.js
