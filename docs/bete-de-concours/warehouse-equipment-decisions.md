# Décisions sur les équipements de l’entrepôt

## Bêta du 21 novembre 2026

Pour installer une desserte, un diable ou un établi, le joueur choisit « Acheter », désigne une case libre sur le plan et confirme le coût. « Placer » installe gratuitement un équipement déjà acquis et « Déplacer » change sa case. Les trois achats sont indépendants. [Prix publics et modèles de référence](prix-publics-entrepot.md)

La boutique propose les outils d’entretien et la manutention à l’échelle de l’entrepôt. Le placement reste déterminant pour les lampes, l’extraction, les centrales, le sas et les caméras. Le séchage et le stockage continuent de compter les grammes admissibles par installation. La conservation climatisée entraîne sa charge mensuelle.

| Décision | Règle des nouvelles cultures |
| --- | --- |
| Équiper une zone en climat ou en pilotage | Le joueur choisit un appareil entier puis une zone. Le devis arrondit le besoin dans chaque zone, réemploie la réserve et facture les appareils manquants au prix public TTC. Le déshumidificateur mobile et le thermohygromètre se posent gratuitement. L’achat des quatre appareils raccordés entraîne 15 % de pose. Chaque modèle accorde son bonus une fois par zone. Les fournitures suivent la surface réelle. Les anciens modules peuvent être réaffectés dans la limite des m² déjà acquis. |
| Acheter des intrants | Le catalogue propose 18 produits au conditionnement et au prix public TTC. Chaque achat crédite le stock de l’entrepôt du nombre d’utilisations affiché sur la fiche. Les charges par emballage et les effets sur les cultures sont des paramètres de jeu. |
| Préparer la centrale | Une centrale à 806,62 € dessert jusqu’à 20 m² en vue directe à six pas. Les centrales partagent les surfaces. Un programme par paire centrale et zone immobilise ses doses pendant sept jours de jeu. Le premier semis éligible les consomme. L’échéance ou le retrait de la centrale libère le solde. L’injecteur à 96 € permet de distribuer le complément avec la base. Son retrait avec la centrale le remet en réserve. |
| Utiliser le stock en culture | Un semis enregistre les lots déjà présents sans les immobiliser. Dans Santé, le joueur sélectionne un produit compatible avec le problème observé et une case à traiter. Chaque utilisation est déduite une fois du stock partagé. Les achats faits après le départ alimentent les semis suivants, y compris pour une référence déjà possédée. Les mélanges des centrales et les réserves déjà affectées aux anciennes cultures restent protégés. |
| Installer le sas d’entretien | Le joueur choisit « Acheter », place un sas unique au seuil de la porte sud et confirme le devis de 15 000 €, pose comprise. Toutes les cultures semées avec le sas installé bénéficient d’une réduction de 75 % des risques d’infection, de ravageurs et de virus pendant leur cycle. Les cloisons et la distance à l’entrée n’affectent pas cette protection. |
| Nettoyer l’entrepôt | Le joueur achète les outils dans Aménager → Nettoyage. Depuis l’entrepôt, « Nettoyer » ouvre le choix de la personne et du passage, y compris sans sas installé. L’aspirateur à 79,90 € demande ½ h de jeu. La serpillière à 48,90 € demande 1 h et une aspiration valide jusqu’à la fin du lavage. Chaque passage terminé protège les prochains semis pendant sept jours de jeu. L’aspiration et le lavage réduisent de 5 % et 10 % le risque restant après l’effet du sas. |
| Protéger l’entrepôt | Une caméra à 109 € surveille un secteur de 90° à 6 m. Chaque m² compte une fois. L’alarme à 449 € apporte une protection autonome une fois installée. La télésurveillance coûte 9,99 € par mois de 30 jours de jeu. Les protections réduisent les pertes du vol simulé selon la zone. |
| Organiser le trim et le transport | Desserte et table réduisent ensemble jusqu’à 28 % le temps de trim manuel. La desserte aide aussi au trim machine. Le chariot réduit jusqu’à 25 % le chargement du lyophilisateur. Les durées tiennent compte de l’usure et de la personne affectée. |

