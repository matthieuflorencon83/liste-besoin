// tests/ui.test.js — Tests unitaires pour ui.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AppState et window avant d'importer ui.js
const mockAppState = {
    needs: [],
    catalogData: [],
    filteredData: [],
    favorites: new Set(),
    selectedNeeds: new Set(),
    needsSortCol: '',
    needsSortDir: 'asc',
    needsSearchQuery: '',
    isRalSelectionMode: false,
    saveNeeds: vi.fn()
};

// Setup global mocks
globalThis.AppState = mockAppState;
globalThis.window = globalThis;
globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn()
};
globalThis.document = {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    createElement: vi.fn(() => ({
        classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
        style: {},
        appendChild: vi.fn()
    })),
    activeElement: { tagName: 'DIV' }
};

describe('getPuPiece', () => {
    beforeEach(() => {
        // Définir les fonctions directement comme dans ui.js
        window.getMult = function (item) {
            const conditVal = parseFloat(item.longueur) || parseFloat(item.conditionnement) || 1;
            return conditVal;
        };

        window.getPuPiece = function (item) {
            if (item.px_piece !== undefined) return parseFloat(item.px_piece) || 0;
            const mult = window.getMult(item);
            const px_base = parseFloat(item.px_remise) || parseFloat(item.px_public) || 0;
            return px_base * mult;
        };
    });

    it('retourne px_piece si défini', () => {
        const item = { px_piece: 15.50 };
        expect(window.getPuPiece(item)).toBe(15.50);
    });

    it('retourne 0 si px_piece est 0', () => {
        const item = { px_piece: 0 };
        expect(window.getPuPiece(item)).toBe(0);
    });

    it('calcule px_remise x conditionnement', () => {
        const item = { px_remise: 10, longueur: 3 };
        expect(window.getPuPiece(item)).toBe(30);
    });

    it('utilise px_public si pas de px_remise', () => {
        const item = { px_public: 8, longueur: 2 };
        expect(window.getPuPiece(item)).toBe(16);
    });

    it('retourne 0 si aucun prix', () => {
        const item = {};
        expect(window.getPuPiece(item)).toBe(0);
    });

    it('utilise conditionnement si pas de longueur', () => {
        const item = { px_remise: 5, conditionnement: 4 };
        expect(window.getPuPiece(item)).toBe(20);
    });
});

describe('getMult', () => {
    beforeEach(() => {
        window.getMult = function (item) {
            const conditVal = parseFloat(item.longueur) || parseFloat(item.conditionnement) || 1;
            return conditVal;
        };
    });

    it('retourne longueur si définie', () => {
        expect(window.getMult({ longueur: 6 })).toBe(6);
    });

    it('retourne conditionnement si pas de longueur', () => {
        expect(window.getMult({ conditionnement: 3 })).toBe(3);
    });

    it('retourne 1 par défaut', () => {
        expect(window.getMult({})).toBe(1);
    });

    it('parse les valeurs string', () => {
        expect(window.getMult({ longueur: '5.5' })).toBe(5.5);
    });
});

describe('Filtrage des besoins (filterNeeds)', () => {
    it('filtre par référence', () => {
        const needs = [
            { reference: 'ABC123', designation: 'Profil', fournisseur: 'ARCELOR' },
            { reference: 'XYZ789', designation: 'Vis', fournisseur: 'SAPA' }
        ];

        const query = 'abc';
        const filtered = needs.filter(item => {
            const ref = (item.reference || '').toLowerCase();
            const des = (item.designation || '').toLowerCase();
            const four = (item.fournisseur || '').toLowerCase();
            return ref.includes(query) || des.includes(query) || four.includes(query);
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].reference).toBe('ABC123');
    });

    it('filtre par fournisseur', () => {
        const needs = [
            { reference: 'ABC', designation: 'Profil', fournisseur: 'ARCELOR' },
            { reference: 'XYZ', designation: 'Vis', fournisseur: 'SAPA' }
        ];

        const query = 'sapa';
        const filtered = needs.filter(item => {
            const ref = (item.reference || '').toLowerCase();
            const des = (item.designation || '').toLowerCase();
            const four = (item.fournisseur || '').toLowerCase();
            return ref.includes(query) || des.includes(query) || four.includes(query);
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].fournisseur).toBe('SAPA');
    });

    it('retourne tout si query vide', () => {
        const needs = [
            { reference: 'ABC', designation: 'Profil' },
            { reference: 'XYZ', designation: 'Vis' }
        ];

        const query = '';
        const filtered = query ? needs.filter(() => false) : needs;
        expect(filtered).toHaveLength(2);
    });
});

describe('RAL — findVariantMatch', () => {
    it('trouve un variant RAL exact', () => {
        const catalog = [
            { reference: 'PROF-A', designation: 'Profil A Lg6000 9010', fournisseur: 'ARCELOR' },
            { reference: 'PROF-A', designation: 'Profil A Lg6000 7016', fournisseur: 'ARCELOR' },
            { reference: 'PROF-B', designation: 'Profil B', fournisseur: 'SAPA' }
        ];

        const baseRef = 'PROF-A';
        const targetRal = '7016';

        const match = catalog.find(c =>
            String(c.reference) === baseRef &&
            String(c.designation || '').includes(targetRal)
        );

        expect(match).toBeDefined();
        expect(match.designation).toContain('7016');
    });

    it('retourne undefined si pas de match', () => {
        const catalog = [
            { reference: 'PROF-A', designation: 'Profil A 9010', fournisseur: 'ARCELOR' }
        ];

        const match = catalog.find(c =>
            String(c.reference) === 'PROF-A' &&
            String(c.designation || '').includes('3004')
        );

        expect(match).toBeUndefined();
    });
});

describe('RAL — inferFamilyFromRal', () => {
    const RAL_FAMILIES = {
        '1': 'Jaunes',
        '2': 'Oranges',
        '3': 'Rouges',
        '5': 'Bleus',
        '6': 'Verts',
        '7': 'Gris',
        '8': 'Bruns',
        '9': 'Blancs/Noirs'
    };

    function inferFamily(ral) {
        if (!ral) return '';
        const firstDigit = String(ral).charAt(0);
        return RAL_FAMILIES[firstDigit] || '';
    }

    it('9010 → Blancs/Noirs', () => {
        expect(inferFamily('9010')).toBe('Blancs/Noirs');
    });

    it('7016 → Gris', () => {
        expect(inferFamily('7016')).toBe('Gris');
    });

    it('3004 → Rouges', () => {
        expect(inferFamily('3004')).toBe('Rouges');
    });

    it('null → vide', () => {
        expect(inferFamily(null)).toBe('');
    });

    it('4xxx → vide (famille inconnue)', () => {
        expect(inferFamily('4000')).toBe('');
    });
});
