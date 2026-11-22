# Entrée dans l’encyclopédie du QuizzShow

Sur l’aperçu local corrigé, le choix du rayon est possible pendant le téléchargement du catalogue. La recette finale a retenu la requête de biologie, ouvert le rayon, constaté que les fiches attendaient le catalogue, puis libéré la requête et ouvert « Cannabis sativa ». Chrome a émis **0 requête pour le moteur WebGL** dans cette configuration HTML. [Vérification finale `slowCatalog`](performance-appariee-finale.json) · [Vérification du premier correctif](performance-apres.json)

## Méthode locale

Les versions sont servies en localhost par la fixture en mémoire du Quartier. L’avant (`3663`) attend le catalogue dans `KqCannabisReference`. Le premier correctif (`3665`) rend les rayons disponibles pendant le chargement du catalogue. Le correctif final (`3666`) importe la fiche en même temps que le panneau de l’encyclopédie, qui reste chargé à l’ouverture. L’index de recherche est construit à la demande. Les marqueurs ont été vérifiés dans les modules servis. Les essais ouvrent le même article, « Cannabis sativa ». [Fixture](../../../scripts/audit-placard-navigation.mjs) · [Script de mesure](../../../scripts/measure-quizzshow-entry.mjs)

La mesure appariée tourne dans un seul Chrome headless, WebGL désactivé, à 390 × 844 px avec toucher émulé et à 1 440 × 900 px au clavier. Le DPR est de 1. À chaque largeur et pour chaque version, trois nouveaux contextes de navigateur effectuent un premier passage à froid et un second à chaud dans le même contexte, après effacement du `sessionStorage`. L’ordre avant/après s’inverse entre répétitions et s’équilibre sur les deux largeurs. Le cache du serveur de développement suit son propre cycle.

Le premier contrôle est chronométré depuis le début de la navigation. Les trois autres délais vont de l’activation du contrôle à l’apparition du rayon, des entrées ou du titre de l’article. Les durées comprennent la commande du navigateur et l’attente du sélecteur.

## Première série, sessions séparées

Médianes entières en millisecondes, trois passages par cellule et par version. Dans chaque cellule, avant → après. [Avant](performance-avant.json) · [Après](performance-apres.json) · [Trace intermédiaire](performance-intermediaire.json)

| Largeur et cache | Premier contrôle | Rayons | Entrées | Article |
|---|---:|---:|---:|---:|
| 390 px, froid | 1 414 → 3 218 | 1 189 → 3 675 | 236 → 1 311 | 204 → 1 427 |
| 390 px, chaud | 970 → 2 030 | 731 → 979 | 206 → 350 | 181 → 680 |
| 1 440 px, froid | 1 328 → 3 203 | 758 → 1 153 | 307 → 429 | 121 → 535 |
| 1 440 px, chaud | 743 → 1 773 | 587 → 784 | 229 → 373 | 53 → 440 |

À 390 px à froid, le premier contrôle a varié de **1 327 à 9 140 ms** avant et de **2 452 à 41 624 ms** après dans les sessions séparées. Cette dispersion mesure la sensibilité au contexte du poste et du serveur de développement. La trace du port `3664` correspond à une étape intermédiaire distincte, conservée pour permettre la comparaison des mesures.

## Mesure appariée du premier correctif

Les 24 passages se terminent sur le même article. Le poste utilise Windows x64 (`10.0.26200`), un Intel Core i5-1235U à 12 processeurs logiques et Chrome `157.0.8103.79`. Rejouer avec `node scripts/measure-quizzshow-entry.mjs appariee`. [Mesures brutes et ordre des passages](performance-appariee.json)

Chaque cellule indique la **médiane [minimum–maximum]**, en millisecondes, sur trois passages.

| Largeur et cache | Version | Premier contrôle | Rayons | Entrées | Article |
|---|---|---:|---:|---:|---:|
| 390 px, froid | Avant | 1 806 [1 560–5 091] | 1 777 [1 572–1 827] | 270 [185–453] | 192 [186–345] |
| 390 px, froid | Après | 1 728 [1 707–2 651] | 566 [556–3 227] | 484 [195–1 104] | 519 [499–2 186] |
| 390 px, chaud | Avant | 1 295 [1 210–1 599] | 916 [675–953] | 242 [182–363] | 196 [130–209] |
| 390 px, chaud | Après | 933 [836–2 643] | 495 [452–701] | 249 [119–518] | 537 [477–538] |
| 1 440 px, froid | Avant | 1 916 [1 713–2 496] | 1 165 [815–1 421] | 376 [316–399] | 148 [147–159] |
| 1 440 px, froid | Après | 1 691 [1 614–2 091] | 719 [554–1 969] | 201 [179–364] | 442 [378–503] |
| 1 440 px, chaud | Avant | 1 272 [1 186–1 480] | 780 [753–1 009] | 345 [302–366] | 92 [92–94] |
| 1 440 px, chaud | Après | 1 213 [753–1 320] | 416 [391–765] | 227 [206–255] | 391 [373–439] |

