# Le Placard - Game design et architecture MVP

Statut: recherche initiale conservee + orientation jouable actuelle  
Univers: L'Arene / Hemp Heroes / carnet de degustation  
Plateforme: web responsive, Next.js, Vercel et Supabase

## Reprise du plan — 21 octobre 2026

Les améliorations précédentes ont été regroupées dans le commit `ff1687c`,
poussé sur `master` à la demande du joueur. Les mentions « local » dans les
comptes rendus datés ci-dessous décrivent leur état au moment de la recette.
Les migrations boutique, merch et studio `20261020000400` à `20261020000600`
ont été appliquées à la base partagée sur autorisation explicite. À la demande
du joueur du 21 octobre, les migrations `20261020000200` (contrats renouvelables),
`20261020000300` (textes et recto de Main prévoyante) et `20261021000100`
(retrait de la domiciliation) ont également été appliquées et vérifiées.
L’historique local et distant concorde : aucune migration en attente.

### Débloquer la vente des productions — correction locale du 21 octobre

Le calcul des offres ignorait les bonus positifs de séchage et d’affinage,
alors que la validation SQL utilisait la qualité commerciale complète.
Un changement de palier pouvait donc provoquer « Les conditions ont changé »
immédiatement, même après recalcul. Le calcul partagé utilise maintenant
les bonus et les pertes, sans modifier la note historique du jury.

Un refus explicite de l’offre ou de sa conservation propose désormais
« Recalculer l’offre ». Le lot, le circuit et la quantité demandée sont
conservés ; le nouveau montant est présenté avant une nouvelle confirmation.
Le contexte du lot dans le bon de commande provient également du serveur.
Un recalcul échoué ne réactive pas l’ancienne offre. Si seule la réponse de
vente est perdue, le réessai conserve la même clé de transaction, même après
expiration, pour retrouver le reçu sans créer une seconde vente.
Fermer puis rouvrir le dialogue dans le comptoir conserve cette demande ;
une actualisation en arrière-plan n’efface plus l’erreur de confirmation.

Cette correction reste locale et ne nécessite aucune migration SQL.
Validation : 134 tests unitaires/API, 164 contrôles SQL isolés et quatre
groupes navigateur réussis, avec contrôles à 320, 390 et 1 440 px. La recette
de récupération est reproductible avec
`node scripts/audit-placard-commerce.mjs --quote-recovery` ; son rapport et
ses captures sont dans `output/placard-commerce-quote-recovery/`.

### Retrouver sa préparation et son lot — suite locale du 21 octobre

Le détour « Modifier le plan » conserve désormais les cartes choisies, leur
ordre et leurs copies, ainsi que l’Héritage. Le bouton « Préparation » dans
l’en-tête de l’entrepôt revient au même contexte de culture. Ces préférences
restent dans l’onglet, séparées par compte ; sans stockage navigateur, elles
restent en mémoire pendant la navigation. Un choix volontairement vide est
conservé. Aucun lancement, réservation de cartes ou achat n’est automatique.

Au retour, les choix sont vérifiés contre l’inventaire confirmé. Seules les
copies devenues indisponibles et un Héritage confirmé absent sont retirés,
avec une explication ; aucun remplacement n’est ajouté. Une lecture inconnue
ou échouée n’efface pas les choix. Le démarrage confirmé ou la reprise d’une
culture active libère le brouillon. Les archives et la visite du jury ne le
consomment pas ; les états de jeu enregistrés restent prioritaires.

« Gérer le stockage » et « Protéger le surplus » transmettent maintenant
l’identifiant exact de la récolte. Après chargement, le lot est repéré par
un texte et un contour, puis reçoit le focus sous l’en-tête fixe, même à
320 px. Le retour retrouve sa ligne dans « Mes récoltes ». Les lots homonymes
ne sont jamais interchangeables. Un lot absent et une lecture indisponible
ont des messages distincts et une actualisation par lecture seule ; le
rafraîchissement périodique ne reprend pas le focus pendant une action.

Ce lot reste local : aucune migration, écriture distante, publication,
modification de prix, récompense ou règle de jeu. La recette des parcours
utilise les vrais composants et un transport en mémoire dans
`scripts/audit-placard-journey-continuity.mjs` ; les preuves et captures sont
regroupées dans `output/placard-journey-continuity/`.

Validation : 50 tests unitaires ciblés, 21 groupes de parcours navigateur
(320, 390 et 1 440 px), 156 contrôles de stockage et 22 scénarios de préparation
réussis. TypeScript, ESLint et compilation de production passent également.
La recette navigateur n’a émis aucune requête distante ni erreur navigateur.

### Application Supabase — 21 octobre 2026

La simulation a limité l’application aux trois migrations ci-dessus. Les
contrats disposent de leurs index, triggers et RPC ; leur table et leur
séquence restent privées, avec accès aux deux RPC réservé à `service_role`.
Les textes Héritage correspondent à la main de 10 cartes et l’illustration
v6 est disponible sur le site, identique au fichier local. Les renouvellements
de domiciliation sont retirés, sans règlement ni remboursement rétroactif.

Le retrait a été rendu compatible avec le code précédemment publié avant
application : les cultures distantes conservent le format `home`/`external`.
Le backend local utilise `external` pour le risque normal lorsque le serveur
confirme le retrait ; l’ancien backend peut encore lancer `home`. Le marqueur
`retired` reste une capacité du bilan commercial, sans être écrit dans ces
cultures. Le moteur publié garde ainsi son ancien tirage jusqu’au déploiement
du nouveau code ; les cultures existantes gardent leur scénario de départ.

Validation : 321 contrôles SQL contrats, 110 contrôles SQL retrait, 60 tests
TypeScript, 285 assertions de lecture et de jeu avec le parser et le moteur
du commit `ff1687c`, contrôle des permissions sur 336 migrations et ESLint.
Les vérifications distantes sont en lecture seule, sans appeler de RPC de
règlement : les empreintes des 339 cultures, 26 portefeuilles, 761 écritures
et 998 reçus contrôlés sont inchangées, comme les autres fonctions et les
permissions existantes. L’agrégat des comptes commerciaux a évolué entre les
lectures sur la base active ; aucune égalité complète de ces lignes n’est
revendiquée. Le SHA du déploiement Vercel n’a pas pu être confirmé (403) ;
la compatibilité a été vérifiée avec le code Git, et l’asset public par GET.

Preuves : `output/game-migrations-2026-10-21/application-status.json` et
`output/retirement-shared-compat/report.json`. Aucun commit, push ou
déploiement du site n’a été effectué pendant cette application.

### Du verdict au bon lot — continuité locale du 21 octobre

Après un entraînement ou un duel officiel, la note du jury et les conditions
d’affinage sont visibles dans le verdict, sans ouvrir l’analyse détaillée.
L’action principale « Voir ce lot au comptoir » conserve l’identité de la
Fleur jugée jusque dans la rubrique de vente. La prochaine culture reste
accessible par une seconde action. Les manches, les gains et les reçus
gardent leurs valeurs ; aucun duel, achat ou traitement n’est relancé par
la navigation.

La recette a également corrigé une fermeture intempestive du verdict officiel :
sa confirmation est fermée avec l’ouverture du résultat, avant les lectures de
rafraîchissement. Le verdict reste ainsi disponible pour choisir la suite.

Le lien se fonde sur la Fleur soumise à l’entraînement ou sur le duel officiel
correspondant au reçu, jamais sur une autre Fleur sélectionnée entre-temps.
Une identité absente ne produit pas de lien supposé. Le comptoir retrouve
le lot brut, ou un produit préparé de cette récolte avec du stock restant.
Si le lot n’est plus disponible, il le signale et propose de l’actualiser ou
de consulter volontairement les autres lots. Une réponse de stock incomplète
reste une erreur de lecture, sans sélection d’un lot de remplacement.

Dans le stockage, un surplus propose aussi « Ajouter des contenants », même
sans offre grossiste. Ce bouton ouvre et focalise la configuration existante,
directement devant les zones et leurs actions, avec la variété, une référence
de lot et le surplus réel en grammes. La quantité
à protéger ne vient pas de l’offre commerciale, qui peut être partielle.
Un retour rejoint la fiche du même lot. Le rappel suit l’état actualisé ;
un échec de lecture ne prétend pas que le besoin est résolu.
La capacité reste répartie par les règles existantes entre les lots qui en
ont besoin ; l’achat nécessite toujours le choix puis l’enregistrement du plan.
Les états occupés, les brouillons non enregistrés et les erreurs conservent
leurs protections. Un plan invalide renvoie à sa correction.

Ce lot n’ajoute aucune migration et ne modifie ni les règles du jury, ni les
prix, ni les récompenses, ni la durée d’affinage. Il reste local, sans commit,
push, modification de Supabase ou déploiement.

Validation : 38 tests ciblés de commerce et sélection du lot, TypeScript,
ESLint ciblé et compilation locale passent. La recette de stockage conserve
ses 152 contrôles réussis ; 36 contrôles ciblés supplémentaires valident le
focus directement sur les choix de capacité. Les captures à 320 et 1440 px
sont inspectées, avec deux surplus distincts, offre partielle ou absente,
brouillon, erreur de lecture, retour au même lot et aucune écriture implicite.
Rapports dans `output/storage-density/after-report.json` et
`output/storage-density/after-protection-report.json`.
La recette `scripts/audit-placard-verdict-continuation.mjs` monte le véritable
écran joueur et vérifie onze parcours, dont entraînement et duel officiel à
320, 390 et 1440 px, lots homonymes, identité manquante, lot absent et lecture
indisponible ou malformée. Elle contrôle le focus au comptoir, la conservation
de l’identifiant et l’absence d’écriture commerciale. Rapport et captures
dans `output/placard-verdict-continuation/`, avec API en mémoire uniquement.
Les quatorze scénarios de régression du jury passent également, dont paysage,
préparation au clavier, fermeture pendant une requête et récupération après
vingt secondes sans nouvelle mutation. Le rapport existant est actualisé dans
`output/ux-implementation/jury/results.json`.
L’aperçu isolé de ce lot est disponible sur `http://127.0.0.1:3421/` :
entraînement, confirmation, puis accès au lot depuis le verdict.

Les deux suites de continuité repérées après ce lot — préparation pendant
le détour par le plan et lot ciblé entre récoltes et stockage — sont traitées
dans la suite locale « Retrouver sa préparation et son lot » ci-dessus.

### Retrouver des soutiens entre deux cultures — suite locale

La préparation de la main propose maintenant un accès aux récompenses quand
le stock confirmé contient moins de dix soutiens. Elle affiche le nombre
réel de copies et de références, puis privilégie un pack déjà acquis, le pack
de bienvenue encore disponible, une récompense de cartes à récupérer ou un
objectif actuellement débloqué qui en attribue. Les missions d’argent ne sont
pas présentées comme des packs ; un objectif futur verrouillé n’est pas promis.

Un pack s’ouvre sur place. Les missions s’ouvrent dans une fenêtre sur le
parcours concerné ; le retour conserve la campagne, l’Héritage et la sélection.
Les cartes reçues rejoignent l’inventaire sans s’ajouter automatiquement au
deck. La consultation n’achète, ne réclame et n’ouvre rien automatiquement.
À partir de dix copies, cet accès disparaît, tout en laissant finir une
ouverture déjà engagée. Un inventaire inconnu ne devient pas un stock vide.
L’essai guidé et une culture en cours gardent leurs parcours propres.

Les états indisponibles restent explicites. Après une réponse d’ouverture
interrompue, l’inventaire et le droit au pack sont relus : une seconde ouverture
n’est proposée qu’après confirmation du droit restant. La fermeture d’une
mission pendant son attribution n’empêche plus l’actualisation de la collection.
En l’absence de récompense immédiate, les missions restent consultables et un
détail rappelle les conditions d’entraînement : une carte par victoire, une
Fleur consommée par duel, dix entraînements au maximum par jour.

L’[étude de continuité](../../output/placard-support-continuity/report.md),
reproductible avec `scripts/audit-placard-support-continuity.mjs`, prolonge
l’étude de la main de dix : 132 comptes fictifs, trente cultures successives,
trois politiques et trois circuits, soit **35 640 cultures simulées**.
La rotation des trois Buddies initiaux, les copies consommées et les
récompenses effectivement obtenues sont suivies entre chaque culture.
Pour la politique prudente, le circuit limité aux missions culture/qualité
termine avec un stock médian de quatre cartes et 9,44 % de cultures sans aucun
soutien jouable. Avec entraînement, ces valeurs deviennent douze cartes et
1,84 %. Une collection non vide ne garantit donc pas un choix utilisable.

Ces résultats sont conditionnels : l’économie, l’entretien, les ventes et
plusieurs autres sources de récompenses sont exclus ; le circuit PvP utilise
une cohorte fictive. Ils ne démontrent ni financement de trente cultures,
ni comportement réel des joueurs, ni rétention. Le lot améliore l’accès aux
gains existants sans modifier dotations, coûts, XP ou difficulté. L’observation
de parties réelles reste nécessaire avant une décision d’équilibrage.

Validation : 89 tests ciblés, compilation locale et ESLint passent. La recette
`scripts/audit-placard-support-recovery.mjs` valide 37 groupes de contrôles,
complétés par six contrôles de focus ciblé à 320, 390 et 1440 px ; la recette
existante de préparation conserve ses 21 scénarios réussis. Les captures et
rapports sont dans `output/placard-support-recovery/`. Un contrôle supplémentaire
valide le pack de mission ouvert malgré une réponse perdue et une lecture
indisponible : une seule ouverture, actualisation par lecture seule, collection
réconciliée et sélection conservée. La simulation vérifie
777 826 égalités de conservation des copies et chacun des 35 640 lancements
au regard de la rotation. Aucun appel distant ni migration pour ce lot.
L’aperçu isolé est disponible sur `http://127.0.0.1:3406/`, avec des données
fictives en mémoire. Aucun commit, push ou déploiement n’est effectué.

