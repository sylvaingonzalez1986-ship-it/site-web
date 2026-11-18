// Single-use arbitration of C's corrections after B's first review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/';
const batchPath=base+'batches/r-mixed-02.json';
const reviewPath=base+'reviews/r-mixed-02.json';
const batch=JSON.parse(readFileSync(batchPath,'utf8'));
const review=JSON.parse(readFileSync(reviewPath,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fda=batch.sources.find(source=>source.id==='q2-rm02-fda-cbd-everolimus');
const oldFda={...fda,documentKind:'original-research'};
const notes={
  'hemp-q2-rm02-cannabis-tobacco-dual-dependence':'Les quatre choix décrivent désormais des profils de dépendance comparables. La double dépendance et le rôle propre du tabac restent le fait explicitement contrôlé par B.',
  'hemp-q2-rm02-synthetic-hot-pockets':'Les quatre configurations matérielles évitent la reconnaissance du seul mot cannabinoïdes parmi caféine/nicotine. La définition de zones surconcentrées et le risque d’exposition inégale restent inchangés.',
  'hemp-q2-rm02-cbd-everolimus-exposure':'La notice FDA est correctement identifiée comme document réglementaire. Le texte conserve le résultat et la surveillance prévue, avec suppression d’une mise en garde générique sans ajout de fait.',
  'hemp-q2-rm02-eu-seed-oil-thc-food-maxima':'Les quatre couples utilisent les mêmes unités et valeurs plausibles. La distinction graines/huile, les équivalents delta-9-THC et la portée alimentaire sont conservés ; l’accès à la source reste explicitement excerpt.',
};
let changed=0;
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  const previous=structuredClone(item);
  for(const sourceId of q.sourceIds){
    const source=batch.sources.find(source=>source.id===sourceId);
    const check=item.sourceChecks.find(check=>check.sourceId===sourceId);
    if(sourceId===fda.id){
      assert.equal(check.sourceHash,hash(oldFda),'only FDA documentKind may change');
      check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(oldFda),previousSource:oldFda,basis:'B a ouvert la notice FDAmai2026 et explicitement demandé la qualification de document institutionnel/réglementaire. Seul documentKind est changé.'};
      check.sourceHash=hash(source);
    } else assert.equal(check.sourceHash,hash(source),'changed source '+sourceId);
  }
  if(!notes[q.id]){assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q),'changed approved question '+q.id);continue;}
  assert.equal(item.status,'changes_requested','single-use script '+q.id);
  const authorCorrection=structuredClone(q);
  if(q.id==='hemp-q2-rm02-cbd-everolimus-exposure'){
    assert.equal(previous.contentHash,hash(q),'FDA question must be unchanged before root text edit');
    q.explanation='L’exposition à l’évérolimus a augmenté avec le CBD pharmaceutique. La notice prévoit donc une surveillance des concentrations de l’évérolimus lors de cette association.';
  } else assert.notEqual(previous.contentHash,hash(q));
  assert.equal(q.editorial.expectedAnswer,q.options[q.answer]);
  assert(q.prompt.length<=150&&q.options.every(option=>option.length<=75)&&q.explanation.length<=240,q.id+' length');
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];
  item.coordinatorChange={beforeContentHash:previous.contentHash,authorCorrection,after:structuredClone(q)};
  item.coordinatorScope='Arbitrage des corrections ciblées de C après la lecture indépendante de B. Aucune nouvelle consultation de source revendiquée par root ; changement FDA purement documentaire vérifié sur son objet complet.';
  item.status='approved';item.contentHash=hash(q);item.comment=notes[q.id];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
  changed++;
}
assert.equal(changed,4);assert.equal(batch.questions.length,25);assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='25 questions approuvées (10active/7food/8materials).21 inchangées, trois corrections de distracteurs, une notice FDA requalifiée avec historique d’empreinte et une explication raccourcie sans ajout factuel.';
writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');
writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('rm02:25 approved; final secondary-domain additions validated');
