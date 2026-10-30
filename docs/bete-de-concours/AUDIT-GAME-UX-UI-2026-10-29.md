# Audit du game design et de l’expérience de Kanab Quest

29 octobre 2026 — Arène, Quartier et parcours du joueur. Les sections 1 à 13 décrivent l’état avant refonte. La section 14 consigne la première réalisation issue de cet audit.

**Le sentiment de densité est justifié. Ma note de synthèse pour l’expérience actuelle est de 5,5/10.** Le jeu possède une identité forte, des décisions intéressantes et une boucle économique cohérente. Sa difficulté principale est de faire comprendre où agir, dans quel ordre et sur quel objet. Plusieurs écrans administrent les mêmes récoltes ou la même boutique ; les objectifs, compteurs et calendriers se disputent l’attention.

La priorité est une refonte de l’organisation : un lieu principal par action, une récolte identifiable pendant tout son parcours et une découverte progressive des activités avancées. Les illustrations, les personnages et les matériaux papier constituent des atouts à conserver.

**1. Périmètre et portée des notes**

L’examen porte sur les composants et règles actuellement présents dans le dépôt, y compris les modifications locales en cours. Il couvre l’entrée dans l’Arène, la navigation, la culture, les récoltes, l’entrepôt, le commerce, les missions, les collections, les finances, les réseaux et l’apprentissage.

Une observation dans Chromium complète la lecture : 22 états capturés à 1440, 390 ou 320 pixels, sur les démonstrations locales de l’Arène, du Quartier et du Commerce. Ces démonstrations utilisent les composants actuels et des données fictives ; certaines destinations de navigation sont simulées. Les captures de Culture proviennent également de l’exécution locale du contrôle des en-têtes. Aucun compte réel ni aucune transaction distante n’a été utilisé.

Les notes sont des appréciations expertes argumentées. Elles ne mesurent pas la satisfaction, l’abandon ou la rétention. L’équilibrage économique, l’équité des duels et le plaisir à long terme nécessitent des simulations et des observations de joueurs. Les performances de production et la conformité complète d’accessibilité ne sont pas évaluées ici.

Repères de lecture : 4–5 signifie que l’utilisateur doit fournir un effort important ; 6–7 décrit une base fonctionnelle avec des frictions ; 8–9 signale une qualité forte. La note globale est une synthèse, pas une moyenne statistique.

| Dimension | Note /10 | Appréciation |
| --- | ---: | --- |
| Identité artistique | 8,5 | Univers cartoon, personnages, cartes et panneaux immédiatement reconnaissables. |
| Cohérence de la boucle principale | 7 | La culture nourrit les récoltes, le commerce et l’investissement. Le passage jury/lot mérite une clarification. |
| Richesse des décisions | 8 | Cartes, dés, soins, équipement, qualité et débouchés offrent de vrais arbitrages. |
| Architecture de l’information | 4 | Les lieux et leurs sous-rubriques se recouvrent ; carte et menu n’expriment pas la même organisation. |
| Localisation des actions | 4 | Vente, transformation, stockage et prix ont plusieurs lieux de gestion. |
| Hiérarchie visuelle | 4,5 | Beaucoup de panneaux, titres et mesures reçoivent une importance voisine. |
| Expérience mobile | 5 | L’adaptation évite les débordements sur l’échantillon, mais reporte la densité dans de longues pages. |
| Apprentissage | 6 | Les essais jouables sont riches ; l’entrée peut enseigner trop de domaines avant une première boucle maîtrisée. |
| Objectifs et progression | 5 | Les projets utiles existent, mais plusieurs systèmes jouent simultanément le rôle de boussole. |
| Vocabulaire et ressources | 4 | Boutique, XP, qualité et points recouvrent plusieurs réalités. |
| Rythme et reprise de session | 4,5 | Plusieurs horloges à comprendre ; une bonne priorité de stockage existe déjà dans le Quartier. |
| Explication des conséquences | 8 | Prévisions, bilan causal et explications des choix sont de solides outils d’apprentissage. |
| Fondations d’accessibilité | 7 provisoire | Focus, clavier, dialogues et alternatives aux graphiques sont pris en compte. Validation complète à faire. |

**2. Les qualités à préserver**

La promesse de jeu est tangible : faire pousser une production, apprendre à améliorer sa qualité, lui trouver un débouché et financer son prochain progrès. Les cartes et les dés donnent une identité ludique à cette gestion. Les choix ont des conséquences expliquées ; le bilan de culture peut aider à améliorer la partie suivante.

La direction artistique donne une personnalité au produit. La carte du village, les personnages et les enseignes constituent des repères mémorables. Une refonte doit conserver leur rôle, avec des textes et commandes en HTML et les plaques illustrées prévues par le système graphique.

Plusieurs bonnes solutions sont déjà présentes : prochaine action dans le Quartier, priorité donnée à un surplus de stockage, préparation réunissant Buddie/cartes/Héritage, cartes jouables filtrées, prévision avant validation, détails repliables, coûts de confirmation et distinction entre estimations et résultats. Il faut les généraliser et mieux les relier.

La Culture en cours est relativement mieux focalisée que les espaces de gestion. Dans la capture mobile examinée, situation, réussites nécessaires, dés et action « Lancer les dés » forment un parcours compréhensible. Elle ne mérite pas la même refonte lourde que Commerce.

