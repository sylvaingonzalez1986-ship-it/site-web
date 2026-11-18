// Apply the exact author proposal independently accepted by B; single use.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/';
const read=path=>JSON.parse(readFileSync(base+path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batch=read('batches/r-actives-a-03.json');
const review=read('reviews/r-actives-a-03.json');
const proposal=read('facts/ra03-schizophrenia-correction.json');
const proof=read('facts/ra03-schizophrenia-independent-review.json');
assert.equal(proof.status,'approved');
assert.notEqual(proposal.author,proof.reviewer);
assert.equal(hash(proposal),proof.proposalHash);
assert.equal(hash(proposal.newSource),proof.newSourceHash);
assert.equal(hash(proposal.proposedQuestionPatch),proof.proposedQuestionPatchHash);
const q=batch.questions.find(q=>q.id===proof.questionId);
const item=review.items.find(item=>item.id===proof.questionId);
assert.equal(hash(q),proof.originalContentHash);
assert.equal(item.status,'changes_requested');
const before=structuredClone(q);
const oldReview=structuredClone(item);
q.explanation=proposal.proposedQuestionPatch.explanation;
q.sourceIds.push(proposal.proposedQuestionPatch.additionalSourceId);
q.editorial.sourceEvidence.push(proposal.proposedQuestionPatch.additionalSourceEvidence);
assert.equal(hash(q),proof.proposedContentHash);
assert(!batch.sources.some(source=>source.id===proposal.newSource.id));
batch.sources.push(proposal.newSource);
Object.assign(item,{
  status:'approved',contentHash:hash(q),finalReviewer:proof.reviewer,finalReviewedAt:proof.reviewedAt,
  comment:proof.comment,sourceChecks:[...item.sourceChecks,...proof.sourceChecks],
  coordinatorHistory:[...(item.coordinatorHistory||[]),oldReview],
  coordinatorChange:{before,after:structuredClone(q)},
  coordinatorScope:'Root applique sans modification la proposition A dont B a contrôlé le nouvel objet source et reconstitué l’empreinte complète de la question.',
  additionalIndependentReview:'docs/quiz-2000/facts/ra03-schizophrenia-independent-review.json',
});
assert.equal(batch.questions.length,29);
assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='29 questions approuvées. Cinq corrections ciblées de formulation/clé arbitrées par root, un complément terminologique rédigé par A puis contre-lu par B, un doublon retiré avant activation et archivé. La place retirée est réaffectée à ra06.';
for(const [path,value] of [['batches/r-actives-a-03.json',batch],['reviews/r-actives-a-03.json',review]]) writeFileSync(base+path,JSON.stringify(value,null,2)+'\n');
console.log('ra03:29 approved;1 duplicate archived');
