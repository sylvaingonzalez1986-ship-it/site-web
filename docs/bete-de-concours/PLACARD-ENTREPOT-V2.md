# Entrepôt — composition et illustrations V2

> Ce document décrit l’entrepôt au m² et l’état du code local. L’application des migrations et la publication du site sont distinguées ci-dessous. La section « Archive du décor V2 » conserve l’ancienne présentation utilisée par l’essai guidé.

## Entrepôt au m² — octobre 2026

### Départ à 100 m² et agrandissements — évolution du 13 octobre 2026

Le nouveau départ utilise un **entrepôt de 100 m², soit 10 × 10 cases**, réparti en zones de culture, de séchage et de stockage. Ces zones partagent la même surface disponible : 100 m² de bâtiment ne signifient pas 100 m² de culture en plus des services. Une case représente toujours 1 m² ; le joueur aménage les zones, choisit leurs équipements et affecte ses Buddies comme auparavant. Le compteur distingue la surface occupée de la surface totale.

**Implémentation locale terminée et testée.** La migration `20261013000300_kq_warehouse_starter_floor.sql` a été appliquée le 13 octobre 2026 à la base bêta liée `eyowwwpdmfrulhkpvlnf`, via un lot isolé ne contenant qu'elle en attente. Les 9 prérequis et 12 vérifications distantes de fonctions, historique et permissions passent ; la prévisualisation suivante confirme le lot à jour. Aucun compte n'a été réinitialisé, aucune partie distante lancée et le site n'a pas été publié. Les preuves sont dans `output/warehouse-100m2-migration/`.

Le plan carré et ses gestes passent également 12 contrôles ciblés. Au total : 109 tests unitaires domaine/backend/persistence/campagne, 760 contrôles PostgreSQL locaux, permissions sur les 308 migrations, lint ciblé et compilation Next.js/TypeScript de 139 pages réussis. Le nouveau code crée exclusivement des plans de 100 m² ; la migration accepte temporairement les créations de l'ancien serveur pendant une mise à jour mixte, puis le nouveau serveur les compacte. Un plan déjà passé à 100 m² ne peut pas récupérer gratuitement 1 000 m² en retirant son marqueur de surface.

La recette ciblée `scripts/audit-placard-warehouse-100m2.mjs` passe **18 contrôles navigateur** à 320, 390 et 1 440 px : chargement du décor compact, compteur de 100 m², limites des champs et du clavier jusqu'à la dernière case, vrais dépôts de Buddies à la souris et au toucher, sauvegarde gratuite puis rechargement, refus des zones actives, annulation, transfert au clavier et reprise du run principal de la campagne. Elle vérifie aussi un plan compact entièrement occupé et le maintien du plan historique de 1 000 m². Aucune erreur JavaScript ni requête externe ; rapport et captures dans `output/warehouse-100m2/`. Cette recette utilise les composants réels avec des réponses API locales simulées : elle ne valide pas une migration distante.

Le contrat conserve le format de plan V1 et ajoute `floor: { columns: 10, rows: 10 }`. Son absence identifie un plan historique de 40 × 25 cases. `getKqWarehouseDimensions` fournit les dimensions correspondant au plan ; un nouveau départ place ses zones de service sur la rangée d'indice 9. Les états figés des parties restent inchangés.

Un petit plan historique peut être compacté gratuitement, seulement sans partie active et avec au plus 100 m² de préparation déjà financée. Les rectangles qui tiennent dans le carré restent en place ; seuls ceux situés hors limites sont replacés, sans rotation ni changement de dimensions. Si tous les rectangles ne tiennent pas, le plan de 1 000 m² est conservé entièrement. Identifiants, surfaces, Buddies, équipements, réserves, préparation financée et trésorerie sont conservés. Cette conversion ne constitue ni un achat ni une extension.

**Prochaine étape, à réaliser :** permettre l'achat d'un autre entrepôt ou d'un terrain adjacent destiné à une serre. Les biens disponibles, leurs prix, les conditions d'achat et leur raccord aux cultures restent à définir. L'interface actuelle ne propose ni prix fictif, ni bouton d'achat inactif pour ces projets. Une éventuelle mention « Agrandissements » reste purement informative.

L'ancien parcours d'ajout de tentes possédait un achat de second bâtiment. Il ne constitue pas un système immobilier pour le plan actuel et ne doit pas être réactivé pour annoncer cette prochaine étape. La boutique de cartes et les achats de matériel conservent leurs rôles actuels.

### Campagne commune, récoltes par Buddie — 13 octobre 2026

**État au 13 octobre 2026 : la campagne commune est implémentée et testée. La migration `20261013000200_kq_shared_campaigns.sql` est appliquée à la base distante ; le code du site reste à déployer.** La base est prête pour le nouveau client et le nouveau serveur.

Le plan s’ouvre sur **Aménager**, avant **Cultures**. Dans Cultures, le bouton **Choisir mes Buddies** ouvre le carrousel, fermé par défaut. La croix le réduit et rend le focus au bouton ; revenir au plan depuis Stockage ou Atelier revient sur Aménager. Le joueur maintient le clic gauche sur une carte et la dépose dans une zone libre ; le même geste fonctionne au doigt. La carte suit le pointeur et la zone cible est surlignée, en tenant compte du zoom et du déplacement du plan. La bande « Défiler » et les flèches parcourent les cartes. Au clavier ou par simple toucher, choisir une carte puis une zone offre le même placement. Cette interaction et les retours de navigation passent les 21 contrôles du script `audit-placard-warehouse-100m2.mjs` à 320, 390 et 1 440 px (14 octobre 2026).

