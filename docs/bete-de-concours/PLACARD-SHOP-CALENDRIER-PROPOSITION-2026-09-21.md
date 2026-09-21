# Proposition : calendrier, shop et charges du Placard

Statut : cadrage historique du 21 septembre 2026, conservé pour distinguer les
propositions initiales des décisions ensuite implémentées. La livraison dans le
dépôt et ses règles finales sont décrites dans
[l’implémentation du 21 septembre 2026](PLACARD-SHOP-CALENDRIER-IMPLEMENTATION-2026-09-21.md).
La migration a été appliquée à la base Supabase liée le 21 septembre 2026.
Les sections ci-dessous gardent volontairement leur formulation d’origine et ne
constituent plus la référence de l’état du code.
Tous les euros désignent la trésorerie virtuelle du jeu.

### Demande complémentaire : domiciliation

L’utilisateur a ajouté le choix entre une adresse à domicile gratuite, avec un
risque de vol multiplié par deux, et une adresse extérieure à 50 € par mois de
jeu. Les règles retenues sont documentées dans la livraison : premier paiement
immédiat, période de cinq jours réels, reconduction si les fonds suffisent,
retour à domicile en cas de défaut de paiement, et choix enregistré au démarrage
de chaque nouvelle culture. Le reste du cadrage historique n’est pas réécrit.

## Demande à conserver

- La vente en ligne nécessite d’abord la création d’un site pour **1 000 €**.
- Le joueur choisit le **nom de son shop**.
- Hébergement et maintenance coûtent ensuite **100 € par mois**.
- Trois supports publicitaires : **Instagram**, **prospectus chez les
  commerçants**, **radio**, avec des coûts et des effets de fréquentation différents.
- La fréquentation supplémentaire augmente la demande du site.
- Le joueur doit payer la TVA.
- Chaque culture donne lieu à une **analyse de laboratoire à 45 €**, payable
  **30 jours après sa facturation**.
- Le calendrier suit le temps réel : **un jour de jeu = quatre heures réelles**,
  soit six jours de jeu par journée réelle et un mois de 30 jours en cinq jours
  réels. Il continue hors connexion.

Précision confirmée par l’utilisateur : la vente en ligne est un objectif de
progression. Le joueur doit commencer par les circuits professionnels et
économiser avant de pouvoir ouvrir son shop. Le prix de vente doit traduire
l’intérêt de cet investissement.

## Ce qui existe aujourd’hui

Le moteur comporte six étapes : germination, enracinement, croissance, floraison,
récolte, séchage et affinage. Elles se jouent librement et n’ont pas de durée
calendaire. Une relance de dés n’est pas une nouvelle étape.

L’accès en ligne demande actuellement un ordinateur à 450 € et Internet à
15 € par culture terminée. La demande commerciale se renouvelle en temps réel :
4 heures en ligne, 12 heures pour les boutiques partenaires. La fidélisation
utilise une période de 24 heures réelles. L’électricité est un forfait d’heures
équivalentes par culture, indépendant du temps connecté.

Références : `src/lib/kanab-quest-game.ts`, `kanab-quest-commerce.ts`,
`kanab-quest-energy.ts` et
[demande en temps réel](DEMANDE-TEMPS-REEL-2026-09-15.md).

## Temps réel accéléré : rythme validé

L’utilisateur préfère une horloge calée sur le temps réel, avec plusieurs jours
de jeu par journée réelle. Cette décision remplace la première proposition où
chaque étape résolue ajoutait un jour et où le calendrier s’arrêtait hors jeu.

**Règle validée : un jour de jeu = quatre heures réelles ; un mois = 30 jours de jeu.**

| Durée dans le jeu | Durée réelle |
| --- | --- |
| 1 jour | 4 heures |
| 6 jours | 24 heures |
| 7 jours | 28 heures |
| 30 jours, soit un mois | 5 jours |

