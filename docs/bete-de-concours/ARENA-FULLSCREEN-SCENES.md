# Accueil Arène — scènes pleine largeur

Cette version remplace le lobby en deux colonnes décrit dans ARENA-LOBBY-ART.md. Aucun changement de règles, de routes de jeu ou de base de données.

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
