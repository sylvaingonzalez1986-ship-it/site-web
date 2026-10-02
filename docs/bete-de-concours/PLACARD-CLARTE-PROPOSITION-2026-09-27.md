# Clarté du Placard — proposition du 27 septembre 2026

Statut : mise en œuvre et validation initiale terminées, avec ajustement de l’entrepôt puis de l’accueil après retour utilisateur. Le 28 septembre, le Bureau devient un secteur autonome et les six accès aux secteurs adoptent les encarts jaunes. La migration de l’atelier commun a été appliquée le 27 septembre ; celle des crédits de commandes le 28 septembre.

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

Une scène lisible accueille un panneau d’action à la fois. Les illustrations existantes servent de base. Les noms de lieux restent visibles : « Bureau » désigne le secteur des comptes, de la banque et de la gestion ; « La Boutique · Cartes et matériel » garde son repère fonctionnel.

Sur ordinateur, scène/personnage et panneau d’action peuvent être côte à côte. Sur mobile, un cadrage adapté conserve le personnage et les éléments caractéristiques du lieu, avec les commandes immédiatement à proximité. Vérifier que le banquier, Sylvain et les éléments interactifs restent reconnaissables et ne sont pas recouverts par les panneaux.

La cohérence avec l’Arène repose ainsi sur une même association entre illustration généreuse et choix clairement hiérarchisés.

## Accueil ajusté — 28 septembre 2026

Six encarts jaunes de même importance, chacun ouvert en un clic :

| Entrée | Description courte | Contenu et état utile |
| --- | --- | --- |
| **Cultiver** | Fais grandir ta prochaine récolte. | Préparation et culture. Le libellé devient « Reprendre ma culture » si une partie est en cours ; l’étape s’affiche dans la carte. |
| **Aménager** | Équipe et entretiens tes tentes. | Entrepôt, matériel, améliorations, entretien et agrandissement. Résumé du nombre de tentes et alerte éventuelle. |
| **Vendre** | Transforme et vends tes récoltes. | Marché, lots prêts et prochaine condition à remplir. |
| **Bureau** | Tes factures, tes comptes et ton banquier. | Secteur autonome de comptabilité, banque et gestion. |
| **Jury & duels** | Présente tes Fleurs et relève les défis. | Fleurs disponibles, verdicts et combats. |
| **Collection** | Tes cartes, tes Héritages et tes packs. | Collection La Botte et accès aux packs. |

Sous les six cartes, **Missions** reste le seul accès secondaire. Le Bureau possède son entrée directe et son propre titre ; il n’est plus une entrée globale du Marché. Le raccourci métier vers la création ou la réactivation d’un site de vente reste disponible quand cette action est nécessaire.

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

BUREAU                    →
Comptes, banque et gestion

JURY & DUELS              →
Fleurs disponibles

COLLECTION                →
Cartes, Héritages et packs

Missions
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
| Trésorerie, banque, gestion | Carte Bureau, indépendante du Marché ; conserver les scènes du Bureau et du banquier |
| Fleurs, jury et duels | Carte Jury & duels ; raccourci après récolte |
| Collection | Carte Collection ; accès aux packs depuis la collection |
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

Toutes les tentes affichent le même modèle, le même éclairage et la même extraction, acquis une seule fois. Le premier plan présente un **Atelier commun** : tamisage, lavage, filtration, séparation statique, presse et lyophilisateur. Ces machines, le solaire, la sécurité et le séchoir restent à leur place lorsqu’on sélectionne une autre tente. Le décor est dégagé et les objets suivent une échelle commune : accessoires dans l’ouverture, petites machines sur l’établi, machines hautes au sol. Le nouveau [fond illustré](../../public/placard/warehouse-v3/room.webp) conserve le style du précédent ; le [prompt final et l’outil intégré utilisés](../../public/placard/warehouse-v3/PROMPT.md) sont documentés.

Dans la fiche : état, effet utile, coût et action pertinente — acheter, installer, améliorer ou entretenir. La scène et son zoom restent en place quand on sélectionne une autre tente. Le récapitulatif reste discret sous l’image, replié par défaut : on l’ouvre, puis on déplie la tente souhaitée pour retrouver ses sept emplacements, modèles, niveaux et états, avec un accès direct à la bonne fiche. Le fond crème et les textes sombres remplacent le fond vert dans ce récapitulatif, le bilan et l’agrandissement. Les lignes sont distinctes, avec des noms de modèle en 14 px et des catégories et états en 12 px. Des badges colorés avec un libellé explicite distinguent les équipements installés, les essentiels manquants, les options non installées, la réserve disponible et le matériel hors service.

La culture reste commune, mais seules les machines de transformation sont partagées. Tout le reste s’achète et s’installe pour la tente choisie, avec ses propres niveaux et son usure. La boutique précise la destination de chaque article et conserve les paniers de chaque tente ; les machines communes ont un panier partagé. L’atelier de transformation possède son propre volet repliable dans le récapitulatif. Les prochaines tentes reçoivent un kit de départ. Afficher « 4 tentes · culture commune » sur l’accueil ; réserver le détail à Aménager. Voir [production multiple et migration du 1er octobre](PLACARD-PRODUCTION-MULTIPLE.md).

