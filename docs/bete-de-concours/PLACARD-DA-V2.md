# Le Placard — direction artistique V2

Statut : direction commune du quartier et des interfaces du Placard
Mise à jour : 2026-10-13 (cadre initial du 2026-08-30)

## 1. Intention

La référence actuelle est le village breton de Sylvain
`public/placard/map/placard-world-sylvain-v5.webp` : bâtiments modestes et
expressifs, silhouettes légèrement de travers, gros contours encrés, aplats
crème, turquoise, bois et moutarde. Le cartoon doit rester lisible et loufoque.
L'ancienne intention d'affiche cinématographique sombre est remplacée par ce
cadre pour les lieux et l'interface ; les cartes gardent leurs scènes propres.

Une même direction artistique ne signifie pas un même intérieur. Chaque lieu
reprend la composition de son ancienne illustration : équipements, disposition,
personnages et fonction reconnaissables. La banque garde son vieux banquier,
la comptabilité ses registres, le bureau commercial son tableau de clients,
l'atelier sa presse et le grossiste sa camionnette. Ne pas reproduire partout
un comptoir, une fenêtre ronde ou Sylvain dans la même pose.

Le commerce porte sur le chanvre : fleurs, bocaux, sachets et flacons. Aucun
étal de fruits ou légumes. Les icônes fruitées des demandes désignent uniquement
les arômes recherchés. Les nouvelles images sont des créations originales et
ne reprennent aucun logo, personnage ou composition d'une licence tierce.

Le ton repose sur le contraste entre une aventure présentée comme épique et des
problèmes très ordinaires : facture, voisin curieux, contrôle administratif,
matériel qui chauffe ou voleur mal préparé. Sylvain reste le fil rouge visuel.

## 2. Grammaire commune

- silhouette et enjeu compréhensibles en moins d'une seconde ;
- une action principale par image, sans collage de petits gags concurrents ;
- conserver le cadrage propre à chaque intérieur ; gestes expressifs et visages lisibles ;
- gros contours noirs réguliers, volumes simples en aplats, trame halftone,
  lumière chaude et ombres bleu pétrole ;
- palette d'interface : crème `#fff1d6`, bois `#d5a573`, moutarde `#efc451`,
  turquoise `#149b8b` et encre `#172923` ;
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

La Boutique du quartier vend les cartes et packs. Le matériel s'achète dans
l'Entrepôt. Toutes les interfaces partagent des panneaux crème, des contours
encrés de 2 à 3 px, des angles arrondis et des ombres décalées ; le bois,
le turquoise et la moutarde distinguent les commandes et les états.
L'illustration décrit le lieu, tandis que prix, quantités et actions restent
du texte HTML lisible. Éviter les fonds illustrés sous un voile et les grands
panneaux vert sombre qui masquent les différences entre les bâtiments.

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

## Quartier dans le style de Sylvain — 13 octobre 2026

Le décor du quartier devient `public/placard/map/placard-world-sylvain-v5.webp`
(1 536 × 1 024, environ 403 Kio). Sa référence directe est `public/sylvain.png` :
gros contours noirs, formes rondes et décalées, aplats crème, beige, turquoise et
vert profond, avec des touches de trame. Les bâtiments sont modestes et expressifs :
grange rafistolée, petite banque à porte de coffre, bureau encombré de papiers,
étal de marché, boutique, halle de village, panneau de missions et cabane de collection.
Les ardoises, le granit, les hortensias, le drapeau et le littoral ancrent le décor
en Bretagne. La première proposition, trop sage, reste dans les alternatives locales
et n’est pas utilisée par le site.

L’illustration a été créée avec **imagegen intégré**, puis compressée avec Sharp.
Le prompt exact et la provenance sont conservés dans
`public/placard/map/placard-world-sylvain-v5.json`. Les anciennes illustrations
v1–v3 sont préservées.

La surbrillance n’utilise plus de rectangle au-dessus du décor. Les contours de
`KqPlacardMap.geometry.ts` suivent les toits, cheminées, façades et éléments attenants.
Le même polygone découpe la zone cliquable et la copie éclaircie de l’image, avec
un halo sur son contour. Le sol entre les lieux ne déclenche pas de navigation.
Les huit boutons natifs restent accessibles au clavier ; leurs noms disposent
aussi de cibles tactiles de 44 px. Les survols de la navigation, le focus et la
sélection activent le bâtiment correspondant. Le zoom et le déplacement sont conservés.

