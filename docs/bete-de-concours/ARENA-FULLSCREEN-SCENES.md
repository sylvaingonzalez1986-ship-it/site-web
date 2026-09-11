# Accueil Arène — scènes pleine largeur

Cette version remplace le lobby en deux colonnes décrit dans ARENA-LOBBY-ART.md. Aucun changement de règles, de routes de jeu ou de base de données.

L’accueil du Placard et son marché suivent désormais ce langage de scènes et
de commandes de jeu : [atelier interactif et illustrations](PLACARD-WORKSHOP-UI.md).

## Carnet immersif — 10 septembre 2026

Le Carnet possède désormais son propre écran de lecture, dans la palette verte,
crème et dorée de l’Arène. Seul le livre est présent, accompagné du retour à
l’Arène et de la commande de fermeture. La couverture s’ouvre autour de sa
reliure ; les pages ont une transition courte, désactivée en mouvement réduit.

Parcours : couverture → table des matières → fleurs du chapitre → fiche botanique
→ dégustation en cinq étapes. Le sommaire propose les six combinaisons
Regular/Concours × Outdoor/Greenhouse/Indoor, avec leurs nombres de fleurs.
Un chapitre vide reste consultable, sans redirection vers une autre culture.

Les données publiées des deux modes sont chargées à l’entrée du carnet. Le choix
du chapitre et de la fleur se fait ensuite localement, sans rechargement de route.
Les routes existantes `/arene/carnet/regular` et `/arene/carnet/concours` restent
utilisables ; `/arene/carnet` mène au carnet Regular.

Sur smartphone : une page, une zone de lecture défilante, boutons de dégustation
fixes dans le livre, prise en compte du viewport visible et des zones de sécurité.
Sur grand écran : une double page avec frontispice illustré. Les chapitres et
fiches peuvent se feuilleter par boutons ou glissement horizontal ; les gestes
sur les champs de notation ne tournent pas la page. Échap remonte d’un niveau.

Les formulaires visités restent montés pendant la navigation interne : les notes
non envoyées sont conservées lors d’un retour au sommaire ou d’une fermeture de
la couverture. Cette conservation dure tant que la page reste ouverte ; elle ne
constitue pas une sauvegarde après rechargement ou sortie du site. L’éligibilité,
les contrôles serveur, les avis existants et les récompenses sont conservés.
Les formulaires et récompenses sont chargés à la demande.

Implémentation : `ContestTastingBook.tsx`, styles associés et variante `book` de
`ContestNotebookPanel`. La surface Carnet est rendue directement par le serveur,
sans les anciens panneaux périphériques de `ContestHubClient`.

Direction visuelle affinée : le carnet conserve son ouverture et ses pages,
avec les couleurs de l’Arène (vert profond, turquoise, crème et jaune), des
contours sombres, des ombres franches et des titres compacts. Sylvain figure sur
la couverture, accueille le lecteur au sommaire sur smartphone et accompagne
les étapes de notation. Les chapitres Regular et Concours ont leurs propres
onglets colorés. Les effets restent courts et respectent la réduction des
animations. Ces styles sont limités au carnet et à sa variante de dégustation.

L’accès aux notes enregistrées ouvre directement leur résumé dans le livre,
sans ouvrir de fenêtre séparée ni changer de route. Le radar compare les notes
du joueur aux moyennes par critère, avec les deux scores globaux sur 100 et une
légende toujours visible. La moyenne publique repose uniquement sur les avis
validés ; elle reste absente tant qu’il n’y en a aucun. Les notes en attente ou
refusées restent consultables dans le carnet ; seules les notes en attente sont
modifiables. Le verdict propose aussi ce graphique pour le brouillon courant,
et le bouton « Mes notes » revient au résumé en conservant les modifications.

Vérification reproductible : `node scripts/audit-tasting-book.mjs`. Elle utilise
les composants réels et des données fictives, sans charger `.env.local` ni écrire
en production. Captures et rapport : `output/tasting-book/`. L’audit vérifie les
six chapitres, les écrans de 320/390/768/1440 px, les notes conservées, l’identité
du lot envoyé, un échec d’envoi, les états vides/verrouillés, la réduction des
animations et une hauteur de 480 px simulant l’espace réduit par le clavier.
Il couvre également les résumés validés, en attente et refusés, leur comparaison
avec la moyenne, l’absence de moyenne, et les allers-retours entre lecture,
édition et fiche sans sortie du carnet sur mobile et ordinateur.
Ce contrôle Chromium ne remplace pas une validation sur un iPhone physique.

## Interface

Un sélecteur Carnet / Placard / Classement et un seul lien d'entrée, dont la destination suit la sélection. Les flèches, Home et End permettent de sélectionner au clavier. Son désactivé par défaut. Tutoriel conservé.

Chaque mode possède une illustration locale et une animation CSS d'arrivée : glissement doux pour le Carnet, rapprochement avec rebond pour le Placard, montée et éclats dorés pour le Classement. Ce sont des transitions de scène et des effets lumineux, pas des vidéos ni des personnages articulés. Les effets sont finis (moins de deux secondes) et respectent prefers-reduced-motion. Léger parallaxe réservé à la souris.

## Illustrations

Images créées avec la génération d'images intégrée, à partir du Sylvain canonique et de la direction artistique validée. PNG 1536 × 1024, fichiers précédents conservés :

- `public/contest/mascot/arena-scene-carnet-v1.png`
- `public/contest/mascot/arena-scene-placard-v1.png`
- `public/contest/mascot/arena-scene-classement-v1.png`

### Briefs de génération (résumé, pas transcription verbatim)

Base commune : illustration cartoon rétro-console pleine largeur, Sylvain fidèle à la référence (casquette turquoise et beige à visière noire, visage crème, yeux ovales noirs, chemise beige, pantalon turquoise). Contours noirs, ombrage en aplats, trame discrète. Palette vert sombre, turquoise, crème et or. Action centrale compatible avec un recadrage mobile, zones supérieures et inférieures calmes pour les contrôles HTML. Aucun texte, logo, interface incrustée ou cadre.

Carnet : Sylvain assis écrit au crayon dans son carnet ouvert, sur un bureau avec un bocal botanique et des cartes, étagères de collectionneur, lumière chaude d'une lampe. Pas de dés ni de trophée.

Placard : Sylvain lance deux dés crème à points noirs devant un placard de culture ouvert et éclairé par LED, ambiance atelier. Pas de carnet ni de trophée.

Classement : Sylvain joyeux présente un trophée doré sur un podium sans numéros, éclairage de victoire et quelques confettis. Aucun autre personnage, placard ou carnet.

## Vérifications

- 14 tests unitaires réussis (accueil, navigation, tutoriel).
- Audit navigateur isolé, données fictives : 320, 390, 768 et 1440 px ; trois scènes par largeur, liens contextuels, absence de doublons, clavier, son optionnel et réduction des animations.
- Captures : `output/arena-retro/lobby-{carnet,jouer,classement}-{largeur}.png`.
- ESLint ciblé sans erreur. Cet audit ne remplace pas un test connecté dans l'application complète et utilise des polices de secours.
