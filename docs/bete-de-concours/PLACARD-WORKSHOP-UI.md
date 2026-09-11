# Placard — accueil et atelier interactifs

10 septembre 2026. Version locale, dans la continuité de l’Arène et du carnet.

## Parcours

L’accueil présente une scène par activité : Culture, Marché, Boutique, Duels.
Les quatre commandes changent la scène et le bouton d’entrée. La progression
et les équipements restent accessibles dans « Mon atelier & ma progression ».
Les routes, les retours de boutique et la remise en haut de page sont conservés.

Le marché présente le lot, son atelier illustré, puis un menu horizontal des
dix postes et filières. Chaque poste indique sa disponibilité pour ce lot.
Un poste verrouillé reste sélectionnable pour expliquer la qualité ou les
équipements manquants. Une seule fiche de filière est affichée à la fois.
L’origine du lot et la comparaison des revenus sont repliables ; les montants,
la réputation, les missions, les rendements et les prérequis restent visibles
dans la fiche ou dans leur détail. La préparation de culture utilise également
la scène du Placard, avec des panneaux et boutons harmonisés.

## Tableau de bord

Le panneau « Mon atelier & ma progression » conserve deux indicateurs permanents :
le solde disponible et la réputation. Trois vues séparent les usages :

- **En bref** : une scène illustrée correspondant à la prochaine action utile,
  son bouton principal, puis les trois raccourcis Culture / Jury / Vente.
- **Matériel** : le coffre, les équipements installés, un aperçu limité à cinq
  achats et l’accès à l’inventaire complet ou à la boutique.
- **Objectifs** : l’objectif épinglé ou le prochain investissement. La mission,
  le palmarès et le détail de réputation se déplient individuellement.

Les illustrations existantes de l’Arène, du marché, de la boutique et du carnet
gardent la même palette vert profond, crème, menthe et jaune. Le CSS du tableau
est limité au composant. Les boutons principaux mesurent au moins 48 px de haut.
Un premier chargement affiche un état d’attente ; une erreur propose de réessayer.
Les soldes, équipements, objectifs et missions proviennent des mêmes API.

## Transformation

Le choix ouvre toujours une confirmation avec les montants. Après validation,
une courte séquence représente le traitement du lot : presse pour le rosin,
cuve pour le hash, préparation pour la vente directe. Les mouvements sont en
CSS, avec désactivation en préférence de mouvement réduit.

L’état de succès et le montant gagné ne sont affichés qu’après la réponse du
serveur. Une erreur conserve le lot et la même clé de requête pour réessayer.
Un verrou local empêche plusieurs requêtes simultanées. La fermeture de la
confirmation est bloquée pendant l’envoi ; le focus reste dans le dialogue ou
dans la séquence en cours. Le reçu apparaît ensuite et reste consultable.

## Dés

La piste de lancer utilise un fond vert profond avec une trame discrète et un
filet menthe, dessiné en CSS. Les dés physiques et les faces CSS partagent des
faces crème mates, des points vert encre et des contours épais. Après validation,
le corail signale le danger, la menthe la réussite et le jaune l’étincelle ; le
quatrième dé écarté reste grisé en 3D. Les valeurs et la physique du lancer sont
conservées, ainsi que le résultat direct et la préférence de mouvement réduit.
Les dés en attente restent visibles avant le premier lancer.

## Illustration

Nouvelle scène créée avec l’outil intégré imagegen, en prenant
`public/contest/mascot/arena-scene-placard-v1.png` comme référence de style et de
personnage. Le nom du personnage n’est pas affiché dans cette interface.

- Original : `public/placard/market-workshop-v1.png`.
- Version utilisée : `public/placard/market-workshop-v1.webp`, 1536 × 1024,
  234 406 octets, conversion WebP avec Sharp.
- Consommateurs : accueil du Placard, atelier du marché et marché vide.

Prompt de génération :

> Create a new project illustration, landscape 1536x1024. Reference image is STYLE AND CHARACTER reference only, not an edit target. A coherent original retro cartoon game workshop interior for the same garden management game. Deep forest green, cream, bright turquoise and golden yellow, bold clean dark outlines, subtle halftone. Wide view of a cozy workshop: left a simple sorting counter with closed botanical jars; center a large stylized turquoise industrial tabletop press with obvious upper and lower rectangular plates, oversized round pressure gauge, a sturdy base, warm golden glow; right a compact round washing machine and stacked sieves, storage shelves behind. These are fictional game machines, not technical instructions, no pipes or readable control instructions. Keep main machine entirely within central 50% so portrait cropping works. Small canonical mascot from reference at far left observing proudly, never dominant. Warm overhead lamp, no dice. Bottom quarter fairly dark and quiet to place real HTML controls over. All machines clean and readable silhouettes, inviting immersive videogame environment. NO text, letters, logos, labels, numbers, UI panels, borders, HUD, collage or watermarks. Save the generated image and return its local output path.

## Vérification

`node scripts/audit-placard-workshop.mjs` utilise les composants et les calculs
de devis réels avec des lots fictifs. Aucun identifiant ni écriture en production.
Il vérifie l’accueil, les dix postes, la fiche unique, le verrouillage, la vente,
la reprise après erreur avec la même clé, les états de transformation, la
fermeture au clavier et l’état vide sur 320/390/768/1440 px. Les captures de
préparation de culture utilisent une API simulée indisponible : elles servent
à vérifier la présentation, pas une partie connectée complète.

Captures et rapport : `output/placard-workshop/`. Vérifications complémentaires :
TypeScript, ESLint ciblé, tests marché/équipements/économie/navigation.

`node scripts/audit-placard-dashboard.mjs` vérifie le vrai tableau de bord avec
une progression fictive remplie, sur 320/390/768/1440 px : vues indépendantes,
inventaire, absence de débordement et d’images manquantes. Il couvre aussi les
quatre destinations, le début de partie, l’objectif épinglé, la reprise d’une
mission après erreur, la progression terminée, le chargement, la reprise après
erreur de lecture et l’intégration dans l’accueil. Aucun appel externe autorisé.
Captures et rapport : `output/placard-workshop/dashboard/`.

`node scripts/audit-placard-dice.mjs` exerce le moteur WebGL et les faces CSS
réels, avec des valeurs de présentation fixes : lancer à trois et quatre dés,
couleurs après validation, mise à jour des faces, points du rendu de secours et
débordements sur 320/390/768 px. Aucun tirage de partie ni appel API.
Captures et rapport : `output/placard-workshop/dice/`.
