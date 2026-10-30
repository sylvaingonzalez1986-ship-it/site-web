# Culture vivante — lancement prévu le 1er novembre 2026

## Périmètre

Le suivi de culture fonctionne à côté des six opérations : observation gratuite, vitalité persistante, interventions choisies dans une réserve achetée à la boutique. La refonte de La Botte est désormais définie autour de 30 cartes d’opération actives, séparées de ce suivi.

L’ouverture du jeu est reportée au **1er novembre 2026**, avec libération du Pack des Pionniers dès le **30 octobre** ; voir le [calendrier de préouverture](ARENA-PREOUVERTURE-2026.md). Le reset du jeu et du classement, initialement prévu le 15 octobre, reste une opération séparée à replanifier ; il n'est pas exécuté par cette livraison. Aucun stock PBI de bêta n'est converti : les nouvelles réserves officielles commencent vides. La migration SQL additive doit être appliquée avant activation de ces règles ; la remise à zéro et sa vérification feront l'objet d'une opération séparée. Les comptes clients et leurs achats réels ne font pas partie de ce reset du jeu.

Les nouvelles tables à inclure dans la procédure de reset du jeu sont `kq_care_interventions`, `kq_care_purchases` et `kq_care_inventory`. Supprimer les interventions avant les cultures référencées. Après le reset, vérifier les stocks vides, l'absence de reçus d'achat réutilisables et les mêmes dotations de départ pour chaque joueur. Aucune suppression n'est programmée automatiquement par ce changement.

## Boucle de jeu

La clarification locale du 30 octobre 2026 ajoute une entrée **Produits de soin** avant l’entretien général. La réserve ouvre **Pour cette culture**, qui regroupe les produits ciblant les problèmes observés. Les rayons Intrants et Protection biologique restent accessibles. Une correspondance de cible n’annule pas les restrictions d’utilisation : chaleur, stade trop avancé, cible déjà suivie et limites d’apports restent indiqués.

Le registre présente stock, utilisation et prix d’achat avant les explications repliées. Acheter ajoute une charge ; utiliser consomme une charge possédée, avec effet au bilan. Le stock et les prix inconnus sont indiqués comme tels et peuvent être actualisés. Les tarifs viennent du catalogue serveur ; la simulation locale conserve son propre catalogue. Une demande interrompue se vérifie avec la même clé tant que la réserve reste ouverte, y compris après épuisement du budget ou du stock par la première demande. Voir le lot 22 de [l’audit de clarté](AUDIT-CLARTE-ET-PARCOURS-2026-10-29.md) pour les validations. Ces changements n’ajoutent aucune migration et restent à publier.

- Une vitalité de 0 à 100. À zéro avant la récolte, la culture s'arrête. Un secours unique existe pour la première culture.
- Trois niveaux de gravité, une tendance et un journal. Douze familles de problèmes disposent chacune de deux formulations de symptômes. Les apparitions ambiantes s'arrêtent dès que deux troubles sont présents ; une situation explicite reste toujours prise en compte, sans effacer les foyers précédents. Au plus un nouveau trouble par étape vivante, donc cinq au maximum pour la persistance.
- Aucun dommage lié à la consultation ou au temps hors connexion. Un bilan intervient à la validation d'une opération.
- L’entretien de base coûte 5 € de jeu par étape. Il ne peut être payé qu’une fois pour le bilan concerné et exige la trésorerie disponible. Observer reste gratuit et ne demande aucune carte.
- Quatre intrants, au plus deux apports différents par culture et un par bilan. Le bonus cumulé de rendement est plafonné à 10 %. Les pertes antérieures ne disparaissent pas quand la plante récupère.
- Six auxiliaires biologiques ciblés, suivis sur deux bilans. Les coccinelles commencent à réduire le foyer au premier bilan ; les cinq autres après installation, au second. Aucun effet à l'achat ou au clic d'application. Un auxiliaire incompatible ne peut pas être consommé. Pas d'empilement sur une cible déjà suivie.
- Après récolte, la vitalité conserve son bilan. La sixième opération est le séchage, qui concerne la conservation du lot et de son profil. Le lot suit ensuite 6 heures réelles d’affinage avant le jury, indépendamment du calendrier du jeu. La vente devient accessible après ce verdict, selon les règles du circuit choisi. Voir [Stockage et affinage](STOCKAGE-CURING-2026-10-15.md).

