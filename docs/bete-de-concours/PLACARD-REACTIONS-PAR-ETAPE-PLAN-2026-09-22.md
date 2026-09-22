# Illustrations des verdicts de culture — analyse et plan

Date : 22 septembre 2026.
Statut : mise en œuvre et vérifications locales terminées le 22 septembre 2026 après validation du plan.

## Mise en œuvre réalisée

Les **29 images finales** sont intégrées : 24 verdicts (six étapes × quatre résultats), plus cinq cultures mortes. Le catalogue partagé utilise le dernier `history.stage/outcome` validé et donne priorité à `cultureDead`. Il est utilisé par la partie normale, le tutoriel et la revue artistique admin.

La culture reste au stade joué, quel que soit le résultat ou la carte : graine en Germination, plantule en Enracinement, végétation sans fleurs en Croissance, plante fleurie en Floraison, branches coupées à la Récolte, puis lot suspendu et bocal au Séchage & affinage.

### Livrables

- Génération avec **image_gen intégré**, référence d’identité `public/sylvain.png`. Quatre pilotes, deux scènes maîtresses complémentaires, variantes et corrections ciblées.
- [Prompts complets, références, inventaire et retouches](placard-outcomes-v3-prompts.json).
- Images du site : `public/app/kanab-quest/reactions/stages-v3/`. Sources PNG : `output/imagegen/placard-outcomes-v3/source/`.
- [Planche des 24 verdicts](../../output/imagegen/placard-outcomes-v3/outcomes-contact-sheet.webp) et [planche des cinq morts](../../output/imagegen/placard-outcomes-v3/death-contact-sheet.webp).
- 29 WebP uniques et opaques, 768 × 768 px, qualité 86, de 93 208 à 147 110 octets ; total 3 573 324 octets. Tous respectent le plafond de 180 Kio.
- Export reproductible : `node scripts/prepare-placard-outcomes.mjs`. Les sources transparentes sont refusées, sans aplatissement automatique.

### Vérification

- **72 tests passent** : catalogue, revue artistique, qualité image, mort de culture et tutoriel. Qualité repassée après la dernière retouche.
- TypeScript, ESLint sur les scripts et fichiers TypeScript/React concernés, et vérification des espaces du diff : sans erreur.
- **105 vues contrôlées** : 29 verdicts jeu et six états tutoriel à 320, 390 et 1440 px. Bon chemin, chargement, texte alternatif, cadrage `contain`, dimensions, visibilité réelle en cinq points et absence de débordement vérifiés.
- [Rapport navigateur complet](../../output/placard-outcomes/report.json) et [six captures revérifiées après la dernière retouche](../../output/placard-outcomes/report-sechage-affinage-fragile.json).
- Examen visuel des images, des planches et des captures : [Germination mobile](../../output/placard-outcomes/germination-critical-320-card.png), [Croissance mobile](../../output/placard-outcomes/croissance-success-320-card.png), [Floraison ordinateur](../../output/placard-outcomes/floraison-critical-1440-card.png), [Séchage fragile mobile](../../output/placard-outcomes/sechage-affinage-fragile-320-card.png).
- Audit reproductible : `node scripts/audit-placard-outcomes.mjs`. Composants React/CSS réels et parseur de sauvegarde dans Vite isolé, avec adaptation de `next/image`. Cela ne valide pas l’optimiseur Next en production. Aucun compte réel ni appel API distant utilisé.

Aucune migration supplémentaire nécessaire pour la refonte visuelle. Modifications livrées dans le dépôt local ; aucun déploiement effectué ici.

La suite conserve l’analyse initiale et le plan mis en œuvre.

## Objectif

Chaque résultat doit montrer Sylvain reconnaissable et une plante, une graine ou un lot correspondant à l’étape qui vient d’être résolue. La réussite peut changer l’expression et la vigueur visible ; elle ne fait jamais passer la plante au stade suivant. Un échec ordinaire laisse la culture vivante. La mort est un résultat terminal distinct.

Direction artistique retenue lors du lancement : Sylvain fidèle à la mascotte d’origine, avec des gestes, volumes et plantes crédibles.

## Diagnostic initial vérifié avant refonte

