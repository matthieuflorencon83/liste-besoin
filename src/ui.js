window.saveProject = () => {
    const chantierVal = document.getElementById('chantierRef') ? document.getElementById('chantierRef').value : '';
    const defaultName = chantierVal ? `Projet_${chantierVal.replace(/[^a-z0-9]/gi, '_')}` : 'Projet_ArtsAlu';

    // Prompt handled by browser "Save As" usually, but we can set default name
    // To strictly force "Save As" dialog in some browsers requires stream saver or checking browser settings,
    // but 'download' attribute is the standard web way.

    const data = {
        timestamp: new Date().toISOString(),
        chantier: chantierVal,
        needs: window.needs,
        favorites: window.favorites
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
    window.needs.forEach(item => {
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
        console.log("Toggle Finition Mode. Current:", window.isRalSelectionMode);

        // 1. If not in mode -> Enter mode
        if (!window.isRalSelectionMode) {
            toggleRalSelectionMode();
            // alert("Mode Finition ACTIVÉ");
            return;
        }

        // 2. If in mode
        const count = window.selectedNeeds.size;

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
    window.isRalSelectionMode = !window.isRalSelectionMode;
    // Clear selection when exiting
    if (!window.isRalSelectionMode) {
        window.selectedNeeds.clear();
    }
    updateRalModeUI();
    window.renderNeeds();
}


function updateRalModeUI() {
    console.log("Updating UI. Mode:", window.isRalSelectionMode);
    const btn = document.getElementById('ralModeBtn');
    const btnText = document.getElementById('ralBtnText');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    // Safety check if elements exist
    if (!btn || !btnText) return;

    if (window.isRalSelectionMode) {
        const count = window.selectedNeeds.size;

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
        const count = window.selectedNeeds.size;
        selectAllCheckbox.checked = (window.needs.length > 0 && count === window.needs.length);
        selectAllCheckbox.indeterminate = (count > 0 && count < window.needs.length);
    }
}

// NEW FUNCTION
window.toggleNeedSelection = function (id, isChecked) {
    if (!window.isRalSelectionMode) return;

    // Ensure ID is string to match Map/Set keys
    const safeId = String(id);

    if (isChecked) {
        window.selectedNeeds.add(safeId);
    } else {
        window.selectedNeeds.delete(safeId);
    }

    // Update UI (Button text)
    updateRalModeUI();

    // Optional: Log for debug
    console.log("Selection updated:", window.selectedNeeds.size, window.selectedNeeds);
}

window.toggleSelectAll = function () {
    if (!window.isRalSelectionMode) return; // Only work in mode

    const allSelected = window.selectedNeeds.size === window.needs.length && window.needs.length > 0;
    window.selectedNeeds.clear();

    if (!allSelected) {
        window.needs.forEach((item) => window.selectedNeeds.add(String(item.id)));
    }

    window.renderNeeds();
    updateRalModeUI();
}

window.toggleSelection = function (idx) {
    if (!window.isRalSelectionMode) return;

    // Fix: Use ID instead of Index to match applyRalToSelection expectation
    const item = window.needs[idx];
    if (!item) return;
    const id = String(item.id);

    if (window.selectedNeeds.has(id)) {
        window.selectedNeeds.delete(id);
    } else {
        window.selectedNeeds.add(id);
    }
    window.renderNeeds();
    updateRalModeUI();
}

window.handleRowClick = function (e, idx) {
    if (window.isRalSelectionMode) {
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

    const item = window.needs[idx];
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
    if (window.selectedNeeds.size === 0) return;

    document.getElementById('ralModalCount').textContent = window.selectedNeeds.size;
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

        if (window.selectedNeeds.size === 0) return;

        let count = 0;
        window.needs.forEach(item => {
            // Ensure ID comparison is safe (String vs Number)
            if (window.selectedNeeds.has(String(item.id)) || window.selectedNeeds.has(item.id)) {
                item.ral = ralCode;
                item.ral_finish = finish;

                // --- Auto-Pricing Logic ---
                // We need to find the best price match for this new finish
                // We pass the RAW ralCode logic (entered by user), the chosen finish (EM, MG, etc), and family info
                const newPrice = findVariantPrice(item, ralCode, finish, family);
                if (newPrice !== null) {
                    item.px_public = newPrice;
                }

                count++;
            }
        });

        localStorage.setItem('art-needs', JSON.stringify(window.needs));

        // Reset Logic
        window.selectedNeeds.clear();
        window.isRalSelectionMode = false;
        closeRalModal();
        window.renderNeeds();
        alert(`${count} articles mis à jour avec la finition ${ralCode} (${finish}) et prix recalculés.`);
    } catch (e) {
        console.error(e);
        alert("Erreur: " + e.message);
    }
};

/**
 * Finds the best price for an item based on the selected finish.
 * Strategy: Exact Match > Family Match > Fallback Markup
 */
window.findVariantPrice = (item, ralCode, finish, family) => {
    if (!window.ART_DATA) return null;

    // 1. Identify the 'Root' reference (remove suffixes like TH if needed, though data.js usually has specific refs)
    // Actually, data.js has 'reference' like '7637TH'. We should look for other items with SAME reference
    // but DIVERGENT 'decor'.

    // Filter all variants of this article (same reference, same supplier)
    const variants = window.ART_DATA.filter(it =>
        String(it.reference) === String(item.reference) &&
        (it.fournisseur === item.fournisseur || it.fabricant === item.fournisseur)
    );

    if (variants.length === 0) return null;

    // 2. Exact Match (e.g. User typed "9010", data has decor="9010")
    // We treat 'ralCode' as the target decor.
    const exactMatch = variants.find(v => String(v.decor || '').toUpperCase() === String(ralCode).toUpperCase());
    if (exactMatch) return Number(exactMatch.px_public || 0);

    // 2b. Composite Match (RAL + Finish, e.g. "9016" + "EM" -> "9016EM")
    if (finish) {
        // Try strict concatenation (e.g. 9016EM)
        const compositeCode = (String(ralCode) + String(finish)).toUpperCase();
        const compositeMatch = variants.find(v => String(v.decor || '').toUpperCase() === compositeCode);
        if (compositeMatch) return Number(compositeMatch.px_public || 0);

        // Try with MG prefix if it's MG (e.g. MG7016) because sometimes it's reversed
        if (finish === 'MG') {
            const mgPrefixCode = ('MG' + String(ralCode)).toUpperCase();
            const mgMatch = variants.find(v => String(v.decor || '').toUpperCase() === mgPrefixCode);
            if (mgMatch) return Number(mgMatch.px_public || 0);
        }
    }

    // 3. Family Mapping (Standard -> Look for 9010, etc)
    let targetDecor = null;
    if (family === 'std') targetDecor = '9010'; // Standard often priced as 9010
    else if (family === 'anod') targetDecor = 'AN0001'; // Anodisé often priced as AN0001 or AS20
    else if (family === 'other') targetDecor = '9016EM'; // 'Other' often priced like Laqué Plus (9016EM)

    if (targetDecor) {
        const familyMatch = variants.find(v => String(v.decor || '').toUpperCase() === targetDecor);
        if (familyMatch) return Number(familyMatch.px_public || 0);

        // Try fallback for Anodisé (AS20) if AN0001 failed
        if (family === 'anod') {
            const altAnod = variants.find(v => String(v.decor || '').toUpperCase() === 'AS20');
            if (altAnod) return Number(altAnod.px_public || 0);
        }
        // Try fallback for Other (SPECIFIQ) if 9016EM failed
        if (family === 'other') {
            const altSpec = variants.find(v => String(v.decor || '').toUpperCase() === 'SPECIFIQ');
            if (altSpec) return Number(altSpec.px_public || 0);
        }
    }

    // 4. If no variant found (Article Unique ?), apply Markup on Base Price
    // We assume the current price in 'variants' might be one of them.
    // Let's try to find a "Brut" or "BT" variant to use as base, otherwise use the item's current price (risky if already laqué).

    const brutVariant = variants.find(v => ['BT', 'BRUT', 'SANS'].includes(String(v.decor || '').toUpperCase())) || variants[0];
    const basePrice = Number(brutVariant.px_public || 0);

    if (basePrice > 0) {
        if (family === 'std') return basePrice * 1.05; // +5%
        if (family === 'other') return basePrice * 1.15; // +15%
        if (family === 'anod') return basePrice * 1.25; // +25%
        if (family === 'wood') return basePrice * 1.40; // +40%
    }

    return item.px_public; // No change if we can't calculate
};


// Supprimé : fonction en double (la bonne est dans state.js)

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

    window.needs.forEach(item => {
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
        if (window.getIsProfil(item)) {
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
        const isBdc = type === 'bdc';

        const rows = items.map(item => `
            <tr>
                <td>${item.reference}</td>
                <td>${item.designation}</td>
                <td>${item.ral || '-'}</td>
                <td>${item.longueur || '-'} ${item.unit_condit || ''}</td>
                ${!isBdc ? `<td style="text-align: center;">${item.need}</td>` : ''}
                ${!isBdc ? `<td style="text-align: center;">${item.stock}</td>` : ''}
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
                        ${!isBdc ? `<th style="width: 8%; text-align: center;">BESOIN</th>` : ''}
                        ${!isBdc ? `<th style="width: 8%; text-align: center;">STOCK</th>` : ''}
                        <th style="width: 8%; text-align: center;">${isBdc ? 'QUANTITÉ' : 'CDE'}</th>
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


/* --- MANUAL ADD SYSTEM (DATABASE) --- */

console.log("MANUAL ADD SYSTEM LOADED"); // Debug

window.openManualAddModal = () => {
    console.log("Opening Manual Add Modal"); // Debug
    const modal = document.getElementById('manualAddModal');
    if (!modal) {
        alert("Erreur: La modale 'manualAddModal' est introuvable dans le HTML.");
        return;
    }
    modal.classList.remove('hidden');

    // Populate Datalists with unique values
    try {
        const allSuppliers = window.ART_DATA.map(i => i.fournisseur).filter(x => x && x.trim() !== '');
        const uniqueSuppliers = [...new Set(allSuppliers)].sort();

        const allFamilies = window.ART_DATA.map(i => i.famille).filter(x => x && x.trim() !== '');
        const uniqueFamilies = [...new Set(allFamilies)].sort();

        const supList = document.getElementById('suppliersList');
        if (supList) supList.innerHTML = uniqueSuppliers.map(s => `<option value="${s}">`).join('');

        const famList = document.getElementById('familiesList');
        if (famList) famList.innerHTML = uniqueFamilies.map(f => `<option value="${f}">`).join('');
    } catch (e) {
        console.error("Error populating lists:", e);
    }
};

window.closeManualAddModal = () => {
    document.getElementById('manualAddModal').classList.add('hidden');
    const form = document.getElementById('manualAddForm');
    if (form) form.reset();

    const preview = document.getElementById('manualImgPreview');
    if (preview) preview.classList.add('hidden');

    const placeholder = document.getElementById('manualImgPlaceholder');
    if (placeholder) placeholder.classList.remove('hidden');
};

window.previewManualImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.querySelector('#manualImgPreview img');
            if (img) img.src = e.target.result;

            const preview = document.getElementById('manualImgPreview');
            if (preview) preview.classList.remove('hidden');

            const placeholder = document.getElementById('manualImgPlaceholder');
            if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.submitManualArticle = async () => {
    const form = document.getElementById('manualAddForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('submitManualBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Enregistrement...`;
    btn.disabled = true;

    try {
        const formData = new FormData(form);

        // Use 8000 for Python Server. 
        const apiUrl = '/api/add-article';

        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            alert('Article ajouté avec succès ! La page va se recharger.');
            window.location.reload();
        } else {
            throw new Error(result.message || 'Erreur inconnue');
        }

    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'enregistrement : " + e.message + "\nAssurez-vous que le serveur Python (start_app.bat) est bien lancé.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};




window.renderNeeds = function () {
    const tbody = document.getElementById('needsTableBody');
    if (!tbody) return;

    // Handle header checkbox visibility
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const th = document.getElementById('thSelectAllCheck') || selectAllCheckbox.parentElement.parentElement;
        if (window.isRalSelectionMode) {
            th.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            th.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    // Mettre à jour le badge de l'onglet Besoins
    const badge = document.getElementById('needsBadge');
    if (badge) {
        const count = window.needs.length;
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }

    // Filtrer si une recherche est active
    const q = (window.needsFilterQuery || '').toLowerCase().trim();
    const displayedNeeds = q
        ? window.needs.filter(item =>
            (item.reference || '').toLowerCase().includes(q) ||
            (item.designation || '').toLowerCase().includes(q) ||
            (item.fournisseur || '').toLowerCase().includes(q)
        )
        : window.needs;

    // Afficher le compteur de filtre
    const filterCount = document.getElementById('needsFilterCount');
    if (filterCount) {
        if (q && displayedNeeds.length !== window.needs.length) {
            filterCount.textContent = `${displayedNeeds.length} / ${window.needs.length}`;
            filterCount.classList.remove('hidden');
        } else {
            filterCount.classList.add('hidden');
        }
    }

    tbody.innerHTML = displayedNeeds.map((item, index) => {
        // Retrouver l'index réel dans window.needs pour les actions
        const realIndex = window.needs.indexOf(item);
        const isSelected = window.selectedNeeds.has(String(item.id));
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

        let ralDisplay = '<span class="text-zinc-500">-</span>';
        if (item.ral) {
            const finishLabel = item.ral_finish ? ` <span class="text-[9px] text-zinc-500 font-normal">${item.ral_finish}</span>` : '';
            ralDisplay = `<span class="font-bold text-white text-xs">${item.ral}</span>${finishLabel}`;
        } else if (item.decor) {
            ralDisplay = `<span class="text-zinc-400">${item.decor}</span>`;
        }

        const rowBg = isSelected
            ? 'bg-indigo-500/20'
            : 'hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0';

        // Classe de la bordure gauche (indicateur couverture ou sélection)
        const borderLeft = isSelected ? 'border-l-indigo-500' : (coverageIndicator || 'border-l-transparent');

        // Checkbox column cell
        const checkboxCellClass = window.isRalSelectionMode
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none';

        return `
        <tr onclick="window.handleRowClick(event, ${realIndex})" 
            class="group transition-all cursor-pointer ${rowBg} border-l-2 ${borderLeft}">
            
            <!-- CHECKBOX -->
            <td class="text-center p-2 w-12 transition-opacity ${checkboxCellClass}">
                <div class="flex items-center justify-center w-12 mx-auto">
                    <input type="checkbox" 
                        onchange="window.toggleSelection(${realIndex})" 
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

            <!-- P.U. HT -->
            <td class="p-4 w-24 text-right">
                <span class="font-mono text-zinc-300">${(parseFloat(item.px_public) || 0).toFixed(2)}€</span>
            </td>

            <!-- CONDIT -->
            <td class="p-4 w-32">
               <div class="text-xs text-zinc-500">${item.conditionnement || '-'}</div>
            </td>

            <!-- NEED -->
            <td class="p-4 w-24 text-center">
                <div class="inline-flex items-center justify-center min-w-[30px] h-8 px-2 bg-zinc-800 rounded-lg text-white font-bold border border-zinc-700">
                    <input type="number" 
                        min="0" 
                        value="${item.need || 0}" 
                        onclick="event.stopPropagation()"
                        onchange="window.updateNeedV(${index}, 'need', this.value)"
                        class="w-full bg-transparent border-none text-center font-bold focus:ring-0 p-0 text-white">
                </div>
            </td>

            <!-- STOCK -->
            <td class="p-4 w-24 text-center">
                 <input type="number" 
                    min="0" 
                    value="${item.stock || 0}" 
                    onclick="event.stopPropagation()"
                    onchange="window.updateNeedV(${index}, 'stock', this.value)"
                    class="w-full bg-transparent border-none text-center font-mono text-zinc-500 focus:ring-0 p-0 hover:text-white transition-colors">
            </td>

            <!-- ORDER -->
            <td class="p-4 w-24 text-center">
                <span class="text-emerald-500 font-bold font-mono">${Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0))}</span>
            </td>

            <!-- TOTAL HT -->
            <td class="p-4 w-20 text-right">
                ${(() => {
                const toOrder = Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0));
                const pu = parseFloat(item.px_public) || 0;
                const total = toOrder * pu;
                return total > 0
                    ? `<span class="font-mono font-bold text-amber-400">${total.toFixed(2)} €</span>`
                    : `<span class="text-zinc-700 font-mono text-xs">—</span>`;
            })()}
            </td>

            <!-- ACTIONS -->
            <td class="p-4 w-16 text-right">
                <button onclick="window.deleteNeed(${realIndex})" class="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Supprimer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
        </tr>

        <!-- EXPANSION ROW FOR CALPINAGE -->
        <tr id="calpRow_${index}" class="${window.activeCalpinageId === String(item.id) ? '' : 'hidden'} bg-zinc-950/50 border-b border-white/[0.03]">
            <td colspan="11" class="p-0">
                <div id="calpContainer_${index}" class="p-4 border-l-2 border-orange-500"></div>
            </td>
        </tr>
        `;
    }).join('');

    // Re-init icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateRalModeUI();

    // Ligne de total général
    const totalNeed = window.needs.reduce((s, i) => s + (parseFloat(i.need) || 0), 0);
    const totalCde = window.needs.reduce((s, i) => s + Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0)), 0);
    const totalHT = window.needs.reduce((s, i) => {
        const cde = Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0));
        return s + cde * (parseFloat(i.px_public) || 0);
    }, 0);

    // Injecter ou mettre à jour la ligne de totaux sous le tableau
    let totalRow = document.getElementById('needsTotalRow');
    if (!totalRow) {
        const table = document.querySelector('#needsTableBody')?.closest('table');
        if (table) {
            let tfoot = table.querySelector('tfoot');
            if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
            tfoot.innerHTML = `<tr id="needsTotalRow" class="border-t-2 border-zinc-700 bg-zinc-900/80 sticky bottom-0">
                <td colspan="6" class="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-widest">
                    ${window.needs.length} article${window.needs.length > 1 ? 's' : ''}
                </td>
                <td class="p-3 text-center text-xs font-black text-white">${totalNeed}</td>
                <td class="p-3 text-center text-xs text-zinc-500">—</td>
                <td class="p-3 text-center text-xs font-black text-emerald-400">${totalCde}</td>
                <td class="p-3 text-right text-sm font-black text-amber-400">${totalHT.toFixed(2)} €</td>
                <td></td>
            </tr>`;
        }
    } else {
        totalRow.innerHTML = `
            <td colspan="6" class="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-widest">
                ${window.needs.length} article${window.needs.length > 1 ? 's' : ''}
            </td>
            <td class="p-3 text-center text-xs font-black text-white">${totalNeed}</td>
            <td class="p-3 text-center text-xs text-zinc-500">—</td>
            <td class="p-3 text-center text-xs font-black text-emerald-400">${totalCde}</td>
            <td class="p-3 text-right text-sm font-black text-amber-400">${totalHT.toFixed(2)} €</td>
            <td></td>`;
    }
}

// Filtre rapide dans la vue Besoins
window.filterNeeds = function (query) {
    window.needsFilterQuery = query;
    window.renderNeeds();
};
