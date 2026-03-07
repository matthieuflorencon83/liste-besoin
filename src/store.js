// store.js - State Management Centralisé (ES6 Module)

export const AppState = {
    needs: [],
    catalogData: [],
    filteredData: [],

    // UI State
    viewMode: 'grid',
    showFavoritesOnly: false,
    favorites: new Set(),
    selectedNeeds: new Set(),

    // Filters & Sorting
    filters: {},
    currentFamilyFilter: '',
    currentSupplierFilter: '',
    searchQuery: '',
    needsSearchQuery: '',
    needsSortCol: 'fournisseur',
    needsSortDir: 'asc',

    // Modal Callbacks & Custom State
    isRalSelectionMode: false,
    openRalCallback: null,

    // Methods
    init() {
        try {
            const savedNeeds = localStorage.getItem('art-needs');
            if (savedNeeds) {
                this.needs = JSON.parse(savedNeeds);
            }

            const savedFavs = localStorage.getItem('art-favorites');
            if (savedFavs) {
                this.favorites = new Set(JSON.parse(savedFavs));
            }

            const savedView = localStorage.getItem('art-view-mode');
            if (savedView) {
                this.viewMode = savedView;
            }
        } catch (e) {
            console.error("Erreur de chargement du state initial", e);
        }
    },

    saveNeeds() {
        localStorage.setItem('art-needs', JSON.stringify(this.needs));
    },

    saveFavorites() {
        localStorage.setItem('art-favorites', JSON.stringify([...this.favorites]));
    },

    saveViewMode() {
        localStorage.setItem('art-view-mode', this.viewMode);
    }
};

// Initialize early
AppState.init();

// Rétro-compatibilité : expose sur window pour les scripts inline
window.AppState = AppState;