Le dépôt modifie l’affectation dans le plan à enregistrer, sans lancer une culture ni acheter du matériel. Si la carte était affectée à une autre zone libre, elle est déplacée vers la cible. Les zones occupées, le séchage, le stockage et le sol refusent le dépôt. Les Buddies déjà en culture ou en rotation restent visibles et indisponibles. Échap, une interruption tactile ou la sortie de la fenêtre annulent le geste. Le sélecteur par liste a été retiré.

Le bouton **Lancer mes cultures** prépare toutes les zones actives auxquelles un Buddie est affecté dans le plan enregistré. Il ouvre une seule campagne : six étapes, une situation, un lancer de dés, une main, une réserve d’XP et un suivi de santé communs. Les cartes jouées, les jetons et les soins engagés sont consommés une seule fois par utilisation pour toute la campagne. L’Héritage est commun et reste permanent. Le meilleur bonus initial d’XP des Buddies est appliqué une seule fois à la réserve commune ; les bonus des membres ne s’additionnent pas.

Les **52 Buddies possèdent un profil fictif versionné**, enregistré au lancement : spécialisation Quantité, Équilibre ou Expression, facteur de rendement, potentiels cannabinoïdes, potentiel de terpènes et deux notes aromatiques. La rareté module ces valeurs sans créer un autre parcours de dés. Les profils v1 restent figés dans les sauvegardes et les Fleurs ; un nouvel équilibrage exigera une autre version. Ces nombres décrivent le jeu, pas des rendements agricoles ou des analyses réelles des variétés commerciales du même nom. Les teneurs simulées en % restent distinctes des indices de progression sur 99.

Le mode **Cultures** affiche le portrait du Buddie et une fiche courte : rendement estimé par m², potentiel cannabinoïde et potentiel de terpènes. Sélectionner une carte du carrousel prévisualise son profil dans l’inspecteur avant le dépôt. La préparation réunit les participants et le devis total ; les cartes et l’Héritage restent optionnels. Pendant la partie, un clic sur n’importe quelle zone de la campagne reprend le même plateau. Les résultats montrent la quantité et les teneurs simulées de chaque Buddie, avec les analyses détaillées repliées. **Aménager** conserve les tracés, dimensions et équipements ; les zones engagées sont figées et les changements des services communs restent soumis aux réservations existantes.

La campagne possède un run principal pour les décisions, et un run membre par zone pour les récoltes, les stocks et les écritures comptables. `state.campaign` archive son identifiant, le run principal et ses membres ; chaque membre garde son Buddie, son profil et son snapshot d’entrepôt V2. Les participants et les équipements sont figés ensemble au lancement. La production de chaque zone utilise le même historique de décisions, puis ses propres équipements et son profil : une campagne réussie crée une **récolte et une Fleur distinctes par zone**, avec leurs liens individuels vers la réserve et le jury.

Le devis affiché additionne les charges des zones participantes. Les consommables et l’électricité conservent leurs **factures distinctes par run membre** ; les consommables restent dus à 120 heures réelles et l’électricité est facturée à la fin. Le deck commun n’est réservé qu’une fois, tandis que séchage et stockage couvrent l’ensemble des futurs lots. Les Buddies possédés, leur rotation et leur disponibilité sont vérifiés côté serveur ; un même Buddie ne peut occuper deux places dans la campagne. Aucun profil ne remplace ces contrôles de capacité ou de propriété.

L’entrée commune utilise `?view=game&campaign=1`, puis le run principal dans `run`. Une ancienne adresse ciblant une zone ou un run membre de la campagne retrouve ce run principal. Le lancement envoie `campaign: true` et une clé de nouvelle tentative persistée pour toute la campagne : une réponse perdue ne doit créer ni seconde campagne, ni seconde réservation, ni seconde facture. Les commandes d’action, de carte et de soin visent toujours le run principal. Les réponses tardives d’une autre sélection ne remplacent pas la partie affichée. Les cultures avancent lors des actions du joueur, sans croissance automatique en arrière-plan.

Les anciennes parties globales V1 et les anciennes cultures indépendantes par zone V2 restent reprenables et terminables selon leurs règles, sans conversion forcée, perte de cartes ni recalcul des résultats ou factures archivés. **Toute partie ancienne active doit être terminée avant de démarrer une campagne commune.** Les anciennes cultures indépendantes sont désormais un cas de compatibilité, pas le parcours des nouveaux lancements.

Validation confirmée pour cette évolution : **168 tests de domaine**, **171 tests ciblés serveur, routes, API, sélection client et projection de campagne**, lint ciblé, compilation de production avec TypeScript et **139 pages** générées. Le runner `scripts/test-placard-shared-campaigns.mjs` passe **713 contrôles PostgreSQL**, et les droits de **307 migrations** sont vérifiés. Les suites se recoupent : leurs totaux ne sont pas additionnés.

Les **14 groupes navigateur** de `scripts/audit-placard-shared-campaigns.mjs` vérifient la préparation et les résultats à 320, 390 et 1 440 px, le devis cumulé, la réponse de lancement perdue puis rejouée, un clic de lancer commun, les six étapes avec 18 actions, deux récoltes aux valeurs distinctes et leur réouverture, sans erreur JavaScript. Rapports et captures : `output/placard-shared-campaigns/`. Les réponses API de cette recette sont des fixtures locales : elle ne prouve pas une transaction sur la base distante.

