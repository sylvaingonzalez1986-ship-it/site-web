# Bureau du Placard — banque, prêts et crypto

Le bureau regroupe **Comptabilité**, **Banque** et **Gestion**, en conservant les fonctions existantes. Les factures, le bilan, le journal et le plan comptable se trouvent en Comptabilité ; le site, la publicité et la domiciliation restent en Gestion. La Banque propose le banquier, le livret existant du Trésorier et le comptoir crypto.

## Prêts de jeu

Le premier prêt nécessite 200 points de réputation et une première culture terminée depuis au moins 24 heures réelles. Le banquier explique le refus, l’attente, l’offre ou le prêt en cours. Les plafonds sont de 5 000 / 25 000 / 100 000 / 250 000 € pour 200 / 600 / 1 500 / 3 000 points ; les trois derniers paliers réduisent le taux de 0,5 / 1 / 1,5 point.

Chaque journée UTC reçoit un scénario aléatoire persistant et commun à tous les joueurs : confiance, concurrence, stabilité, inflation ou tension. Le taux de base évolue dans une plage de 1,5 à 14 %, avec un taux proposé plancher de 1 % après réduction. Actualiser ne retire pas un nouveau scénario. La création a lieu à la première consultation de la journée, sans tâche cron.

Le pourcentage représente **le coût total des sept échéances sur 210 jours de jeu (35 jours réels)**, pas un taux annuel. La signature fige les conditions et montre le capital, les intérêts arrondis au centime supérieur, le total et les sept échéances. Un seul contrat reste ouvert à la fois. Le remboursement anticipé conserve les intérêts convenus, sans frais supplémentaires.

Les échéances sont espacées de **30 jours de jeu, soit 120 heures réelles (5 jours)**. La première intervient 30 jours de jeu après la signature, puis les suivantes à J+60, J+90, jusqu’à J+210. Les consultations et opérations de l’économie rattrapent les échéances dues via `kq_business_settle`, y compris hors de la Banque. Aucun débit hors ligne par cron : le rattrapage intervient au retour du joueur. Les paiements sont plafonnés aux fonds disponibles ; les retards restent dus et empêchent un nouveau contrat. Les requêtes sont persistantes et idempotentes.

La migration `20260924000100_kq_bank_monthly_installments.sql` applique ce calendrier aux nouveaux prêts et aux prêts encore ouverts, depuis leur date de signature. Les montants, intérêts et paiements déjà enregistrés sont conservés. Les prêts soldés avant cette migration gardent leur échéancier historique quotidien. L’intervalle est enregistré par contrat et calculé en heures réelles pour rester exact lors des changements d’heure. Le champ API `offer.termDays` exprime la durée totale en jours réels : 35.

Migration appliquée le 24 septembre 2026 à la base Supabase liée, à la demande de l’utilisateur, avec `supabase db push --linked --yes`. Le projet lié correspond à la configuration de l’application et seule cette migration était en attente. L’application a réussi ; le dry-run suivant confirme que la base est à jour. Cette opération déploie le calendrier côté base ; elle ne publie pas le code de l’interface.

## Crypto aux cours CoinMarketCap

Portefeuille exclusivement virtuel, financé avec les euros du jeu. Les 100 premières cryptomonnaies par capitalisation sont obtenues en EUR via les endpoints officiels v3 `listings/latest` et `quotes/latest`. Recherche, pagination, positions, gains/pertes latents et historique rendent le marché consultable sans afficher 100 lignes à la fois.

