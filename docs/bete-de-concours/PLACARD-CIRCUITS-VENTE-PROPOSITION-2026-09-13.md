# Proposition : trois circuits de vente pour Le Placard

Statut : proposition initiale, désormais implémentée. Voir
[le compte rendu de mise en œuvre](PLACARD-CIRCUITS-VENTE-IMPLEMENTATION-2026-09-13.md)
pour le comportement livré et les validations. Tous les montants sont des
paramètres d’économie virtuelle à calibrer, pas des prix commerciaux réels.

## 1. Décision centrale

Séparer deux décisions : quel produit fabriquer, puis à qui et en quelle quantité
le vendre. Les fleurs, hash et rosin sont des produits ; Internet, CBD shops et
grossistes sont des circuits. Un même produit peut être réparti entre plusieurs
circuits sans nouvelle transformation ni nouveau paiement des frais d’atelier.

La réputation permet de maintenir un prix élevé en ligne ; elle ne garantit pas
que tout le stock trouve preneur. Cette règle remplace explicitement la garantie
actuelle de vente intégrale au prix ambitieux dès 1 500 points. Les paliers lents
0 / 60 / 200 / 600 / 1 500 / 3 000 sont conservés.

## 2. Circuits

On définit P0, tarif de référence du produit avant bonus de réputation et avant
frais. Les tarifs professionnels ne sont jamais calculés à partir du prix libre
choisi par le joueur : afficher un prix excessif en ligne ne peut pas augmenter
les offres des boutiques ou des grossistes.

| Circuit | Tarif proposé | Volume | Qualité | Accès |
| --- | --- | --- | --- | --- |
| Vente directe en ligne | P0 × qualité × bonus de réputation × choix tarifaire | Demande limitée par cycle, invendus possibles | Satisfaction et fidélité très sensibles | Ordinateur + Internet actif |
| CBD shops | 50 % de P0 ; contre-offre à 40 % pour qualité limite | Commandes importantes, mais capacité finie | Refus des lots sous leur seuil | Disponible dès le départ |
| Grossistes | 25 à 33 % de P0 selon le marché, 30 % normalement | Reprise de toute la quantité proposée | Aucun refus ni décote supplémentaire liés à la note | Disponible dès le départ |

Pour les boutiques : fleur acceptée dès 6,5/10, tarif normal dès 7 ; produits
transformés acceptés dès 7,5, tarif normal dès 8. Les seuils nécessaires pour
fabriquer une gamme restent applicables. Une boutique annonce sa quantité et
son tarif exacts avant confirmation. Un refus ne retire aucune réputation.

Pour les grossistes : une fleur faible reste vendable, y compris sous l’ancien
seuil de 5,8. En revanche, une fleur faible ne peut pas être convertie artificiellement
en produit Signature : les contraintes de fabrication restent inchangées.
Le prix dépend du produit réellement fabriqué, pas de la réputation. La reprise
industrielle/biomasse est intégrée à ce circuit pour éviter un quatrième bouton
qui ferait doublon. Les éventuels déchets de transformation gardent leur valeur
industrielle distincte ; ils ne deviennent pas du produit fini.

Le direct offre la meilleure recette par gramme vendu. Sa rentabilité globale
peut toutefois être inférieure à celle d’une vente en boutique lorsque peu de
commandes couvrent l’abonnement. C’est le compromis recherché.

## 3. Ordinateur et abonnement

Paramètres initiaux proposés : ordinateur à 450 €, achat permanent ; Internet
à 15 € par cycle commercial. L’ordinateur est un équipement commercial séparé
qui ne remplace ni une machine de production ni une protection du Placard.
Aucune montée de niveau de l’ordinateur dans la première version.

Un cycle commercial correspond à une culture terminée, indépendamment des six
étapes qui la composent et du temps réel passé connecté. Une culture terminée
ouvre une nouvelle campagne pour vendre les stocks disponibles, anciens compris.
Une culture abandonnée, une actualisation ou un simple passage de six heures
n’ouvrent aucune nouvelle campagne.

À l’ouverture, si l’abonnement est activé, 15 € sont débités une seule fois et
ouvrent le quota Internet du cycle. Une souscription en cours de campagne paie
les mêmes 15 € pour ce cycle ; couper puis réactiver ne redébite rien et ne
recrée pas de demande. Le réglage de reconduction s’applique au cycle suivant.
Si la trésorerie ne permet pas le paiement, le direct est suspendu ; le joueur
peut vendre aux professionnels puis payer l’accès au cycle encore ouvert.
Pas de dette Internet ni de prélèvement pendant une absence sans culture terminée.

Le premier abonnement peut utiliser la dernière culture terminée, même si le
lot a déjà été vendu. Un compte sans culture terminée n’a pas encore de campagne.
Passer au cycle suivant remplace les quotas et événements non utilisés, mais
conserve tous les stocks. Le débit et l’ouverture de campagne sont atomiques.

## 4. Réputation, clients et demande en ligne