Le calendrier est propre au joueur et persiste entre les cultures. Son origine
est enregistrée au jour 1, mois 1, lors de son entrée dans le nouveau système.
Il avance selon le temps serveur écoulé, y compris hors connexion. Acheter,
vendre, résoudre une étape, relancer les dés ou abandonner une culture ne le
fait ni avancer artificiellement ni reculer.

La publicité, l’hébergement, les analyses et la TVA emploient cette même vitesse.
L’interface affiche par exemple « Mois 2 · Jour 8 », avec une date réelle et un
compte à rebours pour chaque échéance : « Analyse à régler dans 2 jours réels ».
Une durée de 30 jours de jeu correspond à exactement 120 heures réelles après
l’événement de départ, sans arrondi au changement de jour suivant.

Ce rythme conserve les durées de demande actuelles : **un jour de jeu en ligne
(4 h)**, **trois jours pour les boutiques (12 h)**. La demande se reconstitue
hors connexion jusqu’au plafond existant. La fidélisation conserve sa période
de **six jours de jeu (24 h)** et ses plafonds actuels ; aucune période de
fidélisation manquée ne s’accumule. Les saisons, classements et défis quotidiens
de l’Arène gardent leurs dates réelles, distinctes du mois commercial du joueur.

Le calendrier ne fixe pas encore la durée des cultures. Les six étapes sont
actuellement jouables librement ; leur attribuer des temps d’attente serait
une décision supplémentaire. Une culture terminée ne vaut donc plus
automatiquement six jours de jeu. L’électricité conserve son forfait par
culture tant que ses durées de production n’ont pas été redéfinies.

La validation de ce calendrier ne fixe pas les durées des étapes de culture,
les tarifs publicitaires ni les autres paramètres encore présentés comme
propositions dans ce document.

### Fonctionnement pendant l’absence

Les publicités expirent et les factures arrivent à échéance selon le temps réel.
Les ventes restent manuelles : l’absence ne génère aucun encaissement automatique.
La règle de paiement hors connexion est validée : renouveler le site tant que
la reconduction est activée et que les fonds suffisent ; sinon suspendre le site
à la première échéance impayée et arrêter les nouvelles mensualités jusqu’à sa
réactivation. Le joueur peut désactiver la reconduction avant une absence.
Les dettes d’analyse déjà émises restent dues. Aucune nouvelle analyse n’est
créée du seul fait de l’absence.

Au retour, afficher le bilan des échéances écoulées, paiements, suspensions et
publicités terminées. Les traitements doivent produire le même résultat que
des connexions régulières aux mêmes dates, sans factures en double.

## Création et abonnement du shop

La vente en ligne reste verrouillée tant que le joueur n’a pas économisé et
payé les 1 000 € de création du site. Posséder l’ordinateur ou avoir terminé
une culture ne suffit pas. Avant l’ouverture, les boutiques partenaires et
les grossistes permettent de vendre les récoltes et de constituer l’épargne.
L’écran du shop présente le coût, le montant déjà disponible et ce qu’il reste
à économiser ; aucun débit de création n’a lieu avant l’achat volontaire.

Proposition : conserver l’ordinateur déjà présent et remplacer les anciens
15 €/culture par les nouveaux frais du site.

1. Saisir un nom de 3 à 40 caractères visibles, espaces superflus supprimés.
   Le nom est un nom d’affichage, sans réservation de domaine Internet réel.
2. Afficher le débit unique de 1 000 €, le tarif de 100 €/30 jours et la date
   du premier renouvellement avant l’achat.
3. Débiter la création une seule fois et enregistrer durablement le shop.
4. Proposition : inclure les 30 premiers jours dans les 1 000 €. Le premier
   renouvellement intervient à J+30 ; les suivants tous les 30 jours de gestion.

