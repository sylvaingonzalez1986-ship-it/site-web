# Arène — interface rétro

Direction : menus de console et arcade des années 2000, sans changer le jeu.

- Palette conservée : vert forêt, crème, jaune et accents existants.
- Illustrations existantes conservées, dont Sylvain. Aucun nouvel asset généré.
- Accueil : trois choix, « Jouer » mis en avant, une accroche courte.
- Placard : sélection de modes illustrée, HUD repliable, solde lisible sur mobile.
- Culture et duel : panneaux plus compacts, étapes et scores hiérarchisés.
- Carnet et classements : en-têtes raccourcis, onglets et sélection harmonisés.
- Marché, catalogue et inventaire : même vocabulaire de panneaux ; aides secondaires dans des détails repliables.

Les règles de score restent consultables. Les confirmations irréversibles, prix,
conditions, avantages, risques et états désactivés sont conservés. Aucun changement
des API, calculs, tirages, inventaires, migrations ou permissions.

## Vérification visuelle isolée

`node scripts/audit-arena-retro.mjs`

Le script affiche les vrais composants avec des données fictives, sans fichiers
d’environnement ni base de données. Il bloque les requêtes externes et les écritures.
Il contrôle accueil, hub, marché et catalogue à plusieurs largeurs, la navigation
clavier, le HUD et le panier. Captures dans `output/arena-retro/`.

Limites : polices de secours et adaptateurs Next pour cette prévisualisation ;
elle ne remplace pas une recette connectée de toutes les étapes d’une partie,
du Carnet ou des classements avec les vraies données.
