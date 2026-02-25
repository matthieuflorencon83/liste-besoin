// --- MODULE CALPINAGE (INLINE) ---
window.isCalpinageMode = localStorage.getItem('art-calpinage-mode') === 'true';
window.activeCalpinageId = localStorage.getItem('art-active-calpinage-id') || null;

window.getIsProfil = function (item) {
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
    window.isCalpinageMode = !window.isCalpinageMode;
    localStorage.setItem('art-calpinage-mode', window.isCalpinageMode);
    // Clicking the main button resets individual focus
    window.activeCalpinageId = null;
    localStorage.removeItem('art-active-calpinage-id');

    const btn = document.getElementById('mainCalpinageBtn');
    if (btn) {
        if (window.isCalpinageMode) {
            btn.classList.add('bg-orange-500', 'text-white', 'border-orange-600');
            btn.classList.remove('bg-white', 'text-zinc-900', 'border-zinc-200');
        } else {
            btn.classList.remove('bg-orange-500', 'text-white', 'border-orange-600');
            btn.classList.add('bg-white', 'text-zinc-900', 'border-zinc-200');
        }
    }
    window.renderNeeds();
};

window.toggleCalpinageRow = (id) => {
    const idx = window.needs.findIndex(n => n.id === id);
    if (idx === -1) return;

    if (window.activeCalpinageId === id) {
        window.activeCalpinageId = null;
        localStorage.removeItem('art-active-calpinage-id');
    } else {
        window.activeCalpinageId = id;
        localStorage.setItem('art-active-calpinage-id', id);
        // Individual focus collapses others (turn off global mode)
        if (window.isCalpinageMode) {
            window.isCalpinageMode = false;
            localStorage.setItem('art-calpinage-mode', false);
            const btn = document.getElementById('mainCalpinageBtn');
            if (btn) {
                btn.classList.remove('bg-orange-500', 'text-white', 'border-orange-600');
                btn.classList.add('bg-white', 'text-zinc-900', 'border-zinc-200');
            }
        }
        setTimeout(() => CalpinageSystem.initRow(idx), 50);
    }
    window.renderNeeds();
};

