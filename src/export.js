// export.js - Gestion des exports PDF et Excel
// Dépendances : jsPDF, jsPDF-AutoTable, SheetJS (XLSX)

// ============================================================
// EXPORT EXCEL (SheetJS)
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
// EXPORT PDF BDC (jsPDF + autoTable + logo Arts Alu)
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
