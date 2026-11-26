# Finition de l’interface de L’Arène et du Placard

Recette locale du 25 novembre 2026. La référence est le commit `f980a336`. Les captures montrent les composants React utilisés par le jeu avec des profils fictifs dans Chromium. Le village utilise React Three Fiber et conserve sa boucle de rendu à la demande. Le studio conserve son moteur Three.js.

## Continuité artistique

| Repère | Règle appliquée |
| --- | --- |
| Palette | Papier crème pour lire, encre vert sombre pour les textes et contours, sarcelle pour agir, or pour la sélection ou le bilan, abricot pour les réserves et accents chauds. Les quantités portent leur unité. |
| Typographie | Barlow Condensed pour les titres et enseignes. Space Grotesk pour les descriptions. Chiffres tabulaires pour comparer des quantités. Le libellé et le focus restent droits et lisibles. |
| Matières | Les plaques WebP découpées conservent leur contour et leur petite ombre d’encre grâce au découpage neuf zones. Les feuilles encadrent les groupes. Un filet sépare les lignes du registre. |
| Illustration et lumière | Le village isométrique, les personnages, les cartes, le plateau et les machines gardent leurs proportions et leur éclairage. Les textes, filtres et nombres restent en HTML. |
| Orientation | Le menu illustré, le retour au village, l’Arène et les destinations gardent leur nom. Une rubrique active est indiquée par son libellé, son état accessible et son traitement graphique. |

Les fixations de panneau, l’ordre de lecture et la place accordée au décor ont été arbitrés sur des vues jouables. Le visuel reste grand dans le hall. Dans le classement mobile, le trophée accompagne le titre et laisse la place à la semaine du joueur.

## Comparaisons

Chaque paire montre l’ancienne interface à gauche et la version livrée à droite, avec le même état fictif et la même taille CSS. La galerie permet de choisir parmi douze parcours et d’ouvrir chaque capture à sa résolution d’origine. [Ouvrir la galerie](../../../output/finition-interface/comparaisons.html) · [Consulter les mesures et les originaux](../../../output/finition-interface/)

| Parcours | Friction observée | Critère vérifié |
| --- | --- | --- |
| Village, jour 1, à midi | La sortie Arène précédait Ma partie. Le solde arrivait après le calendrier. | Le bilan est le deuxième accès du bandeau. Le solde précède l’horloge et les commandes restent accessibles à 320 px. [Comparer le HUD](quartier.webp) |
| Atelier, laveuse | À 320 px, il fallait parcourir les fiches successives pour comparer trois gammes. | Les trois capacités en grammes par lot, précisions et montants à payer tiennent dans le même tableau. Le devis détaillé reste accessible. [Comparer les gammes](gammes.webp) |
| QuizzShow, classement | Deux commandes renvoyaient à la salle. Le grand trophée plaçait le bilan personnel sous le premier écran à 390 px. | Un seul retour ouvre la salle et les trois espaces se rejoignent directement. Le panneau « Ta semaine » est entièrement visible à 390 × 844. [Comparer le classement](classement.webp) |

## Parcours intégrés

- **Village et intérieurs.** Le menu de onze destinations indique la rubrique courante. Le retour depuis Commerce conserve la protection du brouillon. La recette couvre le panneau du village, l’entrée Banque, le mode nuit, l’erreur de chargement du HUD et le réessai clavier. Le créateur a aussi été rouvert depuis les réglages du village.
- **Entrepôt et équipements.** Pilotage présente la reprise des cultures au-dessus du plan. Le stockage distingue capacité réservée, prévisions et dépassement. La liste, le sélecteur de modèles et la fiche donnent le même état d’usure. Machines et Extractions retrouvent le poste après fermeture. Les confirmations reprennent le prix calculé par le jeu.
- **Créateur.** La dernière sous-catégorie reste disponible quand on revient sur une catégorie. La tenue portée, le mode de l’aperçu, la remise à zéro et les conditions de validation sont explicites. La sélection, l’annulation, la sauvegarde en erreur puis le réessai ont été joués, avec observation du personnage dans le village, la boutique et la salle de culture.
- **Album.** Botte du Chanvrier et Buddies partagent la présentation des quantités et le volet « Rechercher et filtrer ». L’album distingue collection vide, stock indisponible et filtre sans résultat. Les cartes conservent leur illustration. L’agrandissement se ferme avec Échap et restitue le focus.
- **QuizzShow.** Le classement, le tournoi actif et l’encyclopédie partagent la rangée de destinations. Le retour à la salle reprend le clavier sur l’enseigne précédente. L’encyclopédie mémorise le lien et le défilement du panneau d’activité. En tournoi, la confirmation de départ place le focus sur « Rester » et accepte Échap. Le serveur simulé détermine la réponse correcte et le score.

## Conditions de recette

