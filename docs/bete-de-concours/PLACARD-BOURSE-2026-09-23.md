# Le Placard — comptoir boursier

La banque comporte un quatrième comptoir, **Bourse**, à côté de Crypto. Deux marchés permettent d’acheter les actions des entreprises et des parts virtuelles des indices CAC 40 et S&P 500. Les achats et ventes utilisent le portefeuille d’euros du jeu ; aucun compte financier externe n’est ouvert.

## Catalogue et sources

Le catalogue initial contient 545 instruments : 40 actions CAC 40, 503 titres américains et deux indices. Plusieurs classes d’actions peuvent représenter une même entreprise.

- CAC 40 : [composition officielle Euronext](https://live.euronext.com/en/product/indices/FR0003500008-XPAR), relevé du 23 septembre 2026. Le marché de cotation est conservé : ArcelorMittal est coté à Amsterdam.
- S&P 500 : univers inféré des actions cotées du [portefeuille officiel du fonds de suivi iShares IVV](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv), relevé du 22 septembre 2026. Ce proxy est indiqué dans l’interface. Cash, futures et reliquat non coté HOLX sont exclus.
- Cours et change : endpoint public Yahoo Finance `spark`, validé sur les 545 symboles à la livraison. [Couverture et retards par marché](https://help.yahoo.com/kb/SLN2310.html). Le flux public n’apporte pas de garantie de disponibilité ; son indisponibilité conserve le dernier relevé sans fabriquer de cours.

Une part virtuelle d’indice vaut son niveau : en euros pour le CAC 40, en dollars convertis en euros pour le S&P 500. L’interface distingue les points d’indice des prix d’action. Les fractions sont possibles. Le modèle suit uniquement les prix : pas de dividendes, de droits de vote ou d’opérations sur titres automatiques (fractionnements, fusions). Ces derniers nécessitent un traitement de maintenance avant la reprise des échanges du titre concerné.

## Prix et actualisation

Les cours de la page visible sont demandés à l’ouverture, au retour sur la fenêtre et toutes les 60 secondes tant qu’elle reste visible. Le cache commun renouvelle chaque titre après cinq minutes ; les requêtes sont limitées à 12 instruments, avec bail de 60 secondes et délai de reprise d’une minute après un échec. Le portefeuille conserve toutes les positions et rafraîchit les dix lignes de sa page courante.

Les dates de cotation, de vérification et de change restent distinctes. Un marché ouvert accepte un cours de moins de 45 minutes pour tenir compte des flux différés. Hors séance, le dernier cours réel de moins de 96 heures peut être utilisé dans le jeu et porte la mention « marché fermé ». La vérification du cache doit dater de moins de dix minutes. L’état du marché reflète le dernier relevé et peut donc conserver le statut de clôture quelques minutes au début de la séance suivante. Un cours périmé désactive uniquement le titre concerné. Une panne de change suspend les titres USD sans bloquer les titres EUR.

`EURUSD=X` fournit des dollars par euro : `prixEUR = prixUSD / tauxEURUSD`. La base effectue cette conversion en `NUMERIC(38,18)` ; le client ne transmet ni prix ni taux. Le change doit dater de moins de 45 minutes pour une action américaine en séance, ou de moins de 96 heures hors séance. Aucune valeur périmée n’est rajeunie artificiellement.

## Ordres et comptabilité

La fenêtre native centrée affiche quantité, prix bloqué, total et expiration. Le montant minimum d’achat est 1 € et le maximum par ordre 1 000 000 €. La vente peut porter sur toute la position ou une fraction. Une prévisualisation valable au maximum 60 secondes fige le prix en euros ; sa validité est aussi bornée par la fraîcheur des données.

La confirmation verrouille le portefeuille du joueur, débite ou crédite une fois et renvoie un reçu persistant. Réessayer un ordre après une réponse perdue renvoie ce reçu sans deuxième mouvement. Les positions, ordres et reçus restent privés ; seuls les RPC nommés sont accessibles au rôle serveur. L’API utilise l’identité de session et vérifie origine, taille de requête, limites de fréquence et liste de symboles autorisés.

Le plan comptable passe à 36 comptes. `securities_assets` porte le coût des titres ; `revenue_stock_gains` et `expense_stock_losses` enregistrent le résultat réalisé. Les moins-values latentes ne modifient pas le résultat comptable. Le rapport rapproche la valeur d’acquisition des positions avec le grand livre et distingue ce placement des cryptomonnaies.

## Maintenance et contrôles

Fichiers centraux : `stock-market-catalog.json`, `stock-market-quotes.ts`, `kanab-quest-stocks.ts`, backend Supabase, route `/api/arena/placard/stocks`, composant `KqStockMarket`. Migrations : `20260923000800_kq_stock_market.sql` et `20260923000900_kq_stock_catalog.sql`.

Pour revoir la composition :

```powershell
node scripts/refresh-stock-market-catalog.mjs --write
node scripts/build-stock-market-catalog-migration.mjs YYYYMMDDHHMMSS_kq_stock_catalog.sql
```

Remplacer l’horodatage par celui de la nouvelle migration, puis examiner le catalogue et le SQL ensemble. Le script vérifie chaque symbole auprès du fournisseur avant d’écrire le catalogue. Les anciens instruments sont conservés avec `markets: []` pour permettre de vendre les positions existantes, si un cours reste disponible. Déployer le catalogue applicatif et sa nouvelle migration ensemble ; ne jamais modifier une migration déjà appliquée.

Contrôles : tests Vitest des types, du fournisseur, du backend, de l’API et de la comptabilité ; PostgreSQL isolé via `node scripts/test-placard-stocks.mjs` et `node scripts/test-placard-treasury.mjs` ; vérification réelle du fournisseur via `node scripts/check-stock-market-live.mjs`, puis `node scripts/test-placard-stocks.mjs --live-quotes` ; audit navigateur `node scripts/audit-placard-stocks.mjs` et régression du bureau. Les essais d’achat/vente restent dans la base isolée et les fixtures navigateur.


## Livraison du 23 septembre 2026

Les migrations 008 et 009 ont été appliquées au projet lié ; le dry-run suivant confirme que la base est à jour. `node scripts/check-placard-stock-schema.mjs --warm-quotes` vérifie les trois RPC et le refus d’accès direct aux cinq tables privées, puis a publié les 22 vrais cours des premières pages CAC 40 et S&P 500 à 19:04 UTC. Aucun portefeuille joueur n’a été lu ni utilisé pour un ordre distant. Sans l’option `--warm-quotes`, ce contrôle se limite au schéma et aux permissions.

Validation effectuée : 77 tests Vitest ciblés ; 17 groupes PostgreSQL Bourse, dont catalogue SQL identique aux 545 instruments applicatifs et quatre vrais cours traversant publication, validation, aperçu et achat/vente en mémoire ; intégration comptable complète (achats, gains, pertes, périodes précédente/courante/tout, banque et crypto) ; TypeScript, ESLint ciblé et permissions explicites sur 244 migrations. L’audit navigateur Bourse passe aux largeurs 320, 390 et 1280 px, et la régression du bureau aux largeurs 320, 390, 768 et 1280 px. La fenêtre conserve les erreurs et les reprises de confirmation, le focus et le défilement ; les indices et actions sont achetables et revendables dans les fixtures.
