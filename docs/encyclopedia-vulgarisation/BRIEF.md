# Reprise pédagogique de toutes les fiches — 14 novembre 2026

L’utilisateur a rejeté le niveau de compréhension de l’ensemble du corpus, en citant « Terpènes et terpénoïdes ». La validation scientifique précédente ne constitue donc pas une validation pédagogique. Nouvelle couverture attendue : les 189 fiches publiées, les 160 définitions et les explications des 360 questions associées.

## Résultat attendu

Écrire pour un adulte curieux sans formation scientifique. Le lecteur doit comprendre le sujet, le mécanisme et l’exemple sans consulter une autre fiche pour décoder chaque phrase. Vulgariser signifie expliquer, pas seulement raccourcir ni remplacer des mots par des synonymes.

- Commencer par ce qu’est le sujet et pourquoi il apparaît dans le jeu ou dans l’étude du chanvre. Un résumé autonome, sans sigle non expliqué.
- Construire chaque fiche individuellement : une question concrète mène à une explication, puis à un exemple. Chaque paragraphe apporte une étape réelle.
- Introduire et définir les mots techniques lorsqu’ils deviennent nécessaires. Expliquer les unités et les symboles. Conserver la précision, les mécanismes et les résultats utiles.
- Éviter les fragments de catalogue, titres abstraits, accumulations de réserves, paragraphes interchangeables entre espèces/molécules/produits et répétitions de la même prudence à chaque section.
- Employer des analogies simples et exactes quand elles aident. Ne pas inventer de résultat, de recommandation, d’histoire ou de généalogie. Conserver les limites importantes dans une phrase compréhensible au bon endroit.
- Les détails spécialisés réellement secondaires peuvent passer dans `section.details = {title, paragraphs, sourceIds}` (un bloc facultatif). Le corps principal reste autonome. Ne pas cacher un résultat négatif, un danger matériel, une incertitude essentielle ou les conditions d’une règle dans ce bloc.
- Conserver les identifiants de fiches, de sections existantes et les liens. Les titres peuvent être réécrits, des sections ajoutées ou réordonnées si nécessaire. Ne pas supprimer un sujet fiable pour rendre artificiellement le texte court.
- Réécrire aussi les légendes et diagrammes pour enseigner une seule idée à la fois. Conserver auteurs, licences, espèces, hôtes et identité des images. `diagram.afterSectionId` peut indiquer la section qui doit le précéder ; par défaut le rendu le placera après la première section. Éviter les légendes administratives « schéma original », « les tailles ne représentent pas... » quand elles n’aident pas à comprendre.
- Références : rattacher seulement les sources qui soutiennent réellement la section. Supprimer les références doublonnées et les essais d’accès infructueux de la bibliographie publique lorsqu’une source lue couvre déjà le point. Le journal scientifique conserve ces traces. Préserver les blocages scientifiques réels. Les sources des questions doivent rester accessibles depuis leur fiche ; harmoniser leurs références si nécessaire.
- Glossaire : une définition directe, un exemple utile, aucun jargon en cascade. Les questions et réponses restent scientifiquement justes ; reformuler les explications difficiles en s’appuyant sur ce qui est réellement enseigné. Conserver IDs, niveaux, indices de réponses et règles de score sauf erreur documentée.

## Organisation et format

Lire les lots stabilisés de `docs/encyclopedia-revision/batches`, le quiz courant (`baseline-quiz.json` fusionné avec `src/lib/kanab-quest-hemp-quiz-reviewed.json`) et seulement les ressources nécessaires. Réutiliser les sources réellement lues. Une nouvelle affirmation sensible nécessite une nouvelle lecture primaire et un signalement.

Écrire des copies complètes des lots dans `docs/encyclopedia-vulgarisation/batches/<même-nom>.json`. Conserver les métadonnées de sources et les preuves scientifiques, modifier les textes, ajouter `pedagogicalReview` par fiche : question d’entrée, termes expliqués, exemple, détails déplacés, contrôles de compréhension et quiz relus. Ne pas modifier les lots scientifiques originaux ni les composants partagés. Le coordinateur relit et intègre.

Rapport bref par domaine dans `docs/encyclopedia-vulgarisation/reviews/`, avec IDs réellement traités et éventuelles difficultés. Aucun statut global « fini » tant que toutes les fiches attribuées ne sont pas réécrites et relues. Trois agents maximum, pas de sous-délégation.

La fiche pilote `ref-terpenes-terpenoides` appartient au coordinateur. Dans la copie `terpenes-01.json`, la garder intacte ; elle sera remplacée par sa nouvelle version lors de l’intégration.

## Exemple de progression

Pour la fiche pilote : d’abord définir la molécule et les atomes, puis expliquer 10 et 15 carbones avec le limonène et le caryophyllène ; distinguer terpène et terpénoïde en expliquant l’oxygène et le groupe –OH ; expliquer les isomères par l’assemblage et les formes miroir par l’analogie des mains. Les précurseurs IPP/DMAPP et la mesure des formes miroir viennent seulement en approfondissement. Un diagramme ne doit pas introduire trois classements encore inexpliqués avant le texte.