La recette `scripts/audit-placard-navigation.mjs` passe à 320, 390, 768 et 1 440 px,
ainsi que ses 13 scénarios de navigation. Elle vérifie des points de façade relevés
sur l’image indépendamment des polygones, le sol hors masque, les destinations,
le survol, le focus, les cibles tactiles, le zoom et sa restauration. Captures et
rapport : `output/placard-navigation/`. Les destinations et API sont simulées
localement ; aucun compte joueur distant n’est utilisé. Le code et le décor sont
intégrés dans le projet local, sans publication du site.

## Entrepôt et menus assortis au village — 13 octobre 2026

L’entrepôt utilise désormais `public/placard/warehouse-v4/overhead-room-sylvain-v1.webp`
(1 536 × 1 024, environ 181 Kio). Les murs de granit arrondis, le bois rafistolé,
les ferrures turquoise, les lampes moutarde et les détails bretons reprennent
le dessin de Sylvain et du quartier. La vue reste verticale et le sol accueille
la même grille de 40 × 25 cases : origine (168, 120), cases de 30 pixels dans
l’image. Aucun changement de coordonnées, de surface ou de règles de jeu.

Image créée avec **imagegen intégré**, puis compressée en WebP avec Sharp.
Le prompt exact, les références et la provenance sont dans
`public/placard/warehouse-v4/cartoon-sylvain-v1.json`. Le décor précédent est conservé.
Les trois anciens atlas de matériel, conservés lors de cette première étape,
sont remplacés par les illustrations individuelles décrites plus bas dans
« Matériel de culture et carrousel des Buddies ».

L’habillage reprend la même palette : encre `#172923`, turquoise `#149b8b`,
crème `#fff1d6`, bois `#d5a573`, moutarde `#efc451`. Les contours de 2 à 3 px,
ombres décalées, petites enseignes et angles arrondis sont appliqués au plan,
à l’inspecteur des zones, à la boutique, au carrousel des Buddies, au stockage,
à l’inventaire et aux gammes de l’atelier. Les couleurs distinguent toujours
sélection, indisponibilité et erreur ; le focus clavier reste visible.

La navigation générale, le menu mobile, les commandes du quartier et les
panneaux d’accueil suivent cette grammaire. Sylvain apparaît dans le panneau
de prochaine action ; « Boutique » reste le seul libellé du lien d’achat.
Les prix, achats, campagnes communes et gestes de manipulation sont conservés.
Les modifications sont intégrées localement, sans migration ni publication.

Validation : compilation Next.js et TypeScript réussie (139 pages), lint ciblé,
12 modules CSS analysés, navigation à 320/390/768/1 440 px et 13 scénarios,
puis les 38 groupes de l’audit complet de l’entrepôt, sans erreur JavaScript.
L’audit vérifie le chargement du nouveau décor, le cadrage, les 1 000 m², le zoom,
les gestes souris/tactiles, les achats et les trois gammes. Les boutons de gamme
de l’atelier s’empilent dans les panneaux les plus étroits pour rester dans leur carte.
Rapports et captures dans `output/warehouse-v4/` et `output/placard-navigation/`.
La reprise ciblée valide aussi les gammes de l’atelier après correction, les
fenêtres sur mobile, les 6 groupes de campagnes communes et les 21 groupes
du carrousel/glisser-déposer des Buddies, sans erreur JavaScript.

## Entrée dans les cultures — 13 octobre 2026

Le grand bandeau « Prépare ta culture », son slogan et l’ancienne scène du
placard sont retirés de la préparation. Une illustration panoramique de la
petite grange du quartier les remplace, sans texte incrusté. Elle s’affiche
entièrement, sur 720 px de large au maximum (environ 240 px de haut sur PC,
100 px sur téléphone). Le titre de page reste accessible aux lecteurs d’écran.
Le rappel sur la vitalité et le secours est conservé dans « Aide », repliée
par défaut. Les informations propres à l’essai assisté sont conservées.

Image : `public/placard/map/culture-barn-sylvain-v1.webp`, 1 536 × 512,
environ 135 Kio. Création avec **imagegen intégré**, références quartier v5
et Sylvain ; prompt et provenance dans `culture-barn-sylvain-v1.json`.
Les anciens styles du bandeau ont été supprimés sans modifier le déroulement
de préparation ou les règles de jeu.

Vérification avec les fixtures de campagne locales à 320, 390 et 1 440 px :
image entièrement visible, slogan absent, aucun débordement et aucune erreur
JavaScript. Aide, choix des cartes et Héritage accessibles au clavier ; le
lancement reste accessible sans exécuter de partie. Captures dans
`output/culture-preparation-refresh/`. Lint TSX et analyse CSS réussis.

