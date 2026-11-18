# Banque de quiz : 1 000 questions

**Rééquilibrage terminé et vérifié localement : 80 % cannabis récréatif/CBD/actifs, 10 % alimentaire, 10 % textile/bâtiment.** Le [bilan courant](../quiz-rebalance-2026-11-17/DELIVERY.md) décrit les 564 remplacements et les nouveaux tirages. Le [checkpoint](../quiz-rebalance-2026-11-17/progress.json) rassemble les preuves de cette livraison.

La banque contient **1 000 questions actives : 800 sur le cannabis récréatif, le CBD et les actifs, 100 alimentaires et 100 textiles/bâtiment**. L'utilisateur a reporté l'extension à 2 000. Le [bilan de la première livraison](DELIVERY.md) est historique ; `integration.json` décrit la banque actuelle. Le contrôle de livraison exige la cible exacte et les trois quotas de `coverage-plan.json`. Une validation structurelle ou une mesure de capacité ne remplace pas la lecture des faits. Le dossier et les scripts gardent leur nom historique `quiz-2000` pour préserver les références des preuves.

La première livraison avait validé 353 des 360 questions initiales et 647 ajouts. La révision de périmètre conserve 436 de ces 1 000 questions et remplace les 564 autres. La classification des 1 000 entrées et sa contrelecture sont conservées dans `../quiz-rebalance-2026-11-17/classifications/` ; elles n'inventent pas une nouvelle consultation des sources inchangées.

Le quiz est en bêta locale sans joueurs, selon la précision de l'utilisateur : les anciennes questions peuvent être librement réécrites, remplacées ou supprimées. Aucune conservation des anciennes statistiques n'est nécessaire pour cette mission.

La précision de l'utilisateur pendant le travail est prioritaire : **ne pas s'inspirer des variétés ni des producteurs du site**. Les recherches partent de sources externes indépendantes. Les dix premières questions A/B ont été exclues et archivées dans `archive/site-derived/`. Elles ne doivent pas être réactivées. Le quota initial de 250 questions liées au site est redistribué dans `coverage-plan.json`.

## Organisation des preuves

- `audit-f-active-snapshot.json` fige les 360 questions initiales ; `audit-f-index.json` distingue conservation provisoire, correction, remplacement et retrait.
- `audit-a.md` conserve les limites et anomalies constatées dans les fiches du site avant leur exclusion du périmètre de rédaction. Cet inventaire historique ne constitue pas une validation générale des catalogues ni une source de nouvelles questions.
- `batches/` contient les textes, les faits testés et les sources. `reviews/` contient les relectures individuelles et les empreintes des questions **et** des objets sources.
- `fact-index.jsonl` regroupe les faits existants et proposés, à raison d'une ligne par question, pour rechercher des proximités sans relire tous les dossiers de preuves. Il est régénéré par le contrôleur et distingue les statuts.
- `facts/` conserve les notes de recherche, propositions, états gelés des auteurs et arbitrages successifs. Ces états historiques ne sont pas la banque finale : les objets courants sont dans `batches/`, leurs décisions dans `reviews/` et leur état dérivé dans `fact-index.jsonl`. Les scripts de rédaction et d'arbitrage à usage unique ne doivent pas être relancés pour reconstruire les lots approuvés.
- `legacy-review-f.json` trace la vérification progressive des anciennes questions, sans présenter les entrées non traitées comme validées.
- `integrated-editorial.json` conserve les métadonnées des entrées approuvées intégrées, le relecteur initial, le relecteur final et le fichier de preuve ; `legacy-validation.json` fige les anciennes entrées approuvées dans leur forme runtime.
- `release-selection.json` relie chaque inclusion ou exclusion de périmètre à son classement indépendant et à son empreinte. L'intégrateur le régénère à partir des contrelectures et des nouveaux lots approuvés ; les anciens faits exclus restent dans les archives de preuves.
- `technical-review.json` et `technical-resolutions.json` distinguent les défauts détectés des corrections apportées. Les rapports historiques du pilote antérieurs au changement de périmètre ne constituent pas le compteur courant.
- Les résultats du rééquilibrage, captures et mesures sont dans `output/quiz-rebalance-2026-11-17/`. `output/quiz-2000/` conserve les résultats historiques et le dernier contrôle courant `check.json`. Les captures concernent les scénarios indiqués dans le rapport, pas chaque question de la banque.