Ces points, prix, durées en tours et pourcentages de bonus sont des **paramètres d'équilibrage du jeu**, pas des résultats expérimentaux ni des consignes agronomiques.

## La Botte et les soins : responsabilités distinctes

La collection active comprend 12 communes, 7 peu communes, 7 rares et 4 épiques.
Les six PBI s’achètent dans la boutique de soins. Leurs anciennes cartes,
BOTTE-002/010/011/012/022/023, ainsi que les observations BOTTE-004/025, sont
archivées : les exemplaires et reçus anciens restent conservés, mais ces cartes
sortent des packs et des nouvelles cultures. Observer reste gratuit.

Les communes Reprise délicate (037) et Humidité rééquilibrée (038) complètent
les réponses aux incidents de reprise et d’humidité. Reprise experte (039),
Réglage d’urgence (040), Équipe de récolte (041) et Séchage sous contrôle (042)
sont des réactions épiques à 3 ou 4 XP capables de corriger plusieurs dés faibles.
Une seule carte épique peut être jouée par culture, avec les limites habituelles
d’une préparation et d’une réaction par étape. Leur effet ne rétablit pas
directement la vitalité, ne supprime pas un foyer de parasites et ne restaure
pas les pertes déjà enregistrées. Le bilan biologique suit ensuite le résultat
de l’opération selon les règles communes.

La compatibilité repose sur une liste de situations propre à chaque carte,
partagée par l’autorisation de jeu et le calcul du bonus d’opération pertinente.
Les instruments donnent une correction ou un choix utile après la mesure ;
ils ne verrouillent jamais les observations. Tri et isolement peut contenir
le danger d’un pollen indésirable, sans promettre une guérison du lot.

La confirmation d’une carte présente son effet et sa limite, avec le coût en XP,
la copie détruite et les réserves disponibles à côté du bouton **Jouer la carte**.
Ces commandes restent visibles pendant le défilement. Une réaction déterministe
compare le bilan sans et avec la carte ; la santé utilise une échelle de 0 à 100.
Les préparations et relances aléatoires ne dévoilent aucun résultat futur.
Règles, exemples et chiffres complémentaires se déplient à la demande.
Consulter ou annuler ne dépense rien ; fermer pendant une confirmation déjà
envoyée n’annule pas la demande. Voir le lot 23 de l’audit de clarté.

Si la confirmation est perdue ou incomplète, **Vérifier ma culture** remplace
l’action de jeu. Les actions de culture sont suspendues ; le panneau de reprise
reste disponible après fermeture du dialogue. La vérification relit la culture,
son album, puis la même culture et exige deux états concordants avant de reprendre.
Elle ne renvoie aucune consommation. Les XP et copies sont remplacés par les
valeurs vérifiées ; une lecture en erreur ou incomplète conserve le blocage.
Un reçu retrouvé confirme la carte jouée ; son absence est annoncée sans affirmer
que la demande a échoué. Chaque nouvelle demande précise son étape, vérifiée côté
serveur avant la transaction existante, pour empêcher une demande retardée de
s’appliquer à l’étape suivante. La confirmation attend également la fin du
chargement de l’album. Voir le lot 24 de l’audit de clarté.

Les situations du dernier tour concernent le séchoir : plateau
surchargé, condensation du local, porte mal fermée. L’achat et la capacité des
bocaux se gèrent ensuite dans l’entrepôt. Le séchage puis l’affinage précèdent le
jury et le duel ; aucune carte ne raccourcit les 6 heures d’affinage
réelles. Les règles détaillées et les six nouvelles cartes
figurent dans [le règlement de travail](PLACARD-RULES-DRAFT.md).

Dans les packs, le premier emplacement est Commun ; les emplacements aléatoires
suivent Commun 70 %, Peu commune 23 %, Rare 6 %, Épique 1 %. Une récompense bot
isolée suit la même table sans garantie Commun. La migration
`20261010000500_botte_situations_epic.sql` porte ce catalogue et ces tirages ;
son application et la publication de l’interface doivent être coordonnées.

## Intrants et protection biologique : références retenues