La médiane des écarts est calculée sur les trois différences **après moins avant** de chaque configuration. Un écart négatif correspond à un délai plus court.

| Largeur et cache | Premier contrôle | Rayons | Entrées | Article |
|---|---:|---:|---:|---:|
| 390 px, froid | +147 | −1 016 | +299 | +327 |
| 390 px, chaud | −277 | −215 | +7 | +342 |
| 1 440 px, froid | −302 | −611 | −175 | +294 |
| 1 440 px, chaud | −59 | −362 | −111 | +299 |

L’accès aux rayons s’améliore dans les six paires à chaud. À froid, une paire par largeur reste plus lente après correction. À 390 px à froid, le premier contrôle est **147 ms plus lent selon la médiane appariée**, alors que les médianes par version sont de 1 806 et 1 728 ms. Le dernier geste jusqu’au titre prend plus de temps dans les douze paires. La preuve la plus stable concerne la possibilité de choisir un rayon pendant le téléchargement du catalogue.

## Mesure appariée du correctif final

Le rendu de la fiche est désormais importé avec le panneau de l’encyclopédie. Le clic sur un rayon ouvre ce rayon directement. Les 24 passages du nouveau comparatif `3663` ↔ `3666` atteignent « Cannabis sativa ». Rejouer avec `node scripts/measure-quizzshow-entry.mjs appariee-finale`. [Mesures finales et preuve du catalogue retenu](performance-appariee-finale.json)

Chaque cellule indique la **médiane [minimum–maximum]**, en millisecondes, sur trois passages.

| Largeur et cache | Version | Premier contrôle | Rayons | Entrées | Article |
|---|---|---:|---:|---:|---:|
| 390 px, froid | Avant | 2 111 [1 426–4 228] | 1 017 [967–1 569] | 227 [224–246] | 282 [223–317] |
| 390 px, froid | Après | 1 282 [959–5 754] | 446 [434–1 040] | 172 [156–815] | 148 [138–189] |
| 390 px, chaud | Avant | 884 [729–1 109] | 732 [671–809] | 248 [175–370] | 160 [143–297] |
| 390 px, chaud | Après | 645 [565–739] | 436 [428–514] | 111 [85–202] | 177 [81–203] |
| 1 440 px, froid | Avant | 1 806 [1 772–1 887] | 1 054 [1 052–1 062] | 277 [246–380] | 173 [165–318] |
| 1 440 px, froid | Après | 2 161 [1 428–2 599] | 712 [600–917] | 322 [221–342] | 194 [140–319] |
| 1 440 px, chaud | Avant | 1 254 [1 188–1 457] | 761 [686–995] | 246 [246–322] | 156 [98–231] |
| 1 440 px, chaud | Après | 1 130 [911–1 258] | 592 [431–609] | 228 [109–242] | 112 [95–133] |

Médianes des écarts **après moins avant**, en millisecondes.

| Largeur et cache | Premier contrôle | Rayons | Entrées | Article |
|---|---:|---:|---:|---:|
| 390 px, froid | −144 | −529 | −71 | −128 |
| 390 px, chaud | −164 | −304 | −90 | −62 |
| 1 440 px, froid | +274 | −350 | −38 | +1 |
| 1 440 px, chaud | −199 | −255 | −94 | −23 |

Les rayons apparaissent plus tôt dans les douze paires. Pour l’article, les médianes appariées sont comprises entre **−128 et +1 ms**, contre **+294 à +342 ms** avec le premier correctif. Le premier contrôle à 1 440 px à froid reste plus lent de **274 ms** en médiane appariée. Le premier contrôle à 390 px à froid s’étend de **959 à 5 754 ms** après correction, ce qui laisse une forte variation locale.

## Limites de la recette locale

Ces mesures concernent les fixtures Vite sur le poste et la navigation HTML avec WebGL désactivé. Le lot 6 prévoit encore la mesure de la 3D du village sur Android, iPhone et ordinateur de référence, avec les réseaux réellement utilisés. Le trajet hébergé authentifié doit être mesuré jusqu’au reçu puis après reconnexion dans l’application et la base isolées prévues pour la recette. [Protocole terrain](terrain.md) · [Feuille de mesures](mesures-terrain.csv)
