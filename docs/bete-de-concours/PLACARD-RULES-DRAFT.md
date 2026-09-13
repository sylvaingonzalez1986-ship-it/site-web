# Règlement du Placard — brouillon de lancement

Version de travail `2026-09-12-draft-5`. Ce document n'est pas publié aux
clients et ne vaut pas règlement commercial tant que les lots, les dates de
saison et les probabilités des collections ne sont pas validés.

## 1. Principe

Le Placard est le jeu de cartes de culture de Kanab Quest. Une partie utilise
une variété Buddie possédée dans l'album, le Sol vivant commun et les cartes La Botte
choisies dans la collection du joueur. La culture terminée produit une carte
Fleur numérique unique qui peut participer à un duel classé.

La carte Buddie d'origine n'est jamais détruite par le Placard. Une carte
Héritage équipée est permanente et ne brûle jamais.

## 2. Cartes La Botte et burns

- Le Sol vivant est la base commune gratuite ; les anciennes cartes Substrat sont archivées.
- Chaque autre carte La Botte brûle uniquement lorsqu'elle est effectivement
  jouée.
- Une carte PBI reste hors du deck. Elle devient jouable après l'inspection à
  la Loupe lorsqu'un ravageur compatible est identifié, puis brûle à son usage.
- Les cartes restées dans le deck ou dans la main sans être jouées ne brûlent
  pas.
- Chaque burn produit un reçu serveur et retire exactement une copie physique
  de l'inventaire numérique.

## 3. Culture et Fleur

La culture se déroule en étapes résolues par trois dés, les cartes et les
effets permanents autorisés. Le serveur conserve la seed, l'état de la partie
et les reçus. Une culture terminée crée une seule Fleur avec ses statistiques,
traits et combos. La Fleur est distincte de la carte Buddie qui a servi de
variété.

Les Buddies donnent un bonus d’XP de départ selon leur rareté : Commun +0,
Argent +1, Or +2, Épique +3, Légendaire +4. Avec l’XP de base, cela donne
respectivement 1, 2, 3, 4 et 5 XP au début d’une culture, avant les bonus de
mission et d’Héritage. Les Buddies n’ont pas de talent lié à une étape.
Les 32 cartes La Botte actives ont chacune un effet distinct ; leur coût et
leur fenêtre d’utilisation imposent un choix.

Les statistiques de la Fleur et les notes du jury sont conservées au
dixième afin de limiter les égalités sans inventer un bonus aléatoire caché.

## 3 bis. Boosters Kanab Quest

- Les boosters Buddies restent inchangés dans l'album principal.
- L'Arène vend séparément un booster La Botte contenant dix cartes.
- Un booster La Botte coûte 5 points.
- Les deux boutiques utilisent le même portefeuille de points fidélité.
- Les Buddies restent permanentes. Les règles de burn ne concernent que les
  cartes La Botte effectivement engagées ou utilisées dans le Placard.
- Les Héritages ne figurent dans aucun de ces boosters. Ils restent liés au
  parcours des fleurs concours.
- Les nouveaux packs ne remplacent ni ne modifient rétroactivement les packs
  déjà obtenus.

## 3 ter. Probabilités techniques proposées

Un booster La Botte standard contient dix cartes. Son premier emplacement est
toujours Commun. Chacun des neuf autres emplacements est tiré indépendamment :
Commun `70 %`, Peu commune `24 %`, Rare `6 %`. À rareté fixée, chaque référence
active possède le même poids. Les doublons restent possibles, y compris dans un
même booster. Un booster de victoire en duel contient trois cartes et applique
la même garantie sur son premier emplacement puis la même table aux deux autres.

Les Héritages ont la même valeur technique et aucune rareté publique. Le
catalogue contient une carte par producteur présent sur la plateforme. Un avis
éligible validé sur une fleur d'un producteur débloque la carte de ce producteur
de façon idempotente. Lorsqu'un producteur quitte le catalogue, sa carte est
archivée : elle ne peut plus être gagnée ni équipée dans une nouvelle culture,
mais elle n'est jamais retirée de l'album des joueurs qui l'ont déjà obtenue.
Chaque producteur actif reçoit une mécanique différente, choisie dans une
bibliothèque éditoriale de vingt-quatre pouvoirs. La base interdit deux cartes
producteur actives partageant le même pouvoir. Si la bibliothèque est épuisée,
la nouvelle carte reste inactive et signalée « en attente éditoriale » jusqu'à
l'ajout d'un pouvoir distinct ; aucun doublon de mécanique n'est créé en silence.
Chaque doublon éventuel donne un fragment et cinq fragments permettent de
fabriquer une référence producteur active manquante.

