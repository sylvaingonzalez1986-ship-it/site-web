# Salle de culture et entrepôt

La Salle s’ouvre depuis l’entrepôt et depuis une culture en cours. L’entrepôt utilise une seule vue isométrique pour sélectionner et aménager ses zones. **Aménager** affiche les commandes Culture, Séchage et Stockage au-dessus de cette même scène. Le joueur trace une zone en glissant ou en choisissant deux coins, puis utilise **Déplacer** ou **Taille** pour l’ajuster. Le devis et la confirmation habituels appliquent le brouillon.

Sur téléphone, un doigt fait défiler la page en vue générale ; pendant un tracé ou une transformation, le geste agit sur la zone. Pincer agrandit la scène, puis glisser déplace la caméra. **Vue générale** recadre tout l’entrepôt. Les postes restent accessibles par leur nom au clavier ; le tracé utilise les flèches et Entrée. Dans une culture en cours, **Voir les dés** rejoint le plateau de lancer et **Revenir à la salle** retrouve la scène.

## Du plan au poste

L’entrepôt, le choix des cultures indépendantes et la partie partagent `KqGrowRoom`. Les dimensions du sol, les centres, orientations et emprises du mobilier et des cloisons viennent de `getKqWarehouseSpatialLayout`. Ce même référentiel sert au rendu orthographique, à la sélection et au trajet du personnage. Un déplacement de caméra ou un changement de largeur conserve les coordonnées de tous les postes. La variante d’une plante dépend de sa variété enregistrée.

Les dimensions affichées correspondent à la surface aménageable. L’entrée et l’allée périphérique du référentiel spatial servent à la circulation. Leur surface est exclue des capacités et des devis.

La vue de dessus sert aussi de référence visuelle. Sur les plans de 10 × 10 et de 40 × 25 m, la double porte turquoise, les gaines, les armoires électriques et les luminaires sont calés sur le dessin de l’entrepôt rénové. Les murs au premier plan sont montrés en coupe pour laisser voir les postes. Les hauteurs des meubles et des murs sont interprétées en trois dimensions.

Chaque case de culture retrouve son plateau de quatre pots. Lampes et extracteurs partagent leurs positions avec le plan. Les claies en bois, les caisses de bocaux, les rayonnages et les fûts reprennent les silhouettes du mobilier installé. Leurs façades suivent la rotation enregistrée. Les numéros, couleurs et portraits des Buddies permettent de retrouver chaque zone. En cas d’indisponibilité de WebGL, le jeu projette le fond et les équipements illustrés de l’éditeur.

L’avatar reprend le profil du Quartier. Une nouvelle destination interrompt sa marche, puis le geste commence à portée de la cible. Si un meuble ou une paroi empêche l’approche, le joueur peut continuer l’opération. Les dés sont communs à la campagne. Pour une PBI, le joueur choisit le secteur qui reçoit le produit.

| État enregistré | Représentation et retour joueur |
| --- | --- |
| Germination | Pousse basse dans son contenant. Le personnage se penche pour l’observer. |
| Enracinement | Jeune tige et premières feuilles déployées. Le nom du stade accompagne la sélection. |
| Croissance | Tiges ramifiées et couvert végétal élargi. L’intervention se fait plus haut. |
| Floraison | Les fleurs deviennent visibles aux extrémités des branches. Les effets actifs et le matériel se consultent sous le poste. |
| Récolte | Fleurs plus fournies et feuillage arrivé à maturité. La validation de cette étape déclenche un geste de récolte. |
| Séchage et affinage | Les supports récoltés restent en place. Le séchage est représenté sur le poste installé, avec sa capacité et l’activité connue. |
| Terminée, perdue ou en pause | L’intitulé suit la sauvegarde. Le reçu de récolte fournit la quantité réelle. Une zone libre ou réservée ne reçoit pas de plante fictive. |

Le stockage indique le total connu et la capacité du poste. Quand plusieurs postes peuvent contenir des lots sans attribution individuelle enregistrée, la salle conserve la quantité à l’échelle de l’entrepôt. Les anciennes parties dépourvues de coordonnées offrent une consultation individuelle des tentes. Si la lecture du plan courant échoue, la partie indique qu’elle utilise le plan enregistré au lancement.

## Intervenir sur un foyer