**3. L’organisation actuelle demande trop de traductions mentales**

| Espace | Organisation constatée |
| --- | --- |
| Arène | Accès au jeu, Carnet, Classement, Profil. |
| Navigation globale du jeu | 10 destinations : Quartier, Culture, Récoltes, Entrepôt, Commerce, Réseaux, Finances, Collections, Missions, Boutique. |
| Carte du Quartier | 8 bâtiments : Entrepôt, Banque, Bureau, Marché, Boutique, Jury & duels, Missions, Collections. |
| Récoltes | Vue des récoltes, Jury & duels, Stockage & affinage. |
| Entrepôt | Plan, Séchage, Stockage, Atelier. |
| Commerce | Vue d’ensemble, Demandes clients, Vendre ma production, Mes ventes, Développer ma boutique. |
| Développer ma boutique | Activité, Prix CBD, Merch, Promouvoir, Site internet, Studio. |
| Finances | Factures & disponible, Banque & placements, Comptabilité détaillée. |
| Banque | Prêts, Livret, Crypto Top 100, Bourse. |
| Comptabilité | Synthèse, Bilan et résultat, Journal, Plan comptable. |

Ces choix ne sont pas tous affichés simultanément. Le problème est leur accumulation pendant un parcours et le manque de frontières stables. Marché devient Commerce, puis Ma boutique. Banque et Bureau correspondent à des parties de Finances. Culture, Récoltes et Entrepôt ont trois entrées de menu, mais partagent le bâtiment Entrepôt. Le joueur doit apprendre cette correspondance avant d’être efficace.

La carte peut rester une navigation d’exploration. Chaque bâtiment doit annoncer les mêmes fonctions que le menu et ouvrir les mêmes destinations. Les sous-choix d’un bâtiment doivent expliquer une distinction utile, sans ajouter un détour à l’action recommandée.

**4. Les doublons à supprimer ou à réunir**

| Action ou contenu | Emplacements actuels | Décision proposée |
| --- | --- | --- |
| Transformer et vendre un lot | Commerce > Vendre ma production ; Entrepôt > Atelier > Lots à transformer | Un seul parcours commercial ; l’Atelier ouvre ce parcours sur le lot concerné. |
| Gérer l’entrepôt | Entrepôt ; Récoltes > Stockage, qui embarque aussi les autres onglets de l’entrepôt | Récoltes expose les lots et leur conservation ; aménagement et capacité restent dans Entrepôt. |
| Modifier le prix d’une annonce | Mes ventes > Modifier le prix ; Développer > Prix CBD | Une fiche annonce réunit suggestions de prix, estimation et saisie libre. |
| Superviser la boutique | Vue d’ensemble ; Mes ventes ; Développer > Activité | Une synthèse courte, un registre d’annonces, un espace d’investissement. Retirer Activité de Développer. |
| Choisir un objectif | Missions ; succès épinglé du profil ; objectif de filière ; contrat de culture | Un projet personnel suivi partout ; défi de culture clairement facultatif ; succès en reconnaissance secondaire. |

**Vente et transformation.** Le même composant complet `KqCommerceDesk` est monté dans Commerce et dans l’Atelier. Le joueur rencontre donc deux interfaces de travail, et pas seulement deux raccourcis vers une destination identique. Cela rend incertaine la réponse à « où dois-je retourner pour faire la même chose ? ».

L’Entrepôt peut conserver la visualisation des machines, leurs capacités et leur entretien. « Transformer ce lot » conduit à la fiche commerciale du lot, avec le matériel pertinent déjà indiqué. Le retour ramène au bon contexte.

**Récoltes et Entrepôt.** Le Stockage de Récoltes charge l’entrepôt complet avec un onglet initial. Le joueur peut ensuite aller dans Plan ou Atelier tout en restant dans une rubrique globalement intitulée Mes récoltes. C’est un changement d’activité insuffisamment annoncé.

**Prix.** Les deux interfaces modifient la même annonce. Elles proposent des outils complémentaires, mais la confirmation de stratégie avertit que la progression vers la prochaine commande repart de zéro, tandis que la confirmation de saisie libre ne le précise pas. C’est une priorité de correction : la même conséquence doit être annoncée dans tous les parcours concernés.

Sources : [montage du Commerce](../../src/components/placard/KqMarketHub.tsx), [Atelier de l’entrepôt](../../src/components/placard/KqWarehouse.tsx), [Récoltes](../../src/components/placard/KqHarvests.tsx), [édition d’annonce](../../src/components/placard/KqOnlineStore.tsx), [stratégies de prix](../../src/components/placard/KqShopTycoon.tsx).

**Les répétitions utiles à conserver.** Carte, menu et bouton contextuel peuvent conduire à une même action. Ce sont de bons raccourcis s’ils ouvrent le même écran et conservent l’objet sélectionné. Une synthèse financière dans Commerce peut renvoyer au registre de Finances. Acheter des packs et consulter sa collection répondent à deux intentions distinctes. Une demande client et une offre de vente peuvent également coexister si leur lien est clair.

**5. Audit de la boucle de jeu et de la progression**

**Une boucle centrale à rendre visible.** Le joueur devrait pouvoir expliquer son activité en une phrase : « Je cultive, je valorise ma récolte, je la vends et j’améliore mon installation. » Chaque écran doit lui indiquer l’étape actuelle, le résultat attendu et la prochaine action.