Le mélange de base représente un engrais soluble compatible avec l’irrigation. Les amendements du sol vivant s’appliquent aux cases de culture. Les produits de PBI spécialisés utilisent les correspondances auxiliaire–ravageur décrites dans leurs fiches de santé. Les doses de jeu, les échéances et les coefficients sont des paramètres de simulation. [University of Minnesota Extension, solutions nutritives](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/small-scale-hydroponics) · [UC IPM, lutte biologique en cultures sous abri](https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/biological-control/)

## Rejouer la bêta en local

Pour manipuler le plan et acheter des intrants au conditionnement, lancer `node scripts/audit-warehouse-shop-first.mjs --fresh` et ouvrir l’adresse locale indiquée. Le rayon Nutrition utilise le même catalogue que la boutique. Le solde et le stock persistent au rechargement de l’onglet. « Recommencer la partie locale » remet l’atelier à 100 m² et 1 000 € avec une réserve vide.

Pour rejouer le parcours des intrants sur une base PostgreSQL jetable, lancer `node scripts/audit-warehouse-provisions.mjs`. La recette parcourt la boutique, le semis et les soins à 1 440 et 320 px. Le rapport et les captures sont écrits dans `output/warehouse-provisions/`.

## Historique des devis et des profils par surface

Les tableaux ci-dessous documentent le plan et les instantanés antérieurs à cette bêta. Pour les nouvelles cultures, les règles ci-dessus remplacent les anciens forfaits d’hygiène, de sécurité et de nutrition.

Prix de jeu en euros, hors préparation et pose. Le devis déduit le matériel disponible en réserve avant de chiffrer l’achat. Il ajoute 120 €/m² de préparation nouvelle et 15 % de pose sur le matériel concerné. Les cultures déjà lancées gardent les règles et les coûts de leur instantané.

Une nouvelle partie dispose de 1 000 € et de 100 m² libres. Le joueur ouvre Aménager, choisit une référence et la place sur une case, sur une surface tracée ou sur une zone compatible. Un support seul reste en pause et son agrandissement se chiffre au devis. La première lampe active la culture. Les extracteurs se placent séparément. La confirmation installe tous les changements du brouillon.

Sur un sol neuf, le premier m² de bacs modulaires revient à 123,45 € (120 € de préparation, 3 € de support et 0,45 € de pose). Un exemple complet utilise trois cases de 1 m², pour la culture, le séchage et le stockage. Avec les bacs, la lampe, l’extracteur, le séchoir et les contenants de première gamme, le devis atteint 900,04 €. Il reste 99,96 € de trésorerie après installation.