Le serveur emploie par défaut l’[API publique officielle sans clé](https://coinmarketcap.com/api/documentation/pro-api-reference/keyless-public-api). Le fonctionnement du comptoir ne nécessite aucune clé CoinMarketCap. Les limites et la disponibilité du fournisseur s’appliquent ; le correctif préparé le 24 septembre organise les reprises automatiques décrites ci-dessous. Son application en production reste en attente.

Une réservation PostgreSQL de **60 secondes**, commune à toutes les instances, protège l’actualisation du top 100 et des actifs détenus sortis du classement, jusqu’à 250 en rotation. La lecture du top 100 peut retenter les erreurs temporaires dans une durée totale maximale de **18 secondes**. Après publication, le cache est partagé pendant cinq minutes au maximum ; l’âge réel des cours peut avancer la prochaine tentative pour éviter d’attendre leur expiration. Après des échecs successifs, le délai partagé passe à **60, 120, 240 puis 300 secondes**. Un délai `Retry-After` plus long indiqué par le fournisseur est respecté, y compris lorsqu’une demande d’actifs hors classement échoue après une lecture réussie du top 100.

Un actif périmé ne bloque plus les autres cours valides du top 100. Une publication exige toujours 100 identifiants et rangs distincts, des données valides et au moins un cours récent ; une réponse entièrement périmée ou comportant un horodatage trop futur est refusée. Un cours plus ancien ne remplace jamais un cours plus récent déjà en cache. Aucun prix de remplacement n’est fabriqué : un cours âgé de dix minutes suspend les nouveaux ordres sur cet actif, dont la position reste visible. Un actif sorti du top 100 peut être vendu avec un cours récent, mais plus acheté.

Le navigateur programme ses reprises entre **5 et 60 secondes** selon l’état du rafraîchissement, puis au retour sur l’onglet, hors fenêtre de transaction ouverte. Ces lectures ne contournent pas le délai partagé du fournisseur. La RPC privée `rpc_kq_crypto_refresh_status`, accessible seulement à `service_role`, permet de connaître la prochaine tentative, les dernières tentative et réussite, le nombre de cours récents et le motif filtré du dernier échec. Elle ne réserve aucun rafraîchissement et ne retourne ni identité de réservation ni donnée joueur.

L’aperçu crée une offre serveur valable au maximum 60 secondes. La confirmation emploie cette offre, jamais un prix fourni par le navigateur. Un ordre déjà exécuté renvoie son reçu même après expiration, sans second débit. Montant, quantité, fonds, propriétaire et limites sont vérifiés dans la même transaction que la mutation du portefeuille. Les quantités utilisent des décimales exactes côté SQL ; une vente partielle répartit le coût d’acquisition, la dernière vente solde le reliquat.

## Comptabilité et permissions

Le plan passe à **33 comptes** : dette bancaire, intérêts d’emprunt, cryptoactifs au coût d’acquisition, gains réalisés et pertes réalisées. Le capital emprunté n’est pas un produit ; l’achat crypto n’est pas une charge. La variation du cours ne modifie pas le résultat tant que l’actif n’est pas vendu. Les écritures et le portefeuille sont atomiques ; le bilan rapproche la dette et les positions avec leurs sources.

Les nouvelles tables ont RLS activée et révoquent explicitement tous les droits de `PUBLIC`, `anon`, `authenticated` et `service_role`. Seules les RPC nommées nécessaires sont exécutables par `service_role`. Les routes utilisent le joueur de la session et des réponses privées sans cache ; leurs POST vérifient l’origine, limitent le corps et le rythme des appels.

Migrations appliquées sur la base Supabase liée le 23 septembre 2026 :

- `20260923000300_kq_bank_loans.sql`
- `20260923000400_kq_crypto_portfolio.sql`
- `20260923000500_kq_banking_accounting.sql`

Application distante effectuée à la demande de l’utilisateur avec `supabase db push --linked --yes`. Les trois migrations ont réussi. Le dry-run suivant indique que la base est à jour. Les cinq RPC attendues et leurs paramètres sont présents ; les cinq tables comptables historiques sont accessibles en lecture contrôlée, et les huit nouvelles tables privées refusent l’accès direct de `service_role` (HTTP 403, code 42501). Le schéma OpenAPI peut néanmoins les décrire : cette présence documentaire ne leur accorde pas de privilège. Aucun compte joueur ni RPC financière n’a été utilisé pour ces vérifications. Rapport : `output/placard-banking-migration/verification.json`. Ce déploiement concerne la base ; il ne déploie pas le code de l’interface.

## Illustrations

Trois scènes ont été générées avec l’outil intégré `image_gen`, à partir des références de DA existantes :

- `public/placard/bureau-bank-v1.webp` : banquier adulte, cigare, pieds sur le bureau.
- `public/placard/bureau-accounting-v1.webp` : factures et registre.
- `public/placard/bureau-management-v1.webp` : boutique, publicité et adresse.

Prompts et provenance : `bureau-art-prompts-2026-09-23.json`. L’interface utilise `next/image` et une scène différente par pôle.

## Vérification locale

```powershell
node scripts/test-placard-bank.mjs
node scripts/test-placard-crypto.mjs
node scripts/test-placard-treasury.mjs
node scripts/audit-placard-treasury.mjs
node scripts/audit-placard-business.mjs
npm.cmd run check:supabase-grants
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Les tests PostgreSQL sont isolés, sans identifiants ni écritures distantes. Le test de trésorerie exerce les migrations réelles et vérifie l’équilibre, les rapprochements, les rejouements et l’absence de mouvements non classés pour prêts et crypto. Les audits navigateur utilisent des réponses simulées ; ils ne remplacent pas un parcours connecté après déploiement.

Le contrôle en lecture seule `node scripts/check-coinmarketcap-live.mjs` a confirmé les réponses réelles via le parseur de production : 100 actifs EUR et les cours par identifiant, avec l’API publique sans clé. Les audits navigateur ont réussi sur 320, 390, 768 et 1 280 px, sans débordement ni erreur JavaScript ; les captures et le rapport sont dans `output/placard-treasury/`. Les parcours de gestion existants ont également réussi sur 320, 390 et 1 280 px.

Résultats de validation du 23 septembre : 109 tests Vitest sur la finance existante et la comptabilité enrichie, 27 tests banque, 38 tests crypto ; 13 groupes PostgreSQL sur la trésorerie complète, 8 sur les prêts et 12 sur les cryptos. TypeScript sans émission, ESLint ciblé et vérification des permissions des 240 migrations passent. Les scénarios d’accès concurrent sont soumis au verrou du portefeuille et à l’index unique de prêt actif ; PGlite sérialise son transport et ne constitue pas une mesure de charge concurrente d’un serveur PostgreSQL distant.

## Lisibilité et fenêtre de transaction

Le comptoir crypto présente désormais les cours sur fond crème, avec des lignes alternées claires, des prix renforcés, des repères par actif et des boutons d’achat pleins. Les offres bancaires et factures reprennent les surfaces papier de la DA pour distinguer les informations du décor vert.

Acheter ou vendre ouvre une fenêtre native centrée au-dessus du bureau, sans déplacer la page vers le bas. La saisie, l’offre, les erreurs et la nouvelle tentative restent dans cette fenêtre. L’arrière-plan est inerte et son défilement bloqué ; Échap, la croix et Annuler ferment la fenêtre hors requête en cours. Le focus est contenu dans la fenêtre puis revient au déclencheur, ou à l’onglet des positions si la vente a supprimé la dernière position. Les contrats et règles de calcul sont inchangés.


## Reprise des cours et logos

Le 23 septembre, les boutons étaient grisés parce que les cours du cache avaient expiré. Le contrôle direct du fournisseur et le parcours complet dans PostgreSQL isolé ont réussi. Une publication de 100 cours réels dans le cache Supabase lié a renvoyé `true` à 18:35:09 UTC (premier cours horodaté 18:33:59 UTC). Après actualisation, l’utilisateur a confirmé que les boutons étaient de nouveau actifs. Aucun ordre ni solde joueur n’a été utilisé pour ce diagnostic distant. La cause du premier échec de rafraîchissement n’était pas journalisée et n’a pas pu être attribuée avec certitude.

La migration `20260923000600_kq_crypto_refresh_recovery.sql`, appliquée le 23 septembre à la base liée, distinguait une publication réussie (cache partagé de cinq minutes) d’un échec (nouvelle tentative après une minute). Le dry-run effectué après cette application confirmait que la base était à jour. Les contrôles de fraîcheur et les permissions étaient conservés. Cette reprise a également ajouté les journaux d’échec de publication et du fournisseur avec des motifs filtrés, sans secrets ni données joueur, ainsi que le rechargement au retour sur l’onglet et l’indication d’une actualisation en cours.

Les logos sont chargés depuis le CDN CoinMarketCap à partir de l’identifiant numérique de chaque actif. Ils sont visibles sur mobile et ordinateur, dans le marché, les positions et la fenêtre d’ordre. Un symbole de secours apparaît si l’image ne charge pas.

Le 24 septembre, un nouveau signalement de cours figés en production a conduit à une publication de 100 cours EUR frais dans le cache lié à 14:51:13 UTC (cours horodatés 14:50:05 UTC). La réservation et la publication ont toutes deux réussi. Aucune opération financière joueur n’a été exécutée ; preuve locale : `output/placard-crypto-recovery.json`. Le diagnostic fournisseur a rencontré une erreur de validation puis une réponse HTTP 429 / code 1022 sur l’accès anonyme ; une requête ultérieure a renvoyé 100 actifs valides. La première erreur du smoke ne distinguait pas encore l’étape top 100 de la cotation individuelle, et ne prouve donc pas que le top 100 était invalide. La cause précise dans le processus de production et la reprise automatique restent à confirmer : cette publication rétablit le cache, sans constituer une correction permanente démontrée. Les diagnostics distinguent désormais les contrôles de validité et le code fournisseur, et le smoke identifie l’étape réussie avant de passer à la suivante.

Validations antérieures : 40 tests Vitest ciblés ; 13 groupes SQL isolés et 14 avec `node scripts/test-placard-crypto.mjs --live-quotes`, qui publiait les 100 vrais cours, validait 100 aperçus puis exécutait un achat/vente uniquement en mémoire ; vérification des permissions sur 241 migrations ; TypeScript et ESLint ciblés. L’audit navigateur couvre les logos, leur repli, les transactions et la reprise après cours périmés aux largeurs 320, 390, 768 et 1280 px.

Le correctif de reprise automatique du 24 septembre comprend la migration `20260924000200_kq_crypto_refresh_resilience.sql` et les adaptations du fournisseur, du serveur et de l’interface décrites plus haut. Il est **préparé et testé, avec application en production encore en attente**. Validation actuelle : **19 groupes PostgreSQL isolés, 29 tests de l’adaptateur fournisseur et 33 tests des types et validateurs crypto**. Les scénarios SQL vérifient notamment 99 cours négociables avec un actif périmé bloqué, la conservation d’un cours stocké plus récent, les délais `Retry-After`, l’absence d’effet d’une ancienne réservation et les permissions du diagnostic privé. La publication manuelle de 14:51 ne constitue pas le déploiement de ce correctif.


## Financement des équipements — base de la saison 1

Les prêts passent de 500 / 2 000 / 5 000 / 10 000 € à **5 000 / 25 000 / 100 000 / 250 000 €**, aux mêmes seuils de réputation (200 / 600 / 1 500 / 3 000). Le catalogue actif comporte notamment le Plasmastatic à 22 800 € : avec les neuf améliorations jusqu’au niveau 10, son coût cumulé atteint 125 400 €. Le financement doit couvrir une installation et sa progression, pas seulement une petite dépense de trésorerie.

Le plafond global des validateurs TypeScript découle du dernier palier. La migration `20260923000700_kq_bank_investment_limits.sql` aligne les contraintes de capital et d’intérêts, les commandes et les plafonds autorisés côté SQL. La migration a été appliquée à la base liée le 23 septembre ; le dry-run suivant confirme qu’elle est à jour. Les contrôles de réputation, d’expérience, de solde, de prêt unique et d’idempotence restent actifs. Les contrats déjà signés gardent leurs montants, taux et échéances.

Le bureau met le plafond personnel en évidence, propose les raccourcis 25 %, 50 % et Maximum, accepte les montants à six chiffres en euros, y compris les espaces de milliers français lors d’un collage et affiche le montant des sept échéances avant signature. Le taux reste un coût total pour toute la durée du contrat. Par exemple, 250 000 € au taux maximal applicable au meilleur palier (12,5 %) représentent 281 250 € à rendre : le joueur voit ce total et les prélèvements avant de signer. Aucune dette n’est créée automatiquement.

### Orientation confirmée pour la saison 2

La saison 1 constitue la base du système économique. La saison 2 doit permettre l’achat de terres à cultiver, l’installation de serres et le light dep (occultation des serres). Ces projets demanderont des financements plus lourds et des durées de remboursement adaptées à leur cycle de revenus. Les prix fonciers, les coûts d’aménagement, les critères de crédit et les échéanciers seront calibrés avec ces nouvelles mécaniques. Le relèvement des plafonds et le calendrier actuel n’activent pas encore les terrains ou les serres ; leur adéquation au foncier reste à définir.


Validation de ces plafonds : 35 tests Vitest ciblés, 10 groupes PostgreSQL Banque, 13 groupes PostgreSQL Trésorerie et contrôle des permissions sur 242 migrations. Le test de migration signe un ancien petit prêt avant d’appliquer les nouveaux plafonds, puis vérifie que le contrat et son reçu sont identiques après migration. Les tests couvrent également chaque seuil de réputation, le centime au-dessus du plafond, le prêt maximal au taux de marché maximal, les remboursements élevés, les répétitions de requêtes et le rapprochement comptable. TypeScript et ESLint ciblés passent.

L’audit navigateur complet passe sur 320, 390, 768 et 1280 px. Le parcours spécifique à 250 000 € passe sur 320 et 1280 px : raccourcis, plafond plus un centime refusé, collage français accepté, calcul des sept échéances, contrat centré, signature simulée et affichage du prêt actif sans débordement. Captures `bank-high-*` et rapport `output/placard-treasury/report.json`.
