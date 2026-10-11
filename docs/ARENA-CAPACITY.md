# Validation de capacité de l'Arène

## Optimisations du budget Supabase — 11 octobre 2026

Objectif : rester sur l'abonnement Pro à 25 USD/mois en réduisant les calculs
répétés et les données transférées. Les cinq migrations ci-dessous ont été
appliquées au projet Supabase lié le 11 octobre 2026 à la demande de l'utilisateur ;
le déploiement du code de l'application reste à effectuer.
La consommation et la configuration de facturation du compte n'ont pas été consultées.

| Poste | Changement | Résultat ou limite |
| --- | --- | --- |
| Entrée dans le Placard | Réutilisation de la session du bootstrap et suppression du chargement concurrent du classement | Dans le navigateur : 4 appels classement/progression deviennent 1 ; le bootstrap reste nécessaire |
| Classements Placard et Arène | Instantanés SQL partagés pendant 60 secondes, verrou et seconde vérification avant recalcul | Les requêtes de plusieurs serveurs partagent le résultat ; les clôtures de récompenses forcent un calcul frais |
| Stockage du joueur | Réponse SQL limitée aux lots actifs ; rafraîchissement toutes les 120 secondes, à échéance ou au retour dans l'onglet | 30 lectures périodiques/heure au lieu de 120, hors échéances, actions et retours dans l'onglet |
| Collections et Héritages | Comptages SQL, lecture commune cartes/Buddies, historique des tirages omis dans le bootstrap | Évite le transfert de chaque exemplaire et les comptages tronqués à 1 000 lignes ; historique conservé pour l'administration |
| File de duels | Lecture légère ; tentative de réparation au plus toutes les deux minutes si un autre joueur attend | L'inscription conserve sa tentative de match immédiate ; le limiteur de requêtes reste actif |
| Récompenses de commandes | Vérification de rattrapage toutes les cinq minutes par joueur et par catégorie | Les déclencheurs de paiement restent immédiats ; une commande invitée rattachée ensuite peut attendre jusqu'à cinq minutes avant le prochain rattrapage |

Les classements publics peuvent cumuler le cache SQL de 60 secondes et le cache
de route de 30 secondes. Si le bootstrap n'a aucun horodatage utilisable, ou si
son classement dépasse 90 secondes, le client relit une fois la progression
après le classement. Les soldes personnels restent issus des transactions.
Le classement Arène sélectionne désormais le top 100 après le calcul du score
complet de tous les candidats, sans présélection incorrecte par rating.

Les réparations de récompenses cash et assortiment utilisent deux transactions
distinctes pour respecter l'ordre des verrous des paiements. Une catégorie en
échec est retentée indépendamment ; sa date de réussite n'est pas avancée.

### Mesures locales reproductibles

- Audit Chromium avec le vrai composant joueur et le vrai tableau de saison,
  API simulées et réseau externe bloqué : entrée normale, session absente,
  session dégradée et classement périmé. Aucun appel supplémentaire après cinq
  nouveaux rendus. Le cas périmé corrige le rang de 84 à 7 avec une seule lecture
  `/me`, sans nouvelle lecture `/session`.
- Stockage SQL : 100 lots archivés et un actif produisent une réponse de
  77 803 octets avant filtrage et de 1 263 octets après, soit environ 98,4 % de
  moins sur ce jeu de données. Les lots historiques ne sont pas supprimés.
- Collections SQL : scénarios dépassant 1 000 exemplaires et commandes pour
  vérifier les totaux indépendamment de la limite de réponse PostgREST.
- Classements SQL : clés de saison réelles de type `TEXT`, expiration du cache,
  rafraîchissement forcé, score, top 100 et permissions vérifiés.