| Objet | Achat unique ou multiple | Bénéficiaires | Surface ou capacité | Placement nécessaire | Effets et niveaux | Règle de cumul | Correction retenue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chariot de manutention | Unique | Toutes les zones qui alimentent le lyophilisateur | Chaque charge | Aucun | Jusqu’à 25 % de temps de chargement gagné | Une fois par charge | Détacher l’outil mobile du coût au m² |
| Desserte mobile | Unique | Joueur et salariés en trim manuel ou machine | Entrepôt | Aucun | Jusqu’à 10 % de temps gagné à quantité identique | Multiplicatif avec la table en trim manuel | Accélérer la préparation des postes |
| Table de trim | Unique | Joueur et salariés en trim manuel | Entrepôt | Aucun | Jusqu’à 20 % de temps gagné à quantité identique | Jusqu’à 28 % de temps gagné avec la desserte | Accélérer le poste manuel |
| Extracteurs | Multiple | Cultures à portée | 8, 20 ou 50 m² par appareil | Au sol, au mur extérieur ou sur une face de cloison | Portée de 3, 5 ou 8 pas, qualité de 0, 1 ou 2 par case servie | Meilleure gamme disponible par case, capacité et puissance partagées | Relier l’effet aux coordonnées réelles |
| Éclairages | Multiple | Zone équipée | Jusqu’à 1, 2 ou 4 m² par lampe | Rangées parallèles au côté long de la culture | Puissance et qualité selon la gamme | Toute la surface est couverte, bonus de gamme une fois par zone | Répartir les lampes du devis sur toute la culture, y compris après agrandissement ou rotation |
| Irrigation économique et standard, climat de culture, pilotage, supports et nutrition | Multiple, par m² préparé pour le profil | Zone équipée | Surface de culture | Affectation à la zone | Rendement, qualité et coût par cycle selon le profil | Un choix par famille, plafonds communs | Distinguer la couverture financée des fournitures consommées |
| Hygiène économique et standard | Multiple, forfait par m² | Zone équipée | Surface entretenue | Affectation à la zone | +1 ou +2 de qualité | Plafond de 4 points pour l’ensemble des modules | Faire dépendre la qualité du niveau d’entretien |
| Centrale d’irrigation | Une unité par poste | Cultures desservies | 20 m², à 6 m sur la grille | Une case libre de 1 m² | +3 % de récolte sur la fraction couverte | Une centrale par m² servi, priorité à l’irrigation locale | Donner une emprise au poste commun et partager sa capacité |
| Sas d’entretien | Un poste au seuil sud | Cultures desservies | 24 m², à 8 m sur la grille | Case intérieure de la porte | +3 points de qualité sur la fraction couverte, avant plafond et arrondi | Priorité à l’hygiène locale | Imposer une entrée unique tout en répartissant le service |
| Filets, séchoirs, bocaux, étagères et fûts du plan | Multiple | Lots de l’entrepôt | Grammes par unité et unités par m² | Zone dédiée | Capacité et qualité commerciale selon la gamme | Capacités additionnées, qualité pondérée par capacité | Conserver les contraintes de lots et d’espace |
| Climatiseur de stockage | Un modèle en service | Stockage aménagé | Surface de stockage | Choix du modèle de stockage | Protection et facture mensuelle par m² | Un modèle actif | Afficher la charge mensuelle du modèle retenu |
| Machines d’atelier et postes informatiques | Selon la progression de l’atelier | Transformations compatibles | Grammes par lot ou par heure selon le poste | Atelier et recette compatibles | Capacité, précision ou déblocage | La recette combine les postes requis | Préserver les prérequis, séparer travail actif et attente |
| Matériel des anciennes tentes, séchoir de bâtiment, énergie et sécurité du bâtiment | Selon tente ou bâtiment | Tente ou bâtiment équipé | Emplacement de matériel | Équiper le modèle possédé | Puissance, régularité, capacité et protections selon le modèle | Selon l’emplacement équipé | Garder les effets enregistrés dans les anciennes parties |
| Contenants individuels | Multiple | Lot affecté | Grammes par contenant | Affectation au lot | Protection selon méthode, capacité selon format | Un contenant entamé reste réservé au lot | Distinguer le contenant du mobilier de stockage |
| Consommables et décor | Consommables à chaque cycle, décor intégré | Culture concernée ou représentation du plan | Unités par m² et par cycle pour les fournitures | Selon profil ou position de la cloison | Dépense par cycle, obstruction pour les cloisons | Dépenses additionnées, décor sans bonus | Conserver les dépenses dans la facture et les obstacles sur le plan |

## Entrepôt au mètre carré

L’éclairage se choisit en boutique. Pour une zone de 6 × 2 m avec des lampes standard de 2 m², le devis compte six lampes. Les rangées se partagent la surface et chaque lampe couvre la même aire. Si la surface ne remplit pas la capacité du dernier appareil, les lampes se répartissent cet espace. Le plan permet d’examiner toute l’installation ou l’emprise d’une seule lampe.

