# Le Placard — direction artistique V2

Statut : cadre de production pour la boutique, les cartes et les situations
Date : 2026-08-30

## 1. Intention

Le nouveau langage visuel est celui d'une affiche de jeu vidéo d'action
satirique traitée comme un cartoon éditorial : personnages très expressifs,
cadrages cinématographiques, formes rondes, aplats francs, trames halftone et
détails comiques immédiatement lisibles. La référence
« Rockstar » reste un raccourci d'intention en interne ; les illustrations
finales doivent former un univers original, sans logo, personnage, composition
ou interface repris d'une licence existante.

Le ton repose sur le contraste entre une aventure présentée comme épique et des
problèmes très ordinaires : facture, voisin curieux, contrôle administratif,
matériel qui chauffe ou voleur mal préparé. Sylvain reste le fil rouge visuel.

## 2. Grammaire commune

- silhouette et enjeu compréhensibles en moins d'une seconde ;
- une action principale par image, sans collage de petits gags concurrents ;
- cadrage légèrement en contre-plongée, gestes exagérés et visages très lisibles ;
- gros contours noirs réguliers, volumes simples en aplats, trame halftone,
  lumière chaude et ombres bleu pétrole ;
- palette : crème sale, orange brûlé, jaune signalétique, turquoise électrique,
  vert profond et noir bleuté ;
- accessoires contemporains et plausibles, avec usure, étiquettes et réparations ;
- aucun texte important généré dans l'image : titre, règle, coût et pictogrammes
  restent des calques UI nets ;
- aucune représentation didactique d'un branchement dangereux ou d'une méthode
  illégale réelle : la carte raconte une prise de risque, elle ne l'explique pas.

## 3. Système des illustrations de situation

Chaque situation doit posséder une combinaison unique de décor, action,
personnage et couleur dominante. Deux cartes proches mécaniquement ne doivent
jamais réutiliser la même silhouette ou le même gag.

Format de jeu : carré 1:1, en 1 200 px minimum, avec le sujet et l'information
critique dans les 70 % centraux. Le titre et l'effet restent hors de l'image,
dans les calques HTML de la carte. Exporter un WebP sans texte ni marque ; les
noms de fichiers suivent `situation-SIT-000-slug-v2.webp`. L'interface conserve
le cadre carré afin de ne pas rogner le danger ou le détail comique.

Une situation se compose de quatre niveaux visuels :

1. le danger, visible avant même de lire la carte ;
2. la réaction de Sylvain ou d'un personnage secondaire ;
3. un indice matériel qui annonce la mécanique possible ;
4. un détail comique secondaire découvert à la seconde lecture.

## 4. Premier lot à illustrer

| Sujet | Composition | Couleur / détail signature |
| --- | --- | --- |
| Facture d'électricité | Sylvain face à une enveloppe démesurée, compteur emballé derrière lui | jaune facture, chiffres rouges |
| Coupure de courant | placard plongé dans le noir, seule une lampe frontale découpe le visage | bleu nuit, LED qui s'éteint |
| Contrôle DDTM | contrôleuse calme au premier plan, Sylvain tente de ranger une pile de dossiers | vert administratif, tampon géant |
| Papiers en règle | classeur blindé brandi comme un bouclier, trois onglets de validation visibles | crème et turquoise, trois sceaux UI ajoutés hors image |
| Renard à deux pattes | voleur humain en fuite avec une caisse, ombre de renard projetée sur le mur | orange rouille, baskets dépassant de la caisse |
| Gros molosse | rottweiler victorieux au portail, morceau de caleçon coincé dans la gueule | rouge alarme, expression fière |
| Panneau solaire | Sylvain installe une batterie de secours pendant que le quartier s'éteint | cyan électrique, halo propre |
| Branchement illégal | domino électrique carbonisé présenté comme un très mauvais plan | orange danger, fumée en point d'interrogation |

Les cartes de réponse reprennent la couleur de la situation qu'elles contrent,
mais changent de cadrage : gros plan « objet héros » pour l'équipement, scène
d'action pour un personnage, composition frontale pour un document.