## Boutique de cartes et Collections — 13 octobre 2026

La Boutique du quartier réunit désormais deux rayons : Botte du Chanvrier et
Buddies. Le livre et le catalogue de matériel sont retirés du comptoir. Les
équipements restent dans l’Entrepôt ; les anciens liens de la Boutique vers
le matériel y sont redirigés en conservant le matériel demandé. L’ordinateur
de commerce est également accessible depuis l’atelier de l’Entrepôt.

Le nouveau comptoir illustré de Sylvain présente uniquement des cartes et
des packs. Image créée avec **imagegen intégré**, références quartier v5 et
Sylvain : `public/placard/card-shop-sylvain-v1.webp` (1 536 × 512, 228 Kio).
Le prompt exact et la provenance sont dans `card-shop-sylvain-v1.json`.
Les prix, achats, packs offerts et tirages utilisent les API existantes :
10 cartes Botte pour le prix renvoyé par le serveur, 3 Buddies pour 100 points
fidélité. Les packs déjà acquis et les gains de duel restent accessibles.

Le bâtiment **Collections** et le menu ouvrent les deux albums, avec un
accès direct au rayon correspondant. L’album Buddies utilise les cartes du
compte, affiche les possédées, manquantes et doublons, et permet d’agrandir
une carte pour lire son profil de jeu. Le chargement des Buddies se fait
à la première visite de l’onglet. Les tutoriels conservent leur API isolée.

La boutique reprend les contours noirs, le bois, le turquoise et la crème
du village. Les prix et commandes restent dans le flux de la page pour
être lisibles et accessibles sur téléphone. Les dialogues gèrent Échap,
le focus clavier et le retour au contrôle d’origine.

Validation locale sur données simulées à 320, 390 et 1 440 px : achat,
ouverture et rangement dans les deux albums, prix et points, packs offerts,
soldes insuffisants et parcours clavier. Les réponses perdues, rechargements
et attributions tardives sont contrôlés sans second débit. Les parcours de
navigation (17 scénarios), Collections et les 8 groupes Boutique passent
sans erreur JavaScript ni débordement. Rapports et captures :
`output/placard-card-shop/`, `output/placard-collection/` et
`output/placard-navigation/`. Compilation Next.js et TypeScript, lint ciblé
et tests unitaires réussis. Aucune migration ni publication pour cette refonte.

La compilation de cette étape termine avec succès (139 pages), mais la revalidation
des données publiques Supabase/CMS signale des erreurs réseau `fetch failed`
dans cet environnement. Les contrôles interactifs ci-dessus utilisent les
fixtures locales ; aucun achat ni tirage sur un compte réel n’a été exécuté.

## Tous les lieux et leurs menus — 13 octobre 2026

Les écrans Commerce, Finances, Missions, Culture, Récoltes et leurs fenêtres
reprennent désormais la palette et les contours du village. Les tutoriels,
carrousels, soins, jury et ouvertures Botte sont également harmonisés. Les
prix, règles, confirmations et aides restent disponibles. Sur PC, l'action
de lancer est placée directement sous les dés ; les choix facultatifs suivent.
La navigation des onglets Marché conserve le focus clavier sur l'onglet choisi.
La Banque et la Comptabilité affichent leur illustration entière à côté du
titre, puis sous le titre sur mobile : aucun cartouche ne masque les personnages
et aucun recadrage ne supprime les repères du lieu.

Neuf illustrations sont des **éditions de leurs originaux respectifs**, avec
imagegen intégré puis export WebP (1 536 × 1 024, qualité 86). Le village v5
sert uniquement de référence de dessin. Le manifeste
`public/placard/da-interiors-sylvain-v2.json` conserve les prompts exacts,
les images originales et la provenance de chaque résultat.

| Lieu / fonction | Illustration dans `public/placard/` | Repères conservés |
| --- | --- | --- |
| Atelier / réserve | `market-workshop-sylvain-v2.webp` | Presse, manomètre, tamis, petite machine ronde |
| Bureau commercial | `commerce-office-sylvain-v3.webp` | Tableau de clients, carnet, ordinateur et chat |
| Comptabilité | `bureau-accounting-sylvain-v2.webp` | Registres, calculatrice et casiers d'archives |
| Banque | `bureau-bank-sylvain-v2.webp` | Vieux banquier, fauteuil et coffre |
| Vente en ligne | `channel-online-sylvain-v2.webp` | Poste informatique et colis |
| Boutique de chanvre | `channel-cbd-shop-sylvain-v2.webp` | Devanture, auvent et bocaux de fleurs |
| Grossiste | `channel-wholesale-sylvain-v2.webp` | Hangar, sacs, transpalette et camionnette |
| Studio de marque | `market-brand-studio-sylvain-v3.webp` | Maquettes de sachets et tableau de création |
| Communication | `market-social-missions-sylvain-v3.webp` | Sylvain photographiant ses produits |

