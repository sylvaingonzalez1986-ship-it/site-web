# Audit de l’encyclopédie et du quiz

14 novembre 2026 — audit et propositions uniquement. Aucun code produit modifié.

## A. Diagnostic

Le sentiment de désordre est **partiellement confirmé** : le contenu est structuré, mais lire, jouer et revenir ne forment pas un parcours continu. Le tournoi impose un rythme incompatible avec la révision : sur mobile, les pupitres précèdent les réponses et la correction disparaît avant sa relecture. L’encyclopédie cumule les commandes et perd certains repères à la reprise.

À conserver : illustrations, papiers et enseignes, articles aérés sur ordinateur, sources documentées, recherche normalisée, index distincts et états compréhensibles sans couleur. Le retour aux résultats restaure utilement le contexte. Les scores sont calculés côté serveur ; les validations répétées n’ajoutent pas de points dans les essais.

Périmètre actif : **9 rubriques, 52 articles, 137 fiches, 160 termes et 360 QCM**, dix thèmes et quatre niveaux. Le **tournoi à quatre** est le seul quiz accessible ; les anciens quiz solo et cursus sont archivés.

Couverture : trois articles et douze questions relus, navigateur à 320/390/1440 px, tournoi complet fictif et essais de reprise. Trois spécialistes GPT‑6.1 Sol, effort medium : apprentissage, UI, UX ; navigateur piloté uniquement par le coordinateur. Inspection experte, sans participants joueurs.

## B. Problèmes prioritaires

**O** : observé ; **C** : établi par le code ; **H** : hypothèse. P1 : obstacle ; P2 : amélioration utile. Effort S : local ; M : plusieurs composants ou persistance ; L : nouveau système. Preuves détaillées plus bas.

| Parcours et preuve | Conséquence pour le joueur | Correction proposée | Priorité / effort |
|---|---|---|---|
| **1. Répondre sur mobile — O/C, E1** : réponses sous le premier écran lorsque le temps démarre. | Une partie des vingt secondes sert à chercher les choix. | Faire défiler vers la question ; compacter scores et participants pendant la réponse, garder les grands pupitres entre les manches. | **P1 / M**, disposition et focus à vérifier ensemble. |
| **2. Comprendre la correction — O/C, E2** : six secondes, explication sous les quatre choix ; aucun récapitulatif final. | Comprendre impose de quitter une partie qui continue ; l’erreur devient ensuite inaccessible. | Montrer immédiatement réponse correcte, choix personnel et explication ; conserver un carnet de correction après élimination ou finale. | **P1 / M**, vue et données de révision. |
| **3. Revenir à Histoire — O/C, E3** : rubrique absente de la liste de restauration. | Lien direct et rechargement ramènent aux rubriques. | Dériver les identifiants acceptés du catalogue, avec contrôle des trois entrées. | **P1 / S**, liste dupliquée localisée. |
| **4. Reprendre un article — O/C, E4** : retour forcé au titre, même avec une ancre ; sommaire mobile après l’image. | Perte du passage lu et accès tardif aux sections. | Respecter l’ancre, mémoriser la section atteinte et placer le sommaire replié juste sous le titre. | **P2 / M**, restauration et focus à concilier. |
| **5. Retrouver sa recherche — O/C, E5** : contexte en session, URL inchangée, retour nommé seulement « Encyclopédie ». | Un lien partagé perd la requête ; l’action de retour est ambiguë. | Mettre recherche/rubrique/lettre/page dans l’URL ; afficher « Retour aux résultats pour “folioles” ». | **P2 / M**, synchronisation de navigation. |
| **6. Explorer les terpènes — O/C, E6** : recherche générale, navigation, titre et recherche locale s’empilent avant les cartes. | L’objet recherché arrive tard sur petit écran. | En rubrique, afficher retour compact, titre et outils locaux ; replier la recherche générale derrière une commande explicite. | **P2 / M**, variantes accueil/rubrique. |
| **7. Apprendre la réponse — C, E7** : une explication ne nomme pas la réponse attendue ; une fiche omet le fait demandé. | La lecture ne permet pas de résoudre l’erreur. | Compléter les deux passages avec leurs références ; vérifier question, correction et section liée ensemble. | **P2 / S**, deux corrections éditoriales ciblées. |
| **8. Commencer et évaluer ses acquis — C/H, E8** : les bases arrivent après les rubriques ; compétition et lecture restent séparées. | Un débutant sans question précise manque de point de départ ; un score rapide ne mesure pas la maîtrise. | Remonter « Commencer par la plante » ; proposer une prochaine lecture nommée et des notions à revoir issues des erreurs. | **P2 / S puis M**, guidage d’abord, carnet ensuite. |

Aucun blocage global confirmé. Le défaut Histoire bloque néanmoins l’accès direct à cette rubrique.

## C. Expérience recommandée

**Accueil.** Titre, recherche et deux entrées : « Commencer par la plante » et « Reprendre ma lecture », seulement si une lecture existe. Conserver les neuf rubriques par sujet ; Articles A–Z et Lexique deviennent secondaires. « Articles » explique un sujet ; « Fiches de référence » identifie une molécule, un organisme ou un matériau. Une consultation ne prouve pas la maîtrise.