## 5. Sylvain V2

Sylvain reste strictement fidèle aux références existantes
`/sylvain-culture-hero.png` et `/app/kanab-quest/stages/sylvain-croissance-v1.webp` :
mascotte ronde, visage crème très simple, petits yeux noirs verticaux, petit nez
en C, bouche noire avec langue rouge, cheveux noirs latéraux, casquette bicolore
turquoise et beige à large visière noire, pull beige, salopette turquoise, gants
crème et grosses chaussures beiges. Pas de barbe, rides, veste, hoodie, anatomie
réaliste ou rendu 3D. Sa posture varie selon le résultat : trop confiant avant
le jet, concentré pendant la décision, triomphant ou franchement dépassé après
la résolution.

## 6. Application à l'interface

La boutique matérielle utilise la même palette et les mêmes formes : fond crème
de catalogue, bandeaux noirs, orange pour l'achat, turquoise pour les données
techniques et jaune pour les alertes. Les photos produit temporaires peuvent
être remplacées progressivement par des « objets héros » illustrés sur fond
simple, sans modifier la structure e-commerce.

Dans la partie, l'illustration ne porte jamais seule l'information. Le nom de la
situation, le risque, les dés attendus et les réponses disponibles restent
accessibles en HTML. Les variantes succès, fragile et échec utilisent de petits
overlays de réaction plutôt que trois images presque identiques.

## 7. Ordre de production

1. verrouiller la planche personnage de Sylvain et les règles de palette ;
2. produire les huit scènes pilotes ci-dessus en portrait 4:5 ;
3. les tester dans la carte la plus petite et sur mobile ;
4. valider lisibilité, humour et absence de doublon visuel ;
5. décliner les situations restantes par lots d'étape ;
6. produire les objets héros du catalogue matériel ;
7. remplacer les anciens médias uniquement après validation du lot complet.

Avancement : les six lots, de **Germination** à **Séchage & affinage**, sont
intégrés. Les trente situations disposent chacune d'une scène dédiée. Chaque
carte conserve la fiche personnage de Sylvain et possède une action, un gag et
une dominante chromatique distincts. La coupure de courant conserve en plus son
illustration d'état prioritaire. Le premier lot d'objets héros du catalogue est
également intégré, puis étendu au catalogue complet : les dix-huit équipements
disposent chacun d'un visuel e-commerce cartoon distinct. Les différences de
gabarit, de mécanisme et d'usure rendent la progression starter, intermédiaire
et premium lisible avant même la lecture du prix. Les pictogrammes de catégorie
ne servent plus que de repli technique pour un éventuel code inconnu.

Critères d'acceptation : enjeu lisible sans texte, sujet intact dans le cadre
carré, contraste AA autour des overlays, aucune marque réelle visible, aucun
texte généré illisible et aucune illustration réutilisée pour deux effets. Le
test automatisé contrôle aussi les doublons binaires, le ratio et le poids des
WebP réellement référencés.

### Planche de validation humaine

Le pilotage du Placard dans l'administration expose désormais une planche
dynamique : un socle de 89 visuels (36 cartes La Botte, 30 situations, l'état
Coupure de courant et 22 équipements), complété par une carte Héritage pour
chaque producteur actif. L'ajout ou le retrait d'un producteur recalcule le
manifeste de revue ; toute nouvelle carte ou image modifiée revient à contrôler.
Une image producteur peut servir d'aperçu de secours, mais ne peut pas être
validée comme illustration finale. Les quatre machines américaines ajoutées au catalogue
(`AUTO-SIEVE`, `WASHER-75G`, `TSS-225`, `STATIC-PLASMA`) possèdent chacune un
visuel cartoon dédié, produit à partir d'une photographie réelle du fabricant afin
de conserver la silhouette, l'échelle et les organes techniques du matériel.
Chaque vignette
peut être agrandie, validée, renvoyée en retouche ou remise à contrôler. Les
filtres isolent une famille ou un statut.

