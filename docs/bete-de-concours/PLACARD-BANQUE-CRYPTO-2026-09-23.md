# Bureau du Placard — banque, prêts et crypto

Le bureau regroupe **Comptabilité**, **Banque** et **Gestion**, en conservant les fonctions existantes. Les factures, le bilan, le journal et le plan comptable se trouvent en Comptabilité ; le site, la publicité et la domiciliation restent en Gestion. La Banque propose le banquier, le livret existant du Trésorier et le comptoir crypto.

## Prêts de jeu

Le premier prêt nécessite 200 points de réputation et une première culture terminée depuis au moins 24 heures réelles. Le banquier explique le refus, l’attente, l’offre ou le prêt en cours. Les plafonds sont de 500 / 2 000 / 5 000 / 10 000 € pour 200 / 600 / 1 500 / 3 000 points ; les trois derniers paliers réduisent le taux de 0,5 / 1 / 1,5 point.

Chaque journée UTC reçoit un scénario aléatoire persistant et commun à tous les joueurs : confiance, concurrence, stabilité, inflation ou tension. Le taux de base évolue dans une plage de 1,5 à 14 %, avec un taux proposé plancher de 1 % après réduction. Actualiser ne retire pas un nouveau scénario. La création a lieu à la première consultation de la journée, sans tâche cron.

Le pourcentage représente **le coût total des sept jours**, pas un taux annuel. La signature fige les conditions et montre le capital, les intérêts arrondis au centime supérieur, le total et les sept échéances. Un seul contrat reste ouvert à la fois. Le remboursement anticipé conserve les intérêts convenus, sans frais supplémentaires.

Les échéances sont espacées de 24 heures réelles. Les consultations et opérations de l’économie rattrapent les échéances dues via `kq_business_settle`, y compris hors de la Banque. Aucun débit hors ligne par cron : le rattrapage intervient au retour du joueur. Les paiements sont plafonnés aux fonds disponibles ; les retards restent dus et empêchent un nouveau contrat. Les requêtes sont persistantes et idempotentes.

## Crypto aux cours CoinMarketCap

Portefeuille exclusivement virtuel, financé avec les euros du jeu. Les 100 premières cryptomonnaies par capitalisation sont obtenues en EUR via les endpoints officiels v3 `listings/latest` et `quotes/latest`. Recherche, pagination, positions, gains/pertes latents et historique rendent le marché consultable sans afficher 100 lignes à la fois.

Sans configuration, le serveur emploie l’[API publique officielle sans clé](https://coinmarketcap.com/api/documentation/pro-api-reference/keyless-public-api). `CMC_API_KEY` est facultative et reste exclusivement côté serveur ; si elle existe, le serveur utilise l’API authentifiée. Une clé invalide n’entraîne pas de repli silencieux. Les limitations et disponibilités du fournisseur s’appliquent.

Une réservation PostgreSQL commune à toutes les instances limite l’actualisation à un cycle de cinq minutes, comprenant le top 100 et jusqu’à 250 actifs détenus sortis du classement, en rotation. Le navigateur relit le cache toutes les minutes. Aucun prix de remplacement n’est fabriqué. Un cours de plus de dix minutes suspend les nouveaux ordres sur cet actif ; les positions restent visibles. Un actif sorti du top 100 peut être vendu avec un cours récent, mais plus acheté.

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
