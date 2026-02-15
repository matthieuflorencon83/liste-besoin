
function getCleanRoot(ref, length) {
    if (!ref) return "";
    let root = String(ref).toUpperCase().trim();

    // CURRENT LOGIC FROM index.html (Modified with Exception)
    const exceptions = ['7760']; // Articles that should NOT be grouped by length suffix
    const isException = exceptions.some(e => root.startsWith(e));

    if (!isException) {
        // Strip common length suffixes (/4.5, /6.5, /4.7)
        root = root.replace(/\/[\d\.]+(th|TH)?$/i, '');
    }

    // Strip TH suffix (Always do this or strictly for clean roots?)
    // If we kept 7760/4TH as 7760/4TH above, the TH strip below turns it into 7760/4
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
        // Don't strip if exception? Or safe to strip pure numbers?
        // Usually safe.
        root = root.replace(/\d{3,4}$/, '');
    }

    return root.replace(/[\/-]+$/, ''); // Strip trailing separators
}

function getGroupedProfiles(data) {
    const groups = new Map();
    data.forEach(item => {
        const des = (item.designation || '').toUpperCase();
        // Assume isProfil is true for this test

        let length = parseFloat(item.conditionnement || item.longueur);
        if (!length || isNaN(length)) {
            const match = String(item.reference).match(/\/([\d\.]+)/);
            if (match) length = parseFloat(match[1]);
        }

        const root = getCleanRoot(item.reference, length);
        const decorNorm = (item.decor || '-');
        const key = `${root}|${item.fournisseur}|${(item.gamme || '').trim().toUpperCase()}|${decorNorm}`;

        if (!groups.has(key)) {
            groups.set(key, { key, rootRef: root, variants: [] });
        }
        groups.get(key).variants.push({ ref: item.reference, length: length });
    });
    return Array.from(groups.values());
}

const mockData = [
    { reference: "7760TH", designation: "SABLIERE", fournisseur: "ARCELOR", decor: "9010", longueur: 6.5 },
    { reference: "7760/4TH", designation: "SABLIERE", fournisseur: "ARCELOR", decor: "9010", longueur: 4.5 },
    // Generic case that SHOULD be grouped
    { reference: "TEST/6", designation: "TEST", fournisseur: "ARCELOR", decor: "9010", longueur: 6.0 },
    { reference: "TEST/3", designation: "TEST", fournisseur: "ARCELOR", decor: "9010", longueur: 3.0 }
];

const groups = getGroupedProfiles(mockData);
console.log(JSON.stringify(groups, null, 2));

// We expect 3 groups:
// 1. 7760TH  (root 7760)
// 2. 7760/4TH (root 7760/4)
// 3. TEST (root TEST, containing both TEST/6 and TEST/3)

if (groups.length === 3) {
    const g7760 = groups.find(g => g.rootRef === '7760');
    const g77604 = groups.find(g => g.rootRef === '7760/4');
    const gTest = groups.find(g => g.rootRef === 'TEST');

    if (g7760 && g77604 && gTest && gTest.variants.length === 2) {
        console.log("SUCCESS: 7760s are separated, TESTs are grouped.");
    } else {
        console.log("FAILURE: Groups found but content mismatch.", JSON.stringify(groups, null, 2));
    }
} else {
    console.log("FAILURE: Expected 3 groups, found " + groups.length);
    console.log(JSON.stringify(groups, null, 2));
}
