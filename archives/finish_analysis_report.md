# Rapport d'Analyse : Finitions & Tarifs Installux

## 1. Analyse du Document `tarif-installux-fr.pdf`

Le document contient bien les grilles tarifaires et les définitions des finitions.

### Catégories Identifiées
- **Standard** : Comprend les teintes courantes (ex: 9010, 9016...).
- **Anodisation** : Mentionnée (Classe 20, AS20).
- **Laquage Spécifique** : Teintes "Hors Standard", "Métallisées", "Structurées".
- **Ton Bois** : Mentionné (Classe 1).
- **Brut** : Profils sans finition.

### Structure des Prix
Les tableaux de prix présentent généralement 5 colonnes. En croisant avec vos données actuelles (`data.js`), voici la correspondance probable :

| Colonne PDF | Type de Finition | Exemple de Prix (Ref 7637TH) | Correspondance `data.js` |
| :--- | :--- | :--- | :--- |
| **Col 1** | Brut (BT) | 39.40 € | 39.48 € (BT) |
| **Col 2** | Standard (9010) | 41.31 € | 41.12 € (9010) |
| **Col 3** | Laqué Plus (9016EM) | 44.31 € | 45.23 € (9016EM) |
| **Col 4** | Anodisé / Spécifique | 44.31 € | 48.93 € (AN0001/SPEC) |
| **Col 5** | Ton Bois / Haut de Gamme | 50.83 € | - |

*(Note : Les écarts minimes suggèrent des mises à jour tarifaires légères entre le PDF et la base de données extractée, mais la logique "Brut < 9010 < 9016EM < Anodisé" est respectée).*

## 2. Stratégie d'Implémentation "Auto-Prix"

Pour que le prix se mette à jour automatiquement selon la famille de RAL choisie, je propose la logique suivante :

### A. Recherche Exacte (Prioritaire)
Lorsqu'une finition est sélectionnée (ex: "9010" ou "7016"), le système cherchera d'abord dans la base de données (`data.js`) si une variante de l'article existe avec ce code décor exact.
*   *Exemple : Si je passe un article 7637TH en "9010", je prends le prix exact de la variante 9010 (41.12 €).*

### B. Recherche par Famille (Mapping)
Si le code exact n'existe pas (ex: RAL 3004), nous utiliserons un article de référence de la même "Famille de prix".
*   **Standard (9010, 9016...)** -> Prix de la variante `9010`.
*   **Autre RAL / Laqué** -> Prix de la variante `SPECIFIQ` ou `9016EM`.
*   **Anodisation** -> Prix de la variante `AN0001` ou `AS20`.
*   **Brut** -> Prix de la variante `BT`.

### C. Fallback (Coefficient)
Si aucune variante n'est trouvée (article unique sans déclinaison), nous appliquerons une plus-value par défaut sur le prix de base (Brut) :
*   Standard : +5%
*   Autre RAL : +15%
*   Anodisé : +25%

## 3. Plan d'Action

1.  **Ajout de la Colonne Prix** : Modifier `app.js` pour afficher une colonne "P.U. HT" dans la liste des besoins.
2.  **Mise à jour de la Modal Finitions** :
    *   Lors du choix d'une famille (Standard, Anodisation...), recalculer le prix prévisionnel.
    *   Au clic sur "APPLIQUER", mettre à jour le prix de l'article dans la liste.
3.  **Exclusion BDC** : S'assurer que l'export "Bon de Commande" continue de masquer les prix (déjà le cas, à confirmer).

*Note : La mention "Arcelor" n'a pas été trouvée explicitement dans le texte, mais est probablement couverte par les finitions "Laqué" ou "Ton Bois" fournies par des prestataires utilisant des tôles Arcelor.*
