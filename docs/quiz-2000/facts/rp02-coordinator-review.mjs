// Targeted final review after the independent Sol source checks; no new fact or source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before=await read(`${root}/facts/rp02-before-corrections.json`);
const batch=await read(`${root}/batches/r-products-02.json`);
const path=`${root}/reviews/r-products-02.json`, review=await read(path);
const notes={
 'sinsemilla-seedless-flower':'Thème et catégorie corrigés vers plante/botanique ; le fait concerne les fleurs de cannabis à actifs, et non l’alimentation par graines.',
 'traditional-blunt-tobacco-wrapper':'Quatre enveloppes végétales plausibles ; définition traditionnelle et réserve sur les enveloppes modernes conservées.',
 'dry-herb-vaporizer-flower':'Quatre matières destinées à différents appareils d’inhalation remplacent les usages oraux éloignés ; aucun indice uniquement/tous.',
 'bong-water-cools-smoke':'Quatre composants réels du bong sont comparés ; le refroidissement par l’eau reste le fait sourcé, sans promesse d’innocuité.',
 'cannabis-vaping-aerosol':'Quatre mécanismes de production d’un aérosol ou d’une fumée remplacent les propositions de pureté absolue ; le chauffage est le mécanisme décrit par la source.',
 'eu-cbd-animal-feed-unauthorised-additive':'Quatre statuts réglementaires comparables du même actif ; juridiction, année et distinction avec la graine alimentaire conservées.',
 'france-vape-cbd-chemical-or-extracted':'Quatre paires d’origines parallèles ; question explicitement bornée aux origines mentionnées par le flyer, sans déduire le statut d’une origine non citée.',
 'canada-edible-caffeine-natural-ingredients':'Quatre conditions réglementaires comparables remplacent les autorisations absolues ; distinction entre ingrédients caféinés et additif conforme à la preuve.',
 'shake-flower-fragments-versus-trim-leaves':'Quatre distinctions entre matières végétales remplacent huiles, cristaux et résines ; vocabulaire et réserve sur le taux cannabinoïde conservés.'
};
for(const [suffix,comment] of Object.entries(notes)){
 const id='hemp-q2-rp02-'+suffix, q=batch.questions.find(q=>q.id===id), original=before.questions.find(q=>q.id===id), item=review.items.find(item=>item.id===id);
 assert(q && original && item?.status==='changes_requested');
 assert.equal(JSON.stringify(q.sourceIds),JSON.stringify(original.sourceIds));
 assert.equal(JSON.stringify(q.editorial.sourceEvidence),JSON.stringify(original.editorial.sourceEvidence));
 for(const proof of item.sourceChecks) assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)));
 const previous={...item};
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[previous],coordinatorScope:'Lecture complète des neuf questions corrigées et comparaison avec les versions soumises à Sol. SourceEvidence et objets sources inchangés ; aucune nouvelle consultation revendiquée.'});
}
for(const q of batch.questions){const item=review.items.find(item=>item.id===q.id);assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));}
await writeFile(path,JSON.stringify(review,null,2)+'\n');
console.log('rp02:30 approved, original independent source checks preserved');