### Vendre et consulter ses comptes

Conserver le parcours progressif du commerce actuel. Mettre en premier le lot, le montant obtenu, les coûts et les conditions qui empêchent une vente. Les barèmes et explications restent disponibles en détail.

Dans le Bureau, conserver les scènes illustrées de chaque pôle, notamment celle du banquier. Privilégier solde, échéance et action attendue dans le panneau associé à la scène. Les comptes détaillés, financements, placements et outils de gestion restent accessibles dans des rubriques explicites.

### Navigation et vocabulaire

Associer systématiquement lieu et fonction : « Le Placard » désigne l’espace ; « Cultiver » désigne l’activité ; « Entrepôt » désigne l’installation ; « Bureau » identifie le secteur des comptes, de la banque et de la gestion. Les noms de lieux gardent leur place dans les titres. Distinguer « Boutique La Botte » et le site de vente du joueur.

Les écrans internes utilisent un en-tête de navigation compact : retour au Placard, titre courant et outil nécessaire. Chaque lieu conserve une illustration généreuse, composée avec les commandes pour rendre le personnage et l’action accessibles ensemble.

## Ordre de réalisation et critères

1. Refaire l’accueil et ses accès directs, normaliser les noms, répartir les fonctions du tableau de bord. Préserver les scènes et personnages des destinations, les liens profonds existants et le retour navigateur.
2. Rendre le tour de culture lisible sur mobile, puis simplifier l’entrepôt en tenant compte des tentes individuelles.
3. Ajuster les accès Trésorerie, Collection et récompenses ; conserver les parcours déjà progressifs du commerce et des missions.

Vérifier aux largeurs 320, 390, 768 et 1440 px : accès principaux en un clic, absence de débordement, focus clavier visible, aucune modale spontanée, aucune information de décision masquée. Couvrir débutant, culture en cours, Fleur en attente de jury, lots à vendre, équipement usé et plusieurs tentes.

Inclure une revue visuelle du Bureau/Banque, de la Boutique et de l’Entrepôt à ces largeurs : personnages reconnaissables, décors préservés, commandes lisibles, aucune accumulation de panneaux sur les illustrations.

La réussite attendue : dès l’arrivée, le joueur distingue ce qu’il peut faire maintenant, où gérer son installation et où retrouver ses fonctions secondaires.

## Réalisation et validation locale

- Accueil à six encarts jaunes directs, Missions seule en accès secondaire, historique navigateur et liens vers équipement préservés ; achats de packs depuis Collection.
- Situation et dés réunis dans le parcours de culture mobile ; main et informations secondaires repliables, avertissements de décision conservés.
- Bureau autonome depuis l’accueil, banque conservée avec son personnage et dossiers comptables regroupés ; le Marché conserve uniquement son raccourci métier de création ou réactivation du site.
- Entrepôt persistant, tentes côte à côte, atelier de transformation commun, une fiche active ; vue liste disponible et agrandissement accessible depuis le prochain emplacement libre.

Les audits navigateur utilisent les composants réels avec des réponses API locales simulées, aux largeurs 320, 390, 768 et 1 440 px. Ils vérifient la disposition, l’absence de débordement, la navigation, la sélection, les achats mixtes et les réponses retardées. Rapports dans `output/placard-clarity`, `output/placard-culture-clarity`, `output/placard-treasury`, `output/placard-warehouse-clarity` et `output/placard-shared-catalog`.

La nouvelle migration d’atelier commun est vérifiée dans PGlite, sans réseau : canonisation des machines, conservation des soldes et reçus, achats atomiques, rejeu des requêtes, entretien commun et compatibilité des anciennes cultures. Les fonctions externes de calendrier et de comptabilité utilisent les fixtures du test de production ; les migrations de matériel et les observateurs d’actifs sont exécutés. TypeScript, ESLint et le contrôle des permissions Supabase complètent la validation.

Pour revoir uniquement l’entrepôt avec des données de démonstration : `node scripts/audit-placard-warehouse-clarity.mjs --preview`, puis `http://127.0.0.1:3241/?units=2` (également `units=4` ou `units=8`). Cette prévisualisation est distincte du compte joueur. Le site Next.js local existant reste sur le port 3000. Les migrations de l’atelier commun et des crédits de commandes ont été appliquées et vérifiées séparément ; les rapports d’application sont dans `output/shared-workshop-migration` et `output/order-cash-migration`.

La retouche des proportions prend en compte les ensembles illustrés complets, supports et pompes compris : la presse est agrandie, la filtration et le lyophilisateur rééquilibrés, le séparateur haut réduit. Le tamisage et la presse reposent sur le plateau à 68,2 % de la hauteur du décor ; les quatre machines au sol partagent un appui à 89 %. Les ombres de contact de l’établi sont distinctes de celles du sol. Les images gardent leurs proportions natives et leur taille reste identique quel que soit le niveau d’amélioration.

La validation utilise uniquement les données locales de démonstration ; aucune migration distante n’est exécutée par ces audits.