La lecture des cultures charge les métadonnées des membres, puis uniquement l’état complet du run principal. Le test à **52 zones** vérifie 52 métadonnées, un seul état complet et une réponse plus de 20 fois plus petite que la duplication de tous les états. Les liens vers un membre ou une zone retrouvent toujours le parcours commun ; le filtre propriétaire est réappliqué lors de la seconde lecture.

La migration 002 a été appliquée seule au projet lié `eyowwwpdmfrulhkpvlnf`, depuis `output/shared-campaign-migration/deploy`, après **50 contrôles préalables** réussis. Les **125 contrôles distants** des fonctions, permissions, colonnes, index, triggers et historiques passent ; la prévisualisation suivante confirme que le lot est à jour. Les projections de l’API pour le routage des campagnes et les profils des Fleurs répondent HTTP 200 avec une limite de zéro ligne, sans lecture de données joueur ni exécution de partie. Le hook de demande client 020 est conservé et la migration indépendante `20261010000500_botte_situations_epic.sql` reste exclue. Preuves : `output/shared-campaign-migration/manifest.json`, `application-result.json`, `verification-result.json`, `data-api-result.json` et `completion.json`.

#### Historique de la base et validations antérieures

La migration `20261013000100_kq_zone_cultures.sql` a été appliquée le 13 octobre 2026 au projet Supabase lié `eyowwwpdmfrulhkpvlnf`, après les migrations d’équipements 008–010. La migration 002 a ensuite été appliquée séparément, comme décrit plus haut.

L’application a utilisé le lot isolé `output/warehouse-zone-migration/deploy`, après contrôle des prérequis distants et prévisualisation des quatre migrations exactes. L’historique distant confirme les quatre versions ; une nouvelle prévisualisation indique que le lot est à jour. La vérification en lecture seule valide les permissions, les fonctions, les index par zone et Buddie, les réservations de cartes et les déclencheurs. Les fonctions de demande client de la migration 020 sont conservées ; la migration indépendante `20261010000500_botte_situations_epic.sql` reste exclue. Aucun compte joueur ni RPC de partie n’a été utilisé pour ces vérifications. Traces : `output/warehouse-zone-migration/manifest.json`, `preflight-result.json`, `dry-run-result.json`, `application-result.json`, `post-application-dry-run.json` et `verification-result.json`.

Les recettes antérieures restent utiles pour la compatibilité : `scripts/test-placard-zone-cultures.mjs` exécute les RPC et migrations dans PostgreSQL isolé ; `scripts/audit-placard-zone-runs.mjs` contrôle les reprises individuelles avec des réponses API simulées. Le carrousel a passé 21 groupes `--buddie-drag-only` et 3 groupes `--cultures-only` avant l’introduction de la campagne commune, avec vrais gestes souris/tactiles, annulations et placement clavier. Ces résultats antérieurs ne remplacent pas la recette de campagne ci-dessus. Aucun de ces scripts n’utilise un compte distant.

Validation historique de la migration 001 et des cultures indépendantes : compilation de production, TypeScript et lint réussis, 571 contrôles SQL et droits de 306 migrations validés ; 38 groupes navigateur historiques, 3 groupes de gestion des zones et 8 groupes de reprise/préparation. Ces nombres ne décrivent pas la migration 002. PGlite sérialise les transactions de ses sessions : ses essais de lancements parallèles vérifient les résultats et l’idempotence, sans reproduire l’attente des verrous entre plusieurs connexions PostgreSQL de production.

### Interface allégée — 13 octobre 2026

L’en-tête et la boutique utilisent des libellés courts : « Entrepôt », « Plan », « Stockage », « Atelier » et « Boutique ». Le bandeau promotionnel et les slogans répétés ont été retirés. L’inspecteur est élargi, les textes agrandis et les commandes espacées, avec une disposition adaptée au mobile.

Les dimensions et la position restent accessibles dans « Ajuster la zone ». Le coût neuf par m², la capacité ou la récolte estimée, les charges par m² et le montant à payer restent visibles ; la composition et les calculs détaillés sont repliés dans le devis. L’aide du plan, les prévisions et la réserve se déplient à la demande. La boutique conserve ses trois gammes, leurs prix et leurs contreparties ; les explications générales sont regroupées dans « Détails du devis ». La gestion par zones, les achats et les calculs sont inchangés.

Validation : compilation de production et TypeScript réussis, lint ciblé réussi, 38 groupes navigateur sans erreur. La vérification complémentaire `--chrome-only` couvre la fenêtre à 320/390 px, ses commandes et sa fermeture, puis la boutique à 320/390/1440 px ; rapport séparé `output/warehouse-v4/chrome-report.json`. Les captures ont été relues sur PC et mobile.

### Comptoir et équipements par surface — 12 octobre 2026

La boutique s’ouvre dans l’entrepôt, depuis son en-tête ou le comptoir du plan. Chaque catégorie propose exactement trois équipements achetables : **Économique, Standard et Haut de gamme**. Les douze catégories réunissent 36 choix : éclairage, extraction, irrigation, climat, pilotage, hygiène, manutention, sécurité, support, nutrition, séchage et stockage. Les noms sont génériques et les prix sont ceux du jeu. Le carnet de marques et le comparateur documentaire ont été retirés de l’interface.

