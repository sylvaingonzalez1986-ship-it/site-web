// Single-use targeted arbitration of C's corrections after A's first review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/';
const batch=JSON.parse(readFileSync(base+'batches/r-products-03.json','utf8'));
const review=JSON.parse(readFileSync(base+'reviews/r-products-03.json','utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const notes={
  'hemp-q2-rp03-dewaxed-extract-reduced-waxes':'Le terme winterisé remplace la traduction littérale dewaxed, conformément au passage OMS relu par A. Composition finale seulement, aucun procédé ajouté.',
  'hemp-q2-rp03-cbd-sedatives-somnolence':'C a appliqué l’association concrète CBD–alcool explicitement proposée et sourcée par A dans §7.4. Le mot sédatifs ne donne plus la réponse ; subjectKey, factKey et preuve décrivent maintenant cette association.',
  'hemp-q2-rp03-oromucosal-spray-part-swallowed':'Les quatre choix décrivent des voies d’absorption comparables. Le passage indépendant Karschner soutient la fraction avalée et digestive ; clé nabiximols commune appliquée.',
  'hemp-q2-rp03-epidiolex-sesame-oil-excipient':'Clé epidiolex-purified-cbd commune appliquée au produit, sans changement du fait, du corrigé ou de sa source.',
  'hemp-q2-rp03-canada-candy-extract-still-edible':'Le distracteur est désormais la classe extraits de cannabis, sans l’indice à inhaler ; distinction ingrédient/classe du produit final conservée.',
};
let changed=0;
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  for(const sourceId of q.sourceIds) assert.equal(item.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(batch.sources.find(source=>source.id===sourceId)),'changed source '+sourceId);
  if(!notes[q.id]){assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q),'changed approved question '+q.id);continue;}
  assert.equal(item.status,'changes_requested','single-use arbitration '+q.id);
  assert.notEqual(item.contentHash,hash(q));
  assert.equal(q.editorial.expectedAnswer,q.options[q.answer]);
  assert(q.prompt.length<=150&&q.options.every(option=>option.length<=75)&&q.explanation.length<=240,q.id+' length');
  const previous=structuredClone(item);
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];
  item.coordinatorChange={beforeContentHash:previous.contentHash,after:structuredClone(q),correctedBy:batch.author};
  item.coordinatorScope='Cinq corrections ciblées rédigées par C à partir des propositions et passages explicitement contrôlés par A. Root a relu les quatre choix et les corrections ; sources inchangées, aucune nouvelle consultation de source revendiquée.';
  item.comment=notes[q.id];item.status='approved';item.contentHash=hash(q);item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
  changed++;
}
assert.equal(changed,5);
assert.equal(batch.questions.length,25);
assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='25 questions approuvées :20 textes et preuves inchangés,5 corrections ciblées appliquées par C puis arbitrées par root ;17 objets sources inchangés. Les demandes initiales et leurs empreintes sont conservées.';
writeFileSync(base+'reviews/r-products-03.json',JSON.stringify(review,null,2)+'\n');
console.log('rp03:25 approved;5 targeted corrections;17 sources unchanged');