const CalpinageSystem = {
    initRow(idx) {
        try {
            if (!window.needs[idx].calpinageData) {
                window.needs[idx].calpinageData = { cuts: [], lastSolution: null };
            }
            this.renderRowUI(idx);

            // Re-show last results if any
            if (window.needs[idx].calpinageData.lastSolution) {
                this.renderResults(idx, window.needs[idx].calpinageData.lastSolution);
            }
        } catch (e) {
            console.error("Error initRow:", e);
            const c = document.getElementById(`calpContainer_${idx}`);
            if (c) c.innerHTML = `<div class="text-red-500 p-4">Erreur d'initialisation: ${e.message}</div>`;
        }
    },

    renderRowUI(idx) {
        try {
            const item = window.needs[idx];
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
                    <div class="w-full lg:w-1/3 bg-[var(--card)] p-4 rounded border border-[var(--border)] flex flex-col">
                        <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase mb-3 flex justify-between">
                            <span>Débits (Coupes)</span>
                        </h4>
                        <div class="flex-1 overflow-y-auto max-h-40 mb-3 bg-[var(--card-hover)] rounded border border-[var(--border)]">
                            <table class="w-full text-left text-sm">
                                <tbody id="calpTable_${idx}"></tbody>
                            </table>
                        </div>
                        <div class="flex gap-2">
                            <input type="number" id="cutLen_${idx}" placeholder="Long (mm)" step="1" class="w-32 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--text-main)] px-2 py-1 text-sm focus:border-[var(--indigo)] outline-none transition-colors">
                            <input type="number" id="cutQty_${idx}" placeholder="Qté" value="1" class="w-16 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--text-main)] px-2 py-1 text-sm focus:border-[var(--indigo)] outline-none transition-colors">
                            <button onclick="CalpinageSystem.addCut(${idx})" class="px-3 py-1 bg-[var(--card-hover)] hover:bg-[var(--border)] text-[var(--text-main)] rounded text-xs font-bold transition-colors">+</button>
                        </div>
                        <div class="mt-2 flex justify-end">
                                <button id="btnCalc_${idx}" onclick="CalpinageSystem.optimize(${idx})" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all">CALCULER</button>
                        </div>
                    </div>

                    <!-- 2. Résultats -->
                    <div class="flex-1 bg-[var(--card)] p-4 rounded border border-[var(--border)] flex flex-col">
                        <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase mb-3">Optimisation & Chutes</h4>
                        <div id="calpRes_${idx}" class="flex-1 overflow-y-auto max-h-60 bg-[var(--card-hover)] rounded border border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">
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
            if (!window.needs[idx].calpinageData) window.needs[idx].calpinageData = { cuts: [] };
            const cuts = window.needs[idx].calpinageData.cuts || [];
            cuts.push({ length: length / 1000, quantity });
            cuts.sort((a, b) => b.length - a.length);
            window.needs[idx].calpinageData.cuts = cuts;

            localStorage.setItem('art-needs', JSON.stringify(window.needs));

            this.renderCutsTable(idx);
            lenInput.value = ""; qtyInput.value = "1"; lenInput.focus();
        } else {
            alert("Veuillez saisir une longueur et une quantité valides.");
        }
    },

    removeCut(idx, cutIdx) {
        const cuts = window.needs[idx].calpinageData.cuts;
        cuts.splice(cutIdx, 1);
        localStorage.setItem('art-needs', JSON.stringify(window.needs));
        this.renderCutsTable(idx);
    },

    renderCutsTable(idx) {
        const tbody = document.getElementById(`calpTable_${idx}`);
        if (!tbody) return;
        const cuts = (window.needs[idx].calpinageData && window.needs[idx].calpinageData.cuts) ? window.needs[idx].calpinageData.cuts : [];
        tbody.innerHTML = cuts.map((c, i) => `
            <tr class="border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)] transition-colors">
                <td class="p-2 text-[var(--indigo)] font-bold">${Math.round(c.length * 1000)}mm</td>
                <td class="p-2 font-bold text-[var(--text-main)]">x${c.quantity}</td>
                <td class="p-2 text-right"><button onclick="CalpinageSystem.removeCut(${idx}, ${i})" class="text-[var(--text-muted)] hover:text-[var(--rose)] transition-colors">x</button></td>
            </tr>
        `).join('');
    },

    optimize(idx) {
        try {
            const item = window.needs[idx];
            const groups = this.getGroupedProfiles();
            const cleanRef = this.getCleanRoot(item.reference);

            // Match by root and normalize RAL for comparison
            let group = groups.find(g => {
                const rootMatch = (g.rootRef === cleanRef || g.displayRef === item.reference);
                const fourMatch = (g.fournisseur === item.fournisseur);
                const ralA = (g.decor || '-');
                const ralB = (item.ral || '-');
                return rootMatch && fourMatch && ralA === ralB;
            });

            // Fallback: If strict match fails, try finding ANY profile with same Ref + Supplier (ignore RAL)
            if (!group) {
                group = groups.find(g => {
                    const rootMatch = (g.rootRef === cleanRef || g.displayRef === item.reference);
                    const fourMatch = (g.fournisseur === item.fournisseur);
                    return rootMatch && fourMatch;
                });
            }

            if (!group) {
                alert("Profil non trouvé ou non compatible pour le calpinage. (Ref: " + item.reference + ")");
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
            <div class="p-4 bg-[var(--amber)]/10 border border-[var(--amber)]/30 rounded-lg">
                <div class="flex items-center gap-2 text-[var(--amber)] mb-3 font-bold">
                    <i data-lucide="scissors" class="w-5 h-5"></i>
                    COUPE TROP LONGUE (${mm}mm)
                </div>
                <p class="text-xs text-[var(--amber)]/80 mb-4">
                    Cette pièce est plus longue que la plus grande barre disponible (${maxMm}mm). 
                    Où souhaitez-vous effectuer la coupe de raccord ?
                </p>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-[10px] uppercase text-[var(--text-muted)] mb-1">Partie A (mm)</label>
                        <input type="number" id="splitA_${idx}" value="${Math.min(mm - 500, maxMm - 100)}" 
                               class="w-full bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-main)] text-sm focus:border-[var(--amber)] outline-none"
                               oninput="document.getElementById('splitB_${idx}').value = ${mm} - this.value">
                    </div>
                    <div>
                        <label class="block text-[10px] uppercase text-[var(--text-muted)] mb-1">Partie B (mm)</label>
                        <input type="number" id="splitB_${idx}" value="${mm - Math.min(mm - 500, maxMm - 100)}" 
                               class="w-full bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-main)] text-sm focus:border-[var(--amber)] outline-none"
                               oninput="document.getElementById('splitA_${idx}').value = ${mm} - this.value">
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button onclick="CalpinageSystem.confirmSplit(${idx}, ${cutLen})" 
                            class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition-colors">
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
        const cuts = window.needs[idx].calpinageData.cuts;
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
            window.needs[idx].calpinageData.cuts = cuts;
            localStorage.setItem('art-needs', JSON.stringify(window.needs));
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

        let html = `<div class="mb-4 flex items-center justify-between bg-[var(--card-hover)] p-2 rounded">`;
        html += `<div class="flex flex-wrap gap-2">`;
        Object.values(synthesis).forEach(s => {
            html += `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--indigo)]/20 text-[var(--indigo)] border border-[var(--indigo)]/30">
                <span class="font-bold mr-1">${s.count}x</span> Barre ${s.length}m
                </span>`;
        });
        html += `</div>`;
        // Serializing solution to pass it back to applyToRow
        // Save solution to prevent disappearance upon re-opening
        if (!window.needs[idx].calpinageData) window.needs[idx].calpinageData = {};
        window.needs[idx].calpinageData.lastSolution = solution;
        localStorage.setItem('art-needs', JSON.stringify(window.needs));

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
                    <div class="h-9 w-full bg-[var(--card-hover)] rounded-md flex overflow-hidden relative border border-[var(--border)]">
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
                        <div class="h-full flex-1 bg-[var(--text-muted)] opacity-30"></div>
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
            const originalItem = window.needs[idx];
            const originalCalpData = originalItem.calpinageData;

            // 1. Group solution by explicit references (variants)
            const barsToOrder = {};
            solution.forEach(bar => {
                const ref = bar.stockVariant.ref;
                if (!barsToOrder[ref]) barsToOrder[ref] = 0;
                barsToOrder[ref]++;
            });

            // 2. Add/Update items in window.needs
            // We remove the original generic row and replace it with specific bars
            const itemsToAdd = [];

            for (const [vRef, qty] of Object.entries(barsToOrder)) {
                let itData = window.ART_DATA.find(it => {
                    const refMatch = String(it.reference) === String(vRef);
                    const fourMatch = (it.fournisseur === originalItem.fournisseur);
                    const ralMatch = ((it.decor || '-') === (originalItem.ral || '-'));
                    // Gamme check might be too strict if data is messy, let's prioritize Ref+Four+Ral
                    return refMatch && fourMatch && ralMatch;
                });

                // FALLBACK: If strict match fails, look for Ref + Supplier only (ignore RAL)
                if (!itData) {
                    itData = window.ART_DATA.find(it => {
                        const refMatch = String(it.reference) === String(vRef);
                        const fourMatch = (it.fournisseur === originalItem.fournisseur);
                        return refMatch && fourMatch;
                    });
                }

                if (itData) {
                    const newId = `${itData.reference}_${itData.fournisseur || itData.fabricant || ''}_${originalItem.ral || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // We construct the new item, preserving the ORIGINAL User RAL
                    itemsToAdd.push({
                        id: newId,
                        reference: itData.reference,
                        designation: itData.designation,
                        fournisseur: itData.fournisseur || itData.fabricant || 'Catalogue',
                        ral: originalItem.ral || '-', // KEEP USER RAL
                        ral_finish: originalItem.ral_finish || '', // Keep finish
                        longueur: itData.condit || itData.longueur || 1, // Use the STOCK length
                        unit_condit: itData.unit_condit || 'M',
                        type: itData.type || 'Profilé',
                        need: qty,
                        stock: 0,
                        px_public: itData.px_public || 0,
                        calpinageData: null // Will be set below
                    });
                } else {
                    // Critical Fallback: Use original item data if DB lookup completely fails
                    itemsToAdd.push({
                        ...originalItem,
                        need: qty,
                        // Update length if we can guess it from vRef, otherwise keep original
                        id: originalItem.id + '_calc'
                    });
                }
            }

            // Remove original
            window.needs.splice(idx, 1);
            let insertIndex = idx;

            // Insert new items
            itemsToAdd.forEach(newItem => {
                // Check if existing to merge
                const existing = window.needs.find(n => n.id === newItem.id);
                // Calculate Cuts for this specific variant
                const specificSolution = solution.filter(bar => String(bar.stockVariant.ref) === String(newItem.reference));
                // ... (Reconstruct cuts logic)
                const mergedCuts = [];
                specificSolution.forEach(bar => {
                    bar.cuts.forEach(c => {
                        const ex = mergedCuts.find(mc => Math.abs(mc.length - c) < 0.0001);
                        if (ex) ex.quantity++; else mergedCuts.push({ length: c, quantity: 1 });
                    });
                });
                mergedCuts.sort((a, b) => b.length - a.length);

                newItem.calpinageData = {
                    cuts: mergedCuts,
                    lastSolution: specificSolution
                };

                if (existing) {
                    existing.need += newItem.need;
                    // Merge calpinage data? Complex. For now overwrite or append? 
                    // Let's just overwrite for simplicity in this specific flow
                    existing.calpinageData = newItem.calpinageData;
                } else {
                    window.needs.splice(insertIndex, 0, newItem);
                    insertIndex++;
                }
            });

            localStorage.setItem('art-needs', JSON.stringify(window.needs));
            window.activeCalpinageId = null;
            localStorage.removeItem('art-active-calpinage-id');
            window.renderNeeds();
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
        // Use window.ART_DATA instead of window.groupedData to see all lengths
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

window.CalpinageSystem = CalpinageSystem;