| Référence et gamme | Prix | Pose et prérequis | Effet et cumul | Décision |
| --- | ---: | --- | --- | --- |
| `MH-TS1000` · Économique | 149 € | Zone de culture, 1 appareil/m² | 150 W/appareil, aucun bonus de qualité | Dimensionner le premier éclairage après le choix du joueur. Une zone de supports peut rester sans lampe. |
| `SIM-LIGHT-02` · Standard | 329 € | Zone de culture, 1 appareil pour 2 m² | 240 W/appareil, +1 Qualité de départ par zone | Comparer les watts et le coût pour la surface réelle. |
| `SIM-LIGHT-03` · Haut de gamme | 749 € | Zone de culture, 1 appareil pour 4 m² | 400 W/appareil, +2 Qualité de départ par zone | Afficher le gain à pleine couverture et le prix du premier appareil. |
| `MH-FCE3000` · Historique | 199 € de référence | Zone de culture, 1 appareil pour 2 m², réemploi depuis la réserve | 300 W/appareil, aucun bonus de qualité | Conserver les installations et la référence historique. Retirer l’achat neuf. |
| `SIM-AIR-01` · Économique | 49 € | Une case au sol ou un point d’accroche sur un mur ou une paroi, portée de 3 m | Jusqu’à 8 m², 20 W en service, aucun bonus de qualité. La couverture améliore aussi la récolte. | Donner un intérêt mesurable au premier prix par la couverture. |
| `SJ-DF16E350` · Standard | 149 € | Même pose, portée de 5 m | Jusqu’à 20 m², 35 W en service, +1 point sur chaque m² couvert | Autoriser le partage entre plusieurs zones. |
| `SIM-AIR-03` · Haut de gamme | 449 € | Même pose, portée de 8 m | Jusqu’à 50 m², 55 W en service, +2 points sur chaque m² couvert | Borner la portée et la capacité pour donner du sens au placement. |
| `SJ-DRYIT90` · Séchage économique | 149 € | Zone de séchage, 1 filet/m² | 1 000 g/m², 6 h de jeu, passif, +0 point commercial | Afficher la capacité placée. L’ancienne capacité catalogue concernait les plans historiques. |
| `SIM-DRYING-02` · Séchage standard | 699 € | Zone de séchage, 1 unité/m² | 2 500 g/m², 6 h de jeu, passif, +0,35 point commercial | La gamme augmente le débit par capacité et la qualité. |
| `SIM-DRYING-03` · Séchage haut de gamme | 2 499 € | Zone de séchage, 1 unité/m² | 6 000 g/m², 6 h de jeu, passif, +0,70 point commercial | Garder la durée commune et afficher le gain de capacité. |
| `LP-SUPER-1L` · Stockage économique | 29,90 € | Zone de stockage, 4 unités/m² à 300 g/unité | 1 200 g/m², passif, +0 point commercial, protection supplémentaire 0 % | Séparer capacité de zone et capacité d’un contenant de vente. |
| `BROR-JARS-48` · Stockage standard | 649 € | Zone de stockage, 1 rayonnage/m² | 2 400 g/m², passif, +0,30 point commercial, pertes ralenties de 25 % | Montrer le compartimentage et la protection. |
| `CURTEC-60L` · Stockage haut de gamme | 899 € | Zone de stockage, 4 fûts/m² à 3 000 g/unité | 12 000 g/m², passif, +0,60 point commercial, pertes ralenties de 45 % | Montrer le compromis entre capacité et nombre de lots indépendants. |
| `SIM-STORAGE-CLIMATE-01` · Économique | 499 € | Zone de stockage aménagée, un modèle actif pour l’ensemble du stockage | 6 kWh/m²/mois à 0,25 €/kWh, +0,10 point commercial, pertes ralenties de 10 % | Afficher la dépense mensuelle avec la surface réelle. |
| `SIM-STORAGE-CLIMATE-02` · Standard | 1 799 € | Même installation | 12 kWh/m²/mois, +0,25 point commercial, pertes ralenties de 25 % | Employer les valeurs du calcul commercial dans la comparaison. |
| `SIM-STORAGE-CLIMATE-03` · Haut de gamme | 4 999 € | Même installation | 24 kWh/m²/mois, +0,50 point commercial, pertes ralenties de 40 % | Les autres climatiseurs possédés restent disponibles en réserve. |
| `GV-GP50-7` et `GV-WASHER-36L` · Références entrepôt standard | 369,99 € et 127,99 € | Liens historiques vers `PRESS-0600` et `WASHER-25L` | Inventaire historique, respectivement 80 g/lot en 1 h à 500 W et 500 g/lot en 2 h à 250 W | Orienter les achats et la progression vers l’atelier commun, où les capacités, prix et prérequis sont distincts. |

