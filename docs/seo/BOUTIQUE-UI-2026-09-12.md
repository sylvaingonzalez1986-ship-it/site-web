# Boutique : analyse et améliorations UI — 12 septembre 2026

## Diagnostic de la page Marché

- La grille démarrait à une colonne, avec deux colonnes seulement à 640 px.
- Les producteurs étaient empilés jusqu'à quatre cartes. La duplication à partir de cinq créait une navigation répétitive.
- Les flèches dépendaient du survol et ne permettaient pas une navigation explicite au clic ou au clavier.
- Les cartes produits nécessitent une présentation compacte pour conserver prix, formats et quantités sur petit écran.
- L'accueil utilise un fond crème, un vert profond, des titres affiches et des bordures noires : la boutique reprend ces repères.

## Repères concurrentiels

Comparaison exploratoire du contenu public, sans étude quantitative du marché ni mesure des conversions :

- [La Ferme du CBD — fleurs](https://www.lafermeducbd.fr/nos-fleurs/) met en avant l'origine vérifiable et la traçabilité.
- [Green Owl](https://greenowl.fr/) présente son catalogue par familles et insiste sur la transparence.

Interprétation pour cette boutique : conserver la visibilité des producteurs, de l'origine et des analyses, tout en rendant la comparaison des produits plus rapide. L'identité des Chanvriers Bretons et la sélection des voisins constituent le fil conducteur de la présentation.

## Changements

- Mobile : deux produits par rangée, photos carrées, textes et commandes adaptés à la largeur réelle des cartes.
- Grilles adaptées dans la boutique, les catégories, les régions et les fiches producteurs.
- Dès trois producteurs : une piste horizontale sur mobile, avec aperçu de la carte suivante, ancrage du défilement et boutons de 44 px.
- PC : trois colonnes produits ; producteurs visibles sur une rangée, avec commandes lorsque le contenu dépasse.
- Les producteurs ne sont plus dupliqués. Une ou deux cartes restent en disposition statique.
- Navigation au clic, au toucher et avec les flèches du clavier lorsque la piste a le focus ; respect du réglage de réduction des animations.
- Fond crème, navigation verte, introductions de sections et compteurs cohérents avec l'accueil.

## Vérifications reproductibles

- Script : `node scripts/audit-boutique-ui.mjs` avec le serveur local sur `http://localhost:3000`.
- Largeurs : 320, 390, 768 et 1440 px ; onglets produits, voisins et copains.
- Captures et résultats : `output/boutique-ui/`.
- Le script vérifie les débordements, les colonnes mobiles et les interactions du carrousel sur les données locales.
- Les captures ne constituent pas une mesure de performance ni une validation sur téléphone physique.
