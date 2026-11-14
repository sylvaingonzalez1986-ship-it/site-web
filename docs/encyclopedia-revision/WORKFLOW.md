# Révision exhaustive de l’encyclopédie QuizzShow

Demande du 14 novembre 2026. Périmètre publié : 189 fiches (52 articles, 137 notices), 160 termes du glossaire, 360 questions liées. Les anciens cours non montés ne sont pas des fiches publiées supplémentaires. Le catalogue et le quiz de départ sont archivés dans `baseline-catalog.json` et `baseline-quiz.json`.

Le coordinateur possède les composants, le chargeur, l’inventaire global et l’intégration. Trois spécialistes GPT-6.1 Sol au maximum travaillent simultanément, sans sous-délégation. Chaque spécialiste écrit uniquement dans ses fichiers de lot et ses médias dédiés. Ne pas modifier les sources communes ni annuler les modifications existantes.

## Contrat des lots

Les entrées propres à chaque domaine sont dans `assignments/<domaine>.json`. Elles contiennent les fiches complètes, les termes, les questions et les références existantes. Lire toutes les phrases et tous les champs de chaque fiche, les termes et questions associés. Travailler par lots cohérents de 4 à 8 fiches, sans supprimer les fiches plus difficiles du périmètre.

Écrire `batches/<domaine>-01.json`, puis les lots suivants, avec :

```json
{
  "domain": "botany",
  "reviewedAt": "2026-11-14",
  "sources": [],
  "articles": [{
    "id": "identifiant existant",
    "questions": ["Questions auxquelles la fiche répond"],
    "fullyRead": true,
    "findings": ["Corrections ou lacunes constatées ; préciser aussi les passages conservés après vérification"],
    "patch": {"lead": "Résumé révisé", "sections": [], "sourceIds": []},
    "sourceIdsReviewed": [],
    "visual": {"status": "verified", "notes": "Ce qui a été examiné et pourquoi ce visuel explique le sujet"},
    "quizIdsReviewed": [],
    "status": "ready-for-integration",
    "blockers": []
  }],
  "termReviews": [{"id": "terme existant", "definition": "Définition vérifiée", "sourceIds": [], "findings": []}],
  "quizPatches": [],
  "sensitivePoints": []
}
```

`patch` conserve les identifiants de fiches et sections, liens, glossaire et signets ; champs compatibles avec CannabisReferenceArticle. Une section possède id, title, paragraphs (tableau de textes), sourceIds. Remplacer les paragraphes insuffisants par des explications originales avec mécanisme, exemple et limites utiles. Aucun plafond de mots. Ne pas ajouter du remplissage ni supprimer une information fiable pour économiser. Les réponses du quiz doivent être apprenables dans la fiche.

Les sources reprennent le format HistorySource : id, title, author, organization, published, url, verifiedAt, passage, access (full-text, abstract, catalogue, official-page ou excerpt), documentKind, limitation. Ajouter `reviewEvidence` contenant les pages/sections réellement ouvertes, leur résultat et les assertions soutenues. Réutiliser l’identifiant existant si la référence est identique. Une source inaccessible n’est jamais déclarée lue. Lire les documents via le web, pas seulement les extraits de recherche. Vérifier les points sensibles, distinguer humain/animal/in vitro et conjecture/preuve. Sources primaires et institutionnelles privilégiées ; pas de sources inventées. Noter les points à contre-vérifier par un autre spécialiste.

Pour chaque visuel, examiner l’image et sa page d’origine. Privilégier les photos documentaires pertinentes à licence commerciale compatible, avec auteur/source/licence/lien. Ne pas présenter une illustration générée comme observation. Les illustrations originales contrôlables sont possibles : `patch.diagram` = {kind: "sequence" | "comparison" | "timeline" | "evidence", title, nodes: [{label, detail}], caption, sourceIds}. Créer un diagramme informatif propre à la fiche, avec relations correctes et limites, pas un rappel générique. Le coordinateur intègre le rendu HTML accessible. Pour une photo : `patch.image` = {src, alt, caption, author, sourceUrl, license, licenseUrl, kind:"photograph"}; enregistrer sous `public/placard/reference/<domaine>/`. Une photographie indispensable absente reste bloquante. Les SVG scientifiques créés doivent être contrôlés et avoir légende/texte alternatif. Les images de synthèse existantes ne valident pas automatiquement l’illustration scientifique d’une fiche.

Les corrections du quiz utilisent l’id existant et les champs prompt, options (4 textes), answer (index 0 à 3), explanation, articleId, sourceIds. Préserver le niveau, le score et les identifiants. Ne jamais ajouter de protocole pratique de fabrication de drogue, de synthèse/extraction dangereuse ou de conseil médical personnalisé : expliquer les mécanismes et niveaux de preuve.

Ne pas marquer une fiche entièrement validée : le spécialiste propose ready-for-integration ou blocked, le coordinateur effectue la validation finale. Chaque lot rapporte les vrais blocages, les images réellement examinées et la couverture exacte. Envoyer seulement un retour court au coordinateur après écriture du lot, puis poursuivre le suivant.

<!-- BEGIN DELIVERY -->
## Livraison locale du 14 novembre 2026

| État | Fiches |
| --- | ---: |
| Inventoriées | 189 |
| Relues intégralement | 189 |
| Corrigées / enrichies | 189 |
| Illustrées | 189 |
| Entièrement validées | 181 |
| Bloquées sur une source | 8 |
| Non examinées ou en attente de relecture | 0 |

Les 160 termes et les 360 questions ont été relus. **74 questions sont effectivement modifiées et 286 conservées après vérification.** Les lots contiennent aussi des copies inchangées pour tracer la relecture ; elles ne sont pas comptées comme corrections. Les identifiants, ancres, destinations, relations et règles de score sont préservés.

