# Héritages des producteurs — 25 septembre 2026

La première série (v1), générée avec l’outil intégré `image_gen`, a été rejetée car elle interprétait trop librement l’identité des producteurs. La reprise v2 du 26 septembre s’appuie sur leurs sources exactes : logos complets et immédiatement reconnaissables, portraits fidèles, rendus dans la gravure dorée des huit Héritages historiques. Les noms et les capacités sont conservés, notamment le +3 en Floraison d’Iznofarm. Les quinze rectos affichent le producteur, le pouvoir, le moment d’activation et ses limites.

Les sept nouvelles illustrations sont des panneaux paysage. Leur composition conserve le logo ou le portrait entier dans la fenêtre du recto, avec un point de cadrage central `focalY: 0.5`. Les huit illustrations historiques et leur cadrage restent inchangés.

| Producteur | Carte | Capacité (une fois par culture) |
| --- | --- | --- |
| Cannapache | Canopée attentive | En Floraison, transforme tous les dés neutres en réussites. |
| Cap Estuaire | Affinage de l’estuaire | À la dernière étape, transforme le dé le plus faible en Étincelle. |
| Skud Farm | Précision indoor | Transforme tous les Dangers d’un lancer en réussites. |
| 3 Feuilles | Sélection du vivant | Avant le lancer, arme cinq dés et conserve les trois meilleurs. |
| Kanadea | Éveil pyrénéen | En Germination, transforme le dé le plus faible en 5. |
| Buds Of Delight | Racines sereines | En Enracinement, ramène la Pression à zéro après le lancer. |
| Iznofarm | Floraison généreuse | En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6. |

Le bonus d’Iznofarm au dé a été confirmé par l’utilisateur. Les six autres capacités restent compatibles avec les cartes déjà possédées et sont mises en valeur par un nom et une illustration propres au producteur. Les huit cartes historiques conservent leur mécanique ; leurs anciens textes d’avantage et leurs rectos sont alignés sur le moteur actuel.

## Fichiers et aperçu

- Manifeste éditorial : `src/data/producer-heritage-cards.json`.
- Illustrations PNG et WebP v2 : `public/app/kanab-quest/cards/heritage-013-…-v2` à `heritage-019-…-v2`. Les fichiers v1 restent archivés, sans être référencés par le manifeste.
- Rectos WebP : `public/app/kanab-quest/card-fronts/`, versions v4 pour les cartes 001–008 et v2 pour les cartes 013–019.
- Galerie locale : `output/heritage-producers/index.html`.
- Comparaison des sept sources officielles et rectos v2 : [ouvrir la galerie](../../output/heritage-producers/v2-review.html).
- Planche : `output/heritage-producers/heritage-producer-contact-sheet.png`.
- Prompts exacts v2, générés avec l'outil intégré `image_gen` : [Cannapache et 3 Feuilles](heritage-producers-art-013-016-v2.prompts.json), [Cap Estuaire et Skud Farm](heritage-producers-art-014-015-v2.prompts.json), [Kanadea, Buds Of Delight et Iznofarm](heritage-producers-art-017-019-v2.prompts.json).
- Les anciens prompts `heritage-producers-art-013-016.prompts.json` et `heritage-producers-art-017-019.prompts.json` documentent la version v1 rejetée.

Pour régénérer les rectos et les aperçus :

```sh
node scripts/generate-producer-heritage-fronts.mjs --check
node scripts/generate-producer-heritage-fronts.mjs
node scripts/generate-producer-heritage-v2-review.mjs
```

Le générateur vérifie la correspondance des descriptions, limites et timings avec les pouvoirs du moteur ; il refuse les textes qui débordent et les illustrations manquantes.

## Vérifications

La reprise v2 a été générée et contrôlée le 26 septembre 2026. Les sept illustrations et leurs rectos complets ont été inspectés : logos et lettrages entiers, portraits reconnaissables, cadrage adapté à la fenêtre du recto. Les fonds transparents involontaires des premiers essais 017–019 ont été corrigés avec l'outil intégré avant sélection des fichiers finaux.

- Rendu réussi des quinze rectos en 1024 × 1536. Les empreintes SHA-256 des huit rectos historiques sont identiques à celles précédant ce rendu.
- Galerie comparative v2 vérifiée à 390 et 1440 pixels : sept cartes et quatorze images chargées, aucun emplacement d'attente ni débordement horizontal, texte +3 Iznofarm correct. Rapport : `output/heritage-producers/v2-review-verification.json` ; captures `v2-review-390.png` et `v2-review-1440.png` dans le même dossier.
- Galerie complète vérifiée à 390 et 1440 pixels : quinze images chargées, aucun débordement horizontal, texte Iznofarm correct. Rapport : `output/heritage-producers/gallery-verification.json`.
- Migration v2 réexécutée sur PostgreSQL isolé via PGlite : quinze cartes conformes au manifeste, quinze acquisitions et les associations conservées, deux cartes hors périmètre inchangées, second passage idempotent. Rapport : `output/heritage-producers/migration-verification.json`.
- Les contrôles fonctionnels précédents (113 tests ciblés, TypeScript global et ESLint ciblé) concernaient le moteur et les capacités conservés par cette reprise graphique.

Contrôles de préparation v2 : les quinze URL de recto SQL correspondent au manifeste ; seuls les chemins des sept nouvelles illustrations et rectos ainsi que leur cadrage ont changé. Les huit historiques, les noms et les capacités sont identiques. Le contrôle du générateur `--check` valide les quinze cartes sans produire de fichiers ; `npm run check:supabase-grants` réussit sur les 250 migrations.

## Mise en ligne

La migration `20260925000100_kq_producer_heritage_editorial.sql` ajoute la mécanique Iznofarm au catalogue puis met à jour les quinze définitions existantes. Les codes, les associations producteur et les acquisitions sont conservés. Les parties déjà commencées gardent leur pouvoir enregistré ; les nouvelles parties utilisent la définition mise à jour.

Déployer d’abord le moteur et les fichiers publics, puis appliquer la migration. Le carnet, l’album et le Placard lisent déjà les URL et descriptions des définitions en base. Aucun remplacement des photos de profil des producteurs n’est nécessaire.

Le lot v2 comprend le moteur +3, les illustrations et rectos définitifs, le manifeste, les générateurs et la migration Héritage. La publication suit cet ordre : déploiement des fichiers et du moteur, contrôle des quinze URL publiques, application de `20260925000100`, puis comparaison des quinze définitions distantes avec le manifeste. Les rapports d'exécution sont conservés localement dans `output/heritage-release/`.
