import { readFile, writeFile } from 'node:fs/promises';
const path = 'docs/bete-de-concours/ux-progress.json';
const previous = JSON.parse(await readFile(path, 'utf8'));
const coverage = JSON.parse(await readFile('docs/encyclopedia-revision/coverage.json', 'utf8'));
const checkpoint = {
  date: '2026-11-14',
  status: 'Couverture exhaustive livrée en local ; validations et blocages individuels enregistrés, aucun déploiement.',
  scope: '189 fiches publiées, 160 termes et 360 questions. Trois spécialistes GPT-6.1 Sol, sans sous-délégation.',
  coverage,
  tracker: 'docs/encyclopedia-revision/inventory.json',
  workflow: 'docs/encyclopedia-revision/WORKFLOW.md',
  evidence: 'Lots individuels et preuves de consultation dans docs/encyclopedia-revision/batches ; bibliographie consolidée et contre-lectures séparées.',
  delivery: 'docs/encyclopedia-revision/delivery.json',
  verification: 'docs/encyclopedia-revision/verification.json',
  nextBoundedTask: 'Reprendre uniquement les huit points de source encore bloqués quand les documents primaires sont accessibles ; relire les passages concernés avant de renouveler leur validation.',
  deployed: false,
};
await writeFile(path, JSON.stringify({ encyclopediaScientificRevision: checkpoint, ...Object.fromEntries(Object.entries(previous).filter(([key]) => key !== 'encyclopediaScientificRevision')) }, null, 2) + '\n');