- `src/components/placard/KanabQuestDicePrototype.tsx` définit quatre images globales dans `OUTCOME_COPY`. Leur sélection dépend seulement de `state.lastOutcome` : `critical`, `success`, `fragile`, `failure`.
- Les quatre fichiers utilisés dans `public/app/kanab-quest/reactions/` sont des carrés de 720 px. Ils pèsent environ 108 à 149 Kio chacun.
- L’image exceptionnelle montre une plante très fleurie à toutes les étapes. Les autres réactions montrent une plante déjà développée. Aucune n’est adaptée à une graine, à une jeune plantule ou à un lot au séchage.
- Les yeux, contours du visage, proportions et vêtements varient par rapport à `public/sylvain.png`. L’image exceptionnelle introduit notamment de grands reflets blancs dans les yeux, différents de la référence.
- Le jeu a six étapes : Germination, Enracinement, Croissance, Floraison, Récolte, Séchage & affinage.
- Les 50 illustrations de situation sont déjà sélectionnées séparément par leur code. Les six illustrations de stade servent de repli. Elles ne corrigent pas le verdict affiché à côté.
- `Palissage doux` est une carte. Le tag technique `flower` est également utilisé en Croissance : ni ce tag ni la carte jouée ne permettent de choisir le stade visuel.
- Le verdict est présenté dans une petite fenêtre carrée de 150–220 px, jusqu’à 170 px sur mobile, avec `object-fit: cover`. La graine et le visage doivent rester lisibles à cette taille.
- Le tutoriel affiche actuellement l’image de situation puis un verdict textuel, sans illustration propre au résultat.
- La nouvelle mort de culture passe directement en phase `complete` et possède un écran séparé sans illustration. Le panneau de verdict ordinaire n’est pas affiché dans ce cas.
- Les réactions ne figurent pas dans le manifeste de revue artistique ni dans les tests de qualité des images : elles doivent y être ajoutées.

## Série à produire

Socle recommandé : **24 illustrations**, soit six étapes et quatre résultats par étape. Complément terminal : **cinq illustrations de mort**, soit **29 images finales** au total.

La mort ne peut pas survenir à la première étape : deux étapes validées à zéro sont nécessaires. Elle est donc illustrée de l’Enracinement au Séchage & affinage.

| Étape | Sujet commun aux quatre verdicts | Mort | Total final |
| --- | --- | --- | --- |
| 1. Germination | Graine entrouverte, radicule ou toute petite sortie de terre ; jamais de feuillage développé ni de fleurs | Impossible à cette étape | 4 |
| 2. Enracinement | Petite plantule, premières feuilles et jeune motte ; aucune fleur | Plantule perdue | 5 |
| 3. Croissance | Plante végétative avec branches et feuilles, silhouette compatible avec le palissage ; aucune fleur | Plante végétative perdue | 5 |
| 4. Floraison | Plante en floraison avec branches portant des fleurs ; pas de lot déjà récolté | Plante fleurie perdue | 5 |
| 5. Récolte | Fleurs mûres et récolte sur une table ou dans un plateau ; aucune jeune pousse | Récolte perdue | 5 |
| 6. Séchage & affinage | Branches coupées suspendues ou fleurs récoltées en bocal ; aucune plante vivante en pot | Lot perdu, pas une plante fanée sous lampe | 5 |

Les quatre colonnes de verdict sont :

- **Réussite exceptionnelle** : Sylvain très satisfait ; résultat particulièrement net au même stade botanique.
- **Réussite** : Sylvain serein ; plante ou lot en bon état au même stade.
- **Fragile** : Sylvain soulagé mais vigilant ; stress ou imperfection modérée, culture viable.
- **Échec** : Sylvain préoccupé ; complication visible, culture encore vivante.

Une réaction n’invente pas systématiquement une opération corrective : éviter, par exemple, de montrer un arrosoir après n’importe quel échec. Les outils visibles doivent convenir à la scène. Une variante spécifique à une situation pourra être ajoutée ultérieurement si un geste précis doit être représenté ; elle devra conserver le stade de base.