Chaque carte affiche le prix du matériel par m², le total nécessaire pour la zone, ses charges ou sa capacité, un avantage et une contrepartie. Les quantités d’appareils sont arrondies à l’unité supérieure : pour 30 m², l’éclairage coûte ainsi 4 470 €, 4 935 € ou 5 992 € selon la gamme, hors pose et préparation. Le devis final tient compte de la réserve déjà possédée.

Choisir une variante modifie uniquement le devis de la zone sélectionnée. L’achat reste confirmé par « Acheter et installer ». Les modules couvrent la surface de la zone ; leur quantité financée est conservée dans `optionInventory`, y compris après retrait. Un changement de variante libère la précédente en réserve. La prochaine pose réutilise cette couverture avant de facturer des m² supplémentaires. Les modules s’affichent aussi sous forme de petits objets sur le plan ; leur illustration ne représente pas un dimensionnement technique.

Les fournitures de nutrition sont comptées en **unités de jeu / m² / cycle actif**, sans équivalence en dose agricole réelle. Leurs coûts s’ajoutent au forfait de consommables existant, puis suivent la facture fournisseur à 120 heures réelles. Une zone inactive n’ajoute ni fournitures récurrentes ni récolte. Les bonus sont plafonnés et figés dans le snapshot de la culture ; les anciens plans sans module conservent leur comportement.

Les six machines de l’atelier disposent également de trois gammes achetables directement, correspondant aux niveaux 1, 4 et 7. Le prix comprend l’acquisition et les améliorations nécessaires ; une machine déjà possédée ne facture que les améliorations manquantes. Exemple : le tamis coûte 550 €, 880 € ou 1 705 € à l’acquisition. Les niveaux intermédiaires restent disponibles dans « Réglages fins » et les machines déjà développées conservent leurs caractéristiques.

L’achat d’une gamme d’atelier passe par une opération serveur atomique : acquisition, améliorations et débit réussissent ensemble. Une nouvelle tentative après une réponse perdue renvoie le même reçu sans débiter à nouveau. Les prérequis de carrière, la trésorerie et l’entretien sont contrôlés côté serveur. L’usure et l’installation existantes sont conservées ; un nouvel achat ne s’installe pas automatiquement.

Les migrations doivent précéder le déploiement du client et du serveur correspondants : `20261012000800_kq_warehouse_simulation_options.sql` ajoute les modules et leur réserve ; `20261012000900_kq_warehouse_equipment_tiers.sql` ajoute les gammes d’appareils et leurs validations de prix, puissance et capacité ; `20261012001000_kq_workshop_tiers.sql` ajoute l’achat atomique des gammes d’atelier. **Ces trois migrations ont été appliquées à la base distante le 13 octobre 2026**, dans le même lot que les cultures par zone décrit plus haut. Les migrations 001–007 restent inchangées. Les anciens plans et les cultures déjà lancées conservent leurs données ; l’ancien éclairage retiré du catalogue reste réutilisable depuis la réserve.

Validation SQL de la simplification : **499 contrôles PostgreSQL isolés** exécutent les migrations réelles, dont les achats des nouvelles références internes, les dix-huit acquisitions de gammes d’atelier, les reprises après réponse perdue, les montants falsifiés, les droits d’accès et l’annulation complète après un échec au milieu des améliorations. Aucun compte joueur distant n’est utilisé.

Les suites ciblées entrepôt, atelier, stockage et API passent, ainsi que le contrôle des droits de 305 migrations et la compilation de production avec TypeScript. L’audit navigateur complet passe **38 groupes sans erreur**, dont les douze familles à trois choix, les prix adaptés à la zone, le remplacement et le réemploi, les achats après réponse perdue, la sauvegarde/relecture, les verrous de culture et de trésorerie, les gestes sur le plan et le plein écran. Les boutiques et les gammes d’atelier sont vérifiées à 320, 390 et 1440 px. Rapports : `output/warehouse-v4/report.json` et `workshop-report.json` ; audit reproductible avec `node scripts/audit-placard-warehouse-v4.mjs` (options `--shop-only`, `--workshop-only` et `--preview`).

L’[ancien inventaire des concurrents](PLACARD-BOUTIQUE-CONCURRENTS.md) et les [anciennes sources commerciales](PLACARD-BOUTIQUE-SOURCES.md) sont des archives de recherche, sans accès depuis le jeu ni rôle dans les nouveaux achats.

L’installation suit le parcours culture → séchage et stockage → transformation. La récolte est séchée et mise en stock avant d’alimenter les machines ; la vente en fleurs reste possible sans transformation. Depuis le 12 octobre, culture, séchage et stockage partagent le plan de 40 × 25 cases de 1 m², sans chevauchement. Le joueur débute avec 1 m² de culture, 1 m² de filets et 1 m² de bocaux, soit 997 m² libres. Il dessine des rectangles, choisit les appareils et confirme un devis avant toute dépense. Les cultures peuvent être désactivées ; retirer une zone conserve son matériel en réserve, réutilisé lors du prochain aménagement.

### Zones de séchage et de stockage

Chaque tracé affiche la surface, le matériel nécessaire, sa capacité totale et par m², le prix complet de la zone et le montant réellement à payer après réemploi. Les dépenses restent soumises à la validation du devis. La préparation vaut 120 €/m² et la pose 15 % des nouveaux appareils, hypothèses explicites du jeu ; une surface déjà financée et du matériel en réserve ne sont pas refacturés.

