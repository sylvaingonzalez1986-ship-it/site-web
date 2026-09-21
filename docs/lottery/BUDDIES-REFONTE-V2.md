# Buddies — illustrations et cadres v2

Cette refonte applique la direction définie dans [l'audit](BUDDIES-AUDIT-VISUEL-2026-09-21.md) : identité cartoon commune, un gabarit de carte et cinq degrés croissants de finition. Les illustrations Épiques développent des scènes narratives riches ; l'Arbre Mère reçoit une composition monumentale et la finition maximale.

## Organisation des assets

- Scènes : `public/app/kanab-quest/buddies/hh2026-NNN-scene-v2.webp`, 1024 × 1280, ratio 4:5, sans texte ni cadre intégré.
- Carte complète : [BuddieCard](../../src/components/lottery/BuddieCard.tsx) et [ses styles](../../src/components/lottery/BuddieCard.module.css), ratio 2:3. Cadres SVG/CSS, titres et symboles rendus de manière identique à toutes les tailles.
- Illustration commune de référence : Strawberry CBD, #20. Même famille de visage, encrage, gants et chaussures pour les autres personnages ; l'Arbre Mère conserve son corps d'arbre.
- Prompts et niveaux de finition : [buddies-v2-prompts.json](buddies-v2-prompts.json). Génération avec l'outil intégré `image_gen`, via le skill imagegen ; les corrections de détail utilisent également cet outil.
- Prompts de correction conservés : [balance de Critical Mass et décor d'Afghan](buddies-v2-corrections-021-036.json), [décor de Therapy](buddies-v2-corrections-037-052.json).
- Import/optimisation : `node scripts/import-buddie-artwork.mjs <numéro> <image-générée>`. Le flag `--no-activate` permet de préparer des lots avant leur activation commune. L'import vérifie le ratio, produit le WebP et conserve un reçu local sous `output/buddies-refonte/receipts/`.

Le fichier [buddie-artwork-ready.json](../../src/lib/buddie-artwork-ready.json) énumère les scènes activées. [Le résolveur](../../src/lib/buddie-artwork.ts) utilise ces assets locaux à la place des URLs historiques du catalogue pour les codes concernés. Les URLs et images distantes restent disponibles en repli ; retirer un code du manifeste rétablit son ancien affichage. Les changements d'image ultérieurs dans l'administration distante ne prennent donc pas priorité sur une scène v2 activée : il faut aussi mettre à jour le manifeste ou son asset.

Les identifiants, raretés, probabilités, possessions et avantages de jeu ne changent pas. Aucune migration de base n'est nécessaire pour activer les illustrations côté interface.

## Surfaces concernées

L'album, la fiche détaillée, l'ouverture des boosters, leur récapitulatif et le choix du Buddie utilisent la même carte complète. Les comptes de doublons, le recyclage et la sélection sont placés à l'extérieur du cadre. Conformément à la préférence utilisateur, les cartes non possédées gardent leur illustration visible en niveaux de gris et atténuée. Le nom du personnage reste masqué et remplacé par « Carte mystère ».

Le tiroir de recyclage reprend également la carte. Les cartes Fleurs réutilisent la scène seule dans leur propre présentation de récolte. Les bonus, cartes La Botte et Héritages gardent leurs gabarits distincts.

Les libellés des raretés sont français : Commune, Argent, Or, Épique, Légendaire. Le cadre associe couleur, motif et symbole : graine, losange, soleil, étoile, couronne botanique.

## Choix pour les noms peu explicites

Ces scènes sont des interprétations artistiques de références documentées, sans prétendre illustrer une étymologie qui n'est pas établie :

| Nom | Ancrage retenu | Référence |
| --- | --- | --- |
| Suver Haze | Route agricole de l'Oregon dans la brume ; le nom fait référence à Suver Road. | [GTR / Oregon CBD](https://gtrseeds.com/products/suver-haze) |
| Bubba Kush | Promenade californienne de Venice et personnage décontracté. | [Bubba Kush Brand](https://bubbakushbrand.com/) |
| OG Kush | Pionnier de la scène californienne, blouson et radio rétro. | [Josh D](https://kush.icu/) |
| Afghan | Voyageur botanique et montagnes de l'Hindou Kouch. | [Sensi Seeds](https://sensiseeds.com/en/blog/40-years-sensi-seeds/) |
| Dinamed | Botaniste et serre de sélection. | [Dinafem](https://www.dinafem.org/en/dinamed-cbd/) |
| Baox | Deux tiges réunies en une plante pour évoquer la filiation Hindu Kush × Otto II. | [Yellowhammer Genetics](https://www.yellowhammergenetics.com/product-page/baox-f4) |
| Carmagnola | Cordier dans un atelier de cordage de chanvre, lié au patrimoine local. | [Écomusée de Carmagnola](https://www.parcopopiemontese.it/pun-dettaglio.php?id=1007) |
| Otto II | Gardien de semences devant les Rocheuses ; les deux compartiments du coffret sont un choix créatif. | [Experimental Farm Network](https://store.experimentalfarmnetwork.org/products/otto-ii-hemp) |
| CBD Kush | Jardin botanique de montagne et petit rappel du parent Kandy Kush par une confiserie. | [Dutch Passion](https://dutch-passion.com/nl/wietzaden/cbd-kush) |

## Contrôles reproductibles

```powershell
npx.cmd vitest run src/lib/buddie-artwork.test.ts src/lib/kanab-quest-artwork.test.ts src/lib/kanab-quest-game.test.ts
node scripts/audit-buddie-cards.mjs --pilots --collection
```

Le test de catalogue vérifie la correspondance des 52 codes jouables, les fichiers distincts, leur format et leurs dimensions, ainsi que le repli des codes hors collection. L'audit navigateur vérifie les cinq cadres à 160, 240 et 384 px, les titres longs, le chargement de l'illustration des cartes manquantes en niveaux de gris avec leur nom masqué, et la présentation des images historiques. Avec `--collection`, il vérifie toutes les scènes et produit cinq planches et une galerie HTML locale.

Les captures, la galerie et les rapports sont dans `output/buddies-refonte/card-checks/`. Les vérifications des écrans assemblés à 320, 390 et 1440 px sont dans `output/buddies-refonte/integration-checks/`. Les fichiers de contrôle sous `output/` ne sont pas versionnés.

Une revue visuelle de chaque illustration complète les contrôles techniques : correspondance au nom, absence de cadre ou texte parasite, anatomie, lisibilité et finition adaptée à la rareté. Les prompts sont les consignes de génération ; les images et les journaux de revue sont la référence pour le résultat obtenu.

Validation réalisée : 52 illustrations activées et inspectées, 87 tests réussis, TypeScript et ESLint ciblé sans erreur. Les contrôles navigateur des cadres, de la collection et des écrans assemblés passent. La galerie HTML locale charge ses 52 images et ses polices sans débordement à 390 et 1440 px ; son rapport est dans `output/buddies-refonte/gallery-checks/report.json`.
