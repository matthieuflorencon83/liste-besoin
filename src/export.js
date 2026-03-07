// export.js — Gestion des exports PDF et Excel
// Dépendances : jsPDF, jsPDF-AutoTable, SheetJS (XLSX)

// ============================================================
// EXPORT EXCEL (SheetJS)
// ============================================================
window.exportExcel = function () {
    if (!window.XLSX) { alert('SheetJS non disponible — vérifiez votre connexion.'); return; }
    if (!AppState.needs || AppState.needs.length === 0) { alert('Aucun article dans la liste des besoins.'); return; }

    const chantier = document.getElementById('chantierRef')?.value || 'Chantier';
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');

    // --- Build rows ---
    const headers = ['#', 'Fournisseur', 'Référence', 'Désignation', 'RAL / Finition', 'Conditionnement', 'PU Pièce HT (€)', 'Besoin', 'Stock', 'À commander', 'Total HT (€)', 'Note'];
    const rows = AppState.needs.map((item, i) => {
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
    const totalNeed = AppState.needs.reduce((s, i) => s + (parseFloat(i.need) || 0), 0);
    const totalStock = AppState.needs.reduce((s, i) => s + (parseFloat(i.stock) || 0), 0);
    const totalCmd = AppState.needs.reduce((s, i) => s + Math.max(0, (parseFloat(i.need) || 0) - (parseFloat(i.stock) || 0)), 0);
    const totalHT = AppState.needs.reduce((s, i) => {
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
// EXPORT PDF BDC (jsPDF + autoTable + logo Arts Alu)
// ============================================================
window.exportPDF = async function () {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
        alert('jsPDF non disponible — vérifiez votre connexion.');
        return;
    }
    if (!AppState.needs || AppState.needs.length === 0) {
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
    AppState.needs.forEach(item => {
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
        const resp = await fetch('images/logo_arts_alu.png');
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
            doc.addImage(logoData, 'PNG', 10, yPos, 55, 18);
        }

        // — Titre BDC —
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...GREEN);
        doc.text('BON DE COMMANDE', pageW / 2, yPos + 6, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK_TEXT);
        doc.text(`Référence : ${chantier}`, pageW / 2, yPos + 12, { align: 'center' });
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

/* --- EXPORT / ORDER FORM SYSTEM V2 --- */
// (Keep the existing V2 export functions)

window.openExportModalV2 = function () {

    const modal = document.getElementById('exportModal');
    const tabsContainer = document.getElementById('exportTabs');
    const chantier = document.getElementById('chantierRef').value || "Chantier Inconnu";

    // 1. Group by Supplier (Standard BDC)
    const groups = {};
    const allItems = [];
    const calpinageItems = [];

    AppState.needs.forEach(item => {
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
            window.renderBDCV2(id, data, chantier, type);
        };
        return btn;
    };

    // A. Special Tabs
    if (allItems.length > 0) {
        const tabAll = createTab('ALL', `TOUTE LA RÉFÉRENCE (${allItems.length})`, allItems, 'list');
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
};

window.renderBDCV2 = function (title, items, chantier, type) {
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
                        <td colspan="${!isBdc ? 8 : 6}" style="text-align: right; font-weight: 900; padding-top: 15px; border-top: 2px solid #059669; color: #059669; font-size: 14px;">TOTAL HT</td>
                        <td style="text-align: right; font-weight: 900; font-size: 14px; padding-top: 15px; border-top: 2px solid #059669; color: #000;">${totalGlobalHT.toFixed(2)} €</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    container.innerHTML = `
        <div class="bdc-header" style="background: #ffffff; padding: 10px 0 20px 0; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 3px solid #059669;">
            <img src="images/logo_arts_alu.png" alt="Arts Alu" style="height: 140px; object-fit: contain; filter: brightness(0.55) contrast(1.5) saturate(1.3);">
            <div style="text-align: right; margin-top: 10px;">
                <p style="font-size: 26px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                    ${type === 'calpinage' ? 'DÉTAIL CALPINAGE' : (type === 'list' ? 'LISTE COMPLÈTE' : 'BON DE COMMANDE')}
                </p>
                <p style="font-size: 14px; font-weight: 700; color: #475569;">Référence : <span style="color: #0f172a; font-weight: 900;">${chantier}</span></p>
                <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Date : ${date}</p>
            </div>
        </div>

        <div style="margin-bottom: 20px; background: #059669; padding: 8px 16px; border-radius: 6px; border-left: 4px solid #047857; display: inline-block;">
            <p style="font-size: 8px; text-transform: uppercase; font-weight: 900; color: rgba(255,255,255,0.7); letter-spacing: 1px; margin-bottom: 2px;">${type === 'bdc' ? 'FOURNISSEUR' : 'DOCUMENT'}</p>
            <h2 style="font-size: 16px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">${type === 'bdc' ? title : (title === 'ALL' ? 'Toute la Référence' : 'Feuille de Débits')}</h2>
        </div>

        ${contentHtml}

    `;
};

// Map the new function to the export action
window.exportToCSV = window.openExportModalV2;
