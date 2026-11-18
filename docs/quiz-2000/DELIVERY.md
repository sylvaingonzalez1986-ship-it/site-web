# Livraison de la banque de 1 000 questions

> **Rapport historique de la première livraison, remplacé par la refonte en cours.** L'utilisateur a demandé de revoir son orientation : 800 questions sur le cannabis récréatif/CBD/actifs, 100 alimentaires et 100 textile/bâtiment. Les résultats ci-dessous concernent l'ancienne banque. État courant : [checkpoint de la refonte](../quiz-rebalance-2026-11-17/progress.json).

17 novembre 2026 — **1 000 questions actives intégrées et individuellement approuvées.** Le contrôle éditorial, les tests, la compilation et la recette locale sont terminés avec succès.

La cible a été ramenée à 1 000 par l'utilisateur. L'extension à 2 000 est reportée. Les nouvelles recherches sont indépendantes des variétés et producteurs du site ; le premier pilote issu du site est exclu et archivé. Aucune publication ni écriture en base distante.

## Bilan du contenu

| Sort des questions | Nombre |
| --- | ---: |
| Questions initiales | 360 |
| Conservées avec texte inchangé et relecture individuelle | 148 |
| Corrigées ou remplacées | 205 |
| Doublons initiaux retirés | 7 |
| Nouvelles questions validées | 647 |
| **Total actif** | **1 000** |

Les brouillons remplacés avant approbation et le pilote exclu ne gonflent pas ce total. La bêta locale permettait de réécrire ou remplacer librement les anciennes questions, sans chantier de compatibilité des anciennes statistiques.

La [banque intégrée](../../src/lib/kanab-quest-hemp-quiz-additions.json) contient les 647 ajouts, les 353 versions initiales validées et les sept retraits. Le [registre éditorial](integrated-editorial.json) comporte une entrée par question active. Le [contrôle de livraison](../../output/quiz-2000/check.json) confirme 1 000 approbations, zéro candidat en attente et zéro erreur.

## Répartition finale

Catégories éditoriales :

| Catégorie | Questions |
| --- | ---: |
| Agronomie | 46 |
| Botanique | 148 |
| Constituants | 80 |
| Alimentation | 130 |
| Génétique | 200 |
| Usages du chanvre | 60 |
| Histoire | 118 |
| Prévention | 44 |
| Qualité et lecture des analyses | 60 |
| Variétés | 114 |

Thèmes effectivement utilisés par le jeu, distincts des catégories éditoriales :

| Thème du jeu | Questions |
| --- | ---: |
| La plante | 125 |
| Variétés et génétique | 220 |
| Arômes et terpènes | 55 |
| Cannabinoïdes | 68 |
| Graines et alimentation | 168 |
| Fibres et matériaux | 106 |
| Sol et racines | 33 |
| Santé du chanvre | 52 |
| Culture et prévention | 61 |
| Histoire et anecdotes | 112 |

| Niveau | Questions | Part |
| --- | ---: | ---: |
| Facile | 216 | 21,6 % |
| Intermédiaire | 532 | 53,2 % |
| Difficile | 219 | 21,9 % |
| Expert | 33 | 3,3 % |

La répartition est plus spécialisée que l'objectif indicatif 35 % / 45 % / 20 % : elle atteint **21,6 % / 53,2 % / 25,2 %** en regroupant difficile et expert. Les niveaux reflètent la tâche réellement demandée ; ils n'ont pas été abaissés pour atteindre un quota. Ce sont des estimations éditoriales, sans calibration sur des joueurs. Une extension ultérieure pourra privilégier des faits accessibles encore absents.

## Sources et relectures

La [bibliographie publique](../../src/lib/kanab-quest-hemp-quiz-public-sources.json) contient **481 notices correspondant à 470 URL distinctes**. Les objets complets, passages utiles, conditions d'accès et consultations sont conservés dans [les lots](batches/) et les registres historiques référencés. La lecture porte sur les passages nécessaires ; aucune lecture intégrale de tous les ouvrages n'est revendiquée. Les descriptions commerciales restent attribuées et les limites des résumés ou extraits consultés sont enregistrées.

Les recherches, rédactions et premières relectures ont été réparties entre les six agents configurés explicitement en `gpt-6.1-sol`. Les arbitrages finaux du coordinateur sont distingués des lectures de sources. L'identité « Astra Ultra » demandée pour le coordinateur ne pouvait pas être attestée ou modifiée par l'outil de délégation ; ce point est consigné dans [progress.json](progress.json).

Chaque question possède une empreinte de sa version complète et des preuves portant sur les empreintes exactes des sources. [Les revues](reviews/) et [la revue des questions conservées](legacy-review-f.json) identifient les lecteurs. Le registre intégré distingue relecteur initial, relecteur final et fichier de validation ; les 1 000 chemins de preuve existent et aucune question n'est approuvée par son auteur. Les demandes initiales restent en historique après leur résolution.

**99 questions portent une date de réexamen.** Les dates et juridictions restent attachées aux questions concernées. Le texte consacré à la liste AMA 2026, notamment, conserve sa portée annuelle.

Les doublons exacts sont contrôlés automatiquement. L'index des faits et des recherches ciblées servent à détecter les paraphrases, inversions et réponses révélées par une autre question. Les rapprochements signalés sont arbitrés sur les versions exactes ; cela ne prétend pas constituer une comparaison humaine de toutes les paires possibles.

## Moteur et interface

Le tournoi tire directement douze questions, trois par niveau. L'identité de la bonne réponse est conservée pendant le mélange des choix. Les sujets communs permettent d'éviter plusieurs questions sur le même objet dans une partie lorsque le corpus permet un tirage de sujets distincts. La réservation tient compte des niveaux encore nécessaires.

