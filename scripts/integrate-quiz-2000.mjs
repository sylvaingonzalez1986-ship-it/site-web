/** Integrates only individually approved, unchanged questions. Never writes a database. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile, writeFile} from 'node:fs/promises';
import {finalQuizReviewer, loadQuizEditorialBatches, loadQuizReleaseSelection} from './lib/quiz-editorial-input.mjs';

if (existsSync('docs/quiz-2000/release-selection.json')) await import('./select-quiz-2000.mjs');
await import('./check-quiz-2000.mjs');
if (process.exitCode) throw new Error('Editorial checks failed; runtime files were not changed');
const root = 'docs/quiz-2000';
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const {target} = await read(`${root}/coverage-plan.json`);
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runtimeHash = question => hash(Object.fromEntries(['id','topicId','level','prompt','options','answer','explanation','articleId','sourceIds','subjectKey','domain'].filter(key=>question[key]!==undefined).map(key=>[key,question[key]])));
const initial = (await read(`${root}/audit-f-active-snapshot.json`)).entries;
const legacyIds = new Set(initial.map(question=>question.id));
const batches = await loadQuizEditorialBatches(root);
const selection = await loadQuizReleaseSelection(root);
const sources = new Map((await read('docs/encyclopedia-revision/bibliography.json')).map(source => [source.id,source]));
for (const batch of batches) for (const source of batch.sources) sources.set(source.id,source);
const entries = [], metadata = [];
for (const batch of batches) {
  const path = `${root}/reviews/${batch.batchId}.json`;
  if (!batch.retainedReview && !existsSync(path)) continue;
  const review = batch.retainedReview ?? await read(path);
  assert(review.reviewer !== batch.author, `${batch.batchId}: author cannot approve own work`);
  for (const question of batch.questions) {
    const scope = selection?.byId.get(question.id);
    if (selection && !scope) continue;
    const item = review.items.find(item => item.id === question.id && item.status === 'approved');
    if (!item) continue;
    const reviewer = finalQuizReviewer(review, item);
    assert(reviewer && reviewer !== batch.author, `${question.id}: author cannot approve own final version`);
    assert.equal(item.contentHash, hash(question), `${question.id}: review is stale`);
    const {id,topicId,level,prompt,options,answer,explanation,articleId,sourceIds,editorial} = question;
    if (scope) assert.equal(scope.contentHash,item.contentHash,`${id}: scope decision is stale`);
    entries.push({id,topicId,level,prompt,options,answer,explanation,articleId,sourceIds,subjectKey:editorial.subjectKey,...(scope ? {domain:scope.domain} : {})});
    metadata.push({...editorial,id,batchId:batch.batchId,author:batch.author,initialReviewer:item.initialReviewer ?? review.reviewer,...(item.initialReviewRecord ? {initialReviewRecord:item.initialReviewRecord} : {}),reviewer,reviewRecord:batch.retainedReview ? `${root}/legacy-review-f.json` : path,contentHash:item.contentHash,...(scope ? {domain:scope.domain,classificationRecord:scope.classificationRecord,classifiedBy:scope.classifiedBy,domainReviewedBy:scope.reviewedBy} : {})});
  }
}
if (process.argv.includes('--pilot')) assert.equal(entries.filter(entry => batches.filter(batch=>batch.batchId.startsWith('pilot-')).some(batch=>batch.questions.some(question=>question.id===entry.id))).length,30,'All 30 pilot questions require independent approval');
const articleSourceIds = {};
for (const entry of entries) articleSourceIds[entry.articleId] = [...new Set([...(articleSourceIds[entry.articleId] ?? []), ...entry.sourceIds])];
const used = new Set(entries.flatMap(entry=>entry.sourceIds));
const publicSources = [...used].sort().map(id => {
  const source = sources.get(id);
  const {title,organization,url,verifiedAt,author,published,passage,access,documentKind,limitation} = source;
  return {id,title,organization,url,verifiedAt,author,published,passage,access,documentKind,limitation};
});
// Retirements must be an explicit reviewed decision; never delete legacy JSON to retire an ID.
const retirements = existsSync(`${root}/retirements.json`) ? await read(`${root}/retirements.json`) : [];
for (const item of retirements) {
  const original = initial.find(question=>question.id===item.id);
  assert(original && item.reason && item.proposedBy && item.reviewer && item.proposedBy !== item.reviewer, 'Incomplete or non-independent retirement decision');
  assert(item.status === 'approved' && item.contentHash === hash(original), `${item.id}: retirement must approve the exact original question`);
}
const retiredIds = retirements.map(item=>item.id);
assert(new Set(retiredIds).size === retiredIds.length && retiredIds.every(id=>initial.some(entry=>entry.id===id)), 'Unknown or duplicate retirement');
const additions = entries.filter(entry=>!legacyIds.has(entry.id));
const revisions = entries.filter(entry=>legacyIds.has(entry.id));
assert(entries.every(entry=>!retiredIds.includes(entry.id)), 'A retired question cannot also be approved for activation');
if (selection) assert.equal(entries.length,selection.selected.length,'Every selected question must have an unchanged independent approval');
const activeCount = selection ? entries.length : initial.length - retiredIds.length + additions.length;
assert(activeCount <= target, `Integration would exceed the requested ${target} questions`);
const revision = `2026-11-17.hemp${activeCount}.${hash({entries,retiredIds,publicSources}).slice(0,12)}`;
const validatedActive = additions.length + revisions.length;
const countBy = key => Object.fromEntries([...new Set(metadata.map(item=>item[key]))].sort().map(value=>[value,metadata.filter(item=>item[key]===value).length]));
const levelCounts = Object.fromEntries([1,2,3,4].map(level=>[level,entries.filter(entry=>entry.level===level).length]));
const retained = metadata.filter(item=>item.legacyAction==='retain').length;
const corrected = metadata.filter(item=>item.legacyAction==='correct').length;
const legacyAwaitingValidation = selection ? selection.selected.filter(item=>legacyIds.has(item.id)).length-revisions.length : initial.length-retiredIds.length-revisions.length;
const scopeReport = selection ? {selectionRevision:selection.revision,domainQuotas:selection.quotas,domainCounts:countBy('domain'),excludedByScope:selection.excluded.length} : {};
await save('src/lib/kanab-quest-hemp-quiz-additions.json', {questions:additions,revisions,retiredIds,...(selection ? {activeIds:entries.map(entry=>entry.id)} : {})});
await save('src/lib/kanab-quest-hemp-quiz-public-sources.json', {sources:publicSources,articleSourceIds});
await save('src/lib/kanab-quest-hemp-quiz-release.json', {activeCount,revision});
await save(`${root}/integrated-editorial.json`,metadata);
await save(`${root}/legacy-validation.json`,revisions.map(entry=>({id:entry.id,status:'approved',runtimeHash:runtimeHash(entry),reviewer:metadata.find(item=>item.id===entry.id).reviewer})));
await save(`${root}/integration.json`,{target,activeCount,validatedActive,approvedAdditions:additions.length,validatedLegacy:revisions.length,retained,corrected,retired:retiredIds.length,legacyAwaitingValidation,remainingValidatedToTarget:target-validatedActive,validatedCategoryCounts:countBy('category'),validatedLevelCounts:levelCounts,...scopeReport,legacyValidation:'See legacy-validation.json; historical membership does not imply fresh validation.',revision,deployed:false,remoteDatabaseWritten:false});
const checkpointPath = `${root}/progress.json`;
if (existsSync(checkpointPath)) {
  const checkpoint = await read(checkpointPath);
  await save(checkpointPath,{...checkpoint,target,newValidated:additions.length,validatedLegacy:revisions.length,validatedActive,activeCount,legacyAwaitingValidation,remainingValidatedToTarget:target-validatedActive,retained,corrected,retired:retiredIds.length,...scopeReport,evidence:{...checkpoint.evidence,editorial:`${validatedActive} approved: ${additions.length} new, ${retained} retained and ${corrected} corrected legacy questions; exact question/source hashes checked`}});
}
const auditPath = `${root}/audit-f-index.json`;
const scopeCheckpoint='docs/quiz-rebalance-2026-11-17/progress.json';
if (selection && existsSync(scopeCheckpoint)) {
  const checkpoint=await read(scopeCheckpoint);
  const previousIds=new Set((await read('docs/quiz-rebalance-2026-11-17/baseline.json')).entries.map(item=>item.id));
  const retainedFromPrevious=entries.filter(item=>previousIds.has(item.id)).length;
  await save(scopeCheckpoint,{...checkpoint,selected:activeCount,domainCounts:countBy('domain'),excluded:selection.excluded.length,retainedFromPrevious,newValidated:activeCount-retainedFromPrevious,remaining:target-activeCount,latestIntegration:{revision,selectionRevision:selection.revision,report:`${root}/integration.json`}});
}
if (existsSync(auditPath)) {
  const audit = await read(auditPath);
  const legacyReviewPath = `${root}/legacy-review-f.json`;
  const legacyReview = existsSync(legacyReviewPath) ? await read(legacyReviewPath) : {items:[]};
  const reviewed = new Map(legacyReview.items.map(item=>[item.id,item]));
  const validated = new Set(revisions.map(entry=>entry.id));
  const queue = audit.filter(item=>!validated.has(item.id) && !retiredIds.includes(item.id) && !selection?.excludedById.has(item.id)).map(item=>{
    const decision = reviewed.get(item.id);
    return {id:item.id,topicId:item.topicId,initialAction:item.action,currentDecision:decision?.status ?? 'not-reviewed',reason:decision?.comment ?? item.reason,identityImpact:item.identityImpact,assignedBatch:batches.find(batch=>batch.questions.some(question=>question.id===item.id))?.batchId ?? null};
  });
  await save(`${root}/repair-queue.json`,{sourceReviewCompleted:legacyReview.items.filter(item=>item.reviewCompleted).length,sourceReviewTotal:legacyReview.items.length,pendingLegacy:queue.length,warning:'Work queue only. No text change or retirement is approved by this derived file.',entries:queue});
}
console.log(JSON.stringify({integratedAdditions:additions.length,validatedLegacy:revisions.length,validatedActive,activeCount,retired:retiredIds.length,releaseCheckRequired:true}));
