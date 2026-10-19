# Centre de missions du Placard

## Révision du 18 octobre 2026 — trente missions

Le nouveau catalogue comporte cinq parcours de six étapes : Découverte,
Apprenti, Confirmé, Expert, Maître et Légende. Chaque étape demande de récupérer
les récompenses de toutes les étapes précédentes du même parcours. Les objectifs
déjà atteints restent comptés pendant cette progression.

| Parcours | Étape | Mission | Objectif | Récompense |
| --- | --- | --- | --- | --- |
| Culture | 1 | Ta première récolte | 1 culture récoltée | 50 € de jeu |
| Culture | 2 | Le goût de la variété | 3 Buddies différents récoltés | 150 € de jeu |
| Culture | 3 | Un jardin de caractères | 5 Buddies différents récoltés | Deuxième chance · carte rare |
| Culture | 4 | Dix façons de cultiver | 10 Buddies différents récoltés | Loupe à trichomes · carte rare |
| Culture | 5 | Le jardin des connaisseurs | 15 Buddies différents récoltés | Pack de 3 cartes |
| Culture | 6 | L’encyclopédie vivante | 20 Buddies différents récoltés | Pack de 10 cartes |
| Qualité | 1 | Une belle pousse | 1 récolte avec une Qualité ≥ 8 | 75 € de jeu |
| Qualité | 2 | Une fleur de concours | 1 récolte avec une Qualité ≥ 14 | 200 € de jeu |
| Qualité | 3 | Le talent se confirme | 3 récoltes avec une Qualité ≥ 14 | Diagnostic croisé · carte rare |
| Qualité | 4 | La qualité sous toutes ses formes | 5 Buddies différents avec une Qualité ≥ 14 | Sonde d’humidité · carte rare |
| Qualité | 5 | La première légendaire | 1 récolte de Qualité ≥ 26, avec 4 étapes réussies dont 2 critiques | Pack de 3 cartes |
| Qualité | 6 | Une signature légendaire | 3 Buddies différents légendaires, selon les mêmes conditions | Pack de 10 cartes |
| Préparation | 1 | De la récolte au lot | 1 récolte préparée pour le commerce | 50 € de jeu |
| Préparation | 2 | La patience du chanvrier | 1 lot arrivé à la fin de son curing | 150 € de jeu |
| Préparation | 3 | Le premier atelier | 1 récolte transformée, opération terminée | 250 € de jeu |
| Préparation | 4 | Le temps fait son œuvre | 5 lots arrivés à la fin de leur curing | Séchage patient · carte rare |
| Préparation | 5 | Les trois savoir-faire | Pratiquer le tamisage, le lavage et le pressage | Papiers en règle · carte rare |
| Préparation | 6 | La réserve d’exception | 10 lots affinés, note initiale du jury ≥ 8/10 | Pack de 10 cartes |
| Vente en ligne | 1 | Ta première commande | 1 sachet effectivement vendu | 50 € de jeu |
| Vente en ligne | 2 | Tes premiers fidèles | 2 clients fidèles actuels | 100 € de jeu |
| Vente en ligne | 3 | Le duo aromatique du moment | 1 vente de fleurs avec les deux arômes demandés | Deuxième chance · carte rare |
| Vente en ligne | 4 | Le bouche-à-oreille | 5 clients fidèles actuels | 300 € de jeu |
| Vente en ligne | 5 | Une adresse reconnue | 10 clients fidèles actuels | Pack de 3 cartes |
| Vente en ligne | 6 | Toujours dans l’air du temps | Duo aromatique et client satisfait sur 3 périodes distinctes | Pack de 10 cartes |
| Boutiques | 1 | Ta première boutique | 1 boutique partenaire actuelle | 100 € de jeu |
| Boutiques | 2 | Une carte qui donne envie | Fleurs de 3 Buddies différents vendues aux CBD shops | 200 € de jeu |
| Boutiques | 3 | Un réseau local | 3 boutiques partenaires actuelles | 350 € de jeu |
| Boutiques | 4 | Le fournisseur de confiance | 100 g de fleurs livrés avec une note après conservation ≥ 8/10 | Gros molosse · carte rare |
| Boutiques | 5 | La tournée du chanvrier | 6 boutiques partenaires actuelles | Pack de 3 cartes |
| Boutiques | 6 | La référence des boutiques | 500 g de fleurs livrés avec une note après conservation ≥ 8/10 | Pack de 10 cartes |

Les récompenses sont permanentes et attribuées une seule fois : argent dans la
caisse du jeu, exemplaire garanti de la carte rare indiquée, ou pack La Botte du
Chanvrier de 3 ou 10 cartes. Les anciens packs déjà obtenus restent acquis, ouverts
ou non ; une mission déjà réclamée ne verse pas une seconde récompense après la
mise à jour. Un ancien compte doit néanmoins terminer les nouvelles étapes qui
précèdent ses prochains objectifs.