### Navigation du commerce et retrait de la domiciliation — lot local suivant

La barre remplace les catégories génériques Améliorations et Réglages par
six destinations directes : Activité (stocks et ventes), Prix CBD (fleurs et
extraits), Merch (nom et collections), Promouvoir (audience et campagnes),
Site internet (niveaux et abonnement) et Studio (photos et identité).
Chaque onglet indique son rôle. Le Merch reçoit un accent abricot ; tous
les onglets restent visibles à 320 px et utilisables au clavier.

Le nom de l’entreprise se modifie gratuitement dans Merch, avec confirmation
et sans perdre les stocks, les ventes ou l’audience. Ce même nom sert au site
et au Studio. Les liens de prérequis ouvrent directement la bonne rubrique.
Le calendrier et les mouvements comptables restent accessibles dans un
détail de Site internet ; les factures conservent leur écran dédié.

La domiciliation sort du parcours et des nouvelles commandes. Les nouvelles
cultures locales utilisent le risque de vol normal ; les cultures historiques
conservent leurs conditions de départ et leurs relectures déterministes.
La migration `20261021000100_kq_retire_domiciliation.sql` arrête les anciens
renouvellements sans modifier les achats, reçus ou écritures comptables passés.
Elle préserve les autres échéances et les permissions existantes.

**Migration appliquée à la base partagée le 21 octobre, sur demande du joueur.**
Supabase confirme désormais ce retrait. Le pont de compatibilité décrit
ci-dessus permet de continuer les cultures depuis l’ancien et le nouveau
code sans réécrire leur état. Aucun push ni déploiement n’est effectué pour ce lot.

Recette : `scripts/audit-placard-shop-activity.mjs`, captures et rapport dans
`output/shop-navigation/`, avec composants réels et données en mémoire.
Le script SQL `scripts/test-placard-retire-domiciliation.mjs` vérifie localement
le retrait, les archives, les permissions et la compatibilité des lancements.
Validation : 36 groupes de contrôles navigateur pour la navigation, le
renommage et les finances ; 69 contrôles complémentaires des ateliers Merch,
Studio et Site à 320, 390 et 1440 px ; 69 vérifications SQL de la migration.
Les tests ciblés du moteur, des sauvegardes, des tutoriels et du backend passent,
ainsi que TypeScript, ESLint ciblé, la compilation locale et le contrôle des
permissions sur 336 migrations. L’aide à la découverte
décrit les nouveaux onglets, l’ouverture gratuite et les ventes automatiques.
L’aperçu isolé utilise `http://127.0.0.1:3402/`, avec des données fictives.

### Deux rayons dans le pilotage de la boutique — nouveau lot local

Le merch vendait déjà, mais la vue d’ensemble, l’activité et le registre
continuaient à présenter uniquement les fleurs. Une boutique avec des articles
exposés pouvait ainsi être décrite comme vide. Ces trois écrans montrent
maintenant les deux rayons et leurs reçus récents, classés par date.

- Les quantités restent explicites : paquets de fleurs et d’extraits, articles merch.
  Le merch ne fait pas progresser les prérequis de commandes de fleurs.
- Les articles conservent leur illustration CBD, leur stock, leur prix et leur
  état : en rayon, hors vitrine ou épuisés. La suspension du site conserve leur
  publication et leur stock ; elle arrête les ventes estimées.
- Le prochain conseil tient compte d’une collection sans fleurs en vente :
  exposer le stock, gérer les références ou préparer une nouvelle série.
  Un accès direct ouvre maintenant l’onglet Merch.
- Le registre propose le choix Fleurs et extraits / Merch, ouvre le merch lorsqu’il est
  le seul stock connu et conserve les reçus des deux rayons dans un historique
  commun. Les frais, la satisfaction des fleurs et le coût de fabrication
  enregistré des articles restent consultables.
- Les versements affichés viennent des reçus et compteurs enregistrés après
  les retenues de jeu. Ils ne sont pas présentés comme du bénéfice. Les cadences
  sont des estimations issues des règles existantes ; elles n’ajoutent ni visites
  ni ventes. Un état absent reste indisponible, sans faux zéro.
- L’activité indique les niveaux réels de photo, de marque et de récits.
- Un inventaire incomplet ne bloque plus l’activité à cause des ateliers
  montés en arrière-plan : les actions merch attendent un stock confirmé,
  tandis que les autres rayons restent consultables.

Ce lot ne modifie ni prix, récompenses, moteur de vente, données distantes,
ni migrations. Les vérifications et captures de la recette isolée se trouvent
dans `output/shop-activity/`. Elle utilise les composants réels avec
une API en mémoire, sans compte joueur distant. L’aperçu se lance avec
`node scripts/audit-placard-shop-activity.mjs --preview`.

Validation : 237 tests ciblés passent (activité, stratégie commerciale, merch,
studio, ventes et campagnes), ainsi que TypeScript, ESLint ciblé et la
compilation de production locale. La recette navigateur valide 32 groupes
de contrôles : onze scénarios à 320 et 1440 px, navigation clavier, données
absentes, suspension du site et boutons accessibles sans chevauchement.
L’aperçu isolé de ce lot est disponible sur `http://127.0.0.1:3401/` avec
des données fictives. Ces tests ne constituent pas une mesure de rétention.

## 0. Contrat actuel — campagne commune et La Botte, 13 octobre 2026

Les sections historiques plus bas documentent la premiere piste de simulation
quotidienne. Elles restent utiles pour le vocabulaire, la sobriete technique et
les futures extensions, mais ne decrivent plus la boucle jouable actuelle.

Cette section décrit l’implémentation préparée pour le lancement du 1er novembre
2026. Elle prime sur les propositions historiques ci-dessous. L’application
des migrations et la publication du site sont des opérations distinctes.

Ajustement du 19 octobre : la rotation ci-dessous passe à deux autres
variétés. La migration `20261019000100_kq_buddie_rotation_two.sql`, appliquée
et vérifiée sur Supabase le 19 octobre, convertit les historiques existants.
Le code associé reste à publier. Avec trois variétés distinctes, le cycle
A → B → C → A est possible. Une campagne exige toujours que toutes les zones
actives affectées participent : les zones dont le Buddie est encore bloqué
doivent être désactivées ou réaffectées avant le lancement.

Le budget de départ passe à 1 000 € pour les nouveaux portefeuilles, avec
le bonus de 650 € du Trésorier conservé. La migration
`20261019000300_kq_starting_budget.sql` est appliquée et vérifiée sur Supabase
le 19 octobre. Les trois espaces équipés de 1 m² sont déjà offerts.

Premier lot d'améliorations après l'audit du 19 octobre, préparé localement :

- **Départ jouable** : le pack de bienvenue Buddies contient trois communes
  distinctes, sans remplacement par un bonus. Sa provenance est liée au ticket
  et son ouverture possède un reçu rejouable sans nouvelle attribution. La
  migration `20261019000400_kq_starter_buddies.sql` complète une seule fois les
  anciennes collections concernées jusqu'à trois variétés jouables actives.
  Les tirages, bonus et quotas des packs ordinaires sont conservés. L'offre
  gratuite est annoncée avant l'achat dans la boutique.
- **Mission communautaire** : « Ton entrepôt sur X » récompense le partage
  d'une capture par un pack Buddies, une fois par compte, après validation
  humaine de la preuve du post. La migration `20261019000200_warehouse_twitter_mission.sql`
  réutilise l'envoi privé de preuve et l'attribution atomique existants.
  Aucune publication automatique ni connexion au compte social n'est ajoutée.
- **Suite des missions** : après une récompense, le centre affiche le prochain
  objectif du même parcours, sa progression réelle et son gain. Un objectif
  déjà atteint peut être réclamé directement. Un pack est ouvert avant la suite ;
  une fin de parcours invite à en choisir un autre. Une réponse absente ou un
  échec d'actualisation ne crée jamais une progression supposée.
- **Comprendre les duels** : le verdict présente un repère bref fondé sur
  l'analyse existante et une action visible pour préparer ou reprendre la culture.
  Le repère distingue déficit mesuré, égalité, variation du jury et données
  insuffisantes. Les notes, récompenses et chances de victoire ne changent pas.

Les quatre migrations du 19 octobre sont appliquées à la base distante et
vérifiées. Les modifications du code du site restent locales.

Validation locale : test PostgreSQL `scripts/test-placard-starter-buddies.mjs`,
contrôle des permissions sur 329 migrations, tests ciblés missions/jury/règlement,
ESLint et TypeScript validés. Les sondes Chromium passent 28 scénarios avec
composants réels et API simulées, dont navigation au clavier et largeur de 320 px :
[départ offert](../../output/ux-game-improvements-2026-10-19/starter/report.json),
[continuité des missions](../../output/mission-continuation/report.json),
[verdicts du jury](../../output/ux-implementation/jury/results.json).

### Bilan local de l'amélioration UX — 19 octobre 2026

La seconde passe termine les points de lisibilité et de continuité de la boucle :

- **Décider après les dés** : « Si tu valides maintenant » utilise la résolution
  réelle de l'étape pour présenter santé, résultat, secours de première culture
  et effet automatique de l'Héritage. Les conséquences sur qualité, XP et
  pression restent dans des détails repliés. Aucun lancer futur ni diagnostic
  caché n'est révélé. Un Danger explique pourquoi une cible atteinte peut
  rester fragile ; la pression ne promet plus une quatrième réussite impossible.
- **Engager une carte en connaissance de cause** : la confirmation rappelle
  le coût en XP de culture, les XP disponibles, les copies possédées avant le
  choix, l'avantage et le risque. Le tarif de l'entretien est plus lisible.
- **Retrouver sa réserve** : Sylvain commente le lot prioritaire dans l'écran
  existant. Les surplus passent avant les lots affinés, puis les prochaines
  maturités. Les dates viennent du serveur ; une échéance passée ne suffit pas
  à annoncer un lot prêt. Le comptoir reste consultable pendant le curing,
  avec le compromis explicite entre grossiste et boutiques après maturité.
  Les offres et les confirmations restent celles du commerce.
- **Se faire un nom au village** : le classement devient le « Tableau du
  village ». Le pack de série est présenté comme un bonus distinct ; un accès
  aux objectifs personnels rappelle que les défaites n'effacent pas les XP
  métier. La progression du bonus utilise la jauge commune avec sa valeur
  lisible, et une donnée d'entreprise manquante n'est pas présentée comme zéro.

La direction reste celle des Chanvriers Bretons : quartier illustré, Sylvain,
crème, turquoise, encre et panneaux orange abricot. Les interventions de la
mascotte répondent à une situation de jeu. La reprise repose sur des objectifs,
des lots à retrouver et des choix à améliorer ; aucune nouvelle obligation
de connexion ni minuterie punitive n'a été ajoutée.

**Économie de départ conservée après vérification.** Avec le kit offert dans
la configuration initiale simulée, une culture complète représente 117,10 € de charges de base : 22 € de
consommables, 50,10 € d'électricité et 45 € d'analyse. Six cultures sans vente
ni récompense laissent donc 297,40 €, ou 147,40 € en payant aussi tous les
entretiens facultatifs. Ce calcul exclut les achats optionnels et les soins
spécialisés. Il provisionne les charges dès maintenant, même lorsque leur
échéance effective est ultérieure.

L'[étude économique reproductible](../../output/starter-economy-audit-2026-10-19/six-cycles-report.json)
teste 24 000 cultures : 500 comptes par scénario, six cycles, quatre stratégies
et deux circuits commerciaux. Elle conserve le véritable kit, trois variétés
communes en rotation, les situations précédentes, les cartes consommées, la TVA
et les quotas. Les missions sont comptées seulement lorsqu'elles sont atteintes
et réclamées. Aucun compte simulé n'épuise sa trésorerie sur ces six cycles.
Dans le scénario boutique, le solde médian passe de 1 629 € sans cartes ni soins
à 1 774 € avec un booster normal utilisé avec parcimonie et de l'entretien ciblé.
Les rares et épiques du booster sont écartées sans remplacement. Ce sont des
scénarios calculés, pas des résultats de joueurs ni une stratégie optimale.

Les 1 000 €, les prix et les seuils de qualité sont donc conservés. La rupture
de débouché à 6,5/10 et les parcours avec achats optionnels resteront des points
à observer avec de vrais joueurs ; augmenter encore le budget ne serait pas
justifié par cette simulation.

Appréciation de conception après vérification locale, sur 100 :

| Axe | Note | Motif principal |
| --- | ---: | --- |
| Prise en main | 90 | Kit offert, trois variétés distinctes, rotation continue sur une zone. |
| Lisibilité des décisions | 88 | Résolution conditionnelle fidèle, coûts et risques explicites. |
| Progression et objectifs | 88 | Suite des missions, reprise des lots, plusieurs voies de progression. |
| Ambiance et identité | 90 | Village breton, Sylvain et langage visuel cohérent. |
| Difficulté et choix | 82 | Les décisions influencent le résultat ; le seuil commercial reste abrupt. |
| Mobile et accessibilité | 84 | Parcours clavier et 320 px vérifiés ; validation sur appareils et aides techniques réels encore nécessaire. |
| **Ensemble** | **87** | Estimation UX, pas une mesure de rétention. |

Vérifications : 4 053 tests examinés dans la suite globale ; les quinze attentes
anciennes relevées ont été corrigées puis leurs six suites revalidées. Elles
concernaient les tarifs et illustrations déjà changés, les abonnements de
l'interface et la représentation des jauges et factures. TypeScript, ESLint
ciblé et le contrôle des permissions des 329 migrations passent.
Les parcours navigateur emploient les vrais composants avec des API locales
simulées : [culture et confirmations](../../output/placard-culture-clarity/report.json),
[réserve et comptoir](../../output/storage-continuation/report.json),
[classement](../../output/placard-workshop/dashboard/season-report.json), en plus
des parcours de départ, missions et jury cités ci-dessus. Les transitions
du tutoriel, les erreurs, le clavier et les petits écrans sont inclus.

