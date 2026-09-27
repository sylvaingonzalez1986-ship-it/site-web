# Parcours de dégustation par producteur — 25 septembre 2026

Le carnet distingue deux sections, Regular et Concours, chacune avec trois chapitres : Outdoor, Greenhouse et Indoor. Une fleur figure dans un seul parcours selon son tarif de référence TTC par gramme : 2,50 € en Regular, au-dessus de 2,50 € en Concours. La progression des récompenses reste commune par producteur et compte chaque produit une seule fois.

## Correctifs du 27 septembre

L'audit initial de la saison `001` relevait 22 fiches publiées pour 18 produits : 18 Regular et 4 Concours. La séparation visuelle des parcours corrigeait les listes, compteurs et flèches, mais la vérification des tarifs a ensuite confirmé que les quatre doubles publications étaient erronées. La synchronisation de l'administration créait une fiche Regular pour toute fleur, même déjà publiée en Concours.

La migration `20260927000100_contest_flower_price_tracks.sql` retire la publication des doublons Regular de Cake Brulée, Strawnana OG, Legendary Platinium et Shaolin. White CBG, à 4 €/g, passe en Concours avec le même identifiant. Small Bud Mix, à 1 €/g, est retiré du carnet à la demande de l'utilisateur ; sa fiche et son avis restent conservés. Le résultat attendu est 17 produits publiés sans doublon : 12 Regular et 5 Concours. Aucun prix boutique n'est modifié.

La synchronisation et l'administration utilisent le tarif hors promotion, ramené au gramme et arrondi au centime. Les tarifs inférieurs à 2,50 €/g ne sont pas éligibles. Les poids inconnus, packs et variantes complexes ne sont pas classés automatiquement. Une fiche cachée ne doit pas être republiée automatiquement. Les saisons archivées, avis, droits et récompenses déjà acquis sont conservés ; les obligations de dégustation et d'achat utilisent les fleurs encore publiées.

Trois anciennes URL de photos renvoient `Object not found` : Heaven, Pink Pineapple et Legendary Platinium (ce dernier concerne les deux parcours). Leurs photos produit actuelles répondent correctement, y compris via l'optimiseur Next.js. Miniature et fiche partagent un repli automatique : photo du lot, photo actuelle du produit, galerie du lot, puis pictogramme si aucune image n'est disponible.

Le nettoyage des photos boutique protège aussi les références de toutes les fiches du carnet, y compris historiques et non publiées. Il lit toutes les pages de références avant de calculer les fichiers inutilisés et abandonne sans suppression si cette lecture échoue. Le script de nettoyage regroupe les références boutique et carnet avant une seule passe sur le bucket `products`.

Audits de production : `output/notebook-fix/catalog.json` et `images.json`. Contrôle navigateur reproductible : `node scripts/audit-tasting-book.mjs` ; tests de préservation des photos : `src/lib/product-image-storage.test.ts`. Ces tests utilisent des données simulées et n'exécutent aucun nettoyage distant.

## Règles retenues

Le bonus demandé est de **100 € de monnaie de jeu par fleur distincte** du producteur : 2 fleurs donnent 200 €, 3 fleurs donnent 300 €. Le versement intervient une seule fois, lorsque le parcours complet est validé. Le tirage reste disponible après l’achat de toutes les fleurs du producteur.