Exemple : création au jour 8, premier renouvellement au jour 38 à la même heure
de jeu, soit exactement cinq jours réels plus tard au rythme validé. Un
changement de culture ou de nom ne réinitialise pas l’échéance. La trésorerie
nécessaire à la création exclut la TVA mise de côté.

Le joueur peut désactiver la reconduction ; la période payée reste utilisable.
Si le renouvellement ne peut pas être payé, la vente en ligne est suspendue.
Le nom et les stocks sont conservés. Proposition : aucun nouvel abonnement
n’est facturé pendant la suspension ; la réactivation coûte 100 € pour les
30 jours suivants. Les boutiques et grossistes restent accessibles pour
reconstituer de la trésorerie.

Les conditions de premier mois, le maintien de l’ordinateur et le remplacement
des 15 €/culture sont des propositions, pas des décisions déjà confirmées.

## Prix et retour sur l’investissement

Interprétation retenue pour le cadrage : le prix de détail en ligne doit permettre
une meilleure recette par gramme que les tarifs de reprise professionnels.
Les boutiques et les grossistes achètent moins cher puisqu’ils revendent ensuite.
L’ouverture du shop donne accès à cette marge de détail en contrepartie de
l’investissement, de l’abonnement et des dépenses pour attirer des clients.

La progression recherchée est donc : premières récoltes, ventes professionnelles,
épargne après charges, création du site, puis développement des ventes au détail.
Augmenter le capital initial pour permettre d’acheter immédiatement le site ne
répond pas à cette progression et n’est pas retenu comme levier d’équilibrage.

Le barème doit satisfaire deux objectifs : une production correctement gérée
vendue aux professionnels dégage assez de bénéfice pour économiser ; un shop
qui vend suffisamment dégage une marge supplémentaire après ses propres frais.
Un tarif au gramme plus élevé ne garantit pas à lui seul la rentabilité : le
volume réellement vendu compte aussi. Le joueur peut toujours préférer une
reprise professionnelle pour écouler rapidement ses stocks.

Repère issu du barème actuel, pour un lot brut à 8/10, sans réputation, réseau,
spécialité, événement ni saturation, et au prix conseillé en ligne :

| Circuit | Recette TTC par gramme | Après TVA de jeu proposée à 20 %, avant autres charges |
| --- | ---: | ---: |
| Grossiste | 0,54 € | 0,45 € |
| Boutique partenaire | 0,90 € | 0,75 € |
| Site du joueur | 1,98 € | 1,65 € |

L’écart net de TVA entre le site et la boutique est ici de 0,90 €/g. Environ
112 g vendus en ligne chaque mois, à la place de ventes en boutique au même
barème, couvriraient les 100 € d’abonnement. Il faudrait environ 1,12 kg pour
amortir les seuls 1 000 € de création, hors abonnement et publicité. Ce sont
des repères à volume effectivement vendu identique, pas une promesse de gains ;
les coûts de culture et d’analyse sont communs aux deux circuits et ne sont
pas déduits dans ce tableau. Les contraintes de demande peuvent allonger
l’amortissement. Les nouveaux prix définitifs restent à calibrer.

## Campagnes publicitaires

Premières valeurs proposées, à équilibrer par simulation :

| Support | Dépense au lancement | Durée de jeu proposée | Durée réelle correspondante | Fréquentation supplémentaire |
| --- | ---: | ---: | ---: | ---: |
| Prospectus chez les commerçants | 60 € | 10 jours | 40 heures | +20 % |
| Instagram | 150 € | 7 jours | 28 heures | +50 % |
| Radio locale | 400 € | 5 jours | 20 heures | +100 % |

Les prospectus offrent un effet modéré et durable, Instagram un intermédiaire,
la radio un pic coûteux adapté à un commerce déjà développé. Aucun renouvellement
automatique de publicité. Les prix sont des paramètres de jeu, sans lien avec
les tarifs de prestataires réels.

