# Calendrier, shop et charges du Placard : implémentation du 21 septembre 2026

Statut : implémenté dans le dépôt et migration SQL appliquée le 21 septembre 2026
à la base Supabase liée au site, après autorisation explicite de l’utilisateur.
L’historique distant contient la version `20260921000100` et aucune migration
ne reste en attente. Le déploiement de l’application n’a pas été effectué dans
cette tâche.

Ce document décrit les règles effectivement codées. Le
[cadrage initial](PLACARD-SHOP-CALENDRIER-PROPOSITION-2026-09-21.md) reste conservé
comme historique des propositions et décisions. Tous les euros ci-dessous sont
la monnaie virtuelle du jeu.

La gestion du site, des publicités, de la domiciliation et des factures a ensuite
été déplacée dans l’onglet **Trésorerie**, avec graphiques, journal, compte de
résultat et bilan de gestion. Voir la
[livraison Trésorerie](PLACARD-TRESORERIE-2026-09-21.md) pour cette seconde phase
et sa migration distincte. Le statut ci-dessus concerne la migration du
calendrier déjà appliquée.

## Calendrier commercial

- Un jour de jeu dure exactement **4 heures réelles**.
- Un mois dure **30 jours de jeu**, soit **120 heures réelles / 5 jours réels**.
- L’origine du calendrier est enregistrée par joueur et l’heure du serveur fait
  référence. Le navigateur affiche le temps écoulé depuis la dernière réponse
  serveur à partir d’une horloge monotone.
- Le temps continue hors connexion. Les échéances écoulées sont traitées lors
  des échanges suivants avec le serveur, dans l’ordre chronologique, sans
  facturer plusieurs fois la même période.
- La demande garde ses rythmes de reconstitution : 4 heures réelles en ligne,
  12 heures pour les boutiques. Les périodes de fidélisation durent toujours
  24 heures réelles.
- Terminer une étape, une culture ou un duel ne fait pas avancer le calendrier.
  Les durées des six étapes de culture restent inchangées ; aucun nouveau délai
  d’attente de croissance n’a été ajouté.

Les dates sont des instants UTC et les intervalles sont des durées exactes.
Un changement d’heure civile ne raccourcit ni ne prolonge un abonnement.
L’interface indique le mois et le jour de jeu, les dates réelles et les délais.

## Progression et site internet

La vente en ligne exige à la fois l’ordinateur et un site créé et actif.
L’ordinateur seul ne débloque plus les commandes. Les boutiques partenaires et
les grossistes permettent de financer cette progression.

| Achat ou service | Débit total | Conditions |
| --- | ---: | --- |
| Ordinateur | 450 € | Achat permanent conservé |
| Création du site | 1 000 € | Achat volontaire ; premier mois de jeu inclus |
| Hébergement et maintenance | 100 € | Tous les 30 jours de jeu, soit 5 jours réels |
| Réactivation du site suspendu | 100 € | Nouvelle période de 30 jours de jeu à partir de la réactivation |

Le capital initial n’est pas augmenté pour financer le site. L’écran présente
la trésorerie disponible, l’objectif de 1 000 € et l’épargne manquante. Il rappelle
le coût séparé de l’ordinateur lorsqu’il n’a pas encore été acheté.

Le joueur choisit un nom de 3 à 40 caractères, normalisé avec suppression des
espaces superflus. Les caractères de contrôle et balises sont refusés. Le nom
est un affichage dans le jeu ; aucun domaine réel n’est réservé. Renommer le
shop est gratuit et ne réinitialise pas les échéances.

La reconduction est activée lors de la création et peut être désactivée. Une
période payée reste utilisable jusqu’à son terme. Si le joueur ne reconduit pas
ou si la trésorerie ne suffit pas, le site est suspendu à la première échéance
impayée ; aucune nouvelle mensualité n’est accumulée pendant la suspension.
Le nom, les stocks et les circuits professionnels sont conservés.

Les anciens **15 € d’Internet par culture sont supprimés**. L’ancienne action
Internet ne permet pas de contourner les 1 000 € de création.

## Domiciliation du commerce

Le joueur peut choisir son adresse indépendamment de l’ouverture du site.

| Adresse | Prix | Risque de vol des nouvelles cultures |
| --- | ---: | --- |
| À domicile, choix par défaut | Gratuit | Probabilité de l’incident multipliée par 2 |
| Adresse extérieure | 50 € par mois de jeu | Probabilité habituelle |

L’adresse extérieure est payée immédiatement pour 120 heures réelles et
reconduite automatiquement tant que les fonds suffisent. À la première
échéance non payée, le compte revient à domicile et les nouveaux prélèvements
s’arrêtent. Il n’y a pas d’accumulation de mensualités impayées.

Revenir à domicile est immédiat et désactive la reconduction extérieure. La
fin de la période déjà payée est conservée : la réactiver avant cette date ne
coûte pas 50 € une seconde fois. Une période expirée doit être payée de nouveau.