Un extracteur au sol dessert les directions dégagées. Sur un mur extérieur, la prise d’air donne sur l’intérieur. Sur une cloison, le joueur choisit le côté d’aspiration. Les flèches suivent l’air des zones desservies jusqu’à la bouche de l’extracteur et les hachures distinguent la portée possible de la surface effectivement servie. Les cases de 1 m² utilisent la distance de grille et le segment entre centres pour bloquer la couverture aux cloisons. Une case ne compte qu’une fois. Le meilleur modèle passe d’abord, puis les appareils de même gamme sont ordonnés par position. Chaque appareil sert en priorité les cases actives les plus proches. Ses watts sont partagés entre les zones actives desservies. Un appareil sans case active couverte reste à l’arrêt. La couverture pondère l’apport de qualité et la récolte d’une zone. À équipement égal, les mètres carrés sans couverture produisent 75 % du rendement de référence. Une ancienne installation conserve son calcul jusqu’à conversion explicite, qui conserve le nombre d’appareils et leur gamme. Le plan et la fiche de zone montrent les mètres carrés couverts et les positions. Les déplacements sont gratuits. Un retrait remet l’appareil en réserve.

**Après récolte.** Les zones de séchage et de stockage additionnent leurs capacités. Les bonus de plusieurs gammes sont pondérés par leur capacité. La protection du climatiseur se combine avec celle du stockage sur les pertes restantes. Les points indiqués concernent la qualité commerciale sur 10. Stockage et climatiseur contribuent selon le temps passé dans ces conditions. Dans les vues Séchage et Stockage, distinguer capacité, durée et valeur commerciale.

Les extracteurs placés appartiennent au parc commun. Le registre conserve leur prix d’acquisition et leur usure enregistrée. Le lancement d’une culture calcule sa qualité et sa puissance à partir du modèle et des cases desservies. L’usure de fin de culture s’applique aux équipements affectés personnellement à la zone. Un même extracteur partagé entre plusieurs cultures ne reçoit donc pas plusieurs écritures d’usure.

## Modules et fournitures de zone

Pour les lignes à trois références, les colonnes suivent l’ordre économique, standard, haut de gamme. Les profils locaux sont chiffrés par m². La centrale et le sas sont achetés par unité (32 € et 20 €), avec préparation de leur case et pose selon le devis. Chacun dessert en priorité les cultures actives, puis les cases les plus proches en vue directe. Les fournitures sont facturées par m² servi par cycle actif. La première pose de ces postes convertit les anciennes affectations haut de gamme en unités disponibles en réserve, dans le brouillon à confirmer. Chaque zone reçoit au plus une référence par famille. Les bonus des familles s’ajoutent avec des plafonds de +24 % à la récolte et de +4 points de Qualité de départ issus des modules. Les effets du tableau s’appliquent sur un plan à ventilation placée, y compris quand aucun extracteur n’est posé. Les anciens plans et instantanés conservent leur calcul. Les quantités de fournitures sont des unités de jeu par m² et par cycle. La boutique présente les profils par unité et par m². La fiche de zone récapitule les références posées et leur coût de cycle. Les anciens modules couverts restent réutilisables depuis la réserve.

