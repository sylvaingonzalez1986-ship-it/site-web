# Règlement du Placard — brouillon de lancement

Version de travail `2026-09-01-draft-4`. Ce document n'est pas publié aux
clients et ne vaut pas règlement commercial tant que les lots, les dates de
saison et les probabilités des collections ne sont pas validés.

## 1. Principe

Le Placard est le jeu de cartes de culture de Kanab Quest. Une partie utilise
une variété Buddie possédée dans l'album, un Substrat et les cartes La Botte
choisies dans la collection du joueur. La culture terminée produit une carte
Fleur numérique unique qui peut participer à un duel classé.

La carte Buddie d'origine n'est jamais détruite par le Placard. Une carte
Héritage équipée est permanente et ne brûle jamais.

## 2. Cartes La Botte et burns

- Le Substrat sélectionné brûle au démarrage de la culture.
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

Les avantages Buddies dépendent uniquement de leur rareté : Commun, aucun
avantage ; Argent, +1 XP au départ ; Or, +2 XP ; Épique, +3 XP ; Légendaire,
+4 XP. Les statistiques de la Fleur et les notes du jury sont conservées au
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

Le choix permanent n'est plus une liste de sept pseudo-substrats. Le joueur
choisit exactement un **mode de culture** parmi quatre techniques réelles :

| Mode | Identité ludique | Contrepartie |
| --- | --- | --- |
| Terreau horticole | Tolérant : garantit une réussite à partir d'un neutre quand le lancer Racines ou Eau n'en contient aucune | Plafond faible et effet conditionnel |
| Hydroponie recirculante | Contrôle de la solution : relance sûre d'un neutre sur Eau ou Floraison | Les pompes dépendent du courant |
| Aéroponie haute pression | Haute précision : transforme un neutre en réussite forte sur Racines, Eau ou Climat | Une coupure transforme les deux meilleurs dés en Dangers |
| Sol vivant | Tampon biologique : amortit le premier Danger sur Racines ou Ravageur | N'accélère pas les autres étapes |

Cette distinction suit les définitions agronomiques : l'hydroponie nourrit les
racines avec une solution aqueuse, l'aéroponie maintient les racines dans l'air
et les brumise, tandis que le Sol vivant repose sur la matière organique et
l'activité biologique. La Perlite calibrée, le Biochar inoculé et l'Engrais bio
complet sont donc des cartes d'appui consommables, et non trois modes de culture
supplémentaires.

L'argent du Placard est une monnaie virtuelle propre au jeu. Il ne correspond
pas aux points fidélité, ne peut pas être acheté, retiré, remboursé ou converti
en argent réel. Chaque joueur commence avec `350 $US` virtuels ainsi qu'une tente
90 × 90, une LED 115 W et une extraction de départ.

Un équipement acheté est permanent. Il n'est ni brûlé ni racheté à chaque
culture. Une seule pièce peut être installée dans chaque emplacement ; remplacer
une pièce installée ne détruit pas l'ancienne. Les achats, le débit du
portefeuille et leurs reçus sont validés atomiquement par le serveur. Une même
référence ne peut pas être achetée deux fois.

Catalogue de lancement :

Les prix virtuels suivent le prix public affiché sur le marché américain pour
un équivalent réel vérifié le 1er septembre 2026. Le vendeur et le lien produit
restent visibles dans la fiche de la boutique. Livraison et taxes locales ne
sont pas incluses.

| Équipement | Prix virtuel aligné US |
| --- | ---: |
| Tente renforcée 120 × 120 | 199 $US |
| Grande tente 150 × 150 | 249 $US |
| LED spéciale 300 W | 359 $US |
| Cadre LED premium 500 W | 579 $US |
| Extracteur EC 6 pouces | 149 $US |
| Contrôleur climatique AI+ | 139 $US |
| Pollinator à sec Resinator OG | 4 195 $US |
| Ice washer Mini Osprey 2.0 | 5 995 $US |
| Collecteur AutoSieve | 4 995 $US |
| Ice washer Osprey 75 | 30 495 $US |
| Séparateur automatisé TSS-225 | 79 400 $US |
| Séparateur statique Plasmastatic | 22 800 $US |
| Presse à rosin Lowtemp V2 | 3 695 $US |
| Presse à rosin Pikes Peak V2 | 7 995 $US |
| Presse à rosin Longs Peak | 11 495 $US |
| Presse automatisée NugSmasher IQ Pro | 19 996 $US |
| Sécheur de hash HiLyph XL | 7 495 $US |
| Panneau solaire et batterie | 1 149 $US |
| Caméra cabossée | 69,99 $US |

La tente, l'éclairage et le climat modifient la quantité, la qualité maximale,
la régularité, la pression ou la consommation. Les machines de transformation
déterminent les voies disponibles, la part du lot traitable et la précision.
Certaines installations imposent une compatibilité : la LED 500 W demande une
extraction renforcée ; l'AutoSieve et le HiLyph demandent une laveuse ; le
Plasmastatic demande le pollinator à sec.

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
| Biomasse | 0,0 | 100 % | 0,30 $US/g |
| Lot brut | 5,8 | 100 % | 1,80 $US/g |
| Hash tamisé | 6,2 | 18 % | 16 $US/g |
| Static Sift | 8,3 | 10 % | 120 $US/g |
| Rosin d'essai | 6,5 | 15 % | 26 $US/g |
| Hash eau-glace | 6,8 | 16 % | 22 $US/g |
| Rosin Sélection | 7,2 | 18 % | 32 $US/g |
| Rosin Premium | 8,0 | 20 % | 42 $US/g |
| Rosin Signature | 8,8 | 22 % | 80 $US/g |
| Hash Signature | 8,8 | 18 % | 70 $US/g |

Le montant final dépend aussi de la note, de la capacité et de la précision du
matériel installé. La partie non traitée est valorisée en lot brut lorsque la
note du jury l'autorise ; elle retombe en biomasse dans le cas contraire. Hash
tamisé demande le Pollinator ; Static Sift demande en plus le Plasmastatic ;
Hash eau-glace demande une Laveuse ; les quatre Rosin demandent leur niveau de
presse ; Hash Signature demande à la fois Laveuse, AutoSieve et HiLyph.

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

Les titres de réputation donnent un objectif de progression lisible sans
modifier les gains ni accorder d'avantage supplémentaire :

| Réputation minimale | Titre |
| ---: | --- |
| 0 | Cultivateur novice |
| 20 | Main sûre |
| 60 | Artisan du lot |
| 150 | Signature locale |
| 300 | Maître du Placard |
| 600 | Référence du jury |

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
