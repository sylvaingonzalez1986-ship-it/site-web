// Integrate the replacement exactly as independently approved by B.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const root='docs/quiz-2000/',read=p=>JSON.parse(readFileSync(root+p,'utf8'));
const proposal=read('facts/rp04-replacement-proposal.json'),proof=read('facts/rp04-replacement-independent-review.json');
const batch=read('batches/r-products-04.json'),review=read('reviews/r-products-04.json');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),q=proposal.question,item=structuredClone(proof.items[0]);
assert.equal(batch.questions.length,26);assert(!batch.questions.some(x=>x.id===q.id));assert.equal(item.status,'approved');
assert.notEqual(proof.reviewer,batch.author);assert.equal(item.contentHash,hash(q));
for(const s of proposal.sources){assert.equal(item.sourceChecks.find(c=>c.sourceId===s.id).sourceHash,hash(s));assert(!batch.sources.some(x=>x.id===s.id));}
item.initialReviewer=proof.reviewer;item.initialReviewRecord=root+'facts/rp04-replacement-independent-review.json';item.initialReviewContentHash=item.contentHash;
item.integrationNote='Objet et source intégrés sans modification après première lecture indépendante B ; candidat chocolat/xylitol retiré et conservé séparément.';
batch.questions.push(q);batch.sources.push(...proposal.sources);review.items.push(item);
review.coordinatorSummary='27 approuvées :16 inchangées,10 corrections ciblées et1 remplacement original de C relu indépendamment par B. L’ancien candidat hors périmètre reste archivé, jamais activé.';
writeFileSync(root+'batches/r-products-04.json',JSON.stringify(batch,null,2)+'\n');writeFileSync(root+'reviews/r-products-04.json',JSON.stringify(review,null,2)+'\n');
console.log('rp04:27 approved, replacement evidence preserved');