- **Dégustation :** toutes les fleurs publiées du producteur dans la saison courante du carnet doivent avoir un avis approuvé. Chaque produit compte une seule fois, y compris si des avis existent sur d'anciennes fiches en double. La dernière approbation attribue 100 € × le nombre de produits distincts au portefeuille du Placard ; un bouton permet aussi de récupérer un bonus antérieur éligible.
- **Achat :** les achats payés et non annulés de toutes ces fleurs permettent un tirage de Buddie. Les achats peuvent provenir de plusieurs commandes ; les variantes d’un même produit sont regroupées. Un achat invité exige une adresse confirmée correspondant au compte, sur une commande sans autre propriétaire.
- **Tirage :** la règle initiale choisissait uniformément parmi les Argent et Or. La nouvelle règle de quantité ci-dessous inclut les Communs et sélectionne d'abord la rareté selon des probabilités explicites, puis une carte active de cette rareté dans `HEMP_HEROES_2026`.
- **Fréquence :** un bonus de dégustation et un tirage par client et producteur, sans remise à zéro à chaque saison. L’ajout ultérieur de fleurs ne permet pas de toucher une seconde récompense. Les produits qualifiants et le montant effectivement versé sont conservés dans le reçu. Les anciens reçus restent inchangés ; la vérification du 27 septembre a trouvé un seul reçu, pour une fleur et 100 €, déjà conforme au nouveau tarif.
- **Héritage :** le premier avis approuvé sur une fleur éligible de la campagne conserve le déblocage de la carte Héritage. La carte est affichée en grand, avant le bonus monétaire, sans volet à ouvrir. Son recto reste grisé tant que l’attribution n’est pas confirmée (`heritageGranted`), puis apparaît en couleur avec son avantage. Le visuel du producteur fourni par la base est prioritaire, avec le recto du manifeste comme secours. Le choix des fleurs dans l’administration concerne cet Héritage ; la progression complète considère toutes les fleurs publiées du producteur.
- **Anciens packs :** les blocs « Mes packs La Botte » et « Inventaire La Botte » sont retirés du carnet, ainsi que leurs chargements et leur action d’ouverture. Les packs déjà attribués restent disponibles dans le Placard. Les nouveaux avis Concours ne donnent plus automatiquement cinq packs.
- **Missions retirées :** « Les bons terpènes et goûts » et « Critique élaborée » ne figurent plus dans le carnet et ne créent plus de packs. Les règles `combo-aromatique` et `premier-carnet` sont désactivées ; l’ancienne réclamation de boosters est aussi bloquée pour ces deux codes. Les badges restent des distinctions, sans nouvelle récompense de mission. Les packs déjà attribués, les autres missions du Placard et les bonus par producteur sont conservés.

Les deux attributions sont indépendantes. Les avis validés déclenchent le bonus monétaire ; les commandes payées ouvrent le tirage. Lire la progression n’écrit ni portefeuille ni récompense.

## Bonus de quantité et tirages pondérés — 27 septembre

La version `notebook-quantity-v1` ajoute un supplément par fleur au bonus de découverte. Les 100 € de base restent versés à la fin du parcours producteur. Le supplément se débloque dès qu'un avis de la fleur est approuvé, même si les autres fleurs du producteur restent à découvrir. Tous ces montants sont de la monnaie du Placard.

| Grammes de la même fleur dans une commande | Total, base comprise | Supplément | Or Regular | Or Concours |
| --- | ---: | ---: | ---: | ---: |
| 1 g | 100 € | 0 € | 1 % | 3 % |
| 3 g | 330 € | 230 € | 1,25 % | 3,75 % |
| 5 g | 600 € | 500 € | 1,5 % | 4,5 % |
| 10 g et plus | 1 300 € | 1 200 € | 2 % | 6 % |

Le montant total suit `100 € × min(grammes, 10) × multiplicateur` : 1 avant 3 g, 1,10 dès 3 g, 1,20 dès 5 g et 1,30 dès 10 g. Le supplément est ce total moins les 100 € de base, sans valeur négative. Ainsi 2 g donnent 200 € au total, 4 g 440 € et 9 g 1 080 €. La comparaison porte sur les montants totaux débloqués : cinq fleurs de 1 g valent 500 €, une fleur de 5 g vaut 600 €.

