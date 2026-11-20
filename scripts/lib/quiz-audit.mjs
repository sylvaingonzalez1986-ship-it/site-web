import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const directory = 'docs/quiz-audit-2026-11-19';
const editable = ['topicId', 'level', 'prompt', 'options', 'answer', 'explanation', 'articleId', 'sourceIds'];
const fields = ['id', ...editable, 'subjectKey', 'domain'];
const topics = new Set(['plant', 'genetics', 'molecules', 'evidence', 'uses', 'biodiversity', 'profiles', 'prevention', 'seeds', 'history']);
const levels = [1, 2, 3, 4];
const normalize = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const validText = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

export function quizAuditBaselineHash(entries) {
  const stableEntries = [...entries].sort((a, b) => a.id.localeCompare(b.id))
    .map(entry => fields.map(field => entry[field]));
  return createHash('sha256').update(JSON.stringify(stableEntries)).digest('hex');
}

/** Apply the documented audit to the independently approved editorial baseline. */
export async function applyQuizAudit(entries, sources, articleIds) {
  const manifestPath = directory + '/manifest.json';
  if (!existsSync(manifestPath)) return entries;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.baselineHash, quizAuditBaselineHash(entries), 'The quiz audit applies to a different editorial baseline');
  const reviews = new Map();
  for (const { file, count, reviewer } of manifest.lots) {
    assert(reviewer, file + ': missing audit attribution');
    const content = await readFile(directory + '/' + file, 'utf8');
    const records = content.trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.equal(records.length, count, file + ': incomplete audit lot');
    for (const row of records) {
      assert(row.id && !reviews.has(row.id), row.id + ': duplicate audit record');
      assert(Array.isArray(row.issues) && row.patch && Object.keys(row.patch).every(key => editable.includes(key)),
        row.id + ': invalid audit record');
      reviews.set(row.id, row);
    }
  }
  assert.equal(reviews.size, entries.length, 'The audit must cover the active bank');
  const prompts = new Set();
  return entries.map(entry => {
    const row = reviews.get(entry.id);
    assert(row && row.before === entry.level, entry.id + ': missing or stale audit record');
    const changed = Object.keys(row.patch).length > 0;
    assert.equal(row.status, changed ? 'corrigée' : 'conservée', entry.id + ': status differs from audit patch');
    if (changed) assert(row.issues.length, entry.id + ': change without an audit reason');
    else assert(row.issues.every(issue => issue === 'titre-source') || row.pending, entry.id + ': issue without a disposition');
    for (const [key, value] of Object.entries(row.patch)) {
      assert.notEqual(JSON.stringify(entry[key]), JSON.stringify(value), entry.id + ': unchanged ' + key + ' in audit patch');
    }
    const updated = { ...entry, ...row.patch };
    assert(topics.has(updated.topicId) && levels.includes(updated.level) && updated.level === row.after, entry.id + ': theme or difficulty');
    assert(validText(updated.prompt, 11, 150) && !prompts.has(normalize(updated.prompt)), entry.id + ': short, long or duplicate prompt');
    prompts.add(normalize(updated.prompt));
    assert(updated.options.length === 4 && updated.options.every(option => validText(option, 1, 75))
      && new Set(updated.options.map(normalize)).size === 4, entry.id + ': invalid or duplicate options');
    assert(Number.isInteger(updated.answer) && updated.answer >= 0 && updated.answer < 4, entry.id + ': invalid answer index');
    assert(validText(updated.explanation, 21, 240), entry.id + ': explanation length');
    assert(articleIds.has(updated.articleId), entry.id + ': unknown encyclopedia article');
    assert(updated.sourceIds.length && new Set(updated.sourceIds).size === updated.sourceIds.length
      && updated.sourceIds.every(id => sources.has(id)) && updated.sourceIds.some(id => sources.get(id).access && sources.get(id).access !== 'unavailable'),
    entry.id + ': invalid source references');
    return updated;
  });
}