Ces probabilités décrivent le moteur actuellement implémenté. Elles restent à
faire approuver avant publication et activation commerciale.

## 4. Équipement durable et monnaie du Placard

Toutes les nouvelles cultures utilisent le Sol vivant. Les quatre anciennes cartes de mode restent archivées pour les historiques.

L'argent du Placard est une monnaie virtuelle propre au jeu. Il ne correspond
pas aux points fidélité, ne peut pas être acheté, retiré, remboursé ou converti
en argent réel. Chaque joueur commence avec `350 €` virtuels ainsi qu'une tente
90 × 90, une LED 115 W et une extraction de départ.

Un équipement acheté est permanent. Il n'est ni brûlé ni racheté à chaque
culture. Une seule pièce peut être installée dans chaque emplacement ; remplacer
une pièce installée ne détruit pas l'ancienne. Les achats, le débit du
portefeuille et leurs reçus sont validés atomiquement par le serveur. Une même
référence ne peut pas être achetée deux fois.

Catalogue de lancement :

Les prix en euros sont des valeurs de jeu. Les références matérielles documentent
l’inspiration visuelle et technique ; leurs prix historiques étrangers ne sont
pas des taux de conversion. Les premières machines de transformation ont des prix
adaptés à la progression : tamis 550 €, presse 850 €, laveuse 1 250 €.

| Équipement | Prix virtuel en euros |
| --- | ---: |
| Tente renforcée 120 × 120 | 199 € |
| LED spéciale 300 W | 359 € |
| Extracteur EC 6 pouces | 149 € |
| Contrôleur climatique AI+ | 139 € |
| Pollinator à sec Resinator OG | 550 € |
| Ice washer Mini Osprey 2.0 | 1 250 € |
| Collecteur AutoSieve | 4 995 € |
| Séparateur statique Plasmastatic | 22 800 € |
| Presse à rosin | 850 € |
| Sécheur de hash HiLyph XL | 7 495 € |
| Panneau solaire et batterie | 1 149 € |
| Caméra cabossée | 69,99 € |

La tente, l'éclairage et le climat modifient la quantité, la qualité maximale,
la régularité, la pression ou la consommation. Les machines de transformation
déterminent les voies disponibles, la part du lot traitable et la précision.
Certaines installations imposent une compatibilité : le contrôleur climatique demande une
extraction renforcée ; l'AutoSieve et le HiLyph demandent une laveuse ; le
Plasmastatic demande le pollinator à sec.

### Niveaux du matériel

La boutique propose une seule référence par fonction, soit douze matériels achetables.
Chaque achat commence au **niveau 1** et peut être amélioré jusqu’au **niveau 10**.
Le coût du niveau suivant vaut 10 % du prix de base multiplié par le niveau actuel,
arrondi au cent supérieur. Exemple : la caméra coûte 69,99 € ; passer du niveau 1
au niveau 2 coûte 7 €. Les améliorations utilisent uniquement l’argent virtuel.

Chaque niveau augmente un avantage : quantité, régularité ou transformation.
Les bonus de quantité et régularité déjà présents augmentent de 10 % de leur valeur
initiale par niveau (incrément arrondi à l’entier supérieur). La qualité maximale
gagne un point aux niveaux 4, 7 et 10. La caméra et le secours solaire conservent
leur protection complète et gagnent un point de régularité par niveau supplémentaire.
Les bonus restent soumis aux plafonds habituels des statistiques et de récolte.

La capacité de la presse gagne 8 points par niveau, celle de la laveuse 6 points,
et celle des autres machines de transformation 2 points, sans dépasser 100 %.
Chaque machine de transformation gagne aussi 2 % de valeur par niveau supplémentaire.
Si une filière utilise plusieurs machines, la moyenne de leurs bonus de valeur
s’applique au produit transformé ; le reliquat brut ou biomasse garde son prix habituel.
Les seuils du jury continuent à conditionner l’accès aux filières.

L’apparence évolue uniquement aux niveaux **5** et **10** : standard, amélioré, expert.
Le matériel doit être installé pour appliquer ses bonus. Le niveau est enregistré
au lancement d’une partie ; les transformations utilisent les niveaux installés
au moment de la vente. Une requête rejouée ne peut pas débiter une seconde fois.
Les anciens modèles sont regroupés dans la référence unique en conservant le meilleur
palier déjà acheté, sans modifier le solde du joueur.