| Périmètre | Exécution et preuve |
| --- | --- |
| Navigation et HUD | Chromium, profils fictifs, 320 × 710 et 1 440 × 900. Seize groupes, puis réexécution ciblée du réessai. Le premier rapport garde le délai dépassé de la fixture d’erreur. [Parcours](../../../output/finition-interface/navigation/apres/quarter-menu-parcours.json) · [Réessai corrigé](../../../output/finition-interface/navigation/apres/quarter-hud-reessai.json) |
| Réglages et boîte aux lettres | Dans le village 3D, à 320 × 710 et 1 440 × 900, Entrée ouvre le panneau et Échap rend le focus à la commande d’origine. À 320 px, la boîte de 296 × 694 px contient le focus et affiche l’historique vide après défilement. Les quatre captures et les mesures accompagnent la recette. [Réglages et courriers](../../../output/finition-interface/navigation/annexes/recette.json) |
| Gestion | Vues réelles de Pilotage, Stockage, Machines et de la laveuse à 320 et 1 440 px. Reprise de la culture, dépassement de 250 g, sélection et annulation du devis Standard de 9 500 €. La lampe usée a été montée en fixture isolée après l’expiration du délai du lanceur historique. [Gestion](../../../output/finition-interface/gestion/recette.json) · [Lampe](../../../output/finition-interface/gestion/recette-lampe-lecture.json) |
| Studio | Chrome headless, Intel Iris Xe, DPR 1. Cadrages bureau, portrait et paysage. Le canevas à 320 px mesure 276 × 166. Périodes de marche d’environ 2,4 s. [Avant](../../../output/finition-interface/createur/avant/report.json) · [Après](../../../output/finition-interface/createur/apres/report.json) |
| Activités | Salle, tournoi, classement, encyclopédie et album dans cinq fenêtres de 320 × 700, 390 × 844, 844 × 390, 768 × 1 024 et 1 440 × 900. Affiches de repli dans cette série, réduction des mouvements activée. [Avant](../../../output/finition-interface/activites/avant.json) · [Après](../../../output/finition-interface/activites/apres.json) |

Les durées d’ouverture brutes de la galerie incluent la compilation Vite, le chargement des modules et la concurrence sur le poste. Les essais mobiles utilisent l’émulation Chromium. La fluidité sur téléphone physique, VoiceOver et TalkBack reste à évaluer.

À 390 × 844, une seconde série a alterné les deux versions sur serveurs locaux chauds après la compilation. Sur trois essais par version, le délai médian jusqu’aux enseignes du hall passe de 515 à 541 ms. Entre le toucher de l’encyclopédie et l’affichage des rayons, il passe de 344 à 343 ms. Les intervalles du hall se recouvrent (453–611 et 472–630 ms). [Temps et protocole](../../../output/finition-interface/activites/temps-apparies.json)

Le parcours clavier retrouve l’entrée de l’index et son défilement exact à 320 px (480 px) et sur ordinateur (251 px). Les accès de QuizzShow restent utilisables avec une taille de police racine de 200 %. Le test retrouve le filtre après agrandissement d’une carte et changement d’album. Il provoque aussi une erreur de service et un stock invalide, puis vérifie la récupération. Le tournoi a été joué en PGlite, avec une réponse correcte, une erreur, un rechargement sans double score et l’annulation du départ. [Parcours clavier](../../../output/finition-interface/activites/parcours.json) · [Tournoi](../../../output/quiz-audit-2026-11-19/ui/report.json)

Le studio tourne à environ 60 images/s dans les deux versions. Le 95e percentile de l’intervalle entre images en marche passe de 18,3 à 19,6 ms à 1 360 × 900 et de 18,5 à 18,2 ms à 390 × 844. Sur cinq cycles identiques d’ouverture et d’édition, le tas JavaScript après deux collectes forcées augmente de 0,68 Mio avant et de 0,69 Mio après, éditeur ouvert. Cette mesure courte couvre le tas JavaScript du navigateur. La mémoire GPU et l’évolution pendant une longue session restent ouvertes. Les illustrations et textures de production existantes ont été réutilisées, pour **0 octet d’image de jeu ajouté**. [Mesures mémoire](../../../output/finition-interface/memoire/synthese.md)

Les disciplines utilisées sont `router`, `lcb-ui-ux`, `game-ui-ux`, `lcb-jeu-3d`, `game-feel`, `performance-optimization` et `game-docs`. Le catalogue local ne contient pas `input-systems`. La recette utilise les événements et commandes réels des composants pour vérifier le clavier et le tactile. Les matériaux et polices existants servent toute la livraison.

Le typage TypeScript global, ESLint sur les fichiers modifiés et la compilation de production Next.js en mode `compile` ont abouti. Les lots ont passé leurs suites Vitest ciblées (28 tests HUD et navigation, 90 gestion, 21 studio, 14 école et encyclopédie). La génération statique du reste du site et la publication sont hors de cette recette.

Pour rejouer les contrôles de l’album et de QuizzShow, lancer la prévisualisation et la recette dans deux terminaux à la racine. Utiliser le même port de boucle locale dans les deux.

```powershell
$env:NAVIGATION_AUDIT_PORT = '34920'
node scripts/audit-placard-navigation.mjs --preview --school-real
```

```powershell
$env:NAVIGATION_AUDIT_PORT = '34920'
node scripts/audit-placard-activity-interface.mjs
```

## Retour arrière

Depuis la racine du dépôt, vérifier d’abord que la différence inverse s’applique toujours. Exécuter la seconde commande pour retirer la livraison de la copie de travail. Le même fichier peut ensuite être réappliqué avec `git apply` pour la retrouver. Le patch contient aussi les composants et les comparaisons créés pendant cette mission.

```powershell
git apply --reverse --check output/finition-interface/livraison.patch
git apply --reverse output/finition-interface/livraison.patch
```