| Équipement | Gamme | Capacité de jeu par m² | Matériel neuf par m², hors pose |
| --- | --- | --- | --- |
| Séchage | Économique | 1 kg | 39,90 € |
| Séchage | Standard | 2,5 kg | 99,90 € |
| Séchage | Haut de gamme | 6 kg | 199,90 € |
| Stockage | Économique | 1,2 kg | 83,60 € |
| Stockage | Standard | 2,4 kg | 257,20 € |
| Stockage | Haut de gamme | 12 kg | 342 € |

Les prix et capacités sont des conventions de jeu. Les identifiants techniques historiques restent conservés pour préserver les sauvegardes, mais les noms et fiches affichés n’utilisent plus de marque commerciale.

La charge mécanique du filet n’est pas une masse de récolte sèche : le jeu retient 1 kg en équivalent sec par filet. Pour les contenants, 50 g/L est une convention de simulation, pas une densité fabricant ni une promesse de conservation. Les durées de jeu restent accélérées et indépendantes des délais réels.

`serviceZones` décrit les rectangles de séchage et stockage. Son absence identifie un ancien plan : ses capacités et les snapshots de cultures historiques restent inchangés. Dès l’adoption de zones de service, seuls les appareils placés apportent de la capacité ; les appareils en réserve restent possédés. Un plan ayant adopté ce système ne peut plus supprimer le champ pour retrouver des capacités hors plan. Les stocks existants restent conservés, et les retraits ne peuvent aggraver un déficit de place ou de séchage.

Un contenant appartient à un lot : son volume restant ne peut pas accueillir une autre récolte. La place libre affichée déduit donc la capacité entière des contenants occupés, ainsi que les colis invendus. Avant de lancer une culture, le serveur réserve également les besoins des récoltes en attente, avec une borne conservatrice indépendante de l’ordre de leurs verdicts. Lors d’un changement de format, les lots sont réaffectés ensemble ; passer d’un grand fût à plusieurs petits bocaux reste possible si les produits tiennent dans la nouvelle installation. Un simple déplacement sur le plan ne modifie pas leur rangement.

Le déploiement de la base peut précéder celui du client : les appels de l’ancien serveur restent compatibles tant que le plan n’a pas adopté `serviceZones`. Le nouveau serveur impose le tracé pour les achats de séchage et de stockage. Après adoption, la base interdit aussi les achats de contenants hors plan et le retour au format historique.

### Présentation illustrée du bâtiment

`KqWarehousePlan.tsx` remplace le cadre vert par une illustration verticale de l’entrepôt : dalle de béton, murs, réseaux périphériques et porte de livraison. Les zones et leur équipement sont ajoutés dynamiquement. Les cultures ne sont dessinées que pendant une partie active ; sinon, les bacs apparaissent prêts à être utilisés. Les luminaires et extracteurs suivent les quantités entières du catalogue, sans modifier les coûts ni les sauvegardes.

La géométrie dépend du plan : le nouveau carré de 10 × 10 cases utilise un canevas SVG de 400 × 400 et une origine `(50, 50)` ; le plan historique de 40 × 25 cases conserve son canevas de 1 536 × 1 024 et son origine `(168, 120)`. Une case représente 1 m² et 30 unités SVG dans les deux cas. Le décor compact est `public/placard/warehouse-v4/overhead-room-100m2-sylvain-v1.webp`. Les coordonnées de souris et de toucher passent par la matrice réelle du SVG pour rester exactes au zoom et après défilement. La grille peut être affichée. Depuis la refonte visuelle du 12 octobre, le zoom va de 100 à 1 000 %, et la caméra cadre automatiquement la zone sélectionnée. Les commandes clavier et l’inspection d’une zone pendant une culture restent disponibles.

Les images ont été créées avec l’outil imagegen intégré, puis converties en WebP en conservant la transparence des objets : `public/placard/warehouse-v4/overhead-room.webp`, `overhead-sprites.webp`, `overhead-devices.webp` et `overhead-storage.webp`. Les illustrations distinguent le panneau compact TS1000 du luminaire à barres, le filet circulaire, les bocaux, le fût et le rayonnage. Sources PNG dans `output/warehouse-v4/source/`, prompts exacts et disposition des planches dans `public/placard/warehouse-v4/prompts.json`. Ces dessins représentent l’installation du jeu et ne constituent pas des illustrations officielles des fabricants.

### Atelier vivant — présentation du 12 octobre 2026

Le décor actif est désormais `public/placard/warehouse-v4/overhead-room-warm-v1.webp` (1 536 × 1 024, environ 397 Kio). Il reprend exactement la géométrie du sol, avec pierre patinée, poutres vertes, lampes ambrées, outils et végétation en périphérie, dans l’esprit du quartier breton. La retouche a été réalisée avec **imagegen intégré**, puis compressée en WebP avec Sharp. Le prompt exact et les deux références sont conservés dans `public/placard/warehouse-v4/ambience-v1.json`. Les fichiers précédents restent disponibles.

L’interface privilégie la scène : enseigne d’atelier, indicateurs regroupés et fiche d’équipement sur papier. Le carnet sous la scène décrit l’état réel de l’installation ou le devis en préparation. Les halos des luminaires et les mouvements d’air apparaissent seulement pour les zones actives pendant une culture ; ils s’arrêtent avec la préférence système de réduction des animations. Aucune progression intermédiaire ou activité de machine n’est inventée.