| Famille et références | Achat €/m² | Fournitures €/m²/cycle et unités | Effet de jeu | Décision |
| --- | --- | --- | --- | --- |
| Irrigation · `SIM-WATER-01`, `SIM-WATER-02`, `SIM-WATER-03` | 9 / 19 par m², puis 32 par centrale | 0,70 / 1,40 / 2,40 € · 1 / 2 / 3 unités | Récolte +1 / +2 / +3 % | Garder le choix d’organisation et son coût récurrent. |
| Climat de culture · `SIM-CLIMATE-01`, `SIM-CLIMATE-02`, `SIM-CLIMATE-03` | 14 / 28 / 46 | 0,90 / 1,90 / 3,40 € · 1 / 2 / 3 unités | Récolte +1 / +2 / +3 %, Qualité +0 / +1 / +2 | Présenter ce profil de zone séparément de l’extraction placée et du climatiseur de stockage. |
| Pilotage · `SIM-CONTROL-01`, `SIM-CONTROL-02`, `SIM-CONTROL-03` | 6 / 15 / 29 | 0,40 / 1 / 1,80 € · 1 / 2 / 3 unités | Récolte +1 / +2 / +3 %, Qualité +0 / +0 / +1 | Montrer l’effet au devis, indépendamment des accessoires du décor. |
| Hygiène · `SIM-HYGIENE-01`, `SIM-HYGIENE-02`, `SIM-HYGIENE-03` | 4 / 11 par m², puis 20 par sas | 0,80 / 1,60 / 2,60 € · 1 / 2 / 3 unités | Qualité +1 / +2 / +3, dans le plafond des modules | L’hygiène agit sur la qualité de la zone. Les fournitures restent incluses dans le budget du cycle. |
| Desserte mobile · `SIM-LOGISTICS-01` | 7 € par entrepôt | 0 € · 0 unité | Temps de trim manuel et machine réduit jusqu’à 10 % | Achat unique et indépendant, sans pose. |
| Chariot commun · `SIM-LOGISTICS-02` | 16 € par entrepôt | 0 € · 0 unité | Jusqu’à 25 % de manutention en moins par charge du lyophilisateur, suivant l’usure. L’attente autonome garde sa durée. | Achat unique, sans pose au m². Convertir les anciens modules détenus avec un exemplaire et un crédit pour les surplus dont le coût d’achat est connu. |
| Table de trim · `SIM-LOGISTICS-03` | 28 € par entrepôt | 0 € · 0 unité | Temps de trim manuel réduit jusqu’à 20 % | Achat unique et indépendant, sans pose. |
| Sécurité de zone · `SIM-SECURITY-01`, `SIM-SECURITY-02`, `SIM-SECURITY-03` | 8 / 18 / 30 | 0,50 / 1,10 / 1,80 € · 1 / 2 / 3 unités | −1,25 / −2,50 / −4 € sur les fournitures de base par m² et par cycle | Donner une valeur économique aux fournitures protégées dans la zone. |
| Support · `SIM-SUBSTRATE-01`, `SIM-SUBSTRATE-02`, `SIM-SUBSTRATE-03` | 3 / 6,50 / 10 | 1,60 / 2,90 / 4,60 € · 1 / 2 / 3 unités | Récolte +1 / +2 / +3 %, Qualité +0 / +1 / +2 | Garder les profils abstraits, chiffrés par surface. |
| Nutrition · `SIM-NUTRITION-01`, `SIM-NUTRITION-02`, `SIM-NUTRITION-03` | 2,50 / 5 / 9 | 1,80 / 3,20 / 5,20 € · 1 / 2 / 3 unités | Récolte +1 / +2 / +3 %, Qualité +0 / +0 / +1 | Afficher en unités de jeu par cycle. |
| Consommables de base | 22 €/m²/cycle | Facture de cycle | Les anciennes affectations de manutention et de sécurité restent prises en compte dans les instantanés déjà lancés. | Garder la dépense dans le bilan et l’échéance côté serveur. |
| Décor du plan et cloisons | Aucun achat dédié | Parois sur grille hors zones, accessoires fixes dans le décor | Les parois produisent une obstruction pour l’air. Le mobilier illustré sert de repère. | Rendre la cloison visible et navigable sur le plan. Présenter les fournitures à effet via les lignes du devis. |