Après l'audit local, les quatre migrations du 19 octobre ont été appliquées
sur demande explicite à Supabase `eyowwwpdmfrulhkpvlnf`. Les quatorze contrôles
distants en lecture seule passent : historique des migrations, rotation solo
et campagne, défaut de 100 000 centimes, mission X, catalogue de 33 communes,
permissions et conservation exacte du corps de la fonction de tirage ordinaire.
Le rattrapage a attribué onze communes à cinq anciens bénéficiaires ; aucun
ancien bénéficiaire ne reste sous trois variétés jouables actives.

Le lot isolé est à jour. Les quatre migrations distinctes du 18 octobre
`20261018000500` à `20261018000800` restent en attente et n'ont pas été incluses.
Les [résultats de vérification](../../output/game-ux-migrations-2026-10-19/verification.json),
le manifeste et les journaux sont conservés dans `output/game-ux-migrations-2026-10-19/`.
Le code du site reste à déployer ; aucune publication sur X n'a été effectuée.
La rétention réelle ne sera mesurable qu'après usage par des joueurs.

### Suite du plan — quartier, choix d'entretien et observation

**Consigne confirmée le 19 octobre : cette suite reste uniquement locale.**
La préparation de publication a été arrêtée avant création d'un déploiement ;
le contrôle Vercel en lecture seule confirme la production inchangée. Les quatre
migrations supplémentaires du 18 octobre restent préparées et non appliquées.
Les quatre migrations du premier lot, déjà appliquées avant cette consigne,
ne sont pas annulées. Aucune modification des paramètres d'ouverture n'a été faite.

Le quartier donne la priorité à la carte du village et à la prochaine action.
Un seul bandeau compact avec le portrait de Sylvain oriente vers la culture,
le jury, le comptoir ou le matériel ; les récoltes sans contenant gardent la
priorité. La grande carte de conseil et de progression des ventes a été retirée
le 20 octobre, à la demande du joueur, pour libérer de la place. Aucune première
visite ni durée d'absence n'est inventée.
La carte possède un son de navigation discret, activé explicitement et coupé
par défaut ; le son utilise le mécanisme existant du menu. Son indisponibilité
n'empêche aucune action. La recette passe quinze scénarios, dont clavier,
320/390/768/1440 px, carte isolée du tutoriel, erreur de données et panne audio :
[rapport du quartier](../../output/placard-village-ambience/report.json).

L'étude économique prolongée couvre 60 000 cultures simulées : 250 comptes
par scénario, trente cycles espacés de six heures, quatre stratégies et deux
circuits commerciaux. Elle conserve le kit de départ et provisionne les
charges immédiatement. Les ventes restantes non réalisées ne sont pas
valorisées ; les achats d'équipement et les décisions adaptées d'un joueur
ne sont pas représentés. Les soldes négatifs sont des alertes du modèle,
pas des faillites observées ni des parties réellement jouées à découvert.
Le soin systématique et le seul grossiste épuisent la réserve de certains
scénarios sur la durée. La [simulation](../../output/starter-economy-audit-2026-10-19/thirty-cycles-report.json)
justifie une aide au choix, sans changement du budget ni des tarifs.

L'entretien est présenté comme facultatif. Quand la santé est au moins à
90/100 et qu'aucun problème n'est actif, le panneau rappelle la possibilité
de poursuivre sans payer. Le montant vient du tarif réellement proposé :
5 € par activation actuellement, jusqu'à 25 € pour les cinq étapes possibles.
Les effets, erreurs, confirmations et conditions de paiement restent visibles ;
aucune note de jury ni aucun prix de vente ne sont garantis.
Les 74 contrôles du [parcours de soins](../../output/culture-care/result.json)
passent, y compris poursuite sans débit, paiement de 5 €, reprise d'un reçu,
clavier et petits écrans.

La commande `node scripts/report-placard-player-progression.mjs --linked`
produit un rapport agrégé en lecture seule, sans identifiant ni nouveau suivi
navigateur. Elle mesure récolte, deuxième cycle et vente dans les sept premières
journées, ainsi que l'activité de culture observée entre 24–48 h et 168–192 h.
Les cohortes sont hebdomadaires en Europe/Paris ; seuls les comptes dont la
fenêtre est terminée entrent au dénominateur. Une campagne multizone compte
pour un cycle et une vente automatique ne devient jamais une visite.
Dix-sept contrôles PostgreSQL vérifient les calculs et leurs bornes.

Le premier relevé distant ne contient que sept comptes ayant lancé une culture,
avec comptes de test et administrateurs non distingués. Il sert de référence
technique et ne permet pas de conclure sur la rétention publique. Les visites
sans action et le tutoriel local ne sont pas mesurables avec ces sources.
Les essais sur téléphones physiques et lecteurs d'écran restent à effectuer.

Validation de cette suite : 424 fichiers et 4 060 tests unitaires passent ;
la compilation de production locale, TypeScript et ESLint ciblé passent.
Les migrations différées ont été répétées dans PostgreSQL isolé : 953 contrôles
post-récolte et 873 contrôles de l'ordre réel d'application, plus la suite
bancaire. Le [compte rendu local](../../output/game-followup-release/local-completion.json)
conserve les résultats et les limites ; il ne constitue pas une publication.

### Village actif et premier contrat — 20 octobre 2026

Le code visuel reste local. Le village représente trois données réelles :
l'entrepôt ouvre ses portes sur une culture éclairée, le marché expose des
caisses et un fanion lorsque des lots sont prêts, et le jury installe sa table
et ses lanternes lorsque des Fleurs sont disponibles. Les scènes
ont été agrandies après la première recette, où les détails étaient trop
discrets. Les bâtiments actifs portent un libellé turquoise avec leur état ou
leur quantité ; les états au repos restent lisibles, y compris à 320 px sans
zoom. Les valeurs absentes ou invalides n'allument aucun signal et ne sont
pas présentées comme zéro. Les ajouts restent dans l'illustration existante,
sans nouveau panneau, sans déplacer les accès et avec respect de la réduction
des animations.

Une seconde correction remplace les éléments SVG géométriques par trois
fragments peints à partir de la carte d'origine avec imagegen natif :
bois, pots, sachets, bocaux, tissu et éclairage reprennent son trait, sa
perspective et ses textures. La carte v6 et ses huit zones cliquables restent
la référence ; chaque fragment apparaît indépendamment selon les données.
Seuls les bords des fragments sont légèrement adoucis, sans rendre les portes
ou le mobilier transparents. Les halos d'activité permanents sont retirés ;
les indications de survol, de sélection et de focus sont conservées.
Les trois WebP pèsent ensemble 54 218 octets. Les fichiers, les coordonnées
et le prompt exact sont dans
[le manifeste des illustrations](../../public/placard/map/placard-activity-v1.json).

Le résumé se rafraîchit au retour dans l'onglet, après les événements
d'équipement, de stockage ou de progression, et toutes les deux minutes
lorsque la page est visible. Les vérifications du rendu couvrent quatorze
scénarios sur les composants réels : activité et repos, données inconnues
ou invalides, grands compteurs, accès aux huit bâtiments, clavier et
réduction des animations. Les captures attendent le décodage des images et
couvrent aussi chaque activité séparée et les raccords en zoom à 390 et
1440 px. TypeScript et ESLint ciblé passent. Rapport et captures dans
`output/placard-building-activity/`. Le serveur habituel sur le port 3000
sert les composants modifiés ; ces effets dépendent des données de la partie.

Le premier contrat, **Main légère**, se choisit dans les préparatifs ou dans
**Missions → Contrats**, avant de lancer la prochaine culture. Il demande au
moins une récolte vivante à **8 points de Qualité de culture** et **deux cartes
Botte jouées maximum** sur toute la campagne. Le Sol vivant et l'Héritage ne
comptent pas. La prime de **30 € de jeu**, unique par compte, reste à réclamer
après vérification de la récolte enregistrée. Aucun frais, délai ou prélèvement
de Fleur ; un échec permet de retenter sur une prochaine culture. Le suivi est
compact pendant la partie et le résultat s'ouvre à la récolte.

Le seuil a été rapproché des simulations existantes du kit de départ :
1 037 des 3 000 cultures sans cartes remplissent les critères (34,57 %),
et 470 des 500 comptes y arrivent au moins une fois en six cycles. Il s'agit
d'un filtrage rétrospectif de `six-cycles-samples.json`, sans acceptation de
contrat ni stratégie adaptée, pas d'un taux de réussite observé chez les
joueurs. Le contrat vise le début de progression ; il ne remplace pas un
défi expert pour les entrepôts avancés.

La migration `20261020000100_kq_light_hand_contract.sql` lie le contrat au
nouveau leader de campagne, protège l'attribution par verrou et conserve un
reçu. Sa table est privée ; seules les deux RPC de lecture/action sont
autorisées à `service_role`. Elle a d'abord été appliquée et testée dans
PostgreSQL isolé (PGlite).

**Le 20 octobre, après confirmation explicite de la modification de la base
Supabase partagée avec la production**, les cinq migrations manquantes ont été
appliquées : `20261018000500` à `20261018000800`, puis `20261020000100`.
Le SHA du code déjà publié a été contrôlé : il transmet les versions de
snapshots nécessaires. Les contrôles après application passent pour les
prix, la qualité, le climat, le crédit et les permissions. Les treize fonctions
à préserver sont identiques et les 300 lots existants sont conservés.
La simulation finale ne trouve plus aucune migration en attente.
Les deux RPC du contrat sont accessibles au serveur et l'accès direct à sa
table privée est refusé. Le site local habituel utilise désormais ces RPC.
Son endpoint répond `401` sans session, avec `Cache-Control: private, no-store` ;
aucune partie connectée ni action sur un compte joueur n'a été effectuée
pendant ces vérifications. Aucun commit, push ou déploiement applicatif :
ils attendent la validation locale. Les preuves sont dans
[le compte rendu d'application](../../output/game-migrations-2026-10-20/application-status.json).

Validation de cette étape : 106 contrôles SQL, 31 tests du modèle/backend/API,
23 tests de régression ciblés, TypeScript, ESLint et permissions des 330
migrations. Les recettes navigateur couvrent quinze groupes pour le contrat
et dix-sept scénarios du quartier, dont 320 px, clavier, erreurs et mise à
jour des bâtiments au retour dans l'onglet ou après modification du stockage.
La recette du contrat couvre aussi le rechargement et la reprise d'une
attribution. Les doublons SQL sont vérifiés dans une seule
instance PGlite ; la concurrence entre connexions n'est pas testée. Les
preuves sont dans `output/placard-contract/`,
`output/village-activity-proof/` et `output/placard-village-ambience/`.

L'aperçu se lance avec `node scripts/preview-placard-contract-playable.mjs`
sur `http://127.0.0.1:3282/`. Il utilise les composants du jeu, le moteur de
culture de La Relève et les vraies RPC du contrat dans PGlite, sans fichier
d'environnement ni compte distant. La partie survit à une actualisation,
mais est effacée à l'arrêt du serveur. Les autres services du jeu ne sont
pas reproduits. Les conditions d'essai (entrepôt préparé, graine 2, secours
de première culture) sont indiquées : cet aperçu ne valide pas l'équilibrage
de production. La commande avec `--audit` a joué les six étapes depuis
l'acceptation, obtenu une récolte à 8 points sans carte, réclamé les 30 € et
vérifié la reprise sans deuxième versement. Rapport et captures dans
`output/placard-contract-playable/`.

### Récolte, reçus et son du jeu — 20 octobre 2026

Le bilan de récolte remplace son ancien en-tête : illustration de Sylvain,
quantité récoltée, Qualité en points et accès direct à la réserve. Une récolte
unique conserve son nom de variété et son palier ; une campagne présente la
somme des grammes et l'intervalle des Qualités, sans additionner les points.
Une Fleur n'est annoncée enregistrée que si son identifiant de culture
correspond. Les valeurs absentes restent inconnues. L'entrée animée est brève,
uniquement après une fin de culture confirmée, sans masquer de résultat ni
retarder l'action. Les échecs restent sobres et le mode sans animation est
respecté.

Le contrat affiche désormais un reçu visible après attribution, avec le
montant crédité. Réouvrir un reçu ne signifie pas recevoir une nouvelle prime.
Les missions distinguent aussi une récompense qui vient d'être obtenue d'un
reçu retrouvé, tout en conservant leur prochain objectif. Ces éléments occupent
les écrans de résultat existants ; aucun panneau supplémentaire n'est ajouté
au quartier.

Le bouton **Son du jeu** est commun au quartier et aux activités. Le choix
reste actif pendant leur navigation, mais le rechargement repart sans son.
Une note de navigation, de courts impacts pour les dés et des motifs distincts
pour récolte, prime et verdict accompagnent seulement les actions confirmées.
Les reçus sont dédupliqués ; montage, historique, actualisation, réponse
rejouée et erreur ne déclenchent aucune célébration sonore. Passer dans un
autre onglet coupe le son et exige une nouvelle activation explicite.
Les packs conservent leur fonctionnement propre.

Les changements restent locaux et n'ajoutent aucune migration, récompense,
charge ou modification des probabilités. Les tests ciblés couvrent le
modèle de récolte, les paliers et les courses de démarrage/arrêt audio.
La recette isolée utilise les vrais composants à 320, 390 et 1440 px :
[rapport et captures des moments de jeu](../../output/placard-game-moments/report.json).
Le parcours de culture complet utilise le vrai moteur et le contrat SQL dans
PGlite : récolte à 8 points, reçu de 30 € et absence de second versement,
avec preuve du nouvel écran de récolte dans
[la recette jouable](../../output/placard-contract-playable/report.json).
Les scénarios du quartier, TypeScript et ESLint ciblé passent également.

