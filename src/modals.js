// modals.js — Modales (ES6 Module)
import { AppState } from './store.js';

// ============================================================
// MANUAL ADD SYSTEM (DATABASE)
// ============================================================



window.openManualAddModal = () => {

    const modal = document.getElementById('manualAddModal');
    if (!modal) {
        alert("Erreur: La modale 'manualAddModal' est introuvable dans le HTML.");
        return;
    }
    modal.classList.remove('hidden');

    // Populate Datalists with unique values
    try {
        const allSuppliers = AppState.catalogData.map(i => i.fournisseur).filter(x => x && x.trim() !== '');
        const uniqueSuppliers = [...new Set(allSuppliers)].sort();

        const allFamilies = AppState.catalogData.map(i => i.famille).filter(x => x && x.trim() !== '');
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

        // --- OPTIMISTIC UI: Ajout immédiat aux besoins ---
        const autoAdd = document.getElementById('autoAddToNeeds')?.checked;
        if (autoAdd) {
            const qty = parseInt(document.getElementById('manualQtyInput')?.value || '1', 10);
            const ref = formData.get('reference') || '';
            const des = formData.get('designation') || '';
            const four = formData.get('fournisseur') || 'Manuel';

            // Créer une désignation enrichie avec les nouvelles infos si présentes
            const dim = formData.get('dimensions');
            const ep = formData.get('epaisseur');
            const ral = formData.get('finition');

            let extraDes = [];
            if (ep) extraDes.push(`Ép ${ep}mm`);
            if (dim) extraDes.push(`Dim ${dim}`);
            const fullDes = extraDes.length > 0 ? `${des} (${extraDes.join(', ')})`.trim() : des;

            // Faux ID temporaire basé sur le timestamp
            const tempId = `temp_${Date.now()}`;

            // Lire temporairement l'image en base64 pour l'aperçu si sélectionnée
            let imgDataUrl = '';
            const imgInput = form.querySelector('input[type="file"]');
            if (imgInput && imgInput.files && imgInput.files[0]) {
                try {
                    const reader = new FileReader();
                    imgDataUrl = await new Promise((resolve) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(imgInput.files[0]);
                    });
                } catch (e) { }
            }

            const newItem = {
                id: tempId,
                reference: ref,
                designation: fullDes,
                fournisseur: four,
                ral: ral || '-',
                longueur: formData.get('dimensions') || 1, // Fallback legacy
                unit_condit: 'U', // Unité par défaut
                type: formData.get('famille') || 'Atypique',
                need: qty,
                stock: 0,
                px_public: parseFloat(formData.get('prix')) || 0,
                px_remise: parseFloat(formData.get('prix')) || 0,
                image: imgDataUrl // Image base64 temporaire
            };

            if (autoAdd) {
                AppState.needs.push(newItem);
                localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
                window.showToast(`✅ Article ajouté instantanément aux besoins`, 'indigo');
            }

            // SOLUTION CATALOGUE OPTIMISTE: On l'injecte dans le catalogue actuel
            // pour qu'il soit trouvable immédiatement dans la recherche sans F5
            AppState.catalogData.unshift(newItem);
            if (typeof window.applyFilters === 'function') window.applyFilters();

            // Mettre à jour l'affichage
            if (typeof renderNeeds === 'function') renderNeeds();
            if (typeof render === 'function') render();
        }

        // Fermer la modale tout de suite pour fluidifier l'expérience
        window.closeManualAddModal();

        // Use 8000 for Python Server. Fire and forget logic (no blocking).
        const apiUrl = '/api/add-article';

        fetch(apiUrl, {
            method: 'POST',
            body: formData
        }).then(res => res.json()).then(result => {
            if (!result.status === 'success' && !result.message?.includes('attente')) {
                console.warn("Retour serveur pour ajout manuel :", result);
            }
        }).catch(err => {
            console.error("Erreur d'ajout en tâche de fond:", err);
            window.showToast("⚠️ L'article n'a pas pu être inséré dans l'Excel (Serveur injoignable)", "zinc");
        });

    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'enregistrement local : " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ============================================================
// SPRINT 3 — FICHE ARTICLE RAPIDE
// ============================================================
window.showArticleCard = function (realIndex) {
    const item = AppState.needs[realIndex];
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
    AppState.needs.forEach(item => {
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
// SPRINT 7 — MODIFICATION DES LIGNES DES BESOINS
// ============================================================
window.openEditNeedModal = function (realIndex) {
    const item = AppState.needs[realIndex];
    if (!item) return;

    document.getElementById('editNeedIndex').value = realIndex;
    document.getElementById('editNeedRef').value = item.reference || '';
    document.getElementById('editNeedDes').value = item.designation || '';

    document.getElementById('editNeedModal').classList.remove('hidden');
};

window.closeEditNeedModal = function () {
    document.getElementById('editNeedModal').classList.add('hidden');
};

window.saveEditNeedModal = function () {
    const realIndex = document.getElementById('editNeedIndex').value;
    if (realIndex === '') return;

    const newRef = document.getElementById('editNeedRef').value;
    const newDes = document.getElementById('editNeedDes').value;

    AppState.needs[realIndex].reference = newRef;
    AppState.needs[realIndex].designation = newDes;

    // Sauvegarde et MAJ UI
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));
    window.renderNeeds();
    window.closeEditNeedModal();
    if (window.showToast) window.showToast('✅ Modifications de la ligne enregistrées', 'emerald');
};

// ============================================================
// MODIFICATION D'UN ARTICLE DANS LA BDD CATALOGUE
// ============================================================
let currentArticleToEdit = null;
window.isCatalogEditMode = false;

window.toggleCatalogEditMode = function () {
    window.isCatalogEditMode = !window.isCatalogEditMode;
    const btn = document.getElementById('btnToggleCatalogEdit');
    if (btn) {
        if (window.isCatalogEditMode) {
            btn.classList.add('bg-amber-500/20', 'border-amber-500', 'text-amber-500');
            btn.classList.remove('bg-[var(--card)]', 'border-[var(--border)]', 'text-[var(--emerald)]');
            if (window.showToast) window.showToast("Mode modification activé : Cliquez sur un article à modifier", "amber");
        } else {
            btn.classList.remove('bg-amber-500/20', 'border-amber-500', 'text-amber-500');
            btn.classList.add('bg-[var(--card)]', 'border-[var(--border)]', 'text-[var(--emerald)]');
            if (window.showToast) window.showToast("Mode modification désactivé", "gray");
        }
    }
};

window.handleCatalogItemClick = function (item) {
    if (window.isCatalogEditMode) {
        window.openEditCatalogArticleModal(item);
    }
    // Sinon, on ne fait rien de particulier au clic global sur la carte (comportement d'origine)
};

window.openEditCatalogArticleModal = function (item = null) {
    const modal = document.getElementById('editCatalogArticleModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Si on a directement cliqué sur un article, on l'affiche, sinon on cache
    if (item) {
        window.selectCatalogArticleToEdit(item);
    } else {
        document.getElementById('editCatalogForm').classList.add('hidden');
        document.getElementById('submitEditCatalogBtn').disabled = true;
        currentArticleToEdit = null;
    }

    // Remplir les datalists si elles existent
    const suppliersList = document.getElementById('suppliersListEdit');
    if (suppliersList && AppState.suppliers) {
        suppliersList.innerHTML = AppState.suppliers.map(s => `<option value="${s}">`).join('');
    }
};

window.closeEditCatalogArticleModal = function () {
    const modal = document.getElementById('editCatalogArticleModal');
    if (modal) modal.classList.add('hidden');
};

window.selectCatalogArticleToEdit = function (item) {
    currentArticleToEdit = item;

    document.getElementById('editCatalogOldReference').value = item.reference || '';
    document.getElementById('editCatalogOldFournisseur').value = item.fournisseur || '';

    document.getElementById('editCatRef').value = item.reference || '';
    document.getElementById('editCatDes').value = item.designation || '';
    document.getElementById('editCatFour').value = item.fournisseur || '';
    document.getElementById('editCatFam').value = item.type || '';
    document.getElementById('editCatPrix').value = item.px_public || item.px_remise || '';
    document.getElementById('editCatFinition').value = item.ral || '';
    document.getElementById('editCatDim').value = item.dimension || item.longueur || '';
    document.getElementById('editCatEp').value = item.epaisseur || '';

    document.getElementById('editCatalogForm').classList.remove('hidden');
    document.getElementById('submitEditCatalogBtn').disabled = false;
};

window.submitEditCatalogArticle = async function () {
    const form = document.getElementById('editCatalogForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('submitEditCatalogBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> ENREGISTREMENT...`;
    btn.disabled = true;

    try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Optimistic Update
        const index = AppState.catalogData.findIndex(i =>
            i.reference === data.old_reference && i.fournisseur === data.old_fournisseur
        );

        const updatedItem = {
            ...currentArticleToEdit,
            reference: data.reference,
            designation: data.designation,
            fournisseur: data.fournisseur,
            type: data.famille,
            px_public: parseFloat(data.prix) || 0,
            px_remise: parseFloat(data.prix) || 0,
            ral: data.finition || '-',
            dimension: data.dimensions,
            epaisseur: data.epaisseur
        };

        if (index !== -1) {
            AppState.catalogData[index] = updatedItem;
        }

        if (typeof window.applyFilters === 'function') window.applyFilters();

        const response = await fetch('/api/edit-article-db', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Erreur réseau');

        if (window.showToast) window.showToast('✅ Article modifié avec succès', 'emerald');
        window.closeEditCatalogArticleModal();

        // Réinitaliser lucide si existant
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error(e);
        alert("Erreur lors de la modification. Veuillez réessayer.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
