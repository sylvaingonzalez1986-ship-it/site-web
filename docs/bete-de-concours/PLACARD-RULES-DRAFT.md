# Règlement du Placard — brouillon de lancement

Version de travail `2026-10-18-draft-10`. Ce document n'est pas publié aux
clients et ne vaut pas règlement commercial tant que les lots, les dates de
saison et les probabilités des collections ne sont pas validés.

La campagne commune décrite ici est implémentée localement. Au 13 octobre
2026, sa migration `20261013000200_kq_shared_campaigns.sql` est appliquée et
vérifiée en ligne ; le code du site reste à déployer. Voir l’[état de
l’entrepôt et les validations](PLACARD-ENTREPOT-V2.md#campagne-commune-récoltes-par-buddie--13-octobre-2026).

## 1. Principe

Le Placard est le jeu de cartes de culture de Kanab Quest. Le joueur place
un Buddie possédé dans chaque zone de culture de son choix, puis enregistre
le plan. Toutes les zones actives ainsi affectées démarrent une campagne
commune, avec le Sol vivant et un seul deck La Botte. Les dés, les actions,
l’XP et les soins sont partagés ; chaque zone menée à la récolte produit son
propre lot et sa carte Fleur numérique, utilisable individuellement en duel.

Les anciennes parties globales ou indépendantes par zone restent reprenables
selon leurs sauvegardes. Elles doivent être terminées avant une nouvelle
campagne commune ; leurs récoltes, cartes et factures ne sont pas recalculées.

La carte Buddie d'origine n'est jamais détruite par le Placard. Une carte
Héritage équipée est permanente et ne brûle jamais.

Après avoir utilisé un Buddie pour démarrer une culture, il faut utiliser
**cinq autres Buddies différents** avant de pouvoir le réutiliser. Cette
rotation concerne toutes les raretés, y compris les Épiques et les Légendaires.
Les copies d'une même carte comptent comme un seul Buddie. Une culture
démarrée compte même si elle échoue ; une tentative de démarrage refusée ne
compte pas. La rotation est conservée entre les connexions et les saisons,
et tient compte des cultures déjà démarrées avant son activation.
Pour une seule zone, il faut donc posséder au moins six Buddies différents
pour jouer en continu. Pour une campagne, tous les Buddies placés doivent
être disponibles au lancement ; un même Buddie ne peut occuper deux zones.

## 2. Cartes La Botte et burns

- Le Sol vivant est la base commune gratuite ; les anciennes cartes Substrat sont archivées.
- Chaque autre carte La Botte brûle uniquement lorsqu'elle est effectivement
  jouée.
- Les PBI se trouvent dans la boutique de soins, en dehors de La Botte et du
  deck. Les observations du panneau Santé sont gratuites et accessibles sans carte.
- Les cartes restées dans le deck ou dans la main sans être jouées ne brûlent
  pas.
- Chaque burn produit un reçu serveur et retire exactement une copie physique
  de l'inventaire numérique.
- Dans une campagne commune, le deck, les cartes jouées, les jetons et les
  soins ne sont pas consommés à nouveau pour chaque zone. L’Héritage reste
  un choix commun et permanent.
- Une seule préparation avant les dés et une seule réaction après les dés
  sont autorisées à chaque étape. Une seule carte épique peut être jouée par campagne,
  même si plusieurs références ou copies sont possédées. Une carte refusée ne brûle pas.

La Botte comprend **30 cartes actives** : 12 communes, 7 peu communes,
7 rares et 4 épiques. Les six anciennes PBI ainsi que la Loupe d’inspection
et la Plaque engluée de suivi sont archivées. Elles ne sont plus distribuées,
affichées dans la collection active ni jouables dans les nouvelles cultures ;
les anciens exemplaires et reçus ne sont pas supprimés.

Chaque carte spécialisée possède une liste explicite de situations compatibles.
Partager une famille « Eau », « Climat » ou « Récolte » ne suffit pas : une réserve
d’eau ne répond pas à un excès d’eau, la Loupe à trichomes ne répond pas à un vol,
et Charge répartie ne répare pas un minuteur décalé. Deuxième chance, Main verte
et Diagnostic croisé restent polyvalentes. Les instruments rémunèrent la décision
ou la correction qui suit une mesure ; ils ne rendent pas l’observation payante.

Les six nouvelles cartes complètent les situations de reprise, d’humidité et de secours :

| Code | Carte | Rareté | XP | Moment | Effet de jeu |
| --- | --- | --- | ---: | --- | --- |
| BOTTE-037 | Reprise délicate | Commune | 1 | Après les dés | Un 2 ou un 3 devient 4, face à une difficulté de reprise compatible. |
| BOTTE-038 | Humidité rééquilibrée | Commune | 1 | Avant les dés | −1 Pression et protection contre un Danger, sans créer de réussite. |
| BOTTE-039 | Reprise experte | Épique | 4 | Après les dés | Les deux dés faibles les plus bas deviennent 4 ; le Danger restant est protégé. |
| BOTTE-040 | Réglage d’urgence | Épique | 3 | Après les dés | Les deux dés faibles les plus bas deviennent 4 et la Pression retombe à zéro. |
| BOTTE-041 | Équipe de récolte | Épique | 3 | Après les dés | Le dé faible le plus bas devient 6, puis un autre devient 4 ; +1 Qualité si l’étape réussit. |
| BOTTE-042 | Séchage sous contrôle | Épique | 4 | Après les dés | Tous les dés faibles deviennent 4 ; les 4, 5 et 6 déjà obtenus sont conservés. |

Un dé faible vaut 1, 2 ou 3. Les épiques exigent un dé faible à améliorer ;
Réglage d’urgence reste utile sans dé faible si la Pression est supérieure à zéro.
Leur portée reste limitée aux situations prévues. Elles ne guérissent pas directement
les carences ou les parasites, ne restaurent pas les pertes passées et ne raccourcissent
pas l’affinage. Tri et isolement contient notamment le risque de pollen avec un
Danger transformé en 3, sans annuler les dégâts déjà subis.

## 3. Culture et Fleur

La campagne se déroule en étapes résolues par trois dés, les cartes et les
effets permanents autorisés. Le serveur conserve une seed, un état commun
et les reçus des décisions. Chaque zone conserve son Buddie et ses équipements
figés au lancement, puis reçoit sa récolte, sa Fleur, son stock et ses factures.
Chaque Fleur reste distincte de la carte Buddie qui lui a donné son identité.

Les 52 Buddies disposent d’un profil fictif v1 : rendement, potentiels
cannabinoïdes, potentiel de terpènes et notes aromatiques. Les spécialisations
Quantité, Équilibre et Expression ainsi que la rareté produisent des résultats
différents à partir du même parcours. Ces profils sont figés dans les
sauvegardes ; ce ne sont pas des mesures ou promesses concernant une variété réelle.

Les nouvelles cultures suivent une vitalité persistante de 0 à 100. À zéro,
la culture s’arrête sans récolte ni carte Fleur ; un secours unique existe pour
la première culture. Les bilans interviennent à la validation des opérations,
sans dommage causé par une simple consultation ou une absence. Les réussites
et les opérations pertinentes comptent dans l’expression aromatique et le
potentiel cannabinoïde développé puis conservé. Ce dernier est un indice de
jeu entre 35 et 99, distinct des teneurs simulées de CBD, CBG et THC en %.
Les intrants et les PBI sont des
interventions distinctes, achetées puis engagées depuis le suivi Santé.
L’entretien de base coûte 5 € de jeu, une seule fois pour la campagne par étape jusqu’à la
récolte. Un solde insuffisant bloque son activation. L’observation reste gratuite.
Les cartes déjà jouées restent consommées ; le Buddie, l’Héritage et les cartes
non jouées sont conservés.

**Archive des anciennes règles :** les cultures historiques de version 2
utilisaient deux étapes à 0 réussite comme condition de mort, avec le secours
de première culture lorsqu’il était accordé. Leurs résultats enregistrés restent
inchangés ; cette condition ne remplace pas la vitalité des nouvelles cultures.

Les bonus d’XP initiaux sont Commun +0, Argent +1, Or +2, Épique +3 et
Légendaire +4. La campagne retient le meilleur bonus parmi ses Buddies une
seule fois pour l’XP commun, avant les autres bonus autorisés ; elle ne les
additionne pas. Les anciennes parties individuelles conservent leur bonus
enregistré. Les Buddies n’ont pas de talent lié à une étape.
Les 30 cartes La Botte actives ont chacune un effet distinct ; leur coût et
leur fenêtre d’utilisation imposent un choix.

Les statistiques de la Fleur et les notes du jury sont conservées au
dixième afin de limiter les égalités sans inventer un bonus aléatoire caché.

### Paliers de récolte — barème du 18 octobre 2026

Les nouvelles cultures utilisent les seuils suivants, en points de Qualité de
culture, distincts de la note du jury et de la qualité commerciale sur 10 :

| Palier | Qualité de culture |
| --- | --- |
| Récolte artisanale | Moins de 8 |
| Belle pousse | 8 à 13 |
| Qualité concours | 14 à 19 |
| Fleur exceptionnelle | 20 à 25, ou davantage sans les conditions légendaires |
| Fleur légendaire | Au moins 26, avec au moins 4 étapes réussies dont 2 critiques |

Les critiques comptent aussi parmi les étapes réussies. Les bonus de matériel,
cartes et Héritages participent toujours à la Qualité, mais ne remplacent pas
ces résultats d’étapes. La projection affiche séparément les points et les
conditions de réussite manquantes. Une culture morte ne produit aucune Fleur.

Le barème est figé au lancement : les cultures déjà lancées et les anciennes
fleurs conservent les seuils 6 / 10 / 14 et leurs qualifications pour les
missions, y compris les récompenses pas encore récupérées. Les quantités, les
statistiques du jury et les formules de vente ne changent pas.

La migration `20261018000900_kq_harvest_tiers_v2.sql` doit précéder le déploiement
du code correspondant. Elle conserve le barème sur chaque Fleur et dérive les
compteurs de réussite du journal officiel. Vérification SQL locale :
`npm run test:harvest-tiers:sql` et `npm run test:harvest-tiers:campaigns`.
Les combinaisons déjà légales à +7 points sur une étape et jusqu’à 41 points
avec l’entrepôt sont désormais acceptées par la sauvegarde et la base ; la
borne de stockage reste compatible avec les anciens équipements (53 points).

Migration appliquée le 18 octobre 2026 au projet Supabase lié
`eyowwwpdmfrulhkpvlnf`, depuis un lot isolé limité à cette migration. Les
12 contrôles préalables et 24 contrôles finaux passent, dont 18 cas de barème.
Les 293 fleurs et 311 cultures historiques sont conservées ; aucune culture
n’était active au moment de l’application. L’historique distant confirme la
migration et le lot est à jour. Le code du site reste à déployer. Reçu :
`output/harvest-tiers-migration/application-result.json`.

## 3 bis. Boosters Kanab Quest

- Les boosters Buddies restent inchangés dans l'album principal.
- L'Arène vend séparément un booster La Botte contenant dix cartes.
- Un booster La Botte coûte 5 points.
- Les deux boutiques utilisent le même portefeuille de points fidélité.
- Les Buddies restent permanentes. Les règles de burn ne concernent que les
  cartes La Botte effectivement engagées ou utilisées dans le Placard.
- Les Héritages ne figurent dans aucun de ces boosters. Ils restent liés au
  parcours des fleurs concours.
- Les droits d’ouverture et la taille des packs déjà attribués sont conservés.
  Leur contenu est tiré à l’ouverture dans le catalogue actif à cette date.

## 3 ter. Probabilités techniques proposées

Un booster La Botte standard contient dix cartes. Son premier emplacement est
toujours Commun. Chacun des neuf autres emplacements est tiré indépendamment :
Commun `70 %`, Peu commune `23 %`, Rare `6 %`, Épique `1 %`. À rareté fixée, chaque référence
active possède le même poids. Les doublons restent possibles, y compris dans un
même booster. Un booster de victoire en duel contient trois cartes et applique
la même garantie sur son premier emplacement puis la même table aux deux autres.
La carte gagnée seule contre un bot suit cette table de raretés sans emplacement
Commun garanti. Les probabilités s’appliquent à chaque emplacement aléatoire,
pas à la probabilité d’obtenir au moins une épique dans tout le pack.

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

Le matériel reste dans l'inventaire, mais le matériel de culture acheté s'use
et doit être remplacé lorsqu'il arrive à 0 % d'état. Une seule pièce peut être
installée dans chaque emplacement ; installer un autre modèle laisse l'ancien
dans l'inventaire avec son état actuel. Les achats, le débit du portefeuille et
leurs reçus sont validés atomiquement par le serveur. Une même référence ne peut
pas être achetée en double : le remplacement remet à neuf la pièce déjà possédée.

Catalogue de lancement :

Les prix en euros sont des valeurs de jeu. Les références matérielles documentent
l’inspiration visuelle et technique ; leurs prix historiques étrangers ne sont
pas des taux de conversion. Les premières machines de transformation ont des prix
adaptés à la progression : tamis 550 €, presse 850 €, laveuse 1 250 €.

| Équipement | Prix virtuel en euros |
| --- | ---: |
| Tente renforcée 120 × 120 | 199 € |
| Pièce séchoir | 600 € |
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
| Caméra de surveillance | 69,99 € |
| Chien de garde | 1 000 € |

Le séchoir, le solaire et la sécurité s’installent une fois par entrepôt de quatre
tentes. L’éclairage, l’extraction, le climat et la tente restent individuels ;
les machines de transformation servent les deux entrepôts. Chaque bâtiment possède
ses modèles, ses niveaux et son état. Les services sont facturés et usés une seule
fois par culture ; le solaire réduit la consommation de son bâtiment.

Un seul choix de sécurité est actif à la fois dans chaque bâtiment. Tous empêchent les pertes de poids
lors d’un vol. Le chien apporte aussi +8 % de régularité au niveau 1.
Les améliorations ajoutent ensuite un point de régularité par niveau.
La caméra consomme 12 W dans le jeu. Les deux choix disponibles sont la caméra
et le chien de garde.

Posséder le chien entraîne, par bâtiment équipé, 8 € de nourriture à chaque culture terminée et 40 €
de vétérinaire aux 10e, 20e, 30e cycles depuis l’adoption. Cela reste dû quand
une autre protection est installée. Une culture abandonnée et le temps hors ligne
ne déclenchent aucun frais. Les soins sont déduits du portefeuille à la récolte ;
si le solde ne suffit pas, la différence rejoint les charges à régler. Aucun
double prélèvement lors d’une nouvelle tentative. Le détail et la prochaine visite
sont visibles dans l’onglet Charges. Les montants sont des règles économiques de jeu.

Chaque session de culture terminée donne lieu à une seule facture d’analyse de
`45 €` pour son lot commun, quel que soit le nombre de tentes. Elle est payable
sous 30 jours de jeu (5 jours réels). Transformer ou fractionner le lot ne crée
pas d’analyse supplémentaire.

La tente, l'éclairage et le climat modifient la quantité, la qualité maximale,
la régularité, la pression ou la consommation. Les machines de transformation
déterminent les voies disponibles, la part du lot traitable et la précision.
Certaines installations imposent une compatibilité : le contrôleur climatique demande une
extraction renforcée ; l'AutoSieve et le HiLyph demandent une laveuse ; le
Plasmastatic demande le pollinator à sec.

### Niveaux du matériel

La boutique propose une seule référence par fonction, soit quatorze matériels achetables.
Chaque achat commence au **niveau 1** et peut être amélioré jusqu’au **niveau 10**.
Le coût du niveau suivant vaut 10 % du prix de base multiplié par le niveau actuel,
arrondi au cent supérieur. Exemple : la caméra coûte 69,99 € ; passer du niveau 1
au niveau 2 coûte 7 €. Les améliorations utilisent l’argent virtuel et exigent
désormais un niveau métier suffisant ; elles ne consomment pas l’expérience.

Chaque niveau augmente un avantage : quantité, régularité ou transformation.
Les bonus de quantité et régularité déjà présents augmentent de 10 % de leur valeur
initiale par niveau (incrément arrondi à l’entier supérieur). La qualité maximale
gagne un point aux niveaux 4, 7 et 10. La caméra et le secours solaire conservent
leur protection complète et gagnent un point de régularité par niveau supplémentaire.
Les bonus restent soumis aux plafonds habituels des statistiques et de récolte.

Les machines de transformation possèdent une capacité fixe en grammes de fleurs
sources par lot. Ajouter une tente ne multiplie pas cette capacité. Les indices
1–3, 4–6 et 7–10 représentent trois configurations, avec des réglages intermédiaires.
Au niveau 1 : pollinator 120 g, presse 80 g, laveuse 180 g, collecte automatisée
500 g, lyophilisateur 500 g et séparation statique 120 g. Ces valeurs servent
à l’équilibrage du jeu, sans prétendre décrire les appareils réels.

Les configurations multiplient la capacité initiale par 1, 2 ou 4 ; chaque réglage
intermédiaire ajoute 15 % de la capacité de sa configuration. La précision progresse
aussi. Le bonus automatique de valeur de 2 % par niveau est supprimé pour les modèles
actuels. La machine la plus limitée détermine la capacité d’une chaîne ; sa précision
est la moyenne de celles des machines utilisées. Le reliquat reste vendu brut ou en
biomasse : cette version ne crée pas de file de plusieurs passages en atelier.
Les recettes Rosin Sélection, Premium et Signature demandent respectivement une
presse de niveau 4, 7 et 10. Les critères existants de qualité, réputation et ventes
par famille continuent de s’appliquer.

Les repères visuels changent aux niveaux **4** et **7**.
Le matériel doit être installé pour appliquer ses bonus. Le niveau est enregistré
au lancement d’une partie ; les transformations utilisent les niveaux installés
au moment de la vente. Une requête rejouée ne peut pas débiter une seconde fois.
Les anciens modèles sont regroupés dans la référence unique en conservant le meilleur
palier déjà acheté, sans modifier le solde du joueur.

### Expérience métier permanente

L’XP métier du chanvrier est distincte de l’XP dépensable pendant une culture,
de l’EXP de l’arène et de la réputation commerciale. Une culture officielle
terminée rapporte 100 XP, quel que soit le nombre de tentes, le capital ou la note.
Une mort naturelle rapporte 10 XP par étape enregistrée, avec un maximum de 60 XP ;
un abandon volontaire ne rapporte rien. Chaque culture ne compte qu’une fois.
Les tutoriels ne donnent pas d’XP au compte.

| Niveau métier | XP cumulée | Nouveaux investissements possibles |
| --- | ---: | --- |
| 1 | 0 | Kit de départ, caméra |
| 2 | 200 | Tente renforcée, LED, extraction, climat, séchoir |
| 3 | 400 | Pollinator, solaire, chien ; deuxième tente |
| 4 | 700 | Presse |
| 5 | 1 200 | Laveuse ; troisième tente ; améliorations matérielles 4–6 |
| 6 | 1 800 | AutoSieve, après trois lots lavés |
| 7 | 2 400 | Quatrième tente |
| 8 | 3 000 | Lyophilisateur, après six lots lavés ; améliorations matérielles 7–10 |
| 9 | 3 700 | Consolidation de l’atelier |
| 10 | 4 500 | Séparation statique, après dix lots tamisés ; deuxième entrepôt |

Les améliorations exigent aussi le niveau métier nécessaire à l’achat du modèle.
La pratique compte un lot de récolte une seule fois par famille, indépendamment du
nombre de ventes ou de requêtes. Les historiques disponibles sont repris au déploiement,
sans usure rétroactive. Le matériel déjà acquis reste installable, utilisable et
réparable ; seules les prochaines acquisitions et améliorations sont soumises aux
nouveaux paliers. Les contrôles sont appliqués dans les transactions PostgreSQL.

### Usure et remplacement du matériel de culture

Chaque culture terminée use le matériel de son installation enregistrée au départ,
selon le mode choisi. L'état va de **100 %** à **0 %**. L'usure est permanente :
le mode Éco, le temps hors ligne et le rangement ne restaurent pas une pièce.
Une culture abandonnée ne compte pas et une requête rejouée n'ajoute pas d'usure.
Les anciennes cultures ne sont pas comptabilisées rétroactivement.

| Matériel | Éco | Équilibré | Intensif |
| --- | ---: | ---: | ---: |
| LED spéciale 300 W | 2 points | 5 points | 10 points |
| Extracteur EC 6 pouces | 1 point | 3 points | 6 points |
| Contrôleur climatique AI+ | 1 point | 2 points | 4 points |
| Tente renforcée 120 × 120 | 1 point | 2 points | 3 points |
| Pièce séchoir | 1 point | 2 points | 4 points |
| Panneau solaire et batterie | 1 point | 2 points | 4 points |
| Caméra de surveillance | 1 point | 1 point | 1 point |

En Intensif, si l'état avant la culture est **strictement inférieur à 30 %**,
l'usure prévue est multipliée par **1,5**, arrondie au point supérieur et limitée
à l'état restant. À exactement 30 %, le rythme normal s'applique encore.
Une LED neuve dure ainsi **50 cultures en Éco**, **20 en Équilibré** ou
**10 en Intensif**, en tenant compte de cette accélération.

À 0 %, une pièce ne donne plus ses bonus, protections ni économies d'énergie
aux prochaines cultures. Les bonus et la facture d'une culture déjà commencée
restent ceux annoncés au lancement. La tente, la LED et l'extraction de départ
ne s'usent pas et prennent automatiquement le relais de leur emplacement si
nécessaire : le joueur peut continuer à cultiver et vendre ses fleurs brutes.
Le chien ne relève pas de cette usure ; ses frais de soins restent applicables.

Le remplacement à neuf s'effectue dans l'inventaire avec l'argent virtuel,
après la fin de la culture active. Il conserve le niveau et les améliorations.
Son prix vaut **le prix de base × [1 + 0,1 × (niveau − 1)]**, arrondi au cent
supérieur : une LED coûte **359 € au niveau 1** et **682,10 € au niveau 10**.
L'état, l'usure du prochain cycle et le prix sont annoncés avant confirmation.
Le coût estimé d'usure représente la part du remplacement consommée pendant
le cycle ; il n'est pas débité en plus du remplacement.

Les machines de transformation demandent un entretien après 10 lots transformés,
ou 20 à partir du niveau 5 et pour le lyophilisateur. Seules les machines utilisées
par la filière vieillissent, une fois par lot unique ; terminer une culture sans
transformation ne les use plus. Le pollinator motorisé est inclus. L’entretien
préventif est possible dès le premier usage, au tarif annoncé, sans dépendre du mode
d’énergie. Le Bricoleur bénéficie de réparations
gratuites pour ces machines ; **les remplacements du matériel de culture restent
payants**.

## 5. Incidents de culture

- **Surcharge au compteur** : un résultat Fragile ou un Échec retire 10 points
  de rendement aux tentes de chaque bâtiment sans secours solaire. Le Panneau
  solaire et batterie protège uniquement son bâtiment. Les dés de la culture
  commune restent inchangés. Les anciennes cultures conservent la coupure à
  l'étape suivante : le meilleur dé devient un Danger. Charge répartie
  réduit le seuil d'une réussite ; le Branchement illégal transforme
  les deux dés les plus faibles après le lancer, mais ajoute 2 Pression.
- **Contrôle DDTM** : la situation suit les résultats habituels du lancer.
  Papiers en règle fixe les trois dés sur une réussite et garantit donc trois
  réussites pour ce contrôle.
- **Renard à deux pattes** : sans protection, un résultat Fragile retire 15 points
  de rendement et un Échec en retire 35. La sécurité installée protège les tentes
  de son bâtiment ; seules les tentes non protégées subissent ces pertes.
  Gros molosse et l’Héritage de protection du vol couvrent toute la culture.
  Les anciennes cultures conservent leur protection et leur perte globales.

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
ramenée sur 10 et conservée au dixième. Les ventes peuvent être fractionnées,
mais une même quantité ne peut pas être vendue deux fois. La vente, le gain
d'argent virtuel et la réputation produisent un reçu serveur idempotent.

Le séchage est joué **avant le jury et le duel**. L’affinage, ou curing, commence
**après leur verdict** et dure 6 heures réelles, indépendamment du calendrier
du jeu. Une vente avant cette maturité reste possible uniquement
au grossiste. Une carte de séchage ne supprime pas ce délai.

L’entrepôt réserve des contenants achetés à l’unité, sans mélanger deux récoltes
dans le même contenant. Le joueur dispose d’**1 heure réelle après le duel**
pour acheter la capacité manquante ou vendre le surplus au grossiste. Après
l’échéance, seul le surplus est vendu automatiquement, y compris hors connexion ;
le traitement programmé passe toutes les cinq minutes. Acheter ou déplacer des
contenants ne repousse pas cette échéance. La note archivée du jury reste fixe,
tandis que la qualité commerciale du lot dépend ensuite de sa conservation.

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
| Vente en ligne | Prix TTC libre au centime par paquet de 5 g ou 10 g | Commandes automatiques progressives, selon visibilité, qualité, prix et confiance |
| CBD shops | Fleur brute : 500–1 500 €/kg selon la qualité actuelle ; transformations au barème spécifique existant | Paiement immédiat, volume limité par le réseau ; fleur dès 6,5/10, transformation dès 7,5/10 |
| Grossistes | Fleur brute : ancien barème plafonné à 60 % du nouveau prix shop de cette qualité | Reprise de tout le volume, sans gain de réputation ; autres transformations et biomasse au barème existant |

La fleur sous 5,8/10 peut désormais être préparée brute pour la reprise grossiste.
Les exigences de qualité et de matériel pour fabriquer les transformations
restent inchangées. La biomasse est reprise au tarif industriel dans ce circuit.
Le prix affiché par le joueur en ligne ne modifie jamais les tarifs professionnels.

Les shops proposent 500 €/kg à 6,5/10, 1 000 €/kg à 8/10 et 1 500 €/kg dès
9,5/10, avec interpolation entre ces notes. La conservation fait évoluer cette
qualité ; ni le réseau ni le talent Marchand ne dépassent ce plafond de prix.
Le réseau augmente le volume disponible. Les seuils de recrutement restent
distincts : fleur 6,5–6,9 fragile, 7–7,9 stable, 8–8,9 favorable, 9–10 excellente ;
hash/rosin 7,5 / 8 / 9 / 9,5. Maximum 20 partenaires, progression selon la masse
équivalente vendue. La prospection reste possible sans partenaire.
Le surplus sans contenant conserve sa reprise d’urgence séparée à 0,54 €/g.
Aucune reprise ne garantit une marge après culture et charges.

Le serveur enregistre les devis professionnels et contrôle identité, quantité,
révision, échéance et montant confirmé. Le nouveau circuit en ligne ferme la
vente instantanée, y compris la confirmation d’un ancien devis online.
Les reçus déjà exécutés restent rejouables sans nouveau débit ou nouvelle vente.

#### Boutique progressive et conditionnement

Le conditionnement suit le parcours « Transformer et vendre » : choisir un
lot, puis le circuit « Vente en ligne ». Les emballages, formats et prix ne
s’affichent qu’à cette étape, pour le lot choisi. Ils n’apparaissent ni à
l’accueil des lots, ni dans les offres aux shops ou aux grossistes.

Après confirmation d’une mise en vente, le joueur arrive dans l’onglet
« Tableau de bord » du Marché (`?view=market&section=dashboard`). Cet espace
reste accessible même sans stock en vrac. Il rassemble les paquets vendus,
restants, en vente, en pause, retirés ou bloqués par leur qualité, les recettes
et les dernières commandes. Les filtres d’annonces permettent de modifier un
prix, mettre en pause, retirer du rayon ou reprendre une annonce. Le retrait
conserve les paquets ; l’action distincte « Jeter les paquets » est définitive.
« Préparer une nouvelle annonce » revient au choix du lot et du circuit.

La migration `20261011150000_kq_online_commerce.sql` a été appliquée le
11 octobre 2026 au projet Supabase lié, à la demande de l’utilisateur. Son
enregistrement distant, les fonctions Data API et l’absence de migration restante
dans ce lot isolé ont été vérifiés. La migration indépendante de La Botte est
restée exclue. Reçu : `output/online-commerce-migration/application.json`.
Cette opération concerne la base ; l’interface et le cron Vercel ne sont pas déployés.

L’ordinateur coûte toujours 450 €. La boutique de base ouvre gratuitement,
sans abonnement, avec 2,5 % de frais de vente. Le joueur commence sans abonnés,
avec une confiance commerciale de 60/100 et une audience de référence de
24 visiteurs par jour réel : généralement moins d’une commande quotidienne
sans publicité. Une commande n’est jamais garantie, quel que soit le prestige.

Le joueur achète des emballages puis prépare un nombre entier de paquets.
La masse sort immédiatement du stock en vrac et ne peut plus être vendue aux
professionnels. Un emballage est consommé par paquet ; sa vente ne débite pas
une seconde fois l’emballage. Pause et retrait gardent les paquets préparés,
sans remboursement ni retour au vrac, et permettent la reprise ultérieure.
Une action distincte permet de jeter définitivement les paquets invendus après
confirmation : aucun remboursement, aucune vente ni réputation gagnée, et leur
valeur sort du stock. Les paquets devenus invendables ne restent pas immobilisés.

| Emballage | Coût 5 g | Coût 10 g | Effet dans le jeu |
| --- | ---: | ---: | --- |
| Doypack kraft, étiquette artisanale | 0,25 € | 0,30 € | Présentation simple, conservation de base |
| Doypack imprimé à la marque | 1,10 € | 1,25 € | Graphiste requis, satisfaction +4, vieillissement réduit de 20 % |
| Pot en verre ambré, couvercle et étiquette | 1,80 € | 2,10 € | Satisfaction +8, vieillissement réduit de 50 % |

Ces prix virtuels sont des hypothèses de petites séries, accessoires inclus,
pas des devis fournisseurs. Les repères vérifiés le 11 octobre 2026 incluent
[l’impression numérique Exaprint](https://www.exaprint.fr/le-packaging/souple/doypack/),
[les petites séries Packstyle dès 50 unités](https://www.packstyle.com/fr) et
[les pots bruns avec couvercle](https://allbags.net/fr-fr/products/recipient-en-verre-pour-cire-de-bougie).
Les bonus de satisfaction et de conservation sont des choix d’équilibrage.
Les trois illustrations représentent les emballages 5 g et 10 g dans un rendu réaliste.

Le prix de référence tient compte du produit, de la qualité actuelle, du coût
du conditionnement et d’une prime de réputation bornée pour les bons lots.
Le joueur choisit exactement son prix TTC. Monter le prix diminue progressivement
la conversion ; à 2,5 fois la valeur de référence, la demande est nulle.
Un lot moyen vendu honnêtement peut satisfaire ; un lot décevant trop cher
fait baisser confiance et fidélité après achat. Un joli emballage ne compense
pas une forte surévaluation. Aucun client ni point n’est perdu sans achat décevant.

Les annonces partagent la même audience. Le format 10 g utilise deux fois le
budget de demande du 5 g : diviser un lot ne multiplie pas les ventes.
Le moteur traite les commandes, le vieillissement, les fins de campagne et les
échéances dans l’ordre chronologique, même hors connexion. Les prix modifiés
ne changent pas les ventes passées ; changer le prix réinitialise l’intention
d’achat en cours. Le kraft perd 0,01 point de qualité par 4 heures réelles après
conditionnement, avec les réductions du tableau ; préparer un paquet ne rajeunit
jamais le lot. En dessous de 5,8/10 les ventes en ligne s’arrêtent.

#### Développer l’entreprise

La gestion de l’activité se trouve au **Marché**, à côté de « Transformer et
vendre » : site, marque, réseaux sociaux, publicité et domiciliation. La carte
donne directement accès à « Gérer mon activité ». Le Bureau conserve les
factures et la comptabilité, la Banque les financements et les placements.
Ce sont deux espaces séparés, accessibles depuis leur bâtiment sur la carte,
sans onglets communs. La Banque ne charge pas les dossiers comptables du Bureau.
Les anciens liens vers la gestion du Bureau redirigent vers celle du Marché.
Un achat de matériel lancé depuis la gestion revient dans cette même section.

L’interface utilise trois scènes corrigées avec l’outil intégré `image_gen` :
`public/placard/market-counter-v2.webp` (comptoir),
`public/placard/market-brand-studio-v2.webp` (atelier de marque) et
`public/placard/market-social-missions-v2.webp` (missions sociales).
Chaque édition reçoit directement `public/sylvain.png` comme référence
d’identité et `public/placard/commerce-office-v2.webp` comme exemple fidèle :
visage crème et rond, yeux échancrés, silhouette trapue, casquette beige et
turquoise, pull beige sans col ni bretelles et pantalon turquoise.
Les premières versions restent archivées. Les prompts et les originaux
corrigés sont conservés dans
`output/imagegen/market-ui-sylvain-v2/prompt-manifest.json`. Les photos réalistes des
trois emballages restent utilisées dans le choix du conditionnement.

| Investissement | Prix | Conditions et effet |
| --- | ---: | --- |
| Photos et fiches produit | 300 € | Conversion +10 %, aucun visiteur créé |
| Identité par un graphiste | 700 € | Conversion +8 %, doypack imprimé débloqué |
| Site amélioré | 900 € puis 30 €/mois de jeu | 5 commandes, confiance ≥45 ; conversion ×1,25 |
| Site professionnel | 3 000 € au total puis 60 €/mois de jeu | 30 commandes, confiance ≥60 ; conversion ×1,6 |

Le passage du site amélioré au professionnel coûte la différence, soit 2 100 €.
Le premier mois est inclus ; un mois de jeu dure 5 jours réels. Les anciens sites
payants sont repris comme sites améliorés avec leur période déjà payée conservée.
Les abonnements non réglés suspendent les ventes ; les paquets restent en stock.

Les missions sociales sont simulées dans le jeu et distinctes des missions
communautaires avec preuves réelles. Présenter sa marque dure 24 heures réelles,
présenter une récolte, montrer l’atelier et échanger avec les acheteurs durent
48 heures. Une seule mission est active ; la première est unique, une récolte
ne peut pas être présentée deux fois, et les autres missions ont un délai de
réutilisation. Choisir Accessible, Artisanal ou Sélection améliore légèrement
la conversion des visiteurs de cette campagne si le prix et la qualité correspondent.
La fin de mission gagne des abonnés simulés, jamais directement des clients fidèles.

Les achats satisfaisants construisent la confiance et la clientèle, avec au plus
cinq clients gagnés par journée réelle UTC et une perte plafonnée à 25 % des
clients du début de journée, arrondie à l’entier supérieur. La réputation
technique reste distincte : un bon lot contribue à sa progression, vendre un
lot moyen à prix honnête n’ajoute pas de sanction ; un achat décevant peut la réduire.

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
La conservation ne demande aucun clic régulier. Le temps et la protection des
contenants font évoluer la qualité commerciale selon les paramètres du jeu ;
ils ne modifient pas rétroactivement le jury ni le résultat du duel.

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
