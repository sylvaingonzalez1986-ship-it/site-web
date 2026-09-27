# Clarté du Placard — proposition du 27 septembre 2026

Statut : mise en œuvre et validation locale terminées, avec ajustement de l’entrepôt après retour utilisateur. La migration de l’atelier commun reste à appliquer à la base distante avant le déploiement du code serveur.

Contrainte confirmée : préserver la place des illustrations, des personnages et des lieux, notamment le banquier. La simplification porte sur les commandes, les textes et les niveaux de navigation.

## Diagnostic

Le Placard manque surtout de hiérarchie entre les activités, les outils de gestion et les informations de progression. La richesse du jeu peut être conservée en donnant à chaque élément une place plus prévisible.

Le diagnostic ci-dessous décrit l’état initial du code local, y compris les changements de production à plusieurs tentes. Le dernier retour utilisateur précise que les machines de transformation doivent être communes : cette règle est intégrée à la réalisation et aux audits locaux.

### Accueil

- Sept destinations ont le même poids : Entrepôt, Culture, Marché, Trésorerie, Boutique, Duels, Missions. Un clic sélectionne la destination ; un second bouton permet d’y entrer. Avec Collection, retour Arène et progression, l’accueil comporte onze commandes avant ouverture des détails.
- Le titre, la description et le décor changent lors de cette sélection. Il faut comprendre le fonctionnement du sélecteur avant de naviguer.
- La recommandation utile « que faire maintenant ? » est rangée dans « Mon atelier & ma progression ». Son ouverture ajoute un tableau de bord avec quatre onglets et une autre navigation Culture / Jury / Vente.
- Les noms varient : Culture / Le Jeu ; Entrepôt / Atelier ; Marché / Comptoir ; Trésorerie / Bureau. Le joueur doit reconnaître plusieurs appellations pour une même destination.

Sources : [accueil](../../src/components/placard/KqPlacardLobby.tsx), [styles](../../src/components/placard/KqPlacardLobby.module.css), [tableau de bord](../../src/components/placard/KqPlacardHud.tsx), [navigation](../../src/components/placard/PlacardPlayerShell.tsx).

### Écrans internes

- Pendant une culture, les projections, l’Héritage, les défis et plusieurs explications précèdent la situation et les dés. Sur mobile, Situation, Main et Dés sont distribués dans des onglets différents : une seule décision oblige à naviguer entre plusieurs vues.
- L’entrepôt juxtapose sélection de tente, groupes, scène interactive, emplacements et fiche de matériel. Plusieurs éléments servent à sélectionner le même objet.
- La boutique réunit deux intentions : acheter du matériel et obtenir des cartes.
- La trésorerie superpose pôles, dossiers comptables et guichets. Les informations utiles à une décision immédiate sont proches des outils de consultation avancée.
- Le marché actif utilise déjà un parcours progressif lot → préparation → circuit → confirmation, avec des détails repliés. Cette base est à conserver. Le composant actif est `KqCommerceDesk`, réexporté par `KqMarketDesk` ; le code historique de ce dernier ne décrit pas l’écran courant.

Sources : [culture](../../src/components/placard/KanabQuestDicePrototype.tsx), [entrepôt](../../src/components/placard/KqEquipmentInventoryModal.tsx), [boutique](../../src/components/placard/KqSupportBoosterShop.tsx), [trésorerie](../../src/components/placard/KqTreasuryDesk.tsx), [commerce actif](../../src/components/placard/KqCommerceDesk.tsx).

## Direction commune avec l’Arène

L’Arène actuelle repose sur une scène unique, trois activités directement cliquables, des phrases courtes et des outils secondaires discrets. Le guide s’ouvre à la demande.

Reprendre ses cartes dorées, le texte vert sombre, les titres clairs, les espacements et les états de survol/focus. Sur ordinateur, une rangée de cartes ; sur mobile, une colonne. Les anciennes captures à cartes crème ne représentent plus la palette courante.

Références : [composant Arène](../../src/components/contest/ContestArenaHub.tsx), [styles actuels](../../src/components/contest/ArenaHome.module.css), [capture dorée mobile](../../output/arena-gold/returning-390.png).

