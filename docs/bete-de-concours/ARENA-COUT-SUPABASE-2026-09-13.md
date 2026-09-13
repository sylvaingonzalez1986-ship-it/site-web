# Coût Supabase de l’Arène — audit du 13 septembre 2026

## Conclusion

Le stockage actuel est faible. Les rafraîchissements réseau et les recalculs partagés sont les principaux points à optimiser avant une hausse de fréquentation. Le forfait et la consommation facturée du mois n’ont pas été confirmés : cet audit ne garantit donc pas que l’abonnement actuel suffira.

Avec Pro, les hypothèses ci-dessous restent dans le quota de transfert pour 100 à 500 joueurs actifs par jour. À 1 000 joueurs quotidiens, le résultat dépend fortement du temps passé en file de duel, du nombre de visites au marché, des images et du trafic du reste du site. Cela ne constitue pas une validation de capacité CPU ou de concurrence.

## Ce qui a été mesuré

Lectures limitées du projet Supabase lié : statistiques PostgreSQL, tailles des tables et échantillons de réponses JSON. Aucun test de charge, achat, nettoyage, changement de forfait ou modification de données. Les fichiers locaux de mesure sont dans `output/arena-cost-audit/`. Le fichier `payloads.json` ne contient que des agrégats, aucun identifiant de joueur ni état de partie.

| Mesure | Résultat |
| --- | ---: |
| Base PostgreSQL entière, taille rapportée par l’outil | 78 MB |
| Tables et index `kq_*`, `contest_*`, `arena_*` | environ 5,48 MiB |
| Journal global `audit_logs`, index compris | environ 37 MB |
| `security_rate_limits`, index compris | environ 4,6 MiB |
| `analytics_events`, index compris | environ 4,45 MiB |
| Cultures `kq_runs`, index compris | 448 kB, environ 61 lignes |
| Lots `kq_market_lots`, index compris | 480 kB, environ 53 lignes |

Les nombres de lignes proviennent des estimations PostgreSQL. La taille de base n’est pas la taille totale du disque provisionné, du stockage de fichiers ou de la facture : l’outil indique notamment 96 MB de WAL séparément. Les statistiques de requêtes sont cumulatives et ne doivent pas être assimilées au trafic du mois.

Échantillons JSON non compressés, mesurés sur 8 à 40 lignes selon la table :

| Donnée | Taille moyenne par ligne | Échantillon |
| --- | ---: | ---: |
| État d’une culture | 3 042 octets | 30 |
| Fleur, champs de l’API | 575 octets | 40 |
| Combat contre un bot | 1 279 octets | 30 |
| Combat humain | 1 048 octets | 8 |
| Lot avec ses options commerciales | 6 709 octets | 40 |

Ces tailles servent à estimer les ordres de grandeur. Elles ne remplacent pas les compteurs d’egress facturés : compression, en-têtes, authentification, caches et requêtes supplémentaires influencent le total.

## Les postes à surveiller dans le code

### 1. Récompenses et classement : du calcul et des écritures lors des consultations

`src/components/contest/ContestHubClient.tsx` rafraîchit le pot toutes les 60 secondes lorsque la page est visible, et lors du retour sur la fenêtre. `getArenaCustomerRewardPool` appelle `rpc_arena_refresh_customer_reward_pool`, qui agrège les ventes et actualise les semaines provisoires. Lorsque la saison est active, il demande aussi le classement.

`getKqArenaLeaderboardInternal` appelle `rpc_kq_refresh_daily_leaderboard`. Malgré son nom, la définition dans `20260906000400_kq_placard_composite_score.sql` recalcule le classement et met à jour le snapshot à chaque appel, avec un verrou commun à la saison. La réponse est limitée aux 100 premiers, mais le classement parcourt les candidats de la saison. Plusieurs visiteurs simultanés peuvent donc répéter les mêmes calculs et se gêner sur les écritures.

Priorité : séparer le calcul commun de sa consultation ; mutualiser un résultat pendant 30 à 60 secondes et invalider lors des événements utiles. Garder les données personnelles et les droits dans leur périmètre propre. Cela vise d’abord la latence et le CPU, puis le trafic.

