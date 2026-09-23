# Trésorerie : comptes et gestion de l’entreprise

Statut : implémentation vérifiée ; migration `20260921000200` appliquée
sur la base Supabase liée le 21 septembre 2026.

L’activité **Trésorerie** est distincte du Marché dans le Placard et accessible
directement avec `/arene/placard?view=treasury`. Elle rassemble les graphiques,
le compte de résultat, le bilan de gestion, le journal comptable et la gestion
du shop, des publicités, de la domiciliation, de la TVA et des analyses.
Le Marché conserve la préparation des lots, les circuits de vente et leurs devis.

## Réorganisation du bureau — 23 septembre 2026

L’entrée Trésorerie ouvre désormais **Le Bureau**, avec trois nouvelles scènes dans la direction artistique existante,
avec trois pôles :

- **Comptabilité** : factures et échéances (vue initiale), synthèse, bilan et
  résultat, journal paginé, plan comptable consultable et recherchable.
- **Banque** : banquier et prêts conditionnés par la réputation, livret existant
  pour les Trésoriers, dépôts/retraits et portefeuille crypto aux cours réels.
- **Gestion** : site internet, publicité et domiciliation, avec les confirmations
  et les règles économiques déjà présentes.

Le plan conserve les 28 comptes existants et ajoute cinq comptes pour les
prêts et cryptoactifs, regroupés en actif, dettes, capitaux propres, produits,
charges et mouvements à classer. Les traitements existants sont conservés. Les soldes du plan sont cumulés
à la fin de la période sélectionnée ; le compte de résultat reste propre à la
période.

Les factures de laboratoire indiquent émission, échéance, montant initial et
solde, avec les états « À régler », « Partiellement réglée » et « Échue ».
L’électricité et les soins conservent leur règlement global sécurisé par le
montant attendu ; seules les dernières factures détaillées sont fournies par
l’API énergie. La TVA déjà réservée et les futurs abonnements sont séparés des
impayés. Les analyses soldées restent consultables dans le journal : l’API
commerciale ne renvoie que les analyses encore dues.

Les prêts nécessitent 200 points de réputation et une première culture terminée
depuis 24 heures. Un scénario quotidien fait évoluer les nouvelles offres ; les
contrats signés gardent leur coût fixe sur sept jours. Le marché crypto emploie
les cours EUR du top 100 CoinMarketCap avec la monnaie de jeu. Les trois migrations
complémentaires et les règles sont détaillées dans [Banque et crypto](PLACARD-BANQUE-CRYPTO-2026-09-23.md).
Les droits au livret Trésorier sont conservés.

Les audits locaux utilisent des données synthétiques et n’écrivent sur aucun
compte réel. `audit-placard-treasury.mjs` couvre les trois pôles, les 33 comptes,
les factures, les paiements, le livret, les erreurs, le clavier et quatre largeurs
(320, 390, 768, 1 280 px). `audit-placard-business.mjs` conserve la vérification
des opérations de gestion et de leurs confirmations après séparation des pôles.

## Principes retenus

Tous les montants sont des euros virtuels. Les comptes suivent les mouvements
effectifs du jeu : aucune courbe de démonstration n’est affichée à un joueur.
L’historique antérieur n’est pas suffisamment complet pour reconstituer des
résultats fiables : intérêts d’épargne, anciennes dotations et anciens abonnements
ne possédaient pas tous un journal exhaustif. Le suivi commence donc avec une
**position d’ouverture explicite**, puis enregistre les opérations futures.

Le modèle sépare trois lectures complémentaires :

- La **trésorerie** suit les entrées et sorties du portefeuille. La réserve de
  TVA et l’épargne sont présentées séparément.
- Le **résultat** compare les produits et les charges de la période, y compris
  les factures émises mais non réglées et les amortissements.
- Le **bilan** rapproche les actifs, les dettes et les capitaux propres à une
  date donnée. Chaque écriture possède des débits et crédits de même montant.