Aujourd’hui, les systèmes périphériques ont une visibilité proche de celle de cette boucle. Réseaux, merch, studio, placements, comptabilité et collections peuvent donner l’impression d’être tous nécessaires. Leur profondeur doit devenir une spécialisation choisie.

Je recommande trois cercles de découverte : départ avec culture/récolte/vente/amélioration ; développement avec transformation, boutique et clientèle ; spécialisation avec marque, réseaux, investissements et finances détaillées. Un joueur expérimenté doit conserver l’accès direct aux outils maîtrisés. La simplification ne doit pas effacer sa progression.

**Un projet personnel transversal.** Le jeu contient 30 missions dans cinq parcours, des succès, des objectifs de filière, des contrats et une progression de carrière. Plusieurs objectifs peuvent donc réclamer une décision en parallèle.

Le Quartier devrait montrer un projet choisi par le joueur, par exemple financer une amélioration réellement accessible. La même progression accompagne les résultats de Culture, Récoltes et Commerce. Les missions deviennent le lieu où choisir ou remplacer ce projet. Les succès restent consultables ; les contrats sont présentés comme des défis facultatifs de la culture en cours. Aucun nouveau système de quêtes n’est nécessaire.

**Séparer clairement les ressources.** Trois expériences coexistent : XP métier permanente, XP de culture dépensable et EXP d’Arène. Il existe également plusieurs notions de qualité et plusieurs types de points.

| Notion | Présentation proposée |
| --- | --- |
| XP métier | Conserver « XP métier » pour la progression permanente. |
| XP dépensée pendant une culture | Nommer « Points d’action de culture », à valider contre les autres ressources du jeu ; éviter « énergie », déjà utilisée pour l’électricité. |
| EXP d’Arène | La placer dans le palmarès avec son utilité précise. Si elle ne guide aucune décision, réduire sa présence dans les écrans courants. |
| Qualité pendant la partie | « Qualité de culture », avec son rôle dans le résultat. |
| Verdict | « Note du jury /10 », avec sa conséquence. |
| Conservation et vente | Qualité actuelle du lot, état et évolution dans le temps. |
| Points | Ajouter systématiquement leur nature : saison, fidélité ou autre origine effective. |

Le joueur doit savoir immédiatement si une valeur se dépense, se conserve ou décrit un résultat. Une aide générale ne suffit pas à corriger une ambiguïté répétée sur les boutons et compteurs.

Sources : [carrière](../../src/lib/chanvrier-career.ts), [culture et jury](../../src/components/placard/KanabQuestDicePrototype.tsx), [saison](../../src/components/placard/KqSeasonBoard.tsx), [missions](../../src/components/placard/KqMissionCenter.tsx).

**6. Jury, risque et récompenses**

Le vocabulaire de la Fleur qui « brûle définitivement » peut faire croire que le joueur détruit sa récolte. Le modèle distingue pourtant la participation au concours et le lot commercial qui subsiste. Cette distinction doit être visible avant la décision et après son résultat.

Proposition de formulation : « Ta participation au concours sera consommée. Ton lot restera disponible ; voici sa prochaine étape. » Montrer séparément la carte engagée, la quantité commerciale, les coûts et l’échéance. Les termes doivent suivre exactement les règles du mode choisi.

Le mode nommé entraînement consomme également une Fleur dans le parcours examiné. Le nom « Duel solo — consomme une participation » serait plus explicite. Réserver « Essai gratuit » ou « Entraînement gratuit » aux simulations sans dépense réelle de ressources.

Une évolution plus importante serait de séparer l’évaluation du lot et le duel facultatif. Le joueur orienté gestion ferait évaluer sa récolte pour la commercialiser ; le joueur orienté compétition choisirait ensuite d’engager sa participation. Cette proposition touche les récompenses et le rythme : elle nécessite une simulation économique avant réalisation.

La file commune, les récompenses de victoire et les bonus de série soulèvent aussi une question d’équité à étudier. Les gagnants obtiennent davantage de cartes, alors que les cartes jouées consomment des copies. Cela peut amplifier un avantage existant ; ce n’est pas une preuve de déséquilibre. Vérifier résultats par ancienneté, qualité, inventaire et expérience. Maintenir une source prévisible de soutiens de base par la pratique, indépendante des séries de victoires, et examiner une protection des débutants. Aucun blocage payant absolu n’est démontré par cet audit.

**7. Apprentissage et rythme de session**

La Relève est une vraie force : elle propose une aventure jouable et des rencontres spécialisées. Son contenu couvre neuf chapitres et huit rencontres, de l’installation à la banque et aux collections. Le risque est d’enseigner une grande partie du produit avant que le joueur ait maîtrisé sa première boucle.

Je recommande une première expérience concentrée sur un Buddie, un tour expliqué, une récolte, une première vente et un investissement compréhensible. Le parcours guidé actuel peut fournir ces étapes. Les autres rencontres deviennent une aide proposée au moment d’un nouveau besoin. Si la simulation et le compte réel restent séparés, annoncer clairement ce qui sera conservé et rendre le passage à la vraie partie explicite.

