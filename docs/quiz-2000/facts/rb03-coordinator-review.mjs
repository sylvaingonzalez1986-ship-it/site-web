// Final arbitration: four targeted corrections, one ambiguity rechecked in the primary paper.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before=await read(`${root}/facts/rb03-before-corrections.json`);
const batchPath=`${root}/batches/r-actives-b-03.json`, path=`${root}/reviews/r-actives-b-03.json`;
const batch=await read(batchPath), review=await read(path);
const notes={
 'indica-sativa-profils-chimiques':'Quatre interprétations de la classification commerciale ; superposition des profils explicitement vérifiée par le coordinateur dans Smith2022, Results/Fig6.',
 'meme-nom-composition-variable':'Le distracteur sur les clusters terpéniques était partiellement vrai. Reprise ciblée de C, correction de B et lecture du coordinateur de Results/Fig8–9 : quatre états de cohérence désormais distincts (supérieure au hasard mais variable, aléatoire, identité parfaite, association inverse), niveau2.',
 'cbdas-pseudogenes-thc':'Question inchangée ; seul le prénom Reginald remplace Ryan dans l’auteur de la source, conformément à la vérification primaire et à la demande explicite de C.',
 'position-fleurs-composition':'Cannabinoïdes et terpénoïdes sont désormais nommés dans le prompt ; résultat borné aux plantes de l’étude.',
 'norml-mission':'Quatre causes associatives comparables remplacent des missions de police ou d’autorité de licence ; mission officielle conservée.'
};
for(const [suffix,comment] of Object.entries(notes)){
 const id='hemp-q2-rb03-'+suffix, q=batch.questions.find(q=>q.id===id), item=review.items.find(item=>item.id===id);
 assert(q && item?.status==='changes_requested');
 const previous=structuredClone(item);
 for(const proof of item.sourceChecks){
  const source=batch.sources.find(source=>source.id===proof.sourceId), original=before.sources.find(source=>source.id===proof.sourceId);
  if(proof.sourceHash!==hash(source)){
   assert.equal(source.id,'q2-rb03-allen26'); assert.equal(proof.sourceHash,hash(original));
   assert.deepEqual(Object.keys(source).filter(key=>JSON.stringify(source[key])!==JSON.stringify(original[key])),['author']);
   assert.equal(source.author,'Keith Allen, Anthony Torres et Reginald Gaudino');
   proof.metadataAdjustment={previousSourceHash:proof.sourceHash,approvedAndAppliedBy:'root',field:'author',before:original.author,after:source.author,basis:'Correction explicitement demandée par le premier relecteur Sol après lecture de l’original ; aucun changement du passage factuel.'};
   proof.sourceHash=hash(source);
  }
 }
 if(suffix==='meme-nom-composition-variable'){
  item.coordinatorChange={promptBefore:q.prompt,explanationBefore:q.explanation};
  q.prompt='Dans l’étude de Smith (2022), comment les profils des fleurs vendues sous un même nom se comparent-ils ?';
  q.explanation='Les profils de même nom sont souvent plus proches qu’après mélange aléatoire des noms, mais leur cohérence varie. Un nom commercial ne garantit donc pas une composition identique.';
  q.editorial.sourceEvidence=[{sourceId:'q2-rb03-smith22',locator:'Results, Commercial strain names display differential levels of chemical consistency ; Figure8C–D et discussion Figure9',support:'La majorité des noms regroupe des profils plus proches qu’après mélange aléatoire, avec une forte variabilité de cohérence selon les noms.'}];
  item.coordinatorChange.promptAfter=q.prompt; item.coordinatorChange.explanationAfter=q.explanation;
 }
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[previous],coordinatorScope:'Quatre choix, réponse et explication relus ; premières preuves Sol conservées. Source Smith2022 également rouverte par le coordinateur pour lever une ambiguïté ; métadonnée Allen corrigée sur demande explicite de C.'});
 if(['indica-sativa-profils-chimiques','meme-nom-composition-variable'].includes(suffix)) item.coordinatorConsultation={reader:'root',date:'2026-11-17',url:'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0267498',locator:'Results, commercial labels et commercial strain names ; Figures6,8 et9',result:'Superposition des catégories commerciales confirmée. Certains noms ont une association réelle à des clusters ; la cohérence reste variable et, pour la majorité, supérieure au mélange aléatoire. Lecture ciblée des passages, pas revendication de lecture de tout le papier.'};
}
const activeIds=new Set(batch.questions.map(q=>q.id));
const removed=review.items.filter(item=>!activeIds.has(item.id));
assert.equal(removed.length,2);
review.supersededItems??=[];
review.supersededItems.push(...removed.map(item=>({...item,status:'rejected',finalReviewer:'root',finalReviewedAt:'2026-11-17',comment:item.id.includes('f2-')?'Doublon du fait F2 déjà actif ; candidat retiré avant activation.':'Pigmentation foliaire générale hors périmètre actif ; candidat retiré avant activation.'})));
review.items=review.items.filter(item=>activeIds.has(item.id));
review.revisionHistory??=[]; review.revisionHistory.push({date:'2026-11-17',reviewer:'root',removedIds:removed.map(item=>item.id),replacementSlots:'rb06 grows to35; B total stays185'});
assert.equal(batch.questions.length,29);
for(const q of batch.questions){const item=review.items.find(item=>item.id===q.id);assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));for(const proof of item.sourceChecks)assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)));}
await writeFile(batchPath,JSON.stringify(batch,null,2)+'\n');
await writeFile(path,JSON.stringify(review,null,2)+'\n');
console.log('rb03:29 approved;2 unused candidates archived;primary ambiguity resolved');