La molette zoome autour du pointeur ; glisser le sol à la souris déplace la caméra. Les boutons de zone recadrent la vue. Les outils Déplacer et Agrandir manipulent la zone sélectionnée, avec aperçu, limites entières et refus des chevauchements. Échap annule un geste. Sur écran tactile, le défilement reste naturel en mode Observer ; les gestes de modification exigent le choix explicite de leur outil. Les champs numériques et le clavier restent utilisables.

Les déplacements et agrandissements ne changent que le brouillon : la validation métier, le devis, la confirmation d’achat, les clés de nouvelle tentative et le verrouillage pendant une culture sont conservés. Le plein écran inclut l’entrepôt et son inspecteur pour garder le devis accessible ; un navigateur qui le refuse affiche une explication. Cette refonte ne modifie ni l’économie ni les migrations et ne constitue pas un déploiement du site.

La recette navigateur `scripts/audit-placard-warehouse-v4.mjs` utilise les composants et polices du projet avec des réponses API simulées, sans compte joueur ni transaction distante. Ses 32 groupes passent sans erreur JavaScript. Elle couvre notamment le centrage initial, le zoom ancré, le déplacement du décor, les gestes sur les zones, l’annulation, le toucher, le plein écran avec devis et les animations réduites, ainsi que les parcours d’aménagement et d’atelier existants. Les largeurs 320, 390, 768, 820, 900 et 1 440 px sont contrôlées. Le centrage initial reste à moins d’un pixel de la cible mesurée sur PC et mobile. Rapports et captures : `output/warehouse-v4/`. Les tests métier ciblés de l’entrepôt et de la conservation de l’atelier passent (79 tests dans trois fichiers), ainsi que TypeScript, ESLint ciblé et la compilation de production.

L’audit du 11 octobre a passé 16 groupes de contrôles, dont le placement à 100–400 % de zoom, le toucher jusqu’à la case 1 000, le clavier et les parcours d’achat et de transformation existants. La vérification visuelle (`--visual-only`) contrôle les trois pièces à 320, 390, 768 et 1440 px, ainsi que les états de départ, de culture active et de pleine surface. Rapports : `output/warehouse-v4/report.json` et `visual-report.json`. Les planches d’objets sont réutilisées même lorsque les 1 000 m² sont équipés.

Le catalogue `src/lib/kanab-quest-warehouse-catalog.ts` référence les appareils physiques, leurs sources, prix et puissances. Les prix et puissances non vérifiés sont explicitement signalés comme estimations. L’aménagement à 120 €/m², la pose à 15 %, les heures équivalentes, rendements et capacités de traitement constituent des hypothèses de simulation, pas des spécifications fabricant. Les charges d’atelier restent des forfaits de jeu par gramme ; elles ne constituent pas une mesure électrique des presses ou cuves.

Les consommables des nouvelles cultures sont livrés au démarrage et facturés à 30 jours de jeu, soit 120 heures ou 5 jours réels. Leur coût reste inclus dans le budget de la campagne, mais aucune avance de trésorerie n’est exigée. La facture reste due si la culture est abandonnée. Les anciennes campagnes déjà payées ne sont pas refacturées. L’installation et le devis électrique sont figés pendant la culture, puis l’énergie est facturée une seule fois à sa fin. Le démarrage vérifie la capacité de séchage et de stockage, y compris les sachets en ligne invendus. Les débouchés sont limités par la demande réelle du compte et un quota grossiste partagé. L’interface compare la récolte aux débouchés sur 24 heures réelles après disponibilité des lots.

Les factures de consommables figurent dans Trésorerie → Factures avec leur échéance et leur solde, et peuvent être réglées par anticipation. À l’échéance, un prélèvement unique utilise les fonds disponibles sans rendre la trésorerie négative. Le reliquat est ensuite remboursé progressivement sur les ventes et ne bloque pas les nouvelles cultures. Les retenues partagent un plafond de 50 % de la recette après TVA, et après frais pour les ventes en ligne, dans l’ordre laboratoire, énergie, puis fournisseurs échus. La charge et la dette sont enregistrées à l’émission ; les règlements diminuent la dette sans comptabiliser une seconde charge.

La pièce Transformation est reliée à l’atelier partagé existant : tamisage, lavage, filtration, séparation statique, presse et séchage spécialisé. Elle réutilise son inventaire, ses achats, niveaux, entretiens, recettes et conditions de progression. Le séchage spécialisé d’une recette ne remplace pas l’étape préalable de séchage et stockage des fleurs. Les machines travaillent par fournées selon leur niveau ; les recettes utilisant une même machine partagent sa file d’attente. Le produit ne peut être vendu avant la fin de sa transformation. Les durées et rendements restent des paramètres de jeu. Les achats de presse et laveuse ne passent plus par le catalogue d’aménagement au m².

Une ancienne culture active finit selon ses règles d’origine. La conversion suivante archive le matériel et reprend les investissements de culture payés sous forme de crédit d’aménagement non retirable ; les machines et améliorations de l’atelier restent utilisables et ne sont pas créditées. Pour les comptes déjà convertis, la correction retire uniquement le crédit d’atelier encore disponible, sans débit de trésorerie ni dette. Les éventuelles presses et laveuses du nouveau catalogue sont rattachées à l’inventaire existant ; les exemplaires supplémentaires sont repris en crédit d’aménagement dans la limite des investissements enregistrés. L’archive originale est conservée et l’ajustement tracé séparément.

