window.saveProject = () => {
    const chantierVal = document.getElementById('chantierRef') ? document.getElementById('chantierRef').value : '';
    const defaultName = chantierVal ? `Projet_${chantierVal.replace(/[^a-z0-9]/gi, '_')}` : 'Projet_ArtsAlu';

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

    // Historique des projets récents
    try {
        const hist = JSON.parse(localStorage.getItem('art-project-history') || '[]');
        const entry = { name: defaultName, chantier: chantierVal, date: new Date().toISOString(), count: window.needs.length };
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
        if (window.getIsProfil && window.getIsProfil(item)) {
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

            let extractedCuts = [];
            let wasteText = '';

            if (item.calpinageData && item.calpinageData.cuts) {
                item.calpinageData.cuts.forEach(c => {
                    for (let i = 0; i < c.quantity; i++) {
                        extractedCuts.push(Math.round(c.length * 1000));
                    }
                });

                if (item.calpinageData.lastSolution && item.calpinageData.lastSolution.length > 0) {
                    let chutes = [];
                    item.calpinageData.lastSolution.forEach(bar => {
                        const total = bar.stockVariant.length;
                        const waste = total - (bar.usedLength - 0.004);
                        if (waste > 0) chutes.push(Math.round(waste * 1000));
                    });
                    if (chutes.length > 0) {
                        wasteText = `<div style="margin-top: 2px; font-size: 10px; color: #d66;">Chutes: ${chutes.join('mm, ')}mm</div>`;
                    }
                }
            } else if (item.cuts && item.cuts.length > 0) {
                extractedCuts = item.cuts.filter(c => c > 0).map(c => c > 10 ? c : Math.round(c * 1000));
            }

            if (extractedCuts.length > 0) {
                cutsHtml = `
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
                        ${extractedCuts.map(c => `
                            <span style="padding: 2px 6px; background: #eee; border: 1px solid #ddd; border-radius: 4px; font-size: 10px;">
                                ${c} mm
                            </span>
                        `).join('')}
                    </div>
                    ${wasteText}
                `;
            } else {
                cutsHtml = `<span style="color: #999; font-style: italic; font-size: 10px;">Pas de coupe définie</span>`;
            }

            return `
            <tr style="page-break-inside: avoid;">
                <td style="padding-right: 15px;">
                    <div style="font-weight: bold;">${item.reference}</div>
                    <div style="font-size: 10px; color: #666;">${item.fournisseur}</div>
                </td>
                <td style="padding-right: 15px;">
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
                        <th style="width: 18%;">REF/FRN</th>
                        <th style="width: 35%;">DÉSIGNATION/RAL</th>
                        <th style="width: 8%; text-align: center;">LONG.</th>
                        <th style="width: 8%; text-align: center;">BESOIN</th>
                        <th>DÉTAIL DÉBITS (Coupes)</th>
                    </tr>
                </thead>
                <tbody>${calpRows}</tbody>
            </table>
        `;
    } else {
        // Standard BDC or Full List
        const isBdc = type === 'bdc';
        let totalGlobalHT = 0;

        const rows = items.map(item => {
            const puPiece = window.getPuPiece(item);
            const qty = isBdc ? item.toOrder : item.need;
            const totalHT = qty * puPiece;
            totalGlobalHT += totalHT;

            return `
            <tr>
                <td>${item.reference}</td>
                <td>${item.designation}</td>
                <td style="text-align: center;">${item.ral || '-'}</td>
                <td style="text-align: center;">${item.longueur || '-'} ${item.unit_condit || ''}</td>
                ${!isBdc ? `<td style="text-align: center;">${item.need}</td>` : ''}
                ${!isBdc ? `<td style="text-align: center;">${item.stock}</td>` : ''}
                <td style="text-align: center; font-weight: bold; color: ${item.toOrder > 0 ? '#000' : '#ccc'};">
                    ${item.toOrder}
                </td>
                <td style="text-align: right;">${puPiece.toFixed(2)} €</td>
                <td style="text-align: right; font-weight: bold;">${totalHT.toFixed(2)} €</td>
            </tr>
            `;
        }).join('');

        contentHtml = `
            <table class="bdc-table">
                <thead>
                    <tr>
                        <th style="width: 18%;">RÉFÉRENCE</th>
                        <th style="width: ${isBdc ? '32%' : '26%'};">DÉSIGNATION</th>
                        <th style="width: 8%; text-align: center;">RAL</th>
                        <th style="width: 10%; text-align: center;">CONDIT.</th>
                        ${!isBdc ? `<th style="width: 7%; text-align: center;">BESOIN</th>` : ''}
                        ${!isBdc ? `<th style="width: 7%; text-align: center;">STOCK</th>` : ''}
                        <th style="width: 8%; text-align: center;">${isBdc ? 'QUANTITÉ' : 'CDE'}</th>
                        <th style="width: 10%; text-align: right;">PU HT</th>
                        <th style="width: 12%; text-align: right;">TOTAL HT</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr>
                        <td colspan="${!isBdc ? 8 : 6}" style="text-align: right; font-weight: 900; padding-top: 15px; border-top: 2px solid #000;">TOTAL GÉNÉRAL HT</td>
                        <td style="text-align: right; font-weight: 900; font-size: 16px; padding-top: 15px; border-top: 2px solid #000; color: #166534;">${totalGlobalHT.toFixed(2)} €</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    container.innerHTML = `
        <div class="bdc-header" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div>
                <h1 style="font-size: 28px; font-weight: 900; margin-bottom: 8px; color: #1e1b4b; letter-spacing: -0.5px;">ARTS ALU</h1>
                <div style="font-size: 10px; color: #4b5563; line-height: 1.5;">
                    <p style="font-weight: bold; color: #1f2937;">Menuiserie Aluminium & PVC • Stores & Volets • Abris de Piscines</p>
                    <p>Les Quatre Chemins - R.N.7, 83460 LES ARCS S/ARGENS</p>
                    <p>Tél. 04 94 73 67 04 • Port : 06 61 63 33 67 / 06 11 35 75 09</p>
                    <p>E-Mail: contact@artsalu.fr</p>
                    <p style="font-size: 8px; margin-top: 6px; color: #9ca3af;">Arts Alu - Eurl au capital de 8000 € • Siret 48065874900027 • TVA Intracom FR61480658749</p>
                </div>
            </div>
            <div style="text-align: right; display: flex; flex-col; align-items: flex-end;">
                <div style="background: #f3f4f6; padding: 10px 15px; border-radius: 6px; border: 1px solid #e5e7eb; display: inline-block;">
                    <p style="font-size: 14px; font-weight: 900; color: #111827; text-transform: uppercase;">CHANTIER : ${chantier}</p>
                    <p style="font-size: 11px; color: #6b7280; margin-top: 4px;">Date : ${date}</p>
                </div>
                <div style="margin-top: 15px; float: right;">
                    <p style="font-size: 14px; font-weight: 900; color: #4338ca; text-transform: uppercase; letter-spacing: 1px;">
                        ${type === 'calpinage' ? 'DÉTAIL CALPINAGE' : (type === 'list' ? 'LISTE COMPLÈTE' : 'BON DE COMMANDE')}
                    </p>
                </div>
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
window.openExportModalV2 = openExportModalV2;


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




// ============================================================
// HELPERS POUR LE PRIX DE LA PIÈCE
// ============================================================
window.getPuPiece = function (item) {
    if (item.px_piece !== undefined) return parseFloat(item.px_piece) || 0;

    // Rétro-compatibilité V142+ pour les articles en cache qui n'ont pas px_remise
    if (item.px_remise === undefined && window.ART_DATA) {
        const catItem = window.ART_DATA.find(a => String(a.reference) === String(item.reference) && String(a.decor || '') === String(item.ral || ''));
        if (catItem) {
            item.px_remise = catItem.px_remise || catItem.px_public || 0;
            if (window.needs) localStorage.setItem('art-needs', JSON.stringify(window.needs));
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

    // Tri par colonne si actif
    const sortCol = window.needsSortCol;
    const sortDir = window.needsSortDir || 'asc';
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
        const checkboxCellClass = window.isRalSelectionMode
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
    if (window.CalpinageSystem && window.needs) {
        window.needs.forEach((it, i) => {
            if (window.activeCalpinageId === String(it.id) || (window.isCalpinageMode && window.getIsProfil && window.getIsProfil(it))) {
                setTimeout(() => window.CalpinageSystem.initRow(i), 10);
            }
        });
    }

    updateRalModeUI();

    // Ligne de total général
    const totalNeed = window.needs.reduce((s, i) => s + (parseFloat(i.need) || 0), 0);
    const totalCde = window.needs.reduce((s, i) => s + Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0)), 0);
    const totalHT = window.needs.reduce((s, i) => {
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
                <td colspan="8" class="px-4 py-3 text-right text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                    ${window.needs.length} article${window.needs.length > 1 ? 's' : ''}
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
            <td colspan="8" class="px-4 py-3 text-right text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                ${window.needs.length} article${window.needs.length > 1 ? 's' : ''}
            </td>
            <td class="p-3 text-center text-xs font-black text-[var(--text-main)]">${totalNeed}</td>
            <td class="p-3 text-center text-xs text-[var(--text-muted)]">—</td>
            <td class="p-3 text-center text-xs font-black text-emerald-500">${totalCde}</td>
            <td class="p-3 text-right text-sm font-black text-amber-500">${totalHT.toFixed(2)} €</td>
            <td></td>
        `;
    }
}

    ;// Filtre rapide dans la vue Besoins (debounced) — Sprint 4
(function () {
    function debounceNeeds(fn, delay) {
        let t;
        return function (...a) { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
    }
    const _filterFn = function (query) {
        window.needsFilterQuery = query;
        window.renderNeeds();
    };
    window.filterNeeds = debounceNeeds(_filterFn, 200);
})();

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
    if (window.needs[realIndex]) {
        window.needs[realIndex].note = value.trim();
        localStorage.setItem('art-needs', JSON.stringify(window.needs));
        // Mettre à jour l'icône du bouton sans re-render complet
        const noteBtn = document.querySelector(`#noteRow_${realIndex}`)?.previousElementSibling?.querySelector('[title="Note"]');
        // simple re-render ciblé
        window.renderNeeds();
    }
};

// ============================================================
// SPRINT 3 — FICHE ARTICLE RAPIDE
// ============================================================
window.showArticleCard = function (realIndex) {
    const item = window.needs[realIndex];
    if (!item) return;

    const modal = document.getElementById('articleCardModal');
    if (!modal) return;

    const pu = (parseFloat(item.px_public) || 0).toFixed(2);
    const cde = Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0));
    const totalHT = (cde * (parseFloat(item.px_public) || 0)).toFixed(2);

    const safeAlt = window.escapeHtml ? window.escapeHtml(item.designation) : String(item.designation).replace(/"/g, '&quot;');
    const imgHtml = item.image
        ? `<img src="${item.image}" alt="${safeAlt}" class="w-full h-48 object-contain rounded-xl border border-[var(--border)] bg-[var(--canvas)]" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-32 flex items-center justify-center text-[var(--text-muted)]\\'>Pas d&apos;image</div>'">`
        : `<div class="w-full h-32 flex items-center justify-center text-[var(--text-muted)] border border-[var(--border)] rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
           </div>`;

    const note = item.note ? `<div class="mt-4 p-3 bg-[var(--amber-soft)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-main)] flex gap-2">
        <span class="text-[var(--amber)] shrink-0">💬</span> ${item.note}
    </div>` : '';

    document.getElementById('articleCardContent').innerHTML = `
        <div class="space-y-4">
            ${imgHtml}
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">${item.fournisseur || '—'}</div>
                    <div class="font-mono text-indigo-300 font-bold text-sm">${item.reference || '—'}</div>
                    <div class="text-white font-semibold text-base mt-1 leading-snug">${item.designation || '—'}</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-[var(--card)] rounded-xl p-3">
                    <div class="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Finition</div>
                    <div class="font-bold text-white">${item.ral || item.decor || '—'} ${item.ral_finish || ''}</div>
                </div>
                <div class="bg-[var(--card)] rounded-xl p-3">
                    <div class="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Conditionnement</div>
                    <div class="font-bold text-white">${item.conditionnement || item.longueur || '—'}</div>
                </div>
                <div class="bg-[var(--card)] rounded-xl p-3">
                    <div class="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">P.U. HT</div>
                    <div class="font-mono font-black text-white">${pu} €</div>
                </div>
                <div class="bg-[var(--card)] rounded-xl p-3">
                    <div class="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Besoin / Stock / CDE</div>
                    <div class="font-mono font-bold text-white">${item.need || 0} / ${item.stock || 0} / <span class="text-emerald-400">${cde}</span></div>
                </div>
            </div>
            ${cde > 0 ? `<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                <span class="text-xs font-black text-amber-400 uppercase tracking-widest">Total HT à commander</span>
                <span class="font-mono font-black text-amber-400 text-lg">${totalHT} €</span>
            </div>` : ''}
            ${note}
        </div>
    `;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeArticleCard = function () {
    const modal = document.getElementById('articleCardModal');
    if (modal) modal.classList.add('hidden');
};

// ============================================================
// SPRINT 3 — GRAPHIQUE BUDGET PAR FOURNISSEUR
// ============================================================
window.openBudgetChart = function () {
    const modal = document.getElementById('budgetChartModal');
    if (!modal) return;

    // Regrouper par fournisseur
    const budgets = {};
    let totalGeneral = 0;
    window.needs.forEach(item => {
        const cde = Math.max(0, (parseFloat(item.need) || 0) - (parseFloat(item.stock) || 0));
        const total = cde * (parseFloat(item.px_public) || 0);
        if (total > 0) {
            const four = item.fournisseur || 'Autres';
            budgets[four] = (budgets[four] || 0) + total;
            totalGeneral += total;
        }
    });

    if (totalGeneral === 0) {
        alert("Aucun article à commander. Vérifiez les quantités Besoin et Stock.");
        return;
    }

    const sorted = Object.entries(budgets).sort((a, b) => b[1] - a[1]);
    const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6'];

    // Construire le SVG donut
    const cx = 160, cy = 160, r = 120, innerR = 70;
    let angle = -90;
    let paths = '';
    let legends = '';

    sorted.forEach(([name, val], i) => {
        const pct = val / totalGeneral;
        const sweep = pct * 360;
        const startRad = (angle * Math.PI) / 180;
        const endRad = ((angle + sweep) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
        const ix1 = cx + innerR * Math.cos(startRad), iy1 = cy + innerR * Math.sin(startRad);
        const ix2 = cx + innerR * Math.cos(endRad), iy2 = cy + innerR * Math.sin(endRad);
        const large = sweep > 180 ? 1 : 0;
        const color = COLORS[i % COLORS.length];
        paths += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${innerR},${innerR} 0 ${large},0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z" fill="${color}" opacity="0.9" class="hover:opacity-100 transition-opacity cursor-default"><title>${name}: ${val.toFixed(2)} € (${(pct * 100).toFixed(1)}%)</title></path>`;
        legends += `<div class="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
            <div class="w-3 h-3 rounded-sm shrink-0" style="background:${color}"></div>
            <span class="text-sm font-bold text-zinc-300 flex-1">${name}</span>
            <span class="font-mono text-xs text-zinc-500">${(pct * 100).toFixed(1)}%</span>
            <span class="font-mono font-black text-amber-400 text-sm">${val.toFixed(2)} €</span>
        </div>`;
        angle += sweep;
    });

    document.getElementById('budgetDonut').innerHTML = `
        <svg viewBox="0 0 320 320" class="w-full max-w-[280px]">
            ${paths}
            <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="text-xs" font-size="11" fill="#71717a" font-family="inherit">TOTAL HT</text>
            <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="20" font-weight="900" fill="white" font-family="inherit">${totalGeneral.toFixed(0)} €</text>
        </svg>`;
    document.getElementById('budgetLegend').innerHTML = legends;
    document.getElementById('budgetTotal').textContent = `${totalGeneral.toFixed(2)} €`;

    modal.classList.remove('hidden');
};

window.closeBudgetChart = function () {
    const modal = document.getElementById('budgetChartModal');
    if (modal) modal.classList.add('hidden');
};

// ============================================================
// SPRINT 7 — ÉDITION INLINE (saveNeedField + adjustNeedField)
// ============================================================

// Sauvegarde un champ modifié directement dans window.needs
// et met à jour les totaux en bas du tableau sans re-render complet
let _saveNeedDebounceTimer = null;
window.saveNeedField = function (realIndex, field, value) {
    if (!window.needs[realIndex]) return;
    window.needs[realIndex][field] = value;
    localStorage.setItem('art-needs', JSON.stringify(window.needs));

    // Mettre à jour la ligne ORDER et TOTAL HT en live sans re-render global
    clearTimeout(_saveNeedDebounceTimer);
    _saveNeedDebounceTimer = setTimeout(() => {
        window.renderNeeds();
    }, 600);
};

// Incrémentation +/- fluide (boutons +/-)
window.adjustNeedField = function (realIndex, field, delta) {
    if (!window.needs[realIndex]) return;
    const current = parseFloat(window.needs[realIndex][field]) || 0;
    const newVal = Math.max(0, current + delta);
    window.needs[realIndex][field] = (field === 'px_public' || field === 'px_piece') ? newVal : Math.round(newVal);
    localStorage.setItem('art-needs', JSON.stringify(window.needs));

    // MAJ directe du champ input sans re-render
    const inputId = field === 'need' ? `needInput_${realIndex}` : `stockInput_${realIndex}`;
    const input = document.getElementById(inputId);
    if (input) input.value = window.needs[realIndex][field];

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
    const original = window.needs[realIndex];
    if (!original) return;
    const copy = { ...original, id: original.id + '_copy_' + Date.now(), note: '' };
    window.needs.splice(realIndex + 1, 0, copy);
    localStorage.setItem('art-needs', JSON.stringify(window.needs));
    window.renderNeeds();
};

// ============================================================
// SPRINT 5 — TRI PAR COLONNE (appelé depuis les headers)
// ============================================================
window.sortNeedsBy = function (col) {
    if (window.needsSortCol === col) {
        window.needsSortDir = window.needsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        window.needsSortCol = col;
        window.needsSortDir = 'asc';
    }
    // Mettre à jour les indicateurs visuels des headers
    document.querySelectorAll('[data-sort-col]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (th.dataset.sortCol === col) {
            icon.textContent = window.needsSortDir === 'asc' ? ' ↑' : ' ↓';
            th.classList.add('text-indigo-400');
        } else {
            icon.textContent = '';
            th.classList.remove('text-indigo-400');
        }
    });
    window.renderNeeds();
};

// ============================================================
// SPRINT 5 — HISTORIQUE PROJETS RÉCENTS
// ============================================================
window.openProjectHistory = function () {
    const hist = JSON.parse(localStorage.getItem('art-project-history') || '[]');
    const panel = document.getElementById('projectHistoryPanel');
    const list = document.getElementById('projectHistoryList');
    if (!panel || !list) return;

    if (hist.length === 0) {
        list.innerHTML = '<p class="text-zinc-500 text-xs text-center py-4">Aucun projet récent</p>';
    } else {
        list.innerHTML = hist.map((h, i) => `
            <div class="flex items-center justify-between py-2 px-3 hover:bg-[var(--card-hover)] rounded-lg cursor-pointer group"
                 onclick="window.closeProjectHistory()">
                <div>
                    <div class="text-sm font-bold text-white">${h.chantier || h.name}</div>
                    <div class="text-[10px] text-zinc-500">${h.count} article${h.count !== 1 ? 's' : ''} · ${new Date(h.date).toLocaleDateString('fr-FR')}</div>
                </div>
                <span class="text-[9px] text-zinc-700 group-hover:text-zinc-400 font-mono">${h.name}.json</span>
            </div>
        `).join('');
    }
    panel.classList.remove('hidden');
    // Délai pour éviter la fermeture immédiate par propagation du clic d'ouverture
    setTimeout(() => {
        document.addEventListener('click', _histClickOutside, { once: true });
    }, 50);
};

window.closeProjectHistory = function () {
    const panel = document.getElementById('projectHistoryPanel');
    if (panel) panel.classList.add('hidden');
};

function _histClickOutside(e) {
    const panel = document.getElementById('projectHistoryPanel');
    if (panel && !panel.contains(e.target)) panel.classList.add('hidden');
}

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

// ============================================================
// SPRINT 8 — EXPORT EXCEL (SheetJS)
// ============================================================
window.exportExcel = function () {
    if (!window.XLSX) { alert('SheetJS non disponible — vérifiez votre connexion.'); return; }
    if (!window.needs || window.needs.length === 0) { alert('Aucun article dans la liste des besoins.'); return; }

    const chantier = document.getElementById('chantierRef')?.value || 'Chantier';
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');

    // --- Build rows ---
    const headers = ['#', 'Fournisseur', 'Référence', 'Désignation', 'RAL / Finition', 'Conditionnement', 'PU Pièce HT (€)', 'Besoin', 'Stock', 'À commander', 'Total HT (€)', 'Note'];
    const rows = window.needs.map((item, i) => {
        const need = parseFloat(item.need) || 0;
        const stock = parseFloat(item.stock) || 0;
        const toOrder = Math.max(0, need - stock);
        const puPiece = window.getPuPiece(item);

        const conditVal = parseFloat(item.longueur) || parseFloat(item.conditionnement) || 1;
        const u = String(item.unit_condit || item.unit_vente || '').toUpperCase();

        return [
            i + 1,
            item.fournisseur || '-',
            item.reference || '-',
            item.designation || '-',
            item.ral || '-',
            `${conditVal} ${u}`,
            parseFloat(puPiece.toFixed(2)),
            need,
            stock,
            toOrder,
            parseFloat((toOrder * puPiece).toFixed(2)),
            item.note || ''
        ];
    });

    // Totals row
    const totalNeed = window.needs.reduce((s, i) => s + (parseFloat(i.need) || 0), 0);
    const totalStock = window.needs.reduce((s, i) => s + (parseFloat(i.stock) || 0), 0);
    const totalCmd = window.needs.reduce((s, i) => s + Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0)), 0);
    const totalHT = window.needs.reduce((s, i) => {
        const toOrder = Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0));
        return s + toOrder * window.getPuPiece(i);
    }, 0);
    rows.push(['', 'TOTAL', '', '', '', '', '', totalNeed, totalStock, totalCmd, parseFloat(totalHT.toFixed(2)), '']);

    // --- Build workbook ---
    const wb = XLSX.utils.book_new();
    const wsData = [
        [`LISTE DES BESOINS — ${chantier.toUpperCase()}`],
        [`Date : ${dateStr}`, '', '', '', '', '', '', '', '', '', `Total HT : ${totalHT.toFixed(2)} €`],
        [],
        headers,
        ...rows
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
        { wch: 4 }, { wch: 16 }, { wch: 14 }, { wch: 40 }, { wch: 12 },
        { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Besoins');
    const filename = `Besoins_${chantier.replace(/[^a-z0-9]/gi, '_')}_${now.toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    if (window.showToast) window.showToast(`✅ Fichier Excel créé : ${filename}`, 'emerald');
};

// ============================================================
// SPRINT 8 — EXPORT PDF BDC (jsPDF + autoTable + logo Arts Alu)
// ============================================================
window.exportPDF = async function () {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
        alert('jsPDF non disponible — vérifiez votre connexion.');
        return;
    }
    if (!window.needs || window.needs.length === 0) {
        alert('Aucun article dans la liste des besoins.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const chantier = document.getElementById('chantierRef')?.value || 'Chantier Inconnu';
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const GREEN = [30, 100, 30];
    const LIGHT_GRAY = [248, 248, 248];
    const DARK_TEXT = [30, 30, 30];

    // Grouper par fournisseur (uniquement articles à commander)
    const groups = {};
    window.needs.forEach(item => {
        const need = parseFloat(item.need) || 0;
        const stock = parseFloat(item.stock) || 0;
        const toOrder = Math.max(0, need - stock);
        if (toOrder <= 0) return;
        const sup = item.fournisseur || 'Divers';
        if (!groups[sup]) groups[sup] = [];
        groups[sup].push({ ...item, toOrder });
    });

    if (Object.keys(groups).length === 0) {
        alert('Aucun article à commander (Besoin ≤ Stock pour tous les articles).');
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Charger le logo Arts Alu
    let logoData = null;
    try {
        const resp = await fetch('images/header/header_arts_alu.jpeg');
        const blob = await resp.blob();
        const reader = new FileReader();
        logoData = await new Promise(resolve => {
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) { /* logo optionnel */ }

    const suppliers = Object.keys(groups).sort();
    let isFirstPage = true;

    suppliers.forEach(supplier => {
        const items = groups[supplier];
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const pageW = doc.internal.pageSize.getWidth();
        let yPos = 15;

        // — Logo Arts Alu —
        if (logoData) {
            doc.addImage(logoData, 'JPEG', 10, yPos, 50, 16);
        }

        // — Titre BDC —
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...GREEN);
        doc.text('BON DE COMMANDE', pageW / 2, yPos + 6, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK_TEXT);
        doc.text(`Chantier : ${chantier}`, pageW / 2, yPos + 12, { align: 'center' });
        doc.text(`Date : ${dateStr}`, pageW / 2, yPos + 17, { align: 'center' });

        // — Fournisseur box —
        yPos += 28;
        doc.setFillColor(240, 248, 240);
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.4);
        doc.roundedRect(10, yPos, pageW - 20, 12, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...GREEN);
        doc.text(`Fournisseur : ${supplier}`, 16, yPos + 8);
        yPos += 16;

        // — Tableau articles —
        const totalHT = items.reduce((s, it) => {
            return s + it.toOrder * window.getPuPiece(it);
        }, 0);

        doc.autoTable({
            startY: yPos,
            margin: { left: 10, right: 10 },
            head: [['#', 'Référence', 'Désignation', 'RAL', 'Condit.', 'PU. Pièce', 'Besoin', 'Stock', 'À cmd.', 'Total HT', 'Note']],
            body: items.map((it, i) => {
                const puPiece = window.getPuPiece(it);
                const total = it.toOrder * puPiece;

                const conditVal = parseFloat(it.longueur) || parseFloat(it.conditionnement) || 1;
                const u = String(it.unit_condit || it.unit_vente || '').toUpperCase();

                return [
                    i + 1,
                    it.reference || '-',
                    it.designation || '-',
                    it.ral || '-',
                    `${conditVal} ${u}`,
                    puPiece > 0 ? `${puPiece.toFixed(2)} €` : '-',
                    it.need,
                    it.stock || 0,
                    it.toOrder,
                    total > 0 ? `${total.toFixed(2)} €` : '-',
                    it.note || ''
                ];
            }),
            foot: [['', '', '', '', '', '', '', '', 'TOTAL', `${totalHT.toFixed(2)} €`, '']],
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: DARK_TEXT },
            headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            footStyles: { fillColor: [220, 240, 220], textColor: GREEN, fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: LIGHT_GRAY },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 24 },
                2: { cellWidth: 80 },
                3: { cellWidth: 14, halign: 'center' },
                4: { cellWidth: 18, halign: 'center' },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 13, halign: 'center' },
                7: { cellWidth: 13, halign: 'center' },
                8: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
                9: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
                10: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                // Footer de page
                const pageH = doc.internal.pageSize.getHeight();
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(`Arts Alu — ${chantier} — ${dateStr} — Page ${data.pageNumber}`, pageW / 2, pageH - 5, { align: 'center' });
            }
        });
    });

    const filename = `BDC_${chantier.replace(/[^a-z0-9]/gi, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    if (window.showToast) window.showToast(`✅ PDF généré : ${filename}`, 'indigo');
};
