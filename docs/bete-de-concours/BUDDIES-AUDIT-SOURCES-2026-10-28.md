# Audit des fiches Buddies — 28 octobre 2026

Les 52 fiches ont été examinées, dont un personnage fictif. Le dossier contient 129 contrôles portant sur 125 URL distinctes, avec leurs conditions d’accès. Les 51 autres profils ont été révisés, parfois uniquement pour préciser l’attribution ou remplacer une référence : ce nombre n’est pas un décompte d’erreurs factuelles.

L’audit couvre l’histoire, l’origine, la lignée, les caractéristiques et la justification des deux arômes affichés. Les corrections sont intégrées aux deux fichiers JSON applicatifs et à la provenance du catalogue aromatique.

## Ce que les sources permettent d’affirmer

Les textes des créateurs renseignent leurs propres sélections ; les producteurs renseignent leurs produits ou récoltes. Ces sources sont identifiées comme commerciales : elles ne constituent pas une authentification génétique indépendante ni une garantie du goût de chaque plante. Les témoignages individuels et les bases secondaires sont distingués des descriptions directes.

Cette prudence est cohérente avec les travaux de [Watts et al., Nature Plants, 2021](https://www.nature.com/articles/s41477-021-01003-y) et de [Smith et al., PLOS ONE, 2022](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0267498), qui montrent les limites des noms commerciaux comme indicateurs d’identité génétique ou chimique. Ces études ne vérifient pas individuellement les 52 fiches ; la première porte principalement sur des échantillons à THC et la seconde inclut un auteur affilié à Leafly.

## Corrections et réserves principales

- **Harlequin** : Wade Laughter est décrit comme découvreur et diffuseur, conformément au [récit de Project CBD](https://projectcbd.org/newsletter/project-cbd-newsletter-remembering-wade-laughter-the-unsung-hero-of-cbd-plus-hemp-thc-legislation-state-cannabis-policy-updates-and-cbd-research-on-alzheimers-disease/).
- **Special Sauce** : la provenance aromatique [Sonoma Hills Farm](https://sonomahillsfarm.com/terpenes/) renvoie à Bubblegum, pas à Chemberry.
- **Remedy** : suppression de la chronologie trop assurée « Z7 puis Remedy » ; les récits commerciaux et la [description historique de Z7](https://seedfinder.eu/en/strain-info/z7/cbd-crew) ne permettent pas cette simplification.
- **Super Lemon Haze CBD** : le [rapport Ambra](https://cbweed.com/wp-content/uploads/laboratory-analysis/09_04_2025_SUPER-LEMON-HAZE-CBD-EU.pdf) est daté du 17 avril 2024 malgré son nom de fichier. Fibranova est renseignée par le client, pas identifiée génétiquement par le laboratoire.
- **Berry Blossom** : retrait des précisions rose, mûre, açaï et de détails morphologiques non retrouvés dans les descriptions actuelles. La paire générale baies/floral reste attribuée aux producteurs.
- **Arômes** : bois de Cannatonic, musqué de Sweet and Sour Widow, pin de Lemon Haze, raisin de Dinamed, mangue de Magic Bullet et mandarine d’Otto II sont explicitement qualifiés selon leur niveau de preuve. Terre/pin de Valentine X et agrumes/pin de Carmagnola ne sont pas présentés comme des profils établis.
- **Critical Mass et Therapy** : les notes réunies par le jeu ne sont pas garanties ensemble sur une même sélection ou expression.
- **ACDC, Hawaiian Haze, Pennywise et Diesel CBD** : références directes ou descriptions de marque retrouvées pour remplacer ou compléter les sources faibles/inaccessibles.

Les produits CBD de **Skywalker OG (023), Skunk (033) et Afghan (034)** restent partiellement vérifiés : leur description ciblée n’était lisible que dans l’index du moteur. Les sources ouvertes sur leurs familles ou parents ne valident pas ces produits. Les fiches et le catalogue affichent cette incertitude. Les échecs d’accès ne sont pas assimilés à des preuves.

## Arômes du jeu et affichage

Les 52 paires utilisées par les commandes et bonus économiques restent inchangées et cohérentes avec les règles SQL. Leur **qualification** a été corrigée : chaque fiche affiche désormais une note propre à sa sélection, son témoignage ou son choix de jeu non confirmé. Les alternatives documentaires proposées dans les JSON d’audit ne sont pas appliquées comme nouvelles règles économiques.

Les références demeurent dans ce dossier et dans les données internes. Aucun lien de source n’est réintroduit dans les fiches Buddies.

## Relevé des 52 fiches

Le statut ci-dessous concerne la paire aromatique du jeu. La colonne suivante résume le contrôle éditorial global ; les preuves et limites détaillées se trouvent dans les JSON liés plus bas.

| Code | Buddie | Statut des arômes | Résultat du contrôle | Référence principale de la fiche |
| --- | --- | --- | --- | --- |
| HH2026-001 | L’Arbre Mère — Toutes Variétés | Fiction | fiction cohérente | Fiction du jeu |
| HH2026-002 | Charlotte’s Web | Provisoire — source secondaire | histoire corroborée par la marque ; arômes secondaires | [Charlotte’s Web — histoire de l’entreprise](https://investors.charlottesweb.com/our-company/default.aspx) |
| HH2026-003 | Cannatonic | Choix de jeu — partiellement confirmé | généalogie confirmée comme déclaration du créateur ; arômes à requalifier | [Resin Seeds — Cannatonic](https://resinseeds.net/cannatonic/) |
| HH2026-004 | Harlequin | Description commerciale attribuée | corriger le rôle historique ; description du producteur vérifiée | [Project CBD — hommage à Wade Laughter](https://projectcbd.org/newsletter/project-cbd-newsletter-remembering-wade-laughter-the-unsung-hero-of-cbd-plus-hemp-thc-legislation-state-cannabis-policy-updates-and-cbd-research-on-alzheimers-disease/) |
| HH2026-005 | ACDC | Description commerciale attribuée | histoire secondaire attribuée ; paire actuelle confirmée pour CBD Seed Labs | [High Times — portrait de William Courtney](https://hightimes.com/culture/people/higher-profile-dr-william-courtney/) |
| HH2026-006 | Sour Space Candy | Description commerciale attribuée | profil vérifié dans son périmètre commercial | [Oregon CBD sur Leafly — Sour Space Candy](https://www.leafly.com/brands/oregon-cbd/products/oregon-cbd-sour-space-candy) |
| HH2026-007 | Hawaiian Haze | Description commerciale attribuée | profil vérifié ; ancienne source remplacée | [East Fork Cultivars — Hawaiian Haze](https://eastforkcultivars.com/cultivars/p/hawaiian-haze) |
| HH2026-008 | Lifter | Description commerciale attribuée | arômes confirmés ; divergence de filiation à signaler | [Oregon CBD sur Leafly — Lifter](https://www.leafly.com/brands/oregon-cbd/products/oregon-cbd-lifter) |
| HH2026-009 | Elektra | Description commerciale attribuée | profil commercial confirmé ; création à attribuer | [Cannaflower — Elektra](https://cannaflower.com/product/elektra/) |
| HH2026-010 | Suver Haze | Description commerciale attribuée | récit du créateur retrouvé ; paire confirmée | [Oregon CBD sur Leafly — Suver Haze](https://www.leafly.com/brands/oregon-cbd/products/oregon-cbd-suver-haze) |
| HH2026-011 | Cherry Wine | Description commerciale attribuée | profil commercial corroboré ; créateur historique attribué | [Blue Forest Farms — Cherry Wine](https://blueforestfarms.us/shop/cherry-wine-hemp-seeds/) |
| HH2026-012 | Ringo’s Gift | Description commerciale attribuée | profil confirmé pour une sélection descendante | [Tweedle Farms — Ringo’s Gift](https://tweedlefarms.com/ringos-gift/) |
| HH2026-013 | Remedy | Description commerciale attribuée | corriger la chronologie Z7 ; profil du produit vérifié | [Cannaflower — Remedy](https://cannaflower.com/product/remedy/) |
| HH2026-014 | Sour Tsunami | Provisoire — source secondaire | histoire secondaire cohérente ; arômes à déclasser | [Leafly — Sour Tsunami](https://www.leafly.com/strains/sour-tsunami) |
| HH2026-015 | Harle-Tsu | Provisoire — source secondaire | à conserver comme synthèse secondaire | [Leafly — Harle-Tsu](https://www.leafly.com/strains/harle-tsu) |
| HH2026-016 | Stephen Hawking Kush | Provisoire — source secondaire | description historique attribuée, corroboration partielle du vendeur | [SeedFinder — description attribuée à Alphakronik Genes](https://seedfinder.eu/en/strain-info/stephen-hawking-kush/alphakronik-genes) |
| HH2026-017 | Pennywise | Description commerciale attribuée | paire renforcée par une fiche de marque | [Subcool’s The Dank sur Leafly — Pennywise](https://www.leafly.ca/brands/tga-subcool/products/tga-subcool-pennywise-harliquin-x-jack-the-ripper) |
| HH2026-018 | Sweet and Sour Widow | Choix de jeu — partiellement confirmé | profil créateur confirmé ; musqué est une interprétation non démontrée | [CBD Crew — Sweet and Sour Widow](https://cbdcrew.org/varieties/cbd-sweet-and-sour-widow/) |
| HH2026-019 | Special Sauce | Description commerciale attribuée | correction de provenance | [Sunset Lake CBD — Special Sauce et description d’Oregon CBD](https://sunsetlakecbd.com/product/special-sauce-hemp-flower/) |
| HH2026-020 | Strawberry CBD | Description commerciale attribuée | confirmé dans une portée commerciale | [Maionais — Strawberry CBD](https://maionais.com/cogollos-cbd/strawberry-cbd/) |
| HH2026-021 | Amnesia Haze CBD | Description commerciale attribuée | confirmé avec réserve sur le nom commercial | [Soma Seeds — Amnesia Haze historique](https://www.somaseeds.nl/product/amnesia-haze) |
| HH2026-022 | White Widow CBD | Description commerciale — incohérence interne | confirmé avec réserve sur le vendeur | [Green House Seed Company — White Widow historique](https://shop.greenhouseseeds.nl/award-winning-seeds/high-times-cannabis-cup/white-widow/) |
| HH2026-023 | Skywalker OG CBD | Choix de jeu — non confirmé | contrôle partiel ; source aromatique non ouverte | [Dutch Passion — Skywalker historique](https://dutch-passion.com/en/cannabis-seeds/skywalker) |
| HH2026-024 | Bubba Kush CBD | Description commerciale attribuée | description du sélectionneur confirmée | [Dinafem — création et caractéristiques de Bubba Kush CBD](https://www.dinafem.org/en/blog/bubba-kush-cbd-legendary-indica-suitable-all-users/) |
| HH2026-025 | OG Kush CBD | Dégustation — normalisation éditoriale | confirmé comme compte rendu particulier | [Dinafem — OG Kush CBD, génétique et observations](https://www.dinafem.org/en/blog/og-kush-cbd-grow-report-green-medicine/) |
| HH2026-026 | Gelato CBD | Description commerciale attribuée | description commerciale confirmée ; URL remplacée | [Sherbinskis — famille Gelato](https://sherbinskis.com/gelato) |
| HH2026-027 | Gorilla Glue CBD | Description commerciale attribuée | description commerciale confirmée ; histoire secondaire attribuée | [Leafly — Joesy Whales et la création d’Original Glue](https://www.leafly.com/news/strains-products/rest-in-peace-joesy-whales-co-creator-of-cannabis-strain-original-glue) |
| HH2026-028 | Blue Dream CBD | Description commerciale attribuée | description du sélectionneur confirmée | [Humboldt Seed Organization — Blue Dream CBD](https://www.humboldtseeds.net/en/blue-dream-cbd/) |
| HH2026-029 | Pineapple Express CBD | Description commerciale attribuée | provenance corrigée vers un produit vérifiable | [Barney’s Farm — Pineapple Express](https://www.barneysfarm.com/us/pineapple-express-weed-strain-609) |
| HH2026-030 | Lemon Haze CBD | Choix de jeu — partiellement confirmé | note pin insuffisamment étayée ; provenance à corriger | [Carrément Chanvre — Lemon Haze CBD](https://www.carrementchanvre.fr/products/lemon-haze-cbd) |
| HH2026-031 | Critical Mass CBD | Choix de jeu — sélections différentes | paire aromatique composite à signaler | [CBD Crew — CBD Critical Mass](https://cbdcrew.org/varieties/cbd-critical-mass/) |
| HH2026-032 | Super Lemon Haze CBD | Description commerciale attribuée | date et valeur probante du rapport corrigées | [Green House — Super Lemon Haze historique](https://shop.greenhouseseeds.nl/feminised-cannabis-seeds/1-seed-pack/super-lemon-haze/?variation_id=26) |
| HH2026-033 | Skunk CBD | Choix de jeu — non confirmé | contrôle partiel ; arômes provisoires | [Sensi Seeds — histoire et génétique de la famille Skunk](https://sensiseeds.com/fr/blog/quest-ce-que-lherbe-skunk-petit-guide-dintroduction-au-skunk/) |
| HH2026-034 | Afghan CBD | Choix de jeu — non confirmé | contrôle partiel ; sélection à mieux documenter | [JGL-USC — Afghan CBD, description à confirmer](https://jglusc.fr/produit/afghan-cbd/) |
| HH2026-035 | Cheese CBD | Description commerciale attribuée | description du sélectionneur confirmée | [Dinafem — Cheese CBD](https://www.dinafem.org/en/cheese-cbd/) |
| HH2026-036 | Mango Haze CBD | Description commerciale attribuée | description du sélectionneur confirmée | [CBD Crew — CBD Mango Haze](https://cbdcrew.org/varieties/cbd-mango-haze/) |
| HH2026-037 | Dinamed CBD | Choix de jeu — partiellement confirmé | Confirmé comme description du sélectionneur ; raisin anecdotique | [Dinafem — Dinamed CBD](https://www.dinafem.org/en/dinamed-cbd/) |
| HH2026-038 | Baox | Description commerciale attribuée | Confirmé avec attribution commerciale | [Fortuna Hemp — Baox](https://fortunahemp.com/baox-feminized-hemp-seeds/) |
| HH2026-039 | Berry Blossom | Description commerciale attribuée | À corriger — détails sensoriels et morphologiques non retrouvés | [Oakhenge Farms — Berry Blossom](https://oakhengefarmscbd.com/product/berry-blossom-flower/) |
| HH2026-040 | The Wife | Description commerciale attribuée | Confirmé avec réserve sur l’identité commune | [Springhill Farm — plantes et profils aromatiques](https://thespringhillfarm.com/pages/our-plants-and-processes) |
| HH2026-041 | Therapy CBD | Description du sélectionneur — expressions différentes | Confirmé avec réserve sur la variabilité | [CBD Crew — CBD Therapy](https://cbdcrew.org/varieties/cbd-therapy/) |
| HH2026-042 | Dancehall | Description commerciale attribuée | Confirmé comme description du créateur | [Reggae Seeds — Dancehall](https://www.reggaeseeds.com/fra/p/product/product/produits-seeds-cannabis/dancehall.htm) |
| HH2026-043 | Frank’s Gift | Provisoire — source secondaire | Partiellement confirmé — sources secondaires | [SeedFinder — description de Frank’s Gift S1 par Oregon Microgrowers Guild](https://seedfinder.eu/en/strain-info/franks-gift-s1/oregon-microgrowers-guild) |
| HH2026-044 | Valentine X | Choix de jeu — non confirmé | À nuancer — créateur et arômes non établis | [Leafly — Valentine X](https://www.leafly.ca/strains/valentine-x) |
| HH2026-045 | Carmagnola | Choix de jeu — non confirmé | Identité confirmée ; arômes non généralisables | [CREA — variété dioïque Carmagnola](https://www.crea.gov.it/-/variet%C3%A0-di-canapa-dioica-carmagnola-licenza-esclusiva-rif.-2020-11-) |
| HH2026-046 | Cherry Abacus | Description commerciale attribuée | Confirmé comme création déclarée par Diesel Hemp | [Diesel Hemp — création et sélection de Cherry Abacus](https://www.dieselhemp.com/product/cherry-abacus-cbd-flower-1-ounce-bag/) |
| HH2026-047 | Magic Bullet | Choix de jeu — partiellement confirmé | Confirmé comme description du vendeur ; mangue à qualifier | [Green Unicorn Farms — Magic Bullet](https://greenunicornfarms.com/cbd-hemp-flower/magic-bullet/) |
| HH2026-048 | Otto II | Choix de jeu — partiellement confirmé | Histoire attribuée ; mandarine non confirmée | [SeedFinder — histoire d’Otto II par Centennial Seeds](https://seedfinder.eu/en/strain-info/otto-nr2/centennial-seeds) |
| HH2026-049 | Swiss Dream CBD | Description commerciale attribuée | Confirmé comme description de Kannabia | [Kannabia — Swiss Dream CBD](https://www.kannabia.com/es/semillas-marihuana-feminizadas/swiss-dream-cbd?clang=es&filtrar_faq=it) |
| HH2026-050 | CB Dream | Description commerciale attribuée | Confirmé comme description de Crop King Seeds | [Crop King Seeds — CB Dream](https://www.cropkingseeds.com/high-yielding-strain/cb-dream-marijuana-seeds/) |
| HH2026-051 | CBD Kush | Dégustation individuelle | Parenté confirmée ; arômes issus d’une dégustation | [Dutch Passion — CBD Kush](https://dutch-passion.com/nl/wietzaden/cbd-kush) |
| HH2026-052 | Diesel CBD | Description commerciale attribuée | Source primaire retrouvée — attribution renforcée | [WeedSeedsExpress NL — Diesel CBD](https://weedseedsexpress.nl/product/diesel-cbd-zaden) |

## Dossier de preuves

- [Fiches 001–018](buddie-audit-2026-10-28-001-018.json)
- [Fiches 019–036](buddie-audit-2026-10-28-019-036.json)
- [Fiches 037–052](buddie-audit-2026-10-28-037-052.json)
- [Méthode, champs modifiés et synthèse](buddie-audit-2026-10-28.json)

Chaque entrée conserve les URL, le type de source, son accessibilité, une preuve paraphrasée, les limites, le profil corrigé et la conclusion aromatique. Les sources de profils correspondent aux pages ouvertes, sauf les trois descriptions partielles explicitement qualifiées ci-dessus. Les PDF lus en texte dont la capture a échoué sont signalés dans les preuves.

## Vérifications locales

- 20 tests réussis dans les quatre suites : fiches, arômes, carrousel et demandes clients.
- 52 profils applicatifs identiques aux profils corrigés de l’audit.
- 52 paires de jeu et 38 illustrations conservées ; provenance CSV régénérée dans le module TypeScript.
- Diff vérifié sans erreur d’espacement. Aucune migration ni écriture en base distante.

Commande exécutée :

```powershell
node node_modules/vitest/vitest.mjs run src/lib/kanab-quest-buddie-varieties.test.ts src/lib/kanab-quest-buddie-flavors.test.ts src/components/placard/KqBuddieCarousel.test.ts src/lib/kanab-quest-customer-demand.test.ts
```