Les contenants et récoltes existants sont conservés. Après conversion, les récoltes n’ont plus de liquidation automatique du surplus après une heure, y compris les lots historiques. Le surplus peut être vendu progressivement dans la limite du quota grossiste disponible.

### Mise en service et validation

L’atelier utilise uniquement un lot dont l’échéance de disponibilité existante est passée et qui est entièrement rangé dans les contenants. Le devis et la transaction PostgreSQL appliquent cette règle avant tout débit. La durée de transformation commence ensuite, sans ajouter un second délai de séchage.

Les migrations `20261012000100_kq_warehouse_layouts.sql`, `20261012000200_kq_warehouse_run_integration.sql` et `20261012000300_kq_warehouse_storage.sql` ont été appliquées dans cet ordre le 11 octobre 2026, à la demande de l’utilisateur, au projet Supabase lié `eyowwwpdmfrulhkpvlnf`. Un lot isolé dans `output/warehouse-migration/deploy` a permis de prévisualiser puis d’appliquer uniquement ces trois migrations avec `supabase db push --linked --yes --workdir output/warehouse-migration/deploy`. La migration indépendante `20261010000500_botte_situations_epic.sql` reste en attente.

L’historique distant confirme les trois versions et le dry-run du lot isolé indique qu’il est à jour. La vérification distante en lecture seule confirme les six RPC attendues et le refus d’accès direct aux trois tables privées pour `service_role` (HTTP 403, code 42501). Aucun compte joueur ni RPC de jeu n’a été utilisé pour ces contrôles. Les empreintes des fichiers, le résultat d’application et la vérification sont conservés dans `output/warehouse-migration/manifest.json`, `application.json` et `verification.json`. Cette opération met à jour la base ; le nouveau client reste à déployer.

Le raccord à l’atelier existant est livré par `20261012000400_kq_warehouse_legacy_workshop.sql`, appliquée au même projet le 11 octobre 2026 après une prévisualisation limitée à cette seule migration. Les migrations 001–003 n’ont pas été modifiées. L’historique distant confirme 004 et une nouvelle prévisualisation indique que le lot isolé est à jour. Les trois tables privées et les deux fonctions internes de lecture refusent l’accès à `service_role` (403 / 42501), même si OpenAPI liste ces fonctions. Ce contrôle emploie un identifiant nul et ne lit aucune donnée joueur. Traces : `output/warehouse-migration/workshop-manifest.json`, `workshop-application.json` et `workshop-verification.json`.

Les zones de service sont livrées par `20261012000500_kq_warehouse_service_zones.sql`, appliquée au même projet le 12 octobre 2026 après une prévisualisation limitée à cette seule migration. Les migrations 001–004 restent inchangées. L’historique distant confirme 005 et le lot isolé est à jour ; la migration indépendante `20261010000500_botte_situations_epic.sql` reste exclue. Les six RPC attendues sont présentes, et les trois tables privées ainsi que les cinq fonctions internes vérifiées refusent l’accès direct à `service_role` (403 / 42501). Aucun compte joueur n’a été utilisé pour cette vérification. Traces : `output/warehouse-migration/service-zones-manifest.json`, `service-zones-application.json`, `service-zones-history.json` et `service-zones-verification.json`. Le client reste à déployer ; la base conserve la compatibilité avec les anciens plans.

La migration `20261012000600_kq_warehouse_reconcile_service_inventory.sql`, appliquée le 12 octobre 2026, corrige les achats de nouveaux contenants réalisés avant l’activation du pont de la migration 005. Le plan pouvait afficher 36 fûts payés et 108 kg de capacité alors que l’inventaire utilisable ne contenait aucun fût. Le rattrapage relève les quantités au minimum attesté par les équipements déjà payés, sans rejouer un achat ni débiter la trésorerie. Il réaffecte les anciens lots aux contenants placés et conserve les masses, dates, archives et snapshots des cultures. Il est sans effet lors d’une nouvelle exécution et laisse les comptes cohérents inchangés. La vérification distante confirme les 36 fûts utilisables, les 1 146,6 g de stock conservés et une pénurie de réservation nulle pour la récolte suivante de 1,5 kg. Aucune partie réelle n’a été démarrée par ce contrôle. Traces : `output/warehouse-migration/inventory-repair-manifest.json`, `inventory-repair-application.json` et `inventory-repair-verification.json`.

- `node scripts/test-placard-warehouse.mjs` : 195 contrôles PostgreSQL, incluant dépenses, reprise, stocks, traitement, quota, permissions, conservation de l’atelier, zones physiques, réallocation, réservation des récoltes indépendamment de leur ordre d’arrivée et rattrapage des achats antérieurs à 005.
- `node scripts/audit-placard-warehouse-v4.mjs` : 22 groupes de contrôles, avec les trois pièces à 320, 390, 768 et 1440 px, tracés culture/séchage/stockage, devis sans débit, contenants partiellement remplis, remplacement de fûts par des bocaux, fonds insuffisants, nouvelles tentatives réseau et parcours de l’atelier existant. Aucune erreur React. Captures dans `output/warehouse-v4/` ; `--preview` ouvre le serveur local de démonstration.
- Suite Vitest complète : 370 fichiers, 3 311 tests réussis. `npm run check:supabase-grants` valide 300 migrations ; ESLint et `npm run build` (TypeScript inclus) réussissent. Le dernier ajustement d’interface a également passé TypeScript et l’audit navigateur complet. Le correctif 006 porte uniquement sur SQL et a passé le runner PostgreSQL ainsi que les contrôles de permissions.

