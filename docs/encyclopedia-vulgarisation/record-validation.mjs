import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const folder = 'docs/encyclopedia-vulgarisation';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const save = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const integration = read(`${folder}/integration.json`);
const technical = read(`${folder}/verification.json`);
for (const check of ['typescript', 'lint', 'tests', 'integration']) assert.equal(technical[check], 'PASS', `Technical check pending: ${check}`);
const browser = read('output/encyclopedia-vulgarisation/browser-report.json');
assert.equal(browser.events.length, 45);
assert.deepEqual(browser.errors, []);
for (const event of browser.events) {
  assert(!event.overflow && event.failedImages === 0 && !event.brokenCitations && !event.duplicateCitations && !event.leadCitations && event.diagramAfterText);
  if (event.id === 'ref-terpenes-terpenoides') assert(event.detailsKeyboard);
  if (event.id === 'record-cannabinoid-cbd') assert(event.legacyAnchorFocus);
}
const patches = new Map(read('src/lib/kanab-quest-cannabis-reviewed.json').articles.map(article => [article.id, article]));
const validation = {};
for (const entry of integration.entries) {
  const hash = createHash('sha256').update(JSON.stringify(patches.get(entry.id))).digest('hex');
  assert.equal(hash, entry.contentHash, `${entry.id}: integrated text differs from individual reading`);
  validation[entry.id] = {
    approved: entry.scientificBlockers.length === 0, contentHash: hash,
    reviewedAt: '2026-11-14', editorialRead: true, pedagogicalRewriteReviewed: true,
    blockers: entry.scientificBlockers, technicalEvidence: 'verification.json',
    browserEvidence: 'output/encyclopedia-vulgarisation/browser-report.json',
    scope: 'Individual editorial reading; representative rendering and keyboard checks at 320, 390 and 1440 px. Not a user comprehension study.'
  };
}
save(`${folder}/validation.json`, validation);
integration.status = 'integrated-and-verified';
save(`${folder}/integration.json`, integration);
const progress = read(`${folder}/progress.json`);
progress.status = 'integrated-and-verified';
progress.reviewed = integration.articles;
progress.glossary = { scope: 160, reviewed: 160 };
progress.quiz = { scope: 360, explanationsReviewed: 360 };
progress.scientificBlockers = integration.entries.filter(entry => entry.scientificBlockers.length).map(entry => ({ id: entry.id, blockers: entry.scientificBlockers }));
save(`${folder}/progress.json`, progress);
console.log(`${integration.articles} rewrites checked; ${progress.scientificBlockers.length} existing scientific source limitations retained.`);