La domiciliation est enregistrée **au démarrage de la culture**. Changer
l’adresse ensuite agit sur les cultures suivantes ; cela ne modifie pas le
parcours déjà déterminé ni son intégrité. Le multiplicateur porte sur la
probabilité de l’incident de vol, pas sur l’importance des dégâts. Les cultures
anciennes dépourvues de ce champ conservent leur parcours d’origine.

## Publicités

Une seule campagne est active à la fois. Son coût est payé au lancement, sans
reconduction automatique. Le site doit être actif pour lancer une publicité.

| Support | Coût | Durée de jeu | Durée réelle | Fréquentation et demande |
| --- | ---: | ---: | ---: | ---: |
| Prospectus chez les commerçants | 60 € | 10 jours | 40 heures | +20 % |
| Instagram | 150 € | 7 jours | 28 heures | +50 % |
| Radio locale | 400 € | 5 jours | 20 heures | +100 % |

Le bonus modifie la capacité et la reconstitution de la demande en ligne.
La consommation de demande est conservée dans une unité stable : lancer ou
terminer une publicité n’efface pas les commandes déjà consommées. Le temps
passé avant et après une échéance utilise les conditions correspondantes.

Les ventes restent manuelles. Le bonus ne crée ni vente garantie, ni stock,
ni réputation, ni clients fidèles immédiats. Prix, qualité et disponibilité du
lot continuent de compter. L’interface avertit si l’abonnement du site arrive à
échéance avant la fin de la publicité. En cas de suspension, le bonus devient
indisponible mais la durée publicitaire continue de s’écouler.

## TVA et détail des recettes

La TVA est une règle simplifiée du jeu : **20 % inclus dans les recettes TTC**
de toutes les ventes de produits. Les prix affichés sont TTC. Les primes et
récompenses ne sont pas des ventes de produits.

Pour une vente de 120 € TTC, 20 € vont dans une réserve et 100 € sont disponibles
avant règlement des dettes. Le calcul utilise le chiffre d’affaires TTC cumulé :

```text
TVA de la vente = arrondi((TTC cumulé précédent + vente TTC) / 6)
               - arrondi(TTC cumulé précédent / 6)
```

Le cumul traverse les ventes, les circuits et les reversements mensuels. Les
arrondis ne favorisent pas le fractionnement d’une vente. La réserve n’est pas
dépensable. Son reversement à chaque fin de mois de jeu ne débite pas une
seconde fois la trésorerie.

Les coûts annoncés restent les débits totaux : aucun supplément de TVA n’est
ajouté aux 1 000 €, 100 €, 50 € ou 45 €, et cette version ne récupère pas la TVA
sur les achats.

Avant confirmation et dans le reçu, le joueur voit la recette TTC, la TVA
réservée, les analyses échues réglées, l’électricité et les soins réglés, puis
le montant net versé.

## Analyses et recouvrement

Chaque nouvelle culture terminée donne lieu à **une seule facture de 45 €**,
identifiée par la culture. Elle est due exactement **120 heures réelles** après
sa facturation. Transformation, fractionnement du lot, ventes multiples et
répétition d’une requête ne créent pas d’analyses supplémentaires. Une culture
abandonnée avant son achèvement n’en crée pas.

Le paiement anticipé du solde d’une facture est possible. À l’échéance, le
paiement est automatique si la trésorerie suffit. Sinon, le solde reste visible
comme dette échue, sans pénalité ni suppression de stock.

Sur les ventes suivantes, un budget commun de recouvrement est limité à **50 %
de la recette après TVA**, arrondi au centime inférieur. Les analyses échues
sont payées en premier, des plus anciennes aux plus récentes. L’électricité et
les soins utilisent le reliquat de ce même budget ; les plafonds ne s’empilent
pas. Un règlement partiel conserve le solde restant de chaque facture.

## Comptes existants et cohérence serveur

La migration conserve ordinateurs, stocks, réputation, clients, historiques,
recettes passées et cultures en cours. Les comptes existants doivent créer
leur site pour accéder au nouveau commerce en ligne.

- Pas de factures labo rétroactives pour les cultures déjà terminées.
- Pas de TVA rétroactive sur les anciennes ventes.
- Pas de nouvelle domiciliation imposée dans une culture déjà commencée.
- Les anciens reçus restent lisibles ; une réponse idempotente ne réencaisse
  pas une vente et ne lui ajoute pas de nouvelles retenues.
- Le serveur vérifie le site actif sur les devis et les ventes. Les anciennes
  actions et les anciennes fonctions commerciales ne doivent pas ouvrir un
  chemin de vente sans abonnement ou sans TVA.
- Paiements, stocks, échéances et reçus sont mis à jour dans la transaction du
  compte. Les clés de requête assurent l’idempotence des achats et règlements.
- Les devis expirent au plus tard au changement de condition pertinent :
  abonnement, publicité, échéance financière ou période commerciale.

## Prix conservés et repère d’équilibrage