Les récoltes officielles, transformations terminées et ventes conservées dans
l’historique alimentent les objectifs. Les quantités vendues aux boutiques
s’additionnent sans multiplier la diversité lorsqu’un lot est fractionné. Un lot
entièrement vendu ou retiré avant la fin du curing ne valide pas un affinage ; les
ventes ultérieures n’effacent pas celui qui a été terminé. La Qualité de récolte
et la note du jury sur 10 sont deux mesures différentes.

Le barème du 18 octobre s’applique aux nouvelles cultures. Les anciennes fleurs
et les cultures déjà lancées gardent leurs qualifications aux seuils 6 / 10 / 14.
Elles continuent donc de compter dans les missions, même si la récompense reste à
récupérer. Le nouveau palier Fleur exceptionnelle commence à 20 points ; il ne
valide pas les missions légendaires. Les critiques sont incluses dans les quatre
étapes réussies nécessaires. Cette transition est portée par la migration
`20261018000900_kq_harvest_tiers_v2.sql`, à appliquer avant le code correspondant.

Les deux missions aromatiques commencent à compter à l’installation de la
migration : les anciens reçus ne prouvent pas les arômes, la qualité et le quota
disponibles au moment de leur vente. Chaque nouveau reçu conserve la demande
réellement satisfaite. Le dernier objectif en ligne exige trois périodes de
demande différentes de 72 heures, chacune avec un client satisfait. La clientèle
nette et les frais automatiques sont actualisés avant toute nouvelle attribution.

Les migrations `20261015000200_kq_mission_aroma_evidence.sql` et
`20261015000300_kq_mission_journey.sql` ont été appliquées le 15 octobre 2026 au
projet Supabase lié `eyowwwpdmfrulhkpvlnf`, à la demande de l’utilisateur. Un lot
isolé dans `output/mission-journey-migration/deploy` a permis de prévisualiser puis
d’appliquer uniquement ces deux migrations ; les cinq autres migrations en
attente ont été exclues du lot. La prévisualisation suivante confirme que ce lot
est entièrement appliqué.

La vérification distante en lecture seule confirme les 30 missions dans cinq
parcours de six étapes, les 13 récompenses d’argent, 8 cartes rares et 9 packs,
ainsi que la conservation des 20 packs historiques avec leurs identifiants et
dates. Les sept cartes rares proposées sont actives. Les reçus restent privés
et les deux RPC de missions restent réservées au rôle serveur. Le calcul des
indicateurs est matérialisé une seule fois par lecture des trente objectifs.
Aucune récompense ni opération commerciale n’a été déclenchée pour ces
vérifications. Ce déploiement concerne la base ; il ne publie pas l’interface.
Reçus : `output/mission-journey-migration/application.json` et `verification.json`.

Vérifications locales de cette révision :

- `node scripts/test-placard-mission-journey.mjs` : 122 contrôles PostgreSQL,
  catalogue TypeScript/SQL identique, trente attributions, anciens reçus,
  comptabilité, reprises, disponibilité des cartes, permissions et plan de requête.
- `node scripts/test-placard-mission-evidence.mjs` : 34 contrôles des ventes aromatiques,
  périodes distinctes et indicateurs issus des actions réellement réalisées.
- `npm.cmd run check:supabase-grants` : décision explicite de permissions pour
  les tables des 314 migrations.
- TypeScript (`npx.cmd tsc --noEmit`), ESLint des fichiers modifiés et 38 tests
  Vitest : réussis. Le script SQL du catalogue historique reste également valide.
- Audit de l’interface réelle à 320, 390, 768 et 1440 px : réussi.

## Historique — version déployée le 13 septembre 2026

La section suivante décrit le précédent catalogue de neuf missions et ses
vérifications de déploiement ; elle ne décrit pas la révision du 15 octobre.

La migration `20260913000500_kq_mission_center.sql` a été appliquée au projet
Supabase lié le 13 septembre 2026, après autorisation explicite de l’utilisateur.
Le dry-run puis l’application dans un espace isolé ont porté uniquement sur cette
migration ; la migration d’arène `20260912000100` déjà en attente reste exclue.
La vérification distante en lecture seule de `rpc_kq_mission_state`, avec un
identifiant vide, renvoie HTTP 200, neuf missions sans progression et une collection
La Botte active. Aucun pack n’a été attribué pendant cette vérification.

### Parcours et récompenses historiques

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

### Accès et validation historiques

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

### Vérifications historiques

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
