import fs from 'node:fs';
import { createHash } from 'node:crypto';
const [name, selection, note] = process.argv.slice(2);
if (!name || !selection || !note) throw new Error('lot, explicitly read IDs (or all), and review note are required');
const folder = 'docs/encyclopedia-vulgarisation';
const lot = JSON.parse(fs.readFileSync(`${folder}/batches/${name}.json`, 'utf8'));
const pilot = JSON.parse(fs.readFileSync(`${folder}/pilot.json`, 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const selected = selection === 'all' ? lot.articles.map(entry => entry.id) : selection.split(',');
fs.mkdirSync(`${folder}/reviews/coordinator`, { recursive: true });
const path = `${folder}/reviews/coordinator/${name}.json`;
const report = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : { date: '2026-11-14', lot: name, entries: {} };
for (const id of selected) {
  const entry = id === pilot.article.id ? pilot.article : lot.articles.find(entry => entry.id === id);
  if (!entry?.pedagogicalReview) throw new Error(`${id}: no pedagogical rewrite record`);
  const patch = { ...entry.patch, id };
  if (patch.image === null && patch.diagram) delete patch.image;
  report.entries[id] = { contentHash: digest(patch), note, status: 'read-and-reviewed' };
  if (id === pilot.article.id) report.pilotQuiz = { count: pilot.quizPatches.length, hash: digest(pilot.quizPatches) };
}
if (process.argv.includes('--extras')) {
  report.glossary = { count: lot.termReviews.length, hash: digest(lot.termReviews) };
  report.quiz = { count: lot.quizPatches.length, hash: digest(lot.quizPatches) };
}
fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
const progress = JSON.parse(fs.readFileSync(`${folder}/progress.json`, 'utf8'));
for (const entry of progress.entries) if (selected.includes(entry.id)) {
  entry.status = 'read-and-reviewed';
  entry.review = `reviews/coordinator/${name}.json`;
}
progress.reviewed = progress.entries.filter(entry => entry.status === 'read-and-reviewed').length;
fs.writeFileSync(`${folder}/progress.json`, JSON.stringify(progress, null, 2) + '\n');
console.log(`${selected.length} readings recorded; ${progress.reviewed}/189 individually reviewed. Technical validation still pending.`);