Les prix et écarts entre circuits existants sont conservés : le prix de détail
récompense l’investissement dans le shop, tandis que la vente professionnelle
permet l’épargne initiale. Le nouveau coût des analyses et la TVA rendent
néanmoins cette phase plus longue.

Repère indicatif pour 120 g de fleurs brutes à 8/10, vendus à une boutique sans
bonus de réseau, avec le matériel de départ en mode équilibré :

| Poste | Montant |
| --- | ---: |
| Recette TTC | 108,00 € |
| TVA | −18,00 € |
| Analyse | −45,00 € |
| Électricité de la culture | −6,03 € |
| Bénéfice après ces charges | **38,97 €** |

Depuis 350 € de trésorerie, réunir le budget cumulé ordinateur + site de 1 450 €
représente environ **29 cultures de ce type**, sans primes, bonus, matériel
supplémentaire, domiciliation extérieure ni autres dépenses. C’est un repère
comptable après paiement des charges, pas un nombre de cultures garanti :
qualité, rendement, réseau et décisions du joueur modifient les recettes.
Les paiements différés ne doivent pas être confondus avec un bénéfice acquis.

## Fichiers et vérifications

La migration est
[`20260921000100_kq_business_calendar.sql`](../../supabase/migrations/20260921000100_kq_business_calendar.sql).
Les paramètres et calculs partagés sont dans
[`kanab-quest-business.ts`](../../src/lib/kanab-quest-business.ts), avec
l’intégration commerciale dans `kanab-quest-commerce.ts`, le moteur de culture
et sa persistance. Les actions passent par `/api/arena/placard/commerce` et le
backend Supabase. Le tutoriel isolé utilise également le nouveau modèle.

L’interface de gestion est dans
[`KqBusinessPanel.tsx`](../../src/components/placard/KqBusinessPanel.tsx), les devis
et reçus dans `KqCommerceDesk.tsx`, l’historique dans `KqCommerceOverview.tsx`.

Les vérifications locales couvrent les périodes réelles, l’accès verrouillé,
les échéances hors connexion, la suspension, les publicités et leur demande,
la TVA cumulée, les analyses uniques et leur paiement, les comptes existants,
les actions idempotentes et la domiciliation. Le harness PostgreSQL isolé a
été exécuté avec succès ; il ne charge pas de secrets et n’écrit pas dans une
base distante. Les suites du jeu, des composants Placard et de leurs routes API
ont réussi : **119 fichiers, 844 tests**. La compilation TypeScript sans émission
et ESLint sur les fichiers modifiés ont également réussi.

Commandes de reproduction après `npm ci` (Chrome doit être installé pour l’audit
navigateur). Le harness PostgreSQL utilise PGlite dans le répertoire local ignoré
par Git, sans ajouter de dépendance à l’application :

```powershell
npm.cmd install --prefix output/reputation-test-tools --no-save --ignore-scripts --package-lock=false @electric-sql/pglite@0.5.8
node scripts/test-placard-business.mjs
node node_modules/vitest/vitest.mjs run src/lib/kanab-quest src/lib/supabase/kanab-quest src/components/placard src/app/api/arena/placard
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/audit-placard-business.mjs
```

L’audit navigateur a réussi aux largeurs **320, 390 et 1 280 pixels** : épargne
insuffisante, création, nom, reconduction, réactivation, publicité, paiement
anticipé, domiciliation et réactivation gratuite d’une période déjà payée,
détail du net avant/après vente. Aucun débordement horizontal ni erreur
JavaScript n’a été relevé. Les captures mobile et bureau ont été inspectées.
Le rapport et les captures sont dans `output/placard-business/`.

## Application distante du 21 septembre 2026

La cible Supabase liée a été comparée à la configuration de l’application.
La prévisualisation `supabase db push --linked --dry-run` ne proposait que
`20260921000100_kq_business_calendar.sql`. L’application avec
`supabase db push --linked --yes` s’est terminée avec succès.

Après application, `supabase migration list --linked` confirme la version
`20260921000100` des deux côtés, et un nouveau dry-run confirme que la base
distante est à jour. Le contrôle du schéma des équipements a également réussi
(neuf lectures HTTP 200, aucun objet ni colonne manquant).

`node scripts/check-placard-business-schema.mjs` a confirmé les colonnes du
calendrier, du shop, des publicités, de la domiciliation et de la TVA, les tables
d’analyses et de journal, les colonnes des reçus et les deux RPC commerciales :
quatre lectures HTTP 200, aucun objet ni colonne manquant, `ok: true`. Ce contrôle
ne récupère aucune ligne joueur et n’invoque aucune action de jeu.

La migration exige le code applicatif correspondant pour les nouvelles ventes
et les démarrages de culture : les anciens devis sans détail des charges et les
démarrages sans domiciliation sont refusés. L’application SQL ne publie pas le
code de l’application ; les contrôles locaux ci-dessus ne valident pas un
parcours connecté en production.