### 2. File de duel : trois appels toutes les 12 secondes

`src/components/placard/KanabQuestDicePrototype.tsx` appelle le rapprochement de la file, les fleurs et les combats à chaque passage du minuteur. Soit environ 15 requêtes applicatives par minute, 900 par heure d’attente, plus le premier rafraîchissement. Chaque requête applicative peut déclencher plusieurs lectures et contrôles dans Supabase.

La route publique des combats utilise une limite de 12 par type avant fusion ; les fleurs sont limitées à 40. On ne recharge donc pas un historique infini, mais des données inchangées sont relues à chaque passage. Avec un historique rempli, les tailles échantillonnées donnent environ 60 à 80 ko de données de jeu brutes par passage en comptant les fleurs associées aux combats, hors authentification et autres traitements. Vingt minutes d’attente peuvent ainsi approcher 6 à 8 Mo rien que pour ces relectures.

Le minuteur de cette file n’a pas de garde `document.hidden` ni de verrou contre les rafraîchissements qui se chevauchent. La limitation des minuteurs par le navigateur ne doit pas servir de stratégie de coût.

Priorité : interroger seulement l’état du duel en attente ; recharger les listes une fois le résultat modifié ; suspendre les lectures lorsque l’onglet est caché ; espacer progressivement les vérifications en cas d’attente longue. Ne pas remplacer automatiquement le mécanisme par Realtime sans en mesurer le bénéfice.

### 3. Marché : lecture d’états et d’options volumineuses

`src/lib/supabase/kanab-quest-market-backend.ts` charge jusqu’à 40 fleurs passées au jury, leurs états de culture, leurs combats, l’équipement, l’énergie et les lots. Les options stockées des lots représentent la partie la plus grosse de l’échantillon : environ 268 ko pour 40 lots, avant d’ajouter les cultures et autres données. Une visite au marché peut donc transférer plusieurs centaines de ko depuis la base.

Priorité : liste compacte des lots prêts à vendre, détail et offres chargés pour le lot sélectionné, historique paginé. Conserver côté serveur les vérifications de prix, de propriété et de solde.

### 4. Images : distinguer le site et Supabase

Les scènes de l’Arène, le décor de l’entrepôt et les illustrations du matériel sont dans `public/`. Leur diffusion relève de l’hébergeur du site, pas de Supabase Storage. Les trois PNG de l’accueil représentent environ 5,48 Mo de fichiers source au total ; ce n’est pas leur poids réseau optimisé en production.

Certaines cartes ont néanmoins une URL Supabase : l’échantillon du catalogue de cartes contient 52 URL Supabase, et celui des Héritages en contient 6. Ces décomptes incluent le catalogue interrogé, pas uniquement les cartes actives affichées dans chaque écran. La collection La Botte utilise aussi des illustrations locales. Les écrans qui affichent une carte depuis son URL utilisent `next/image` ; les optimisations et caches réduisent les téléchargements répétés, mais une récupération de l’original depuis Supabase compte encore comme une sortie de Supabase.

### 5. Conservation des données

Le journal global, à environ 37 MB, occupe beaucoup plus de place que le jeu actuellement. Aucune purge automatique de ce journal n’a été repérée dans les chemins inspectés. Prévoir une politique de conservation adaptée aux besoins de support et de sécurité, et une expiration des anciennes fenêtres de limitation. Ne pas supprimer les reçus d’achat ou de vente utiles à l’intégrité du jeu.

Les cultures, fleurs, combats et reçus continuent à s’accumuler au fil du jeu, même si leur affichage est limité. Leur évolution devra être suivie mensuellement.

## Points favorables