- Botanique : fruit et graine, trichomes, reproduction et diversité séparés ; généalogies commerciales attribuées à leur version et à leur auteur.
- Chimie et pharmacologie : formes acides/neutres et isomères distingués ; résultats cellulaires, animaux et humains séparés ; critères principaux négatifs conservés, pas de promesse thérapeutique tirée d’une affinité ou d’un arôme.
- Santé végétale : signes, symptômes et identification séparés ; hôte, région et portée des expériences conservés. Photographies comparatives de houblon et basilic clairement légendées.
- Produits et réglementation : huile de graines distincte des extraits, teneurs alimentaires en mg/kg distinctes du seuil variétal, avis scientifique distinct d’une autorisation, systèmes constructifs et bilans environnementaux contextualisés.

Les 189 fiches disposent d’un visuel explicatif : 42 présentent une photographie documentaire, 26 une structure chimique et 139 un diagramme HTML (catégories cumulables). Les auteurs, licences, légendes et liens d’origine accompagnent les images. Les diagrammes conceptuels ne sont pas présentés comme observations ni comme mesures. Les données et textes des cartes de terpènes utilisent la révision des fiches.

Les références effectivement consultées correspondent à 323 identifiants et 296 URL distinctes. **Ce ne sont pas des décomptes d’études indépendantes.** Les références inaccessibles restent explicites ; une lecture de résumé n’est pas comptée comme texte intégral.

### Vérifications

TypeScript et ESLint ciblé passent. Les trois fichiers Vitest totalisent **13 tests réussis**. Le contrôle navigateur couvre **45 combinaisons** (15 fiches × 320, 390 et 1 440 px), sans débordement horizontal, image en échec ni erreur JavaScript. Les gabarits et mises en page particulières ont aussi été inspectés visuellement. Les contrôles incluent les crédits de molécules, le maintien du focus dans la fenêtre et sa fermeture par Échap. Deux avertissements existants, Vite et PostCSS, sont consignés sans échec dans [verification.json](verification.json).

Aucun déploiement ni migration appliquée. Les changements préexistants du dépôt sont préservés.

### Sources restant bloquées

- **Cookies** (`record-variety-cookies`) : Relire l’entretien primaire Jigga du 30 mars 2020 pour confirmer F1 Durban × Florida OG et l’étymologie F1 ; accès direct 403.
- **Gelato** (`record-variety-gelato`) : Récupérer l’entretien Sherbinski 2017 pour la chronologie et la liste historique des sélections ; page primaire 403. La parenté actuelle est confirmée séparément sur Sherbinskis.
- **Les découvertes du système cannabinoïde** (`ref-decouvertes-cannabinoides`) : Originaux de Wood, Spivey et Easterfield et jalon de liaison avant le clonage : documents primaires toujours inaccessibles. Le sous-point CB2 est désormais confirmé par le résumé original de Munro (1993). Aucune question du quiz ne dépend des précisions historiques non relues. Étymologie historique de l’anandamide non étayée dans les passages originaux accessibles ; question remplacée par la liaison amide documentée.
- **Δ9-THCA-B** (`record-cannabinoid-delta9-thca-b`) : La relation exacte de position du carboxyle THCA-A/THCA-B requiert le dessin ou texte intégral primaire ; la diffraction confirme une identité mais pas tous les détails comparatifs de la question.
- **CBG · laboratoire humain** (`record-study-cbg-laboratory-2026`) : Éditeur refusé : financement exact et dénominateur 16 éligibles du dossier initial restent à confirmer dans texte intégral.
- **Produit formulé** (`record-product-products-formulated`) : Confirmer les articles 18–19 dans la consolidation courante du règlement 178/2002 : texte original effectivement lu, consolidation 2026 inaccessible. Les affirmations de retrait et rappel ne sont pas validées comme vérification réglementaire actuelle.
- **Analyses et composition des lots** (`ref-analyses`) : Confirmer les articles 18–19 dans la consolidation courante du règlement 178/2002 : plusieurs URL consolidées bloquent par CAPTCHA/redirection ; texte original effectivement lu.
- **Statut des produits en France et dans l'UE** (`ref-reglementation-produits`) : Consolidation courante du règlement 178/2002 à confirmer pour les articles 18–19 ; original ouvert, versions consolidées demandées inaccessibles.

Les tentatives supplémentaires, y compris les téléchargements directs, figurent dans les rapports `*-final-access.json` de [cross-reviews](cross-reviews). Deux blocages antérieurs ont été levés par lecture locale : l’entretien LA Weekly sur OG Kush et la rétrospective Sensi sur Northern Lights.

### Fichiers de reprise

- [Inventaire individuel](inventory.json), [bibliographie avec preuves de lecture](bibliography.json), [bilan structuré](delivery.json) et [validations individuelles](validation.json).
- Les lots `batches/*.json` constituent la source de la révision finale. Réintégration : `node scripts/integrate-encyclopedia-revision.mjs` ; contrôle sans écriture : ajouter `--check`.
- Les anciens générateurs et scripts de recherche sont des traces de travail ; ne pas les relancer pour reconstruire les lots finaux. Ils peuvent écraser des corrections ultérieures.
- Toute modification de contenu invalide sa validation si l’empreinte ne correspond plus. `record-validation.mjs` exige l’empreinte d’une relecture manuelle actuelle ; ce script ne remplace pas la lecture éditoriale.
- Prochaine tâche bornée : reprendre les huit points ci-dessus quand les sources sont accessibles, sans recommencer les domaines validés.
<!-- END DELIVERY -->