**Article.** Retour contextualisé, titre, introduction courte et sommaire. Garder le sommaire latéral sur ordinateur ; sur mobile, sa version repliée précède l’illustration. Conserver images, légendes et références. Terminer par une prochaine lecture nommée et permettre de conserver le passage ; les notices des sources restent secondaires.

**Tournoi et résultat.** Pendant une question, prioriser énoncé, temps restant et réponses ; la sélection reste définitive, annoncée clairement. Après validation, montrer le verdict et l’explication avant les options secondaires. Remplacer l’invitation principale à partir lire par « Garder cette fiche pour après » ; l’ouverture immédiate conserve l’avertissement existant. Le résultat distingue score de finale, total du parcours et bonnes réponses. Ajouter « Revoir mes erreurs », puis « Rejouer ». Le titre hebdomadaire reste une récompense de compétition, sans nouveau gain monétaire ni obligation de lire pour participer.

Exemple : **La plante → Racines, tige et feuilles → Une feuille, plusieurs folioles**. Après sa recherche « folioles », le joueur retrouve ses résultats puis lance le tournoi général, sans promesse de questions sur cet article. Une erreur de botanique conserve son explication et sa fiche après la partie : il révise à son rythme sans interrompre la compétition.

## D. Plan de réalisation

Trois interventions rapides :

1. Réparer la restauration de **Histoire**, sans changer le catalogue.
2. Recentrer le **tournoi sur la question** : focus au bon endroit et participants compacts pendant les réponses. Commencer par ce correctif local avant toute refonte du plateau.
3. Corriger l’**article mobile** : sommaire sous le titre et respect des ancres au rechargement.

Puis : **4**, créer le carnet depuis les réponses enregistrées, avec une projection autorisée des questions terminées. **5**, synchroniser URL et reprise ; les libellés de retour en dépendent. Corriger les deux incohérences éditoriales en parallèle, puis alléger les rubriques et remonter l’entrée débutant.

La simplification de l’existant, **S/M**, conserve `KqChapterHeading`, les illustrations de `KqPrintedArt`, les matériaux et les composants de lecture. Une réorganisation en parcours thématiques avec évaluations ciblées demanderait sélection des questions, nouveaux états et suivi pédagogique : **L**. **Recommandation : simplification progressive avec carnet de corrections**. N’envisager des exercices sans chronomètre que si les retours montrent un besoin non couvert ; leur bénéfice serait de vérifier une notion précise, sans ajouter une nouvelle économie de récompenses.

## E. Validation

Critères techniques observables, dans l’ordre du plan :

| Action | Acceptation |
|---|---|
| 1. Histoire | Clic, URL directe, rechargement et retour depuis un article rouvrent Histoire. |
| 2. Question | À 320 px, le focus atteint l’énoncé et les premiers choix sont immédiatement accessibles ; les quatre choix restent lisibles et atteignables au clavier, sans recouvrement par la navigation fixe. |
| 3. Article | Le sommaire précède l’image ; une URL avec ancre revient à la section demandée après rechargement. |
| 4. Corrections | Après élimination/finale et rechargement, chaque réponse jouée conserve choix, verdict, explication et fiche ; aucune question future ni nouveau point n’est exposé. |
| 5. Contexte | Une URL copiée restitue requête, rubrique et page ; précédent/suivant et retour d’article conservent une destination prévisible et un focus utile. |

À vérifier auprès de joueurs : distinction fiche/article, découverte des bases sans aide et explication d’une erreur après révision. Faire essayer découverte, recherche et reprise. Difficultés et distracteurs demandent aussi cette validation ; douze questions ne calibrent pas toute la banque. Aucun gain de rétention n’est déduit.

## Preuves et couverture détaillée

### Références des constats

Les chemins suivants sont relatifs à la racine du dépôt ; les numéros désignent les lignes inspectées.

