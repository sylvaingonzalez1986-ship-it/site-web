import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const coverage = await read(`${root}/coverage.json`);
const inventory = await read(`${root}/inventory.json`);
const byDomain = {};
for (const entry of inventory.entries) {
  const d = byDomain[entry.responsible] ||= { inventoried: 0, reviewed: 0, illustrated: 0, validated: 0, blocked: 0 };
  d.inventoried++;
  if (entry.verification === 'reviewed') d.reviewed++;
  if (entry.illustration === 'verified') d.illustrated++;
  if (entry.finalValidation === 'validated') d.validated++;
  if (entry.finalValidation === 'blocked') d.blocked++;
}
const delivery = {
  date: '2026-11-14', status: 'Local revision delivered with explicit unresolved source-access blockers',
  coverage, byDomain, quizRetainedAfterReview: coverage.quizReviewed - coverage.quizCorrected,
  sourceCountMeaning: 'sourcesRead compte des identifiants de références effectivement consultées ; sourceUrlsRead compte leurs URL distinctes. Aucun de ces nombres ne représente des études indépendantes : des sources et cohortes communes sont explicitement rapprochées.',
  changes: [
    '189 fiches relues individuellement : mécanismes, terminologie, niveaux de preuve, limites et références rattachées aux sections.',
    'Botanique : fruit et graine, trichomes, reproduction et diversité séparés ; généalogies commerciales attribuées à leur version et à leur auteur.',
    'Chimie et pharmacologie : formes acides/neutres et isomères distingués ; résultats cellulaires, animaux et humains séparés ; critères principaux négatifs conservés, pas de promesse thérapeutique tirée d’une affinité ou d’un arôme.',
    'Santé végétale : signes, symptômes et identification séparés ; hôte, région et portée des expériences conservés. Photographies comparatives de houblon et basilic clairement légendées.',
    'Produits et réglementation : huile de graines distincte des extraits, teneurs alimentaires en mg/kg distinctes du seuil variétal, avis scientifique distinct d’une autorisation, systèmes constructifs et bilans environnementaux contextualisés.',
    'Images scientifiques, photographies, schémas HTML, crédits et sources accessibles ; cartes de terpènes raccordées aux notices révisées.',
    '74 questions effectivement modifiées ; 286 relues et conservées. Identifiants, destinations et fonctionnement du score préservés ; réponses du quiz séparées des données clientes.'
  ],
  blockers: inventory.entries.filter(e => e.finalValidation === 'blocked').map(e => ({ id: e.id, title: e.title, lot: e.lot, reasons: e.blockers })),
  validation: 'verification.json', inventory: 'inventory.json', bibliography: 'bibliography.json', individualApprovals: 'validation.json',
  browserEvidence: 'output/encyclopedia-revision/browser-report.json',
  deploymentPerformed: false, migrationsApplied: 0,
  nextBoundedTask: 'Reprendre uniquement les huit points de source bloqués quand les documents primaires deviennent accessibles ; relire les passages concernés avant de renouveler leur empreinte de validation.'
};
await writeFile(`${root}/delivery.json`, JSON.stringify(delivery, null, 2) + '\n');
const path = `${root}/WORKFLOW.md`;
const previous = (await readFile(path, 'utf8')).split('\n<!-- BEGIN DELIVERY -->')[0];
const tick = String.fromCharCode(96);
const summary = `
<!-- BEGIN DELIVERY -->
## Livraison locale du 14 novembre 2026

| État | Fiches |
| --- | ---: |
| Inventoriées | ${coverage.inventoried} |
| Relues intégralement | ${coverage.reviewed} |
| Corrigées / enrichies | ${coverage.corrected} |
| Illustrées | ${coverage.illustrated} |
| Entièrement validées | ${coverage.validated} |
| Bloquées sur une source | ${coverage.blocked} |
| Non examinées ou en attente de relecture | ${coverage.pending} |

Les 160 termes et les 360 questions ont été relus. **74 questions sont effectivement modifiées et 286 conservées après vérification.** Les lots contiennent aussi des copies inchangées pour tracer la relecture ; elles ne sont pas comptées comme corrections. Les identifiants, ancres, destinations, relations et règles de score sont préservés.

${delivery.changes.slice(1, 5).map(item => '- ' + item).join('\n')}

Les 189 fiches disposent d’un visuel explicatif : 42 présentent une photographie documentaire, 26 une structure chimique et 139 un diagramme HTML (catégories cumulables). Les auteurs, licences, légendes et liens d’origine accompagnent les images. Les diagrammes conceptuels ne sont pas présentés comme observations ni comme mesures. Les données et textes des cartes de terpènes utilisent la révision des fiches.

Les références effectivement consultées correspondent à ${coverage.sourcesRead} identifiants et ${coverage.sourceUrlsRead} URL distinctes. **Ce ne sont pas des décomptes d’études indépendantes.** Les références inaccessibles restent explicites ; une lecture de résumé n’est pas comptée comme texte intégral.

### Vérifications

TypeScript et ESLint ciblé passent. Les trois fichiers Vitest totalisent **13 tests réussis**. Le contrôle navigateur couvre **45 combinaisons** (15 fiches × 320, 390 et 1 440 px), sans débordement horizontal, image en échec ni erreur JavaScript. Les gabarits et mises en page particulières ont aussi été inspectés visuellement. Les contrôles incluent les crédits de molécules, le maintien du focus dans la fenêtre et sa fermeture par Échap. Deux avertissements existants, Vite et PostCSS, sont consignés sans échec dans [verification.json](verification.json).

Aucun déploiement ni migration appliquée. Les changements préexistants du dépôt sont préservés.

### Sources restant bloquées

${delivery.blockers.map(e => `- **${e.title}** (${tick}${e.id}${tick}) : ${e.reasons.join(' ')}`).join('\n')}

Les tentatives supplémentaires, y compris les téléchargements directs, figurent dans les rapports ${tick}*-final-access.json${tick} de [cross-reviews](cross-reviews). Deux blocages antérieurs ont été levés par lecture locale : l’entretien LA Weekly sur OG Kush et la rétrospective Sensi sur Northern Lights.

### Fichiers de reprise

- [Inventaire individuel](inventory.json), [bibliographie avec preuves de lecture](bibliography.json), [bilan structuré](delivery.json) et [validations individuelles](validation.json).
- Les lots ${tick}batches/*.json${tick} constituent la source de la révision finale. Réintégration : ${tick}node scripts/integrate-encyclopedia-revision.mjs${tick} ; contrôle sans écriture : ajouter ${tick}--check${tick}.
- Les anciens générateurs et scripts de recherche sont des traces de travail ; ne pas les relancer pour reconstruire les lots finaux. Ils peuvent écraser des corrections ultérieures.
- Toute modification de contenu invalide sa validation si l’empreinte ne correspond plus. ${tick}record-validation.mjs${tick} exige l’empreinte d’une relecture manuelle actuelle ; ce script ne remplace pas la lecture éditoriale.
- Prochaine tâche bornée : reprendre les huit points ci-dessus quand les sources sont accessibles, sans recommencer les domaines validés.
<!-- END DELIVERY -->
`;
await writeFile(path, previous + summary);