### Des lieux et des personnages qui restent au premier plan

Chaque espace conserve sa propre scène et son identité. L’illustration stable proposée pour l’accueil concerne cet accueil ; entrer dans le Bureau, la Boutique ou l’Entrepôt fait bien découvrir le lieu correspondant.

- **Le Bureau et son banquier** : conserver les illustrations des pôles et la présence du banquier dans l’espace Banque. Son bureau forme le cadre de la décision : une courte phrase d’accueil, les informations utiles, puis l’action choisie. Le personnage garde une place importante dans la composition.
- **La Boutique et Sylvain au comptoir** : conserver la scène de boutique, ses packs et son livre de matériel. Les accès contextuels depuis Collection ou Aménager conduisent au contenu concerné tout en gardant l’identité du lieu.
- **L’Entrepôt** : conserver la pièce illustrée et le matériel installé comme vue principale. Cliquer un emplacement ouvre sa fiche ; la liste sert de vue alternative accessible.
- **La culture et le jury** : conserver les situations illustrées, les personnages et les réactions aux résultats. Les informations secondaires se replient autour de ces moments de jeu.

Une scène lisible accueille un panneau d’action à la fois. Les illustrations existantes servent de base. Les noms de lieux restent visibles, accompagnés d’un repère fonctionnel constant : « Le Bureau · Trésorerie », « La Boutique · Cartes et matériel ».

Sur ordinateur, scène/personnage et panneau d’action peuvent être côte à côte. Sur mobile, un cadrage adapté conserve le personnage et les éléments caractéristiques du lieu, avec les commandes immédiatement à proximité. Vérifier que le banquier, Sylvain et les éléments interactifs restent reconnaissables et ne sont pas recouverts par les panneaux.

La cohérence avec l’Arène repose ainsi sur une même association entre illustration généreuse et choix clairement hiérarchisés.

## Accueil proposé

Trois accès principaux, chacun ouvert en un clic :

| Entrée | Description courte | Contenu et état utile |
| --- | --- | --- |
| **Cultiver** | Fais grandir ta prochaine récolte. | Préparation et culture. Le libellé devient « Reprendre ma culture » si une partie est en cours ; l’étape s’affiche dans la carte. |
| **Aménager** | Équipe et entretiens tes tentes. | Entrepôt, matériel, améliorations, entretien et agrandissement. Résumé du nombre de tentes et alerte éventuelle. |
| **Vendre** | Transforme et vends tes récoltes. | Marché et accès clairement nommé « Trésorerie ». Résumé des lots prêts ou de la prochaine condition à remplir. |

Sous ces trois cartes, une ligne secondaire stable : **Jury & duels · Missions · Collection**. Ces accès restent explicites, y compris pour un joueur qui revient uniquement faire un duel ou récupérer une récompense.

En haut : retour Arène, titre « Le Placard », Aide discrète. Une illustration stable laisse respirer l’accueil. Les badges signalent seulement une action en attente.

```text
← L’Arène                    Aide
LE PLACARD

[ Illustration unique ]

REPRENDRE MA CULTURE       →
Étape 3 sur 6

AMÉNAGER                  →
4 tentes · culture commune

VENDRE                    →
2 lots prêts

Jury & duels · Missions · Collection
```

Exemple de contenu fictif, à adapter à l’état réel du joueur. Les cartes conservent leur ordre ; leur description rend la prochaine action visible. La recommandation du tableau de bord doit être réutilisée sans ajouter un nouveau grand panneau ni un bouton qui double la carte.

### Destination des fonctions existantes

| Fonction actuelle | Place proposée |
| --- | --- |
| Culture | Carte Cultiver |
| Entrepôt et inventaire | Carte Aménager |
| Achat de matériel | Depuis Aménager et la fiche de l’équipement concerné ; accès au catalogue dans l’univers de la Boutique |
| Packs La Botte | Depuis Collection et après obtention d’une récompense ; conserver Sylvain et la scène de Boutique |
| Marché | Carte Vendre |
| Trésorerie, banque, gestion | Accès « Le Bureau · Trésorerie » dans Vendre et depuis un coût ou une facture ; conserver les scènes du Bureau et du banquier |
| Fleurs, jury et duels | Lien Jury & duels ; raccourci après récolte |
| Missions | Lien Missions avec badge si récompense disponible |
| Tableau de bord | États courts dans les cartes ; détails répartis dans leur espace pertinent |