La collection de contrats renouvelables est maintenant implémentée et testée
sur base locale isolée ; son catalogue et ses limites économiques figurent
en fin de document. L'équilibrage sur la durée avec des stratégies adaptées,
les mesures auprès de joueurs réels et les essais sur téléphones physiques
restent à effectuer.

Le 20 octobre, à la demande du joueur, la main passe localement de cinq à
dix cartes au maximum, selon les copies disponibles. Une main déjà enregistrée
reste figée jusqu’à l’étape suivante ou un changement de main autorisé.
Main prévoyante propose treize cartes pour en garder dix ; sa réserve de trois
cartes et son bonus de 2 XP restent identiques. Les coûts et le nombre de cartes
jouables par étape ne changent pas. La migration éditoriale locale
`20261020000300_kq_ten_card_hand.sql` aligne les descriptions de ce seul pouvoir
et son recto officiel, sans modifier les cultures ni les acquisitions.
Les anciennes simulations réalisées avec cinq cartes restent des résultats
historiques : elles ne valident pas l’équilibrage de la main de dix cartes,
qui doit être réévalué avec ce nouveau choix de jeu.

L’aperçu jouable local de cette version est disponible sur
`http://127.0.0.1:3290/`. L’instance précédente sur le port 3287 est conservée
et ne sert pas à valider la nouvelle main. Le texte et le recto Main prévoyante
s’affichent à jour sans modifier la base partagée : seule leur présentation
est adaptée ; l’identité Héritage enregistrée reste celle vérifiée par les RPC.

### Lire sa main et comparer une réaction — suite locale du 20 octobre

La main propose un filtre **Jouables / Toutes** et compte des choix distincts,
sans confondre les copies avec le nombre d’actions autorisées. Les illustrations
restent visibles ; le coût et le blocage se lisent en premier. Une carte
indisponible peut être consultée au clavier ou au toucher, mais sa confirmation
ne permet aucune dépense. Le résumé distingue les copies épuisées, le mauvais
moment, l’incident incompatible et l’action déjà jouée. Un manque d’XP n’est
annoncé que si ces XP suffiraient réellement à rendre une carte jouable.

Avant de brûler une réaction déterministe, la confirmation compare le bilan
**sans cette carte / avec cette carte** à partir des dés présents : résultat,
santé connue, Qualité, XP et pression. Le moteur inclut les soins, les effets
de l’Héritage et le secours disponible ; une carte qui dégrade le bilan n’est
pas présentée comme un progrès. Cette comparaison reste conditionnelle à la
validation de l’étape. Les préparations et les relances ne calculent ni ne
révèlent un lancer futur ; la simple consultation ne modifie pas la partie.

Le changement de main est conservé lorsque toutes les copies restantes sont
déjà distribuées ou qu’elles ne permettent aucune composition différente.
La vérification porte sur les copies disponibles, sans inspecter la prochaine
pioche. Un ancien tirage de cinq cartes peut toujours être complété par un
changement autorisé. Les limites de jeu, coûts, gains et probabilités des dés
sont inchangés. Ce lot ne nécessite aucune migration et reste local.

Validation du moteur : 272 tests ciblés passent, dont la conservation du
retirage inutile côté serveur, les copies physiques, les sauvegardes et les
aperçus sans révélation des relances. TypeScript et ESLint ciblé passent.
Le parcours isolé de deux cultures conserve deux mains de dix, les cartes,
les factures et la rotation ; les deux primes sont enregistrées une seule
fois par tentative. Ces vérifications fonctionnelles ne constituent pas une
mesure de difficulté ou de rétention auprès de joueurs.

La [recette des décisions](../../output/placard-card-decisions/report.json)
couvre quinze scénarios dans les vrais composants à 320, 390 et 1440 px :
filtres, clavier, toucher, inspection sans dépense, comparaison suivie du jeu
effectif et du bilan, relance sans résultat anticipé et protection pendant
l’animation. L’essai guidé signale son assistance lorsque celle-ci changerait
le résultat comparé. Les captures montrent les deux résultats empilés sur
petit écran, sans couper les libellés.

Les huit scénarios de régression de la main passent également. Un nouvel
aperçu vierge de ce lot tourne sur `http://127.0.0.1:3292/?view=game` ; les
parties d’essai des ports 3287 et 3290 sont conservées. Le jeu complet local
utilise les mêmes composants modifiés. Aucun commit, push ou déploiement
n’a été effectué pour ce lot.

### Préparer sa main de dix — suite locale du 20 octobre

Le choix des cartes montre désormais les copies sélectionnées, la première
main possible et les XP de départ. Le stock manquant et les bonus inconnus
restent signalés. Les coûts accessibles désignent chaque carte prise
individuellement : elles partagent le même budget d’XP, avec leurs conditions
d’incident, de timing et de dés. Le détail repliable des six étapes compte les
compatibilités exactes du catalogue, sans annoncer une probabilité de tirage
ni une garantie de réussite. Les doublons n’augmentent pas ce nombre
d’incidents compatibles ; les copies absentes d’un stock vérifié sont exclues.

L’XP de préparation suit le lancement réel : bonus du Chanvrier, maximum des
avantages Buddies de la campagne et effet de l’Héritage sélectionné. Une donnée
distante absente ne devient pas un bonus nul. L’essai guidé et le lancement
local gardent leurs bases distinctes. Le deck conseillé utilise les mêmes
compatibilités et le budget connu, conserve au maximum dix copies possédées
et une seule épique. Il ne s’applique qu’au clic ; les favoris restent des
choix explicites. Les actions de préparation précèdent maintenant le carrousel.
Sur mobile, elles occupent deux colonnes ; les filtres de catégorie et de
rareté sont repliables et leur sélection reste annoncée. Les illustrations
apparaissent ainsi plus tôt sans supprimer les coûts ni la limite des épiques.

L’[étude reproductible des mains](../../output/placard-ten-card-balance/report.md)
compare 5 280 cultures du moteur v3, avec 330 seeds par configuration, le kit
offert, un Buddie commun et 1 XP initial. Chaque paire conserve le même deck
et la même collection. Pour la stratégie économe avec secours initial :

| Collection simulée | Préparations sans choix, main 5 → 10 | Lancers faibles sans réaction possible, main 5 → 10 | Copies consommées par culture, main 5 → 10 |
| --- | ---: | ---: | ---: |
| Un pack | 57,5 % → 38,1 % | 89,4 % → 83,2 % | 0,95 → 1,55 |
| Trois packs | 41,1 % → 14,0 % | 79,6 % → 66,0 % | 1,46 → 2,40 |

Les 1 320 paires témoins sans carte jouée ont exactement les mêmes résultats.
La Qualité moyenne augmente de 0,33 et 0,51 point avec la stratégie économe,
sans variation de mortalité. Le manque d’XP seul explique peu des réactions
indisponibles dans ces configurations. Ce lot ne modifie donc ni les coûts,
ni les gains d’XP, ni la difficulté des dés. La consommation supplémentaire
est étudiée sur plusieurs cultures successives dans le lot « Retrouver des
soutiens entre deux cultures » du 21 octobre ci-dessus, puis devra être
confrontée à des parties réelles ; les trois packs simulés ne constituent pas une
nouvelle dotation offerte. Cette étude ne mesure ni la rétention ni l’ennui,
et ne reconstitue pas intégralement l’ancienne version à cinq cartes.

Le nouvel aperçu de préparation est disponible sur
`http://127.0.0.1:3295/?view=game`. Les instances précédentes sont conservées.
Ces modifications ne demandent aucune migration et restent locales.

Validation : 262 tests ciblés passent, ainsi que TypeScript, ESLint ciblé et
le contrôle du diff. La [recette navigateur](../../output/placard-deck-preparation/report.json)
couvre 21 scénarios à 320, 390 et 1440 px : clavier, filtres, favoris,
coûts supérieurs aux XP, maximum de campagne, lancement réel conforme au
bilan et réponses distantes simulées retardées ou absentes. Une vérification
de collection conserve la culture en cours et les derniers résultats connus ;
une collection indisponible ne supprime plus les cartes choisies. Le stock
doit être confirmé avant de remplacer le deck ou de commencer une culture.
L’aperçu et ces tests n’utilisent aucun compte réel ni connexion Supabase.

