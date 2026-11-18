import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';

export function finalQuizReviewer(review, item) {
  return item.finalReviewer ?? item.metadataAdjustment?.approvedAndAppliedBy ?? item.reviewer ?? review.reviewer;
}

const read = async file => JSON.parse(await readFile(file,'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** A new scope can exclude valid historical facts without rewriting their evidence.
 * Every selected/excluded decision is tied to an independently reviewed domain and
 * the exact authoring question hash. A partial selection is allowed during work;
 * the release checker separately requires the complete requested quotas.
 */
export async function loadQuizReleaseSelection(root='docs/quiz-2000') {
  const path = `${root}/release-selection.json`;
  if (!existsSync(path)) return null;
  const selection = await read(path);
  assert(selection.revision && Number.isSafeInteger(selection.target) && selection.target > 0, 'Invalid release selection identity');
  const domains = ['active','food','materials'];
  assert(domains.every(domain => Number.isSafeInteger(selection.quotas?.[domain]) && selection.quotas[domain] >= 0), 'Invalid domain quotas');
  assert.equal(domains.reduce((sum,domain)=>sum+selection.quotas[domain],0),selection.target,'Domain quotas must sum to target');
  assert(Array.isArray(selection.selected) && Array.isArray(selection.excluded), 'Selection requires selected and excluded decisions');
  const records = new Map(), selected = new Map(), excluded = new Map();
  const record = async file => {
    if (!records.has(file)) records.set(file, await read(file));
    return records.get(file);
  };
  for (const [rows, destination, allowed] of [[selection.selected,selected,domains],[selection.excluded,excluded,[...domains,'offscope']]]) {
    for (const row of rows) {
      assert(row.id && !selected.has(row.id) && !excluded.has(row.id), `${row.id}: duplicate scope decision`);
      assert(allowed.includes(row.domain) && row.reason && row.classificationRecord, `${row.id}: incomplete scope decision`);
      assert(/^[a-f0-9]{64}$/.test(row.contentHash), `${row.id}: invalid question hash`);
      assert(row.classifiedBy && row.reviewedBy && row.classifiedBy !== row.reviewedBy, `${row.id}: independent domain review required`);
      const proof = await record(row.classificationRecord);
      const decision = proof.items?.find(item => item.id === row.id);
      assert(decision?.status === 'approved', `${row.id}: domain decision is not approved`);
      assert.equal(finalQuizReviewer(proof,decision),row.reviewedBy,`${row.id}: domain reviewer mismatch`);
      assert.equal(decision.contentHash,row.contentHash,`${row.id}: stale domain question hash`);
      assert.equal(decision.domain,row.domain,`${row.id}: domain differs from independent review`);
      if (proof.classificationFile) {
        const original = (await record(proof.classificationFile)).items?.find(item=>item.id===row.id);
        assert(original && decision.classificationHash === hash(original), `${row.id}: classification changed after counter-review`);
        assert.equal(proof.classifiedBy,row.classifiedBy,`${row.id}: initial classifier mismatch`);
      }
      destination.set(row.id,row);
    }
  }
  assert(selected.size <= selection.target, 'Selection exceeds the requested bank size');
  for (const domain of domains) assert([...selected.values()].filter(row=>row.domain===domain).length <= selection.quotas[domain],`${domain}: selection exceeds its quota`);
  return {...selection,byId:selected,excludedById:excluded};
}

/** Original questions can be independently retained without pretending the reviewer authored them.
 * Both original and annotated candidate fingerprints must have been sealed by that reviewer.
 */
export async function loadQuizEditorialBatches(root='docs/quiz-2000') {
  const files = existsSync(`${root}/batches`) ? (await readdir(`${root}/batches`)).filter(file=>file.endsWith('.json')).sort() : [];
  const batches = await Promise.all(files.map(file=>read(`${root}/batches/${file}`)));
  const legacyPath = `${root}/legacy-review-f.json`;
  if (!existsSync(legacyPath)) return batches;
  const review = await read(legacyPath);
  const initial = new Map((await read(`${root}/audit-f-active-snapshot.json`)).entries.map(question=>[question.id,question]));
  const rows = new Map(review.items.map(item=>[item.id,item]));
  for (const group of review.groups) {
    // Incomplete annotations remain a work record, not an integrated approval.
    const candidates = group.ids.map(id=>rows.get(id)).filter(item=>item?.status==='approved' && item.candidateContentHash);
    if (!candidates.length) continue;
    const questions = candidates.map(item=>{
      assert(item.reviewer === review.reviewer && item.reviewCompleted, `${item.id}: independent review incomplete`);
      assert.equal(item.contentHash,hash(item.question),`${item.id}: original review changed`);
      assert.equal(item.contentHash,hash(initial.get(item.id)),`${item.id}: retained content must be the unchanged original`);
      const question = {...item.question,editorial:item.editorial};
      assert.equal(item.candidateContentHash,hash(question),`${item.id}: annotated candidate review changed`);
      return question;
    });
    const batchId = group.group;
    assert(!batches.some(batch=>batch.batchId===batchId),`${batchId}: duplicate legacy batch`);
    batches.push({batchId,author:'legacy-bank-2026-11-14',role:'Independent validation of unchanged legacy questions',questions,sources:[],
      retainedReview:{batchId,reviewer:review.reviewer,reviewedAt:group.checkedAt,items:candidates.map(item=>({...item,contentHash:item.candidateContentHash}))}});
  }
  return batches;
}