La reprise de session doit être aussi travaillée que l’arrivée. Le joueur de retour doit voir : ce qui a changé, ce qui demande son attention, l’avancée de son projet et la prochaine action. Le Quartier possède déjà un moteur de recommandation et une priorité pour le surplus ; il faut étendre cette logique sans ajouter un nouveau tableau de bord concurrent.

Plusieurs horloges coexistent : jour de gestion de quatre heures réelles, affinage de six heures, délai de surplus d’une heure, remise à disposition sociale à minuit Paris, périodes de gestion pour la banque. Leur coexistence dans le moteur est possible, mais l’interface doit afficher des rendez-vous compréhensibles : heure locale, date et durée restante. Le joueur ne doit pas convertir mentalement jours de jeu, jours réels et mois de gestion.

L’échéance courte de surplus mérite un examen spécifique pour les joueurs occasionnels. Vérifier si le joueur comprend et accepte son traitement automatique, et s’il peut choisir une règle de conservation ou de vente par défaut. Un changement de délai doit être évalué avec l’économie du jeu.

Sources : [La Relève](../../src/lib/arena-releve.ts), [entrée dans le jeu](../../src/components/contest/ArenaGameEntry.tsx), [priorité du Quartier](../../src/components/placard/KqPlacardLobby.tsx), [temps de gestion](../../src/lib/kanab-quest-business.ts), [stockage](../../src/lib/kanab-quest-storage.ts), [journée sociale](../../src/lib/kanab-quest-social-daily.ts).

**8. Audit visuel et mobile**

**La densité est particulièrement forte dans Commerce.** La navigation globale comporte dix destinations ; Commerce ajoute cinq rubriques ; Développer en ajoute six. Sur ordinateur, deux colonnes de navigation peuvent cohabiter. Sur mobile, les couches deviennent Menu, Rubriques et sous-onglets.

Les captures locales donnent un ordre de grandeur concret. Les hauteurs suivantes mesurent le contenu de Commerce, sans le bandeau d’outils de démonstration et sans ajouter le shell global du jeu.

| État de démonstration | Largeur | Hauteur du contenu |
| --- | ---: | ---: |
| Vue d’ensemble, deux rayons vides | 390 px | 3 089 px |
| Vue d’ensemble, deux rayons vides | 320 px | 3 222 px |
| Vue d’ensemble, fleurs et merch | 320 px | 3 418 px |
| Mes ventes, fleurs et merch | 320 px | 3 376 px |
| Développer, scénario actif | 320 px | 2 745 px |

L’état « deux rayons vides » est celui d’une boutique de démonstration déjà ouverte, pas celui d’un nouveau compte. Il illustre néanmoins le fait que l’absence de stock ne simplifie pas suffisamment la page. Celle-ci conserve le parcours de stock, les demandes, les rythmes, les deux rayons et les dernières ventes.

La longueur seule n’est pas une erreur : un catalogue peut être long et efficace. Ici, l’enjeu est la quantité d’informations concurrentes avant les objets à gérer. Dans Mes ventes, six mesures de paquets, quatre résultats et trois mesures d’audience/confiance/visites précèdent les annonces.

**Organisation visuelle proposée.** Chaque page commence par son titre, son état utile, deux ou trois chiffres décisionnels et une action principale. Viennent ensuite les objets à gérer. Les formules, résultats cumulés et historiques détaillés restent accessibles dans des panneaux dépliables. Les coûts, prérequis, erreurs et conséquences restent visibles au moment de la décision.

Un état vide devrait montrer le prérequis manquant et l’action qui permet de démarrer. Un état actif montre d’abord les éléments à traiter. Un problème de stock ou de paiement prend la priorité sur le tableau de statistiques.

**Préserver les illustrations avec une hiérarchie plus nette.** Conserver les scènes et les personnages aux moments d’entrée, de découverte, de jeu et de récompense. Dans une tâche répétée comme modifier un prix, placer le résumé et la commande avant une grande illustration. Dans Mes ventes, le CSS mobile met actuellement une illustration de 160 pixels avant le titre et les actions.

Les feuilles encadrées servent aux ensembles principaux et aux nombres clés. Les lignes d’un registre peuvent être séparées par des règles d’encre. Garder les contours et les plaques complètes en neuf tranches ; aucune refonte en boutons rectangulaires génériques n’est nécessaire.

**Rendre les accents graphiques prévisibles.** L’or sert actuellement à une action principale, à un onglet sélectionné et à certains indicateurs simplement selon leur position. Je propose : or pour l’action principale, teal pour la sélection, papier pour le secondaire et apricot pour les accents chaleureux. Couleur, texte et forme doivent se compléter.

**Réduire les répétitions éditoriales.** Le titre du shell, le chapitre illustré et l’en-tête interne peuvent annoncer plusieurs fois le même espace. Garder un titre de page et des sous-titres qui expriment réellement une autre section. Retirer les numéros décoratifs 01–10 du menu : ils peuvent laisser croire à un ordre de progression inexistant.

**Corriger la priorité de la barre mobile.** Elle expose Quartier, Culture, Récoltes, Réseaux et Menu. Commerce, qui ferme la boucle économique, est moins accessible que Réseaux. La cible recommandée est Quartier, Culture, Récoltes, Commerce et Plus. En Culture, la barre disparaît ; le retour explicite vers Entrepôt reste présent. Vérifier que cette présentation immersive ne fait pas perdre le repère de sortie.