La diversité des thèmes reste une préférence : les dix thèmes ne sont pas garantis dans chaque tournoi. La priorité va aux sujets distincts et aux quotas de niveaux. Le [contre-exemple relu indépendamment](theme-reservation-review.json) et [l'arbitrage technique](technical-resolutions.json) documentent cette limite. L'absence de répétition entre deux parties différentes n'est pas garantie.

Les probabilités individuelles ne sont pas uniformes. Le premier contrôle de couverture avait atteint 999 questions en 3 000 tirages ; la dernière apparaît au seed `hemp-review-3158`. Le plafond du test a été porté à 4 000 tirages, avec arrêt dès couverture complète, sans modifier le moteur ni relâcher l'exigence de rencontrer les 1 000 questions. Le [diagnostic](../../output/quiz-2000/reachability-review.json) conserve ce cas rare.

La banque privée et les corrigés restent côté serveur. Le client reçoit le compteur et la bibliographie publique séparée. L'interface affiche le nombre réellement intégré et les corrections renvoient aux articles et sources correspondants.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| `npm.cmd run check:quiz` | Réussi : 1 000 actives, 1 000 approuvées, zéro attente, zéro erreur |
| TypeScript `--noEmit` | Réussi ; contrôle TypeScript de la banque complète également réussi pendant le build |
| ESLint des fichiers modifiés du quiz et de son intégration | Réussi |
| SQL local du tournoi | 140 contrôles réussis |
| Banque, tirages et encyclopédie | 25 tests réussis, code de sortie Vitest 0 ; couverture des 1 000 questions |
| Compilation de production | Réussie, code de sortie 0 ; compilation optimisée et génération des pages terminées |
| Banque privée dans les fichiers clients | Aucun des 1 000 identifiants actifs trouvé dans les 207 fichiers JavaScript clients analysés |
| Parcours réel et captures mobiles | Sept scénarios réussis avec 1 000 entrées, à 320/390/1 440 px ; captures inspectées |
| Mesures de performance | 100 tirages sur la banque réelle : médiane 12,40 ms, 95e percentile 14,64 ms |

Les rapports sont conservés dans [output/quiz-2000](../../output/quiz-2000/). Le parcours navigateur utilise l'interface réelle et une base PGlite locale éphémère. Il ne valide visuellement qu'une sélection de questions, pas l'affichage individuel de toutes les entrées.

Le [récapitulatif des validations](../../output/quiz-2000/final-validation.json) référence le [contrôle éditorial final](../../output/quiz-2000/final-release-check.json), les [25 tests](../../output/quiz-2000/final-tests.json), les [sept scénarios navigateur](../../output/quiz-2000/ui/report.json), la compilation et les mesures. La recette vérifie le compteur de 1 000, quatre choix lisibles, le clavier, le corrigé, une bonne puis une mauvaise réponse, le score sans double attribution après rechargement, les liens vers les sources et le refus HTTP des fichiers privés dans la prévisualisation. Les captures de question à 320/1 440 px et de correction à 320 px ont été inspectées. La prévisualisation ouverte pour cette tâche a été arrêtée.

La compilation a signalé des lectures distantes de contenus publics Supabase indisponibles dans cet environnement, tout en terminant avec succès. La recette locale ne prétend pas vérifier les services distants. Le contrôle des fichiers clients porte sur les identifiants recherchés ; il complète les tests des réponses API sans constituer à lui seul un audit de sécurité global.

La mesure de performance concerne le calcul local à chaud, sans réseau : un plan privé de douze questions représente 18 473 octets et sa première question publique 1 212 octets dans le tirage mesuré. Le [rapport](../../output/quiz-2000/performance.json) sépare la banque réelle d'un jeu synthétique de capacité. Le chargement du moteur de test TypeScript n'est pas une mesure d'import en production.

Commandes reproductibles, depuis la racine du dépôt :

```powershell
npm.cmd run check:quiz
node node_modules/vitest/vitest.mjs run src/lib/kanab-quest-hemp-quiz.test.ts src/lib/kanab-quest-school-challenge-server.test.ts src/lib/kanab-quest-school-tournament-server.test.ts src/lib/kanab-quest-school-encyclopedia.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-placard-school-tournament.mjs
npm.cmd run build
node scripts/benchmark-quiz-2000.mjs
```

Pour la recette visuelle, lancer `node scripts/audit-placard-navigation.mjs --preview --school-visual` avec `NAVIGATION_AUDIT_PORT=3266`, puis `node scripts/audit-quiz-2000-ui.mjs` dans un autre terminal. Arrêter uniquement cette prévisualisation après la recette.

## Fiches existantes et ajouts futurs

L'[inventaire initial du site](audit-a.md) reste une archive d'anomalies, pas une source de nouvelles questions : noms commerciaux insuffisants pour établir un pedigree, versions de lignées différentes, producteur distinct du breeder, arômes documentés pour des sélections différentes, paramètres de culture fictifs et instantané de magasin ancien. Aucune nouvelle investigation des catalogues du site n'a été engagée pour les derniers lots.

Pour étendre la banque : définir d'abord la nouvelle cible autorisée dans le plan, puis produire des lots de 25 à 40 faits distincts selon [AUTHORING.md](AUTHORING.md). Faire relire chaque question et ses passages sources par un autre agent, corriger, sceller les empreintes, intégrer et relancer le contrôle de livraison ainsi que les tests concernés. Les lots prévus pour 2 000 restent explicitement reportés dans [la file de production](production-queue.json).