Le jury et les duels doivent conserver une distinction explicite. Lorsqu’un lot attend un verdict, indiquer cette condition et proposer l’accès correspondant. Réorganiser la navigation ne doit ni contourner le jury ni engager automatiquement une Fleur dans un duel.

## Simplification des écrans de travail

### Cultiver

Afficher d’abord l’étape, la situation, l’objectif du lancer et l’action courante. Sur mobile, situation résumée et dés appartiennent au même flux. Les cartes jouables restent accessibles près de la décision ; leur utilisation est facultative.

Mettre rendement détaillé, défis, historique et règles dans des panneaux à la demande. Un Héritage passif devient un résumé compact ; son pouvoir prend de la place uniquement lorsqu’il est utilisable. Les effets des cartes, avertissements de perte et conséquences de la validation restent visibles au moment de décider.

Sur mobile, une barre d’action peut donner accès à Lancer / Valider / Continuer si nécessaire, sans accumuler plusieurs boutons principaux concurrents dans la même vue.

### Aménager

Afficher **les tentes côte à côte dans une seule pièce illustrée**, avec une fiche pour la sélection courante. Passer de la première à la deuxième tente se fait directement dans l’image, sans remplacer la scène. Les quatre emplacements restent au même endroit à mesure des agrandissements ; huit tentes occupent deux travées du même panorama, sans page supplémentaire.

Chaque tente garde son modèle, son éclairage et son extraction. Le premier plan présente un **Atelier commun** : tamisage, lavage, filtration, séparation statique, presse et lyophilisateur s’achètent une seule fois pour toutes les tentes. Ces machines restent en place lorsqu’on sélectionne une autre tente. Le décor est dégagé et les objets suivent une échelle commune : accessoires dans l’ouverture, petites machines sur l’établi, machines hautes au sol. Le nouveau [fond illustré](../../public/placard/warehouse-v3/room.webp) conserve le style du précédent ; le [prompt final et l’outil intégré utilisés](../../public/placard/warehouse-v3/PROMPT.md) sont documentés.

Dans la fiche : état, effet utile, coût et action pertinente — acheter, installer, améliorer ou entretenir. La scène et son zoom restent en place quand on sélectionne une autre tente ; les états et opérations de matériel restent attachés à la bonne tente. Une liste sert d’alternative accessible, sans doubler les sélecteurs dans la vue illustrée.

La culture est commune. Le matériel de culture, ses niveaux et son usure sont propres à chaque tente ; les machines de transformation, leurs niveaux et leur entretien sont partagés. La boutique nomme la destination de chaque article, y compris dans un panier mixte. Afficher « 4 tentes · culture commune » sur l’accueil ; réserver le détail à Aménager. Ne jamais suggérer que chaque tente lance une partie indépendante. Voir [production multiple](PLACARD-PRODUCTION-MULTIPLE.md).

### Vendre et consulter ses comptes

Conserver le parcours progressif du commerce actuel. Mettre en premier le lot, le montant obtenu, les coûts et les conditions qui empêchent une vente. Les barèmes et explications restent disponibles en détail.

Dans le Bureau, conserver les scènes illustrées de chaque pôle, notamment celle du banquier. Privilégier solde, échéance et action attendue dans le panneau associé à la scène. Les comptes détaillés, financements, placements et outils de gestion restent accessibles dans des rubriques explicites.

### Navigation et vocabulaire

Associer systématiquement lieu et fonction : « Le Placard » désigne l’espace ; « Cultiver » désigne l’activité ; « Entrepôt » désigne l’installation ; « Le Bureau · Trésorerie » identifie les comptes. Les noms de lieux gardent leur place dans les titres. Distinguer « Boutique La Botte » et le site de vente du joueur.

