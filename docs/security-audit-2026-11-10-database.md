# Audit local Supabase — 10 novembre 2026

Périmètre : migrations, permissions Data API, RLS, fonctions privilégiées, Storage et traces Realtime. Aucun accès à la base déployée, aucun appel réseau, aucune migration appliquée. L'état déployé, ses ACL personnalisées, ses buckets et ses publications ne sont pas observables ici. Application, dépendances, configuration et modifications préexistantes préservées.

## DB-01 — Critique : RPC de récompenses exécutables par les rôles clients

**Statut : confirmé dans le code et reproduit dans PostgreSQL isolé ; exposition déployée à vérifier.**

- `supabase/migrations/20260302001300_lottery_all_burn_10.sql:3` définit la dernière surcharge à sept paramètres de `rpc_burn_duplicate_cards`. Elle est `SECURITY DEFINER` (`:14`), utilise directement `p_user_id` (`:48`, `:72`), accepte un pourcentage fourni par l'appelant jusqu'à 80 (`:75`) ou un poids sans plafond métier (`:99`), puis crée une récompense disponible (`:91`, `:119`). Aucune vérification `auth.uid()` / rôle interne.
- `supabase/migrations/20260302000300_tcg_collection_album_rewards.sql:89` définit `rpc_claim_collection_page_reward`, également `SECURITY DEFINER` (`:96`), avec propriétaire fourni par l'appelant (`:127`) et mutation de sa récompense (`:184`, `:199`).
- La recherche dans les 371 migrations ne trouve aucun retrait `PUBLIC EXECUTE` pour ces deux noms, ni retrait général ou de privilèges par défaut qui couvrirait ces fonctions. PostgreSQL accorde normalement EXECUTE à PUBLIC à leur création. La migration de rattrapage `20260923000200_explicit_data_api_grants.sql:6` préserve explicitement les privilèges RPC existants.
- L'ancienne surcharge à quatre paramètres, créée en `20260302000300_tcg_collection_album_rewards.sql:236`, n'est pas supprimée. Ne pas la présenter comme exploitation réussie : l'ajout ultérieur de `burn_log.reward_kind NOT NULL` sans valeur par défaut semble faire échouer son INSERT. L'inventaire et le retrait des permissions doivent néanmoins couvrir toutes les signatures.

**Reproduction locale :** `node scripts/security-audit-2026-11-10-database.mjs`. Corps de fonctions exacts ; fixtures relationnelles réduites ; rôles `anon`, `authenticated`, `service_role` ; RLS activée ; aucun privilège de table client. `anon` échoue sur SELECT direct des récompenses (42501), mais consomme dix cartes d'un utilisateur de fixture et crée un bon de **1 000 000 g** ; il sélectionne également la récompense de collection de ce même utilisateur, sans identité JWT. `authenticated` crée ensuite une remise disponible de **80 %**. Des REVOKE nommés, appliqués uniquement dans la fixture, font échouer les deux RPC anonymes avec 42501. Les migrations et l'application sont inchangées.

**Prérequis :** accès à une API exposant `public`, ACL déployées conservant PUBLIC EXECUTE ; pour le burn, connaître dix UUID de cartes détenues par l'utilisateur cible avec une copie restante. L'attaquant peut obtenir ses propres UUID dans sa collection. Une attaque contre autrui exige aussi de connaître ses identifiants ; aucun mécanisme de découverte de ces UUID n'est démontré ici. La récompense de page exige une collection réellement complète et une option valide.

**Impact commercial vérifié par revue des appels :** `src/lib/supabase/lottery-backend.ts:2404` charge une récompense disponible par identifiant et utilisateur, puis `:2421` appelle `buildClaimBenefit`. Celui-ci transmet `claim.discountPercent` (`:553`). `src/app/api/checkout/viva/route.ts:746` utilise le pourcentage, `:797` réduit les lignes facturées et `:972` transmet le total diminué à Viva. Les cadeaux deviennent une ligne gratuite à `:857`. Le contrôle de propriétaire est utile contre le vol d'un bon, mais accepte le bon falsifié créé pour son propre compte. Aucun paiement réel ni livraison n'a été exécuté pendant l'audit.