Distinguer la réputation durable, gagnée lentement, et les clients fidèles,
qui reflètent les expériences d’achat récentes. Une mauvaise livraison peut
faire partir des clients même chez un producteur connu.

| Réputation | Bonus de prix | Demande de base en équivalent fleur/cycle | Plafond de clients fidèles |
| ---: | ---: | ---: | ---: |
| 0 | 0 % | 40 g | 25 |
| 60 | +5 % | 60 g | 40 |
| 200 | +12 % | 90 g | 65 |
| 600 | +20 % | 140 g | 100 |
| 1 500 | +30 % | 200 g | 160 |
| 3 000 | +45 % | 280 g | 240 |

Ces volumes sont des bases à tester, pas une promesse de ventes. Les clients
fidèles ajoutent jusqu’à 25 % de demande à la base du palier. Il existe toujours
une demande de prospection à zéro client : reconstruire sa clientèle reste possible.

Calcul proposé : base du palier × fidélité × qualité × prix × événement ×
saturation. Fidélité = 1 + 0,25 × min(1, clients/plafond du palier). Facteurs de
qualité proposés : 0,4 pour une qualité décevante, 0,75 pour une qualité moyenne,
1 pour une qualité satisfaisante et 1,1 pour une qualité exceptionnelle (9,5+).
Utiliser les seuils de satisfaction ci-dessous, par famille de produits.

Choix de prix en ligne : découverte à 90 % du tarif conseillé (demande ×1,2),
conseillé à 100 % (×1), ambitieux à 122 % (×0,7). Le bonus de réputation s’applique
au tarif conseillé avant ce choix. À 1 500 points et plus, saturation et événement
négatif ne diminuent plus le prix unitaire, mais peuvent toujours diminuer les
quantités achetées. Un lot médiocre reste moins valorisé qu’un excellent lot.

Les quantités sont partagées entre tous les lots d’un compte et d’une campagne :
reposter ou fractionner un lot ne renouvelle pas les acheteurs. En interne, utiliser
la quantité de fleur affectée à chaque produit lors de la transformation pour
comparer fleurs et concentrés, sans compter deux fois les restes. L’interface
montre uniquement les grammes réels de chaque produit et ses commandes disponibles.

Les boutiques ont, pour commencer, un budget de commande de 400 g équivalent fleur
par compte et cycle, modulé entre 300 et 500 par l’événement. Il couvre plusieurs
récoltes ordinaires mais ne permet pas d’écouler une réserve infinie au meilleur
prix professionnel. Les grossistes absorbent le surplus sans quota.

La saturation doit être calculée en volumes vendus par produit/famille, et non
par nombre de reçus comme aujourd’hui. Son impact proposé sur la demande est
plafonné à −35 %. Les ventes des autres joueurs peuvent moduler la tendance,
mais ne doivent jamais fermer les trois débouchés à un joueur.

## 5. Événements et satisfaction

Une campagne tire un événement serveur, stable jusqu’au prochain cycle terminé.
La tendance globale actuelle de six heures peut alimenter le tirage, mais attendre
ou actualiser ne renouvelle ni quotas, ni Internet, ni événement personnel.

Première distribution proposée : 60 % de marché habituel ; 15 % de mise en avant
d’une famille (+25 % de demande concernée) ; 15 % de concurrence promotionnelle
(−25 % de demande en ligne) ; 10 % de réassort boutique (+25 % de capacité shops).
Les événements sont annoncés avant répartition du stock. L’incertitude porte sur
le prochain cycle, pas sur un tirage caché après un clic de confirmation.

Le joueur voit « commandes disponibles : 42 g à ce prix ; 58 g resteraient en
stock », ainsi que le risque de déception. La quantité confirmée est réservée
et payée immédiatement. Il peut conserver le reste ou changer de circuit.

La clientèle progresse après de bonnes ventes réelles, au maximum cinq clients
nets par campagne. Fleur satisfaisante : 8/10 ou plus ; rosin et grades avancés :
8,8 ou plus. Entre le seuil neutre actuel et le seuil satisfaisant, pas de croissance.
Sous le seuil neutre (7 pour fleur/hash courant, 8 pour rosin/grades avancés),
perte allant jusqu’à 10 % des clients ; forte déception sous 6,5 / 7,5 : jusqu’à
25 %. La perte dépend de la part effectivement livrée en direct pendant le cycle.

Implémenter les variations de clientèle avec un cumul par campagne et exposition
vendue, puis appliquer seulement l’écart depuis le dernier calcul. Un gramme
médiocre ne peut pas faire perdre 25 % de toute la clientèle ; dix petites ventes
ne peuvent pas déclencher dix fois la pénalité. Pas de départ de clients pour
une absence, un stock conservé, une fermeture volontaire ou un événement commercial.
Le palier et la fidélité qui définissent le budget de demande sont figés à
l’ouverture de la campagne pour éviter de créer des quotas supplémentaires en
gagnant quelques points ou clients. Les nouveaux budgets servent au cycle suivant.
Les prix peuvent suivre la réputation courante au renouvellement du devis, sans
renouveler le volume de demande déjà consommé.