## 5. Incidents de culture

- **La facture qui pique** : un résultat Fragile ou un Échec programme une
  coupure à l'étape suivante. Pendant cette coupure, le meilleur dé devient un
  Danger. Le Panneau solaire et batterie empêche la coupure. L'Échéancier
  négocié réduit le seuil d'une réussite ; le Branchement illégal transforme
  les deux dés les plus faibles après le lancer, mais ajoute 2 Pression.
- **Contrôle DDTM** : la situation suit les résultats habituels du lancer.
  Papiers en règle fixe les trois dés sur une réussite et garantit donc trois
  réussites pour ce contrôle.
- **Renard à deux pattes** : sans protection, un résultat Fragile retire 15 %
  du poids final et un Échec en retire 35 %. Gros molosse ou la Caméra cabossée
  protège intégralement le lot contre cet incident.

Le Branchement illégal est une caricature de risque dans le jeu. Aucune image
ni règle ne décrit une méthode de raccordement réelle.

## 6. Duel classé Fleur contre Fleur

- Le joueur choisit uniquement sa Fleur et la dépose dans la file classée. Il
  ne parcourt aucune liste et ne choisit jamais son adversaire.
- Une seule Fleur par joueur peut attendre dans la file. Elle reste retirable
  tant qu'aucun match n'est formé.
- Le serveur constitue un groupe avec les douze plus anciennes Fleurs valides,
  puis tire l'adversaire au hasard dans ce groupe, sans filtre de qualité. Deux
  joueurs distincts en attente peuvent donc toujours former un match. Les
  identités et les Fleurs adverses ne sont pas exposées avant l'appariement.
- La file retente automatiquement l'appariement pendant l'attente. Cette
  reprise empêche deux candidatures déjà déposées de rester bloquées après une
  concurrence ou une interruption momentanée.
- Dès l'arrivée de la seconde Fleur, les deux cartes sont verrouillées, le jury
  est lancé automatiquement et le verdict tente de brûler immédiatement les
  deux Fleurs.
- Le jury résout trois manches. Deux manches gagnées donnent la victoire.
- Au verdict, les deux Fleurs sont définitivement brûlées, que leur
  propriétaire gagne ou perde.
- Le Buddie, les Héritages et les cartes La Botte non jouées ne sont pas
  affectés par ce burn.
- Si une interruption technique laisse exceptionnellement un duel verrouillé,
  le verdict reste relançable depuis l'historique. Après 48 heures sans verdict,
  il expire : aucun point, aucun burn et les deux Fleurs redeviennent disponibles.
- L'entraînement suit la même promesse de surprise : le joueur choisit sa Fleur
  mais jamais le bot. Le serveur tire l'un des trois jardins d'essai, révèle
  l'adversaire avec le verdict et ignore tout identifiant de bot envoyé par le
  navigateur. L'entraînement reste limité à dix duels quotidiens et ne modifie
  ni l'Elo ni la série. Il peut en revanche valider les trois défis du jour et
  ajouter leurs points de saison, une seule fois par défi et par journée.

Les défis ont donc la même valeur dans les deux modes, mais le duel humain reste
toujours plus rémunérateur par Fleur engagée : il ajoute `3 à 36` points de
saison directs et `0,6 à 1,6 EXP`, contre aucun point direct et `0,1 EXP` en
entraînement. Une victoire humaine accorde trois cartes La Botte, contre une
seule carte pour une victoire contre un bot.

Le verdict, le burn des deux Fleurs, le classement et les défis sont validés
dans une même transaction. Une seconde requête renvoie le reçu existant sans
appliquer un nouveau gain.

## 7. Jury, marché et réputation

Après le verdict d'un duel humain ou d'un entraînement bot, la Fleur brûlée
devient un lot valorisable. La note du jury est la moyenne des trois manches,
ramenée sur 10 et conservée au dixième. Chaque Fleur ne peut être vendue qu'une
fois. La vente, le gain d'argent virtuel et la réputation produisent un reçu
serveur idempotent.