Les premières propositions de lieux génériques ne sont pas intégrées.
Les intérieurs gardent leur usage et leurs personnages ; aucun marché de
fruits et légumes n'est introduit. La leçon d'achat de matériel montre
l'Entrepôt, et les leçons Banque et Placements ont des images distinctes.

Recette locale : Commerce et Finances sur quatre largeurs, navigation clavier
du Marché, Missions et récompenses, progression, soins, campagne commune,
récolte et jury, échecs, packs et tutoriels. Les contrôles navigateur utilisent
des données simulées sans achat distant. Captures et rapports dans
`output/placard-commerce-clarity/`, `output/placard-treasury/`,
`output/placard-missions/`, `output/culture-village/` et
`output/playable-operations/`. Les fenêtres restent utilisables à 320 px.
Les 58 feuilles CSS du Placard sont analysées sans erreur et le lint ciblé passe.
La compilation finale Next.js et TypeScript réussit (139 pages). La recette
finale des en-têtes Banque et Comptabilité valide les six vues à 320, 390 et
1 440 px : images entières au ratio 3:2, aucun chevauchement ni débordement.
Rapport : `output/placard-treasury/report-headers.json`.
Cette refonte ne comporte ni migration ni publication.

## Matériel de culture et carrousel des Buddies — 13 octobre 2026

Dans le plan de l’Entrepôt, le carrousel des Buddies dispose d’une commande
pour se replier et se rouvrir. Il apparaît uniquement dans le mode Cultures,
hors aménagement et boutique, et disparaît dans l’Atelier et le Stockage.
Depuis le 14 octobre, le plan s’ouvre sur **Aménager**, placé avant **Cultures**.
Le retour au plan depuis une autre pièce revient aussi sur Aménager.
Dans Cultures, le bouton **Choisir mes Buddies** ouvre le carrousel, fermé par
défaut. Une croix visible permet de le réduire ; les cartes sont retirées
de l’affichage et du parcours clavier jusqu’à sa réouverture.
Fermer le carrousel ou changer
de contexte interrompt le glisser-déposer sans modifier les affectations
des zones. Les gestes souris et tactiles restent disponibles.

Les 36 offres du catalogue et les 18 gammes de machines ont chacune leur
illustration. Les soins, contenants, emballages et objets du plan reprennent
aussi les contours noirs, le turquoise, le bois et le jaune du village.
Les images s’affichent entières sur fond transparent. Le matériel conserve
sa fonction liée à la culture et à la transformation du chanvre ; aucune
tente n’est ajoutée au catalogue géré par zones. Les anciennes références
de tentes restent disponibles uniquement pour les parcours historiques.
Le compteur de tentes disparaît du quartier et l’accès à l’aménagement
mentionne les zones, le matériel et l’entretien.

Les 87 images individuelles sont dans `public/placard/equipment-sylvain-v1/`
(WebP, 512 × 512, environ 3,8 Mio au total). Création avec **imagegen intégré**,
en prenant l’atelier Sylvain comme référence. Les prompts exacts, sources
et cellules exclues sont conservés dans `manifest.json`. Le script
`scripts/export-placard-equipment-artwork.mjs` extrait les objets par régions
transparentes et les redimensionne sans fragments des cases voisines.

Le quartier utilise désormais `public/placard/map/placard-world-sylvain-v6.webp` :
l’étal présente des fleurs de chanvre, bocaux et sachets. Cette édition ciblée
conserve la composition et les bâtiments. Son fichier JSON voisin documente
le prompt et la provenance ; les coordonnées et masques restent identiques.

Validation locale à 320, 390 et 1 440 px : 30 groupes de contrôles du carrousel,
54 images de matériel dans 180 rendus, 17 contrôles des fournitures et
12 cas de plan, puis les huit façades du quartier (masques, clavier et
zoom/déplacement). Aucun débordement ni erreur JavaScript. Les contrôles
utilisent des données simulées, sans transaction sur un compte réel.
Rapports et captures dans `output/warehouse-v4/`, `output/equipment-sylvain/`,
`output/placard-supply-artwork/` et `output/scene-assets-final/`.
Les 25 tests matériel/gammes et 13 tests de vente en ligne passent, ainsi que
le lint ciblé et la compilation Next.js/TypeScript (139 pages).
Cette étape ne comporte ni migration ni publication.

