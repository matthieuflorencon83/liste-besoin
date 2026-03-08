// ui.js — Interface besoins (nettoyé — RAL dans ral.js, Export dans export.js)

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

// ============================================================
// AUTO-SAVE — Sauvegarde automatique toutes les 2 minutes
// ============================================================
let _autoSaveTimer = null;
let _lastAutoSaveHash = '';

function startAutoSave() {
    if (_autoSaveTimer) clearInterval(_autoSaveTimer);
    _autoSaveTimer = setInterval(() => {
        if (!AppState.needs || AppState.needs.length === 0) return;
        const hash = JSON.stringify(AppState.needs);
        if (hash === _lastAutoSaveHash) return; // Pas de changement
        _lastAutoSaveHash = hash;
        localStorage.setItem('art-needs', hash);
        // Flash discret de l'indicateur
        const indicator = document.getElementById('autoSaveIndicator');
        if (indicator) {
            indicator.classList.remove('opacity-0');
            indicator.textContent = '✓ Auto-sauvegardé';
            setTimeout(() => indicator.classList.add('opacity-0'), 2000);
        }
    }, 120000); // 2 minutes
}
startAutoSave();

// ============================================================
// RECHERCHE DANS LES BESOINS
// ============================================================
window.filterNeeds = function (query) {
    AppState.needsSearchQuery = query.trim().toLowerCase();
    window.renderNeeds();
};

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
    const u = String(item.unite___prix || item.unite_qte || item.unit_condit || item.unit_vente || '').toUpperCase();

    // Directive utilisateur : "ca doit etre le prix remisé x par le conditionnement"
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

    // Filtre de recherche dans les besoins
    const searchQ = (AppState.needsSearchQuery || '').toLowerCase();
    if (searchQ) {
        displayedNeeds = displayedNeeds.filter(item => {
            const ref = (item.reference || '').toLowerCase();
            const des = (item.designation || '').toLowerCase();
            const four = (item.fournisseur || '').toLowerCase();
            const ral = (item.ral || item.decor || '').toLowerCase();
            const note = (item.note || '').toLowerCase();
            return ref.includes(searchQ) || des.includes(searchQ) || four.includes(searchQ) || ral.includes(searchQ) || note.includes(searchQ);
        });
    }

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
            draggable="true"
            ondragstart="window.onNeedDragStart(event, ${realIndex})"
            ondragover="window.onNeedDragOver(event)"
            ondragend="window.onNeedDragEnd(event)"
            ondrop="window.onNeedDrop(event, ${realIndex})"
            class="group transition-all cursor-grab active:cursor-grabbing ${rowBg} border-l-2 ${borderLeft}">

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
                ${(() => {
                let img = item.image;
                if (!img) {
                    const catItem = AppState.catalogData.find(c => String(c.reference) === String(item.reference) && (c.fournisseur === item.fournisseur || !item.fournisseur));
                    if (catItem && catItem.image) {
                        item.image = catItem.image;
                        img = catItem.image;
                    }
                }

                if (!img) {
                    return `<div class="w-12 h-12 bg-[var(--card)] rounded-lg border border-white/5 flex items-center justify-center" title="Pas d'image"><i data-lucide="image-off" class="w-4 h-4 text-[var(--text-muted)] opacity-30"></i></div>`;
                }
                const safeImage = window.escapeHtml ? window.escapeHtml(img) : img.replace(/"/g, '&quot;');
                const safeImageAttr = safeImage.replace(/'/g, "\\'");
                return `<img src="${safeImage}" loading="lazy" decoding="async" class="w-12 h-12 object-contain rounded-lg bg-transparent p-0.5 cursor-pointer hover:scale-[4] hover:-translate-x-2 hover:-translate-y-2 hover:z-50 relative transition-transform duration-300 shadow-sm filter invert grayscale contrast-125 brightness-110 hover:shadow-2xl" onclick="window.openVisualizer('${safeImageAttr}', event)" title="Agrandir l'image" onerror="this.style.display='none'">`;
            })()}
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

            <!-- BESOIN — Éditable inline -->
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

            <!-- STOCK — Éditable inline -->
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
                    <!-- BOUTON MODIFIER -->
                    <button onclick="window.openEditNeedModal(${realIndex}); window.toggleNeedsActionMenu(${realIndex})" class="w-full px-4 py-2 text-left text-[11px] font-bold tracking-wide uppercase text-[var(--text-muted)] hover:text-[var(--indigo)] hover:bg-[var(--indigo-soft)] flex items-center gap-3 transition-colors">
                        <i data-lucide="edit-3" class="w-4 h-4"></i> Modifier
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

    // Re-init icons — ciblé sur tbody uniquement
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
// NOTES PAR LIGNE
// ============================================================
window.toggleNoteRow = function (realIndex) {
    if (window.activeNoteRow === realIndex) {
        window.activeNoteRow = null;
    } else {
        window.activeNoteRow = realIndex;
    }
    window.renderNeeds();
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
        window.renderNeeds();
    }
};

// ============================================================
// ÉDITION INLINE (saveNeedField + adjustNeedField)
// ============================================================

let _saveNeedDebounceTimer = null;
window.saveNeedField = function (realIndex, field, value) {
    if (!AppState.needs[realIndex]) return;
    AppState.needs[realIndex][field] = value;
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));

    clearTimeout(_saveNeedDebounceTimer);
    _saveNeedDebounceTimer = setTimeout(() => {
        window.renderNeeds();
    }, 600);
};

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

    clearTimeout(_saveNeedDebounceTimer);
    _saveNeedDebounceTimer = setTimeout(() => {
        window.renderNeeds();
    }, 500);
};

