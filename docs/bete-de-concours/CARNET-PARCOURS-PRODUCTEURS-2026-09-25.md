# Parcours de dégustation par producteur — 25 septembre 2026

Le carnet réunit les fleurs Regular et Concours. Les chapitres suivent le mode de culture ; le type de fiche reste conservé pour les formulaires et les avis existants. La progression des récompenses se lit par producteur.

## Règles retenues

Les valeurs ci-dessous sont les réglages de travail annoncés dans la conversation, en attendant un éventuel choix différent de l’utilisateur : **100 € de jeu** et **un tirage après l’achat de toutes les fleurs du producteur**.

- **Dégustation :** toutes les fleurs publiées du producteur dans la saison courante du carnet doivent avoir un avis approuvé. Un produit présent en Regular et en Concours compte une seule fois. La dernière approbation attribue 100 € au portefeuille du Placard ; un bouton permet aussi de récupérer un bonus antérieur éligible.
- **Achat :** les achats payés et non annulés de toutes ces fleurs permettent un tirage de Buddie. Les achats peuvent provenir de plusieurs commandes ; les variantes d’un même produit sont regroupées. Un achat invité exige une adresse confirmée correspondant au compte, sur une commande sans autre propriétaire.
- **Tirage :** chaque carte active Argent ou Or de la collection `HEMP_HEROES_2026` a la même probabilité. Il ne s’agit pas d’un partage 50/50 entre les deux raretés. Le serveur effectue le tirage au moment de la réclamation.
- **Fréquence :** un bonus de dégustation et un tirage par client et producteur, sans remise à zéro à chaque saison. L’ajout ultérieur de fleurs ne permet pas de toucher une seconde récompense. Les produits qualifiants sont conservés dans le reçu.
- **Héritage :** le premier avis approuvé sur une fleur éligible de la campagne conserve le déblocage de la carte Héritage. Le choix des fleurs dans l’administration concerne cet Héritage ; la progression complète considère toutes les fleurs publiées du producteur.
- **Anciens packs :** les packs déjà attribués restent disponibles et ouvrables. Les nouveaux avis Concours ne donnent plus automatiquement cinq packs.

Les deux attributions sont indépendantes. Les avis validés déclenchent le bonus monétaire ; les commandes payées ouvrent le tirage. Lire la progression n’écrit ni portefeuille ni récompense.

## Mise en œuvre

- Migration : `supabase/migrations/20260925000200_kq_producer_tasting_completion.sql`.
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

La migration éditoriale Héritage `20260925000100` reste en attente : son application ultérieure devra inclure cette version antérieure dans le lot contrôlé (`--include-all` après prévisualisation). Le code de l’interface n’a pas été déployé par cette opération.

Vérification distante après application : quatre signatures RPC présentes, colonne de provenance présente, lecture à zéro ligne réussie sur les deux nouvelles tables et exécution refusée pour les quatre fonctions auxiliaires privées. Rapport : `output/producer-notebook-migration/verification.json`. Aucun compte joueur n’a été utilisé et aucune récompense n’a été attribuée pendant ces contrôles.
