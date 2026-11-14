import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const browser = await read('output/encyclopedia-revision/browser-report.json');
assert.equal(browser.events.length, 45);
assert.deepEqual(browser.errors, []);
for (const event of browser.events) assert(!event.overflow && event.failedImages === 0);
const readIds = new Set();
const readHashes = new Map();
for (const file of (await readdir(`${root}/cross-reviews`)).filter(f => f.endsWith('-coordinator.json'))) {
  const path = `${root}/cross-reviews/${file}`, report = await read(path);
  for (const id of report.entriesRead) { readIds.add(id); readHashes.set(id, report.contentHashes?.[id]); }
  delete report.finalApproval;
  report.finalApprovalRecordedIn = 'validation.json';
  await save(path, report);
}
assert.equal(readIds.size, 189, 'Individual coordinator reading must cover the whole catalog');
const reviewed = await read('src/lib/kanab-quest-cannabis-reviewed.json');
const sources = new Map(reviewed.sources.map(s => [s.id, s]));
const patches = new Map(reviewed.articles.map(a => [a.id, a]));
const inventory = await read(`${root}/inventory.json`);
const validation = {};
for (const entry of inventory.entries) {
  assert(readIds.has(entry.id));
  const patch = patches.get(entry.id);
  assert(patch);
  const contentHash = createHash('sha256').update(JSON.stringify(patch)).digest('hex');
  assert.equal(readHashes.get(entry.id), contentHash, `${entry.id}: manual reading record is missing or stale; editorial review must precede approval`);
  for (const s of patch.sections) assert(s.sourceIds.some(id => sources.has(id) && sources.get(id).access !== 'unavailable'), `${entry.id}/${s.id}: no consulted source`);
  const approved = entry.blockers.length === 0 && entry.illustration === 'verified';
  validation[entry.id] = {
    approved, reviewedAt: '2026-11-14', coordinator: 'Astra',
    contentHash,
    editorialRead: true, referencesAttached: true, visualDocumented: entry.illustration === 'verified',
    technicalEvidence: 'verification.json', browserEvidence: 'output/encyclopedia-revision/browser-report.json',
    visualScope: 'Gabarits et mises en page particulières contrôlés sur 15 fiches à 320, 390 et 1440 px ; la relecture éditoriale et des visuels de contenu porte sur chaque fiche.',
    blockers: entry.blockers
  };
}
await save(`${root}/validation.json`, validation);
console.log(`Validation recorded: ${Object.values(validation).filter(v => v.approved).length} approved; ${Object.values(validation).filter(v => !v.approved).length} blocked.`);
