// Single-use arbitration of the correction explicitly requested by A.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/';
const read=path=>JSON.parse(readFileSync(base+path,'utf8'));
const batch=read('batches/r-actives-b-05.json');
const review=read('reviews/r-actives-b-05.json');
const correction=read('facts/rb05-710-correction.json');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id='hemp-q2-rb05-710-oil-code';
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  for(const sourceId of q.sourceIds) assert.equal(item.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(batch.sources.find(source=>source.id===sourceId)));
  if(q.id!==id){assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));continue;}
  assert.equal(item.status,'changes_requested');
  assert.equal(hash(q),'9b209b5d18cd6ad131bcfde1ec6379b12767ea81b9edac11fd678f0c9a0b45d2');
  assert.equal(q.editorial.expectedAnswer,q.options[q.answer]);
  assert(q.prompt.length<=150&&q.options.every(option=>option.length<=75)&&q.explanation.length<=240);
  const previous=structuredClone(item);
  Object.assign(item,{
    status:'approved',contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',
    comment:'Le fait porte désormais sur la famille de produits associée au code710, explicitement soutenue dans le glossaire relu par A. Quatre familles de produits actifs plausibles remplacent le rébus ; l’explication culturelle OIL reste après la réponse.',
    coordinatorHistory:[...(item.coordinatorHistory||[]),previous],
    coordinatorChange:{authorCorrectionRecord:'docs/quiz-2000/facts/rb05-710-correction.json',authorCorrectionRecordHash:hash(correction),beforeContentHash:previous.contentHash,after:structuredClone(q)},
    coordinatorScope:'Correction ciblée rédigée par B à la demande de A ; source inchangée, aucune nouvelle consultation de source revendiquée par root.',
  });
}
assert.equal(batch.questions.length,31);
assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='31 questions approuvées :30 inchangées et une correction ciblée de710 ;26 objets sources inchangés.';
writeFileSync(base+'reviews/r-actives-b-05.json',JSON.stringify(review,null,2)+'\n');
console.log('rb05:31 approved;710 asks the product family, not a rebus');