**Contrôles existants :** nombre de cartes, propriétaire déclaré, rareté et conservation d'une copie vérifiés ; RLS des tables ; contrôle propriétaire lors de la consommation. Ils ne ferment pas l'accès direct à une fonction privilégiée.

**Correction recommandée :** nouvelle migration avec REVOKE ALL explicite de PUBLIC, anon, authenticated et service_role sur chaque signature, puis GRANT EXECUTE seulement à service_role pour les signatures utilisées. Retirer les anciennes surcharges inutilisées. Calculer le barème commercial dans la frontière de confiance et empêcher qu'un appel direct fournisse les montants. Examiner les récompenses historiques anormales avant utilisation. Ne pas appliquer pendant cet audit.

**Régression :** rejeter les appels des deux rôles clients avant tout changement ; conserver l'appel serveur légitime ; tester les UUID d'autrui et les montants hors barème ; inventorier toutes les surcharges et leurs ACL effectives après la chaîne complète de migrations.

## DB-02 — Élevée, conditionnelle : UPDATE de profil autorise les valeurs de fidélité

**Statut : politique permissive confirmée et reproduite ; prérequis de GRANT déployé non observable.**

`supabase/migrations/20260215_0001_init.sql:199` conserve `loyalty_points` sur `profiles`. Les politiques SELECT (`:287`) et UPDATE (`:290`) ne contrôlent que `id = auth.uid()` ; elles ne distinguent pas coordonnées personnelles, solde de fidélité et autres attributs serveur. Aucune migration trouvée ne retire UPDATE à authenticated sur cette table. Le rattrapage de permissions préserve les ACL client (`20260923000200_explicit_data_api_grants.sql:6`). Le test historique lui-même simule un tel GRANT (`scripts/test-supabase-data-api-grants.mjs:192`).

Dans la reproduction isolée, avec **GRANT SELECT, UPDATE ajouté explicitement comme prérequis**, un utilisateur ne modifie que son profil mais passe `loyalty_points` à 1 000 000 sous les politiques exactes du dépôt. Ce résultat ne prouve pas que le GRANT existe en production. `20260302001200_loyalty_pack_purchase.sql:52` lit les points et points dépensés pour l'achat de packs, ce qui rend ces colonnes sensibles. Les autres attributs ajoutés aux profils doivent être inclus dans la revue de permissions par colonne.

**Correction / test :** puisque les écritures applicatives passent par service_role, retirer les permissions d'écriture client, ou limiter explicitement les colonnes autorisées si une écriture directe reste nécessaire ; vérifier en rôle authenticated que chaque colonne de valeur échoue, y compris sur sa propre ligne. Contrôler les ACL historiques effectives plutôt que déduire leur état des seules politiques RLS.

## DB-03 — Faible : le test de droits historique ne valide plus la version actuelle

**Statut : échec reproduit.** `scripts/test-supabase-data-api-grants.mjs:13` limite les fixtures aux migrations antérieures au rattrapage de septembre, mais `:62` exige que toutes les relations des sources actuelles existent dans ce schéma historique. L'exécution échoue sur `src/lib/customer-data-export.ts` et `mailing_recipients`, avant les assertions ACL. Cela ne prouve pas un défaut de GRANT sur `mailing_recipients`.

Faire évoluer le test vers des fixtures de version cohérente et une couverture des fonctions/surcharges, ou séparer les assertions du rattrapage historique des droits effectifs actuels. Le contrôle de convention de migrations ne remplace pas ce test de rôle.

## Contrôles positifs et couverture