**Augmenter les textes décisionnels.** Plusieurs textes de Commerce sont autour de 11–12 pixels et certains libellés financiers mobiles autour de 9–10 pixels selon la taille de police racine. Réduire le nombre de mesures simultanées permettra de viser 14–16 pixels pour les informations utiles à l’action et de réserver les petites tailles aux annotations secondaires. Ce sont des objectifs de conception, pas des seuils universels de conformité.

L’échantillon de 22 états ne présente pas de débordement horizontal. Cela ne prouve pas la lisibilité ni la conformité complète. Les vérifications à compléter portent sur zoom, clavier, lecteur d’écran, contraste sur textures, zones tactiles et mouvement réduit. Viser 44 pixels pour les commandes principales est un choix de confort ; le minimum WCAG 2.2 AA relatif aux cibles est de 24 × 24 pixels CSS avec des exceptions de taille ou d’espacement. [Référence W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

**9. Architecture cible**

Sur ordinateur : **Quartier · Culture · Récoltes · Commerce · Entrepôt · Plus**.

Sur mobile : **Quartier · Culture · Récoltes · Commerce · Plus**.

Plus donne accès à Entrepôt sur mobile, Finances, Missions, Réseaux, Collections et Packs. Les alertes, objectifs et chiffres utiles ouvrent également leur destination directement. Une échéance à payer ne doit pas devenir invisible parce que Finances est dans un menu secondaire.

| Destination | Rôle principal | Ce qui doit être ailleurs |
| --- | --- | --- |
| Quartier | Reprendre sa session, voir une urgence, suivre son projet et explorer la carte. | Statistiques détaillées et formulaires de gestion. |
| Culture | Préparer et jouer la culture sélectionnée. | Consultation de l’ensemble des comptes ou du commerce. |
| Récoltes | Retrouver les lots, leur état, le verdict et la conservation. | Plan complet d’aménagement de l’entrepôt. |
| Commerce | Préparer la vente, choisir un circuit, gérer les annonces et consulter les commandes. | Catalogue de matériel et comptabilité détaillée. |
| Entrepôt | Aménager, augmenter la capacité, acheter et entretenir le matériel. | Deuxième interface complète de vente. |
| Finances | Disponible, obligations, échéances et financement. | Second écran de pilotage de boutique. |

Commerce peut être organisé autour de trois intentions : **Vendre · Annonces et commandes · Développer**. Sa synthèse devient un résumé court au-dessus du travail. Les demandes clients contextualisent le choix du lot et du circuit ; leur consultation complète reste accessible. Développer contient les investissements, le site, la marque et la promotion, regroupés par projet plutôt que dans une troisième navigation permanente.

Harmoniser immédiatement les noms : « Packs de cartes » pour l’acquisition de cartes, « Acheter du matériel » pour l’équipement et « Ma boutique en ligne » pour le commerce du joueur. Conserver les noms de lieux dans les scènes avec leur fonction explicite, par exemple « Banque · prêts et placements ».

**10. La fiche de récolte comme fil conducteur**

Une fiche identifiable doit accompagner la production depuis la fin de culture jusqu’à sa vente. Elle garde le même nom, l’illustration pertinente, la quantité, la qualité actuelle et l’état. Elle explique la prochaine action sans demander au joueur de connaître l’architecture du village.

Exemples d’états : à évaluer, en affinage, prête à préparer, préparée, partiellement en vente, vendue. Lorsque plusieurs quantités coexistent, la fiche indique leurs parts réelles ; elle ne force pas un statut unique trompeur. Transformer ou fractionner un lot conserve la filiation entre la récolte initiale et les produits obtenus.

Le parcours commercial existant lot → préparation → circuit → confirmation fournit déjà une base. La refonte doit le rendre unique, lui transmettre le bon lot et maintenir le contexte après achat de matériel, consultation d’une demande ou retour arrière.

Pour une annonce, réunir prix actuel, quantité restante, état, estimation et commandes réalisées. « Modifier le prix » ouvre un seul panneau, avec suggestions, saisie manuelle et conséquences. Les estimations restent visuellement et textuellement séparées des recettes réellement reçues. Une action destructive comme jeter les paquets garde sa confirmation et une importance visuelle secondaire.

Les liens doivent pouvoir rouvrir le lot, l’annonce et la sous-section utiles. Le bouton de retour annonce sa destination ; un lien vers Quartier reste un accès distinct. La recommandation du Quartier doit arriver à la bonne étape, pas seulement à la vue d’ensemble de Commerce.

**11. Priorités et effort relatif**

Les tailles ci-dessous indiquent une complexité relative, pas un engagement de délai.

| Priorité | Changement | Impact attendu | Effort |
| --- | --- | --- | --- |
| P1 | Même avertissement de remise à zéro dans les deux changements de prix | Décision mieux comprise ; conséquence annoncée partout. | Petit |
| P1 | Commerce dans la barre mobile ; Réseaux dans Plus | Boucle principale directement accessible. | Petit |
| P1 | Harmoniser Boutique/Commerce/Matériel et les titres répétés | Moins de traductions mentales. | Petit à moyen |
| P1 | Unifier la fiche annonce et ses outils de prix | Suppression d’un vrai doublon de gestion. | Moyen |
| P1 | Un seul parcours de transformation et vente | Localisation prévisible de l’action. | Moyen |
| P1 | Retirer l’entrepôt complet embarqué dans Récoltes | Frontières d’activité plus claires. | Moyen |
| P1 | Simplifier les écrans vides et placer les annonces avant les bilans | Réduction de la lecture et du défilement avant action. | Moyen |
| P2 | Fusionner Activité et la synthèse de Commerce | Suppression d’un écran de supervision concurrent. | Moyen |
| P2 | Fiche lot persistante et conservation du contexte | Continuité de la culture à la vente. | Important |
| P2 | Projet personnel transversal et apprentissage contextuel | Priorité de session plus lisible. | Important |
| P2 | Échéances en temps réel et résumé de reprise | Retour au jeu plus prévisible. | Moyen |
| P3 | Séparer évaluation et duel ; examiner récompenses et protection débutant | Spécialisations mieux choisies, équité à vérifier. | Important, simulation nécessaire |

Commencer par l’information critique et les noms. Centraliser ensuite les workflows avant d’affiner leurs écrans. Valider la nouvelle boucle avant d’introduire des changements d’économie ou de compétition. Cette séquence évite de polir des interfaces destinées à être réunies.

**12. Validation avec de vrais joueurs**

Prévoir un premier cycle exploratoire avec cinq nouveaux joueurs adultes, puis quelques joueurs habitués. Ce groupe sert à repérer des problèmes de compréhension ; il ne suffit pas à établir une amélioration statistique de rétention. Utiliser des comptes de test et des scénarios représentatifs, notamment une boutique vide, plusieurs lots et une échéance proche.

| Tâche | Ce qu’il faut observer |
| --- | --- |
| Entrer dans le jeu et lancer une culture | Le joueur trouve-t-il une action principale sans recevoir l’explication de toute la navigation ? |
| Reprendre après une journée | Identifie-t-il ce qui a changé, ce qui est urgent et son projet ? |
| Présenter une récolte | Peut-il expliquer ce qui est consommé et ce qui reste disponible ? |
| Protéger un surplus | Comprend-il quantité, capacité et échéance avant validation ? |
| Vendre un lot précis | Retrouve-t-il le bon lot sans passer par plusieurs gestionnaires concurrents ? |
| Modifier son prix | Trouve-t-il l’annonce et comprend-il la conséquence sur la prochaine commande ? |
| Lire un résultat de vente | Distingue-t-il chiffre d’affaires, versement en trésorerie et bénéfice ? |
| Choisir une amélioration | Comprend-il son coût, ses prérequis et l’effet attendu ? |

Mesurer la réussite sans aide, le premier clic, les erreurs de destination, les retours arrière, le temps de recherche et la capacité à reformuler coûts et conséquences. Conserver les mêmes tâches et états pour comparer avant/après.

Critères de conception à tester : état et prochaine action repérables en quelques secondes ; même action retrouvée au même endroit ; aucune conséquence critique enfouie ; absence de troisième navigation nécessaire pour vendre ou modifier une annonce ; fonctionnement à 320 pixels et au clavier. Ne fixer une cible chiffrée de progression ou de rétention qu’après une mesure initiale.

**13. Traces de l’observation et limites techniques**

- [Observations des 22 états](../../tmp/design-audit-2026-10-29/observations.json) : aucune erreur JavaScript ni débordement horizontal relevé dans cette capture ciblée.
- [Quartier à 320 pixels](../../tmp/design-audit-2026-10-29/quartier-starter-320-viewport.png) : prochaine action visible, carte et barre mobile.
- [Commerce avec deux rayons vides à 390 pixels](../../tmp/design-audit-2026-10-29/commerce-empty-390-full.png) : empilement des synthèses et états vides.
- [Mes ventes à 320 pixels](../../tmp/design-audit-2026-10-29/commerce-suivi-320-full.png) : informations précédant le registre d’annonces.
- [Développement sur ordinateur](../../tmp/design-audit-2026-10-29/commerce-developper-1440-viewport.png) : navigation Commerce et sous-onglets de gestion.
- [Culture à 390 pixels](../../output/placard-contextual-headers/header-game-390.png) : situation, dés et action dominante.

Les fichiers de capture sont locaux et peuvent être ignorés par Git. Leur bandeau de démonstration ne fait pas partie du jeu. Le contrôle existant des en-têtes a également été exécuté ; il échoue sur les scénarios de stockage parce que leur donnée simulée ne fournit pas la structure `storage.capacity` attendue. Cet échec ne permet pas de conclure à un défaut du stockage en production. Aucun succès global de recette n’est revendiqué.

Repères précis pour la réalisation : `KqPlacardNavigation.tsx:13-27` pour les destinations ; `KqMarketHub.tsx:14-20` pour les rubriques ; `KqOnlineBusiness.tsx:18-24` pour les sous-onglets ; `KqWarehouse.tsx:711` pour le second parcours de vente ; `KqOnlineStore.tsx:50-56` et `KqShopTycoon.tsx:164` pour les prix ; `KqOnlineStore.tsx:181-207` pour l’ordre des mesures ; `PlacardPlayerShell.tsx:286-302` pour titres et retours. Les numéros correspondent à l’état local examiné le 29 octobre 2026.

**14. Première refonte réalisée : Récoltes → Commerce → annonce**

Cette première étape est implémentée dans le dépôt local. Elle traite les doublons et la continuité du parcours commercial, avec les matériaux papier et les illustrations du Quartier. Les notes ci-dessus restent celles du diagnostic initial : aucun test avec de vrais joueurs ne justifie encore une nouvelle note.

| Zone | Changement réalisé | Effet concret |
| --- | --- | --- |
| Navigation | Barre mobile : Quartier, Culture, Récoltes, Commerce, Plus. Réseaux reste accessible dans Plus. Le magasin de cartes s’appelle Packs de cartes. | Le débouché de la récolte est directement accessible ; achat de packs et gestion commerciale ont des noms distincts. |
| Commerce | Trois destinations principales : Vendre, Annonces et commandes, Développer. Synthèse accessible séparément ; demandes clients accessibles dans leur contexte. | L’entrée décrit la tâche à effectuer. |
| Synthèse | Prochaine action, trois chiffres utiles, demandes ; analyses secondaires repliées. | La boutique vide évite l’empilement des tableaux sans activité. |
| Récoltes | Stockage affiche les lots, leur quantité, leur qualité, leur affinage et les actions de conservation. | L’entrepôt complet n’est plus embarqué dans cette page. |
| Entrepôt | Contenants, capacité, climat et machines ; liens vers le lot ou la préparation dans Commerce. | L’Atelier n’héberge plus un second parcours de transformation et vente. |
| Annonces | Liste et actions avant bilan ; un éditeur de prix commun avec suggestions et saisie libre. | Le joueur gère le prix depuis son annonce. |
| Confirmation du prix | Remise à zéro de la progression vers la prochaine commande explicitée ; ventes passées conservées. | La conséquence de l’action est visible avant validation. Le simulateur d’apprentissage applique aussi cette règle. |
| Développer | Site, Studio, Merch, Promouvoir ; les anciens accès aux prix renvoient à l’annonce. | Suppression des outils de prix concurrents. |
| Continuité | Lot et annonce transmis par les liens ; retour au lot après visite du matériel ; sélection conservée lors des changements de rubrique et des retours navigateur. | Le joueur retrouve l’objet sur lequel il agissait. |
| Apprentissage | Les essais réutilisent les mêmes destinations et conservent leur contexte de simulation. | Les gestes appris correspondent au parcours du jeu. |

La synthèse vide mesure désormais **953 px à 390 px de largeur**, contre 3 089 px dans la capture initiale. Cette comparaison de deux démonstrations locales indique la réduction de densité ; elle ne mesure ni le temps de recherche réel ni la rétention. Les confirmations, coûts, prérequis et données manquantes restent explicites.

Vérifications réalisées : contrôle TypeScript, ESLint sur les fichiers modifiés, 170 tests unitaires ciblés, audit Commerce à 320/390/1440 px, 163 vérifications du stockage à quatre largeurs et parcours Récoltes → Stockage → Entrepôt → retour au lot. L’audit de navigation du shell passe à 320 et 1440 px, avec 19 scénarios supplémentaires et aucune erreur JavaScript. Les essais navigateur couvrent notamment la saisie et l’annulation d’un prix, le lot ciblé, les erreurs de chargement, les offres partielles et l’absence de double mutation.

Traces locales :

- [Synthèse Commerce à 390 px](../../output/commerce-simplification/empty-390.png) et [annonce à 320 px](../../output/commerce-simplification/pricing-320.png).
- [Lots et conservation à 320 px](../../output/storage-density/after-first-lots-320.png).
- [Résultats Commerce](../../output/commerce-simplification/results.json), [résultats stockage](../../output/storage-density/after-report.json) et [parcours Récoltes](../../output/placard-harvests-navigation/harvests-report.json).
- [Navigation du Quartier et retours contextuels](../../output/placard-navigation/report.json).

Cette réalisation ne clôt pas les chantiers de projet personnel transversal, de résumé de reprise, de progression de l’apprentissage, de filiation complète des produits transformés ou d’équilibrage du jury et des duels. Ils demandent une conception et une validation distinctes. Les essais utilisent des données locales : aucune mise en production ni validation de transactions sur un compte réel n’est revendiquée. L’ancien scénario complet de test Packs/panier reste obsolète ; seul son mode Récoltes a été validé pour ce parcours.

**15. Ajustement du stockage après retour utilisateur**

L’onglet Stockage de l’Entrepôt commence désormais par le stock, les contenants installés/occupés/libres et les lots identifiés par variété. Il réutilise le même gestionnaire que Récoltes. Les aménagements et le climat viennent ensuite ; l’explication et le comparatif des gammes sont repliés en bas. Ce retour utilisateur remplace le choix précédent de ne montrer que les installations dans cet onglet.

Chaque lot dispose d’un choix précis de modèle de contenant. Le serveur calcule le nombre nécessaire pour accueillir tout le lot et refuse une disponibilité insuffisante. La confirmation indique le rangement proposé et la libération des anciens contenants, sans achat. Deux lots, même de la même variété, ne partagent pas un contenant. Le déplacement préserve l’affinage acquis et les échéances ; les contenants des autres récoltes et la place réservée aux cultures ne sont pas détournés.

Validation : TypeScript et ESLint réussis, 109 tests ciblés dont 7 transactions PostgreSQL exécutées avec PGlite, contrôle des permissions Supabase et [98 vérifications navigateur](../../output/storage-placement/report.json) à 320/390/1440 px. [Aperçu du stockage à 320 px](../../output/storage-placement/warehouse-320.png).

L’action serveur `place` utilise la migration [20261029000100_kq_storage_exact_placement.sql](../../supabase/migrations/20261029000100_kq_storage_exact_placement.sql), créée et testée localement, puis appliquée à la base distante le 29 octobre 2026 avec le parcours d’affinage avant jury décrit en section 17.

**16. Clarification du stock en vrac et des paquets**

Un second retour utilisateur a révélé une erreur du résumé : avec les zones physiques, `capacity.usedUnits` contient tout le stock invendu, y compris les paquets. Il ne représente pas uniquement la quantité protégée dans les contenants. L’addition du surplus à ce total pouvait également compter ce surplus deux fois.

Le résumé utilise désormais une ventilation explicite du serveur : stock total, vrac en contenants, paquets préparés et vrac sans contenant. Les paquets sont distingués selon les annonces actives, en pause ou fermées/bloquées. Les volumes restent tous en équivalent fleurs. Les paquets occupent de la place dans l’entrepôt sans occuper les bocaux ou fûts du tableau. Les libellés de capacité globale ont été corrigés dans les autres écrans de stockage.

Le scénario local de 735 g entièrement emballés affiche 735 g au total, 0 g en contenants et 735 g emballés, avec le statut réel des annonces. Sans ventilation serveur, l’écran signale les quantités indisponibles : il ne déduit pas un stock en vente d’un simple écart de compteurs. Validation : 174 tests ciblés, dont 6 tests PostgreSQL PGlite, et 170 vérifications navigateur à trois largeurs. [Aperçu du scénario à 390 px](../../output/storage-placement/stock-packed-390.png).

La migration [20261029000200_kq_storage_stock_breakdown.sql](../../supabase/migrations/20261029000200_kq_storage_stock_breakdown.sql) fournit cette ventilation. Elle a été appliquée le 29 octobre 2026 au projet Supabase lié `eyowwwpdmfrulhkpvlnf`, après autorisation de l’utilisateur. Le déploiement isolé ne contenait que cette migration : la simulation préalable, l’application et la vérification de l’historique distant ont réussi. Une seconde simulation confirme que ce lot est à jour. [Historique après application](../../output/storage-stock-breakdown-migration/migration-history-after.txt). La migration de rangement a été appliquée ensuite avec le changement de cycle décrit ci-dessous.

**17. Affinage avant le jury**

Le parcours suit désormais cet ordre : **récolte → stockage et curing → jury → vente**. La récolte rejoint les contenants dès sa création. Le joueur peut choisir le rangement de chaque lot, identifié par variété. Les six heures réelles existantes commencent à ce moment et avancent hors connexion. Le serveur interdit une présentation au jury avant maturité ; le bouton de présentation apparaît au terme de l’affinage. Le verdict ne redémarre pas les six heures.

La conservation acquise est intégrée aux statistiques présentées au jury, puis figée lors de l’engagement. L’aperçu avant présentation utilise le même calcul, sans enregistrer de verdict. La qualité commerciale après jury ne réapplique pas ce bonus ; elle tient compte des évolutions ultérieures de conservation. Aucun surplus n’est vendu avant le verdict. Les réservations de capacité ne comptent pas deux fois une récolte en attente de jury déjà présente dans le stockage.

Les fins de culture, campagnes, listes de récoltes, écrans de stockage, badges de cartes et conseils du Quartier conduisent à la bonne étape. La qualité avant jury est indiquée comme estimée. Les compteurs « prêts pour le jury » et « en affinage » sont calculés avec l’heure de la base. Les tutoriels suivent le même ordre avec six heures fictives et transmettent le lot affiné à Commerce sans le recréer.

Les verdicts et lots déjà stockés conservent leurs échéances. Les duels déjà engagés suivent leur cycle initial. Les anciennes récoltes encore disponibles, sans lot de stockage, démarrent les six heures lors de la mise à jour : leur protection passée ne peut pas être reconstituée.

Validation : TypeScript, ESLint ciblé et contrôle des permissions sur 347 migrations réussis ; tests du serveur et des états de récolte, 7 tests SQL du nouveau cycle, 223 tests de tutoriels, [206 contrôles navigateur du stockage](../../output/storage-placement/report.json) et [23 scénarios jury](../../output/ux-implementation/jury/results.json). Les scénarios couvrent 320, 390 et 1440 px, le clavier, l’absence de vente avant verdict et le passage à maturité confirmé par le serveur. [Aperçu du stockage avant jury à 390 px](../../output/storage-placement/pre-jury-curing-390.png).

Les migrations `20261029000100` et [20261029000300_kq_curing_before_jury.sql](../../supabase/migrations/20261029000300_kq_curing_before_jury.sql) ont été appliquées au projet lié après une simulation ne listant que ces deux fichiers. L’[historique distant](../../output/curing-before-jury/migration-history-after.txt) les confirme ; une seconde simulation indique une base à jour. Le nouveau compteur a également été [vérifié en lecture seule](../../output/curing-before-jury/api-verification.json), via le rôle serveur et un identifiant fictif sans données de joueur. Aucun déploiement de l’application web n’est revendiqué ici.