| Voie | Note minimale | Rendement de base | Prix de base du produit |
| --- | ---: | ---: | ---: |
| Biomasse | 0,0 | 100 % | 0,30 €/g |
| Lot brut | 5,8 | 100 % | 1,80 €/g |
| Hash tamisé | 6,2 | 18 % | 16 €/g |
| Static Sift | 8,3 | 10 % | 60 €/g |
| Rosin d'essai | 6,5 | 15 % | 26 €/g |
| Hash eau-glace | 6,8 | 16 % | 22 €/g |
| Rosin Sélection | 7,2 | 18 % | 32 €/g |
| Rosin Premium | 8,0 | 20 % | 42 €/g |
| Rosin Signature | 8,8 | 22 % | 80 €/g |
| Hash Signature | 8,8 | 18 % | 70 €/g |

Le montant final dépend aussi de la note, de la capacité et de la précision du
matériel installé. La partie non traitée est valorisée en lot brut lorsque la
note du jury l'autorise ; elle retombe en biomasse dans le cas contraire. Hash
tamisé demande le Pollinator ; Static Sift demande en plus le Plasmastatic ;
Hash eau-glace demande une Laveuse ; les quatre Rosin demandent la presse à rosin et la note du jury requise ; Hash Signature demande à la fois Laveuse, AutoSieve et HiLyph.

Une filière d'équipement peut être épinglée comme objectif. Son seuil reste
visible pendant la culture sans convertir la Qualité de culture en note sur 10.
Dans la réserve, le jeu calcule une estimation pré-jury à partir des cinq
statistiques de la Fleur. Cette estimation sert uniquement au choix de la carte :
la moyenne des trois manches du verdict demeure la note commerciale officielle.
Le reçu du verdict affiche cette moyenne, la compare au seuil épinglé et peut
ouvrir directement le comptoir. Atteindre le seuil de note ne garantit pas la
transformation : le matériel installé est contrôlé séparément par le marché.

Lorsqu'un lot est vendu par la filière actuellement épinglée, l'objectif est
clos dans la même transaction que la vente et la filière rejoint les maîtrises
durables du joueur. Le reçu distingue une première maîtrise d'une répétition et
propose le prochain palier non maîtrisé de la même famille. Une machine
supérieure déjà possédée est réutilisée : le jeu ne recommande pas d'acheter un
modèle inférieur uniquement pour franchir ce palier.

Les maîtrises sont permanentes. Le HUD compte les huit voies de transformation,
additionne leurs ventes homologuées et conserve pour chacune le meilleur score
du jury. Au comptoir, une voie déjà pratiquée affiche aussi son cumul de ventes,
son record et les recettes totales enregistrées, y compris après reconnexion.
Chaque filière possède en plus un rang d'expertise calculé sur ses ventes :
Découverte à zéro, Apprentie dès la première, Confirmée à trois, Experte à six
et Maîtrise à dix. Ces rangs ne modifient pas les prix : ils donnent un objectif
de répétition lisible dans le HUD, sur la fiche de la voie et sur chaque reçu.
Les passages à Confirmée, Experte et Maîtrise accordent une prime unique de 5,
12 puis 25 points de réputation. La vente brute et la biomasse sont exclues de
ces primes. Le numéro de vente et la prime sont enregistrés dans le reçu afin
qu'une requête rejouée ne puisse jamais verser deux fois la récompense.

Le HUD affiche une mission d'atelier courte. Une filière épinglée est toujours
prioritaire ; sinon le jeu choisit le prochain rang demandant le moins de ventes.
La voie concernée remonte en tête du comptoir et indique le nombre de ventes et
la prime encore accessibles. Cette recommandation ne bloque aucune autre voie.
Depuis le HUD, le joueur peut l'épingler : le jeu réutilise une machine capable
déjà possédée ou sélectionne la prochaine machine pivot à financer. L'objectif
persistant utilise ensuite le parcours normal culture, estimation pré-jury,
verdict et comptoir.

La Biomasse ne donne jamais de réputation. Aucun lot sous `6,2/10` n'en donne,
même s'il peut être vendu brut à partir de `5,8/10`. Au-dessus de ce seuil, les
transformations exigeantes appliquent un multiplicateur de réputation plus
fort. Le système récompense donc les lots de qualité sans obliger le joueur à
valoriser une Fleur médiocre autrement qu'en biomasse.

### Marché vivant et progression commerciale

Conditions cumulatives, en plus de la note et des machines :

