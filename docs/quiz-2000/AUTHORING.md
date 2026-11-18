# Quiz cannabis et chanvre : contrat éditorial

Mission révisée le 16 novembre 2026 : exactement 1 000 questions actives après validation, sans remplissage. L'utilisateur reporte l'extension à 2 000 à une étape ultérieure. La cible de livraison est dans `coverage-plan.json` ; le nom historique du dossier est conservé. Aucun déploiement ni écriture distante. Coordinateur `/root` ; agents de recherche, rédaction et première relecture configurés explicitement avec l'identifiant disponible `gpt-6.1-sol`. Quatre agents concurrents au maximum, coordinateur compris. Les rôles A–F alternent selon les phases.

## Correction de périmètre prioritaire

**Nouvelle correction du 17 novembre 2026 : la banque de 1 000 doit contenir 800 questions sur le cannabis récréatif, le CBD et le chanvre à actifs, 100 sur l'alimentaire et 100 sur le textile/bâtiment.** Cette exigence remplace les anciennes projections thématiques. Le checkpoint courant est `docs/quiz-rebalance-2026-11-17/progress.json`. Les données et preuves de la première livraison sont une base historique à reclasser, pas une validation de son orientation.

Le domaine privé `active` doit correspondre au fait réellement testé : cannabinoïdes, arômes/terpènes, fleurs/résine, variétés et génétique du cannabis à actifs, produits, effets et limites des connaissances, culture récréative/histoire, règles et prévention directement liées. Les aliments contenant du THC ou du CBD relèvent de ce domaine ; le domaine `food` concerne graines, huile alimentaire et nutrition. `materials` concerne textile, papier et bâtiment. Une leçon générale de biologie, de génétique ou de cuisine ne devient pas `active` parce qu'on ajoute « cannabis » à son énoncé. Les rappels obscurs des résultats d'une étude ne doivent pas remplacer des connaissances utiles sur le cannabis.

Les nouveaux lots de cette révision ajoutent `editorial.domain` (`active`, `food`, `materials`). Le relecteur vérifie explicitement l'adéquation du fait et inscrit `domain` et une courte `domainComment` dans chaque décision, en plus des preuves habituelles. Les nouvelles recherches restent externes au site. Aucun quota ne justifie remplissage, répétition du même fait ou baisse du niveau de source.

Les quotas s'appliquent aussi au tirage : 16/2/2 sur 20 questions ; sur 12 questions, une rotation déterministe de parties 10/1/1, 9/2/1 et 9/1/2 vise la moyenne 80/10/10. Chaque manche commence par une question `active` et comporte au plus une question secondaire. La couverture systématique des dix anciens thèmes n'est plus un objectif.

`release-selection.json` sépare les questions retenues des exclusions de périmètre, sans réécrire les anciennes preuves factuelles. Chaque classement renvoie à une contrelecture indépendante et à l'empreinte exacte de la question. `npm run integrate:quiz` régénère cette sélection à partir des contrelectures et des nouveaux lots approuvés, puis vérifie les preuves avant de modifier la banque. Pendant le travail, une sélection incomplète est admise ; `npm run check:quiz` exige la livraison complète de 1 000 questions et les quotas exacts 800/100/100. Une question en attente de relecture n'entre pas en jeu.

L'utilisateur a précisé pendant le travail : « ne t'inspire pas des variétés du site ni des producteurs du site ». La sélection des sujets et des faits doit donc provenir de recherches externes indépendantes. Aucun catalogue du site, producteur du site, fiche de buddy ou donnée de simulation ne sert de point de départ à la rédaction. Le quota initial de 250 questions buddies/producteurs est abandonné et redistribué dans `coverage-plan.json`. Les dix questions `pilot-ab` et le travail dérivé du catalogue sont archivés dans `archive/site-derived/`, exclus de toute intégration. Les audits initiaux restent des traces historiques, pas des ressources de rédaction. Dix questions issues de recherches indépendantes les ont remplacées dans le pilote validé de trente questions.

## Circuit

Audit → pilote de 30 → contrôle des sources, relecture indépendante et affichage → lots de 25 à 40 → corrections → validation → intégration. Une question non validée reste dans les dossiers de travail. Une consultation historique n'est pas une nouvelle consultation. Ne jamais inventer une preuve, une URL, un auteur ou une date.

Fichiers distincts : `batches/<lot>.json` pour l'auteur, `reviews/<lot>.json` pour un autre agent. Ne modifier ni les autres lots, ni les fichiers actifs, sauf mission explicite. Les sources communes peuvent être référencées depuis un lot déjà produit, mais le lecteur doit vérifier leur soutien précis à la réponse.

