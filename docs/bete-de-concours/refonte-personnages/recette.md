# Personnages 3D du Quartier

## Référence et fabrication

Maël porte une marinière écrue et pétrole, un pantalon à pont et des chaussures de pont. Le premier passage montrait une ombre marquée sous les pommettes, des cheveux en coque et des poches rectangulaires à la cuisse. Deux revues de la géométrie sur ce personnage ont guidé les corrections des volumes, des attaches de poches et du col. La planche d'intention a été générée une fois avec ImageGen à partir de `atelier-personnage/cible-personnage.webp` et `atelier-personnage/apres-vues.webp`. Les comparaisons et l’animation proviennent de captures du modèle en Three.js. [Intention](intention.webp) · [Comparaison à caméra fixe](comparaison.webp) · [Expressions](expressions.webp) · [Vêtements et gestes](gestes.webp) · [Deux teintures](deux-teintures.webp)

Les sources éditables sont les profils, courbes, anneaux et surfaces de la fabrique `createGrowWorker` sous `src/components/placard/`. Three.js 0.187.0 utilise Y vers le haut, +Z vers l’avant et une origine aux pieds. Les poses pilotent des pivots, l’appui des pieds et la flexion des anneaux des membres. Les expressions animent les positions et les normales de la bouche, des yeux et des sourcils. Le rendu de secours projette aussi ces déformations. La maille utilise les coordonnées du vêtement au repos et des pigments par sommet. Elle se simplifie visuellement à distance. Les teintures partagent le matériau et chaque modèle possède ses pigments.

L’atelier et les vignettes, le joueur du village, les intérieurs, la culture, les recrues du trim et les concurrents de QuizzShow appellent la même fabrique. Le village conserve la boucle Fiber 9.8.1 à la demande. Les PNJ nommés qui utilisent leur propre sculpture, dont Loïc, gardent leur fabrique dédiée.

## Garde-robe et sauvegarde

Quatre ensembles sont proposés au premier niveau. « Quart au port » habille la marinière, « Grain au large » le ciré, « Fête en pays bigouden » le gilet brodé et « Matin au marché » le tablier. « Retour de pêche » et « Dimanche glazik » restent disponibles dans les autres tenues. Les codes des pièces, les anciennes apparences et les droits de jeu gardent leur signification. Les tissus disposent de 24 teintes nommées et d’un sélecteur libre. Le regard, la peau, les cheveux, le haut, les rayures et le foulard ont leurs propres réglages. Les expressions essayées dans le studio sont temporaires.

La migration locale `20261125000200_chanvrier_stripe_dye.sql` étend le validateur au champ facultatif `appearance.dyes.stripe`. En son absence, le tissu calcule le contraste historique de la rayure. Un éditeur v2 ancien peut encore enregistrer sa tenue en conservant la rayure déjà enregistrée dans la ligne verrouillée. L’éditeur courant peut la remettre en automatique. Les tests exécutent le RPC dans PostgreSQL embarqué, avec des profils fictifs, un ancien profil, une couleur invalide, un retour en automatique et un contrôle des droits. La migration laisse les lignes existantes en place.

## Reprendre la recette locale

La branche est `feat/refonte-personnages-3d`, ouverte sur `f980a336` avec les travaux locaux déjà présents. Le dossier de travail `output/refonte-personnages/base` fige les sources et les scripts dans cet état. Le navigateur utilise une API fictive sur 127.0.0.1. L’angle, l’éclairage, les proportions du cadre et les phases des poses sont identiques sur les planches comparatives.

- `node scripts/audit-village-3d.mjs --avatar-turntable --avatar-motion` produit les vues fixes, les images du mouvement, les contrôles de géométrie et les mesures à une et quatre instances.
- `node scripts/audit-village-3d.mjs --avatar-studio --avatar-refit` exerce l’atelier, la validation, le rechargement, la salle de culture, l’intérieur, le village et le portrait de secours. Les variables `CHANVRIER_TURNTABLE_DIR` et `CHANVRIER_STUDIO_AUDIT_DIR` permettent de séparer les relevés.
- `node scripts/test-chanvrier-customization.mjs` rejoue la persistance sur une base jetable. `npm run check:supabase-grants` vérifie les décisions d’accès des migrations.