Les trois équipements de manutention perdent un point d’état par créneau de trim ou charge de lyophilisateur accepté. Le gain décroît linéairement jusqu’à 100 % d’usure. Le créneau conserve la cadence confirmée et décompte les heures réservées au joueur ou au salarié. Une installation locale historique est convertie après la fin des activités qui l’utilisent. L’entrepôt garde l’exemplaire le moins usé de chaque équipement, puis crédite les doublons dont le prix d’acquisition est connu.

## Anciennes tentes et équipement de bâtiment

Le catalogue de tentes affiche l’emplacement, l’état, la puissance et les effets de l’article installé. Une tente utilise un modèle par emplacement. Le séchoir, l’énergie et la sécurité s’appliquent au bâtiment dans les sauvegardes qui utilisent ce périmètre, à raison d’un bâtiment pour quatre tentes. Le prix de flotte multiplie les achats selon ce périmètre. Les objets de départ sont gratuits et fixés à leur niveau d’origine. Les équipements améliorables vont de 1 à 10. La montée d’un niveau coûte le prix de base multiplié par le niveau courant et divisé par 10, arrondi au centime supérieur, au périmètre d’achat.

| Références | Prix de base | Portée, paramètres et effet de niveau 1 | Décision |
| --- | ---: | --- | --- |
| `TENT-080-STARTER`, `TENT-120` | 0 €, 199 € | Une par tente, 90 × 90 et 120 × 120 cm, 0 W. Vente brute ouverte, +50 % de quantité pour la seconde. | Garder l’emplacement Tente et ses niveaux. |
| `LED-150-STARTER`, `LED-300` | 0 €, 359 € | Une par tente, 115 et 300 W. La seconde ajoute +20 % de quantité et +2 de qualité maximale. | Garder le remplacement de luminaire dans l’ancienne scène. |
| `AIR-STARTER`, `AIR-EC6` | 0 €, 149 € | Un extracteur par tente, 35 et 38 W. `AIR-EC6` ajoute +6 % de régularité. | Décrire l’effet de la tente dans sa fiche d’emplacement. |
| `CLIMATE-SMART` | 139 € | Contrôleur de la tente, emplacement dédié, 5 W, +12 % de régularité et +2 de qualité maximale. | Garder un choix distinct dans le catalogue des tentes. |
| `DRYING-ROOM` | 600 € | Séchoir de bâtiment, 75 W, +1 de qualité maximale et +2 % de régularité. | Garder la pièce illustrée de l’ancienne scène et les effets du bâtiment. |
| `SOLAR-BACKUP` | 1 149 € | Énergie du bâtiment, 0 W comptabilisé, −20 % sur la facture et protection des coupures. | Conserver la fiche énergie et le coût dans le périmètre qui utilise cet équipement. |
| `SECURITY-CAMERA`, `SECURITY-DOG` | 69,99 €, 1 000 € | Alternatives de sécurité, 12 W et 0 W. Protection du vol, +8 % de régularité pour le chien. | Garder le bénéfice de l’équipement installé dans la vue du bâtiment. |
| `TENT-150`, `LED-500`, `SECURITY-FENCE` | 249 €, 579 €, 180 € historiques | `TENT-120` et `LED-300` niveau 10 reprennent les deux premières progressions. Clôture retirée des achats. | Garder les codes d’archive lisibles dans les anciennes sauvegardes. |

## Atelier commun

L’atelier installe une machine par poste, indépendamment des cases de culture. Les gammes économique, standard et haut de gamme démarrent aux niveaux 1, 4 et 7. Leurs capacités de jeu de départ sont respectivement ×1, ×2 et ×4. Les niveaux intermédiaires règlent capacité et précision. Le devis de gamme additionne les niveaux franchis. Les vues Boutique et Atelier présentent la gamme, les grammes par lot, la durée de lot et la précision. La fiche de planification du travail distingue les cadences simulées, l’attente passive et les heures de personnel.