Proposition de première version : une seule campagne active à la fois. Son
coût est payé au lancement ; sa date de fin ne change pas après reconnexion.
Elle exige un shop actif, et le jeu avertit si l’abonnement expire avant la fin
de la publicité. En cas de suspension du site, le bonus devient inutilisable
et les jours de campagne continuent de s’écouler, y compris hors connexion.

Le bonus augmente la capacité et le débit de demande en ligne. Qualité, prix,
réputation, saturation et stock disponible continuent de déterminer la quantité
réellement vendable. La publicité ne donne ni vente automatique ni réputation
ou clients fidèles immédiats : les livraisons gardent ce rôle.

Exemple : une capacité habituelle de 40 g devient 60 g sous Instagram, avant
les autres modificateurs. Le lancement n’efface jamais la demande déjà consommée.
La dette de demande doit garder une unité stable lors du changement de capacité,
et l’expiration du bonus ne recrée aucune commande. Ne pas afficher un nombre
précis de visiteurs tant qu’un taux de conversion visiteurs/commandes n’est pas
défini ; « Fréquentation +50 % » et les grammes de demande suffisent.

## TVA de jeu

Proposition simplifiée : **20 % inclus dans les recettes TTC de toutes les
ventes de produits**, avec mise en réserve à chaque encaissement et reversement
à la fin de chaque mois de gestion. Ce taux est une règle de simulation proposée.

Pour 120 € TTC encaissés : 100 € de recette disponible et 20 € de TVA réservée.
Calcul : TVA = TTC × 20 / 120. Retirer 20 % du TTC donnerait un mauvais résultat.
Les primes et récompenses ne sont pas des ventes de produits.

La réserve de TVA n’est pas dépensable dans le portefeuille. Le reversement
mensuel utilise cette réserve : il ne débite pas une deuxième fois le solde
disponible. Les arrondis doivent être cumulés pour que fractionner une vente
ne réduise pas la taxe.

Pour une première version, les coûts demandés restent les débits totaux affichés
(1 000 €, 100 €, 45 €), sans supplément de TVA sur ces nombres ni récupération
de TVA sur les achats. Cette simplification reste à retenir ou à remplacer
par une comptabilité plus détaillée.

## Analyses et échéancier

Proposition : générer automatiquement une analyse et sa facture lorsque la
culture est entièrement terminée, après séchage et affinage. Le résultat est
disponible immédiatement dans cette première version ; le délai de 30 jours
porte sur le paiement.

- Une culture terminée = une facture de 45 €, même si elle n’est jamais vendue.
- Fractionner le lot, transformer une partie ou vendre sur plusieurs circuits
  ne crée pas de nouvelle analyse.
- Une culture abandonnée avant sa fin ne crée pas de facture dans cette variante.
- Facturation au jour 12 : règlement exigible au jour 42 à la même heure de jeu,
  soit cinq jours réels après émission au rythme validé, même si le joueur
  n’est pas revenu ou a lancé d’autres cultures entre-temps.
- Paiement anticipé possible. À l’échéance, débit automatique si les fonds sont
  disponibles. Sinon, conserver une dette visible de 45 €, sans solde négatif,
  sans pénalité automatique ni suppression du stock dans la première version.
- Proposition de recouvrement : après réserve de TVA, les prélèvements
  d’électricité et de factures échues partagent un plafond de 50 % du versement
  net de TVA. Les factures échues sont prioritaires, de la plus ancienne à la
  plus récente. Afficher chaque retenue avant confirmation d’une vente.

La dernière règle remplace le plafond actuel réservé à l’électricité et demande
donc un calcul commun ; empiler plusieurs retenues de 50 % ne convient pas.

Le tableau de gestion affiche solde disponible, TVA réservée, factures labo,
dettes échues, renouvellement du site et publicité en cours. Annoncer les
prochaines charges avec leur date et leur délai réels ; une résolution d’étape
ne déclenche plus un changement de journée ou de mensualité.

## Équilibrage nécessaire

