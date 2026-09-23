# Permissions Data API Supabase — préparation du 30 octobre 2026

Supabase conserve les permissions des tables existantes, mais cesse d'accorder
automatiquement les droits Data API aux nouvelles tables `public` des projets
existants le 30 octobre 2026. Une reconstruction rejoue les anciennes migrations
et crée donc aussi de nouvelles tables.

Source : [annonce officielle](https://github.com/orgs/supabase/discussions/45329).

## Correctif

La migration `supabase/migrations/20260923000200_explicit_data_api_grants.sql`
complète les permissions historiques nécessaires aux requêtes du site et aux
scripts d'import. Elle doit être appliquée après les migrations précédentes,
avant de démarrer l'application sur une base reconstruite.

- Objets nommés explicitement, opérations limitées aux besoins du serveur.
- Droits accordés uniquement à `service_role` : les accès aux données passent
  par les API et modules serveur du site. Les clients Supabase de session servent
  à l'authentification.
- Lecture des vues du concours, y compris leurs dépendances, et utilisation des
  séquences nécessaires aux insertions historiques.
- Conservation des permissions existantes, des politiques RLS et des droits des
  fonctions. Les tables récentes déjà protégées, notamment Buddie et trésorerie,
  gardent leurs restrictions.
- Aucune modification des données ni des privilèges par défaut.

Cette migration ne reproduit pas les anciens droits implicites des visiteurs et
clients connectés. Les politiques historiques de profil/commentaires ne doivent
pas servir de justification pour ajouter des droits client globaux. Voir aussi
l'[audit de sécurité existant](AUDIT-2026-09-12.md).

## Validation locale

```sh
npm run check:supabase-grants
node scripts/test-supabase-data-api-grants.mjs
```

Le contrôle statique exige une décision de permissions pour chaque nouvelle
table dans sa migration. Les créations historiques sont recensées explicitement :
une migration nouvelle, même antidatée, n'est pas exemptée. Ce contrôle de
conventions ne prouve pas les permissions effectives après exécution de SQL
dynamique ni la justesse des politiques RLS.

Le test PostgreSQL utilise PGlite, comme les autres tests SQL isolés du dépôt.
Installation locale si nécessaire :

```sh
npm install --prefix output/reputation-test-tools --no-save --ignore-scripts --package-lock=false @electric-sql/pglite
```

Le test exécute le correctif sur des fixtures sans permissions automatiques,
vérifie les accès nécessaires, les refus, les séquences et la réapplication.
Il ne constitue pas un `supabase db reset` complet ni un test PostgREST distant.
Les scripts de répétition locale qui créent directement des objets de jeu pour
leurs fixtures ne justifient pas de droits d'écriture supplémentaires en production.

## Application au projet Supabase

Vérifier d'abord le projet ciblé et les migrations en attente :

```sh
supabase migration list --linked
supabase db push --linked --dry-run
```

Le résultat doit être revu avant `supabase db push --linked`, qui applique toutes
les migrations en attente, pas uniquement ce correctif. Ne pas utiliser de reset
sur la base en ligne. Si la base n'a pas toutes les migrations précédentes,
résoudre cet écart avant d'appliquer les permissions : les objets absents font
échouer la migration au lieu d'être ignorés.

## Application effectuée le 23 septembre 2026

Le correctif a été appliqué au projet lié « Site Web Les Chanvriers Bretons »
(`eyowwwpdmfrulhkpvlnf`), après confirmation que sa référence correspond à
l'URL Supabase de l'application. L'application a été autorisée par l'utilisateur.

- La liste des migrations et la prévisualisation ne montraient que
  `20260923000200_explicit_data_api_grants.sql` en attente.
- `supabase db push --linked --yes` a appliqué cette seule migration avec succès.
- La liste distante confirme ensuite `20260923000200` des deux côtés ; une
  nouvelle prévisualisation confirme que la base est à jour.
- 97 requêtes Data API avec `service_role` sur les tables et vues recevant SELECT
  ont réussi, toutes avec `limit=0` et une réponse vide. Vérification terminée
  à 16:47:53 UTC ; aucune ligne applicative récupérée.

Les vérifications distantes couvrent l'application SQL, l'historique des migrations
et les lectures Data API. Aucun test d'écriture applicative ni comparaison complète
des ACL du catalogue distant n'a été exécuté. Les droits d'écriture, les séquences
et la conservation des autres ACL ont été vérifiés localement avec PGlite.
Cette opération ne publie pas les changements du code du site ou de sa CI.

## Futures tables

Exemple pour une table lue par le serveur et écrite uniquement par une RPC :

```sql
CREATE TABLE public.example (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.example FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.example TO service_role;
```

Ajouter les autres opérations seulement si une requête directe les utilise.
Pour une table entièrement interne, conserver le `REVOKE` sans `GRANT` de table
et donner uniquement les droits d'exécution nécessaires sur les RPC prévues.