Ces distinctions suivent les explications du ministère de l’Économie sur
[le bilan](https://www.economie.gouv.fr/facileco/le-bilan) et
[le compte de résultat](https://www.economie.gouv.fr/facileco/le-compte-de-resultats).
Les durées d’amortissement ci-dessous sont des conventions d’équilibrage du jeu,
pas des durées fiscales recommandées pour une entreprise réelle.

## Traitement des opérations

| Opération | Trésorerie | Résultat et bilan |
| --- | --- | --- |
| Vente de 120 € TTC | 120 € encaissés, puis 20 € réservés à la TVA | 100 € de ventes HT ; 20 € de dette de TVA et 20 € de réserve |
| Analyse de 45 € facturée | Aucun débit à l’émission | Charge laboratoire et dette fournisseur de 45 € |
| Paiement de cette analyse | Décaissement de 45 € | Dette réduite, sans nouvelle charge |
| Achat de matériel | Prix réellement payé décaissé | Immobilisation au coût payé, puis amortissement |
| Transfert vers l’épargne | Portefeuille réduit, épargne augmentée | Aucun produit ni charge |
| Intérêts crédités | Épargne augmentée | Produit financier à la date du crédit |
| Reversement de TVA | Réserve fiscale réduite | Dette fiscale réduite, sans charge ni second débit du portefeuille |
| Abonnement ou publicité | Paiement immédiat | Charge payée d’avance, consommée sur sa durée réelle |

Les achats n’ont pas de ventilation de TVA déductible dans le moteur actuel :
aucune récupération de TVA fictive n’est ajoutée au bilan.

Les coûts des analyses, de l’électricité et des soins sont comptabilisés dès
facturation. La valeur du stock restant compense la part des coûts de production
qui correspond aux produits non vendus. Lors d’une vente, la diminution du stock
reporte cette part dans les charges de la période.

## Valorisation

- **Matériel** : coût d’achat enregistré et améliorations traçables, amortis
  linéairement sur 36 mois de jeu. Les équipements de départ gratuits restent
  valorisés à zéro. Un remplacement sort la valeur résiduelle de l’ancien bien
  et inscrit le coût du nouveau.
- **Site** : création de 1 000 €, amortie sur 12 mois de jeu. Le premier mois
  d’hébergement offert ne crée pas une deuxième dépense.
- **Charges payées d’avance** : hébergement et domiciliation sur 120 heures
  réelles ; publicité sur sa durée contractuelle. Le coût est réparti au prorata
  du temps écoulé, avec découpage aux frontières des mois de jeu.
- **Stocks** : coûts directs connus du lot (analyse, électricité et soins,
  transformation), répartis sur la quantité équivalente restante. Aucun prix de
  vente attendu, marge future ou coût absent de l’historique n’est inventé.

Ces valorisations restent comptables : elles ne modifient ni les tarifs, ni la
trésorerie jouable, ni le niveau d’usure du matériel. Les amortissements et les
variations de stocks n’entraînent aucun prélèvement.

## Journal et rapprochement

La migration `20260921000200_kq_treasury_accounting.sql` ajoute un journal
prospectif en partie double, des soldes par compte et des plans de consommation
des immobilisations et charges payées d’avance.

Les dotations sont réparties aux frontières des mois de jeu et à la date de
consultation pour le mois en cours. Les séries de produits et de charges suivent
ces dates comptables ; les graphiques du portefeuille suivent les mouvements
physiques d’argent, sans lissage inventé.

Les mouvements physiques du portefeuille, de la réserve fiscale et de l’épargne
sont enregistrés séparément de leur qualification comptable. Les reçus de vente,
factures et reçus de dépenses apportent la contrepartie correspondante. Les reçus
et commandes d’une même vente ne sont pas additionnés deux fois.

Un compte d’attente permet de rendre visible un mouvement sans contrepartie
identifiée, sans le transformer arbitrairement en chiffre d’affaires ou en
bénéfice. Les soldes comptables sont rapprochés des soldes du jeu pour les vues
actuelles ; le mois précédent conserve sa situation historique.

Les écritures sont créées dans la transaction de l’opération d’origine. Un
rejeu idempotent ne crée pas une deuxième pièce ; une transaction annulée ne
laisse aucune écriture. Les clients ne peuvent pas écrire dans le journal ni
appeler ses fonctions internes. L’API utilise exclusivement le propriétaire
authentifié et ne met pas les réponses financières en cache partagé.

## Périodes et interface

Le calendrier reste **4 heures réelles par jour de jeu**, **120 heures par mois**.
Les vues proposées sont le mois en cours, le mois précédent et depuis l’ouverture
des comptes. Les graphiques offrent la lecture du solde ou des flux, avec
sélection interactive et tableaux accessibles. Les postes de charges incluent
les effets de la variation des stocks.

Le journal est paginé par 25 écritures. Les totaux et graphiques sont calculés
sur l’ensemble de la période, jamais sur la seule page affichée. La Gestion
conserve les confirmations, contrôles de fonds et clés d’idempotence des actions
existantes.

## Vérifications

Les tests couvrent la séparation HT/TVA, le paiement différé sans double charge,
les investissements et amortissements, les variations de stocks, les transferts
d’épargne et intérêts, les capitaux propres, la pagination indépendante des
totaux, ainsi que les limites d’accès à l’API.

Commandes locales :

```powershell
npm.cmd install --prefix output/reputation-test-tools --no-save --ignore-scripts --package-lock=false @electric-sql/pglite@0.5.8
node scripts/test-placard-treasury.mjs
node node_modules/vitest/vitest.mjs run src/lib/kanab-quest-treasury.test.ts src/lib/supabase/kanab-quest-treasury-backend.test.ts src/app/api/arena/placard/treasury/route.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/audit-placard-treasury.mjs
node scripts/audit-placard-business.mjs
```

Résultats obtenus : **122 fichiers Vitest, 908 tests réussis** ; TypeScript sans
émission et ESLint sur les fichiers concernés réussis ; **11 groupes de contrôles
PostgreSQL** réussis. Le harness confronte les vraies réponses SQL au contrat
TypeScript, vérifie l’équilibre du bilan et rapproche les sources physiques.
Deux mouvements non classés opposés restent signalés malgré leur solde nul.

Les audits navigateur ont réussi à **320, 390, 768 et 1 280 pixels** pour la
Trésorerie, et à **320, 390 et 1 280 pixels** pour les actions de gestion et ventes.
Navigation, graphiques, clavier, bilan, pagination, périodes sans historique,
erreurs et nouvelle tentative ont été contrôlés. Aucun débordement horizontal
ni erreur JavaScript ou console ; captures relues dans `output/placard-treasury/`.

## Application Supabase

La prévisualisation distante ne proposait que la nouvelle migration Trésorerie.
`supabase db push --linked --yes` a appliqué
`20260921000200_kq_treasury_accounting.sql` avec succès. Le dry-run suivant confirme
que la base distante est à jour.

`node scripts/check-placard-treasury-schema.mjs` a confirmé les cinq tables,
leurs colonnes et la fonction RPC : cinq lectures HTTP 200, aucun objet manquant,
`ok: true`. Le contrôle du schéma commercial existant a également réussi.
Ces contrôles lisent uniquement le schéma et des sélections sans lignes ; ils
n’exécutent aucune opération sur le compte d’un joueur.

La migration ne déploie pas le code de l’interface. Les tests navigateur locaux
ne constituent pas une validation du parcours connecté en production.


## Évolution du bureau — 23 septembre 2026

La trésorerie devient un bureau en trois pôles : Comptabilité (factures, synthèse, comptes, journal et plan), Banque (prêts selon réputation, livret, crypto) et Gestion (site, publicité, domiciliation). Le plan comprend désormais 33 comptes. Les règles des prêts, cours CoinMarketCap, migrations complémentaires et illustrations sont décrits dans [Bureau — banque et crypto](PLACARD-BANQUE-CRYPTO-2026-09-23.md). Les vérifications et le déploiement cités ci-dessus concernent la version du 21 septembre ; les trois nouvelles migrations Banque/Crypto ont ensuite été appliquées le 23 septembre sur demande de l’utilisateur, avec vérification des fonctions et permissions réussie.