71 tests Vitest ciblés, le lint des fichiers concernés et le typage ont réussi. Le build Next.js a compilé et généré 158 pages statiques. En environnement isolé, les lectures distantes des données publiques de la boutique ont signalé des erreurs réseau pendant cette génération. La recette des personnages utilise des données locales.

Le routage et la production ont utilisé `router`, `lcb-jeu-3d`, `create-game-assets` et ses références de direction artistique et de pipeline 3D. La finition a mobilisé `imagegen`, `threejs-materials-lighting`, `game-feel`, `game-ui-ux`, `performance-optimization` et `save-systems`. Astra 6.2 a dirigé les deux agents Sol 6.2 et relu le personnage de référence puis les variantes.

## Mesures et réception

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Maël au repos, triangles | 34 032 | 39 956 |
| Maël au repos, appels de rendu | 20 | 20 |
| Maël au repos, attributs et indices CPU (octets) | 893 856 | 1 181 584 |
| 4 personnages en marche, triangles | 159 388 | 170 548 |
| 4 personnages en marche, appels | 81 | 81 |
| 4 personnages en marche, intervalle p95 (ms) | 16,8 | 16,8 |
| Construction hors première instance, médiane de 5 (ms) | 18,0 | 31,6 |
| Atelier à 1360 × 900, marche (images/s) | 60,0 | 60,0 |
| Atelier à 1360 × 900, intervalle p95 (ms) | 18,2 | 17,2 |
| Atelier à 390 × 844 émulé, marche (images/s) | 60,0 | 60,0 |
| Atelier à 390 × 844 émulé, intervalle p95 (ms) | 17,4 | 17,6 |

Chromium 157 sur Windows et Intel Iris Xe via ANGLE D3D11. Le banc de quatre personnages utilise un cadre de 640 × 360 px à DPR 1 et 75 intervalles après chauffe. Les compteurs du tableau portent sur les personnages et leurs ombres de contact. Le relevé du Quartier au zoom de jeu couvre aussi le joueur, Loïc, le sonneur, le pêcheur et l’environnement. Le temps de construction comprend la création de la géométrie en JavaScript. Les textures de matériau chargées depuis des images sont au nombre de zéro. Three.js alloue en outre des textures internes pour les morphs. [Mesures et conditions détaillées](mesures.json)

La revue a couvert les quatre ensembles, les 14 coupes et les trois pilosités, dont la nuque de profil et les émotions sous la moustache. Le test de recoloration compare les deux moitiés d’une même image, avant et après modification de la marinière gauche. Le côté droit reste identique au pixel près. Le cache de formes conserve jusqu’à 24 jeux de positions et normales. Dans l’essai A/B alterné sur Maël, il abaisse le temps de construction médian de 50,6 à 43,8 ms, avec un p95 passant de 69,4 à 78,9 ms. [Coiffures](coiffures.webp) · [Pilosités](pilosites.webp) · [Animation du rig](mouvement.webp)

Le navigateur a exercé les quatre expressions, le zoom au clavier, la réinitialisation, les brouillons, le refus temporaire de sauvegarde puis le réessai, les rayures et le foulard après rechargement, ainsi que le portrait sans WebGL. Les couleurs persistent aussi lors d’un appel du RPC testé séparément en base locale. La recette mobile utilise l’émulation tactile de Chromium. La fluidité et la chauffe sur téléphone physique restent à mesurer. [Comparaison dans le village](quartier.webp) · [Atelier à 320 px](atelier-320.webp) · [Rayures et foulard](atelier-rayures.webp)

## Retour arrière local

Depuis la racine du dépôt, `git apply -R --check output/refonte-personnages/refonte-code.patch` vérifie le retour au code présent avant la mission, y compris les modifications qui étaient déjà en cours dans l’atelier. Pour l’effectuer, utiliser le même appel sans `--check`. Le patch couvre le code, les tests, les scripts et le fichier de migration locale. Les preuves restent disponibles. Les bases de recette étaient jetables. Une éventuelle publication avec des profils déjà teints nécessiterait de conserver la lecture de la clé `stripe` pendant un retour de version. [Patch local](../../../output/refonte-personnages/refonte-code.patch)