| Référence du jeu | Pourquoi elle existe | Limite retenue |
| --- | --- | --- |
| Thé de compost | Des essais étudient les effets des préparations de compost sur le sol et les plantes. | Les résultats varient : l'essai sur soja cité ci-dessous ne montre pas de bénéfice systématique. Soutien conditionnel, aucune promesse universelle. |
| Lombricompost | Amendement organique commercial réel, par exemple Worm·Humus. | Action accompagnant un trouble nutritif ; pas de guérison instantanée. |
| Engrais organique | Produits réels Bio·Grow/Bio·Bloom : nutrition végétale. | Un apport ne garantit ni rendement ni hausse de cannabinoïdes. Le jeu refuse cet apport face à un stress salin actif. |
| Extrait d'algues | Exemple réel Alg·A·Mic, utilisé comme soutien face au stress. | Effet de jeu modeste, aucune restauration des pertes passées. |
| Aphidius colemani | Parasitoïde de certaines espèces de pucerons. | Cible spécifique ; ne traite pas les thrips ou les tétranyques. |
| Phytoseiulus persimilis | Prédateur spécialisé des tétranyques. | Installation sensible aux conditions, pas un remède à tous les « acariens ». |
| Amblyseius swirskii | Prédateur notamment des jeunes larves de thrips. | Contention, pas disparition instantanée de tous les stades. |
| Orius laevigatus | Prédateur des stades mobiles des thrips. | Action suivie dans le temps. |
| Chrysoperla carnea | Larves prédatrices de pucerons et de certains thrips, dont Echinothrips dans la fiche Chrysopa. | Polyvalence modérée ; ne signifie pas tous les stades de tous les thrips. |
| Coccinella septempunctata | Larves et adultes prédateurs, intérêt curatif dans les colonies de pucerons. | Réduction possible au premier bilan de jeu ; aucune guérison au clic. |