Un foyer de parasites commence sur un seul plant, marqué d’une croix. Depuis **Soins**, sélectionner un auxiliaire compatible puis toucher une case cultivée de 1 m². Le choix est aussi possible dans la liste des cases, avec **Traiter cette case**. L’acceptation débite 1 m² de couverture et le personnage rejoint l’allée pour y déposer le sachet. La case garde ce repère tant que la PBI est active, y compris après une reprise. Annuler le ciblage conserve la réserve. Le prix d’achat présenté par la boutique couvre la surface annoncée.

Les quatre intrants utilisent le même choix de case. Le personnage épand le lombricompost ou verse le thé de compost, l’engrais organique liquide et l’extrait d’algues. Le bilan tient compte du problème local, du produit et de la superficie traitée. Plusieurs cases recevant le même intrant au même bilan comptent comme un seul apport pour la limite de deux apports par culture.

**Payer l’entretien** applique le devis affiché pour l’ensemble de la culture. La vue revient dans la salle et le personnage balaie l’allée. L’action utilise la trésorerie et les effets de santé sont calculés au prochain bilan.

À chaque bilan, un foyer sans protection gagne un plant voisin si l’emplacement est disponible. Si l’auxiliaire protège le foyer ou le voisin exposé, il reste une chance sur dix de propagation sur ce trajet. Une allée coupe le contact. La sauvegarde conserve la position et l’état des plants. Recharger reprend le même résultat. Ces règles concernent les parasites des cultures sur plan. Les anciennes tentes conservent leurs passages de soin.

L’aperçu de recette utilise deux cultures, un séchoir, un stockage, un plant atteint et 6 m² de PBI en réserve. Lancer `node scripts/audit-culture-room.mjs --check=pbi --serve` puis ouvrir `/?scene=pbi-demo` sur le port annoncé pour essayer le parcours.

## Règles utilisées pour la comparaison

| Système | Référence exécutée et invariant |
| --- | --- |
| Temps | `kanab-quest-game.ts` déroule les six stades sur préparation, lancer enregistré, résolution et passage au stade suivant. Un retour après absence reprend la phase sauvegardée. Une étape officielle consomme 0,5 h de travail au lancer. L’affinage utilise la date de fin du lot, calculée à partir d’une durée de base de six heures réelles. Les échéances financières suivent leur propre horloge. |
| Dés | `rollKqDice` génère les D6 à partir de la graine, du stade, du nonce et de l’indice. Le cas ordinaire conserve trois dés. Les effets à quatre ou cinq dés prennent les trois meilleurs. L’animation représente les faces et le dé écarté présents dans la sauvegarde. Une face brute a une probabilité nominale de 1/6 avant les effets. |
| Résolution | Une face de 4 à 6 compte comme réussite, un 6 comme étincelle et un 1 comme danger avant annulation. La cible est bornée de 1 à 3 avec la pression et les réductions applicables. Trois réussites donnent un critique. Atteindre la cible sans danger donne un succès. Atteindre au moins `max(1, cible − 1)` donne un résultat fragile dans les cas restants. |
| Qualité, XP et santé | La base de qualité vaut respectivement +3, +2, +1, −1 pour critique, succès, fragile, échec. La base d’XP vaut 3, 2, 1, 1, avec les étincelles, héritages et combos du moteur. Les soins utilisent la vitalité, les effets différés et les règles de secours de la version de partie sauvegardée. |
| Cartes et soins | L’inspection utilise disponibilité, cible, effet et coût calculés par le jeu. Jouer passe par la commande existante, dans sa fenêtre de préparation ou de réaction. L’entretien occasionne son montant serveur, avec une base de 500 centimes par unité éligible. Les intrants et les PBI consomment le produit prévu. Les gestes suivent l’acceptation et les récapitulatifs distinguent engagement et effet obtenu. |
| Récolte et jury | Le rendement d’entrepôt utilise le facteur `(55 + 7 × étapes réussies + 3 × qualité) / 160` borné entre 0 et 1, la capacité de l’installation et les modificateurs de santé, d’incident et de variété. L’arrondi final est au dixième de gramme. La fleur, les seuils selon la version, les notes du jury, l’inventaire, le classement et les récompenses suivent la finalisation du jeu. |

L’équivalence est vérifiée sur deux parcours de règles v2/v3 à graine fixe. Après chaque action, la sauvegarde et la projection sont comparées au parcours de référence. La reprise après 36 h et la fleur finale sont également comparées. Les coûts, reçus, répétitions et campagnes multi-zones sont exercés séparément dans PostgreSQL local.

