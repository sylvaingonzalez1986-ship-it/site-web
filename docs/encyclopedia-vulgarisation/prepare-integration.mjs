import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const folder = 'docs/encyclopedia-vulgarisation';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const save = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pilot = read(`${folder}/pilot.json`);
const files = fs.readdirSync('docs/encyclopedia-revision/batches').filter(file => file.endsWith('.json')).sort();
const entries = [], termIds = new Set(), quizIds = new Set();
for (const file of files) {
  const lot = read(`${folder}/batches/${file}`);
  const report = read(`${folder}/reviews/coordinator/${file}`);
  for (const originalEntry of lot.articles) {
    const entry = originalEntry.id === pilot.article.id ? pilot.article : originalEntry;
    const patch = { ...entry.patch, id: entry.id };
    if (patch.image === null && patch.diagram) delete patch.image;
    const hash = digest(patch);
    assert.equal(report.entries[entry.id]?.contentHash, hash, `${entry.id}: missing or stale individual reading`);
    assert(entry.pedagogicalReview, `${entry.id}: missing rewrite record`);
    if (entry.id === pilot.article.id) assert.equal(report.pilotQuiz?.hash, digest(pilot.quizPatches), 'Pilot quiz reading missing or stale');
    entries.push({ id: entry.id, contentHash: hash, lot: file, scientificBlockers: entry.blockers || [] });
  }
  assert.equal(report.glossary?.hash, digest(lot.termReviews), `${file}: glossary reading missing or stale`);
  assert.equal(report.quiz?.hash, digest(lot.quizPatches), `${file}: quiz reading missing or stale`);
  for (const term of lot.termReviews) termIds.add(term.id);
  for (const patch of lot.quizPatches) if (patch.explanation) quizIds.add(patch.id);
}
for (const patch of pilot.quizPatches) quizIds.add(patch.id);
assert.equal(entries.length, 189);
assert.equal(new Set(entries.map(entry => entry.id)).size, 189);
assert.equal(termIds.size, 160);
assert.equal(quizIds.size, 360);
save(`${folder}/integration.json`, {
  date: '2026-11-14', status: 'editorial-review-complete-technical-validation-pending',
  articles: entries.length, terms: termIds.size, explanations: quizIds.size, entries,
  note: 'Original scientific batches remain in encyclopedia-revision/batches. The integration script uses the pedagogical copies and injects the separately reviewed pilot.'
});
console.log('189 fiches, 160 définitions, 360 explications relues : intégration autorisée, vérification technique à effectuer.');