Les lignes identiques d'un produit sont regroupées dans chaque commande payée et non annulée, puis seule la commande ayant le plus de grammes est retenue. Cinq commandes de 1 g ne deviennent pas un achat de 5 g. Le calcul utilise le poids enregistré dans la ligne de commande, jamais le poids actuel du catalogue. Les commandes invitées conservent les règles de rapprochement par adresse confirmée. Les lignes de variantes `::` dont le poids historique n'est pas fiable restent utilisables pour valider l'achat d'une fleur, mais n'augmentent pas ce bonus ; elles ne font pas l'objet d'une estimation depuis leur libellé.

Le crédit de quantité est unique par client et produit et conserve le montant déjà versé. Un achat plus important ouvre seulement la différence : passer de 3 g à 5 g donne 270 € de supplément supplémentaire. Le bouton du carnet permet de récupérer un supplément après un nouvel achat ou pour un ancien avis approuvé ; l'approbation d'un avis traite aussi automatiquement le supplément éligible. Ouvrir le carnet ne crédite rien. Les crédits et les anciens reçus de découverte sont conservés.

La probabilité d'Argent est de 10 % pour une Regular et de 18 % pour une Concours. L'Or suit le tableau, avec les mêmes paliers de grammes ; le reste revient aux Communs. Pour le tirage unique du producteur, les probabilités sont la moyenne des contributions de chaque produit distinct du parcours. Quatre Regular de 1 g et une Concours de 1 g donnent donc 87 % Commun, 11,6 % Argent et 1,4 % Or. Si d'anciennes fiches dupliquent un produit dans les deux parcours, sa contribution Concours est retenue une seule fois.

Les probabilités et leur version sont enregistrées au moment du tirage. Les achats suivants ne donnent aucun nouveau Buddie et ne changent pas le reçu. Les anciens tirages conservent une probabilité historique inconnue, sans reconstruction depuis le nouveau barème. Les trois raretés doivent disposer d'une carte active avant de lancer l'aléatoire. Sinon la réclamation échoue sans consommer le tirage, afin que les nouvelles tentatives ne favorisent pas les seules raretés disponibles.

La fiche produit affiche une estimation aux clients connectés lorsque le produit appartient au carnet actuel et que la base annonce la disponibilité de cette règle. Les poids inconnus et variantes ambiguës ne donnent pas lieu à une promesse de quantité. Le carnet affiche les grammes retenus, le supplément reçu ou disponible et les probabilités du tirage. Le déploiement du code avant la migration garde ces nouveaux affichages désactivés.

Migration : `20260927000400_kq_notebook_quantity_rewards.sql`. La préparation et les tests locaux n'appliquent pas cette migration à la base distante.

Vérification de cette évolution : 183 tests ciblés de barème, progression, backend, API client et administration ; 92 contrôles SQL isolés avec PGlite ; vérification des permissions sur 254 migrations. Le scénario SQL couvre notamment les achats répartis entre commandes, les lignes regroupées, les achats invités, les paliers, les différences déjà versées, les limites du portefeuille, l'équilibre du journal et les anciennes récompenses. Les requêtes concurrentes PGlite restent sérialisées sur une connexion ; l'ordre des verrous entre complétion, quantité et portefeuille fait aussi l'objet d'un contrôle explicite.

Commandes de vérification reproductibles :

```powershell
node scripts/test-producer-notebook-quantity-rewards.mjs output/notebook-rewards/pglite/node_modules/@electric-sql/pglite/dist/index.js
node scripts/audit-notebook-quantity.mjs
npm.cmd run check:supabase-grants
```

Le test SQL écrit `output/notebook-rewards/quantity-sql-verification.json`. L'audit navigateur utilise des données synthétiques et les vrais composants, avec rapports et captures dans `output/notebook-quantity` : supplément avant la fin du parcours, erreur et nouvelle tentative, onglet déjà payé, Commun, probabilités conservées après un achat supérieur, aperçu boutique et absence de promesses sur les progressions historiques sans nouvelle règle.

## Mise en œuvre