| Filière | Réputation | Ventes dans la famille | Niveau des machines |
| --- | ---: | ---: | ---: |
| Hash eau-glace | 8 | 2 hash | 2 |
| Rosin Sélection | 12 | 3 rosin | 3 |
| Rosin Premium | 35 | 6 rosin | 6 |
| Static Sift | 45 | 7 hash | 6 |
| Rosin Signature | 85 | 12 rosin | 9 |
| Hash Signature | 85 | 12 hash | 9 |

Hash tamisé et Rosin d’essai restent accessibles sans réputation ni historique.
La fabrication et la vente sont séparées : préparer un lot fixe son produit et
paie une seule fois les frais d’atelier. Les invendus et la partie non traitée
restent en stock. Plusieurs ventes peuvent écouler le même lot.

| Circuit | Tarif | Quantité et qualité |
| --- | --- | --- |
| Vente en ligne | Tarif conseillé lié à la qualité et à la réputation ; choix à 90 %, 100 % ou 122 % | Commandes limitées ; les mauvais lots font partir des clients |
| CBD shops | 40–55 % selon la qualité, bonus réseau de 0–4 points | Réseau de partenaires ; fleur dès 6,5/10, transformation dès 7,5/10 |
| Grossistes | 25 à 33 % du tarif de référence, normalement 30 % | Reprise de tout le volume, sans exigence de note ni réputation |

La fleur sous 5,8/10 peut désormais être préparée brute pour la reprise grossiste.
Les exigences de qualité et de matériel pour fabriquer les transformations
restent inchangées. La biomasse est reprise au tarif industriel dans ce circuit.
Le prix affiché par le joueur en ligne ne modifie jamais les tarifs professionnels.

Les shops ont un réseau distinct des clients en ligne : 20 partenaires au maximum,
avec au plus un nouveau par cycle. Fleur 6,5–6,9 : 40 % et départ progressif ;
7–7,9 : 45 % et réseau stable ; 8–8,9 : 50 % et recrutement ; 9–10 : 55 %
et recrutement plus rapide. Pour le hash/rosin, les seuils sont 7,5 / 8 / 9 / 9,5.
Les petits volumes s’additionnent ; la masse est ramenée à la fleur équivalente.
Le bonus est de +1 point dès 1 boutique, +2 dès 4, +3 dès 8 et +4 dès 12.
Les partenaires de début de cycle fixent le tarif réseau et le volume disponible
pour tout le cycle. La prospection reste possible sans partenaire.

La vente en ligne exige un ordinateur acheté `450 €` dans la boutique et un
abonnement Internet à `15 €` par culture terminée. Les quotas et l’événement du
cycle sont renouvelés une fois à la fin de la culture, jamais à l’actualisation.
L’abonnement est désactivable et l’accès déjà payé reste actif pour le cycle.
Sans trésorerie suffisante, la vente en ligne est suspendue ; boutiques et
grossistes restent ouverts. Une absence sans nouvelle culture n’est pas facturée.

| Réputation | Titre | Bonus de prix en ligne |
| ---: | --- | ---: |
| 0 | Cultivateur novice | +0 % |
| 60 | Main sûre | +5 % |
| 200 | Artisan du lot | +12 % |
| 600 | Signature locale | +20 % |
| 1500 | Maître du Placard | +30 % |
| 3000 | Référence du jury | +45 % |

Dès 1 500 points, les tendances défavorables et la saturation ne diminuent plus
le prix unitaire en ligne ; les quantités commandées restent limitées. Il n’y a
plus de garantie d’écoulement intégral. Les événements du cycle et les volumes
vendus sur 24 heures influencent la demande, avec une pénalité de saturation
plafonnée à 35 %. Les clients fidèles améliorent les commandes des cycles suivants.
Leur gain est plafonné à cinq par cycle ; les pertes liées à la qualité sont
pondérées par le volume réellement livré et plafonnées à 25 % de la clientèle
initiale. Aucune perte de clients n’est causée par une absence.

La réputation du lot est répartie selon les quantités : barème complet en direct,
moitié en boutique, zéro au grossiste. Les arrondis sont cumulés pour empêcher
qu’une série de petites ventes rapporte plus de points. Un lot compte une seule
fois pour la maîtrise, après la vente d’au moins la moitié du produit préparé
hors grossiste et avec une qualité apportant de la réputation ; ses primes de
filière restent uniques. Vendre les fleurs restantes ne donne pas de maîtrise
dans la transformation.