Les brouillons intermédiaires hors schéma (notes, `draftRows`, sources en cours) restent dans `facts/` ou dans un fichier `.tmp`. N'écrire le JSON de `batches/` qu'avec un tableau `questions` au schéma complet, pour permettre l'intégration des autres lots pendant la rédaction.

`fact-index.jsonl`, régénéré par le contrôleur, donne une ligne compacte par fait existant ou proposé : statut, sujet, propriété, réponse et objectif pédagogique. Rechercher les termes pertinents dans cet index avant de rédiger ; ouvrir ensuite seulement les questions proches dans leurs lots. Les entrées en attente et retirées ne sont pas des validations.

## Bêta locale

L'utilisateur a précisé que personne n'utilise le quiz : la préservation des anciennes parties, statistiques et identités éditoriales n'est plus une contrainte. Réécrire, remplacer et retirer les anciennes questions est autorisé. Ne pas bloquer une amélioration sur un changement de sens ou consacrer du travail à la compatibilité historique. Les exigences de sources, qualité, faits distincts et relecture indépendante restent applicables. La mission ne demande toujours aucun déploiement ni écriture distante.

## Schéma d'un lot

Objet JSON UTF-8 : `batchId`, `author` (nom de l'agent), `role`, `questions`, `sources`.

Une question contient les champs du type `HempQuizEntry` de `src/lib/kanab-quest-hemp-quiz-types.ts` :

- `id` unique préfixé `hemp-q2-`, avec lettres minuscules, chiffres, tirets ; maximum 75 caractères.
- `topicId` : `plant`, `genetics`, `molecules`, `evidence`, `uses`, `biodiversity`, `profiles`, `prevention`, `seeds`, `history`.
- `level` : 1 accessible, 2 intermédiaire, 3 difficile, 4 expert. Cible globale 35 % niveau 1, 45 % niveau 2, 20 % niveaux 3 et 4. Estimation éditoriale.
- `prompt` ≤150 caractères, `options` exactement 4 chaînes distinctes ≤75 caractères, `answer` indice entier 0–3, `explanation` ≤240 caractères.
- `articleId` : article existant pertinent de l'encyclopédie (voir baseline-catalog.json dans docs/encyclopedia-revision), ou proposition d'article clairement signalée.
- `sourceIds` : sources précises réellement consultées, au moins une accessible.
- `editorial` : `category`, `subject`, `property`, `expectedAnswer`, `learningObjective`, `factKey` (clé du fait, pas de la formulation), `form` (identification/comparaison/chronologie/situation/deduction/anecdote), `difficultyRationale`, `sourceEvidence`.
- `sourceEvidence` : liste `{sourceId, locator, support}` ; le soutien est une paraphrase factuelle, pas une longue citation.
- `editorial.subjectKey` identifie une variété, un produit ou un objet récurrent pour limiter sa répétition dans une partie. `reviewAfter` et `jurisdiction` obligatoires si droit ou santé susceptibles de changer.

Les identifiants historiques des thèmes ne se traduisent pas littéralement. Respecter les destinations affichées par le jeu :

| `topicId` | Thème affiché |
| --- | --- |
| `plant` | La plante |
| `genetics` | Variétés et génétique |
| `molecules` | Arômes et terpènes |
| `evidence` | Cannabinoïdes |
| `seeds` | Graines et alimentation |
| `profiles` | Fibres et matériaux |
| `uses` | Sol et racines |
| `biodiversity` | Santé du chanvre |
| `prevention` | Culture et prévention |
| `history` | Histoire et anecdotes |

La catégorie éditoriale décrit le fait testé ; elle n'est pas automatiquement déduite du rôle du rédacteur ni du document consulté. Pour les sujets récurrents, réutiliser la clé commune présente dans l'index au lieu d'en créer une variante pour le même récit, cultivar ou site.

Catégories éditoriales principales (une seule) après correction utilisateur : `varieties`, `genetics`, `botany`, `constituents`, `history`, `agronomy`, `quality`, `food`, `hemp-uses`, `prevention`. `varieties` concerne les variétés, obtenteurs, lignées et profils étudiés dans des sources externes indépendantes, sans utiliser les fiches du site comme point de départ. Les catégories éditoriales peuvent être distinctes des thèmes historiques du moteur ; pas de changement de sauvegarde pour les renommer.

Pour les lots de validation de l'existant, l'ID initial est autorisé avec `editorial.legacyAction` (`retain` ou `correct`). Le lot contient la question complète et sa preuve, même lorsqu'aucun mot ne change. Une réécriture substantielle peut conserver l'ID en bêta locale ; le fait final doit être explicite dans l'index éditorial. `identityImpact` est facultatif. Ne recycler aucun des faits retirés comme un faux ajout.

Une source contient : `id` préfixé `q2-`, `title`, `organization`, `url` réellement ouverte, `verifiedAt` YYYY-MM-DD de consultation, `author`, `published`, `passage`, `access` (`full-text`, `abstract`, `catalogue`, `official-page`, `excerpt`, `unavailable`), `documentKind`, `limitation`, `consultation` (`reader`, `date`, `locator`, `result`). Un résultat de recherche seul doit être décrit comme extrait, jamais comme lecture intégrale. Ne pas recopier de longs textes sources.

## Qualité

Un fait distinct et utile par question. Ne pas décliner artificiellement un fait en variantes, inversions ou changements de choix. Quatre réponses plausibles de même nature ; pas de distracteur fantaisiste, de réponse « toutes/aucune », d'indice de longueur, de piège grammatical. La question se suffit à elle-même. L'explication apprend quelque chose.

Distinguer producteur, breeder, distributeur, nom commercial, cultivar et lot. Aucune parenté déduite d'un nom. Les annonces commerciales sont attribuées à leur source, version et produit. Arôme ≠ analyse d'un terpène ; indica/sativa ≠ prédiction d'effet. Origines disputées : qualifier ou exclure. Les données de simulation ne prouvent rien sur des produits réels.

Pas de protocole, dosage, température, durée ou optimisation pour fabriquer/concentrer un produit psychoactif, ni de conseils pratiques de culture de cannabis psychoactif. Botanique, histoire, génétique descriptive, chanvre industriel et alimentation par graines sont abordés factuellement. Santé/droit : sources institutionnelles adaptées, juridiction/date si nécessaires, pas de promesse médicale.

## Relecture indépendante

Le reviewer lit chaque question, ses quatre choix, son explication et ses passages sources, puis vérifie l'index des faits existants et les lots voisins. Il enregistre pour CHAQUE question : `id`, `status` (`approved`, `changes_requested`, `rejected`), `comment`, `sourceChecks` et `contentHash` (SHA-256 de `JSON.stringify(question)`, objet complet lu depuis le lot). Le fichier de revue contient `batchId`, `reviewer`, `reviewedAt`, `items`. Un auteur ne s'approuve pas lui-même. Toute modification invalide le hash précédent. Les paires proches signalées sont arbitrées et documentées, pas masquées par un nouveau factKey.

Chaque référence de la question possède un `sourceChecks` avec `sourceId`, `url`, `locator`, `result` et `sourceHash` (SHA-256 de `JSON.stringify(source)`, objet complet du registre lu par le reviewer). Changer une preuve invalide ainsi sa revue même si l'identifiant reste identique. Les retraits conservent une raison éditoriale et la décision correspondante ; aucune analyse d'impact sur d'anciennes statistiques n'est nécessaire en bêta locale.

Après la première relecture indépendante par un agent Sol, le coordinateur peut arbitrer les corrections ciblées. Il lit les objets corrigés, vérifie les nouvelles preuves si nécessaire et enregistre explicitement son intervention finale, les demandes initiales et les nouvelles empreintes. Les approbations et consultations inchangées restent attribuées à leur lecteur initial ; aucun nouveau passage n'est présenté comme déjà vérifié par ce dernier.

Un changement de relecteur final est explicite au niveau de l'item (`finalReviewer`, ou `reviewer` pour une reprise indépendante). Le registre intégré conserve le relecteur initial, le relecteur final et le chemin de la revue. Une harmonisation de sujet décidée par le coordinateur garde aussi sa trace `metadataAdjustment` ; aucune étape finale ne peut être approuvée par l'auteur du lot.

Si un fait de remplacement a un premier relecteur différent de celui du lot, renseigner aussi `initialReviewer`, `initialReviewRecord` et `initialReviewContentHash` sur cet item. Le fichier référencé doit contenir l'approbation de la version complète effectivement lue par ce relecteur. Le contrôleur vérifie cette preuve séparée ; l'intégrateur reprend le bon nom et son chemin dans le registre. Une correction ciblée ultérieure conserve cette première empreinte et distingue son propre arbitrage final.

## État initial

360 entrées actives au départ, toutes avec surcharge reviewed.json. Le registre historique daté du 14 novembre est une trace antérieure à cette mission. La banque reste privée côté serveur. Le tournoi utilise désormais un tirage direct de 12 questions (3 par niveau), avec réservation des sujets nécessaires aux niveaux suivants. Les plans de parties déjà enregistrés sont conservés. Ne pas confondre le tournoi courant avec l'ancien quiz individuel de 20 questions.
