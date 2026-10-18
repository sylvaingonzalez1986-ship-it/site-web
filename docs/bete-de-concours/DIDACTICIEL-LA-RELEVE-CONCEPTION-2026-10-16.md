# La relève

Conception du didacticiel narratif de Kanab Quest — 16 octobre 2026.

Le joueur reprend la ferme de son grand-père. Avec Sylvain, il débarrasse et rénove entièrement l'intérieur de l'ancienne grange à bétail pour en faire une chambre de culture professionnelle. Une fois les locaux terminés, il choisit ses zones et son matériel, découvre les Buddies, accompagne sa première campagne et trouve ses premiers débouchés. Le bâtiment garde son extérieur breton ; à l'intérieur, le changement est complet avant la première plante. La rénovation constitue la mise en scène de départ ; les décisions d'équipement et de culture lui apprennent ensuite les actions du jeu.

Le parcours comporte une première aventure en neuf chapitres courts, puis six rencontres qui terminent le tour des possibilités. Toutes les scènes se déroulent dans une ferme d'essai persistante. Le joueur peut interrompre, reprendre ou rejouer un passage. Les mêmes chapitres servent aux essais libres : une seule version des gestes, des règles et des dialogues.

Ce dossier contient le récit, les interactions, les conditions de réussite, la direction des illustrations et le raccordement au jeu actuel. Le parcours est désormais intégré dans l'application locale : l'histoire s'ouvre automatiquement à la première entrée dans Kanab Quest. Les neuf chapitres et les six rencontres restent accessibles par « La relève · Apprendre à jouer », sous la carte de « Mon quartier ». L'Arène ne propose plus ce bouton. Les sections suivantes conservent la conception de référence ; les détails de livraison ci-dessous décrivent l'implémentation.

## Aide du Carnet séparée du jeu — 18 octobre 2026

Le didacticiel de dégustation se lance désormais depuis **Carnet → couverture fermée → Comment faire ?**. Il ouvre directement la fiche d’entraînement guidée et propose « Retour au carnet » pendant et après l’exercice. La fermeture retrouve la couverture réelle, avec le focus sur le bouton d’aide. Le bouton n’apparaît pas dans le carnet d’essai, pour éviter une aide imbriquée.

La relève conserve la rencontre **Collection**, avec l’ouverture du pack et l’album Buddies. La fiche de dégustation ne fait plus partie des objectifs du jeu. L’identifiant historique de cette rencontre est conservé pour les sauvegardes ; l’ancien objectif de dégustation est ignoré lors de leur restauration. Le Carnet réel reste monté derrière le dialogue d’apprentissage, tandis que la fiche fictive utilise son propre transport local et ne lit ni ne publie les notes du compte.

Le parcours du Carnet suit maintenant les cinq pages du formulaire avec 21 repères explicites : choix unique du mode, précisions facultatives, échelle de 1 à 100, les dix critères expliqués individuellement, cases d’arômes simples et multiples, case « Autre » et sa saisie, relecture des familles, bilan chiffré et graphique, commentaire et vérification finale. Les exemples concernent la Fleur d’essai ; les arômes choisis n’attribuent aucun point et le critère Goût reste une note distincte.

Sylvain conserve chaque explication pendant la manipulation. Le joueur utilise les vrais champs puis choisit « Continuer » ; déplacer un curseur ou taper une première lettre ne fait plus sauter au champ suivant. Le mode doit être choisi explicitement, même si le formulaire propose déjà Vaporisateur. Les notes doivent être ajustées ou confirmées ; les précisions facultatives peuvent rester vides. Le guidage reprend au premier repère non validé après une exploration libre et retrouve le sommaire depuis un chapitre vide. La navigation et la mise en page restent celles du Carnet réel.

Validation : 28 tests ciblés réussis, TypeScript et ESLint valides. Le [parcours navigateur du Carnet](../../output/notebook-help/report.json) est terminé à 320, 390 et 1440 px, avec les dix critères, les cases, les confirmations et le surlignage contrôlés. Retour aux pages, excursion dans un chapitre vide, reprise et redémarrage sont vérifiés ; le bouton d’envoi reste accessible après un redimensionnement à 800 × 600 puis retour au grand écran. Aucun appel aux API du compte, aucune erreur JavaScript ; brouillon personnel, URL et focus conservés. La [comparaison avec le Carnet natif](../../output/notebook-help-fidelity/report.json) ne relève aucune différence de rendu à 390 et 1440 px. Les captures du parcours sont limitées au viewport, adapté à cette interface fixe plein écran.

## Décor commun de l’entrepôt — 18 octobre 2026

Le plan de l’entrepôt réel et celui du didacticiel utilisent désormais le même fond rénové : panneaux techniques blancs, sol gris clair, ventilation et portes turquoise. `KQ_WAREHOUSE_ROOM_ARTWORK` fournit cette source commune aux plans et à leurs vignettes. Le fichier `public/placard/warehouse-v4/overhead-room-renovated-v1.webp` est une copie inchangée de l’illustration déjà approuvée dans La relève ; sa provenance est conservée à côté du fichier.

Le décor remplit le canevas du plan de 100 m² ainsi que celui des anciennes installations de 40 × 25 cases. Les dimensions, coordonnées, zones et équipements sauvegardés restent inchangés. Le didacticiel ne peut plus revenir au décor rustique lors du passage de la scène de chantier au plan partagé.

## Introduction à la première entrée — 17 octobre 2026

`ArenaGameEntry` ouvre directement la scène des clés avec Sylvain, sans passer par le menu des didacticiels. Le jeu réel n'est pas monté derrière l'introduction : ni chargement du quartier, ni acquisition automatique de pack pendant l'accueil. Le dialogue de consentement reste prioritaire. Mettre l'histoire en pause ouvre le jeu ; sa reprise reste disponible dans le Quartier. À la fin de l'introduction, « Explorer le quartier » rejoint le jeu réel.

La détection serveur consulte uniquement les anciens statuts de parcours, les cultures et le matériel acheté. Elle n'initialise aucun portefeuille ni entrepôt, y compris pendant le préchargement d'une route. Les anciens parcours commencés, terminés ou passés conservent leur état ; les portefeuilles créés par une récompense ne suffisent pas à classer un nouveau joueur comme déjà accueilli. Une simple ancienne visite d'entrepôt sans achat ni culture n'est pas détectable avec ces lectures autorisées.

Une fois la scène effectivement montée, le client mémorise sa présentation par compte et confirme cette seule préférence avec `POST /api/arena/tutorial`, `intent: introduction`. L'écriture conserve les statuts existants : elle crée une préférence absente ou transforme seulement un statut `new` en `active`. Aucun résultat fictif n'est transféré au jeu. Aucune migration n'est nécessaire. Si cette confirmation échoue, le marqueur local évite un redémarrage automatique dans ce navigateur ; si le stockage est bloqué, la session ouverte garde ce marqueur en mémoire.

La sauvegarde de l'histoire et le registre des visites utilisent désormais des clés locales par compte. Un nouveau joueur ne récupère pas l'histoire d'un autre compte. Une ancienne sauvegarde globale peut être récupérée une seule fois par un compte déjà joueur ; elle n'est pas effacée. Les actions de la ferme restent sauvegardées dans le navigateur, distinctes de la préférence serveur indiquant que l'introduction a déjà été présentée.