## Entrepôt de départ de 100 m² — 13 octobre 2026

Le nouveau plan présente une pièce de 10 × 10 m, entièrement visible dès
l’entrée à 100 % de zoom. Le cadrage tient compte de la largeur et de la hauteur
de la fenêtre ; « Ma zone » et « Ensemble » permettent de naviguer entre le
détail et la pièce. Cases, équipements, limites de tracé et repères utilisent
la même échelle. Les futurs achats d’un entrepôt ou d’un terrain pour serre
restent prévus pour une prochaine étape.

Le décor carré reprend le bois, la pierre bretonne, le turquoise et les contours
cartoon du précédent intérieur. Image créée avec **imagegen intégré**, exportée
en WebP 1 024 × 1 024, environ 133 Kio :
`public/placard/warehouse-v4/overhead-room-100m2-sylvain-v1.webp`.
Le fichier JSON voisin conserve le prompt exact, la référence et la provenance.
Le sol libre correspond à la grille ; les objets restent ajoutés par le jeu.

Recette à 320, 390 et 1 440 px : 12 contrôles du plan et 18 de l’entrepôt,
dont déplacement/redimensionnement, zoom ancré, Buddies souris/tactile,
sauvegarde, rechargement et campagne commune. Rapports et captures dans
`output/warehouse-100m2/`. Build et TypeScript passent. La migration de
surface est appliquée à la base bêta, sans reset ni publication du site ;
la compatibilité et les preuves sont décrites dans `PLACARD-ENTREPOT-V2.md`.

## Arène et tableau du village — 14 octobre 2026

L’accueil de l’Arène, les classements, les récompenses, les panneaux de
progression et les commandes du guide reprennent le crème, le bois, le
turquoise, les contours encrés et les ombres décalées du village. Le carnet
conserve ses pages et son fonctionnement ; son cadre et sa navigation
suivent la même palette. Les illustrations restent visibles sans voile sombre.

Le nouveau tableau présente les trois contributions du classement général :
Carnet 300, Duels 500, Entreprise 200. Le développement de l’entreprise
affiche ses trois plafonds : chiffre d’affaires 80, production 60 et valeur
nette 60. Seul le score Entreprise public est affiché pour les autres joueurs,
pas leur trésorerie ni le détail de leurs placements.

Les listes affichent jusqu’aux 100 joueurs renvoyés par les API. « Ma place »
fait défiler le tableau et place le focus sur le joueur. Dégustation et Placard
gardent leurs classements propres. Chargement, liste vide, erreur et nouvelle
tentative sont distincts ; le bocal de récompenses reste monté entre les onglets.
Le retour après connexion conserve désormais la destination classement.

Deux illustrations sont des éditions de leurs originaux avec **imagegen
intégré**, puis export WebP qualité 86, 1 536 × 1 024 :

- `public/contest/map/arena-desk-sylvain-v6.webp` : bureau lumineux, avec les
  coordonnées du miroir, du carnet, de l’ordinateur et du tableau conservées ;
- `public/contest/mascot/arena-scene-classement-sylvain-v3.webp` : Sylvain et
  son trophée sur les trois podiums, dans la halle bretonne en bois et pierre.

Les JSON voisins conservent les prompts exacts, la référence village v6 et la
provenance. Les illustrations précédentes restent disponibles.

Validation locale : 38 tests de composants, accès et calcul, TypeScript et
lint ciblé. L’audit de l’accueil couvre cinq largeurs de 320 à 1 440 px,
les invités, nouveaux joueurs, habitués et accès avant ouverture. Le classement
dispose de 31 contrôles navigateur sur quatre largeurs : 100 joueurs,
position personnelle, onglets, erreurs, portraits et récompenses. Les données
sont simulées et les appels distants bloqués. Captures et rapports dans
`output/arena-clarity-release/` et `output/arena-village/`.
Le carnet ouvert et fermé, les deux groupes du guide et la découverte des
collections sont aussi contrôlés à 320, 390 et 1 440 px, sans débordement ni
erreur JavaScript ; captures et rapport dans `output/arena-village-css/`.

Cette refonte est locale, sans publication. L’activation du calcul Entreprise
en base dépend des trois migrations préparées le 14 octobre ; la refonte
visuelle ne les applique pas.