- Migrations : `supabase/migrations/20260925000200_kq_producer_tasting_completion.sql`, puis `20260927000200_kq_producer_completion_per_flower.sql` pour le montant proportionnel. La seconde remplace les fonctions de calcul et de versement sans modifier les crédits existants. Le code accepte le montant historique pendant le déploiement et utilise ensuite le montant fourni par la base.
- Retrait des missions à packs : `20260927000300_retire_notebook_pack_missions.sql`, sans suppression des reçus ni des packs acquis. Les anciennes promesses de boosters dans le guide des terpènes sont remplacées par des conseils de dégustation.
- API : `GET /api/contest/producer-rewards` pour la progression ; `POST` avec `action: "completion"` ou `action: "purchase-buddie"` et `producerId` pour récupérer une récompense. L’identité vient exclusivement de la session.
- Deux reçus uniques par couple client/producteur empêchent les doubles attributions. Les appels répétés rendent le résultat existant. Recycler une carte ne rend pas un nouveau tirage possible.
- Les écritures passent par des fonctions serveur avec validation et verrouillage. Les nouvelles tables n’exposent que la lecture à `service_role` ; les fonctions auxiliaires ne sont pas exécutables par les rôles API.
- L’outil de rattrapage admin affiche désormais les bonus et montants, dédoublonnés par client/producteur ; les anciennes preuves archivées gardent leur empreinte.

## Vérification locale

- TypeScript global et ESLint des composants et modules concernés : réussis.
- 52 tests de logique, backend, API et rattrapage ; 11 tests backend repassés après le correctif du reçu d’une carte recyclée.
- 38 contrôles SQL isolés avec PGlite : progression commune, versement unique, comptabilité, achats cumulés, commandes exclues, tirage, absence de nouvelles récompenses avec une collection vide, droits Data API et conservation des packs existants.
- `npm run check:supabase-grants` : réussi, 250 migrations contrôlées.
- Audit navigateur du carnet aux largeurs 320, 390, 768 et 1440 pixels : navigation, brouillons, formulaires Regular et Concours, clavier mobile et absence de débordement.
- Audit des récompenses à 320 et 390 pixels : bonus récupéré, Buddie Argent et Or, erreur serveur puis nouvelle tentative, persistance après rechargement et absence de second tirage. Rapport : `output/tasting-book/rewards-report.json` ; captures : `output/tasting-book/producer-rewards-claimed-320.png` et `producer-rewards-claimed-390.png`.

Les requêtes concurrentes soumises dans le test PGlite sont sérialisées sur une connexion : ce contrôle vérifie les répétitions idempotentes, pas une charge PostgreSQL sur plusieurs connexions.

Commande du test SQL :

```powershell
node scripts/test-producer-notebook-rewards.mjs output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js
```

La migration `20260925000200_kq_producer_tasting_completion.sql` a été appliquée le 25 septembre 2026 au projet Supabase lié `eyowwwpdmfrulhkpvlnf`, à la demande de l’utilisateur. Une copie isolée de l’historique a permis de vérifier puis d’appliquer cette seule migration avec `supabase db push --linked --yes --workdir output/producer-notebook-migration/deploy`. L’historique distant confirme la version ; la prévisualisation du lot isolé indique que la base est à jour pour ce lot. Reçu : `output/producer-notebook-migration/application.json`.

La migration éditoriale Héritage `20260925000100` a ensuite été appliquée le 26 septembre, après déploiement du commit `5e3b247` et vérification des quinze rectos publics. Les quinze définitions distantes correspondent au manifeste. Rapport : `output/heritage-release/release.json`.

Vérification distante après application : quatre signatures RPC présentes, colonne de provenance présente, lecture à zéro ligne réussie sur les deux nouvelles tables et exécution refusée pour les quatre fonctions auxiliaires privées. Rapport : `output/producer-notebook-migration/verification.json`. Aucun compte joueur n’a été utilisé et aucune récompense n’a été attribuée pendant ces contrôles.