- Les gros décors sont locaux au site.
- Les listes de fleurs et de combats sont bornées.
- Le chargement initial du Placard est regroupé dans un endpoint bootstrap et un snapshot SQL principal.
- Les définitions communes des cartes sont mises en cache 60 secondes en mémoire côté serveur. Ce cache dépend de l’instance et n’est pas nécessairement partagé entre tous les serveurs.
- Aucun abonnement Supabase Realtime n’a été repéré dans les composants et hooks de ce parcours.
- Le minuteur des défis quotidiens du Placard recalcule une valeur locale : ce n’est pas un appel Supabase.

## Tarifs et protections vérifiés

Au 13 septembre 2026, Supabase affiche Free avec 500 MB de base, 1 GB de fichiers, 5 GB de trafic non mis en cache et 5 GB mis en cache. Pro commence à 25 USD/mois, inclut 8 GB de disque par projet, 100 GB de fichiers, 250 GB de trafic non mis en cache, 250 GB mis en cache et 100 000 utilisateurs actifs mensuels. Les requêtes API ne sont pas facturées individuellement. Le prix final dépend aussi du compute, des projets et des options. [Tarifs Supabase](https://supabase.com/pricing).

Hors quota, le trafic coûte 0,09 USD/GB non mis en cache et 0,03 USD/GB mis en cache. Ces quotas sont distincts ; on ne peut pas traiter les 250 + 250 GB comme 500 GB disponibles pour les seules réponses de base de données. Le trafic Supabase → serveur Next.js est également du trafic sortant facturable. Les quotas de transfert sont partagés au niveau de l’organisation : boutique, autres pages et projets peuvent en consommer. [Egress Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [facturation](https://supabase.com/docs/guides/platform/billing-on-supabase).

Le **Spend Cap** du forfait Pro protège plusieurs postes variables, dont le trafic. Il est activé par défaut, mais son état réel sur cette organisation n’a pas été vérifié. Le conserver activé évite la facturation de dépassement des postes couverts, au prix de restrictions possibles après dépassement. Ce n’est pas un plafond absolu de facture : compute, projets et plusieurs options en sont exclus. Il ne permet pas de fixer un budget personnalisé par poste. [Contrôle des coûts](https://supabase.com/docs/guides/platform/cost-control).

## Simulation mensuelle — hypothèses, pas consommation observée

Deux budgets de planification pour le trafic de données de jeu : 2 Mo par joueur actif et par jour, puis 10 Mo avec davantage de relectures et d’attente en duel. Trente jours d’activité. Images distantes, reste du site, autres projets et coûts de calcul sont exclus. Plusieurs sessions ou une attente plus longue peuvent dépasser ces hypothèses.

| Joueurs actifs par jour | À 2 Mo/jour | À 10 Mo/jour | Supplément de trafic Pro à 10 Mo/jour, si Spend Cap désactivé |
| --- | ---: | ---: | ---: |
| 100 | 6 Go/mois | 30 Go/mois | 0 USD |
| 500 | 30 Go/mois | 150 Go/mois | 0 USD |
| 1 000 | 60 Go/mois | 300 Go/mois | 4,50 USD |
| 5 000 | 300 Go/mois | 1 500 Go/mois | 112,50 USD |

Formule : `joueurs quotidiens × Mo/jour × 30 / 1 000`. Supplément : `max(Go − 250, 0) × 0,09 USD`. Cette simulation suppose que l’intégralité des 250 Go reste disponible pour l’Arène, ce qui peut être faux pour un site partagé. Les tarifs restent en USD, monnaie publiée par Supabase, sans conversion ou taxes supposées.

## Décision conseillée

Ne pas augmenter le serveur par précaution sur la seule base du volume actuel. D’abord confirmer le forfait, le compute, le Spend Cap et les compteurs du cycle en cours ; corriger les relectures de duels et mutualiser récompenses/classement ; puis mesurer une semaine représentative.

Les données encore nécessaires pour confirmer le budget sont : abonnement exact, consommation du mois par service, coût du compute et options, joueurs actifs quotidiens attendus, pics simultanés, nombre de cultures et durée des sessions. Les statistiques de base accessibles pendant cet audit ne fournissent pas ces informations de facturation. Aucun réglage ni code de gameplay n’a été modifié pour cet audit.