Le capital initial actuel est de 350 €. Avec l’ordinateur maintenu à 450 €, le
site représente 1 450 € d’investissement cumulé avant publicité.

À titre de repère, 120 g bruts au prix de base de 1,80 €/g rapportent 64,80 €
chez le grossiste à 30 % dans un marché normal, hors bonus de spécialité. Avec
la TVA proposée, il reste 54 €, puis 9 € après l’analyse de 45 €, avant même
l’électricité. Une qualité permettant la reprise à 50 % par une boutique donne
108 € TTC, soit 90 € après TVA et 45 € après analyse, avant électricité.

Il faut simuler le début de partie et vérifier que le joueur peut financer
le site par l’épargne issue de ses ventes, après charges. Les leviers à comparer
sont les coûts de production et les tarifs de reprise et de détail, en conservant
une phase d’épargne obligatoire. Mesurer le nombre de cultures rentables
nécessaires avant l’ouverture, puis le délai d’amortissement du site. Aucun de
ces paramètres existants n’est modifié par ce document. Les 45 € par culture
restent le coût demandé ; une exonération de démarrage n’est pas supposée.

## Préparation technique de la mise en œuvre

- Persister une origine temporelle serveur et la version de la vitesse du
  calendrier, puis calculer le jour
  courant à partir du temps écoulé. Aucun compteur de jours alimenté par les
  étapes. Utiliser des durées UTC pour éviter les effets de changement d’heure.
  Conserver l’ordre de verrouillage portefeuille, compte commercial, cycle.
- Ajouter nom du shop, dates d’abonnement, réserve de TVA, publicités et factures.
  Le `campaign` existant désigne un cycle commercial : les publicités nécessitent
  une entité distincte pour éviter la confusion.
- Supprimer l’ancien débit Internet dans l’ouverture du cycle et dans l’action
  d’activation. Une simple modification du texte ou du prix TypeScript ne suffit pas.
- Vérifier côté serveur que le site a été créé et que l’abonnement est actif
  avant tout devis ou vente en ligne. L’ancienne action Internet et la possession
  de l’ordinateur ne doivent pas contourner le paiement des 1 000 €.
- Calculer les frais, bonus, échéances et règlements côté serveur, atomiquement.
  Traiter les échéances passées avant un nouveau devis ou paiement, dans l’ordre
  chronologique, avec un reçu unique par période ou facture. Le navigateur ne
  fait qu’afficher une estimation depuis le dernier instant serveur connu.
  Limiter la validité des devis à la prochaine expiration qui change leurs
  conditions : abonnement, publicité ou période commerciale. Une reconnexion
  ne décale aucune date d’échéance et ne crée aucune période déjà traitée.
- Prévoir une migration sans factures rétroactives pour les anciennes cultures
  et une règle explicite pour les joueurs qui possèdent déjà un accès en ligne.
  Proposition : conserver leur ordinateur et leur demander de créer le shop,
  sans reprendre leurs anciennes ventes ni supprimer leurs stocks.
- Conserver l’idempotence et la précision des ventes existantes ; ne pas écraser
  les correctifs SQL récents de partenaires, demande, arrondis et spécialités.

Vérifications à réaliser avec l’implémentation : juste avant/après 120 heures,
passage du mois, absence de plusieurs mois, indépendance vis-à-vis de l’horloge
du navigateur et des changements d’heure, culture abandonnée, répétition d’une
résolution ou d’un paiement sans avance du calendrier, trésorerie
insuffisante, accès en ligne verrouillé avant création du site, impossibilité
de contourner l’achat via l’ancienne action Internet, suspension/réactivation,
publicité expirée, ventes fractionnées,
TVA tous circuits, migration des comptes existants et parcours mobile complet.
Le dépôt contient des tests Vitest et un harness PostgreSQL local PGlite dans
`scripts/test-placard-commerce.mjs` pour ces vérifications.