La germination du jeu inclut aussi des situations de semis. Une minuscule plantule est donc possible, sans montrer une plante adulte. Le cadrage rend la graine ou la plantule lisible sans la grossir artificiellement jusqu’à une taille invraisemblable.

## Direction artistique

1. Prendre `public/sylvain.png` comme référence d’identité principale : silhouette ronde, yeux noirs verticaux à encoche, nez et sourire caractéristiques, cheveux noirs, casquette turquoise/beige à visière noire, palette ocre/turquoise et ombres pointillées.
2. Fixer une tenue unique pour la série ; ne pas mélanger les variantes de l’avatar personnalisable avec la mascotte des scènes de culture.
3. Conserver cette identité dans toutes les expressions. Une réussite exceptionnelle change la posture et le sourire, pas la forme des yeux ni l’âge du personnage.
4. Harmoniser mains, accessoires, éclairage, matériaux et échelle de la plante. Employer un cadrage plus proche pour les premiers stades et un cadrage adapté aux branches ou bocaux aux derniers.
5. Préserver une place suffisante pour le végétal. Le stade doit se comprendre sans lire le titre ; Sylvain ne doit pas masquer l’information principale.
6. Garder textes, chiffres, étincelles du triple 6 et bordures de résultat dans l’interface. Les nouveaux fichiers sont des scènes, sans texte généré ni encadrement dessiné qui doublerait le cadre CSS.

## Production des images

### 1. Références et pilotes

Préparer une fiche personnage et une fiche des six stades. Ce sont des documents de travail, distincts des 29 fichiers du jeu.

Produire d’abord quatre scènes pilotes :

- Germination / réussite exceptionnelle : preuve qu’un très bon résultat reste une graine ou une minuscule pousse.
- Croissance / réussite : plante végétative clairement reconnaissable, compatible avec une situation de palissage.
- Floraison / échec : plante fleurie en difficulté, encore vivante.
- Séchage & affinage / fragile : lot déjà récolté, contexte et expression cohérents.

Examiner ces pilotes en grand et à 170 px pour fixer ressemblance, cadrage et lisibilité avant de décliner la série. Les pilotes retenus comptent dans les 24 résultats ; ils ne s’y ajoutent pas.

### 2. Déclinaison

Utiliser l’outil intégré `image_gen` conformément au skill imagegen. Fournir explicitement la référence d’identité et la scène de référence du stade. Produire un fichier par résultat, puis examiner chaque fichier.

Pour chaque étape, partir de la même base et verrouiller l’âge de la plante, la tenue, la disposition et l’éclairage lors des variantes. Conserver les prompts et le rôle de chaque référence. Produire ensuite les cinq résultats terminaux.

Gabarit de consigne à décliner :

> Illustration de verdict pour le jeu Le Placard. Référence d’identité : Sylvain d’origine. Étape : [étape résolue]. Sujet végétal autorisé : [état du tableau]. Résultat : [verdict]. Réaction : [expression et geste]. Conserver l’identité du visage, la tenue et le stade ; modifier seulement ce qui exprime le résultat. Visage et végétal lisibles dans un carré de 170 px. Aucun texte ni cadre intégré. Aucun végétal d’un stade ultérieur. Un échec non terminal ne montre pas une culture morte.

### 3. Export et rangement

- Sources de génération dans `output/imagegen/placard-outcomes-v3/source/`.
- Prompts et inventaire dans un document JSON versionné sous `docs/bete-de-concours/`.
- Fichiers du site dans `public/app/kanab-quest/reactions/stages-v3/`.
- Noms prévus : `germination-critical.webp`, `croissance-success.webp`, `floraison-failure.webp`, `sechage-affinage-fragile.webp`, `enracinement-dead.webp`, etc.
- Sources carrées d’au moins 1024 px ; export initial 768 × 768 WebP, poids cible inférieur à 180 Kio par image, à ajuster selon le contrôle visuel.
- Garder les versions actuelles jusqu’à la bascule complète pour permettre un retour simple.

## Intégration technique

### Catalogue central

Créer `src/lib/kanab-quest-outcome-artwork.ts` avec :