## Ajouter un lot

1. Lire `AUTHORING.md`, le plan de couverture et l'index des faits déjà couverts. Rechercher des faits distincts dans des sources réellement accessibles, sans utiliser les fiches du site comme inspiration.
2. Écrire 25 à 40 questions dans un fichier propre au lot. Donner quatre choix plausibles, une seule réponse, une explication utile, un article pertinent et les passages qui soutiennent le fait. Renseigner `editorial.domain` selon le fait réellement testé. Ne pas transformer l'objectif numérique en remplissage.
3. Faire relire chaque question par un autre agent. Le reviewer lit les quatre choix, le corrigé et les passages sources ; il enregistre les hashes exacts, `domain` et `domainComment`. Toute modification impose la revalidation de ce qui a changé.
4. Exécuter `npm run check:quiz:work`. Examiner les proximités dans `output/quiz-2000/check.json`. Documenter chaque arbitrage sémantique avec ses deux versions dans `semantic-resolutions.json` ; une proximité lexicale n'est pas une preuve de doublon.
5. Pour une correction de l'existant, renseigner le fait final et `legacyAction: correct`. Un changement de sens peut conserver l'ID en bêta locale. Un retrait conserve une raison éditoriale et la décision correspondante ; aucune procédure de compatibilité historique n'est nécessaire.
6. Exécuter `npm run integrate:quiz`, puis `npm run check:quiz:work`. L'intégrateur ne prend que les entrées approuvées avec des preuves inchangées. Il écrit les données serveur, la bibliographie publique séparée et les compteurs ; il ne contacte aucune base distante.
7. À la livraison, exécuter `npm run check:quiz` : exactement 1 000 actives, réparties 800/100/100, toutes approuvées, aucune décision sémantique périmée. Exécuter aussi les tests de banque/tirage, TypeScript, ESLint et le build, puis la recette du parcours réel.

Le niveau est une estimation éditoriale, pas une mesure des joueurs. Les sigles obscurs, les formulations lourdes ou les distracteurs manifestement faux ne créent pas une difficulté juste.

## Recette locale du parcours

La prévisualisation existante utilise l'interface réelle et une base PGlite éphémère :

```powershell
$env:NAVIGATION_AUDIT_PORT = '3266'
node scripts/audit-placard-navigation.mjs --preview --school-visual
```

Dans un autre terminal, `node scripts/audit-quiz-2000-ui.mjs --rebalance` vérifie une question de cette révision, le clavier, les corrections, le score, la reprise, les sources et les dimensions 320/390/1440 px. Le rapport est dans `output/quiz-rebalance-2026-11-17/ui/`. Le script pilote localement les délais de révélation pour permettre l'inspection. Il ne modifie aucune base distante. `node scripts/benchmark-quiz-2000.mjs --rebalance` mesure les tirages de 12 et 20 questions sur la banque actuelle, leur répartition par domaine et, séparément, une capacité synthétique jamais intégrée au jeu. Il conserve son rapport dans `output/quiz-rebalance-2026-11-17/performance.json`.

Le tournoi tire directement douze questions : les répartitions 10/1/1, 9/2/1 et 9/1/2 visent une moyenne 80/10/10. Chaque manche commence par une question sur les actifs et contient au plus une question secondaire. Le mélange conserve la bonne réponse. Le moteur recherche conjointement les niveaux, domaines et sujets distincts ; il signale une impossibilité au lieu de relâcher silencieusement ces contraintes. Cela ne garantit pas l'absence de répétition entre deux parties différentes.

Les dix thèmes historiques restent des étiquettes de navigation : ils ne constituent plus des quotas de tirage. Le tirage classé privilégie les trois domaines demandés et conserve les niveaux et les sujets distincts. Les rapports `theme-reservation-review.json` et `technical-resolutions.json` décrivent l'ancien moteur, antérieur à cette révision.
