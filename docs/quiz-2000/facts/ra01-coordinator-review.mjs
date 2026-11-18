// Targeted corrections after the first independent Sol source review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before=await read(`${root}/facts/ra01-before-corrections.json`);
const batchPath=`${root}/batches/r-actives-a-01.json`, reviewPath=`${root}/reviews/r-actives-a-01.json`;
const batch=await read(batchPath), review=await read(reviewPath);
assert.equal(hash(batch.sources),hash(before.sources),'The first Sol source proofs must remain unchanged');
const notes={
 'terpenes-contribute-cannabis-smell':'Complément soufré non soutenu retiré ; la famille terpénique et la distinction avec la teneur cannabinoïde restent celles de la preuve citée.',
 'harvest-aroma-monoterpene-evaporation':'Quatre évolutions chimiques remplacent les distracteurs absolus ou éloignés ; niveau 2 cohérent avec la volatilité différentielle.',
 'oral-cbd-no-detected-thc-bioconversion':'Quatre profils de détection sanguine comparables remplacent Oui/Non ; étude et portée humaine délimitées ; niveau 2.',
 'thc-cooh-nonpsychoactive-metabolite':'Énoncé harmonisé avec les quatre profils d’activité ; réponse et preuve inchangées.',
 'cb1-activation-limits-neurotransmitter-release':'Quatre actions sur les neurotransmetteurs sont comparées avec une précision similaire ; libération, synthèse, dégradation et recapture ne sont plus distinguées par des absolus.',
 'cbd-negative-cb1-modulation-in-cells':'Quatre directions de réponse comparables ; réserve entre observation cellulaire et intoxication humaine maintenue.',
 'cbn-insomnia-primary-wake-result-2026':'Quatre conclusions du critère clinique remplacent la disparition absolue des réveils ; distinction principal/secondaire et limite de l’essai conservées.',
 'oral-cbd-not-guaranteed-thc-high-reduction':'Quatre profils d’ivresse remplacent les promesses universelles ; niveau 2. Le coordinateur harmonise uniquement la grammaire du prompt avec ces résultats nominaux.'
};
for(const [suffix,comment] of Object.entries(notes)){
 const id='hemp-q2-ra01-'+suffix, q=batch.questions.find(q=>q.id===id), original=before.questions.find(q=>q.id===id);
 const item=review.items.find(item=>item.id===id);
 assert(q && original && item?.status==='changes_requested');
 assert.equal(JSON.stringify(q.sourceIds),JSON.stringify(original.sourceIds));
 assert.equal(JSON.stringify(q.editorial.sourceEvidence),JSON.stringify(original.editorial.sourceEvidence));
 for(const proof of item.sourceChecks) assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)));
 const previous={...item};
 const coordinatorChange=suffix==='oral-cbd-not-guaranteed-thc-high-reduction'?{field:'prompt',before:q.prompt,after:'Quel résultat décrit l’essai de Haney (2016) sur du CBD oral pris avant du cannabis fumé ?'}:undefined;
 if(coordinatorChange) q.prompt=coordinatorChange.after;
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[previous],coordinatorScope:'Lecture des quatre choix, réponse, explication et différences entre versions. Passages et objets sources inchangés, déjà vérifiés par le relecteur Sol ; aucune nouvelle consultation revendiquée.',...(coordinatorChange?{coordinatorChange}:{})});
}
for(const q of batch.questions){const item=review.items.find(item=>item.id===q.id);assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));}
await writeFile(batchPath,JSON.stringify(batch,null,2)+'\n');
await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('ra01:30 approved, unchanged first-review source proofs; one prompt grammar adjustment by coordinator');