Ces mesures ne sont ni un test de charge de production ni une estimation de
facture. Une réduction d'appels HTTP ne correspond pas directement à une même
réduction en dollars : les requêtes API sont incluses dans le forfait et le gain
vise surtout le calcul et le transfert. [Tarification Supabase](https://supabase.com/pricing).

```powershell
npx.cmd vitest run arena kanab-quest --maxWorkers=2
node scripts/test-arena-ranking-budget.mjs
node scripts/test-placard-storage-capacity.mjs
node scripts/test-placard-collections.mjs
node scripts/audit-arena-budget.mjs
npm.cmd run check:supabase-grants
```

Le rapport navigateur est écrit dans `output/arena-budget/report.json`.
La commande TypeScript globale inclut actuellement des validateurs Next archivés
sous `output/css-hmr-fix`, dont les imports relatifs sont cassés. La vérification
des sources avec `output` exclu réussit ; ce défaut de périmètre existant n'a pas
été modifié par les optimisations.

### Mise en service

Les cinq migrations `20261011000100` à `20261011000500` ont été appliquées dans
l'ordre au projet lié `eyowwwpdmfrulhkpvlnf`, dont la référence correspond à
la configuration de l'application. Elles sont nécessaires au nouveau backend.
Pour une nouvelle base, les appliquer avant de déployer la nouvelle application.

La prévisualisation initiale a trouvé une autre migration locale en attente,
`20261010000500_botte_situations_epic.sql`, indépendante de ce lot. Une copie
isolée de l'historique sous `output/arena-budget-migration/deploy` a permis
d'appliquer uniquement les cinq migrations de performance, sans modifier cet
autre travail. Chaque migration limite l'attente de verrou à cinq secondes et
la durée d'une instruction à 120 secondes.

Vérifications effectuées : 62 contrôles préalables du catalogue distant,
25 contrôles après application (historique, fonctions, index, colonne de file,
permissions et RLS), puis prévisualisation du lot isolé sans migration restante.
La Data API expose les sept RPC attendus ; les deux nouvelles tables internes
refusent l'accès direct à `service_role` (HTTP 403), tandis que la lecture vide
du snapshot autorisé réussit (HTTP 200). Aucun RPC de jeu n'a été invoqué et
aucune donnée joueur n'a été récupérée pour ces vérifications.

Les reçus se trouvent dans `output/arena-budget-migration/application.json`,
`postflight.json`, `dry-run-after.json` et `api-verification.json`.
La dernière vérification API a réussi le 11 octobre 2026 à 08:16 UTC.

Les nouvelles tables internes sont inaccessibles aux rôles Data API ; seuls les
RPC nommés autorisent `service_role`. L'ancien RPC de stockage conserve les lots
historiques nécessaires au marché. En cas de retour à l'ancienne application,
conserver les migrations additives et surveiller le retour des lectures et
recalculs plus coûteux.

Après déploiement, vérifier une entrée joueur, une culture reprise, une vente,
une file de duel et les classements. Comparer ensuite, sur 24 heures puis sept
jours, les octets transférés, les temps de réponse et la charge PostgreSQL à
trafic comparable. Les seuils de capacité ci-dessous restent à mesurer sur une
préproduction représentative.

### Vérifications pour l'objectif de 25 USD

Le Pro commence à 25 USD et son crédit de calcul couvre une instance Micro.
Contrôler que le compte ne contient qu'un projet facturé dans cette configuration,
sans option payante supplémentaire. Le forfait inclut notamment 8 Go de disque,
100 Go de fichiers et 250 Go de transfert non caché ; le transfert caché dispose
d'un quota distinct de 250 Go. [Tarification Supabase](https://supabase.com/pricing).

Vérifier **Billing → Cost Control → Spend Cap**, ainsi que **Upcoming Invoice**.
Le Spend Cap limite certains dépassements d'usage, mais ne plafonne pas le calcul,
les projets supplémentaires ni toutes les options. Il peut restreindre le service
quand les quotas sont dépassés. Il ne fournit pas d'alertes personnalisées à un
montant choisi. [Contrôle des coûts Supabase](https://supabase.com/docs/guides/platform/cost-control).

Consulter l'usage chaque semaine, quotidiennement pendant un lancement :

| Indicateur | Seuil de surveillance proposé | Intervention proposée |
| --- | --- | --- |
| Transfert non caché projeté sur le cycle | 175 Go (70 %) | À 200 Go (80 %), identifier les réponses dominantes avant le quota de 250 Go |
| Disque occupé | 5,6 Go | À 6,4 Go, examiner croissance des tables et index avant toute augmentation payante |
| Fichiers stockés | 70 Go | À 80 Go, vérifier tailles et doublons avant de nouveaux imports |
| Facture prévisionnelle | Supérieure au tarif de base | Identifier l'option ou le poste facturé ; ne pas augmenter automatiquement le calcul |

Pour un transfert cumulé, projeter `consommation / jours écoulés × jours du cycle`
et comparer aussi les pics récents. Ces seuils sont des consignes de suivi : aucune
alerte automatique ni bascule automatique d'un mode économie n'est installée.
Sans les valeurs réelles d'usage, le nombre de projets et les options actives,
le respect effectif des 25 USD ne peut pas être confirmé.

## Pré-requis

Le test doit viser une préproduction disposant d'un jeu de données représentatif. Ne pas le lancer contre la production sans fenêtre de test et supervision Supabase/Sentry.

## Exécution

```powershell
$env:LOAD_TEST_BASE_URL="https://preproduction.example.com"
$env:LOAD_TEST_PARTICIPANTS="500"
$env:LOAD_TEST_RAMP_MS="120000"
$env:LOAD_TEST_TIMEOUT_MS="10000"
npm.cmd run load-test:arena
```

Chaque participant consulte successivement la page de l'Arène et quatre API publiques. Le processus retourne un code d'échec si le taux d'erreur dépasse 1 % ou si la latence p95 dépasse 2,5 secondes.

## Paliers recommandés

1. 25 participants sur 30 secondes pour vérifier la configuration.
2. 100 participants sur 60 secondes pour établir la référence.
3. 500 participants sur 120 secondes pour la validation nominale.
4. 500 participants avec une rampe nulle pour mesurer un pic, uniquement après réussite du palier nominal.

Pendant le test, relever la latence et les erreurs Vercel, les connexions et requêtes lentes Supabase, ainsi que les erreurs Sentry. Une réussite HTTP ne suffit pas : vérifier aussi qu'aucun avis, vote, point ou badge n'a été dupliqué.

## Critères d'acceptation

- moins de 1 % d'erreurs ;
- p95 inférieur à 2,5 secondes pour le scénario complet ;
- aucune saturation durable des connexions PostgreSQL ;
- aucun doublon ou enregistrement partiel ;
- retour aux latences normales en moins d'une minute après le pic.
