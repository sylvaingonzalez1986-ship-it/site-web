# Placard : inventaire indisponible et cultures bloquées

## Diagnostic du 21 septembre 2026

Le chargement du matériel affiche « Service momentanément indisponible. » et le
démarrage des cultures échoue. Les deux opérations appellent
`getKqEquipmentShopSnapshot`, qui sélectionne notamment `culture_wear_percent` et
`culture_wear_version` dans `kq_player_equipment`.

La vérification distante en lecture seule confirme :

- anciennes colonnes du matériel : HTTP 200 ;
- nouvelles colonnes d’usure : HTTP 400, code PostgreSQL `42703`, colonne
  `culture_wear_percent` absente ;
- relation portefeuille/profil chanvrier : HTTP 200 ;
- table `kq_culture_equipment_wear_receipts` : HTTP 404, code `PGRST205`.

`supabase migration list --linked` et `supabase db push --linked --dry-run`
confirment une seule migration en attente :
`20260919000500_kq_culture_equipment_wear.sql`. Toutes les migrations précédentes
sont enregistrées dans la base liée, dont l’identité correspond à la configuration
Supabase de l’application.

## Correctif appliqué

La migration existante a été appliquée en production avec
`supabase db push --linked --yes`. Elle ajoute les colonnes initialisées à zéro,
les reçus, les règles de contrôle et la fonction de remplacement dans une
transaction. Elle conserve les équipements et les soldes ; les cultures déjà
terminées reçoivent un reçu sans usure rétroactive.

Après un premier blocage du contrôle automatique d’approbation, l’utilisateur a
explicitement autorisé cette application. La commande n’a appliqué que
`20260919000500_kq_culture_equipment_wear.sql` et s’est terminée avec succès.

## Vérifications

- `node scripts/test-placard-culture-wear.mjs` : répétition PostgreSQL isolée
  réussie, couvrant notamment démarrage, historique, usure, remplacement,
  idempotence, annulation transactionnelle et permissions.
- Vitest : six fichiers ciblés, 72 tests réussis (usure, équipements, backend du
  jeu, API équipements et démarrage des cultures).
- Après application, `node scripts/check-placard-equipment-schema.mjs` : neuf
  lectures HTTP 200, aucun objet ni colonne manquant, résultat `ok: true`.
- Après application, `supabase db push --linked --dry-run` : base distante à jour,
  aucune migration en attente.

Le contrôle de schéma ne lit aucune ligne joueur et ne lance aucune culture.
La validation du parcours connecté en production reste distincte de ces contrôles.