Les définitions exécutées sont consultables dans le [moteur de culture](../../src/lib/kanab-quest-game.ts), les [soins](../../src/lib/kanab-quest-care.ts), la [création de la fleur et le jury](../../src/lib/kanab-quest-battle.ts), la [sauvegarde](../../src/lib/kanab-quest-persistence.ts) et le [stockage après récolte](../../src/lib/kanab-quest-storage.ts).

## Références de conception

| Jeu et genre | Principe observé | Adaptation dans le jeu | Limite de transposition |
| --- | --- | --- | --- |
| Magic, TCG | Le coût et le texte de la carte permettent de décider avant de la jouer. [Règles officielles](https://magic.wizards.com/en/how-to-play) | Afficher effet, coût et conditions dans l’inspection. | Le jeu conserve ses XP et ses fenêtres d’action. |
| Pokémon, TCG | La position active et le banc déterminent la portée des actions. [Livret officiel](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/rulebook/swsh8_rulebook_en.pdf) | Nommer la culture concernée ou la campagne commune avant validation. | Les emplacements agricoles ne deviennent pas des adversaires. |
| Hearthstone, jeu de cartes numérique | La conception d’un deck tient compte des cartes utilisables à chaque moment. [Conseils du concepteur](https://hearthstone.blizzard.com/en-us/news/14397231) | Distinguer les cartes jouables et expliquer le blocage d’une carte inspectée. | La courbe de mana reste propre à Hearthstone. |
| Marvel Snap, jeu de cartes numérique | Chaque lieu a une identité et des effets lisibles. [Présentation officielle](https://marvelsnap.com/game-overview/) | Associer le retour de carte au poste concerné et afficher la portée de campagne. | La salle conserve ses emplacements sauvegardés. |
| Dicey Dungeons, roguelike à dés | Les équipements lisent des valeurs de dés explicites. [Wiki officiel des équipements](https://wiki.diceydungeons.com/doku.php?id=equipment) | Garder lisible le lien entre face finale et conséquence. | L’affectation libre des dés appartient au jeu de référence. |
| Stardew Valley, jeu de ferme | Un personnage personnalisé partage l’environnement de sa ferme. [Site officiel](https://www.stardewvalley.net/) | Reprendre le personnage du compte et faire évoluer les plantes dans la salle. | La progression conserve les six étapes du moteur. |
| Story of Seasons, simulation agricole | Le geste et l’outil identifient l’interaction avec la culture. [Manuel officiel](https://www.storyofseasons.com/grandbazaar/manuals/ps5/01/) | Adapter posture et hauteur aux semis, aux fleurs et aux postes. | L’animation accompagne une opération déjà acceptée. |
| Farm Together, gestion agricole | Le retour à la ferme permet de retrouver une exploitation qui évolue dans le temps. [Présentation du studio](https://www.milkstonestudios.com/games/farm-together/) | Restituer immédiatement phase, état, stock et opération disponible à la reprise. | Les seules échéances appliquées sont celles du jeu des Chanvriers. |
| Animal Crossing, simulation de vie | Le joueur reconnaît l’intérieur par les meubles qu’il a placés. [Exemples de Nintendo](https://play.nintendo.com/news-tips/tips-tricks/animal-crossing-new-horizons-discover-tips/) | Salle continue en trois quarts, personnage à la même échelle et mobilier orienté selon le plan. | Les matériaux et les végétaux suivent la direction artistique de l’entrepôt. |

## Lecture du plan et retour de version

La migration additive `20261117000100_kq_warehouse_room_observation.sql` crée une fonction stable de lecture du plan et de ses états, réservée au rôle serveur. Le navigateur passe par la session du joueur. L’appel est testé dans une transaction PostgreSQL en lecture seule, y compris avec un identifiant dépourvu d’entrepôt. Le retour de version consiste à restaurer le client précédent puis à exécuter `DROP FUNCTION public.rpc_kq_observe_warehouse_room(uuid)`. Les tables, soldes, inventaires et sauvegardes conservent leur format.

Les interventions au mètre carré utilisent la migration `20261118000100_kq_care_sectors.sql`. Chaque reçu enregistre la case, la quantité engagée et la clé de requête. [Retour de version des PBI](retour-pbi-secteurs.md).