// Menu d'actions (3 petits points)
window.toggleNeedsActionMenu = function (realIndex) {
    const allMenus = document.querySelectorAll('[id^="needsActionMenu_"]');
    const targetMenu = document.getElementById(`needsActionMenu_${realIndex}`);

    allMenus.forEach(m => {
        if (m !== targetMenu) m.classList.add('hidden');
    });

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
// DUPLICATION DE LIGNE
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
// TRI PAR COLONNE
// ============================================================
window.sortNeedsBy = function (col) {
    if (AppState.needsSortCol === col) {
        AppState.needsSortDir = AppState.needsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        AppState.needsSortCol = col;
        AppState.needsSortDir = 'asc';
    }
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

// ============================================================
// RACCOURCIS CLAVIER
// ============================================================
document.addEventListener('keydown', function (e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
    }

    // Ctrl+S — Sauvegarder le projet
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        window.saveProject();
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
// DRAG & DROP — RÉORDONNER LES BESOINS
// ============================================================
let _draggedIndex = null;

window.onNeedDragStart = function (e, realIndex) {
    _draggedIndex = realIndex;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', realIndex);
    // Style visuel
    setTimeout(() => {
        e.target.closest('tr').classList.add('opacity-30');
    }, 0);
};

window.onNeedDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.target.closest('tr');
    if (row) {
        // Retirer le highlight des autres
        document.querySelectorAll('#needsTableBody tr.drag-over').forEach(r => r.classList.remove('drag-over', 'border-t-2', 'border-t-indigo-500'));
        row.classList.add('drag-over', 'border-t-2', 'border-t-indigo-500');
    }
};

window.onNeedDragEnd = function (e) {
    const row = e.target.closest('tr');
    if (row) row.classList.remove('opacity-30');
    document.querySelectorAll('#needsTableBody tr.drag-over').forEach(r => r.classList.remove('drag-over', 'border-t-2', 'border-t-indigo-500'));
    _draggedIndex = null;
};

window.onNeedDrop = function (e, targetIndex) {
    e.preventDefault();
    if (_draggedIndex === null || _draggedIndex === targetIndex) return;

    // Réordonner
    const item = AppState.needs.splice(_draggedIndex, 1)[0];
    AppState.needs.splice(targetIndex, 0, item);
    localStorage.setItem('art-needs', JSON.stringify(AppState.needs));

    _draggedIndex = null;
    window.renderNeeds();
};


// Fin ui.js


