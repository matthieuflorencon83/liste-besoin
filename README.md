# 🏗️ Arts Alu Zen — Catalogue & Liste de Besoins

Application web métier de gestion de catalogue d'articles et de listes de besoins pour **Arts Alu** (menuiserie aluminium).

## 🚀 Fonctionnalités

- **Catalogue interactif** — Recherche, filtres par fournisseur/type/série, vues multiples (grille, compact, mini, liste)
- **Liste de besoins** — Gestion des quantités, stock, calcul automatique des commandes
- **Système RAL / Finitions** — Application en lot avec recherche de variantes dans le catalogue
- **Calpinage** — Optimisation de découpe de profilés aluminium
- **Export** — Bon de commande PDF et Excel par fournisseur
- **Gestion de projets** — Sauvegarde / chargement de projets JSON
- **Mode sombre / clair** — Thème adaptatif
- **Cache IndexedDB** — Chargement rapide des données catalogue

## 📦 Prérequis

- **Python 3.10+** (pour le serveur local)
- **Navigateur moderne** (Chrome, Edge, Firefox)
- **BDD Excel** : fichier `BDD Arts Alu 2026.xlsx` à la racine du projet

## ⚡ Installation & Lancement

```bash
# 1. Cloner le dépôt
git clone https://github.com/matthieuflorencon83/liste-besoin.git
cd liste-besoin

# 2. Générer les fichiers JSON de données (depuis le fichier Excel)
python extract_data.py

# 3. Lancer le serveur
python server.py

# 4. Ouvrir dans le navigateur
# http://localhost:8000
```

Ou simplement double-cliquer sur **`start_app.bat`** / **`Lancer_Catalogue.bat`**.

## 📂 Structure du Projet

```
├── index.html              # Page principale (SPA)
├── style.css               # Feuille de styles (thème clair/sombre)
├── server.py               # Serveur Python (API ajout/modif articles)
├── extract_data.py         # Script d'extraction Excel → JSON
├── catalog_index.json      # Index des sources de données (généré)
├── data_*.json             # Données catalogue par fournisseur (généré)
├── src/
│   ├── main.js             # Point d'entrée (chargement données)
│   ├── store.js            # État global centralisé (AppState)
│   ├── state.js            # Logique catalogue (filtres, rendu, favoris)
│   ├── ui.js               # Interface besoins (tableau, prix, édition)
│   ├── ral.js              # Gestion RAL / finitions / variantes
│   ├── export.js           # Export PDF et Excel
│   ├── modals.js           # Modales (ajout, édition, fiche article)
│   ├── calpinage.js        # Module de calpinage (optimisation découpe)
│   └── db.js               # Couche IndexedDB (cache)
├── scripts/
│   ├── add_article_to_excel.py
│   └── edit_article_in_excel.py
└── images/                 # Images des articles
```

## 🛠️ Technologies

| Composant | Technologie |
|---|---|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Styling | CSS Custom Properties + TailwindCSS (CDN) |
| Icônes | Lucide Icons |
| Export PDF | jsPDF + AutoTable |
| Export Excel | SheetJS (XLSX) |
| Cache | IndexedDB |
| Serveur | Python `http.server` |
| Données | Excel (.xlsx) → JSON |

## 📝 Licence

Projet interne Arts Alu — Usage professionnel.
