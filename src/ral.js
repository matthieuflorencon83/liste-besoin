// ral.js — Gestion RAL / Finitions (ES6 Module)
import { AppState } from './store.js';

/* --- BATCH RAL MANAGEMENT --- */

let currentRalFamily = 'std';

window.toggleFinitionMode = function () {
    if (AppState.isRalSelectionMode) {
        const count = AppState.selectedNeeds.size;
        if (count > 0) {
            // Ouvrir la modale de sélection RAL
            openRalModal();
        } else {
            // Désactiver le mode sans rien faire
            AppState.isRalSelectionMode = false;
            AppState.selectedNeeds.clear();
            window.renderNeeds();
            updateRalModeUI();
        }
    } else {
        AppState.isRalSelectionMode = true;
        AppState.selectedNeeds.clear();
        window.renderNeeds();
        updateRalModeUI();
    }
};

window.toggleRalSelectionMode = function () {
    AppState.isRalSelectionMode = !AppState.isRalSelectionMode;
    if (!AppState.isRalSelectionMode) {
        AppState.selectedNeeds.clear();
    }
    updateRalModeUI();
    window.renderNeeds();
};

window.updateRalModeUI = updateRalModeUI;
function updateRalModeUI() {
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
        window.updateRalPreview('');
    }

    const finishSelect = document.getElementById('ralFinishSelect');
    if (finishSelect) {
        finishSelect.value = 'Brillant';
    }
}

window.closeRalModal = function () {
    document.getElementById('ralModal').classList.add('hidden');
}

window.applyRalToSelection = () => {
    try {
        const ralCode = document.getElementById('ralCodeInput').value.trim() || '-';
        const finish = document.getElementById('ralFinishSelect').value;
        const family = window.inferFamilyFromRal(ralCode);

        if (AppState.selectedNeeds.size === 0) return;

        let count = 0;
        AppState.needs.forEach(item => {
            // Ensure ID comparison is safe (String vs Number)
            if (AppState.selectedNeeds.has(String(item.id)) || AppState.selectedNeeds.has(item.id)) {
                item.ral = ralCode;
                item.ral_finish = finish;

                // --- Auto-Pricing & Attributes Logic ---
                // We find the matched variant object to update price, units and packaging
                const variantMatch = window.findVariantMatch(item, ralCode, finish, family);
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
        window.closeRalModal();
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
        targetDecor = 'WOOD';
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