La transformation coûte 0,18 € par gramme traité, ou 0,32 € pour Premium, Static
et Signature, débités lors de la préparation. L’électricité est ensuite remboursée
à hauteur de 50 % au plus de chaque recette. Le reçu indique le montant net versé.
Le serveur refuse un devis périmé, un stock modifié, une campagne remplacée ou
un changement de réputation ou de dette électrique entre devis et confirmation.
Conserver le lot ne le détériore pas et ne demande aucun clic régulier.

## 8. Classement

Le duel utilise une cote de type Elo avec un coefficient de 32 et une variation
minimale de deux points. Une victoire attendue contre une cote nettement plus
faible rapporte moins qu'une victoire équilibrée ; battre une cote supérieure
rapporte davantage. Les points de saison suivent la même difficulté : une
victoire rapporte de 10 à 30 points avant le bonus de série, plafonné à 6, et
une défaite rapporte de 3 à 6 points de participation. Les défis quotidiens
validés peuvent ajouter les points annoncés par leur fiche.

Les ligues Graine, Pousse, Canopée et Fleur sont divisées en III, II et I par
paliers de 50 points de cote. Grand Cru commence à 1 400. L'EXP d'Arène dépend
du score du duel humain : 1,6 pour une victoire 3–0, 1,4 pour une victoire 2–1,
0,8 pour une défaite 1–2 et 0,6 pour une défaite 0–3. Un entraînement bot reste
à 0,1 EXP et ne modifie ni la cote ni la série. Seuls les défis quotidiens qu'il
valide peuvent ajouter les points de saison annoncés par leur fiche.

La réputation est permanente et n'est jamais dépensée. Elle contribue directement
au Score Placard avec la cote et les points de saison. Le classement public est
recalculé à chaque lecture depuis les données serveur et après chaque vente ou duel.

Le Score Placard est calculé ainsi : `cote + bonus saison + bonus réputation`.
Le bonus saison vaut 25 % des points de saison, dans la limite de 150 points.
Le bonus réputation vaut `4 × racine carrée de la réputation`, arrondi et limité
à 100 points. Cette progression dégressive récompense durablement la qualité sans
permettre à l'ancienneté ou à la répétition des ventes d'écraser la cote de duel.

Les titres de réputation donnent accès aux avantages économiques du marché.
Leurs seuils sont espacés pour que les transformations avancées et leurs primes
ne permettent pas de franchir les derniers paliers en quelques ventes :

| Réputation minimale | Titre |
| ---: | --- |
| 0 | Cultivateur novice |
| 60 | Main sûre |
| 200 | Artisan du lot |
| 600 | Signature locale |
| 1500 | Maître du Placard |
| 3000 | Référence du jury |

Les points déjà gagnés sont conservés ; les titres et avantages sont calculés
avec ces nouveaux seuils. Les garanties deviennent des objectifs de long terme,
sans délai quotidien imposé.

Le HUD indique la progression jusqu'au titre suivant. Le reçu de vente signale
immédiatement tout changement de palier.

Les égalités de Score Placard sont départagées dans cet ordre : réputation, cote,
nombre de victoires, nombre de défaites le plus faible, points de saison, puis
identifiant technique stable. Cette dernière clé ne donne
aucun avantage de jeu ; elle garantit seulement un rang unique et reproductible
pour les récompenses et l'archive finale.

## 9. Fin de saison et lots

Trois duels terminés sont nécessaires pour devenir éligible aux récompenses de
fin de saison. Les paliers techniques prévus sont Champion, Podium, Finaliste
et Participant.

Les lots physiques, titres, boosters et fragments ne seront dus que s'ils sont
décrits dans le règlement public de la saison avec ses dates, son territoire,
ses conditions d'éligibilité et ses modalités de remise. Tant que ce règlement
n'est pas publié, les règles de récompense restent désactivées et l'interface
ne doit présenter aucun gain comme acquis.

## 10. Traçabilité

Les burns, verdicts, classements, récompenses et clôtures de saison utilisent
des reçus idempotents. En cas de coupure réseau, le serveur renvoie l'état déjà
enregistré. Une incohérence empêchant de traiter ensemble les deux Fleurs
annule toute la transaction.

## 11. Points à valider avant publication

- dates et durée de la première saison ;
- nature, quantité et valeur des lots ;
- zones géographiques et conditions de participation ;
- calendrier et procédure de remise des lots ;
- approbation formelle des probabilités décrites au chapitre 3 ter ;
- texte juridique, protection des données et voies de réclamation.
