# Rééquilibrage du quiz

**Livraison locale validée : 1 000 questions, réparties 800 / 100 / 100.** Révision `2026-11-17.hemp1000.5fe7f2039c81`. Le [checkpoint](progress.json) et le [registre d'intégration](../quiz-2000/integration.json) décrivent cette banque.

La cible autorisée est de 1 000 questions : 800 sur le cannabis récréatif, le CBD et les actifs, 100 alimentaires et 100 sur le textile et le bâtiment. L'extension à 2 000 reste reportée. Les recherches utilisent des sources externes indépendantes, sans prendre les variétés ni les producteurs du site comme point de départ.

## Contenu

Les 1 000 questions de la livraison précédente ont été classées, puis contre-relues indépendamment : 436 sont conservées (276 actifs, 81 alimentaires, 79 matériaux), et 564 sont écartées. Les 564 remplacements sont rédigés, relus et intégrés : 524 sur les actifs, 19 alimentaires et 21 textiles/bâtiment, répartis en 19 lots. La [sélection](../quiz-2000/release-selection.json) relie chaque décision à sa preuve et à l'empreinte exacte du texte.

| Domaine du fait testé | Questions | Part |
| --- | ---: | ---: |
| Cannabis récréatif, CBD et actifs | 800 | 80 % |
| Alimentation | 100 | 10 % |
| Textile et bâtiment | 100 | 10 % |
| Total | 1 000 | 100 % |

Les propriétés générales de biologie, de laboratoire ou d'agriculture ne sont pas comptées parmi les actifs par la seule présence du mot « cannabis ». Les aliments contenant du CBD ou du THC relèvent des actifs ; l'alimentaire couvre les graines, huiles de graines et usages nutritionnels. Les descriptions commerciales restent attribuées à leur source externe.

Les nouveaux lots sont rédigés et relus par des agents distincts configurés en `gpt-6.1-sol`. Les arbitrages du coordinateur sont enregistrés séparément, avec les versions avant/après et les éventuelles consultations supplémentaires. Les preuves distinguent texte intégral, résumé, extrait et page officielle. Les candidats remplacés avant activation restent dans les historiques, sans gonfler le compteur.

## Thèmes et niveaux

Les thèmes d'affichage organisent les questions ; ils ne définissent pas les trois quotas de domaine. Une question historique sur un textile reste par exemple dans le domaine textile/bâtiment.

| Thème d'affichage | Questions |
| --- | ---: |
| La plante | 56 |
| Variétés et génétique | 100 |
| Arômes et terpènes | 78 |
| Cannabinoïdes | 183 |
| Graines et alimentation | 86 |
| Fibres et matériaux | 80 |
| Sol et racines | 0 |
| Santé du chanvre | 11 |
| Culture et prévention | 190 |
| Histoire et anecdotes | 216 |

| Niveau éditorial | Questions | Part |
| --- | ---: | ---: |
| Facile | 279 | 27,9 % |
| Intermédiaire | 530 | 53 % |
| Difficile | 170 | 17 % |
| Expert | 21 | 2,1 % |

La répartition accessible/intermédiaire/difficile-expert est donc 27,9/53/19,1, différente de l'indication initiale 35/45/20. Elle reflète les niveaux retenus à la relecture ; aucune donnée de joueurs ne les calibre à ce stade.

## Tirages

Le format de 20 questions tire exactement **16 actifs, 2 alimentaires et 2 textiles/bâtiment**. Le tournoi de 12 questions utilise les répartitions 10/1/1, 9/2/1 et 9/1/2, avec des poids de 3/5, 1/5 et 1/5 : la proportion attendue sur de nombreux tirages est 80/10/10. Douze questions ne permettent pas un quota entier de 10 % par domaine secondaire dans chaque partie.

Chaque manche commence sur les actifs. Le moteur résout ensemble les quotas de domaines, les niveaux et les sujets distincts. Il ne force plus la présence des dix thèmes historiques ; ces thèmes restent disponibles pour organiser le contenu. L'absence de répétition entre deux parties différentes n'est pas garantie.

Le plan serveur sépare les questions de leur corrigé. La question envoyée au navigateur contient uniquement les cinq champs bibliographiques des sources (identifiant, titre, organisme, URL et date de vérification), sans leurs extraits factuels ni leurs notes. L'encyclopédie et sa bibliographie restent volontairement consultables. L'interface affiche le nombre réellement intégré. Le mélange des choix conserve l'identité de la bonne réponse et le corrigé renvoie aux sources.

La [revue indépendante du moteur](engine-independent-review.json) consigne le contrôle des quotas et de l'appariement des sujets. Son amendement distingue le défaut de projection des sources trouvé par le coordinateur, sa correction et la relecture indépendante du delta.

## Vérifications exécutées

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Livraison éditoriale stricte | 1 000 actives et approuvées, 800/100/100, zéro attente, zéro anomalie ; trois rapprochements lexicaux arbitrés et à jour | [release-check.json](../../output/quiz-rebalance-2026-11-17/release-check.json) |
| Banque, tirages et encyclopédie | 30 tests réussis ; chacune des 1 000 questions atteinte par les tirages réels, quotas et corrigés vérifiés | [final-tests.json](../../output/quiz-rebalance-2026-11-17/final-tests.json) |
| Contrôles des preuves d'intégration | 6 tests Node réussis | [checkpoint](progress.json) |
| Tournoi SQL local | 140 contrôles réussis : progression, score, confidentialité, reprise et permissions | [sql-tournament.log](../../output/quiz-rebalance-2026-11-17/sql-tournament.log) |
| TypeScript, ESLint et diff | Contrôles ciblés réussis ; les fichiers modifiés après le premier passage ont été revérifiés | [bilan exécutable](../../output/quiz-rebalance-2026-11-17/final-validation.json) |
| Compilation de production | `npm.cmd run build` terminé avec code 0, dont vérification TypeScript finale | [build.log](../../output/quiz-rebalance-2026-11-17/build.log) |
| Fichiers JavaScript clients | 1 000 identifiants de questions recherchés dans 210 fichiers : zéro correspondance | [privacy.json](../../output/quiz-rebalance-2026-11-17/privacy.json) |
| Parcours dans l'interface | 7 scénarios réussis sur l'interface réelle avec PGlite isolé, à 320/390/1 440 px | [rapport et captures](../../output/quiz-rebalance-2026-11-17/ui/report.json) |

La recette d'interface couvre le compteur de 1 000 questions, une nouvelle question avec trois bots, les quatre choix, une réponse au clavier, la bonne et la mauvaise réponse, le score, le rechargement sans double attribution, les sources et le refus HTTP des fichiers privés. Les captures question 320/1 440 px et corrigé 320 px ont été inspectées. Cette recette ne constitue pas une inspection visuelle de chaque question.

Le navigateur de test utilise désormais un profil isolé dans le dossier de sortie : le profil temporaire système avait provoqué un refus d'accès. La tentative corrigée passe ; la prévisualisation de test sur 3266 est arrêtée et ses profils ont été nettoyés. L'aperçu de l'utilisateur sur 3248 n'a pas été interrompu. Un processus d'aperçu ancien qui conserve son moteur en mémoire doit être relancé pour charger la nouvelle banque.

La compilation réussit malgré l'indisponibilité de lectures distantes des caches publics Supabase (pages CMS, blog et produits). Les contrôles de jeu et de score utilisent la base locale isolée ; ils ne prétendent pas valider une intégration distante.

## Mesures de tirage

Le [benchmark local](../../output/quiz-rebalance-2026-11-17/performance.json) exécute 100 tirages de chaque format sur la banque finale :

| Format | Actifs tirés | Alimentaire | Textile/bâtiment | Médiane | 95e percentile |
| --- | ---: | ---: | ---: | ---: | ---: |
| 12 questions | 958 (79,83 %) | 123 (10,25 %) | 119 (9,92 %) | 4,21 ms | 5,53 ms |
| 20 questions | 1 600 (80 %) | 200 (10 %) | 200 (10 %) | 3,75 ms | 4,83 ms |

Ces temps mesurent des tirages locaux en mémoire, sans réseau ni base distante. La mesure synthétique du même fichier est distincte et n'entre jamais dans la banque. Le temps de chargement de l'outil de test n'est pas une mesure d'import de production.

## Reproduire et poursuivre

`npm.cmd run check:quiz` exécute le contrôle strict. Les commandes de recette et la procédure d'ajout de lots figurent dans le [guide](../quiz-2000/README.md) et les [règles de rédaction](../quiz-2000/AUTHORING.md). Une modification de question ou de notice invalide son empreinte et doit être relue avant réintégration. La cible reste 1 000 ; le passage à 2 000 est reporté.

Le travail est terminé localement. Aucune publication ni écriture dans une base distante n'a été effectuée.
