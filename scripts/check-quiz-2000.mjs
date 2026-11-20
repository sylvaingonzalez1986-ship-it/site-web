/** Editorial checks are evidence gates, not a substitute for reading the sources. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {authorModule} from './audit-school-scenarios.mjs';
import {finalQuizReviewer, loadQuizEditorialBatches, loadQuizReleaseSelection} from './lib/quiz-editorial-input.mjs';
import {applyQuizAudit} from './lib/quiz-audit.mjs';

const root = 'docs/quiz-2000';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const {target, domainQuotas} = await json(`${root}/coverage-plan.json`);
assert(Number.isSafeInteger(target) && target > 0, 'A positive integer release target is required');
const normalize = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runtimeHash = question => hash(Object.fromEntries(['id','topicId','level','prompt','options','answer','explanation','articleId','sourceIds','subjectKey','domain'].filter(key=>question[key]!==undefined).map(key=>[key,question[key]])));
const categories = new Set(['varieties','genetics','botany','constituents','history','agronomy','quality','food','hemp-uses','prevention']);
const topics = new Set(['plant','genetics','molecules','evidence','uses','biodiversity','profiles','prevention','seeds','history']);
const access = new Set(['full-text','abstract','official-page','catalogue','excerpt','unavailable']);
const baseline = await json(`${root}/audit-f-active-snapshot.json`);
const legacy = Array.isArray(baseline) ? baseline : baseline.entries;
assert(Array.isArray(legacy), 'Expected a frozen initial question array');
const bibliography = await json('docs/encyclopedia-revision/bibliography.json');
const sources = new Map(bibliography.map(source => [source.id, source]));
const catalog = await json('docs/encyclopedia-revision/baseline-catalog.json');
const articleIds = new Set([...catalog.articles, ...catalog.records].map(article => article.id));
const batches = await loadQuizEditorialBatches(root);
const selection = await loadQuizReleaseSelection(root);
const excluded = selection?.excludedById ?? new Map();
const retiredIds = new Set(existsSync(`${root}/retirements.json`) ? (await json(`${root}/retirements.json`)).map(item=>item.id) : []);
if (selection) {
  assert.equal(selection.target,target,'Selection target differs from coverage plan');
  for (const domain of ['active','food','materials']) assert.equal(selection.quotas[domain],domainQuotas?.[domain],`${domain}: selection quota differs from coverage plan`);
}
const issues = [], approved = [], pending = [], questions = [];
const check = (condition, message) => { if (!condition) issues.push(message); };
for (const batch of batches) {
  for (const source of batch.sources ?? []) {
    check(!sources.has(source.id) || hash(sources.get(source.id)) === hash(source), `${source.id}: conflicting source definition; reference the registered source without redefining it`);
    for (const key of ['id','title','organization','url','verifiedAt','author','published','passage','documentKind','limitation']) check(typeof source[key] === 'string' && Boolean(source[key].trim()), `${source.id}: missing ${key}`);
    check(access.has(source.access), `${source.id}: access`);
    check(/^https:\/\//.test(source.url ?? ''), `${source.id}: HTTPS URL required by the tournament API`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt ?? ''), `${source.id}: consultation date`);
    for (const key of ['reader','date','locator','result']) check(Boolean(source.consultation?.[key]), `${source.id}: consultation.${key}`);
    sources.set(source.id, source);
  }
}
const legacyIds = new Set(legacy.map(question => question.id));
const ids = new Set();
const prompts = new Map(legacy.filter(question=>!excluded.has(question.id) && !retiredIds.has(question.id)).map(question => [normalize(question.prompt),question.id]));
const facts = new Map();
for (const batch of batches) {
  check(Boolean(batch.batchId && batch.author && batch.role), 'Incomplete batch identity');
  check(Array.isArray(batch.questions), `${batch.batchId}: questions`);
  const reviewPath = `${root}/reviews/${batch.batchId}.json`;
  const review = batch.retainedReview ?? (existsSync(reviewPath) ? await json(reviewPath) : null);
  const reviewed = new Map((review?.items ?? []).map(item => [item.id, item]));
  if (review) {
    check(review.batchId === batch.batchId, `${batch.batchId}: mismatched review`);
    check(review.reviewer && review.reviewer !== batch.author, `${batch.batchId}: independent reviewer required`);
    check(reviewed.size === review.items.length, `${batch.batchId}: duplicate review`);
  }
  for (const question of batch.questions ?? []) {
    const before = issues.length, id = question.id;
    const isLegacy = legacyIds.has(id);
    check(/^hemp-q2-[a-z0-9-]{1,67}$/.test(id) || isLegacy, `${id}: ID`);
    if (isLegacy) check(['retain','correct'].includes(question.editorial?.legacyAction), `${id}: legacy editorial action required`);
    check(!ids.has(id), `${id}: duplicate ID`); ids.add(id);
    check(topics.has(question.topicId), `${id}: topic`);
    check([1,2,3,4].includes(question.level), `${id}: level`);
    check(typeof question.prompt === 'string' && question.prompt.length > 10 && question.prompt.length <= 150, `${id}: prompt length`);
    const prompt = normalize(question.prompt ?? '');
    if (!excluded.has(id)) {
      check(!prompts.has(prompt) || prompts.get(prompt) === id, `${id}: duplicate prompt`); prompts.set(prompt,id);
    }
    check(Array.isArray(question.options) && question.options.length === 4, `${id}: four options`);
    check(question.options?.every(option => typeof option === 'string' && option.trim().length > 0 && option.length <= 75), `${id}: option length`);
    check(new Set((question.options ?? []).map(normalize)).size === 4, `${id}: normalized option duplicate`);
    check(Number.isInteger(question.answer) && question.answer >= 0 && question.answer <= 3, `${id}: one correct answer`);
    check(typeof question.explanation === 'string' && question.explanation.length > 20 && question.explanation.length <= 240, `${id}: explanation length`);
    check(articleIds.has(question.articleId), `${id}: unknown article ${question.articleId}`);
    check(Array.isArray(question.sourceIds) && question.sourceIds.length > 0, `${id}: source missing`);
    check(new Set(question.sourceIds ?? []).size === question.sourceIds?.length, `${id}: duplicate source ID`);
    check(question.sourceIds?.every(sourceId => sources.has(sourceId)), `${id}: unregistered source`);
    check(question.sourceIds?.some(sourceId => sources.get(sourceId)?.access && sources.get(sourceId).access !== 'unavailable'), `${id}: no accessible source`);
    const editorial = question.editorial ?? {};
    if (editorial.domain !== undefined) check(['active','food','materials'].includes(editorial.domain), `${id}: editorial domain`);
    check(typeof editorial.expectedAnswer === 'string' && normalize(editorial.expectedAnswer) === normalize(question.options?.[question.answer] ?? ''), `${id}: fact index disagrees with correct option`);
    check(categories.has(editorial.category), `${id}: editorial category`);
    for (const key of ['subject','property','expectedAnswer','learningObjective','factKey','form','difficultyRationale','subjectKey']) check(typeof editorial[key] === 'string' && Boolean(editorial[key].trim()), `${id}: editorial.${key}`);
    if (!excluded.has(id)) {
      check(!facts.has(editorial.factKey), `${id}: fact already tested by ${facts.get(editorial.factKey)}`); facts.set(editorial.factKey, id);
    }
    check(Array.isArray(editorial.sourceEvidence) && editorial.sourceEvidence.length > 0, `${id}: evidence missing`);
    for (const evidence of editorial.sourceEvidence ?? []) {
      check(question.sourceIds?.includes(evidence.sourceId) && Boolean(evidence.locator && evidence.support), `${id}: incomplete evidence`);
    }
    const item = reviewed.get(id);
    if (item?.status === 'approved') {
      const finalReviewer = finalQuizReviewer(review, item);
      check(finalReviewer && finalReviewer !== batch.author, `${id}: independent final reviewer required`);
      if (item.initialReviewer) {
        check(item.initialReviewer !== batch.author, `${id}: independent initial reviewer required`);
        const initialReview = typeof item.initialReviewRecord === 'string' && existsSync(item.initialReviewRecord) ? await json(item.initialReviewRecord) : null;
        const initialItem = initialReview?.items?.find(entry=>entry.id===id);
        check(initialReview?.reviewer === item.initialReviewer && initialItem?.status === 'approved' && initialItem.contentHash === item.initialReviewContentHash, `${id}: missing or stale separate initial review`);
      }
      check(item.contentHash === hash(question), `${id}: stale review hash`);
      if (editorial.domain) check(item.domain===editorial.domain && Boolean(item.domainComment), `${id}: explicit independent domain review required`);
      check(Boolean(item.comment), `${id}: missing review conclusion`);
      check(item.sourceChecks?.length > 0 && item.sourceChecks.every(source => question.sourceIds.includes(source.sourceId) && source.locator && source.result), `${id}: missing independent source check`);
      for (const sourceId of question.sourceIds ?? []) {
        const source = sources.get(sourceId), reviewedSource = item.sourceChecks?.find(check=>check.sourceId===sourceId);
        check(source && reviewedSource?.url === source.url && reviewedSource?.sourceHash === hash(source), `${id}: source ${sourceId} changed or not independently sealed`);
      }
      if (issues.length === before) approved.push(question);
    } else pending.push({id, status: item?.status ?? 'not-reviewed'});
    questions.push(question);
  }
}

const selectedApproved = selection ? approved.filter(question=>selection.byId.has(question.id)) : approved;
const relevantPending = pending.filter(item=>!excluded.has(item.id));
if (selection) {
  const byId = new Map(questions.map(question=>[question.id,question]));
  for (const decision of [...selection.selected,...selection.excluded]) {
    const question = byId.get(decision.id);
    check(question && decision.contentHash === hash(question), `${decision.id}: scope decision does not match the current authoring question`);
    if (selection.byId.has(decision.id) && question?.editorial.domain) check(question.editorial.domain === decision.domain, `${decision.id}: selected domain conflicts with authoring domain`);
    if (question?.editorial.domain) check(batches.some(batch=>batch.author===decision.classifiedBy && batch.questions.some(item=>item.id===decision.id)),`${decision.id}: domain classifier does not match the author`);
    if (question?.editorial.domain) check(batches.some(batch=>batch.author===decision.classifiedBy && batch.questions.some(item=>item.id===decision.id)),`${decision.id}: domain classifier does not match the author`);
  }
}
const reviewedRuntime = question => ({...question,subjectKey:question.editorial.subjectKey,
  ...(selection?.byId.has(question.id) ? {domain:selection.byId.get(question.id).domain} : {})});
const audited = await applyQuizAudit(selectedApproved.map(reviewedRuntime), sources, articleIds);
const auditedById = new Map(audited.map(question => [question.id, question]));

// Cheap candidate selection. A high score only asks for review, never proves a duplicate.
const stop = new Set('de du des le la les un une et en dans pour quel quelle quels quelles selon que est au aux par sur avec son sa ses ce cette ces qui il elle comment pourquoi'.split(' '));
const tokens = question => new Set(normalize(question.prompt + ' ' + question.options[question.answer]).split(' ').filter(token => token.length > 2 && !stop.has(token)));
const effectiveLegacy = legacy.filter(question=>!ids.has(question.id));
const all = [...effectiveLegacy, ...questions].map(question => ({question, tokens: tokens(question)}));
const buckets = new Map(), candidates = new Set(), near = [];
for (let index = 0; index < all.length; index++) {
  if (excluded.has(all[index].question.id) || retiredIds.has(all[index].question.id)) continue;
  for (const token of all[index].tokens) { const bucket = buckets.get(token) ?? []; bucket.push(index); buckets.set(token, bucket); }
}
for (const bucket of buckets.values()) {
  if (bucket.length > 100) continue;
  for (let left = 0; left < bucket.length; left++) for (let right = left + 1; right < bucket.length; right++) {
    if (bucket[right] >= effectiveLegacy.length) candidates.add(`${bucket[left]}:${bucket[right]}`);
  }
}
for (const pair of candidates) {
  const [left, right] = pair.split(':').map(Number), a = all[left], b = all[right];
  const intersection = [...a.tokens].filter(token => b.tokens.has(token)).length;
  const similarity = intersection / (a.tokens.size + b.tokens.size - intersection);
  if (similarity >= 0.48) near.push({ids:[a.question.id,b.question.id],similarity:Number(similarity.toFixed(3))});
}
near.sort((a,b) => b.similarity - a.similarity);
let active = null;
if (process.argv.includes('--release') || process.argv.includes('--active')) {
  active = (await authorModule('kanab-quest-hemp-quiz-bank.ts')).HEMP_QUIZ_BANK;
  const declared = (await authorModule('kanab-quest-hemp-quiz-meta.ts')).HEMP_QUIZ_BANK_SIZE;
  check(active.length === declared, 'Runtime count differs from advertised count');
  check(new Set(active.map(question => question.id)).size === active.length, 'Runtime duplicate IDs');
  const accepted = new Set(selectedApproved.map(question => question.id));
  const approvedById = new Map(approved.map(question=>[question.id,question]));
  const legacyById = new Map(legacy.map(question=>[question.id,question]));
  const legacyIds = new Set(legacy.map(question => question.id));
  for (const question of active) {
    if (selection) check(selection.byId.has(question.id), `${question.id}: active outside the reviewed release selection`);
    check(legacyIds.has(question.id) || accepted.has(question.id), `${question.id}: active without independent approval`);
    if (!legacyIds.has(question.id) && approvedById.has(question.id)) {
      const candidate = approvedById.get(question.id);
      check(runtimeHash(question) === runtimeHash(auditedById.get(candidate.id)), `${question.id}: runtime differs from the editorial audit`);
    }
    if (legacyIds.has(question.id)) {
      const original = legacyById.get(question.id), candidate = approvedById.get(question.id);
      check((!selection && runtimeHash(question) === runtimeHash(original)) || (candidate && runtimeHash(question) === runtimeHash(auditedById.get(candidate.id))), `${question.id}: legacy runtime differs from the editorial audit`);
    }
  }
  if (process.argv.includes('--release')) {
    check(active.length === target, `Release requires exactly ${target} active questions; found ${active.length}`);
    check(relevantPending.length === 0, `Release has ${relevantPending.length} pending candidates`);
    if (domainQuotas) {
      check(Boolean(selection), 'The new domain quotas require an independently reviewed release selection');
      for (const [domain,expected] of Object.entries(domainQuotas)) check(active.filter(question=>question.domain===domain).length===expected,`${domain}: release requires exactly ${expected} questions`);
    }
    if (selection) check(selectedApproved.length === selection.selected.length && active.length === selectedApproved.length, 'Release must integrate every selected approval, without archived entries');
    const decisionsPath = `${root}/legacy-validation.json`;
    const decisions = existsSync(decisionsPath) ? await json(decisionsPath) : [];
    const validatedLegacy = new Map(decisions.filter(item => item.status === 'approved').map(item => [item.id,item]));
    for (const question of active.filter(question => legacyIds.has(question.id))) {
      const candidate = approvedById.get(question.id);
      check(candidate && validatedLegacy.get(question.id)?.runtimeHash === runtimeHash(reviewedRuntime(candidate)), `${question.id}: legacy baseline lacks independent validation`);
    }
    const resolutionPath = `${root}/semantic-resolutions.json`;
    const resolutions = existsSync(resolutionPath) ? await json(resolutionPath) : [];
    const currentQuestions = new Map([...effectiveLegacy,...questions].map(question=>[question.id,question]));
    const resolved = new Set(resolutions.filter(item => item.reviewer && item.reason && ['distinct','retired'].includes(item.decision)
      && item.ids?.length === 2 && item.ids.every(id=>currentQuestions.has(id) && item.contentHashes?.[id] === hash(currentQuestions.get(id))))
      .map(item => [...item.ids].sort().join('|')));
    for (const pair of near) check(resolved.has([...pair.ids].sort().join('|')), `Semantic pair unresolved: ${pair.ids.join(', ')}`);
  }
}
const distribution = key => Object.fromEntries([...new Set(selectedApproved.map(key))].sort().map(value => [value,selectedApproved.filter(question => key(question) === value).length]));
const report = {target,baseline:legacy.length,candidates:questions.filter(question=>!excluded.has(question.id)).length,independentlyApproved:selectedApproved.length,reviewedAcrossArchive:approved.length,excludedByScope:excluded.size,pending:relevantPending.length,active:active?.length ?? null,domainQuotas:domainQuotas ?? null,domainCounts:selection ? distribution(question=>selection.byId.get(question.id).domain) : null,categoryCounts:distribution(question=>question.editorial.category),levelCounts:distribution(question=>auditedById.get(question.id).level),issues,pendingQuestions:relevantPending,semanticCandidates:near};
await mkdir('output/quiz-2000',{recursive:true});
await writeFile('output/quiz-2000/check.json', JSON.stringify(report,null,2)+'\n');
const approvedIds = new Set(approved.map(question=>question.id));
const pendingById = new Map(pending.map(item=>[item.id,item.status]));
const factIndex = all.map(({question})=>({id:question.id,status:retiredIds.has(question.id)?'retired':excluded.has(question.id)?'excluded-by-scope':approvedIds.has(question.id)?(selection&&!selection.byId.has(question.id)?'approved-not-selected':'approved'):pendingById.get(question.id)??'legacy-awaiting-validation',domain:selection?.byId.get(question.id)?.domain??question.editorial?.domain??null,category:question.editorial?.category??null,level:question.level,subjectKey:question.editorial?.subjectKey??null,factKey:question.editorial?.factKey??null,property:question.editorial?.property??null,prompt:question.prompt,expectedAnswer:question.options[question.answer],learningObjective:question.editorial?.learningObjective??null}));
await writeFile(`${root}/fact-index.jsonl`, factIndex.map(item=>JSON.stringify(item)).join('\n')+'\n');
console.log(JSON.stringify({...report,issues:issues.slice(0,25),pendingQuestions:undefined,semanticCandidates:near.length},null,2));
if (issues.length) process.exitCode = 1;