La version locale réunit les zones actives avec un Buddie dans une campagne
commune. Au 13 octobre 2026, `20261013000200_kq_shared_campaigns.sql` est
appliquée et vérifiée en ligne ; le code du site reste à déployer. Le [contrat détaillé
de l’entrepôt](PLACARD-ENTREPOT-V2.md#campagne-commune-récoltes-par-buddie--13-octobre-2026)
précise le parcours, les profils fictifs versionnés des 52 Buddies et les
validations locales. Les anciennes parties indépendantes peuvent être terminées
sans perte avant de démarrer une nouvelle campagne ; elles ne sont pas converties.

La boucle actuelle est un jeu de cartes et de dés avec suivi de santé :

```text
Album Kanab Quest
  -> placer un Buddie possédé dans chaque zone choisie de l’entrepôt
  -> enregistrer le plan et réunir les zones actives affectées dans une campagne
  -> commencer sur le Sol vivant commun, avec un seul deck La Botte
  -> piocher une main de 10 cartes a chaque etape, selon les copies disponibles
  -> jouer une seule suite de 6 étapes avec 3 dés pour toutes les zones
  -> observer la santé commune et engager chaque soin une seule fois
  -> gagner et depenser de l'XP pour jouer des cartes
  -> subir des incidents Energie, DDTM et Securite avec des reponses dediees
  -> obtenir une récolte, une Fleur et des factures distinctes par zone/Buddie
  -> déposer chaque Fleur dans la file de duel aléatoire
  -> appariement automatique puis 3 manches de jury
  -> bruler les 2 Fleurs au verdict
  -> commencer le curing de 6 heures reelles
  -> reserver les contenants et regler le surplus sous 1 heure reelle
  -> vendre en biomasse ou en brut, ou transformer avec le materiel possede
  -> gagner de l'argent et une reputation qualite permanente
  -> reinvestir dans le catalogue d'equipements durables
  -> progresser en cote, ligue, saison, reputation et collection
```

Regles validees:

- 3 des: `1` Danger, `2-3` neutre, `4-6` reussite, `6` Etincelle;
- 6 etapes: Germination, Enracinement, Croissance, Floraison, Recolte,
  Sechage ; l’affinage commence après le jury et le duel;
- 30 cartes actives dans `La Botte du Chanvrier` : 12 communes, 7 peu communes,
  7 rares et 4 épiques;
- une préparation avant les dés et une réaction après, avec une seule carte
  épique jouée par campagne, même si plusieurs références ou copies sont possédées;
- chaque carte spécialisée déclare ses situations compatibles ; un tag partagé
  ne suffit pas. La même règle décide de la jouabilité et du bonus d’opération pertinente;
- deck sans limite arbitraire: chaque copie possedee peut etre engagee;
- main deterministe de 10 cartes au maximum, figee pendant toute l'etape; aucune carte
  brulee n'est remplacee avant l'etape suivante, les cartes non jouees
  retournent alors dans la rotation et les copies brulees en sont retirees;
- un changement de main gratuit par campagne, uniquement avant toute action;
- le constructeur affiche la probabilite de voir chaque reference dans la
  premiere main afin de rendre visible le compromis entre taille et regularite;
- il resume aussi la couverture Racines, Eau, Climat, Ravageurs, Floraison et
  Sechage, sans bloquer les decks incomplets;
- trois raccourcis permettent d'engager une copie de chaque reference, toutes
  les copies jouables ou de vider le deck avant ajustement manuel;
- le Sol vivant est commun, gratuit et ne consomme aucune carte Substrat;
- un emplacement favori local memorise le Buddie et chaque copie;
  sa restauration retire automatiquement les copies brulees depuis;
- chaque carte La Botte est brulee seulement lorsqu’elle est effectivement jouee;
- observation gratuite dans le panneau Santé ; quatre intrants et six PBI
  ciblées dans la boutique de soins, jamais dans les packs La Botte;
- les anciennes cartes PBI et d’observation sont archivées avec leurs exemplaires
  et reçus, ainsi que les quatre anciens Substrats;
- vitalité persistante : à zéro, la culture s’arrête ; un secours unique de
  première culture existe. Les résultats des opérations et les interventions
  choisies produisent un bilan, sans dégâts dus à la simple absence;
- 52 Buddies jouables et non consommables, avec rotation de deux autres
  références différentes avant réutilisation;
- les profils fictifs v1 distinguent rendement, cannabinoïdes et terpènes,
  sans jets ou actions individuels ; les équipements restent propres à chaque zone;
- un seul deck, une réserve d’XP et un suivi de santé communs ; le meilleur
  bonus initial d’XP des Buddies est partagé une fois, sans cumul des membres;
- participants, profils et équipements figés au lancement ; cliquer une zone
  engagée reprend le même run principal, les runs membres gardant leurs lots
  et factures séparés;
- 50 situations de culture, au moins huit par etape, dont pucerons, acariens et thrips;
- trois incidents avec consequences persistantes : surcharge electrique et
  coupure, controle DDTM, vol de recolte;
- quatre reponses specialisees: Papiers en regle, Branchement illegal,
  Charge répartie et Gros molosse;
- 15 formats de jury repartis en Presentation, Aromes et Maitrise;
- 3 defis quotidiens parmi 9, verrouilles au depart de la culture;
- classement Elo, ligues Graine / Pousse / Canopee / Fleur / Grand Cru;
- 1 booster La Botte toutes les 3 victoires consecutives;
- la Fleur du joueur et celle de l'adversaire sont brulees au verdict;
- nouveaux portefeuilles initialisés à 1 000 € de jeu (1 650 € pour le Trésorier) ;
  1 m² de culture, 1 m² de séchage et 1 m² de stockage équipés offerts, sans débit ;
  les soldes existants restent inchangés ; achats, usure, niveaux
  et transformations suivent le catalogue d’équipements actuel;
- marche post-recolte avec jury qualite, biomasse, lot brut, dry sift, static
  sift, ice water hash et quatre paliers de rosin selon l'equipement et la note;
- curing de 6 heures réelles après le verdict, indépendant du calendrier du jeu ; seul le grossiste
  achète avant maturité. Contenants achetés en quantité, réservés par lot sans mélange;
- surplus sans contenant : 1 heure réelle après le verdict pour acheter de la place ou vendre,
  puis vente automatique au grossiste du seul surplus, même hors connexion;
- la qualite pilote le prix et la reputation; la reputation departage le
  classement officiel apres cote et points de saison, avant le bilan sportif;
- pas de moteur 2D ni de WebSocket ; les bilans de culture suivent les opérations,
  tandis que conservation et échéance du surplus utilisent l’horloge serveur;
- calcul local deterministe, sauvegarde locale avec journaux de reprise;
- serveur : mutations service-role, burns atomiques, reçus et classement partagé.

Six cartes complètent le catalogue : Reprise délicate (`BOTTE-037`) et Humidité
rééquilibrée (`BOTTE-038`) sont communes ; Reprise experte (`BOTTE-039`), Réglage
d’urgence (`BOTTE-040`), Équipe de récolte (`BOTTE-041`) et Séchage sous contrôle
(`BOTTE-042`) sont épiques. Les réactions épiques corrigent des dés faibles pour
3 ou 4 XP ; Réglage d’urgence peut aussi servir uniquement à réduire la Pression.
Aucune ne soigne directement un parasite, ne restitue les pertes passées ou ne
raccourcit le curing. Tri et isolement répond notamment au pollen indésirable
en contenant un Danger, sans le transformer en réussite.

Les instruments conservés traduisent une décision après la mesure, jamais un
accès payant à l’observation. Les anciens incidents de bocaux du dernier tour
sont désormais des incidents du séchoir : plateau surchargé, condensation et
porte mal fermée. La capacité des bocaux appartient à l’entrepôt après le duel.

Chaque emplacement aléatoire suit **Commun 70 %, Peu commune 23 %, Rare 6 %,
Épique 1 %**. Le premier emplacement d’un pack est Commun ; une carte de victoire
bot isolée utilise la table entière. Les références d’une même rareté ont le même
poids. Les tailles des packs déjà attribués sont conservées. Voir le
[règlement de travail](PLACARD-RULES-DRAFT.md), [le suivi de santé](CULTURE-VIVANTE-2026-10-15.md)
et [le stockage](STOCKAGE-CURING-2026-10-15.md) pour les limites détaillées.

Sources de verite techniques:

- `src/lib/kanab-quest-game.ts`: culture, situations, cartes et des;
- `src/lib/kanab-quest-care.ts`: observation, vitalité, intrants et PBI;
- `src/lib/kanab-quest-storage.ts`: contenants, conservation, curing et surplus;
- `src/lib/kanab-quest-battle.ts`: Fleur, jury et burn;
- `src/lib/kanab-quest-ranking.ts`: Elo, matchmaking et ligues;
- `src/lib/kanab-quest-challenges.ts`: rotation quotidienne;
- `src/lib/kanab-quest-booster.ts`: boosters et recompenses de serie;
- `src/lib/kanab-quest-equipment.ts`: catalogue durable, prix et effets;
- `src/lib/kanab-quest-market.ts`: note du jury, rendements, prix et reputation;
- `src/lib/kanab-quest-repository.ts`: persistance locale atomique;
- `supabase/migrations/20260722000100_kanab_quest_game_foundation.sql`:
  fondation serveur historique, complétée par les migrations ultérieures;
- `supabase/migrations/20261010000500_botte_situations_epic.sql` : catalogue
  Botte actif, portées précises, raretés et consommation épique atomique.

### 0.1 Parcours de validation

La verticale locale est fonctionnellement complete pour les tests produit:

- onboarding memorise et rejouable, aligne sur la boucle atelier actuelle :
  preparation, six etapes, jury, debouche post-recolte et reinvestissement;
- inventaire a exemplaires physiques, boosters et registre de burns;
- deck sans plafond, raccourcis de composition, probabilites, couverture et
  favori restaure selon le stock restant;
- main figee de 10 copies au maximum par etape et un changement de main par culture;
- 50 situations atteignables, 6 étapes, pression, XP et suivi Santé séparé;
- carte Fleur unique avec statistiques et code d'integrite;
- file de duel aleatoire, programme du jury, trois manches et burn des 2 Fleurs;
- Elo, ligues, saison, 9 defis quotidiens et booster de serie;
- boutique materielle e-commerce, transformations post-recolte et reputation;
- audit automatise des doublons exacts et des cartes strictement dominees;
- direction artistique cartoon satirique documentee, avec Sylvain verrouille
  sur les proportions et les attributs de la mascotte de reference;
- sauvegardes locales, journaux de reprise et validation anti-injection.

Le mode local ne réalise pas les opérations de production suivantes :

- comptes et inventaires Supabase reels;
- matchmaking entre deux comptes reels;
- classement partage et rotation serveur quotidienne;
- application distante des migrations ou publication du site;
- validation humaine finale de toute la collection illustree.

Le parcours joueur officiel et les economies serveur existent maintenant, mais
restent derriere leurs verrous de lancement. Une connexion, une migration ou un
deploiement distant ne doit jamais etre simule comme termine par le prototype
local.

## Archives de conception — propositions et étapes historiques

Les sections suivantes conservent la recherche initiale et les anciennes étapes
de livraison. Les mentions de modes Substrat, PBI après Loupe, 36 cartes ou
d’affinage avant jury y décrivent les anciennes propositions. Le contrat actuel
est la section 0 ci-dessus ; aucune de ces archives ne réactive une règle retirée.

## 1. Vision

Le Placard est un jeu de cartes de culture asynchrone relie a L'Arene. Le joueur utilise une strain CBD qu'il possede deja dans sa collection Hemp Heroes, conduit une culture virtuelle par decisions quotidiennes, transforme le resultat en carte Recolte unique, puis la presente dans des concours ou des duels 1 contre 1.

Promesse joueur:

> Choisis un Buddie de ton album, revele son potentiel par tes decisions et fais-en une bete de concours.

Le jeu doit etre:

- une simulation lisible, dans laquelle chaque resultat a une cause;
- une extension naturelle du carnet et de la collection existants;
- accessible en moins de deux minutes par jour;
- competitif sans etre pay-to-win;
- leger pour le navigateur, Vercel et Supabase;
- coherent avec le style cartoon retro et les personnages du site.

## 2. Piliers

### 2.1 Collection utile

Une carte Hemp Heroes possedee peut debloquer une strain cultivable. La carte n'est jamais consommee et conserve son recto, son dos, son numero et sa rarete de collection.

### 2.2 Simulation causale

Le resultat depend du potentiel de la strain, de l'environnement, des equipements, des decisions et du temps. Une carte ne donne pas arbitrairement `+3 qualite`: elle modifie un parametre du systeme, puis le moteur en calcule les consequences.

### 2.3 Decisions rares mais importantes

Un tour est disponible chaque jour. Le joueur lit le diagnostic, prend une ou deux decisions et quitte le jeu. Une absence ralentit ou laisse agir les automatismes, mais ne detruit pas gratuitement la culture.

### 2.4 Competition equitable

La rarete de collection ne determine pas la victoire. Les concours changent de criteres et les duels opposent des Recoltes de categorie comparable. Le format miroir impose la meme strain aux deux joueurs.

### 2.5 Sobriete technique

Aucune boucle serveur, aucun moteur 2D, aucun WebSocket et aucune ecriture horaire. La simulation est deterministe et calculee a la demande.

## 3. Boucle globale

```text
Carnet de degustation valide
        -> points de reputation permanents
        -> Jetons de culture depensables
        -> boosters et nouvelles cartes
        -> choix d'une strain possedee
        -> culture quotidienne
        -> sechage et affinage
        -> carte Recolte unique
        -> concours / duel / classement
        -> rubans, cosmetiques, maitrise et boosters
```

Deux economies doivent rester distinctes:

- reputation de degustateur: permanente, jamais depensee;
- Jetons de culture: depensables pour lancer une culture ou certaines actions.

La note donnee a un produit ne doit jamais augmenter directement une recompense. Les gains du carnet reposent sur sa validation, sa completude, sa precision et ses achievements.

## 4. Les cartes

### 4.1 Carte Buddie

La definition de carte existante reste la source de verite. Une carte compatible porte le sceau visuel `Cultivable` et debloque son profil de simulation.

Regles:

- elle reste dans l'album;
- elle n'est pas verrouillee pendant une culture;
- un seul exemplaire suffit pour debloquer la strain;
- les doublons ne multiplient pas sa puissance;
- normal, brillant ou dore ont le meme effet de jeu;
- la rarete indique la valeur de collection et eventuellement la complexite, pas la force brute.

### 4.2 Carte Recolte

Elle est creee a la fin d'une culture et devient immuable. Elle contient:

- strain et carte Buddie d'origine;
- pseudo du joueur;
- numero de recolte;
- saison et date;
- version du moteur;
- statistiques finales;
- profil aromatique simule;
- score de sobriete;
- principaux evenements de culture;
- cadre et rubans obtenus.

La Recolte, et non la carte Buddie, participe aux concours et duels.

### 4.3 Sous-ensemble MVP

Le catalogue comprend 52 definitions Hemp Heroes. Le MVP ne doit pas attribuer un profil agronomique aux 52 cartes avant validation documentaire. Il commence avec 6 strains contrastees choisies parmi les cartes existantes, par exemple:

- Charlotte's Web;
- Cannatonic;
- ACDC;
- Sour Tsunami;
- Hawaiian Haze;
- Carmagnola.

`L'Arbre Mere - Toutes Varietes` est un personnage legendaire fictif et ne lance pas une culture standard.

Chaque profil doit indiquer la provenance et le niveau de confiance de ses donnees. Les appellations commerciales ne doivent pas etre presentees comme des genotypes universellement stables.

## 5. Une culture

### 5.1 Structure MVP

Une partie dure 12 tours quotidiens:

1. installation;
2. enracinement I;
3. enracinement II;
4. croissance I;
5. croissance II;
6. croissance III;
7. transition;
8. floraison I;
9. floraison II;
10. maturation;
11. sechage;
12. affinage et revelation.

La duree peut varier plus tard selon la strain. Pour le MVP, une structure commune simplifie l'equilibrage et l'explication.

### 5.2 Etat simule

Etat visible ou diagnostique:

- phase;
- vigueur;
- biomasse;
- masse racinaire;
- eau disponible;
- nutrition simplifiee N/P/K;
- temperature;
- humidite;
- circulation d'air;
- stress cumule;
- pression sanitaire;
- maturite;
- potentiel aromatique conserve.

Le moteur peut conserver des valeurs plus precises que l'interface. Les capteurs ameliorent la precision des estimations visibles plutot que de donner un bonus abstrait.

### 5.3 Calcul par facteur limitant

Modele conceptuel:

```text
assimilation = potentiel_genetique
             * facteur_lumiere
             * facteur_hydrique
             * facteur_racinaire
             * facteur_nutritif
             * facteur_climatique
             * surface_foliaire_active
```

La valeur la plus defavorable limite la progression. Une lampe puissante ne compense pas des racines asphyxiees.

Le stress possede une memoire:

```text
stress_jour = lumiere + eau + racines + climat + sanitaire - recuperation
```

Un stress leger est recuperable. Un stress fort et repete reduit certains potentiels finaux.

### 5.4 Une decision quotidienne

Le compte rendu montre:

- ce qui a change depuis le dernier tour;
- l'explication causale;
- le niveau de confiance du diagnostic;
- deux ou trois interventions possibles;
- les consequences immediates connues;
- les risques possibles.

Le joueur dispose de deux points d'action. Il peut modifier un reglage, jouer une carte Technique, installer un equipement ou ne rien changer.

### 5.5 Incertitude

Le moteur connait l'etat reel. Le joueur voit une estimation conditionnee par ses capteurs et sa maitrise de la strain.

Exemple:

```text
Sans capteur: substrat legerement humide
Capteur commun: humidite estimee entre 38 et 48
Capteur expert: humidite estimee entre 41 et 45
```

Cette incertitude cree du diagnostic sans recourir a un hasard opaque.

## 6. Equipements et techniques

### 6.1 Permanents

- lampe;
- pot;
- substrat;
- ventilation;
- capteur;
- automatisation.

Chaque permanent modifie des capacites physiques: puissance, homogeneite, retention, drainage, debit d'air, precision ou regle automatique.

### 6.2 Techniques

- observation approfondie;
- ajustement climatique;
- soin racinaire;
- reequilibrage;
- inspection sanitaire;
- recuperation;
- preparation au sechage.

Une Technique produit un effet explicable et est journalisee. Le MVP peut proposer un deck de 8 Techniques, avec une main de 3 et un maximum d'une Technique jouee par tour.

## 7. Maitrise d'une strain

Chaque strain possede une progression independante:

- Decouverte: 0 recolte;
- Apprentie: 1 recolte;
- Confirmee: 3 recoltes;
- Experte: 6 recoltes et un defi specifique;
- Maitrise: 10 recoltes et un podium.

La maitrise revele de l'information:

- fourchettes plus precises;
- sensibilites documentees;
- historique compare;
- diagnostics plus fiables;
- consequences mieux anticipees.

Elle ne doit pas creer un important bonus statistique permanent.

## 8. Recolte et notation

Statistiques de concours MVP sur 100:

- Aspect;
- Nez;
- Complexite;
- Douceur;
- Persistance;
- Proprete;
- Rendement;
- Sobriete.

Elles emergent de la simulation. Le score general est informatif, mais aucun concours ne doit se resumer a ce total.

Exemple de reglement:

```text
Coupe aromatique
Nez          30 %
Complexite   25 %
Persistance  20 %
Proprete     15 %
Sobriete     10 %
```

## 9. Concours

### 9.1 Concours asynchrone

Le joueur inscrit une Recolte avant la cloture. A la cloture, toutes les Recoltes sont evaluees sur un instantane du reglement. Le classement est calcule une fois puis publie.

Formats MVP:

- concours ouvert;
- concours par tranche de puissance;
- concours d'une strain imposee;
- concours debutant;
- concours de sobriete.

### 9.2 Recompenses

Priorite aux recompenses horizontales:

- ruban sur la carte;
- cadre saisonnier;
- titre de profil;
- booster;
- fragments de fabrication;
- illustration ou pose alternative;
- invitation a un concours special.

Les meilleurs joueurs ne doivent pas recevoir systematiquement des cartes plus puissantes.

## 10. Duels 1 contre 1

Le duel est asynchrone et se joue en trois manches:

1. presentation: Aspect et Proprete;
2. analyse: Nez et Complexite;
3. verdict: Douceur et Persistance.

Chaque joueur engage:

- une Recolte;
- trois cartes Jury choisies avant resolution.

Deux manches gagnees donnent la victoire. La seed, le reglement et les choix produisent un resultat deterministe et auditable.

Formats:

- amical;
- classe avec matchmaking par puissance;
- miroir avec strain identique;
- evenement saisonnier.

Au verdict, les deux Fleurs generees sont brulees, victoire comme defaite.
La carte Buddie d'origine, les Heritage et les Jetons ne sont pas detruits.
Un duel expire sans verdict libere les deux Fleurs sans burn.

Le joueur ne choisit plus son rival. Il engage une seule Fleur dans une file
serveur anonyme et peut la retirer tant qu'elle attend. L'arrivee d'une Fleur
constitue d'abord un groupe avec les douze candidatures valides les plus
anciennes, puis tire l'adversaire au hasard dans ce groupe, sans filtre de
qualite ni blocage anti-revanche. Deux joueurs distincts en file peuvent ainsi
toujours former un match, y compris avec une faible population. Le client
retente aussi l'appariement pendant l'attente afin de reprendre les
candidatures deposees avant une concurrence ou une interruption momentanee.
Les deux lignes sont revendiquees avec verrouillage et `SKIP LOCKED` afin que
deux requetes concurrentes ne puissent ni creer deux duels ni bruler deux fois
la meme Fleur. Le verdict est demande automatiquement par le joueur qui forme
le match; le bouton manuel ne sert plus qu'a reprendre un verdict interrompu.
L'entraînement bot ne présente plus non plus de catalogue d'adversaires : le
serveur tire le jardin d'essai à partir de la Fleur engagée et refuse toute
sélection provenant du client. Le nom et la variété du bot sont révélés dans le
reçu du verdict.

## 11. UX et direction artistique

### 11.1 Navigation

Le carnet de L'Arene accueille quatre vues:

```text
Degustations | Collection | Placard | Concours
```

Sur mobile, elles deviennent des marque-pages du carnet.

### 11.2 Roles des personnages

- Charles: accueil, boosters et revelation de la Recolte;
- Cultivateur: choix quotidiens;
- Inspecteur: diagnostic et explication causale;
- Juge: reglements, duels et resultats;
- duo de L'Arene: commentaires et progression.

Les personnages ne sont pas decoratifs. Chacun correspond a une fonction stable.

### 11.3 Ecran du Placard

La carte de la strain occupe le centre. Autour d'elle se trouvent les petites cartes permanentes. Le diagnostic et les actions sont presentes dans des panneaux de carnet.

Deux lectures sont disponibles:

- simple: phrases et alertes traduites par les personnages;
- expert: valeurs, courbes courtes et historique.

### 11.4 Systeme visuel

Reutiliser:

- fond creme `#f7f4ee`;
- menthe `#bac59d`;
- turquoise des mascottes;
- encre `#1a1a1a`;
- contours noirs de 2 a 3 px;
- ombres decalees;
- trames retro;
- typographie display et annotations manuscrites;
- boutons cartoon existants;
- dos TCG existant.

Eviter:

- interface sombre et neon;
- moteur 2D libre;
- animation permanente;
- tableaux scientifiques exposes par defaut;
- style graphique different de L'Arene.

### 11.5 Revelation finale

La Recolte utilise le rituel du booster:

1. carte retournee avec le dos existant;
2. intervention de Charles;
3. retournement CSS;
4. statistiques revelees progressivement;
5. ajout a l'herbier et proposition d'inscription.

## 12. Architecture sobre

### 12.1 Principe

Le moteur est une bibliotheque TypeScript pure et versionnee. Il ne fait aucun appel reseau. Il recoit un etat, une configuration, une seed et un nombre de jours a simuler, puis retourne le nouvel etat et les evenements.

```text
route serveur
  -> lecture de la culture
  -> simulation des jours manquants en memoire
  -> application de l'action
  -> RPC transactionnelle unique
```

### 12.2 Frequence

- aucun tick serveur permanent;
- aucun Realtime;
- aucune ecriture horaire;
- maximum une consolidation quotidienne par culture active;
- aucune operation pour un joueur absent;
- rattrapage de plusieurs jours en un calcul au retour.

### 12.3 Tables proposees

`game_variety_profiles`

- `card_definition_id` unique;
- `is_cultivable`;
- `difficulty`;
- `model_parameters jsonb`;
- `data_sources jsonb`;
- `confidence_level`;
- `simulation_version`.

`game_cultures`

- `id`;
- `user_id`;
- `card_definition_id`;
- `status`;
- `current_day`;
- `last_simulated_at`;
- `next_turn_at`;
- `configuration jsonb`;
- `state jsonb`;
- `random_seed`;
- `engine_version`;
- `row_version`;
- timestamps.

`game_culture_events`

- `culture_id`;
- `day`;
- `event_type`;
- `card_definition_id` nullable;
- `payload jsonb`;
- timestamp.

`game_harvests`

- `culture_id` unique;
- `user_id`;
- `card_definition_id`;
- `final_scores jsonb`;
- `aroma_profile jsonb`;
- `quality_tier`;
- `visual_variant`;
- `engine_version`;
- timestamp.

`game_matches`

- joueurs et Recoltes;
- reglement versionne;
- choix Jury;
- seed;
- resultat;
- statut et timestamps.

`game_competitions` et `game_competition_entries`

- reglement versionne;
- fenetre d'inscription;
- cloture;
- Recolte inscrite;
- score et rang materialises.

### 12.4 Securite et concurrence

- RLS sur toutes les donnees personnelles;
- inventaire existant comme preuve de possession;
- mutations uniquement par route serveur et RPC;
- verrouillage optimiste avec `row_version`;
- `expected_version` obligatoire pour toute action;
- fonctions idempotentes;
- seed creee cote serveur;
- Recoltes immuables;
- resultats de concours reproductibles.

### 12.5 Traitement quotidien

Un seul job quotidien traite uniquement:

- concours arrives a cloture;
- duels expires;
- classement materialise;
- notifications groupees;
- archivage leger.

Les cultures individuelles sont calculees a l'ouverture. Le job collectif travaille par petits lots avec reprise idempotente.

### 12.6 Cache

Cache public long pour:

- definitions de cartes;
- profils de strains;
- reglements;
- podiums;
- pages publiques de Recoltes.

Jamais de cache public pour:

- inventaire;
- culture active;
- Jetons;
- cartes Jury cachees;
- resultat non revele.

### 12.7 Budget de performance

Par action joueur:

- maximum 2 lectures Supabase;
- une RPC d'ecriture;
- etat de culture inferieur a 10 Ko;
- reponse API inferieure a 100 Ko;
- moteur cible inferieur a 50 ms de CPU;
- route complete cible inferieure a 500 ms hors incident reseau;
- maximum 40 evenements conserves en lecture chaude.

## 13. Performance frontend

- code du jeu charge dynamiquement seulement dans Le Placard;
- aucun code du moteur dans le bundle navigateur;
- WebP ou AVIF;
- miniatures dans l'album;
- une seule grande illustration chargee;
- lazy loading hors ecran;
- animations CSS courtes;
- aucun canvas ou moteur physique dans le parcours principal;
- aucune generation d'image a l'affichage;
- carte partageable generee uniquement sur demande puis stockee.

## 14. Anti pay-to-win

- une carte possedee debloque la strain pour toujours;
- doublons convertibles en cosmetiques, fragments ou information;
- variantes brillantes sans bonus de puissance;
- deck de depart jouable offert;
- cartes essentielles fabricables;
- matchmaking par categorie de Recolte;
- format miroir regulier;
- recompenses de classement surtout cosmetiques;
- aucune perte du Buddie ou des Heritage apres une defaite; seules les deux
  Fleurs engagees sont brulees au verdict.

## 15. MVP fonctionnel

### Inclus

- 6 strains issues de la collection;
- selection depuis l'album;
- un emplacement de culture;
- 12 tours;
- 6 systemes simules: lumiere, climat, eau, racines, nutrition et stress;
- 6 permanents;
- 8 Techniques;
- diagnostic simple et vue expert;
- maitrise par strain;
- carte Recolte;
- un concours hebdomadaire;
- duel asynchrone en trois manches;
- classement actualisé après chaque vente et duel;
- interface carnet et personnages existants.

### Hors MVP

- temps reel;
- combat anime;
- marche entre joueurs;
- reproduction ou hybridation;
- plusieurs plantes simultanees;
- meteo regionale complete;
- guildes;
- generation automatique d'illustrations;
- profils agronomiques pour les 52 cartes.

## 16. Parcours de prototype

Le premier prototype vertical doit prouver une seule boucle:

1. ouvrir la collection;
2. choisir Cannatonic;
3. lancer une culture;
4. consulter le rapport du jour;
5. choisir entre trois actions;
6. resoudre le tour;
7. avancer artificiellement jusqu'a la recolte en environnement de test;
8. reveler la carte Recolte;
9. l'inscrire a un concours factice.

Le prototype peut utiliser un profil de simulation provisoire clairement marque comme non valide. L'equilibrage scientifique intervient apres validation de la boucle et des donnees sources.

## 17. Indicateurs de validation

- part des joueurs avec une carte compatible qui lancent une culture;
- taux de retour au tour 2, au tour 4 et a la recolte;
- temps median d'une session quotidienne;
- taux de comprehension des diagnostics;
- repartition des choix, pour detecter une option dominante;
- nombre de strains essayees par joueur;
- part des Recoltes inscrites en concours;
- taux de duels rejoues;
- lectures et ecritures Supabase par joueur actif;
- poids du bundle et des images;
- latence p95 des actions.

### Garde de performance en recette

`npm run load-test:placard` simule par defaut 100 participants et mesure en
lecture seule la page Placard, le bootstrap, le classement, la reserve de
Fleurs et l'historique des duels. Ces deux dernieres routes reproduisent le
rafraichissement de la file sans engager ni bruler de Fleur. Le test refuse une
cible distante, exige deux sessions distinctes et prevalide pour chacune la
page et le bootstrap en `200`. Une recette distante exige simultanement l'autorisation
explicite, la confirmation `STAGING_READ_ONLY` et un hote autorise identique a
celui de l'URL cible. Le test applique deux budgets distincts:

- page HTML: p95 inferieur ou egal a 2 500 ms;
- routes API: p95 inferieur ou egal a 1 200 ms;
- taux d'erreur maximal: 1 %.

Les budgets sont ajustables avec `PLACARD_LOAD_TEST_PAGE_P95_MS`,
`PLACARD_LOAD_TEST_API_P95_MS` et
`PLACARD_LOAD_TEST_MAX_ERROR_RATE`. Chaque exécution terminée archive une preuve
JSON versionnée et non écrasable dans `output/placard-load-tests/`, avec le
verdict global et les routes hors budget. Le test des burns et des verdicts
reste separe, car il doit uniquement etre lance sur une copie de recette
jetable.

`npm run smoke-test:placard:transactions` couvre une seule famille de mutation à
la fois : burn d'une carte La Botte, verdict avec burn des deux Fleurs, duel bot
avec crédit d'un défi quotidien, achat-installation, ou parcours marché local.
Le scénario bot vérifie le crédit exact des points et de l'expérience, la
synchronisation des défis, le burn de la Fleur et l'absence de double crédit au
rejeu. Le parcours marché vérifie l'achat éventuel de la machine pivot,
son installation, l'épinglage de la filière, l'éligibilité du lot, la vente,
l'expertise et le rejeu idempotent du reçu. Le script refuse sans exception
toute URL web et toute URL Supabase autres que `localhost` ou `127.0.0.1`. Il
exige `PLACARD_SMOKE_CONFIRM_DATABASE=LOCAL_SUPABASE_ONLY`, puis la confirmation
spécifique `LOCAL_BURNS_ONLY`, `LOCAL_EQUIPMENT_ONLY` ou `LOCAL_MARKET_ONLY`, un cookie local et les
identifiants nécessaires. `NEXT_PUBLIC_SUPABASE_URL` doit être injectée dans le
processus : le script ne lit aucun fichier `.env*`. Il prévalide le bootstrap
authentifié avant toute mutation et n'est jamais lancé par la CI. Chaque réponse
transactionnelle est archivée dans `output/placard-smoke-tests/` sous forme de
preuve expurgée : les identifiants et les reçus sont remplacés par des
empreintes.

`npm run audit:placard:mobile` contrôle trois états authentifiés dans un viewport
390 × 844 avec Lighthouse : le HUD, le catalogue matériel ouvert et le marché.
Par défaut, il exige deux comptes locaux et vérifie qu'ils ont des tailles de
collection différentes. Chaque session passe d'abord par la page, le bootstrap,
le catalogue et le marché réels : une redirection vers la connexion, une 404 ou
une API indisponible invalide la recette avant la mesure. Le rapport expose les
résultats de chaque état par profil et le pire cas sans jamais afficher les cookies.
Il est archivé automatiquement dans `output/placard-mobile-audits/`; aucun
extrait du DOM authentifié n'est conservé dans les problèmes d'accessibilité.
Les seuils locaux par defaut sont: performance 75, accessibilite 90, LCP 4 000
ms, CLS 0,10 et poids transfere 2 Mo. L'audit refuse toute cible distante. Il
complete la recette sur appareils reels mais ne la remplace pas, notamment pour
le confort tactile et la lisibilite en conditions exterieures.

Le pilotage admin instrumente cette dernière étape avec vingt décisions : dix
sur iPhone/Safari physique et dix sur Android/Chrome physique. La checklist est
locale, importable et exportable sans compte, email, modèle d'appareil ni texte
libre. Son export va dans `output/placard-mobile-manual-reviews/` et devient une
preuve distincte de l'audit Lighthouse dans le dossier de lancement.
Le contrôle marché impose sur chacun des deux appareils une vente réelle de bout
en bout : choix, confirmation, reçu, versement, réputation, lot vendu et rejeu
sans double crédit. Le manifeste v2 invalide les preuves antérieures qui ne
couvraient que la lisibilité de la fenêtre de confirmation.

## 18. Decisions a valider avant implementation complete

1. Nom public final: Le Placard ou autre.
2. Six strains exactes du MVP et sources de leurs parametres.
3. Duree reelle d'un tour et gestion des absences.
4. Economie initiale des Jetons de culture.
5. Statut juridique et editorial des appellations commerciales.
6. Liste des personnages et leur role officiel.
7. Niveau de detail affiche dans la vue expert.
8. Premier reglement de concours.

## 19. Recompenses du carnet vers le Placard

### Principe

Le carnet ne recompense jamais la valeur de la note donnee. Il recompense uniquement:

- une critique validee;
- la precision des terpenes identifies;
- la regularite sur plusieurs lots;
- la qualite d'une contribution reconnue par la moderation;
- la participation utile a la communaute.

Cela evite d'encourager artificiellement les bonnes notes.

### Format cible des packs

1. Les boosters Buddies restent inchangés et continuent d'être achetés et
   ouverts depuis l'album principal.
2. L'Arène propose séparément un booster La Botte de dix cartes.
3. Le booster La Botte coûte 5 points. Les deux achats utilisent le même
   portefeuille de fidélité, mais conservent chacun leur propre tarif.
4. Un Jeton Coup de pouce donne +1 XP au départ d'une culture. Deux jetons
   maximum peuvent être dépensés par partie.

Les collections et leurs boosters restent séparés. Les packs déjà attribués ne
sont jamais modifiés rétroactivement. La boutique La Botte reste dormante
jusqu'à une activation coordonnée du catalogue, des visuels et des RPC.

### Grille cible des badges

| Badge | Booster La Botte | Jeton Coup de pouce |
| --- | ---: | ---: |
| Premier Carnet | 1 | 1 |
| Gouteur Regulier | 1 | 2 |
| Marathon des Lots | 2 | 3 |
| Premiere Piste | 1 | 0 |
| Combo Aromatique | 1 | 1 |
| Nez Absolu | 2 | 1 |
| Nez Divin | 3 | 2 |
| Tour de Saison | 1 | 2 |
| Expert Outdoor | 1 | 1 |
| Expert Greenhouse | 1 | 1 |
| Expert Indoor | 1 | 1 |
| Critique Utile | 0 | 1 |
| Plume d'Or | 1 | 2 |
| Voix Respectee | 1 | 1 |
| Validateur Serieux | 0 | 1 |

### Etat de lancement

La configuration est dormante et `KQ_NOTEBOOK_REWARDS_LIVE` reste a `false`.
La collection La Botte et ses definitions restent inactives dans Supabase.
Aucun booster La Botte ne doit être achetable ou ouvrable par un client avant
le lancement complet.
Le raccord apres approbation d'une critique est implemente: il recalcule d'abord
les badges, filtre ceux qui possedent une regle Placard active, puis appelle le
RPC idempotent badge par badge. Tant que le flag reste a `false`, ce raccord
s'arrete avant toute lecture ou ecriture Supabase liee au Placard.

## 20. Cartes Heritage de concours

Les cartes Heritage sont des cartes permanentes offertes par le parcours des
fleurs concours. Le catalogue suit maintenant les producteurs réellement
présents sur la plateforme : un producteur possède une carte stable, quel que
soit le nombre de variétés qu'il propose pendant une saison.

Regles validees:

- un avis éligible validé sur une fleur du producteur débloque son Heritage de
  façon idempotente;
- les Heritage ne brulent jamais et restent reutilisables;
- un seul Heritage peut etre equipe par culture;
- il reste hors du deck La Botte et de la main de dix cartes;
- son pouvoir est limite a une utilisation ou une condition par culture;
- les doublons n'augmentent jamais la puissance de la carte;
- les variantes brillantes ou dorees sont uniquement cosmetiques;
- une carte retirée du catalogue ne peut plus être gagnée ni équipée dans une
  nouvelle culture, mais les exemplaires acquis restent visibles dans l'album.

Catalogue implemente:

- une définition Heritage est créée automatiquement à l'ajout d'un producteur;
- sa référence reste stable même si le nom ou le visuel du producteur change;
- à la suppression du producteur, la définition et son parcours actif sont
  archivés sans supprimer les reçus ni les cartes déjà gagnées;
- les mécaniques proviennent d'un catalogue extensible contrôlé par le moteur;
  la création choisit exclusivement un pouvoir actif encore inutilisé et un
  index SQL interdit deux pouvoirs identiques parmi les producteurs présents;
  si le catalogue est épuisé, la carte est créée inactive en attente éditoriale
  au lieu de produire silencieusement un doublon;
- toutes les cartes ont la même valeur technique et aucune rareté publique;
- un doublon donne 1 fragment;
- 5 fragments fabriquent n'importe quelle reference active manquante.

L'ancien catalogue fermé de douze références et son tirage après achat sont
conservés uniquement pour la compatibilité des anciens reçus. Ils ne constituent
plus la source de vérité du catalogue joueur.

Familles de pouvoirs:

- Racines solides: annule le premier Danger d'Enracinement;
- Reserve du jardinier: commence avec un XP supplementaire;
- Main prevoyante: pioche treize cartes et en conserve dix;
- Climat stable: annule la premiere hausse de pression climatique;
- Second regard: offre un changement de main supplementaire;
- Reprise vigoureuse: rend un XP apres le premier echec;
- Instinct du cultivateur: relance un de neutre;
- Bouclier biologique: facilite la premiere inspection de ravageur;
- Floraison maitrisee: transforme un neutre en reussite en Floraison;
- Affinage patient: relance le de le plus faible a la derniere etape;
- Heritage de la canopee: ignore les Dangers d'un lancer sans creer d'Etincelle;
- Signature du maitre: ajoute un quatrieme de et conserve les trois meilleurs.

Douze pouvoirs supplémentaires étendent cette bibliothèque à 24 combinaisons
réellement distinctes : Élan de semis, Racines décompressées, Croissance
résiliente, Pistils étincelants, Mémoire du gardien, Dernier affinage, Premier
élan, Exigence du jury, Culture zen, Parade ancestrale, Soupape lumineuse et Art
du compromis. Chacun possède son propre déclencheur et sa propre contrepartie :
étape imposée, condition de dé, Pression, Situation de vol ou qualité du résultat.
Le préflight refuse désormais un catalogue producteur contenant un effet inconnu
ou utilisé deux fois.

Etat de lancement:

- synchronisation automatique avec la table Producteurs;
- édition du nom, du pouvoir, du texte et du visuel depuis le pilotage admin;
- affichage dynamique dans le Placard et l'album client;
- atelier joueur dans l'album : à partir de 5 fragments, choix explicite d'une
  référence producteur active et manquante, avec débit et attribution atomiques;
- tests d'attribution realises uniquement avec des identifiants de commande de
  test ou en mode apercu sans ecriture.

### Checklist d'activation atomique

1. terminer les routes serveur du Placard et la consommation des Jetons Coup de pouce;
2. connecter les parties, burns et classements a Supabase;
3. ajouter le portefeuille client pour les boosters La Botte et les jetons;
4. tester la retro-attribution des badges deja obtenus sur une copie de la base;
5. publier le reglement des burns, du classement et des lots de fin de saison;
6. activer simultanement la collection, les recompenses, l'interface Album et l'acces au Placard;
7. verifier qu'aucun ecran ne presente une recompense impossible a utiliser;
8. activer les Heritage et basculer
   `KQ_HERITAGE_PURCHASE_DRAWS_LIVE` dans la meme fenetre de lancement, apres
   publication des probabilites. Le branchement idempotent au passage d'une
   commande en statut paye est deja implemente mais reste dormant.

## 21. Recompenses de fin de saison

La grille de dotation est calculee depuis l'instantane final du classement et
reste dormante tant que le reglement public et les lots physiques ne sont pas
valides. Trois duels termines sont necessaires pour etre eligible.

| Rang | Reconnaissance | Booster La Botte | Fragments Heritage |
| --- | --- | ---: | ---: |
| 1 | titre, cadre or, ruban, invitation speciale | 3 | 12 |
| 2-3 | titre, cadre podium, ruban, invitation speciale | 2 | 8 |
| 4-10 | titre, cadre saisonnier, ruban | 1 | 3 |
| 11+ | titre et ruban de participation | 0 | 1 |

Les recompenses restent principalement cosmetiques. Chaque attribution future
portera une cle idempotente `saison:joueur:palier`. La constante
`KQ_SEASON_REWARDS_LIVE` reste a `false`; aucun lot, booster ou fragment n'est
distribue par ce module. La commande admin et le RPC atomique de distribution
sont installes mais dormants: le RPC exige a la fois un palier actif, une
collection La Botte active et l'eligibilite aux trois duels minimum.
Les rubans et autres cosmetiques reprennent automatiquement le code court de la
saison active (`S1`, `S2`, etc.) et ne sont jamais figes sur la premiere saison.

## 22. Etat d'implementation local

### Termine techniquement

- boucle de culture a six etapes, main de dix et deck limite uniquement par les
  copies possedees;
- effets Buddies, cartes La Botte, PBI apres inspection et Heritage;
- burns atomiques du mode de culture et de chaque carte jouee;
- portefeuille de Jetons Coup de pouce;
- creation serveur d'une Fleur unique a la recolte;
- reserve de Fleurs, file classee aleatoire, retrait avant match, appariement
  transactionnel et verdict automatique;
- burn atomique des deux Fleurs au verdict;
- cote, ligues, points, series, defis et classement actualisé à chaque lecture;
- saisons dynamiques, expiration des duels et recompenses de saison dormantes;
- recompenses Carnet et tirages Heritage installes mais dormants;
- routes joueur separees des routes admin, authentification par `customerId`,
  rate limiting et erreurs serveur filtrees;
- page joueur responsive integree a L'Arene derriere `KQ_PLAYER_API_LIVE`;
- reprise de culture exclusivement depuis Supabase, sans sauvegarde locale de
  l'etat officiel;
- bootstrap collection optimise et lectures initiales regroupees;
- classement Placard recalculé depuis les cotes, points et réputations serveur,
  sans cache navigateur afin qu'une vente ou un duel soit visible immédiatement;
- portefeuille d'argent, equipements durables, jury de qualite, vente,
  transformation, biomasse et reputation serveur;
- HUD d'atelier avec solde, reputation, inventaire durable et prochain
  investissement compatible, recalcule apres chaque achat, plus une action
  conseillee qui priorise culture active, lot a valoriser, Fleur a juger,
  achat accessible ou nouvelle culture; l'objectif materiel suit le prix
  compatible le plus proche afin de conserver des paliers intermediaires avant
  les machines de transformation a plusieurs milliers de dollars; le bouton
  de l'objectif ouvre directement sa fiche marquee dans le catalogue, sans
  ajout automatique au panier; une reglette Culture, Jury, Vente expose aussi
  les parties, Fleurs et lots en attente avec acces direct a chaque etape;
- table d'equilibrage admin en lecture seule : comparaison des voies de marche,
  amortissement des machines, alertes de domination et controle des prix reels;
- catalogue e-commerce triable par progression ou prix, avec filtre des achats
  immediatement compatibles avec le budget et les prerequis du joueur; le recu
  de commande distingue clairement achat et installation, puis permet d'activer
  chaque piece sans quitter la confirmation; une machine achetee mais privee de
  son prerequis reste en reserve et ne peut pas activer ses bonus; le panier
  signale les pieces qui partagent un emplacement et le materiel actif qu'une
  future installation remplacera; les presses a rosin superieures conservent
  toutes les recettes des paliers inferieurs et l'objectif automatique ignore
  les modeles deja depasses par un achat plus haut dans la meme gamme; ces
  alternatives sont signalees comme telles et ne sont jamais confondues avec
  une collection reellement complete; la projection du panier simule les
  remplacements par emplacement et exclut les conflits ou prerequis non resolus
  afin de ne jamais additionner des bonus impossibles; avant paiement, le panier
  et sa confirmation montrent les variations de quantite, qualite, regularite,
  energie, capacite et precision; une filiere n'est annoncee ouverte que si sa
  chaine technique est complete, avec rappel de la note minimale du jury;
  chaque fiche produit applique la meme projection au chargement reel du joueur
  et indique le materiel remplace avant meme l'ajout au panier; les machines de
  transformation y ajoutent un amortissement indicatif sur un lot temoin de
  100 g note 8,8/10, avec surplus par lot, capital restant selon les machines
  deja possedees, contenu du panier et remplacement des modeles minimaux par les
  machines superieures compatibles; les grandes laveuses, le separateur
  automatise et les presses superieures disposent de leurs propres projections,
  tandis qu'un ancien modele deja depasse n'en revendique plus le benefice;
  chaque filiere affiche aussi l'epargne manquante et peut ajouter en une seule
  action toutes les pieces encore absentes de son panier; le panier conserve
  alors la filiere visee, son seuil de jury, son surplus temoin, son
  amortissement et sa jauge de financement jusqu'a l'achat ou l'abandon de
  l'objectif; la filiere choisie est sauvegardee sur le profil et remonte dans
  le HUD avec son budget restant, y compris apres fermeture de la boutique ou
  reconnexion;
  apres paiement, chaque
  ligne du recu traduit la machine en bonus chiffres et filieres ouvertes, puis
  distingue sans ambiguite achat, prerequis manquant et installation active;
- aide a la decision dans le comptoir des lots : meilleur revenu, meilleure
  reputation et ecart chiffre par rapport a la vente brute, sans masquer les
  autres choix disponibles; la confirmation irreversible projette aussi le
  solde, la reputation, le titre et le prochain investissement apres la vente;
  lorsqu'une filiere materielle est epinglee, l'aperçu et le reçu montrent la
  part du versement qui finance réellement son budget, la progression avant et
  apres ainsi que le nombre indicatif de ventes comparables encore necessaires;
  la voie epinglee remonte en premiere position et est mise en evidence dans la comparaison du lot et
  diagnostique quatre situations sans ambiguite : lot pret, qualite
  insuffisante, materiel manquant, ou qualite et materiel encore insuffisants;
  son appel a l'action rouvre directement la machine pivot et sa chaine;
  la premiere vente conforme a l'objectif enregistre atomiquement la maitrise
  durable de la filiere, ferme l'objectif epingle et celebre le jalon dans le
  recu; le palier non maitrise suivant de la meme famille peut alors etre
  epingle, sans conseiller une presse inferieure deja remplacee; apres fermeture
  du recu, le HUD conserve le palmares des huit voies de transformation tandis
  que chaque fiche du marche affiche son nombre de ventes et son record jury;
  les ventes repetees remplissent quatre paliers d'expertise coherents avec la
  maitrise des strains : Apprentie a 1, Confirmee a 3, Experte a 6 et Maitrise
  a 10 ventes, avec le prochain seuil visible jusque dans le recu de vente;
  les passages a 3, 6 et 10 ventes versent respectivement 5, 12 et 25 points de
  reputation, figes dans le recu idempotent et reserves aux transformations;
  la table d'equilibrage admin permet de simuler le numero de vente et separe la
  reputation du lot, la prime ponctuelle d'expertise et leur total pour chaque
  filiere;
  une mission d'atelier permanente retient la filiere epinglee ou choisit le
  palier d'expertise le plus proche, annonce sa prime et remonte sa voie en tete
  du comptoir sans masquer les autres choix; elle peut etre epinglee en un clic,
  reutilise la machine pivot la plus performante deja possedee ou ouvre la fiche
  du premier equipement manquant, puis suit le joueur jusqu'au verdict;
- chaque voie bloquee distingue desormais le manque de note du jury du manque
  de materiel : la premiere indique l'objectif de la prochaine recolte, la
  seconde ouvre directement la machine a acheter, a installer ou son prerequis;
  quitter la boutique ramene au lot concerne et recharge ses options;
- recu de vente relie a la progression durable : prochaine machine compatible,
  budget restant et acces direct a sa fiche dans le catalogue, ou objectif
  qualite lorsque l'atelier est complet;
- reputation publiee dans le classement Placard et integree au Score Placard :
  cote + 25 % des points de saison (bonus plafonne a 150) + quatre fois la
  racine carree de la reputation (bonus plafonne a 100); les egalites suivent
  reputation, cote, victoires, defaites, points de saison puis identifiant stable;
  les six titres cosmetiques et la progression restent visibles dans le HUD,
  les recus de vente et les deux vues du classement Placard;
- incidents Facture electrique, Controle DDTM et Renard a deux pattes, avec
  coupure de courant et perte de quantite effectivement appliquees;
- trajectoire de recolte visible pendant la culture : qualite projetee, palier,
  distance au prochain palier, poids estime et pertes deja subies, recalcules
  apres chaque etape avec la formule finale existante et clairement presentes
  comme une projection non garantie; la filiere sauvegardee y rappelle son
  seuil commercial sans confondre la Qualite de culture avec la note du jury;
  dans la reserve, chaque Fleur affiche une estimation pre-jury issue de ses
  cinq statistiques et l'ecart restant, le verdict officiel restant souverain;
  les recus des duels humains et bot affichent ensuite la note commerciale
  definitive, la comparent au seuil epingle et ouvrent directement le lot le
  plus recent dans le comptoir;
- recu anime apres chaque resolution : variation de qualite, XP reellement
  gagnes, poids projete et perte de recolte eventuelle sont affiches avant de
  passer a l'etape suivante et conserves dans l'historique de la culture;
- bulletin final commun aux parties officielles et locales : equation des six
  etapes, bonus de materiel, qualite finale, poids brut, perte d'incident et
  poids final, suivis des six recus d'etape; les scores negatifs autorises par
  le moteur ne sont plus artificiellement affiches comme zero;
- garde de charge en lecture seule, multi-comptes prevalides, avec budgets p95
  distincts page et API et couverture obligatoire du HUD, classement, Fleurs,
  duels, catalogue matériel et marché;
- smoke test destructif limité techniquement à un serveur et une base Supabase
  locaux pour les burns, verdicts, le duel bot et ses défis sans double crédit,
  l'achat-installation de matériel avec débit idempotent et le parcours marché
  avec rejeu idempotent;
- audit Lighthouse smartphone authentifié du HUD, du catalogue matériel ouvert
  et du marché, avec budgets performance, accessibilité, LCP, CLS et poids
  transféré;
- checklist admin exportable des vingt contrôles humains sur iPhone/Safari et
  Android/Chrome physiques, avec achat réel de matériel, installation depuis
  le reçu et vente réelle sans double débit sur chaque appareil;
- vérificateur hors ligne des douze preuves de recette, avec fraîcheur maximale,
  intégrité des vingt décisions mobiles, continuité des curseurs rétro et
  correspondance simulation/exécution; ses refus mobiles indiquent désormais
  la version, le profil et le contrôle exact à reprendre;
- synthèse importable de ce rapport dans le pilotage admin, limitée aux données
  expurgées, avec détection d'expiration, prochaine action bloquante et verdict
  croisé avec l'état dormant réellement lu par le préflight serveur;
- preflight admin dont l'état prêt est réellement atteignable avec deux règles
  Carnet configurées mais dormantes, et qui contrôle aussi le flux Producteurs;
  l'accès joueur reste fermé jusqu'à la dernière étape de la fenêtre
  d'activation.

### Volontairement dormant avant lancement

- `KQ_PLAYER_API_LIVE`;
- `KQ_SEASON_CALENDAR_APPROVED`;
- `KQ_SEASON_PRIZES_APPROVED`;
- `KQ_SEASON_TERRITORY_APPROVED`;
- `KQ_COLLECTION_ODDS_APPROVED`;
- `KQ_PUBLIC_RULES_APPROVED`;
- activation commerciale de La Botte;
- attribution automatique des boosters Carnet;
- tirages Heritage lies aux achats concours;
- distribution des recompenses de saison;
- affichage de La Botte et des Heritage dans l'album client principal.

### Reste avant ouverture publique

État vérifié et conditions de clôture au 8 septembre 2026 :
[`PLACARD-FIN-DE-PLAN.md`](PLACARD-FIN-DE-PLAN.md).

1. valider humainement les 36 cartes La Botte, chaque Heritage lié à un
   producteur actif et les situations selon `PLACARD-DA-V2.md`; la planche admin
   se recalcule avec le catalogue Producteurs et remet toute nouvelle image à
   contrôler; les planches historiques restent reproductibles et l'audit
   Situation est consigné dans `PLACARD-SITUATION-ARTWORK-AUDIT.md`;
2. valider les lots, dates, territoire, probabilites et reglement public;
   le dossier de decision et les cinq verrous independants sont decrits dans
   `PLACARD-LAUNCH-BRIEF.md`;
3. effectuer une recette mobile sur appareils reels avec plusieurs comptes et
   collections de tailles differentes; l'audit Lighthouse local et la checklist
   admin sont prêts mais ne remplacent pas la manipulation physique; exporter
   la checklist intégralement validée dans le dossier de preuves;
4. tester la retro-attribution Carnet et Heritage sur une copie de production;
5. exécuter le test de charge déjà instrumenté sur la copie de recette, puis
   les smoke tests de burns, verdicts, duel bot avec défis, achat-installation de matériel et vente
   marché exclusivement sur sa base jetable;
6. relever et valider les budgets Supabase/Vercel avec les mesures p95
   produites par route;
7. preparer une fenetre d'activation coordonnee des collections, recompenses,
   album et acces joueur;
8. n'activer les flags qu'apres validation explicite, puis effectuer un test
   fumee avec un compte client de recette.

Cette liste est la source de verite pour la fin de projet. Les anciennes
sections de simulation quotidienne restent des archives de conception et ne
doivent pas etre utilisees comme checklist de lancement.

## Contrats renouvelables — implémentation locale du 20 octobre 2026

Après réception de la prime unique **Main légère**, trois choix sont retenus
dans le catalogue local. Un seul contrat est accepté avant une nouvelle
culture ; au moins une récolte vivante doit atteindre la Qualité demandée,
avec le nombre de cartes Botte réellement jouées dans toute la campagne.
Une campagne donne au maximum une prime, sans livraison de Fleur, délai ni
pénalité. Le joueur choisit explicitement son prochain contrat après le résultat.

| Contrat | Code | Qualité minimale | Cartes Botte maximum | Prime de jeu |
| --- | --- | ---: | ---: | ---: |
| Au naturel | `pure-grower` | 8 points | 0 | 10 € |
| Le juste geste | `steady-hand` | 10 points | 2 | 15 € |
| La belle signature | `fine-flower` | 12 points | Sans limite contractuelle | 20 € |

Le [rapport local](../../output/renewable-contracts-balance.json) filtre les
échantillons existants du 19 octobre, sans nouvelle simulation ni donnée
joueur. Sur 3 000 cycles de départ sans Botte, les critères sont atteints dans
34,57 %, 15,63 % et 5,13 % des cycles ; avec la stratégie scriptée
`support-prudent`, dans 11,77 %, 16,43 % et 7,13 %. Le rapport sépare aussi les
cycles suivant une première réussite potentielle de Main légère : ce filtre
ne prouve ni acceptation ni réception effective de sa prime.

Ces choix opposent conservation des cartes, interventions limitées et objectif
de Qualité plus ambitieux. Les seuils 14 et 20 sont écartés de ce premier
catalogue : le premier est atteint dans moins de 2 % des cycles de départ
testés, le second dans aucun. La prime maximale de 20 € représente 17,08 % du
coût de référence de 117,10 € par cycle dans cette étude ; elle ne valide pas à
elle seule l'équilibre économique. Les équipements avancés, campagnes de
plusieurs zones, achats de nouvelles cartes et stratégies adaptées aux
contrats restent à mesurer. Aucun effet sur les retours des joueurs n'est
déduit de ces échantillons.

### Parcours et garanties

Le catalogue remplace le contrat initial dans la préparation une fois sa prime
reçue, et reste accessible dans Missions → Contrats. Le suivi en culture
affiche les points de Qualité réels, le nombre de cartes jouées et la prochaine
action. Une réussite donne un reçu avec le montant confirmé ; une nouvelle
tentative demande un choix explicite. Les anciens reçus restent silencieux.
Le compte des contrats honorés progresse à chaque versement effectif.

La migration additive `20261020000200_kq_renewable_contracts.sql` conserve chaque
tentative, ses conditions et son reçu définitif. L'identifiant d'acceptation
reste stable lors des reprises ; une commande ancienne ne peut ni créer une
nouvelle tentative ni annuler la suivante. Le serveur attache uniquement une
nouvelle culture, vérifie une Fleur réellement produite et attribue une seule
prime pour toute la campagne. Les tables et la séquence sont privées ; seuls
les RPC nommés sont accessibles au rôle serveur.

Cette migration a été exécutée uniquement dans PGlite, sans accès distant.
La base Supabase partagée n'a pas été modifiée. Tant que la migration n'y est
pas appliquée, l'API traite l'absence du nouveau RPC comme une fonctionnalité
indisponible et conserve Main légère. Une panne réseau ou une réponse
incomplète reste signalée au joueur.

Validation locale : 321 contrôles PostgreSQL utilisant les vrais parseurs
TypeScript, 106 contrôles de régression Main légère, 122 tests unitaires des
deux contrats et de leurs API, contrôle des permissions sur 331 migrations,
TypeScript et ESLint ciblé. Les audits navigateur couvrent les trois largeurs
320/390/1440 px, le clavier, les primes et les réponses perdues ; les preuves
figurent dans `output/placard-renewable-contracts/`. Les doublons SQL sont
exercés dans une seule instance PGlite : ce résultat ne remplace pas une
recette de concurrence entre connexions PostgreSQL distinctes.

L'aperçu jouable se lance avec
`node scripts/preview-placard-contract-playable.mjs --renewable` sur
`http://127.0.0.1:3287/`. L'option `--audit` vérifie deux cultures successives
dans les vrais composants avec le moteur de La Relève et les RPC SQL locaux :
deux primes de 10 €, deux identités de culture distinctes, rotation respectée,
cartes et factures conservées, ancien reçu inchangé, puis nouveau contrat choisi.
Le [rapport de parcours](../../output/placard-renewable-playable/report.json)
archive ces vérifications. Le parcours historique sans option renouvelable
reste couvert par son propre audit.

L'essai prépare explicitement un ancien contrat Main légère gagné pour ouvrir
directement le catalogue (1 000 € de départ + 30 € déjà gagnés). Ses tirages
reproductibles et son secours de première culture servent à vérifier le
parcours, pas la difficulté réelle. « Nouvelle culture » conserve la partie ;
« Recommencer l'aperçu » la réinitialise. Aucun compte réel, fichier de
configuration privé ni connexion Supabase n'est utilisé.
