# Règlement du Placard — brouillon de lancement

Version de travail `2026-07-25-draft-1`. Ce document n'est pas publié aux
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

## 4. Duel classé Fleur contre Fleur

- Le joueur choisit une Fleur disponible et un adversaire proposé.
- Les deux Fleurs doivent appartenir à des joueurs différents et présenter un
  écart de qualité maximal de huit points.
- Un même duo de joueurs respecte un délai de 24 heures entre deux duels
  classés terminés.
- Au lancement du duel, les deux Fleurs sont verrouillées.
- Le jury résout trois manches. Deux manches gagnées donnent la victoire.
- Au verdict, les deux Fleurs sont définitivement brûlées, que leur
  propriétaire gagne ou perde.
- Le Buddie, les Héritages et les cartes La Botte non jouées ne sont pas
  affectés par ce burn.
- Un duel resté sans verdict pendant 48 heures expire : il ne donne aucun
  point, ne brûle aucune Fleur et rend les deux Fleurs disponibles.

Le verdict, le burn des deux Fleurs, le classement et les défis sont validés
dans une même transaction. Une seconde requête renvoie le reçu existant sans
appliquer un nouveau gain.

## 5. Classement

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
à 0,1 EXP et ne modifie ni la cote ni les points de saison.

Le classement public est matérialisé au maximum une fois par jour. Un délai
d'affichage ne modifie pas le verdict ni les soldes enregistrés.

Les égalités sont départagées dans cet ordre : cote, points de saison, nombre
de victoires, nombre de défaites le plus faible, puis identifiant technique
stable. Cette dernière clé ne donne
aucun avantage de jeu ; elle garantit seulement un rang unique et reproductible
pour l'instantané quotidien, les récompenses et l'archive finale.

## 6. Fin de saison et lots

Trois duels terminés sont nécessaires pour devenir éligible aux récompenses de
fin de saison. Les paliers techniques prévus sont Champion, Podium, Finaliste
et Participant.

Les lots physiques, titres, boosters et fragments ne seront dus que s'ils sont
décrits dans le règlement public de la saison avec ses dates, son territoire,
ses conditions d'éligibilité et ses modalités de remise. Tant que ce règlement
n'est pas publié, les règles de récompense restent désactivées et l'interface
ne doit présenter aucun gain comme acquis.

## 7. Traçabilité et incidents

Les burns, verdicts, classements, récompenses et clôtures de saison utilisent
des reçus idempotents. En cas de coupure réseau, le serveur renvoie l'état déjà
enregistré. Une incohérence empêchant de traiter ensemble les deux Fleurs
annule toute la transaction.

## 8. Points à valider avant publication

- dates et durée de la première saison ;
- nature, quantité et valeur des lots ;
- zones géographiques et conditions de participation ;
- calendrier et procédure de remise des lots ;
- probabilités définitives des boosters La Botte et des Héritages ;
- texte juridique, protection des données et voies de réclamation.
