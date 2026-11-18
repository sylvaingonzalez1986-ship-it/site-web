// Complete the targeted arbitration after the new fact's independent Sol review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batchPath=`${root}/batches/r-actives-b-01.json`, reviewPath=`${root}/reviews/r-actives-b-01.json`;
const batch=await read(batchPath), review=await read(reviewPath);
const conclusions={
 'gouttes-resine-tetes-collees':'Quatre aspects microscopiques plausibles remplacent les transformations fantaisistes. Le lien précis entre gouttes résineuses et agglutination des têtes reste celui déjà vérifié dans la source.',
 'glandes-fragilite-manipulation':'Les choix portent désormais sur des altérations anatomiques après récolte, sans nouvelle croissance. Les têtes rompues ou absentes restent le fait contrôlé dans le passage source.'
};
for(const [suffix,comment] of Object.entries(conclusions)){
 const id='hemp-q2-rb01-'+suffix, q=batch.questions.find(q=>q.id===id), item=review.items.find(item=>item.id===id);
 assert(q && item?.status==='changes_requested' && item.finalReviewer==='root');
 for(const proof of item.sourceChecks) assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)));
 const previous={...item}; delete previous.coordinatorHistory;
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[...(item.coordinatorHistory??[]),previous]});
}
const removedId='hemp-q2-rb01-sans-cannabinoides-autres-phenols';
const question=batch.questions.find(q=>q.id===removedId), item=review.items.find(item=>item.id===removedId);
assert(question && item?.status==='changes_requested');
const reason='La dernière version teste une propriété générale de l’aveugle expérimental. Le cannabis reste décoratif pour résoudre le QCM. Retrait sans remplissage ; une question distincte sera ajoutée au lot rb06 (32 au lieu de31).';
await writeFile(`${root}/facts/rb01-removed-sensory-control.json`,JSON.stringify({question,previousDecision:item,status:'excluded-before-activation',decidedBy:'root',date:'2026-11-17',reason},null,2)+'\n');
review.supersededItems??=[];
review.supersededItems.push({...item,status:'rejected',contentHash:hash(question),finalReviewer:'root',comment:reason});
review.revisionHistory??=[];
review.revisionHistory.push({date:'2026-11-17',reviewer:'root',removedId,reason});
batch.questions=batch.questions.filter(q=>q.id!==removedId);
review.items=review.items.filter(item=>item.id!==removedId);
assert.equal(batch.questions.length,29);
assert.equal(review.items.length,29);
for(const q of batch.questions){const decision=review.items.find(item=>item.id===q.id);assert.equal(decision.status,'approved');assert.equal(decision.contentHash,hash(q));}
await writeFile(batchPath,JSON.stringify(batch,null,2)+'\n');
await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('rb01:29 approved;1 generic candidate archived before activation');