La migration `20261012000700_kq_warehouse_supplier_invoices.sql` a été appliquée le 12 octobre 2026 au même projet, après une prévisualisation limitée à cette seule migration. Elle supprime le débit des consommables et le contrôle de trésorerie au lancement, puis émet une facture à 120 heures uniquement après l’insertion réussie d’une nouvelle culture. Les relectures, abandons et nouvelles tentatives ne créent pas de seconde facture. Les paiements à échéance suivent la même chronologie que les ventes automatiques, indépendamment de la fréquence de connexion. La vérification distante confirme les deux triggers actifs, la suppression du blocage, les permissions privées et l’absence de rétrofacturation. Aucun lancement de partie réelle n’a été effectué pour vérifier la migration. Traces : `output/warehouse-migration/supplier-manifest.json`, `supplier-application.json` et `supplier-verification-complete.json`. L’interface est prête dans le code local ; cette opération déploie la base.

Validation du paiement fournisseur : 235 contrôles PostgreSQL dans le runner entrepôt ; runner comptable réel avec bilan, dettes, règlements et coût du stock réconciliés ; 9 groupes navigateur, dont écran à 320 px, trésorerie nulle, ancienne campagne, règlement anticipé, réponse perdue et retenue sur vente. La suite complète passe avec 3 340 tests dans 370 fichiers. Un second passage simultané à la compilation a atteint le délai de 15 secondes du test PDF existant ; ses 10 tests passent à nouveau seuls. ESLint, compilation de production et contrôle des droits de 301 migrations réussissent. Les migrations 001–006 restent inchangées.

## Archive du décor V2

Révision du 19 septembre 2026.

## Résultat

L'entrepôt conserve les treize emplacements et leurs interactions, dans un décor illustré panoramique de 1774×887 pixels. La zone de culture occupe la gauche, les deux appareils de table reposent sur le même établi, les machines au sol disposent de postes distincts, et le passage à droite mène à la pièce séchoir.

La navigation comporte trois activités : Cultiver, Transformer et Services. Sur mobile, la sélection conserve la position verticale dans l'atelier ; les boutons Voir le détail et Retour à l'entrepôt permettent de rejoindre explicitement le panneau. Une vue d'ensemble complète le décor agrandi et son déplacement horizontal.

## Proportions et placement

Les objets utilisent leur ratio intrinsèque, sans étirement. Les coordonnées de KqWarehouseScene sont des centres horizontaux et des ancrages bas, avec une échelle de référence d'environ 20% de la hauteur du décor par mètre à l'arrière et 24% au premier plan. Les supports et pompes font partie de la silhouette correspondante.

- Tente droite : environ 1,8 m au départ, 2 m pour la tente renforcée.
- Tambour sous capot et presse compacte : sur le plateau, à 48,8% de la hauteur.
- Séparateur statique : appareil vertical sur roues, presque aussi haut que la tente.
- Cuve inox, tamis circulaires et lyophilisateur : au sol sur leurs supports, sans bloquer leurs voisins.
- Lyophilisateur : porte circulaire et pompe externe ; chariot bas.
- Caméra et contrôleur : petits éléments muraux, également accessibles par la navigation.
- Pièce séchoir : rails à l'intérieur de la porte existante ; densité augmentée à partir du niveau 5.
- Les niveaux des autres machines n'agrandissent pas arbitrairement leur modèle.

Il s'agit d'une mise à l'échelle visuelle cohérente, pas d'un plan industriel coté. Les dimensions incomplètes du fabricant, les supports et les différences de perspective imposent des estimations. Voir [les références et leurs limites](PLACARD-ENTREPOT-REFERENCES-V2.md).

## Assets et génération

Les dix-neuf images finales et leurs dimensions sont enregistrées dans public/placard/warehouse-v2/. Le décor est room.webp ; les dix-huit illustrations d'équipement sont détourées avec alpha.

Génération avec l'outil intégré image_gen : un décor, trois planches de six objets, puis un passage de détourage. Les [prompts exacts](warehouse-v2-prompts.json) sont conservés. L'ancien décor sert uniquement de référence stylistique.

Les sources sélectionnées se trouvent localement dans output/imagegen/warehouse-v2/source/ : room.png, machines.png, grow-original.png et accessories.png. Le manifest indique les rectangles de découpe et le fichier source effectivement choisi. Le fond sombre visible dans certains aperçus des sources correspond aux canaux RGB masqués par l'alpha ; aucun fond coloré n'a été retiré approximativement.

Conditionnement reproductible avec node scripts/build-warehouse-assets.mjs une fois ces sources présentes : découpe sans redimensionner, rognage par l'alpha avec conservation des contours, marge transparente et WebP qualité 90. --dry-run vérifie sans écrire.

Les aperçus du hall et de l'essai guidé utilisent également le nouveau décor.

## Validation

- TypeScript sans émission et ESLint ciblé.
- 25 tests existants liés aux équipements et à l'inventaire.
- Audit navigateur : node scripts/audit-placard-warehouse.mjs, avec WAREHOUSE_AUDIT_OUTPUT pour choisir le dossier de captures.
- Audit validé sur 320, 390, 768, 844 et 1440 pixels ; 26 contrôles de sélection et vues d’ensemble sur 320/390 pixels.
- Captures avant : output/warehouse-before/.
- Captures après : output/warehouse-after-v2/.

Aucune migration de données n'est nécessaire pour cette refonte visuelle.