| Poste | Prix au niveau 1 | Paramètres de départ | Place dans les filières et décision |
| --- | ---: | --- | --- |
| Tamis · `SIFT-TRAY` | 550 € | 120 g/lot en 1 h, précision 82 %, 180 W | Ouvre le tamisage, puis sert avec le séparateur. |
| Laveuse · `WASHER-25L` | 1 250 € | 180 g/lot en 2 h, précision 78 %, 990 W | Ouvre la filière de lavage et sert de base aux postes complémentaires. |
| Collecteur · `AUTO-SIEVE` | 4 995 € | 500 g/lot en 1 h, précision 88 %, 55 W | Complète le lavage dans les filières avancées. |
| Séparateur · `STATIC-PLASMA` | 22 800 € | 120 g/lot en 1 h, précision 96 %, 650 W | Complète le tamis dans la filière de séparation statique. |
| Presse · `PRESS-0600` | 850 € | 80 g/lot en 1 h, précision 74 %, 600 W | Ouvre les filières Rosin dont les recettes sélectionnent leurs postes complémentaires. |
| Lyophilisateur · `FREEZE-DRYER` | 7 495 € | 500 g/lot en 6 h, précision 92 %, 1 600 W dans le catalogue. Le plan de travail autonome utilise 24 h d’attente et 0,5 h de manutention par charge simulée. | Associé aux filières avancées. Le chariot intervient uniquement sur la manutention de ce poste. |
| `WASHER-75G`, `TSS-225` | 30 495 €, 79 400 € historiques | Repris comme `WASHER-25L` niveaux 5 et 10 | Présenter les gammes de la laveuse active. |
| `PRESS-2T`, `PRESS-10T`, `PRESS-20T` | 7 995 €, 11 495 €, 19 996 € historiques | Repris comme `PRESS-0600` niveaux 5, 8 et 10 | Présenter les gammes de la presse active. |

## Contenants de lots

La fiche de stockage assigne des contenants possédés à un lot dans la capacité aménagée. Les formats augmentent la capacité par contenant. La protection est celle de la méthode, commune aux formats de la même ligne. Les coefficients de pertes sont donnés en pourcentage de la référence verre, pour l’arôme puis la chimie. Le fût individuel et l’équipement de la zone partagent un code de référence mais ont des prix et des unités distincts.

| Références | Prix/unité | Capacité/unité | Décision |
| --- | --- | --- | --- |
| `GLASS-1L`, `GLASS-2L`, `GLASS-3L` | 5 / 9 / 12 € | 50 / 100 / 150 g | Méthode `STORAGE-GLASS`, 100 / 100 %. Afficher la capacité du bocal et les places restantes. |
| `GROVE-1OZ`, `GROVE-1LB` | 3 / 15 € | 28 / 454 g | Méthode `STORAGE-GROVE`, 75 / 80 %. Garder la comparaison petit et grand sachet. |
| `BOVEDA-1L` | 9 € | 50 g | Méthode `STORAGE-BOVEDA`, 60 / 65 %. Montrer la protection sur la fiche du lot. |
| `CVAULT-2OZ`, `CVAULT-1LB` | 35 / 120 € | 56 / 454 g | Méthode `STORAGE-CVAULT`, 45 / 50 %. Garder la méthode inox avec les deux formats. |
| `CANNATROL` | 1 800 € | 2 000 g | Méthode `STORAGE-CANNATROL`, 25 / 30 %. Afficher l’investissement et la capacité. |
| `CURTEC-60L` | 85,50 € | 3 000 g | Méthode `STORAGE-GLASS`, 100 / 100 %. Identifier le fût individuel dans la boutique de contenants. |

Sources internes. [Catalogue au m²](../../src/lib/kanab-quest-warehouse-catalog.ts), [modules](../../src/lib/kanab-quest-warehouse-options.ts), [ventilation](../../src/lib/kanab-quest-warehouse-air.ts), [après récolte](../../src/lib/kanab-quest-post-harvest.ts), [catalogue des tentes et de l’atelier](../../src/lib/kanab-quest-equipment.ts), [gammes d’atelier](../../src/lib/kanab-quest-workshop-machines.ts), [planification du travail](../../src/lib/kanab-quest-processing-profiles.ts), [contenants](../../src/lib/kanab-quest-storage.ts).