Sources : [essai thé de compost, Plants 2021](https://www.mdpi.com/2223-7747/10/8/1638), [essai horticole, Frontiers 2025](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2025.1524884/full) ; fiches fabricants [Worm·Humus](https://biobizz.com/products/worm-humus), [Bio·Grow](https://biobizz.com/products/bio-grow), [Bio·Bloom](https://biobizz.com/products/bio-bloom), [Alg·A·Mic](https://biobizz.com/products/alg-a-mic). Les fiches commerciales identifient le produit et son usage déclaré ; elles ne prouvent pas un gain chiffré de qualité.

Pour les auxiliaires : [Aphipar](https://www.koppert.fr/aphipar/), [Spidex](https://www.koppert.fr/spidex/), [Swirski-Mite](https://www.koppert.fr/swirski-mite/), [Thripor-L](https://www.koppert.fr/thripor-l/), [Chrysopa](https://www.koppert.fr/chrysopa/), [INRAE — Coccinella septempunctata](https://ephytia.inrae.fr/fr/C/20817/Biocontrol-Coccinella-septempunctata) et [son activité prédatrice](https://ephytia.inra.fr/fr/C/20821/Biocontrol-Activites-entomophages). Références vérifiées le 10 octobre 2026, conservées ici sans liens documentaires dans les fiches du joueur.

### Rôles et fenêtres d'intervention

| Auxiliaire | Prix du jeu | Cibles retenues | Baisse de gravité au 1er / 2e bilan |
| --- | --- | --- | --- |
| Aphidius | 12 € | Pucerons | 0 / 2 : économique, différé |
| Phytoseiulus | 14 € | Tétranyques | 0 / 2 : spécialiste |
| Swirskii | 11 € | Thrips | 0 / 1 : économique, modéré |
| Orius | 18 € | Thrips | 0 / 2 : plus fort sur foyer installé |
| Chrysoperla | 14 € | Pucerons et thrips | 0 / 1 sur chaque foyer : polyvalent, une charge pour les deux |
| Coccinella | 16 € | Pucerons | 1 / 2 : recul dès le premier bilan |

Ces baisses sont des paramètres fictifs ; la gravité n'est pas le stade biologique des insectes. La prédation des coccinelles, le délai du parasitisme d'Aphidius et les cibles documentées motivent les rôles, sans valider les chiffres ni une hiérarchie universelle d'efficacité. La contention réduit aussi les dégâts et empêche l'aggravation liée à un échec pendant l'intervention. Les réussites d'opérations et l'entretien restent pris en compte séparément. Aucun auxiliaire ne répare les pertes antérieures.

Une PBI doit être engagée au plus tard en floraison : deux validations restent alors possibles, floraison puis récolte. Dès la récolte, y compris entre le résultat de floraison et l'ouverture de la récolte, l'application est refusée sans consommation. Les charges restent achetables pour les cultures suivantes. L'entretien payant et les intrants conservent leurs fenêtres habituelles.

Phytoseiulus est refusé en présence d'un stress thermique actif. Si ce stress apparaît après une application valide, l'action reste perturbée au bilan : ce n'est pas une protection garantie contre un événement futur. Cette abstraction des conditions très chaudes/sèches décrites par Koppert ne signifie pas que les autres auxiliaires sont insensibles au climat.

## Symptômes et diversité

Le modèle couvre les troubles azote, phosphore, potassium, magnésium, calcium et fer ; les pucerons, thrips et tétranyques ; le stress racinaire, le stress thermique et l'accumulation de sels. Les observations nutritives débutent comme des hypothèses : une couleur de feuille seule n'identifie pas une carence avec certitude.

Les trois ravageurs peuvent apparaître indépendamment de la carte de situation en enracinement, croissance et floraison. Le tirage reproductible réserve un cas sur cinq à un trouble nutritif et un sur cinq à un ravageur, sous réserve des limites : aucune apparition ambiante si deux troubles sont déjà présents ou si le bilan précédent a fait perdre au moins 15 points de vitalité. Les situations explicites ont priorité. Aucun nouveau ravageur ambiant n'arrive à la récolte ou au séchage ; les foyers existants restent suivis jusqu'à la récolte. Ces fréquences sont des choix d'équilibrage, pas des incidences agricoles mesurées.

[Cockson et al., 2019](https://www.mdpi.com/2076-3417/9/20/4432) décrit des symptômes de privation nutritive sur un cultivar expérimental. [Llewellyn et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36771506/) montre que les symptômes et conséquences varient. Ces essais contrôlés ne sont pas des mesures de réponses universelles en sol vivant. Le jeu utilise les descriptions et les distinctions entre tissus jeunes/anciens, pas leurs doses ni leurs pertes de rendement.

Autres références : [diagnostic des troubles nutritifs — Penn State](https://plantscience.psu.edu/research/labs/roots/methods/methods-info/nutritional-disorders-displayed), [engorgement racinaire — University of Minnesota](https://extension.umn.edu/agriculture/crop-production/small-grains/wheat-flooding-and-waterlogging), [excès de sels — University of Maryland](https://www.extension.umd.edu/resource/excess-fertilizer-or-salt-damage-flowers), [stress thermique — University of Minnesota](https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat).

## Terpènes et arômes : un seul axe de jugement

Les terpènes contribuent aux arômes. L'indice terpènes suivi pendant la culture alimente donc la note aromatique de la Fleur ; il n'est pas récompensé une deuxième fois comme un critère indépendant. Les réussites en floraison, récolte et séchage interviennent dans ce suivi. Une opération pertinente compte en plus du résultat des dés. Aucun achat ne donne directement « + terpènes ».

Le lien numérique est un choix de jeu : l'indice terpènes contribue majoritairement à la note aromatique, avec une part d'expression/conservation issue des résultats structurés. Il ne représente ni une concentration ni une équation sensorielle validée. D'autres composés volatils participent aussi à l'odeur : [Oswald et al., ACS Omega 2023](https://pubs.acs.org/doi/10.1021/acsomega.3c04496). La diversité génétique des profils est documentée dans [Nature Plants 2021](https://www.nature.com/articles/s41477-021-01003-y).

## Cannabinoïdes et analyses de laboratoire

Il n'existe pas de liste universelle de « tous les cannabinoïdes Cofrac ». Une accréditation couvre des essais, méthodes et matrices précis. Elle ne certifie ni le jeu ni automatiquement tous les paramètres proposés par un laboratoire.

Base documentaire retenue : [offre d'analyses LABEXAN](https://www.labexan.com/produits-cbd/), [plaquette du laboratoire](https://www.labexan.com/wp-content/uploads/2024/03/LABEXAN-Plaquette-analyses-produits-CBD.pdf) et [attestation Cofrac 1-5810](https://tools.cofrac.fr/annexes/sect1/1-5810.pdf), consultées le 10 octobre 2026. L'offre détaillée énumère sept familles :

| Famille | Forme neutre | Forme acide | Valeur calculée séparée |
| --- | --- | --- | --- |
| THC | Δ9-THC | Δ9-THCA | THC total potentiel |
| CBD | CBD | CBDA | CBD total potentiel |
| CBG | CBG | CBGA | CBG total potentiel |
| CBC | CBC | CBCA | CBC total potentiel |
| CBN | CBN | CBNA | CBN total potentiel |
| CBDV | CBDV | CBDVA | CBDV total potentiel |
| THCV | THCV | THCVA | THCV total potentiel |

Cela représente **14 formes et 7 totaux**, et non 21 molécules différentes. La page commerciale annonce jusqu'à 24 paramètres sans tous les détailler : le jeu ne prétend pas avoir identifié trois dosages supplémentaires. Dans l'attestation révision 15 consultée, la portée « matrices végétales de chanvre » énumère Δ9-THC, CBD, CBG, CBGA, THCA et CBDA. Les autres lignes du panel complet ne doivent pas être présentées comme couvertes par cette portée. Une portée est susceptible d'évoluer : conserver l'identité et la date de référence.

La fiche du jeu porte la mention **profil simulé**. Aucun logo Cofrac, numéro de certificat réel ou allégation d'analyse accréditée n'est appliqué à une récolte virtuelle. Les Buddies existants ne possèdent pas de mesures chimiques vérifiées : les profils numériques sont des profils fictifs stables, pas des analyses des variétés commerciales portant les mêmes noms.

## Ce qui fait évoluer un taux

1. **Potentiel génétique et développement.** La plante produit principalement des précurseurs acides. Des voies enzymatiques orientent notamment le CBGA vers les familles CBDA, THCA et CBCA. Le potentiel d'une variété limite ce que ses opérations peuvent exprimer ; une carte ne change pas son identité chimique. [Taura et al., 1996](https://doi.org/10.1074/jbc.271.29.17411), [Morimoto et al., 1998](https://pubmed.ncbi.nlm.nih.gov/9862135/), [étude génétique des chimiotypes](https://pubmed.ncbi.nlm.nih.gov/33103246/).
2. **Concentration et quantité produite sont différentes.** Une récolte plus lourde ne garantit pas un pourcentage plus élevé. Les effets nutritionnels dépendent notamment du génotype ; le modèle n'accorde pas de bonus de cannabinoïde à chaque achat d'engrais. [Étude sur croissance et concentration, 2025](https://www.nature.com/articles/s41598-025-96761-6).
3. **Transformation acide/neutre.** Une diminution d'une forme acide peut accompagner une hausse de sa forme neutre. Ce déplacement n'est pas une nouvelle biosynthèse et ne crée pas un bonus de qualité. Les totaux potentiels appliquent la correction de masse moléculaire correspondant à la perte de CO₂. [Wang et al., 2016](https://pubmed.ncbi.nlm.nih.gov/28861498/).
4. **Dégradation et conservation.** Certaines évolutions peuvent augmenter CBN/CBNA pendant que d'autres constituants diminuent. Ce n'est pas un objectif de qualité. Le comportement dépend de l'état initial et des conditions ; le CBN seul n'est pas une horloge universelle, notamment sur un profil pauvre en THC. [Milay et al., 2020](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2020.583605/full).

Traduction ludique : un potentiel fixe, une expression liée aux résultats des opérations, une conservation suivie au séchage, puis un rapport séparant les formes et leurs totaux. Les coefficients, vitesses de transformation et limites de lecture sont des abstractions de jeu. Le modèle ne fournit aucun réglage de culture ni protocole de transformation réel.

La simulation exprime ses teneurs sur une base de masse sèche constante : une simple perte d'eau n'invente pas de cannabinoïdes. Les quatre profils fictifs sont attribués de manière stable à chaque identifiant de variété, indépendamment de la rareté et du tirage de la partie. L'expression démarre à 55/99. À la floraison/récolte, les résultats critique/réussi/fragile/raté valent respectivement +20/+14/0/−5, avec +2 pour une opération pertinente réussie. Deux opérations critiques pertinentes permettent ainsi d'atteindre le potentiel 99. Au séchage, ils valent 0/0/−2/−5 : réussir conserve le potentiel, sans création chimique supplémentaire.

La fraction neutre initiale est un paramètre fictif de 5 %, pas une valeur mesurée du cultivar. Les transferts du dernier bilan sont bornés à 20 % : ils redistribuent le potentiel acide/neutre et peuvent dégrader une partie du THC/THCA en CBN/CBNA. Ils n'accordent aucun bonus de note. Les facteurs neutre/acide retenus sont 0,877 pour THC/CBD/CBC, 0,878 pour CBG, 0,867 pour CBDV/THCV et 0,876 pour CBN, arrondis des rapports de masses moléculaires. Les calculs conservent quatre décimales ; l'affichage présente trois décimales. Un zéro affiché ne signifie pas « non détecté » par un laboratoire : aucun seuil analytique réel n'est simulé.

La sixième note de la Fleur est le **potentiel cannabinoïde** développé puis conservé. Ce libellé remplace « fidélité cannabinoïde » sans changer le calcul : il s'agit d'un indice de jeu compris entre 35 et 99, initialisé à 55, distinct des teneurs simulées en %. Ainsi, 55/99 ne signifie pas 55 % de CBD, de CBG ou de THC. Les opérations réussies en floraison et à la récolte le font progresser ; le séchage peut le préserver ou le réduire. Aucun intrant ne lui ajoute de bonus direct. Le jury compare cet indice propre à chaque variété et ne récompense pas automatiquement une valeur THC, CBD ou CBN plus élevée. Il conserve trois manches ; l'axe aromatique et l'axe cannabinoïde ont des rôles distincts. Un total potentiel ne s'additionne jamais à ses deux formes dans un « total de cannabinoïdes » : ce serait compter deux fois la même matière.

## Persistance et vérification

Le volet **Ajuster ma main** sépare l’échange avec **Main prévoyante** de la nouvelle pioche. L’échange suit trois choix visibles : carte à retirer, carte à faire entrer, confirmation. Il ne joue aucune carte, ne dépense aucun XP et ne brûle aucune copie ; les coûts pour jouer la carte restent dans ses détails. Le moteur autorise ces échanges uniquement à la première étape, avant la préparation ou le lancer. Repiocher utilise un changement limité pour toute la culture et retire la réserve éventuelle : cette conséquence est annoncée et confirmée avant l’action, sans perte des copies dans l’album. Les commandes attendent la fin des confirmations ou d’une vérification de carte ; les choix périmés sont effacés. Voir le lot 26 de l’audit de clarté.

Le panneau de santé reste repliable. Le portrait de Sylvain reprend les illustrations existantes de chaque étape : scène de préparation, réaction au résultat validé, ou état préoccupant si la santé ou la gravité d'un foyer le justifie. Une alerte de santé prime sur une réussite des dés ; la dernière opération et sa variation de santé restent affichées séparément. Après avancement, l'image montre bien la nouvelle étape. Au séchage, elle représente le lot et la santé conserve le bilan à la récolte. Une culture arrêtée montre son étape réelle, sans soin disponible ni faux profil de récolte. La jauge segmentée, les niveaux de gravité, les tendances et les produits illustrés rendent les observations et interventions lisibles ; les illustrations ne diagnostiquent pas un ravageur précis. Cette présentation ne modifie aucun calcul, tirage ou état sauvegardé.

Le bouton « Entretenir la culture » affiche son prix et son effet avant utilisation, puis devient « Entretien activé » pour l'étape nommée. L'entretien coûte 5 € de jeu et est engagé une seule fois pour un bilan ; après un résultat déjà validé, il vise l'étape suivante, qui nécessite un nouveau paiement. Les fonds insuffisants empêchent l'activation. Il n'agit jamais au clic : au bilan, il ajoute 3 au calcul de santé, plafonnée à 100, et retranche jusqu'à 2 dégâts par problème persistant. Sur une opération biologique, il empêche l'aggravation liée à l'échec et participe au recul d'un niveau sur réussite, sans doubler le même recul déjà accordé par une opération adaptée. L'aide dépliable donne un exemple chiffré et précise l'absence de réparation des pertes antérieures ou de bonus direct de terpènes/cannabinoïdes. Les règles de santé restent inchangées. En simulation locale, le débit et l'entretien sont enregistrés dans le même journal de reprise ; une relance après interruption ou depuis l'ancien état ne facture pas à nouveau la même étape.

Le bilan de fin de culture prend la forme du carnet de Sylvain : récit issu des résultats enregistrés, moments marquants illustrés, lecture des trois indices de récolte, puis parcours et conseils dépliables. « Potentiel cannabinoïde » remplace le libellé « fidélité » dans le suivi, la Fleur et le jury. L'indice sur 99 est expliqué séparément des pourcentages simulés de CBD, CBG et THC ; les variations enregistrées en floraison, récolte et séchage restent consultables. Les soins sont décrits à partir de leurs bilans propres, sans leur attribuer toute la variation de santé. Une disparition des problèmes au séchage n'est pas présentée comme une guérison. Une culture interrompue ne présente aucun faux profil de récolte ; les anciens parcours signalent les détails manquants. Aucun calcul, gain ou reçu sauvegardé n'est modifié par cette présentation.

Le bilan met d’abord en avant la quantité récoltée, la qualité de culture en
points et **Ranger ma récolte**. En solo, **Journal et cartes**, **Charges et
factures** et **Ma Fleur d’Arène** sont repliés ; les contrats et récompenses
restent visibles. La campagne présente les résultats de chaque variété, avec
les profils et taux simulés derrière **Profil et détails**. Son bulletin détaillé
identifie la variété et la zone auxquelles son calcul s’applique, sans présenter
le rendement du meneur comme le total de la campagne. Une quantité inconnue
reste indisponible, distincte d’un zéro confirmé. En solo, le bulletin de récolte
et la carte ne sont pas présentés sans quantité positive connue. La carte
officielle doit correspondre à cette culture ; sans correspondance, le bilan
indique **Fleur à confirmer**. Le suivi et les faits du journal restent
consultables. Voir le lot 25 de l’audit de clarté.

Les soins officiels passent par des routes authentifiées. Prix et stock sont vérifiés côté serveur ; achat et consommation utilisent des clés d'idempotence. Le stock, la version de la culture et son état sont mis à jour dans une transaction. Les permissions SQL sont explicites. Le mode local utilise un budget de simulation indépendant et un journal de reprise des écritures.

La migration `20261010001000_kq_paid_basic_care.sql` instaure l'entretien officiel payant : 5 € par activation, contrôle du solde, débit, charge comptable et reçu dans la même transaction. Elle a été appliquée le 10 octobre 2026 au projet lié `eyowwwpdmfrulhkpvlnf`, à la demande de l'utilisateur, dans un lot isolé. L'historique distant confirme que seule la version 010 a été ajoutée ; le lot est désormais à jour. La signature de l'API et les permissions effectives ont été vérifiées en lecture seule, sans modifier de partie. Reçu : `output/paid-care-migration/application.json`. Cette application ne publie pas le code du site. Le suivi n'autorise un nouveau paiement que lorsque le serveur fournit le tarif ; la requête confirme le prix affiché. Les anciens onglets qui présentent encore un bouton gratuit sont refusés sans débit. Les anciens reçus restent à 0 €, et une reprise de demande renvoie le montant réellement payé sans le facturer à nouveau. Si une réponse est perdue, le bouton permet de vérifier le même paiement même lorsque le solde est devenu nul. Le prix et le solde sont visibles avant le clic, et la réserve est actualisée après le débit. Les effets biologiques et la limite d'une activation par étape ne changent pas.

Fichiers principaux : `src/lib/kanab-quest-care.ts`, `kanab-quest-battle.ts`, `supabase/kanab-quest-care-backend.ts`, composants `KqCultureCarePanel`/`KqCareShop`, migration `20261010000100_kq_culture_care.sql`.

La migration complémentaire `20261010000600_kq_care_explicit_problems.sql` porte le plafond SQL de deux à cinq problèmes. Elle a été appliquée le 10 octobre 2026 au projet lié `eyowwwpdmfrulhkpvlnf`, à la demande de l'utilisateur, avec un lot isolé ne contenant que ce correctif en attente. L'historique distant confirme la version 006 et la prévisualisation suivante confirme ce lot à jour. La migration 005 de la Botte reste en attente. Reçu : `output/pbi-care-migration/application.json`. Cette application ne réécrit aucun état et ne publie pas le code du site.

Les anciennes sauvegardes restent lisibles. Les paramètres révisés s'appliquent aux cultures bêta de règles 3 : les analyses recalculées d'anciennes interventions Coccinella ou Chrysoperla peuvent différer. Ce changement prépare le reset de lancement, sans garantie de relecture identique de ces bilans bêta. Les tests PBI couvrent les six auxiliaires, les fenêtres, les refus sans consommation et les apparitions indépendantes des situations.

Contrôles : suites Vitest du moteur, sauvegardes, jury, transactions et tutoriels ; `node scripts/test-placard-culture-care.mjs` ; `node scripts/audit-culture-care.mjs` ; `npm run check:supabase-grants` ; TypeScript et ESLint. Le script navigateur couvre les composants réels du panneau et du rayon, en mode local. Il ne remplace pas une recette du serveur déployé.