Les écrans internes utilisent un en-tête de navigation compact : retour au Placard, titre courant et outil nécessaire. Chaque lieu conserve une illustration généreuse, composée avec les commandes pour rendre le personnage et l’action accessibles ensemble.

## Ordre de réalisation et critères

1. Refaire l’accueil et ses accès directs, normaliser les noms, répartir les fonctions du tableau de bord. Préserver les scènes et personnages des destinations, les liens profonds existants et le retour navigateur.
2. Rendre le tour de culture lisible sur mobile, puis simplifier l’entrepôt en tenant compte des tentes individuelles.
3. Ajuster les accès Trésorerie, Collection et récompenses ; conserver les parcours déjà progressifs du commerce et des missions.

Vérifier aux largeurs 320, 390, 768 et 1440 px : accès principaux en un clic, absence de débordement, focus clavier visible, aucune modale spontanée, aucune information de décision masquée. Couvrir débutant, culture en cours, Fleur en attente de jury, lots à vendre, équipement usé et plusieurs tentes.

Inclure une revue visuelle du Bureau/Banque, de la Boutique et de l’Entrepôt à ces largeurs : personnages reconnaissables, décors préservés, commandes lisibles, aucune accumulation de panneaux sur les illustrations.

La réussite attendue : dès l’arrivée, le joueur distingue ce qu’il peut faire maintenant, où gérer son installation et où retrouver ses fonctions secondaires.

## Réalisation et validation locale

- Accueil à trois accès directs, historique navigateur et liens vers équipement préservés ; objectifs disponibles dans Missions, achats de packs depuis Collection.
- Situation et dés réunis dans le parcours de culture mobile ; main et informations secondaires repliables, avertissements de décision conservés.
- Bureau et banque conservés avec leur personnage ; dossiers comptables regroupés et lien Trésorerie explicite depuis le marché.
- Entrepôt persistant, tentes côte à côte, atelier de transformation commun, une fiche active ; vue liste disponible et agrandissement accessible depuis le prochain emplacement libre.

Les audits navigateur utilisent les composants réels avec des réponses API locales simulées, aux largeurs 320, 390, 768 et 1 440 px. Ils vérifient la disposition, l’absence de débordement, la navigation, la sélection, les achats mixtes et les réponses retardées. Rapports dans `output/placard-clarity`, `output/placard-culture-clarity`, `output/placard-treasury`, `output/placard-warehouse-clarity` et `output/placard-shared-catalog`.

La nouvelle migration d’atelier commun est vérifiée dans PGlite, sans réseau : canonisation des machines, conservation des soldes et reçus, achats atomiques, rejeu des requêtes, entretien commun et compatibilité des anciennes cultures. Les fonctions externes de calendrier et de comptabilité utilisent les fixtures du test de production ; les migrations de matériel et les observateurs d’actifs sont exécutés. TypeScript, ESLint et le contrôle des permissions Supabase complètent la validation.

Pour revoir uniquement l’entrepôt avec des données de démonstration : `node scripts/audit-placard-warehouse-clarity.mjs --preview`, puis `http://127.0.0.1:3241/?units=2` (également `units=4` ou `units=8`). Cette prévisualisation est distincte du compte joueur. Le site Next.js local existant reste sur le port 3000 ; ses opérations réelles d’atelier commun nécessitent la nouvelle migration, qui n’a pas été appliquée à la base distante.

La retouche des proportions prend en compte les ensembles illustrés complets, supports et pompes compris : la presse est agrandie, la filtration et le lyophilisateur rééquilibrés, le séparateur haut réduit. Le tamisage et la presse reposent sur le plateau à 68,2 % de la hauteur du décor ; les quatre machines au sol partagent un appui à 89 %. Les ombres de contact de l’établi sont distinctes de celles du sol. Les images gardent leurs proportions natives et leur taille reste identique quel que soit le niveau d’amélioration.

La validation utilise uniquement les données locales de démonstration ; aucune migration distante n’est exécutée par ces audits.
