# Arène — cohérence des espaces, 10 septembre 2026

La référence est l'accueil à trois scènes décrit dans `ARENA-FULLSCREEN-SCENES.md`.

## Direction appliquée

- Dégustation, Placard et Classement partagent `ArenaSceneHeader` : illustration du mode, titre, retour à l'Arène et navigation avec état actif crème souligné d'or.
- Le Carnet conserve ses onglets Regular / Concours / Fleurs, distincts du choix d'espace. Le lien Placard respecte l'état d'accès transmis par le serveur.
- Fond vert sombre, panneaux de lecture crème, commandes rectangulaires et accents jaunes. Les animations d'arrivée respectent la réduction des mouvements.
- Le jeu, le marché, le catalogue, l'inventaire et l'accès au catalogue dans la boutique reprennent ces couleurs et ces commandes. Les illustrations des cartes et les gestes du carnet restent conservés.
- Les règles, calculs, routes, achats, confirmations de vente et permissions ne sont pas modifiés.

## Vérification

`node scripts/audit-arena-retro.mjs --sections` couvre les vrais composants Dégustation, Classement, classement des fleurs, Placard, marché et catalogue à 320, 390, 768 et 1 440 px. Il vérifie les débordements, la navigation clavier, l'état actif, l'ouverture et la fermeture du carnet, le HUD et le panier matériel.

Les variantes `--dice` et `--reputation` contrôlent respectivement le lancer (y compris erreur et animation bloquée) et les confirmations / reçus de ventes positives, neutres et pénalisantes.

Captures dans `output/arena-retro/`. Ces aperçus utilisent des données fictives et des polices de secours. Le compteur de récompenses y est volontairement indisponible ; cela ne décrit pas son état en production. Ils ne remplacent pas une manipulation sur téléphone physique avec un compte connecté.

## Lecture visuelle des données — 18 octobre 2026

Les écrans commencent par les chiffres utiles, un graphique adapté et l'action suivante. Les explications secondaires passent dans des détails repliables ; les coûts, conditions, erreurs et confirmations restent visibles au moment de décider. Cette règle commune est inscrite dans `AGENTS.md`.

Les anciens fonds marron du jeu sont remplacés par un orange abricot chaleureux (`--game-surface-warm`, `#ffad5c`), commun aux panneaux, bandeaux et accents. Les surfaces crème, textes vert sombre et commandes dorées conservent la hiérarchie visuelle.

`KqVisuals.tsx` fournit trois composants partagés : progression vers un objectif réel, comparaison de quantités sur une même échelle et répartition d'un total. Les valeurs et unités restent lisibles sans dépendre des couleurs. Les valeurs négatives conservent leur signe, les prévisions sont identifiées et une donnée indisponible ne devient pas un zéro. Aucun historique n'est inventé.

- Banque : courbe du crédit, curseur de montant, répartition capital/intérêts et échéancier interactif. Le plafond effectivement renvoyé par le serveur fait autorité, y compris avant application de la migration progressive.
- Finances : fonds disponibles, factures, résultat et bilan, livret et portefeuilles crypto/actions. Une cotation manquante suspend la comparaison de valorisation du portefeuille.
- Commerce : stocks et demande, prix et marge prévisionnelle, campagnes, objectifs du site et progression de l'activité.
- Production : étapes des récoltes, états du matériel, consommation d'énergie et couverture solaire ; les graphiques utiles déjà présents dans les entrepôts sont conservés.
- Progression et compétition : carrière, missions, profil, duels, composition du classement et écarts de critères dans le bilan du jury.

### Contrôles de cette évolution

TypeScript, ESLint ciblé et tests des domaines modifiés passent. Les audits navigateur utilisent des réponses simulées et couvrent les petits écrans à partir de 320 px ainsi que le bureau, les interactions existantes et l'absence de débordement. Les modes ciblés ci-dessous laissent disponibles les parcours complets des scripts historiques :

```powershell
node scripts/audit-placard-treasury.mjs --bank-only
node scripts/audit-placard-treasury.mjs --finance-visuals-only
node scripts/audit-placard-stocks.mjs
node scripts/audit-shop-tycoon.mjs
node scripts/audit-placard-culture-wear.mjs --components-only
node scripts/audit-placard-harvests-navigation.mjs --harvests-only
node scripts/audit-chanvrier-career-ui.mjs --career-only
node scripts/audit-placard-missions.mjs
node scripts/audit-arena-recap.mjs --jury-only
```

Rapports et captures dans les sous-dossiers correspondants de `output/`. Les validations locales ne constituent pas un déploiement ni un parcours connecté sur la base de production.