Les anciennes planches hors interface restent disponibles comme archive du
socle historique de 48 faces. La planche Héritage dynamique de référence est
désormais celle de l'administration, car elle seule reflète les producteurs
présents et exclut les cartes archivées :

```powershell
node scripts/generate-kanab-quest-card-contact-sheets.mjs
```

La commande produit `output/placard-botte-card-audit-20260902.webp` et
`output/placard-heritage-card-audit-20260902.webp`. La planche des 31 situations
est produite séparément par
`scripts/generate-kanab-quest-situation-contact-sheet.mjs`.

Les statuts sont volontairement conservés dans le navigateur de la personne qui
réalise la revue. Chaque décision mémorise aussi le fichier effectivement vu :
si l'URL d'un visuel change, son ancienne validation est automatiquement remise
à contrôler. Le rapport JSON daté peut être exporté, archivé avec le dossier de
lancement, puis réimporté sur un autre navigateur. L'import refuse les versions
inconnues et sépare les décisions valides des fichiers modifiés, absents ou
étrangers au manifeste courant. Ce rapport, et non le stockage local du
navigateur, constitue la trace partageable de la décision humaine.

### Audit des cartes La Botte

Le lot `BOTTE-001` à `BOTTE-006` est validé. Les cinq premières illustrations
respectent déjà la grammaire commune et restent inchangées. `BOTTE-006 — Deuxième
chance` passe en `v2` : un seul Sylvain fidèle à la fiche personnage lance deux
dés dans une action unique et lisible. Le badge de catégorie emploie désormais
le repère ASCII `D6`, fiable dans le générateur et cohérent avec la mécanique.

Le lot `BOTTE-007` à `BOTTE-012` est également validé. `BOTTE-007` et
`BOTTE-008` passent en `v2` pour montrer respectivement une hydroponie
recirculante avec réservoir et une aéroponie haute pression avec racines
brumisées. Les trois scènes de mode de culture et les trois scènes d'auxiliaires biologiques emploient
des cadrages et des sujets distincts ; chaque bénéfice reste compréhensible sans
texte et aucune silhouette de personnage n'est répétée artificiellement.

Le lot `BOTTE-013` à `BOTTE-018` est validé sans nouvelle génération. Les trois
cartes qui montrent Sylvain conservent ses marqueurs visuels, et les objets héros
restent immédiatement identifiables. Le testeur pH-EC emploie volontairement une
personnification d'outil : elle apporte de l'humour sans devenir un doublon de
Sylvain ni brouiller l'effet de jeu.

Le lot `BOTTE-019` à `BOTTE-024` est validé. `BOTTE-021` passe en `v2` : les
sacs et coupelles d'amendements mesurés remplacent l'ancien compost afin de
montrer un engrais bio complet. Les matières, les
auxiliaires et le tensiomètre possèdent six silhouettes propres et montrent des
fonctions distinctes ; leur lecture reste nette dans le recadrage des cartes.

Le lot `BOTTE-025` à `BOTTE-030` est validé. Les cartes de réponse racontent
chacune une action propre, Sylvain reste conforme à sa fiche, et le branchement
risqué demeure une caricature de mauvaise idée sans devenir un schéma pratique.

Le lot `BOTTE-031` à `BOTTE-036` est validé. Les réponses administratives,
l'observation, la récolte, la défense canine, le tri par lots et l'hygiène des
outils ferment La Botte avec six promesses distinctes. `Gros molosse` conserve
son rottweiler au premier plan, son morceau de caleçon et un Sylvain fidèle en
retrait. Les 36 cartes La Botte sont donc auditées.

Les Héritages `001` à `010` sont validés dans leurs deux sous-familles : gravure
dorée incarnée pour les portraits de producteurs, puis cartoon doré pour les
pouvoirs de fin de progression. `HERITAGE-011` et `HERITAGE-012` passent en `v2`
pour supprimer les doublons de Sylvain. La canopée protectrice montre désormais
un seul Sylvain et une transformation danger/réussite ; la Signature du maître
montre exactement cinq dés, dont trois conservés et deux écartés. Leurs faces
composées passent en `v4` afin de préserver les anciens exports `v3`.