Validation : 57 tests ciblés réussis (préférence, détection, accès, reprise et isolation), TypeScript et ESLint valides. Le [contrôle navigateur de l'introduction](../../scripts/audit-arena-introduction.mjs) vérifie à 390 et 1440 px le démarrage direct, l'absence de jeu derrière, la pause, le rechargement, la reprise dans le Quartier, deux comptes distincts, le consentement et la panne de confirmation. [Rapport et captures](../../output/arena-introduction/report.json) : succès, aucune requête de gameplay ni erreur d'exécution.

## Continuité avec Kanab Quest — 17 octobre 2026

L'audit d'immersion a identifié trois ruptures : le retour à une enveloppe de cours après l'arrivée, les sauts de défilement qui faisaient perdre le décor, et les explications dupliquées avant les vrais écrans de commerce.

Après le chantier, La relève reprend `KqPlacardNavigation` et `KqPlacardMap`, avec les noms et les repères du jeu. Les activités se débloquent au fil des objectifs. Une visite du quartier conserve le brouillon et la campagne ; la sélection, le zoom et le défilement de cette carte restent privés à l'essai. Les commandes du menu mobile ferment seulement leur tiroir, sans quitter l'aventure.

Sylvain conserve une courte consigne et une commande de guidage ou d'exploration libre. La caméra défile seulement de la distance nécessaire, avec le mouvement réduit respecté. La fin d'un objectif mène à une action explicite : choisir les Buddies, préparer la campagne, rejoindre le jury, aller au marché ou passer au bureau. Les résultats restent à lire avant de poursuivre.

Le plan monte directement `KqWarehouse`, avec son dessin de zones, ses fenêtres d'équipement et ses devis. La préparation, la culture et le jury montent directement `KanabQuestDicePrototype` dans sa branche joueur. Le commerce conserve intégralement `KqMarketHub` et `KqTreasuryDesk`. Les longues explications s'ouvrent avec le bouton d'aide ; le budget principal reste dans le bandeau du jeu.

Les quatre illustrations d'arrivée sont conservées, préchargées et fondues entre les actions, avec une validation visuelle immédiate. Aucune attente artificielle ni nouvelle règle économique n'est ajoutée.

## Arrivée jouable en scène — 17 octobre 2026

L'ouverture occupe l'écran disponible, avec quatre états illustrés : remise des clés, intérieur à débarrasser, chantier et chambre professionnelle terminée. Chaque geste se fait sur un objet de la scène et change immédiatement le décor. Le dernier objet donne accès au véritable plan d'aménagement. Sylvain garde une seule consigne courte ; les 2 000 € d'équipement restent visibles et intacts pendant les travaux.

La lettre est un objet à ouvrir. Le carnet, les neuf chapitres illustrés et les options de reprise sont des fenêtres à la demande : leurs longs textes ne sont pas montés dans l'interface de jeu initiale. Les illustrations mobiles sont recomposées en portrait pour garder Sylvain et les objets ensemble, plutôt que recadrer les grands décors paysage.

Les nouvelles images sont générées avec l'outil intégré imagegen. Les fichiers, références et prompts sont conservés dans [le manifeste des scènes de chantier](../../public/contest/releve/arrival-scene-provenance.json) et [le manifeste des versions portrait](../../public/contest/releve/arrival-portrait-provenance.json).

La recette guidée suit les actions de l'arrivée jusqu'au bout de l'histoire, contrôle la visibilité des cibles et l'absence de chevauchement avec Sylvain. Le budget reste conservé pendant le chantier. Les tests de session couvrent séparément la reprise et les points de contrôle.

## Interfaces du jeu — 17 octobre 2026

- Les Buddies se placent depuis le dock natif de `KqWarehouse`, après l'ouverture du vrai pack et la lecture de `KqBuddieVarietyPopover` : goûts illustrés, histoire, origine et lignée. Le joueur choisit une variété disponible, la place dans une zone puis enregistre son affectation. La rotation reste appliquée par le moteur de l'essai.
- La préparation est celle du joueur : deck avec quantités par carte, Héritage, validation des choix puis confirmation des charges. Sylvain désigne ces contrôles existants. Préparer un soutien ne consomme aucune copie ; le jouer passe par la confirmation native.
- La culture utilise l'écran complet du jeu, y compris `KqCultureCarePanel`, le portrait de santé, les problèmes, l'entretien et la boutique d'intrants/PBI. Les six étapes, les dés, les réactions, les bilans, la campagne et les cartes Fleur ont la même source HTML/CSS dans le jeu et dans l'histoire.
- Le jury utilise la vraie réserve, la confirmation d'entraînement, `KqBattleVerdictDialog` et `KqBattleHistory`. Le résultat présente les trois manches ; le guide invite à ouvrir leur analyse et à fermer le verdict. Après reprise, il désigne l'archive de la Fleur concernée.
- La navigation du jury partage `KqHarvestNavigation` avec le shell joueur. « Toutes mes récoltes » ouvre `KqHarvests`, conserve la Fleur choisie au retour et rassemble les Fleurs en attente et les lots déjà jugés. « Stockage & affinage » ouvre le stockage du dossier commerce après les verdicts, pour conserver les mêmes lots et leurs modifications.
- L'accueil et les six rencontres montrent les décors du jeu, avec l'action sur la scène. Le récit détaillé reste dans le registre. Le guidage suit aussi les fiches en surimpression et fait défiler les carrousels jusqu'au contrôle à utiliser.
- Les vérifications du parcours réel contrôlent les fiches, leur fermeture et le retour du focus, la rotation, les affectations sauvegardées et l'absence d'accès au compte. Les captures des fiches sont dans `output/arena-releve/` et celles du parcours guidé dans `output/arena-releve-guide/`.

### Source unique et état d'essai

`KqReleveProduction` ne construit plus de plateau parallèle. Il choisit `KqReleveNativeWarehouse` ou `KqReleveNativeCulture`, qui fournissent les données de la ferme sauvegardée aux composants joueur existants. Le second utilise `apiScope="player"`, avec les mêmes confirmations et les mêmes composants de santé ; il n'active pas l'ancien mode de simulation du prototype.

Les transports `kanab-quest-releve-warehouse.ts` et `kanab-quest-releve-culture.ts` répondent au contrat des API natives en mémoire. Toute route inconnue est refusée, sans repli réseau. Les préférences et événements restent locaux au provider. Les achats, copies consommées, soins, factures et verdicts mettent à jour la sauvegarde d'essai. La sélection de campagne, l'entrepôt, le retour en culture et le marché passent par les callbacks de l'histoire. Les attributs `data-*` servent seulement à repérer les vrais contrôles et à enregistrer leur consultation ; aucune copie de leur mise en page n'est entretenue dans le didacticiel.

Les portes secondaires du commerce ouvrent les mêmes destinations que le shell joueur : `KqHarvests` puis `KqWarehouse` pour le stockage, `KqWarehouseEntry` avec ouverture du catalogue ou de la fiche demandée pour le matériel, et `KqTreasuryDesk` au guichet Banque pour les financements. Les lots gardent leurs réservations distinctes ; une vente de surplus respecte le quota grossiste, la TVA et les factures. Un réaménagement applique le devis natif au même budget et au même journal. Les brouillons de ces fenêtres restent privés au provider d'essai.

La porte Banque du commerce conserve le disponible de la campagne : prêt, épargne et placements sont sauvegardés dans son dossier fictif, sans créer une deuxième caisse. Elle utilise un profil bancaire d'exemple pour rendre les guichets essayables. La rencontre Banque indépendante conserve son propre dossier pédagogique. Les lectures, retours et ouvertures de fenêtres ne débitent rien ; les confirmations restent celles des composants du jeu.

Les tests `kanab-quest-releve-warehouse.test.ts`, `kanab-quest-releve-culture.test.ts` et `arena-releve-production-guide.test.ts` couvrent le contrat de sauvegarde, les devis et révisions périmés, le budget, l'absence de requêtes compte, les soins, le jury et sa reprise sans double récompense, ainsi que les choix disponibles au guide. La comparaison de rendu est réalisée par `scripts/audit-arena-releve-fidelity.mjs` ; le parcours guidé complet est vérifié séparément par `scripts/audit-arena-releve-guide.mjs`.

### Recette finale locale — 17 octobre 2026

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Histoire à 390 px | Neuf chapitres terminés en 108 actions physiques guidées, depuis le début sans reprise ; exploration libre conservée entre fenêtres. | [Rapport du parcours](../../output/arena-releve-guide/report.json) |
| Six rencontres à 320 px | Toutes terminées en 103 gestes guidés, avec les vrais contrôles et confirmations. | [Rapport des rencontres](../../output/arena-releve-guide-meetings/report.json) |
| Fidélité au jeu à 390 et 1440 px | 62 comparaisons sur 62 conformes pour le DOM, les styles calculés et la géométrie des régions métier. Coach et bandeau pédagogique exclus ; arrivée narrative sans équivalent dans le jeu. | [Rapport et méthode](../../output/arena-releve-fidelity/report.json) |
| Portes secondaires à 320 et 1280 px | Stockage, récoltes, fiche matériel, prêt bancaire et épargne fonctionnent avec budget et journal communs ; navigation et brouillons sans écriture dans le stockage du joueur. | [Rapport ciblé](../../output/arena-releve-native-lessons/report.json), [stockage mobile](../../output/arena-releve-native-lessons/secondary-storage-320.png), [journal après banque](../../output/arena-releve-native-lessons/secondary-bank-journal-320.png) |
| Vérifications de code | 96 tests ciblés dans dix fichiers réussis ; TypeScript et ESLint valides ; compilation Next réussie avec 139 pages générées. | Recette locale de la livraison. |

Les audits navigateur ci-dessus n'ont émis aucune requête vers les API de compte et n'ont relevé aucune erreur d'exécution. Les images accompagnent les comparaisons de structure et les gestes ; elles ne remplacent pas ces vérifications.

## Intégration du 16 octobre 2026

- Reprise en « let's play » : le jeu passe avant le récit. L'arrivée est une scène avec une action cliquable ; les chapitres suivants ouvrent directement le plan, les cartes, les dés ou le comptoir. Les illustrations et explications longues restent consultables dans « L'histoire et les conseils de Sylvain ».
- Sylvain reste visible avec son portrait et une consigne liée à un contrôle réel. Un halo « À toi » désigne le prochain geste et suit les changements de phase et les confirmations imbriquées. Le guide n'effectue aucun achat ni clic à la place du joueur. « Me montrer » retrouve la cible au clavier ou à l'écran ; « Explorer librement » suspend le guidage sans perdre la progression.
- Le guidage couvre aussi les rencontres et leurs écrans de banque, placements, personnage, missions, Carnet et collection. Le nouveau script `scripts/audit-arena-releve-guide.mjs` suit uniquement les contrôles désignés, sans corriger leur défilement : il contrôle cible, portrait, visibilité, absence de superposition avec Sylvain et isolation des données d'essai. Les rapports sont dans `output/arena-releve-guide/` et `output/arena-releve-guide-meetings/`.
- L'histoire commence par les clés, le vidage puis la rénovation intégrale. Les 2 000 € fictifs restent disponibles après cette rénovation de scène. Les quatre nouvelles illustrations et le fond zénithal de l'entrepôt sont livrés dans `public/contest/releve/`. Prompts et provenance du générateur intégré : `assets/releve-runtime-illustrations-v1.json` et `assets/releve-overhead-illustration-v1.json`.
- `ArenaReleve` relie le plan, l'album, la campagne, les verdicts, les lots, la boutique et le registre. La production dispose d'une interface guidée utilisant le vrai plan, les calculs d'équipement, le moteur de campagne et les bilans du jeu. Le commerce et les finances reprennent leurs interfaces actuelles par un transport local fermé, sans appel aux API du compte.
- La sauvegarde principale utilise sa propre clé versionnée. Reprendre un chapitre restaure son budget, ses achats, ses cartes et ses lots puis remonte ses écrans. Le registre reste consultable après la fin. Les rencontres disposent de dossiers distincts ; l'atelier conserve son propre dossier, les autres mémorisent leurs projets et les sous-leçons terminées.
- L'ancien parcours complet et le guide statique ne sont plus proposés par les entrées du didacticiel. Les modules de découverte encore utilisés sont regroupés dans les rencontres. La prime de première récolte est de 50 € ; le pack de démonstration des Missions correspond au Jardin des connaisseurs.
- Les audits de référence sont `scripts/audit-arena-releve-guide.mjs` pour le parcours et les rencontres guidées, `scripts/audit-arena-releve-fidelity.mjs` pour la comparaison avec les composants du jeu, et `scripts/audit-arena-releve-native-lessons.mjs` pour les interactions natives ciblées et les portes secondaires (`--doors-only`). Les anciens noms de scripts sont des lanceurs de compatibilité. La recette des six rencontres à 320 px a validé 103 gestes guidés, sans API de compte ni erreur ; son rapport est dans `output/arena-releve-guide-meetings/report.json`. Les preuves des portes secondaires sont dans `output/arena-releve-native-lessons/`. La reprise de sauvegarde est couverte par les tests de session ; les anciens contrôles spécifiques de réouverture du registre ne sont pas revendiqués par ces lanceurs.

## La promesse du récit

**« Faire revivre la grange, à ta façon. »**

Le grand-père transmet un lieu et une confiance. Il n'est pas nécessaire d'inventer son décès, une dette ou une faillite. L'ancienne activité d'élevage a cessé ; ses traces apparaissent seulement dans la scène d'arrivée. Tout l'intérieur est ensuite débarrassé et rénové : sol lisse et propre, parois et plafond techniques blancs, installations et rangements professionnels, allées dégagées et espaces de séchage et de stockage séparés. Le joueur équipe progressivement les surfaces actives de cette chambre entièrement rénovée ; il ne cultive jamais dans un coin d'étable resté rustique.

Sylvain connaît le quartier. Il accompagne, prête du matériel de démonstration lorsqu'une activité le nécessite et laisse progressivement la main. Il n'a pas réponse à tout avant que le joueur ait essayé. Une difficulté lui fait proposer une observation ou un retour au devis, jamais une remarque humiliante.

Trois objets relient les scènes : la clé en laiton, le mètre pliant et le registre de la ferme. La clé ouvre l'histoire ; le mètre accompagne les premières décisions ; le registre garde les projets et les résultats. Ce registre s'appelle **Registre de la ferme**, pour le distinguer du **Carnet**, réservé aux dégustations.

Le premier objectif est concret : préparer une première livraison. Il n'y a ni compte à rebours ni obligation de résultat parfait. La fin montre ce que le joueur a changé et lui rend l'initiative.

## Ouverture écrite

La cour est calme. La grange est toujours là, avec son toit d'ardoise un peu de travers et ses grandes portes turquoise. À côté de la brouette, une caisse porte un vieux registre et une enveloppe. Sylvain attend près de la porte, une grosse clé à la main.

Dans l'enveloppe, quelques lignes du grand-père :

> Je te confie la ferme. Les bêtes ont quitté la grange depuis un moment, mais elle peut encore servir. Tu trouveras mon vieux registre sur place. Il reste beaucoup de pages blanches.
>
> Tout l'intérieur est à refaire. Fais-en une vraie chambre de culture, puis choisis ce que tu veux y installer. Et si tu as besoin d'un coup de main, Sylvain connaît le chemin.
>
> Je suis curieux de voir ce que tu vas en faire.
>
> Grand-père

Sylvain :

> « Il m'a demandé de te remettre les clés. Viens, on regarde ce qu'on peut faire de cette grange. »

Le bouton **Ouvrir la grange** est disponible dès l'arrivée, avec la seule première réplique de Sylvain. La lettre se lit en touchant l'enveloppe et reste ensuite dans le registre ; sa lecture n'est pas obligatoire. Le joueur touche la clé ou choisit ce bouton. Les portes s'écartent. Il découvre les anciennes séparations, une mangeoire, des traces de paille et surtout beaucoup d'espace.

> « Cent mètres carrés à transformer. On vide la grange, puis on refait tout l'intérieur. Les premières plantes viendront quand la chambre de culture sera prête. »

Une information apparaît avant la rénovation : **Ferme d'essai — La rénovation complète est prise en charge dans cette simulation. Tu disposes ensuite de 2 000 € et d'une collection de démonstration pour équiper les zones et jouer.** La rénovation est une transition de scène : elle n'invente ni coût de chantier, ni prêt, ni financement dans le jeu réel. Les achats de matériel, les cartes et les résultats restent dans l'exercice, comme le rappelle discrètement le cadre du jeu.

## Rythme et liberté

La cible de conception est de 25 à 35 minutes pour la première aventure, puis 15 à 25 minutes pour découvrir les six rencontres. Ces durées devront être mesurées avec des joueurs ; elles ne supposent jamais une session continue. La première action intervient en moins de trente secondes.

Chaque chapitre suit le même mouvement : une courte situation, une action, une conséquence visible, puis une phrase de Sylvain. Le premier fait jouer la transformation du décor ; à partir du deuxième, les actions utilisent les écrans du jeu. La plupart des bulles tiennent en deux phrases et moins de quarante mots. Les précisions restent sous **Pourquoi ?** ou dans le registre.

Trois commandes restent accessibles : **Reprendre plus tard**, **Me montrer**, **Le fil de l'histoire**. **Explorer librement** permet de suspendre le guidage sans supprimer la ferme d'essai, y compris pendant une confirmation. **Reprendre le guidage** retrouve la prochaine action disponible. Le joueur peut sauter une explication ; cela ne valide pas une action qu'il n'a pas effectuée.

Il existe deux accomplissements distincts : **Première livraison réalisée**, puis **Tour de la ferme et du quartier terminé**. La seconde mention exige une interaction dans chaque rencontre, ou indique explicitement les rencontres passées. Un premier encaissement ne prétend pas avoir enseigné la banque, le Carnet ou les classements.

## Acte un Donner une nouvelle vie à la grange

### Chapitre 1 Les portes turquoise

**Situation.** La grange contient encore du vieux matériel d'élevage, des séparations, une mangeoire et de la paille. C'est l'état avant travaux, sans aucune plante ni installation de culture.

**Sylvain.** « On retire tout ce qui servait à l'élevage. Ensuite, on refait le sol, les murs et le plafond pour préparer toute la pièce. »

**Gestes.** Après la clé, choisir **Vider la grange** : toutes les séparations d'élevage, la mangeoire, la paille et les anciens équipements quittent la pièce. Choisir ensuite **Rénover tout l'intérieur** déclenche une courte ellipse de chantier. Le résultat montre les 100 m² entièrement rénovés, un sol lisse et propre, des parois et un plafond techniques blancs, des raccordements rangés et des circulations libres. La charpente rustique n'est plus apparente à l'intérieur. Aucun achat de matériel ni aucune plante n'apparaît pendant cette séquence ; le joueur découvre d'abord le local professionnel vide avant de choisir ses zones.

**Réussite.** Les deux transformations du décor sont terminées et l'état **Intérieur entièrement rénové** est enregistré. Aucun achat n'a été confirmé et le budget d'équipement est intact. La rénovation complète précède toute affectation de Buddie ou apparition de plante.

**Réaction.** « Voilà une vraie chambre de culture. Tout est prêt côté bâtiment ; on peut maintenant choisir où installer le matériel. » Le registre conserve les vues avant et après rénovation.

**Si besoin.** Chaque transformation se déclenche par un bouton accessible au clic et au clavier ; aucune tâche de nettoyage répétitive ni manipulation précise n'est imposée. L'ellipse peut être abrégée et respecte les préférences de mouvement réduit. La rénovation est prise en charge dans la simulation : le moteur ne chiffre pas ce chantier et le récit n'en tire aucun bonus de gameplay.

### Chapitre 2 Le mètre et le registre

**Situation.** Dans la chambre entièrement rénovée, Sylvain pose le registre sur un plan de travail propre. La surface disponible est grande ; le budget d'équipement est limité. Aucun vestige d'élevage ne subsiste dans la pièce.

**Sylvain.** « Le bâtiment est prêt. Choisissons maintenant les surfaces à équiper, puis comparons leur prix et leurs charges. On peut commencer petit dans une pièce entièrement rénovée. »

**Gestes.** Ouvrir le vrai plan de l'Entrepôt, sur 10 × 10 cases de 1 m². Tracer ou sélectionner un premier rectangle de culture de 1 m², le déplacer et lui donner un nom facultatif. Comparer deux éclairages dans le catalogue actuel : prix de l'appareil entier, surface couverte, énergie et bonus de jeu. Choisir l'éclairage et l'extraction. Tracer ensuite les zones distinctes de séchage et de stockage, avec des allées dégagées et du matériel professionnel rangé. Lire le devis d'équipement des zones, observer le solde après achat et confirmer le plan. Ce devis n'est pas celui de la rénovation du bâtiment.

Le premier parcours propose le matériel économique sur 1 m², avec 1 m² de séchage et 1 m² de stockage. Le joueur peut essayer un autre devis, réduire la surface ou revenir à la proposition. La simulation accepte tout plan compatible et finançable ; elle ne force pas une marque ou un montant exact pour progresser.

**Moment ludique.** Un raccourci **Et si j'agrandissais ?** permet de comparer un brouillon de 2 m² au premier devis, puis de revenir sans payer. Le prix par m² ne se confond pas avec le montant total. Les appareils sont achetés entiers : une gamme plus chère peut être mieux utilisée sur une autre surface.

**Réussite.** Plan enregistré avec culture, séchage et stockage ; capacités suffisantes pour la première campagne ; devis et charges consultés. La réserve pédagogique conseillée est de 150 € après les charges et factures connues de l'exercice. Passer sous ce montant déclenche un avertissement avec comparaison des engagements, sans bloquer un plan autorisé par le moteur ni ajouter une règle au jeu réel.

**Réaction.** « La première zone est équipée. Le séchage et le stockage ont leur place à part. On ajoutera du matériel quand on en aura besoin. » Le décor montre l'équipement choisi dans un intérieur fini sur toute sa surface, avec éclairage installé, rangement de séchage et stockage séparés. Les pots, supports et étagères restent vides avant la culture ; les surfaces encore inactives sont propres et rénovées elles aussi.

**Si besoin.** Une zone suggérée est proposée après une demande d'aide. Le placement existe au clic et au clavier ; le glisser-déposer n'est pas obligatoire. Un devis trop cher donne accès à **Réduire la zone**, **Comparer une autre gamme** et **Revenir au brouillon précédent**. Annuler un devis ne coûte rien. Retirer un équipement déjà acquis le remet en réserve : cela ne rembourse pas automatiquement son prix. Si un achat libre empêche ensuite une action indispensable, **Reprendre avant cet achat** restaure explicitement le point de contrôle de l'exercice, avec son budget et son inventaire. Le jeu réel ne propose pas ce remboursement par retour en arrière.

### Chapitre 3 Les premiers Buddies

**Situation.** L'installation est prête. Sylvain apporte un album et un pack d'essai.

**Sylvain.** « Voici les Buddies. Chacun représente une variété avec son profil. On va d'abord découvrir les cartes, puis leur trouver une place. »

**Gestes.** Ouvrir le pack de démonstration dans l'animation existante, révéler ses trois cartes et consulter un profil. La pioche de cet exercice est préparée et annoncée comme telle ; elle ne représente pas les probabilités des vrais packs. Deux Buddies distincts sont garantis dans l'album prêté pour pouvoir apprendre les campagnes.

Le joueur affecte un Buddie à la première zone. Il voit son profil, la récolte estimée et sa disponibilité. Sylvain propose une deuxième petite zone pour comparer deux variétés au cours de la même campagne. Le joueur enregistre le devis supplémentaire puis affecte un autre Buddie ; il peut choisir de garder une seule zone et réaliser la comparaison dans la rencontre d'agrandissement.

**Repère d'acquisition.** Le tiroir **Trouver d'autres Buddies** présente les sources réelles avec leurs conditions : pack de bienvenue si disponible sur le compte, packs en Boutique contre des points fidélité, récompenses de missions et packs liés aux commandes. Ces informations viennent des règles actuelles. Elles ne demandent ni achat ni utilisation des points réels pendant l'histoire.

**Réussite.** Au moins un Buddie fictif possédé et disponible est affecté à une zone active enregistrée. La variante à deux zones exige des Buddies distincts. L'ouverture d'un pack ne vaut pas affectation en culture.

**Réaction.** « Cette carte reste dans ton album. Elle donne son profil à la culture ; tes soutiens serviront à intervenir pendant la partie. »

**Si besoin.** Essayer d'affecter le même Buddie deux fois explique le doublon. Un exemple de Buddie en rotation montre son indisponibilité et le nombre de variétés restantes, sans bloquer le premier départ. Une carte rare ne constitue jamais une condition de réussite.

## Acte deux Accompagner la première campagne

### Chapitre 4 Tout le monde démarre ensemble

**Situation.** Le joueur revient au plan. Les zones actives et affectées sont surlignées ; les espaces laissés au repos restent visibles.

**Sylvain.** « Les zones prêtes partent ensemble. Tes décisions accompagneront toute la campagne ; chaque Buddie gardera son profil et son matériel. »

**Gestes.** Ouvrir le récapitulatif des participants, essayer l'activation et la pause d'une zone avant de conserver son choix, vérifier les capacités et les charges. Préparer des soutiens Botte du Chanvrier ; consulter un Héritage prêté, puis choisir de l'équiper ou de commencer sans lui. Confirmer le lancement fictif.

**Réussite.** Une campagne existe et ses participants correspondent au plan enregistré. Les équipements et les charges utilisés viennent de cette version du plan. Consulter ou préparer un soutien ne le consomme pas ; seule son utilisation le fait. La transmission de la ferme ne débloque aucune carte Héritage réelle.

**Réaction.** « Le plan est prêt. Maintenant, on s'occupe de ce qui pousse. » Les cartes de Buddies sont visibles au-dessus de leurs zones.

**Si besoin.** Le blocage indique le problème exact : Buddie indisponible, brouillon non enregistré, capacité trop faible ou campagne déjà active. Le bouton d'aide revient au bon panneau sans perdre les choix.

### Chapitre 5 Sylvain laisse la main

**Situation.** La première culture commence. Un premier résultat lisible est suivi d'un imprévu maîtrisé par le scénario.

**Sylvain.** « Avant d'agir, regarde ce qui se passe. Tu peux consulter le suivi sans dépenser une carte. »

**Gestes.** Parcourir les six étapes du moteur actuel. À la première, apprendre la boucle observer → préparer éventuellement → lancer → réagir éventuellement → valider → lire le bilan. Les suivantes mettent chacune en avant une nouveauté utile : santé et vitalité, soutien adapté, achat ou utilisation d'un soin, Héritage disponible, puis récolte et séchage.

Les cartes, soins, intrants et auxiliaires utilisent leurs vrais conditions et effets de jeu. Une intervention dont l'effet se produit au prochain bilan est annoncée comme telle. Le récit ne montre pas une guérison immédiate pour embellir la scène. Les valeurs de rendement, énergie et santé restent celles de la simulation du jeu.

**Choix.** À l'imprévu, le joueur peut utiliser une réponse compatible ou continuer avec le risque affiché. Sylvain réagit au résultat effectivement obtenu. Une carte non compatible explique sa condition ; le scénario ne pousse pas à toutes les dépenser.

**Réussite.** Les six étapes sont terminées, un bilan est consulté et la distinction entre observation gratuite et intervention est rendue visible. Aucun score minimum, aucune carte précise et aucune utilisation obligatoire de l'Héritage.

**Réaction après un bon passage.** « Tu as regardé, choisi et vérifié le résultat. Tu peux garder cette habitude. »

**Réaction après une difficulté.** « On voit ce qui a pesé sur la culture. Tu peux reprendre ce passage, ou continuer avec mon aide pour découvrir la suite. »

**Si besoin.** Le joueur choisit une reprise du point de contrôle de l'essai ou une assistance clairement annoncée. Une aide qui restaure la vitalité le dit ; elle ne prétend pas avoir modifié les dés. Les pertes et le verdict déjà obtenus ne sont pas maquillés. La première aventure doit toujours pouvoir continuer.

### Chapitre 6 La récolte rencontre le quartier

**Situation.** La grange contient ses premières récoltes. Sylvain ouvre la porte vers l'Arène, puis ramène le joueur à ses lots.

**Sylvain.** « Voilà ce que ta campagne a produit. Le jury va donner son avis ; ensuite, on regardera ce qu'on peut faire de chaque lot. »

**Gestes.** Comparer les résultats par zone lorsque deux Buddies ont participé. Présenter une Fleur dans un duel d'entraînement, découvrir les trois manches et ouvrir le verdict. Revenir dans **Mes récoltes**, puis dans le stockage pour identifier quantité, qualité commerciale, place réservée et maturité.

Le verdict d'une seconde Fleur peut être montré avec l'animation abrégée, sans imposer deux initiations identiques. La carte Fleur engagée ne ressert pas au duel ; la récolte commerciale reste un lot à gérer. Le résultat du match ne doit pas être présenté comme la note du lot.

**Temps.** Avant l'ellipse, Sylvain fait regarder la maturité : **Avancer l'essai jusqu'à la fin de l'affinage**. Le bouton annonce la durée simulée ; le vrai délai n'est pas modifié. Un lot avant maturité permet de montrer pourquoi certains débouchés sont indisponibles. Le surplus du nouvel entrepôt reste à gérer manuellement ; aucune vente automatique après une heure n'est annoncée.

**Réussite.** Verdict consulté, lot retrouvé et état de stockage compris par une action : ouvrir sa répartition ou sa zone, puis sa maturité. Gagner le duel n'est pas requis.

**Réaction.** « On connaît la quantité et la note. Gardons maintenant de la place et choisissons un débouché adapté. » Le registre affiche la récolte réelle de l'exercice, même si elle est modeste.

## Acte trois Faire vivre la ferme

### Chapitre 7 La première livraison

**Situation.** Sylvain propose de préparer une livraison avec une partie de la récolte. Le reste sera conservé pour découvrir la vente en ligne.

**Sylvain.** « Je peux te montrer plusieurs acheteurs. Avant de choisir, regarde ce qu'ils prennent, à quel prix et ce qu'il te restera. »

**Gestes.** Ouvrir **Commerce → Vue d'ensemble**, retrouver la récolte, consulter les demandes clients, puis **Vendre ma production**. Comparer deux circuits : quantité acceptée, revenu, réputation et contraintes. Un circuit peut être indisponible ; lire sa condition fait partie de la comparaison. Préparer le lot en fleur, puis vendre une partie du stock si le circuit le permet, confirmer cette première vente et lire le reçu. La préparation actuelle porte sur le lot entier ; elle n'invente pas un sélecteur de quantité à transformer.

Les arômes demandés donnent une occasion de comparer, pas une obligation. Le scénario ne garantit ni adéquation aromatique, ni fidélisation, ni prise en charge de tout le stock. Les quotas et la maturité restent visibles. Une route de biomasse peut servir à expliquer une qualité trop faible, sans faire passer cette issue pour un échec du joueur.

**Réussite.** Un reçu fictif existe, le stock a diminué de la quantité vendue et le joueur a ouvert le détail du montant reçu. Une partie est conservée pour la suite ou un petit lot pédagogique séparé est proposé si le stock ne permet pas cette suite.

**Réaction.** « Première livraison. La grange commence à travailler pour toi. Ouvrons le reçu avant de dépenser la recette. » Le jalon **Première livraison réalisée** apparaît dès ce reçu, avec une petite mise à jour du registre et la possibilité de reprendre plus tard.

**Si besoin.** Un quota épuisé mène au stock restant et à une ellipse fictive jusqu'au prochain créneau. Une qualité insuffisante pour l'activité suivante permet à Sylvain de prêter un lot identifié **Lot de démonstration de Sylvain**. Le joueur garde sa propre récolte et son verdict ; rien n'est remplacé discrètement.

### Chapitre 8 Une enseigne pour la ferme

**Situation.** Dans l'espace de gestion séparé de la culture, Sylvain installe un ordinateur de prêt sur un bureau propre. Le joueur prépare la première offre de sa boutique.

**Sylvain.** « Les gens du quartier peuvent passer ici. Pour les autres, on va ouvrir une petite boutique et y mettre une première offre. »

**Gestes.** Dans **Développer ma boutique**, donner un nom à la boutique de base et l'ouvrir gratuitement. Choisir un emballage et un format compatibles, préparer quelques paquets et publier une annonce. Comparer deux prix avec l'estimation de ventes, puis enregistrer son choix.

Le nom est celui de la boutique fictive ; nommer la ferme reste un choix de récit. L'ordinateur est un prêt identifié et les emballages sont débités du budget d'essai. On ne réintroduit ni les 1 000 € de création ni l'abonnement de l'ancien site.

**Deuxième geste.** Dans Communication, préparer la campagne de lancement disponible : annonce, public, budget et prévision. Le lancement offert est présenté seulement lorsque sa condition est remplie. Avancer explicitement l'horloge de l'essai, puis ouvrir le suivi des commandes et le bilan de campagne. Les résultats proviennent du calcul de vente ; une estimation n'est jamais une commande promise.

**Réussite.** Une annonce a été publiée, son prix enregistré et le rapport après une période simulée consulté. Une annonce déjà épuisée par les ventes satisfait cet objectif. Il n'est pas nécessaire d'atteindre un nombre imposé de ventes ou d'abonnés. Si aucune commande n'arrive, le joueur peut ajuster l'offre et réessayer ; il peut aussi continuer après avoir compris le blocage.

**Réaction.** Si du stock reste : « Ton offre est en ligne. Maintenant, les prix, les stocks et la satisfaction vont compter autant que la visite des clients. » Si tous les paquets sont vendus : « Ton rayon est vide. Regarde les commandes : tu sauras ce qui est parti avant de préparer la suite. » Une enseigne sans texte gravé dans l'illustration apparaît ; le vrai nom est affiché par l'interface.

### Chapitre 9 Le registre se remplit

**Situation.** Retour à la table du début. La clé, le mètre et le registre côtoient désormais un reçu et une facture.

**Sylvain.** « Ton grand-père gardait ses comptes ici. On va regarder l'argent disponible, les montants à régler et ce qu'on peut préparer pour la prochaine fois. »

**Gestes.** Ouvrir **Finances**, retrouver une recette et une facture de l'exercice, distinguer trésorerie disponible, sommes réservées et dettes. Régler une facture accessible, puis constater le paiement dans le journal. Ouvrir **Missions**, réclamer la récompense de première récolte si elle est acquise et lire le prochain objectif.

La récompense de première récolte est actuellement de 50 € de jeu. Les autres récompenses — argent, carte garantie ou pack — sont présentées avec leurs vraies conditions. Rien n'est réclamé sur le compte réel. Le chiffre d'affaires et le solde ne sont pas étiquetés « bénéfice » en l'absence d'un calcul complet.

**Réussite.** Une facture et une recette ont été consultées ; un paiement fictif est enregistré si le budget le permet ; la récompense disponible a été récupérée une seule fois. Le joueur choisit un prochain projet et consulte son devis, sans achat obligatoire.

**Fin de l'acte.** La vue de l'entrée revient. L'extérieur breton est reconnaissable ; la porte ouvre désormais sur un intérieur entièrement rénové, blanc et propre. Les seules zones en activité sont celles choisies par le joueur, avec séchage et stockage séparés et des allées libres. Aucun reste d'étable n'apparaît. Dans l'espace de gestion, Sylvain pose la clé sur le registre.

> « On a refait toute la grange. Tu as choisi comment l'équiper et tu as préparé ta première livraison. Il reste de la place pour faire grandir ton activité. »

Le bilan **La ferme a repris vie** réunit la première livraison, la boutique et les comptes. Deux choix : **Continuer la visite du quartier** ou **Reprendre plus tard**. Les six rencontres restent visibles, avec leur intérêt et leur progression.

## Les six rencontres pour faire le tour du jeu

Ces rencontres prolongent la même histoire. Le mode **Tour complet** les enchaîne ; le joueur peut aussi les choisir sur le plan du quartier. Chaque visite comprend un geste réel et une conclusion, avec un exercice plus long disponible ensuite. Consulter tous les lieux n'oblige pas à acheter toutes les machines, emprunter ou atteindre tous les paliers.

| Rencontre | Situation et voix de Sylvain | Interaction pour terminer la découverte | Suite à rejouer |
| --- | --- | --- | --- |
| Une place pour demain | « Avant d'agrandir, on regarde ce qui manque vraiment. » Retour au plan et au registre. | Comparer une surface plus grande et une amélioration de gamme ; retirer un équipement, le retrouver en réserve puis le réutiliser ; consulter une limite de capacité. Si le premier acte n'avait qu'un Buddie, comparer une seconde zone dans le brouillon, puis affecter le second sur un plan enregistré et vérifier les participants. Un dossier de plan prêté permet cette dernière démonstration si le budget de la ferme ne suffit pas ; l'achat reste facultatif. | Modules par famille, activations, charges par m², plusieurs zones, remplacement ou entretien selon le matériel concerné. |
| Le savoir-faire de l'atelier | « Un même lot peut devenir plusieurs produits. On essaie sur une petite quantité. » Sylvain ouvre un atelier de démonstration. | Avec un lot et une machine de prêt identifiés, comparer rendement, qualité exigée, capacité, coût et destination du reste ; terminer une transformation puis consulter l'état d'entretien. | Tamisage, lavage, pressage, paliers des machines, prérequis de carrière, réparation et effet de la spécialité Bricoleur. |
| Une affaire qui grandit | « Une boutique qui vend une fois, c'est un début. Regardons ce qui donne envie de revenir. » | Consulter prix, satisfaction et stock sur une annonce ; comparer une amélioration, préparer une campagne ciblée et examiner un rapport. | Fidélité, abonnés, confiance, partenaires, demandes aromatiques, plusieurs annonces, renouvellement des stocks et bilan de développement. |
| La porte de la banque | « Un financement peut aider un projet. Il faut aussi savoir ce qu'il faudra rembourser. » Sylvain présente un dossier d'exemple. | Ouvrir un contrat de prêt et son échéancier. Dans un dossier Trésorier séparé, essayer un dépôt puis un retrait ; dans un portefeuille de démonstration avec une position prêtée, préparer un achat puis une vente avec cours fictifs. Aucun contrat réel signé. | Remboursement, livret et conditions de spécialité, Bourse, Crypto, frais, résultat d'une position. Les gains ne financent jamais obligatoirement l'histoire. |
| Les gens du quartier | « Ici, chacun avance à sa manière. Tu peux regarder les défis, aider et suivre tes progrès. » | Ouvrir sa carte de personnage fictive, essayer les apparences et comparer les quatre spécialités. Consulter carrière, un défi, une mission de communauté et un détail de classement. | Défi donnant une carte, pack ouvert depuis le reçu, mission soumise à validation simulée, badges, saison, duel officiel expliqué sans attente d'adversaire. |
| Le carnet sur l'étagère | « La ferme te fait jouer. Le Carnet, lui, raconte les fleurs que tu as vraiment découvertes. » | Remplir une fiche de dégustation fictive, consulter un parcours producteur et une carte Héritage, puis ouvrir Collections pour distinguer Buddies, soutiens et Héritages. | Récompenses après avis éligible approuvé, objectifs producteurs, collection et doublons, sources de packs et fidélité. Aucune dégustation réelle inventée, aucun avis publié. |

Les dossiers bancaires, les plans prêtés et les lots des rencontres avancées sont des prêts de scène. Ils ne remplacent ni le personnage de la ferme ni les résultats de sa campagne. Leurs effets restent dans leur dossier, avec retour explicite au registre commun. Le lot de secours éventuellement proposé aux chapitres 7 et 8 suit une autre règle : il est explicitement ajouté à l'inventaire de la ferme d'essai, avec une ligne de prêt dans le registre ; ses coûts, stocks et ventes suivent alors le budget commun. Dans les autres scènes de l'aventure, le même stock, le même budget et les mêmes reçus suivent le joueur.

### Conclusion écrite

Sylvain referme doucement le registre. La dernière page montre le plan choisi, les Buddies cultivés et la première livraison. Plus loin, plusieurs pages portent les projets que le joueur a seulement préparés.

> « Ton grand-père t'a laissé des murs et des pages blanches. Tu as commencé à y mettre ta façon de faire. »
>
> « Tu sais où cultiver, où vendre, où demander un coup de main et où vérifier tes comptes. La prochaine décision, je te la laisse. »

Le joueur choisit son prochain projet : **Préparer une campagne**, **Développer mon commerce**, **Compléter mes collections** ou **Explorer librement**. Ce choix règle le prochain conseil, sans créer un bonus caché.

Avant de rejoindre son compte, un récapitulatif montre son inventaire réel et les éléments de l'exercice qui restent fictifs. Un compte existant reprend son état actuel ; une personne sans compte peut continuer à s'entraîner. Le récit ne remplace jamais une installation réelle par la grange vide de l'introduction.

## Budget de la première grange

Le budget proposé de 2 000 € est une dotation de simulation pour les équipements et le fonctionnement, distincte des soldes réels de départ des spécialités. La rénovation intégrale du bâtiment est prise en charge par la scène d'introduction avant ce budget : le moteur ne chiffre pas le gros œuvre, les revêtements ni ce chantier. Aucun coût, crédit ou financement réel n'est inventé. Le compte réel possède déjà une installation initiale ; la chambre rénovée encore vide sert à comprendre comment choisir et installer les équipements.

Les prix des zones et des équipements sont calculés par le moteur de l'Entrepôt. Les dialogues utilisent des valeurs injectées au moment du devis. Au 16 octobre 2026, la préparation supplémentaire coûte 120 € par m² et la pose représente 15 % du matériel nouvellement acheté. Ces postes de jeu concernent l'aménagement des zones dans le local déjà rénové ; ils ne financent pas sa remise à neuf. L'équipement en réserve est réutilisé ; un déplacement ne se raconte pas comme un rachat complet.

Le coach distingue trois montants : **À payer pour ce plan**, **Charges estimées de la campagne**, **Disponible après ces engagements**. Il précise le dénominateur des valeurs par m² : surface aménagée du devis ou surface active de culture. Les charges ne sont pas toutes des prélèvements immédiats ; les échéances sont reprises des factures du moteur.

Les exemples suivants partent d'une chambre entièrement rénovée mais encore vide d'équipements, sans module optionnel, avec extraction et éclairage économiques. Leurs montants excluent le chantier de rénovation de la scène. Ils ne sont pas des promesses de récolte ; le profil des Buddies et les résultats de jeu modifient le potentiel.

| Projet | Aménagement total initial | Énergie par cycle | Consommables par cycle | Potentiel de base avant Buddies et résultats |
| --- | ---: | ---: | ---: | ---: |
| Culture 1 m², séchage 1 m², stockage 1 m² | 729,73 € | 44,70 € | 22,00 € | 250 g |
| Culture 2 m², mêmes services | 1 021,08 € | 82,20 € | 44,00 € | 500 g |
| Deux cultures distinctes de 1 m², mêmes services | 1 077,43 € | 89,40 € | 44,00 € | 500 g |

Les zones de service de cet exemple représentent 1 kg de capacité de séchage et 1,2 kg de stockage. Les charges excluent soins, analyse et autres frais. Le contrôle de lancement tient aussi compte des réservations par lot : une somme de grammes libres ne suffit pas à prouver que chaque lot a une place.

Pour les deux zones distinctes, le scénario provisionne 228,40 € : 89,40 € d'énergie, 44 € de consommables, 90 € d'analyses pour deux cultures terminées et un entretien partagé de 5 €. Après les 1 077,43 € d'aménagement et une réserve supplémentaire de 150 €, il reste 544,17 € sur le budget de 2 000 €, sans compter aucune vente ni récompense. Une seconde zone ajoutée après le premier devis coûte 347,70 € dans cet exemple ; le total reste identique. Cette vérification couvre la voie économique proposée, pas toutes les dépenses libres possibles.

Pour une zone de culture de 2 m² seule, avec extraction économique, la comparaison actuelle donne :

| Éclairage | Investissement de cette zone | Charges par cycle | Lecture proposée à Sylvain |
| --- | ---: | ---: | --- |
| Deux appareils économiques | 639,05 € | 126,20 € | Achat le plus bas de cette comparaison. |
| Un appareil standard | 674,70 € | 111,20 € | Couverture utilisée, charges plus basses et +1 qualité initiale. |
| Un appareil haut de gamme | 1 157,70 € | 151,20 € | +2 qualité initiale, mais couverture sous-utilisée sur cette surface. |

Le joueur n'a pas à mémoriser ces chiffres. Il doit apprendre à comparer le devis complet, le matériel déjà possédé, les charges et le résultat estimé. Les chiffres d'illustration seront recalculés si l'équilibrage change ; les validations d'un chapitre ne doivent pas dépendre d'un prix inscrit en dur.

## Règles de cohérence

| Sujet | Règle à conserver dans le récit |
| --- | --- |
| Monnaies | Distinguer euros de jeu, points fidélité dépensables et points de progression ou de saison. Chaque pack annonce le solde réellement débité ; aucun portefeuille « points de packs » supplémentaire n'est inventé. Aucun solde de points réel n'est utilisé par la simulation. |
| Buddies | Une carte représente une variété, ne garantit pas un résultat et peut être indisponible. Un pack peut contenir des doublons. Les conditions des sources réelles sont affichées, sans imposer une commande. |
| Campagne | Les zones actives et affectées participent ensemble avec des Buddies distincts. Les décisions sont communes ; les résultats par zone conservent leur matériel et leur profil. |
| Cartes | La préparation ne brûle pas les soutiens. Les cartes effectivement jouées sont consommées dans l'exercice ; les Héritages restent permanents. |
| Rénovation | Tout l'intérieur est rénové avant la première plante. Le chantier est pris en charge dans la simulation, sans coût ou financement réel inventé. L'investissement progressif concerne ensuite les équipements et les surfaces actives. |
| Installation | Les surfaces de culture, séchage et stockage ont leurs propres usages. Posséder du matériel de service sans le placer ne crée pas sa capacité. |
| Santé | Consulter est gratuit. Le coût, le moment et l'effet des interventions sont ceux du jeu. L'assistance du didacticiel est annoncée. |
| Jury | Victoire du duel et note commerciale sont distinctes. Une Fleur ne sert qu'une fois au duel ; le lot commercial reste à gérer. |
| Stockage | Affinage de six heures dans le jeu actuel, ellipse explicite dans l'essai. Pas de liquidation automatique du surplus du nouvel entrepôt. |
| Commerce | Boutique de base gratuite ; ordinateur prêté dans le scénario, emballages comptabilisés. Frais, qualité et quotas du moteur ; aucun revenu garanti. |
| Missions | Première récolte actuellement récompensée par 50 € de jeu. Cash, carte et pack ont des conditions distinctes ; une récompense ne se récupère qu'une fois. |
| Personnage | Les quatre spécialités se découvrent avec un personnage fictif. Le choix définitif du compte n'est jamais déclenché par une simple scène. |
| Classement | Distinguer duel, saison, réputation et développement d'entreprise. La trésorerie disponible n'est pas le score. |
| Carnet | Les fiches réelles parlent des fleurs réellement dégustées. Le lot cultivé dans Kanab Quest ne donne pas matière à publier un avis réel. |
| Transmission | La ferme du grand-père est le ressort du récit ; elle n'attribue pas une carte de la famille Héritage. |

## Interface pendant les actions

La grande illustration sert à entrer dans une scène et à montrer son résultat. Dès que le joueur agit, l'écran de jeu actuel occupe l'espace ; Sylvain devient un portrait compact avec une seule consigne. Le coach peut être réduit et reste accessible dans les fenêtres de devis, de vente ou de pack.

Une consigne annonce une action concrète : **Trace une zone de stockage**, **Affecte ce Buddie**, **Ouvre le reçu**. Le bouton **Me montrer** désigne le contrôle concerné sans acheter, lancer ou valider à la place du joueur. Une action réussie fait avancer l'objectif automatiquement ; un simple bouton Suivant ne remplace pas sa réussite.

Les choix libres influencent les valeurs et les réactions : surface, équipement, Buddie, soins, prix, quantité vendue. Les choix de dialogue peuvent changer une phrase de Sylvain ; ils n'ont pas d'effet économique dissimulé. Les textes disent ce qui s'est réellement passé, y compris en cas de mauvaise récolte ou de vente nulle.

Sur mobile, une seule action principale est proposée dans le coach ; aucun panneau ne masque le bouton de confirmation. Toutes les actions ont une alternative au glisser-déposer et au survol, des cibles d'au moins 44 px et un focus visible. Les animations sont courtes, désactivables avec les préférences de mouvement réduit, et les dialogues restent lisibles sans effet de machine à écrire. La couleur n'est jamais le seul indicateur de réussite.

Le registre affiche les neuf chapitres et les six rencontres avec les états **À découvrir**, **En cours**, **Terminé** ou **Passé**. Un retour donne une phrase utile : « Ton plan est enregistré. Il reste à affecter un Buddie à la zone près de la porte. » Il ne rejoue pas l'introduction complète.

## Illustrations et mise en scène de Sylvain

La nouvelle planche d'intention [De la grange à la chambre de culture](assets/ferme-didacticiel-storyboard-v2.png) fixe le contraste entre l'ancienne étable et sa rénovation intégrale en espace de culture professionnel. Elle remplace la première proposition, qui conservait un intérieur d'étable autour des plantes. Ses panneaux ne sont pas des plans techniques ni des écrans de jeu. Les variantes finales suivent l'ordre du récit : ancienne grange, local entièrement rénové et vide, équipement des zones, puis seulement culture et récoltes. Pour la fin du chapitre 2, les supports et rangements sont équipés mais encore vides.

Conserver l'extérieur de la grange actuelle : pierre crème, grandes portes turquoise, toiture d'ardoise, cour bretonne, hortensias et ajoncs. L'emplacement de la porte, les ouvertures et le volume du bâtiment permettent de reconnaître le lieu entre avant et après. La mangeoire, la paille, les cloisons d'élevage et les poutres rustiques apparentes appartiennent exclusivement à l'état avant travaux.

Après rénovation, montrer un sol lisse et propre, des parois et un plafond techniques blancs, des installations et rangements professionnels, des allées dégagées et des zones de séchage et de stockage séparées de la culture. Aucun mur intérieur en pierre brute, paille résiduelle ou accessoire d'élevage ne décore cet espace. Le chantier est terminé sur les 100 m² même lorsque seule une petite surface est équipée et active. La progression visuelle ajoute du matériel et des cultures dans cet intérieur fini ; elle ne repousse pas une partie de la rénovation à plus tard. Conserver les contours noirs et le dessin de Sylvain, avec des accents turquoise et ocre sur les équipements, sans réintroduire l'ambiance rustique à l'intérieur.

Sylvain conserve le visage, les proportions, la casquette et les couleurs de la mascotte existante. Le grand-père reste présent par sa lettre et son registre ; il n'est pas nécessaire d'inventer un deuxième personnage dessiné pour lancer le récit. Le personnage du joueur peut être personnalisé dans le jeu sans imposer son apparence dans les illustrations.

| Illustration | Mise en scène | Fonction |
| --- | --- | --- |
| Les clés | Sylvain devant la grange, clé tendue, registre sur une caisse. | Entrée du récit et fin en écho. |
| L'ancienne grange | Même bâtiment avant travaux, cloisons d'élevage, mangeoire et paille ; aucune plante. | Montrer ce qui doit entièrement disparaître de l'intérieur. |
| La rénovation terminée | Sylvain dans les 100 m² vides, sol lisse propre, parois et plafond techniques blancs, aucun vestige rustique. | Montrer la transformation intégrale avant tout équipement ou culture. |
| Le premier tracé | Sylvain avec le mètre dans le local rénové ; zones de culture, séchage et stockage distinctes, circulations libres. | Choisir les surfaces actives après rénovation complète. |
| Le devis | Sylvain au registre sur un plan de travail professionnel, matériel à comparer à côté. | Relier dépenses et équipement ; les chiffres restent en HTML. |
| L'album ouvert | Sylvain présente les cartes dans la chambre rénovée ; les vrais Buddies apparaissent dans l'interface. | Acquisition, lecture et affectation. |
| L'observation | Sylvain près d'une installation de culture professionnelle, dans l'intérieur blanc et propre. | Introduire la santé et l'imprévu sans retour au décor d'étable. |
| Les premières récoltes | Sylvain dans les espaces séparés de séchage et de stockage, supports et contenants rangés, lots distincts. | Conservation, quantité et résultats. |
| La première livraison | Sylvain au plan de préparation propre, avec un paquet, un reçu et le registre ; culture à part. | Donner une récompense narrative à la vente. |
| La relève | Même cadrage extérieur que l'arrivée, porte ouverte sur l'intérieur entièrement rénové et les équipements choisis. | Montrer la transformation complète et la place pour les investissements suivants. |

Les scènes existantes de banque, commerce, jury, Carnet et quartier sont réutilisées pour les rencontres. Prévoir quelques attitudes de Sylvain — accueil, observation, explication, encouragement — plutôt qu'une nouvelle grande image pour chaque clic. Aucun dialogue, prix, bouton ou nom de boutique n'est dessiné dans le bitmap.

Références : [grange actuelle](../../public/placard/map/culture-barn-sylvain-v1.webp) pour l'extérieur uniquement, [quartier](../../public/placard/map/placard-world-sylvain-v6.webp) pour le contexte breton, [entrepôt de 100 m²](../../public/placard/warehouse-v4/overhead-room-100m2-sylvain-v1.webp) pour la géométrie et la vue du plan uniquement. Son intérieur rustique n'est pas la cible visuelle de la chambre rénovée. La [mascotte](../../public/sylvain.png) et [Sylvain au bureau de l'Arène](../../public/contest/map/arena-desk-sylvain-v6.webp) restent les références du personnage et du trait. Les illustrations de culture réutilisées doivent montrer les équipements dans le nouvel intérieur professionnel.

## Architecture de la refonte

Le récit repose sur **une session locale commune** : état de rénovation du décor, plan de ferme, inventaire, budget, Buddies, campagne, récoltes, stockage, annonces, horloge et journal des actions. L'état de scène distingue l'ancienne étable, le local vidé et l'intérieur entièrement rénové ; les plantes et les activités de culture apparaissent seulement dans ce dernier. La rénovation n'ajoute ni transaction ni règle au moteur économique. Les chapitres partagent cet état. Les rencontres qui nécessitent un autre profil ou un autre niveau utilisent un dossier d'exemple explicitement séparé, puis reviennent à la ferme.

Les composants actuels doivent recevoir le contexte d'essai sans être redirigés vers leurs versions historiques. Cela implique d'adapter le nouvel Entrepôt, la préparation de campagne et le nouveau hub Commerce au transport local, et de compléter les données de vente en ligne du scénario. Tous les liens internes de ces composants restent dans la session d'essai ; les boutons de stock ou de registre ne renvoient pas vers le compte réel.

Un chapitre est défini par son identifiant stable, sa scène, ses dialogues, les actions attendues, la condition de réussite, les aides, le point de reprise et l'illustration. Les mêmes définitions alimentent **Commencer l'histoire**, **Reprendre** et **Essayer une activité**. Le guide écrit devient le résumé de ces règles, au lieu de garder un second scénario.

La progression est enregistrée après les actions validées. Les opérations utilisent des identifiants pour éviter les doubles achats ou récompenses au rechargement. Une interruption au milieu d'un devis restaure le brouillon ; elle ne confirme rien. Le stockage local est versionné et séparé de celui du compte. Le parcours fonctionne sans compte et sans appels aux API de gameplay réelles ; le chargement des écrans et des images requiert toujours leur accès réseau. Un mode hors ligne complet nécessiterait un cache et une recette spécifiques. Une sauvegarde sur le serveur ne sera promise qu'après création et validation d'un format complet, distinct du simple statut de tutoriel actuel.

Le retour à une ancienne scène consulte l'état courant. **Rejouer ce passage** ouvre une copie de son point de contrôle et indique que ses résultats ne remplacent pas ceux de l'histoire en cours. Une sauvegarde incompatible propose une nouvelle copie de la simulation ; elle ne touche jamais aux données réelles.

L'accès au jeu réel conserve ses règles de compte et d'ouverture. La sortie de l'essai propose l'action pertinente selon l'état réel : reprendre une campagne, voir ses Buddies ou consulter son installation. Elle ne copie pas le portefeuille, les cartes ou les récoltes de démonstration.

## Recette avant intégration complète

Les vérifications doivent porter sur le comportement enseigné, pas seulement sur la présence d'une phrase.

1. Départ sans compte, première action rapide, histoire jouable avec les vrais écrans actuels et aucune requête de gameplay réelle.
2. Devis comparés sans débit, achat unique à confirmation, reprise après rechargement sans paiement supplémentaire, réserve réutilisée après déplacement.
3. Buddie indisponible, doublon et zone inactive expliqués ; participants de campagne conformes au plan enregistré.
4. Parcours réalisable avec une ou deux zones, budget réduit par des choix libres et navigateur sans stockage disponible.
5. Mauvais tirage, culture perdue, quota épuisé, lot de qualité insuffisante ou absence de commande : aide, reprise ou lot pédagogique explicite ; aucune impasse.
6. Même récolte suivie du verdict au stockage puis à la vente ; toutes les ellipses sont fictives et les frais suivent le moteur.
7. Achèvement de chaque chapitre conditionné par l'action attendue ; passé, découvert et terminé restent distincts.
8. Récompense de mission du bon type, sans double attribution ; aucun gain du scénario annoncé comme récompense réelle.
9. Sorties des fenêtres, navigation mobile et clavier, mouvement réduit, focus et coach visibles aux largeurs 320, 390, 768 et 1440 px.
10. Banque, placements, Carnet et spécialités restent dans leurs dossiers fictifs ; passage vers le compte réel explicite et sans changement automatique.
11. Rénovation intégrale avant toute plante : après les travaux, intérieur professionnel blanc, sol propre, séchage et stockage séparés, allées dégagées et aucun vestige d'étable. Le budget d'équipement reste intact pendant la transition ; une reprise conserve le bon état du décor.

## Sources du fonctionnement actuel

- [Géométrie, devis, charges et installation initiale](../../src/lib/kanab-quest-warehouse.ts), [catalogue](../../src/lib/kanab-quest-warehouse-catalog.ts), [modules](../../src/lib/kanab-quest-warehouse-options.ts).
- [Participants et résultats par Buddie](../../src/lib/kanab-quest-campaign.ts), [disponibilité et rotation](../../src/lib/kanab-quest-buddie-rotation.ts), [interface d'affectation](../../src/components/placard/KqWarehouseCulture.tsx).
- [Culture et soins](../../src/lib/kanab-quest-game.ts), [modèle de soins](../../src/lib/kanab-quest-care.ts), [suppression de la vente automatique du surplus](../../supabase/migrations/20261012000300_kq_warehouse_storage.sql).
- [Nouvelle boutique](../../src/components/placard/KqMarketHub.tsx), [activité en ligne](../../src/components/placard/KqOnlineBusiness.tsx), [demandes clients](../../src/lib/kanab-quest-customer-demand.ts).
- [Missions et récompenses](../../src/lib/kanab-quest-missions.ts), [personnage et spécialités](../../src/lib/arena-chanvrier.ts), [score actuel](../../src/lib/kanab-quest-reputation.ts).
- [Packs Buddies](../../src/components/placard/KqBuddiePackShop.tsx), [collection et prix en points](../../src/lib/lottery-collection.ts), [récompenses du Carnet](../../src/components/contest/ProducerRewardJourney.tsx).

La nouvelle planche a été générée avec l'outil intégré imagegen. Le [prompt et ses références](assets/ferme-didacticiel-storyboard-v2.json) sont conservés pour produire les déclinaisons cohérentes.
