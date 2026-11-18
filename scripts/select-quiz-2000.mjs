/** Derive the release selection from independent scope decisions and new approvals. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {finalQuizReviewer,loadQuizEditorialBatches,loadQuizReleaseSelection} from './lib/quiz-editorial-input.mjs';

const root='docs/quiz-2000', scopeRoot='docs/quiz-rebalance-2026-11-17';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline=(await read(`${scopeRoot}/baseline.json`)).entries;
const originalIds=new Set(baseline.map(item=>item.id));
const {target,domainQuotas:quotas}=await read(`${root}/coverage-plan.json`);
const selected=[],excluded=[],seen=new Set();
for (const name of ['a','b']) {
  const classificationRecord=`${scopeRoot}/classifications/${name}-reviewed.json`;
  const proof=await read(classificationRecord);
  for (const item of proof.items) {
    assert(originalIds.has(item.id) && !seen.has(item.id),`${item.id}: unknown/duplicate baseline classification`);
    seen.add(item.id);
    assert.equal(item.contentHash,baseline.find(question=>question.id===item.id).editorial.contentHash,`${item.id}: classification is stale`);
    const row={id:item.id,domain:item.domain,contentHash:item.contentHash,reason:item.reason,classifiedBy:proof.classifiedBy,reviewedBy:proof.reviewer,classificationRecord};
    (item.domain==='offscope' ? excluded : selected).push(row);
  }
}
assert.equal(seen.size,baseline.length,'Every previous question must have an independent scope decision');
for (const batch of await loadQuizEditorialBatches(root)) {
  const path=`${root}/reviews/${batch.batchId}.json`;
  if (!existsSync(path)) continue;
  const review=await read(path);
  for (const question of batch.questions.filter(question=>!originalIds.has(question.id))) {
    const item=review.items.find(item=>item.id===question.id && item.status==='approved');
    if (!item) continue;
    const reviewer=finalQuizReviewer(review,item);
    assert(reviewer && reviewer!==batch.author,`${question.id}: author cannot approve own work`);
    assert.equal(item.contentHash,hash(question),`${question.id}: stale approval`);
    assert(item.domainComment && item.domain===question.editorial.domain,`${question.id}: explicit domain review required`);
    selected.push({id:question.id,domain:item.domain,contentHash:item.contentHash,reason:item.domainComment,classifiedBy:batch.author,reviewedBy:reviewer,classificationRecord:path});
  }
}
for (const rows of [selected,excluded]) rows.sort((a,b)=>a.id.localeCompare(b.id));
const selection={revision:`2026-11-17.scope.${hash({selected,excluded}).slice(0,12)}`,target,quotas,selected,excluded};
assert.equal(new Set([...selected,...excluded].map(row=>row.id)).size,selected.length+excluded.length,'Duplicate selection decision');
for (const [domain,quota] of Object.entries(quotas)) assert(selected.filter(row=>row.domain===domain).length<=quota,`${domain}: approved candidates exceed quota`);
assert(selected.length<=target,'Approved candidates exceed target');
await writeFile(`${root}/release-selection.json`,JSON.stringify(selection,null,2)+'\n');
await loadQuizReleaseSelection(root);
console.log(JSON.stringify({selected:selected.length,excluded:excluded.length,domains:Object.fromEntries(Object.keys(quotas).map(domain=>[domain,selected.filter(row=>row.domain===domain).length]))}));