- Le contrôle `node scripts/check-supabase-grants.mjs` réussit sur **371 migrations**. C'est un contrôle de convention des nouvelles tables, pas un validateur des permissions des fonctions.
- Inventaire statique : **232 noms de tables public** ; toutes possèdent un ENABLE RLS statique ou dans les boucles explicites de `20260913000100_kq_sales_channels.sql:48` et `20260921000200_kq_treasury_accounting.sql:38`. Inventaire textuel, pas catalogue déployé.
- **Six vues** trouvées avec `security_invoker=true` dans leurs dernières définitions. `20261004000100_contest_data_api_hardening.sql:6` retire les ACL historiques des tables et vues du concours, puis n'accorde que les droits serveur nécessaires. La dernière redéfinition `20261109000100_contest_flower_rankings.sql:19` conserve security_invoker.
- Inventaire indicatif des dernières définitions par nom : **546 fonctions**, dont **441 SECURITY DEFINER** ; toutes ces dernières comportent un search_path explicite. Ce comptage ne couvre pas exhaustivement les surcharges ni les réécritures dynamiques. Les helpers de trésorerie ont un retrait explicite dynamique de leurs ACL (`20260921000200_kq_treasury_accounting.sql:423`) ; ils ne doivent pas être confondus avec les RPC de récompenses exposées.
- Les fonctions récentes de feedback illustrent une protection correcte : search_path vide, verrouillage et REVOKE clients puis GRANT service_role (`20261108001000_arena_feedback.sql:42`, `:76`, `:118`). Les RPC de jeu à paramètres `p_user_id` reposent souvent sur l'identité vérifiée par le serveur appelant ; cette architecture exige que leurs ACL restent fermées aux clients.
- Storage : les buckets products, producers, blog, product-analyses, product-videos et lottery-cards sont volontairement publics. Les politiques trouvées n'ouvrent que SELECT pour ces buckets ; aucune politique d'écriture client ni lecture publique de mission-proofs n'a été trouvée. Les fichiers réellement présents n'ont pas été consultés.
- `mission-proofs` est privé (`20260302001400_mission_proof_images.sql:9`). Upload : UUID propriétaire vérifié, type réel vérifié, limites de poids/pixels, décodage et réencodage WebP, chemin utilisateur/UUID (`src/lib/mission-proof-storage.ts:85`, `:118`, `:126`). Lien signé valable dix minutes (`:148`), construit pour les soumissions de la liste d'administration (`src/lib/supabase/missions-backend.ts:468`) derrière le garde admin (`src/app/api/admin/missions/route.ts:64`). Aucun endpoint public permettant de signer un chemin arbitraire n'a été trouvé.
- Les PDF d'analyse publics passent par le nettoyage existant avant upload (`src/lib/product-analysis-storage.ts:174`). La présence éventuelle de documents historiques non nettoyés dans le bucket n'est pas observable localement.
- Realtime est activé dans la configuration locale (`supabase/config.toml:78`), mais aucun abonnement `.channel`, `postgres_changes`, ajout de table à une publication ou politique realtime.messages n'a été trouvé dans les sources/migrations. Aucune conclusion sur la publication déployée ou la configuration du dashboard.

## Limites et preuves conservées

- Exécuté : contrôle de convention (succès), ancien test ACL (échec de fixture expliqué), reproduction isolée (succès, contrôles négatifs et variante de profil conditionnelle).
- Preuve reproductible : `scripts/security-audit-2026-11-10-database.mjs` ; utilisation en mémoire de PGlite déjà installé, aucune installation de dépendance.
- Pas de rejeu intégral des 371 migrations, de PostgreSQL/Supabase déployé, de requête PostgREST HTTP, de vérification des clés, de politiques externes au dépôt, de contenu Storage ni de publication Realtime distante.
- Les fixtures vérifient l'exécution des corps exacts, avec les colonnes et contraintes pertinentes, mais n'émulent pas toutes les dépendances/événements historiques Supabase. Les principales conditions d'exploitation et les contrôles compensatoires sont indiqués pour chaque constat.