## 6. Réputation et maîtrise : éviter le fractionnement rentable

Conserver le barème de qualité existant et les seuils de titres ralentis.
Pour chaque lot d’origine, calculer la réputation cumulée selon les fractions
vendues : 100 % du barème sur la fraction directe, 50 % sur la fraction boutique,
0 % sur la fraction grossiste. Les pertes liées à la qualité sont également
pondérées par la quantité réellement vendue. Les variations de clients restent
une conséquence distincte de la note de réputation.

Utiliser un cumul exact avant arrondi ; chaque transaction applique seulement
la différence avec les points déjà attribués. Aucun minimum de +1 par sous-vente.
Pour la maîtrise, un lot d’origine ne compte qu’une fois dans sa filière, lorsque
au moins 50 % de son volume est vendu hors grossiste. Les primes existantes aux
3e/6e/10e lots ne s’activent que si ce lot apporte une réputation positive.

Cela empêche les ventes grossistes sans exigence de qualité de devenir une
méthode rapide de montée en réputation. Les simulations précédentes de 75 ventes
à 9/10 devront être refaites : quotas, parts de circuit et fidélité changent le rythme.

## 7. Exemple économique

Exemple illustratif : 100 g, tarif direct conseillé de 2 €/g, commandes en ligne
limitées à 40 g, boutique à 1 €/g, grossiste à 0,60 €/g.

- Direct puis boutique : 40 × 2 + 60 × 1 = 140 € de recette ; 125 € après Internet.
- Tout en boutique : 100 € immédiatement, sans abonnement.
- Tout au grossiste : 60 € immédiatement, sans contrainte de qualité.
- Avec seulement 10 g de demande directe : 10 × 2 + 90 × 1 − 15 = 95 €.

Montants avant production, transformation, électricité et amortissement du PC.
Internet est facturé une fois pour tous les lots du cycle. Dans cet exemple,
vendre plus de 15 g en direct couvre le surcoût d’abonnement par rapport aux shops ;
l’achat de l’ordinateur doit ensuite être amorti. Montrer cette différence dans
la boutique aide à décider quand investir, sans promettre un rendement garanti.

## 8. Travail nécessaire dans le code existant

Constats : `kanab-quest-market.ts` mélange produit et vente ; `KqMarketDesk`
propose trois politiques de prix sans circuits ; la base n’a que les états ready/sold
et impose un seul reçu par fleur. `rpc_kq_sell_market_offer` solde tout le lot.
La facturation électrique existe déjà par culture terminée, sans horloge réelle.

Ordre d’implémentation proposé :

1. Créer un stock de produits avec quantités initiales/restantes, origine et coût
   de transformation payé. Transformer une fois, conserver les restes séparément.
2. Ajouter des reçus de ventes partielles et les cumuls de réputation/maîtrise par
   lot d’origine. Préserver les anciens reçus ; les lots historiquement vendus
   ne réapparaissent jamais. Les lots non vendus restent des fleurs à orienter.
3. Introduire `salesChannel` distinct de `productRoute`, des devis par quantité,
   les commandes boutiques et la reprise grossiste. Les prix professionnels
   utilisent P0, jamais le prix choisi par le joueur.
4. Ajouter l’ordinateur, la reconduction Internet, les campagnes, les événements
   et les quotas communs, puis la fidélité et ses effets pondérés.
5. Adapter le comptoir : choisir produit → voir prix/quantités par circuit →
   confirmer la répartition → lire recette nette et stock restant. Proposer
   « meilleure recette estimée », « encaisser maintenant » et « conserver ».

Transactions : verrouiller portefeuille, campagne et stock dans un ordre constant ;
contrôler propriété, quantité, version du devis, accès Internet, quota restant et
clé idempotente. Stock réservé, paiement, charges, réputation et clients doivent
être modifiés ensemble, sans stock négatif ni double versement. Décompter la masse
en unités entières et les sommes en centimes. L’électricité continue à être réglée
sur les recettes selon sa règle actuelle ; les frais de transformation ne doivent
être déduits ni deux fois ni proportionnellement à chaque nouveau reçu.

Avant activation : tester les courses entre deux ventes, les répétitions réseau,
le changement d’abonnement, les invendus sur plusieurs cycles, les reprises à
qualité nulle, l’équivalence vente entière/fractionnée et les anciens lots.
Simuler des stratégies direct/boutique/grossiste/mixtes à plusieurs qualités et
paliers ; mesurer bénéfice net, stock accumulé, retour sur l’ordinateur et rythme
de progression. Vérifier que le grossiste sauve une trésorerie faible, que la boutique
reste compétitive, et que le direct rembourse ses coûts seulement avec une demande
suffisante. Ces tarifs restent des hypothèses jusqu’à cette validation.
