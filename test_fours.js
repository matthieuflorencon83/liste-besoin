const fs = require('fs');

const data_balitrand = JSON.parse(fs.readFileSync('data_balitrand.json', 'utf8'));

function processData(data) {
    const map = new Map();
    data.forEach(item => {
        if (item.fournisseur) {
            item.fournisseur = item.fournisseur.toString().trim().toUpperCase();
        }
        if (item.fabricant) {
            item.fabricant = item.fabricant.toString().trim().toUpperCase();
        }
        const key = `${item.reference}_${item.fournisseur || item.fabricant || ''}_${item.designation}`.toLowerCase();
        if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
}

const groupedData = processData(data_balitrand);

const fours = new Set();
groupedData.forEach(d => {
    if (d.fournisseur) fours.add(d.fournisseur);
});

console.log("Fournisseurs extraits:", Array.from(fours));
