# Centre de missions du Placard

La migration `20260913000500_kq_mission_center.sql` a été appliquée au projet
Supabase lié le 13 septembre 2026, après autorisation explicite de l’utilisateur.
Le dry-run puis l’application dans un espace isolé ont porté uniquement sur cette
migration ; la migration d’arène `20260912000100` déjà en attente reste exclue.
La vérification distante en lecture seule de `rpc_kq_mission_state`, avec un
identifiant vide, renvoie HTTP 200, neuf missions sans progression et une collection
La Botte active. Aucun pack n’a été attribué pendant cette vérification.

## Parcours et récompenses

| Parcours | Étape 1 : pack de 3 cartes | Étape 2 : pack de 3 cartes | Étape 3 : booster de 10 cartes |
| --- | --- | --- | --- |
| Culture | Récolter une première fleur | Récolter trois variétés distinctes | Récolter une fleur Qualité concours ou supérieure |
| Vente en ligne | Conserver 2 clients fidèles | Conserver 5 clients fidèles | Conserver 10 clients fidèles |
| Boutiques partenaires | Avoir 1 boutique partenaire | Avoir 3 boutiques partenaires | Avoir 6 boutiques partenaires |

Une mission visible par parcours, neuf récompenses permanentes et 48 cartes au
maximum par compte. La réclamation débloque l’étape suivante. Aucun reset quotidien,
aucune récompense répétable : ces objectifs accompagnent la découverte et une
progression durable sans rendre les petits allers-retours commerciaux rentables.

Les anciennes cultures officielles comptent. Seules les fleurs rattachées à une
culture terminée du même joueur sont admissibles ; la vente et les duels ne retirent
pas cet historique. Le niveau concours reprend le seuil de qualité de récolte
du jeu (10, et légendaire à partir de 14), distinct de la note du jury sur 10.

Les missions commerciales utilisent les effectifs nets actuels. Un client perdu
avant la réclamation peut faire redescendre la progression. Une récompense déjà
récupérée reste acquise. Perdre puis regagner les mêmes clients ne produit aucun
pack supplémentaire.

## Accès et validation

- Entrée Missions dans le Placard et lien direct depuis l’arène.
- URL : `/arene/placard?view=missions`.
- Progression illustrée, prochains objectifs repliables et reçu après réclamation.
- Packs ajoutés aux packs disponibles dans la boutique La Botte, avec son ouverture
  serveur habituelle et ses règles de tirage existantes.
- API privée `/api/arena/placard/missions` : session et périmètre du jeu contrôlés,
  réponses non mises en cache, limite de réclamations par compte.
- Seuls le code de mission et l’identité de session sont utilisés. Objectifs,
  quantités de cartes, conditions et progression sont évalués par PostgreSQL.
- Fonctions réservées au rôle de service. Verrou transactionnel par joueur,
  verrou partagé sur le compte commercial et clé unique permanente par mission.
- Aucun pack existant modifié, aucun point de fidélité dépensé ou attribué.

## Vérifications

- `node scripts/test-placard-missions.mjs` : PostgreSQL isolé, identité, cultures,
  seuil 9/10, variétés distinctes, baisse d’effectifs, prérequis, plafond de cartes,
  réclamations répétées, ouverture réelle des packs de 3 et 10 cartes, accès SQL.
- Tests API, boutique, accès et arène : 16 tests réussis.
- `node scripts/audit-placard-missions.mjs` : interface réelle avec données simulées,
  320/390/768/1440 px, réclamations successives, navigation, connexion, reprise
  après erreur, collection inactive et parcours terminés.
- `npm.cmd run build` : réussi, compilation et TypeScript compris.
- `node scripts/check-server-traces.mjs` : 207 traces vérifiées, maximum local
  estimé à 102,2 Mio ; illustrations servies à part et factures préservées.
- ESLint et vérification des espaces Git : réussis.

Les captures et le rapport de navigation sont dans `output/placard-missions/`.