- une correspondance exhaustive des six `KqStage` et quatre `KqOutcome` ;
- les cinq illustrations terminales, explicitement limitées aux étapes possibles ;
- pour chaque entrée : chemin, texte alternatif, stade et verdict ;
- un sélecteur partagé entre partie normale, tutoriel et revue artistique.

La sélection repose sur **le dernier événement validé de `history`**, avec son `stage` et son `outcome` final. `cultureDead` a priorité pour choisir l’illustration terminale. En cas d’historique ancien incomplet, utiliser le stade courant validé et un repli du même stade, jamais l’ancienne image fleurie générique.

Ne pas déduire la maturité de la qualité, des XP, du tag `flower`, de la carte jouée ou des dés provisoires. Les Héritages peuvent changer le verdict à la résolution : `previewKqResolution` ne doit pas choisir l’illustration finale.

### Écrans concernés

1. `KanabQuestDicePrototype.tsx` : séparer les libellés de `OUTCOME_COPY` des images ; appeler le catalogue pour le panneau résolu ; utiliser le visuel terminal dans l’écran Culture morte.
2. `KqGuidedTrial.tsx` : afficher les mêmes illustrations aux verdicts et à la mort, sans changer la progression du tutoriel.
3. CSS des deux composants : cadrage carré stable, sujet complet, lisibilité mobile, animations compatibles avec la réduction des mouvements.
4. `kanab-quest-artwork-review.ts` et interface admin associée : ajouter une catégorie Réactions, triée par étape puis verdict, incluant les cinq morts.
5. Contrôles de production : inclure ces références dans les tests de dimensions, poids et présence des fichiers.

La réussite d’un palissage à l’étape 3 montre donc la variante **Croissance / résultat obtenu**. À l’étape 4, elle montre **Floraison / résultat obtenu**. La plante reste au stade qui vient d’être joué pendant l’affichage du verdict ; la progression intervient avec « Étape suivante ».

La production initiale porte sur les 29 verdicts. Vérifier aussi les scènes de situation et les six images de repli affichables côte à côte, puis relever les éventuelles corrections ciblées. Leur régénération complète n’est pas incluse dans ce décompte.

Aucune migration Supabase ni modification des règles de jeu n’est nécessaire : le stade, le verdict final et la mort sont déjà enregistrés.

## Vérification et critères de fin

### Tests fonctionnels

- Les 24 couples étape/verdict existent, les cinq morts atteignables sont couvertes et tous les fichiers sont présents.
- Une réussite exceptionnelle en Germination choisit une scène de Germination.
- Les scénarios de palissage en Croissance et Floraison sélectionnent des végétaux de ces stades respectifs.
- La validation conserve le stade résolu ; « Étape suivante » change seulement la scène de l’étape suivante.
- Une réaction jouée après le lancer et un Héritage qui modifie le verdict utilisent le résultat final validé.
- Le premier zéro reste non terminal ; le deuxième affiche la mort, y compris si le verdict a été transformé en fragile.
- Le séchage montre toujours un lot récolté, pour chaque résultat et pour la mort.
- La reprise d’une sauvegarde résolue retrouve la même illustration.
- Partie normale et tutoriel utilisent le même catalogue.

### Examen visuel

Produire une planche de 6 lignes × 4 colonnes et une seconde rangée pour les cinq morts. Vérifier systématiquement les visages, les mains, la maturité, la viabilité du végétal et la cohérence des outils. Les contrôles automatiques ne prouvent pas ces qualités.

Capturer les verdicts dans le jeu sur mobile 320/390 px et sur ordinateur. Contrôler spécialement les graines, les racines et les bocaux, les recadrages, les textes alternatifs et les images manquantes. Charger les illustrations à la demande via Next/Image avec des dimensions stables.

## Ordre de mise en œuvre

1. Fixer la référence de Sylvain et les six stades visuels.
2. Produire et examiner les quatre pilotes.
3. Décliner les 24 résultats puis les cinq morts ; exporter et documenter les fichiers.
4. Ajouter le catalogue typé et les tests de sélection.
5. Intégrer partie normale, mort, tutoriel et revue admin.
6. Examiner les 29 variantes en grille et dans le jeu, corriger les écarts, puis basculer les références de production.