- **E1** — `src/components/placard/KqSchoolTournament.tsx:204–205,281–293` : défilement vers la phase avant les pupitres. À 320×800, première réponse à y883, quatrième à y1132 dans le viewport, chrono déjà à 18 s. [Question mobile](../output/audit-encyclopedie-quiz/question-320-viewport.png), mesures dans [tournament-browser.json](../output/audit-encyclopedie-quiz/tournament-browser.json).
- **E2** — même composant, `:296,302` ; durée dans `src/lib/kanab-quest-school-tournament.ts`. Explication à y1143 dans le viewport mobile. [Correction](../output/audit-encyclopedie-quiz/correction-320-viewport.png), [résultat](../output/audit-encyclopedie-quiz/result-320.png). L’avertissement existe. [Transition réelle](../output/audit-encyclopedie-quiz/transition-browser.json) : après 7,5 s de lecture, retour à la question suivante, correction précédente disparue.
- **E3** — `src/components/placard/KqSchoolEncyclopedia.tsx:20,35,41–42` contre `src/lib/kanab-quest-cannabis-reference.ts:12`. [Inspection](../output/audit-encyclopedie-quiz/inspection.json), événements `history-click`, `history-reload`, `history-direct` ; [capture du lien direct](../output/audit-encyclopedie-quiz/history-direct-320.png).
- **E4** — `src/components/placard/KqCannabisArticle.tsx:29–36,67–74`. [Article mobile](../output/audit-encyclopedie-quiz/article-320.png) ; événements `reading-reload`, `anchor-reload` dans [reading-browser.json](../output/audit-encyclopedie-quiz/reading-browser.json).
- **E5** — `KqSchoolEncyclopedia.tsx:34–45,68–79,104–111,128–134` et `KqCannabisArticle.tsx:59`. Même rapport de lecture : recherche « folioles », retour au résultat, rechargement, recherche vide, index et lexique au clavier.
- **E6** — `KqSchoolEncyclopedia.tsx:132–145` ; [rubrique terpènes à 320 px](../output/audit-encyclopedie-quiz/terpenes-320.png).
- **E7** — `src/lib/kanab-quest-hemp-quiz-expansion-nature.ts:240–252` : composé minéral demandé, rugosité seule expliquée. `src/lib/kanab-quest-hemp-quiz-history-culture.ts:280–294` : lieu d’édition demandé, absent du passage lié dans `src/lib/kanab-quest-cannabis-reference-expansion.ts:15–21`. Il s’agit de cohérence éditoriale, pas d’une validation scientifique externe.
- **E8** — `KqSchoolEncyclopedia.tsx:138–139`, `KqCannabisArticle.tsx:75–86`, `KqSchool.tsx:45–51`. [Accueil mobile](../output/audit-encyclopedie-quiz/home-320.png).

### Échantillon éditorial

Articles : `ref-organes-vegetatifs` (« Racines, tige et feuilles »), `ref-terpenes-terpenoides`, `ref-histoire-culture` (« Écrivains, mots et voyages du chanvre »). Trois thèmes et trois usages : bases, distinction conceptuelle, repères historiques.

Douze QCM, quatre choix chacun, trois par niveau et trois par famille de fichiers :

| Niveau | Identifiants relus |
|---|---|
| 1 | `hemp-plant-racines`, `hemp-seeds-chenevis`, `hemp-hc-001` |
| 2 | `hemp-plant-noeud`, `hemp-hc-016`, `hemp-en-1-04` |
| 3 | `hemp-seeds-linoleique`, `hemp-hc-011`, `hemp-en-1-11` |
| 4 | `hemp-plant-filaments-femelles`, `hemp-seeds-stearidonique`, `hemp-en-1-14` |

Les douze questions tirées pour l’essai fonctionnel sont consignées séparément dans `tournament-browser.json` ; elles ne constituent pas une seconde relecture éditoriale.

### Vérifications exécutées

Commandes et compteurs consignés dans [validation.json](../output/audit-encyclopedie-quiz/validation.json).

- **A — Découvrir, lire, jouer :** articles et tournoi inspectés ; partie complète de douze réponses, avec erreur volontaire puis réussites, corrections, résultat et rechargement. Transition article → tournoi → correction → fiche vérifiée séparément.
- **B — Chercher et revenir :** recherche « folioles », ouverture de l’article au clavier, retour aux résultats avec requête et focus ; recherche vide, index et lexique contrôlés.
- **C — Interrompre et reprendre :** recherche conservée en session ; rubrique Histoire et position de lecture perdues. Réponse de tournoi enregistrée malgré une réponse réseau perdue, retrouvée au rechargement ; erreur de lecture simulée puis récupération.
- **38 tests réussis**, six fichiers : catalogue, banque, tirage du tournoi, commandes, backend et route API. Le mélange conserve les identifiants des bonnes réponses (`kanab-quest-school-challenge-server.ts:36–40`).
- **140 contrôles SQL** avec `node scripts/test-placard-school-tournament.mjs` ; **88 contrôles hebdomadaires** avec `node scripts/test-placard-school-tournament-weekly.mjs`. Progression, scores, rejeux, confidentialité et attribution hebdomadaire testés en base isolée. Le tournoi ne modifie pas le portefeuille.
- Le navigateur rejoue chaque commande de réponse et recharge le résultat : pas de double score constaté. 11 bonnes réponses sur 12, 1 563 points cumulés, finale 426/450 ; somme des gains conforme et classement inchangé au rechargement. Départ confirmé puis nouvelle participation : nouveau salon obtenu. Les contrôles hebdomadaires couvrent le règlement répété du titre. Aucune erreur JavaScript ni débordement horizontal sur les captures finales.

## Limites et points non vérifiés

Aperçu Vite avec vrais composants et transport de test PGlite, pas déploiement Next.js authentifié. Un ancien aperçu servait des fichiers en cache : les preuves finales ont été régénérées sur l’aperçu isolé du port 3252. L’horloge a été accélérée entre certaines phases de test, pas pour évaluer la facilité réelle du tournoi. Aucun compte distant, paiement ou progression réelle modifié.

Non vérifiés : appareil physique, lecteur d’écran complet, contraste mesuré, reprise entre appareils, concurrence réseau réelle et validité factuelle exhaustive des 360 questions. Les sessions fictives ne prouvent ni l’équité des niveaux ni la mémorisation.
