// Single-use arbitration after B's first review and A's replacement review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadQuizEditorialBatches} from '../../../scripts/lib/quiz-editorial-input.mjs';
const base='docs/quiz-2000/';
const read=path=>JSON.parse(readFileSync(base+path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batch=read('batches/r-mixed-01.json');
const review=read('reviews/r-mixed-01.json');
const newProofPath='docs/quiz-2000/facts/rm01-katabira-independent-review.json';
const newProof=read('facts/rm01-katabira-independent-review.json');
const newId='hemp-q2-rm01-katabira-hemp-summer-robe';
const oldId='hemp-q2-rm01-hemp-pp-mapp-interface';
const oldItem=review.items.find(item=>item.id===oldId);
assert(oldItem&&oldItem.status==='changes_requested','single-use arbitration');
const guide=batch.sources.find(source=>source.id==='q2-rm01-cenc-finishes');
const oldGuide={...guide,documentKind:'original-research'};
assert.equal(hash(oldGuide),'188154cac7f9756c29e7e6c83e2fddb54a0f44bc06c1cc22bd7d51613c0e03a0','guide correction must change only documentKind');
const conclusions={
  'hemp-q2-rm01-seed-essential-amino-acids-present':'La question compare la présence des neuf acides aminés à l’absence de trois acides nommés. Le fait présence, les limites sur les proportions et la digestibilité restent distincts d’une promesse de couverture alimentaire.',
  'hemp-q2-rm01-seed-cadmium-from-soil':'Le prompt ne demande plus si une précaution est nécessaire. Les quatre conclusions concernent le devenir du cadmium et l’usage des graines ; le transfert vers les graines et la réserve alimentaire restent le résultat relu par B.',
  'hemp-q2-rm01-hemp-wall-vapour-compatible-finish':'La notice est correctement qualifiée de guide professionnel ; fait et question inchangés.',
  'hemp-q2-rm01-hemp-wall-flexible-plaster':'Niveau2 retenu conformément à B, pour une compatibilité mécanique expliquée sans résultat spécialisé à mémoriser. Notice guide professionnel corrigée.',
  'hemp-q2-rm01-hemp-wall-gypsum-acoustic-difference':'Construire en Chanvre est nommé pour rendre le tirage isolé compréhensible. Notice guide professionnel corrigée.',
  'hemp-q2-rm01-hemp-wall-first-rain-protection':'Les alternatives décrivent des fonctions climatiques cohérentes. Le fait de protection contre l’eau liquide reste soutenu ; notice guide professionnel corrigée.',
  'hemp-q2-rm01-earth-hemp-clay-binder':'Le nom terre-chanvre qui révélait la réponse a disparu du prompt. Quatre liants comparables remplacent les choix trop éloignés, sans changement du fait EcoTerra.',
};
for(const q of batch.questions){
  if(q.id===newId){
    const proof=structuredClone(newProof.items.find(item=>item.id===newId));
    assert.equal(proof.status,'approved');assert.equal(proof.contentHash,hash(q));
    assert.notEqual(newProof.reviewer,batch.author);
    for(const sourceId of q.sourceIds) assert.equal(proof.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(batch.sources.find(source=>source.id===sourceId)));
    const before=structuredClone(q);
    // Keep the garment names without giving away the material/season in distractors.
    q.options=['Le katabira','Le hitoe','Le kosode','Le jinbaori'];
    q.editorial.expectedAnswer=q.options[q.answer];
    review.items.push({...proof,
      contentHash:hash(q),initialReviewer:newProof.reviewer,initialReviewRecord:newProofPath,initialReviewContentHash:proof.contentHash,
      finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[proof],coordinatorChange:{before,after:structuredClone(q)},
      comment:'Le fait textile et la source sont approuvés par A. Root retire seulement les descriptions de matière/saison des distracteurs, qui permettaient de les éliminer sans connaître les vêtements ; le corrigé expliqué reste inchangé.',
      coordinatorScope:'Nouvel objet rédigé par C et intégralement contre-lu par A, puis correction de jouabilité sans fait ni source supplémentaires. La première revue A est référencée explicitement, indépendamment du reviewer B du lot initial.',
    });
    continue;
  }
  const item=review.items.find(item=>item.id===q.id);
  const oldReview=structuredClone(item);
  for(const sourceId of q.sourceIds){
    const source=batch.sources.find(source=>source.id===sourceId);
    const check=item.sourceChecks.find(check=>check.sourceId===sourceId);
    if(sourceId===guide.id){
      assert.equal(check.sourceHash,hash(oldGuide));
      check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(oldGuide),previousSource:oldGuide,basis:'B a consulté le guide professionnel et expressément demandé de corriger original-research ; seul documentKind a changé.'};
      check.sourceHash=hash(source);
    } else assert.equal(check.sourceHash,hash(source),'changed source '+sourceId);
  }
  if(!conclusions[q.id]){assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));continue;}
  assert.equal(item.status,'changes_requested');
  const authorCorrection=structuredClone(q);
  if(q.id==='hemp-q2-rm01-seed-cadmium-from-soil'){
    q.prompt='Dans l’étude de Mihoc sur des sols chargés en métaux, quelle observation concerne les graines de chanvre alimentaires ?';
    q.options=[
      'Le cadmium reste dans les racines, sans atteindre les graines',
      'Le cadmium atteint les feuilles, mais reste absent des graines',
      'Le cadmium atteint aussi les graines, posant un problème alimentaire',
      'Le cadmium atteint les graines, où il devient un nutriment essentiel',
    ];
    q.editorial.expectedAnswer=q.options[q.answer];
  }
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),oldReview];
  item.coordinatorChange={beforeContentHash:oldReview.contentHash,authorCorrection,after:structuredClone(q)};
  item.coordinatorScope='Correction ciblée après première revue B ; sources inchangées sauf la qualification documentaire du guide, vérifiée par B. Root ne revendique aucune nouvelle consultation.';
  item.status='approved';item.contentHash=hash(q);item.comment=conclusions[q.id];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
}
review.supersededItems=[...(review.supersededItems||[]),{...oldItem,status:'rejected',finalReviewer:'root',finalReviewedAt:'2026-11-17',replacementId:newId,coordinatorScope:'Fonction générale d’un compatibilisant plastique exclue du périmètre textile/bâtiment avant activation. Nouveau fait textile rédigé par C et contre-lu par A.'}];
review.items=review.items.filter(item=>item.id!==oldId);
for(const q of batch.questions){assert.equal(q.editorial.expectedAnswer,q.options[q.answer]);assert(q.prompt.length<=150&&q.options.every(option=>option.length<=75)&&q.explanation.length<=240,q.id+' length');assert.equal(review.items.find(item=>item.id===q.id).contentHash,hash(q));}
assert.equal(review.items.length,25);assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='25 questions approuvées :12 alimentaires et13 textiles/bâtiment. Sept demandes ciblées résolues, MAPP rejeté et remplacé par katabira contre-lu par A. Les quatre preuves du guide CenC corrigé ont été rescéllées avec leur historique ; aucune source nouvelle approuvée par son auteur.';
writeFileSync(base+'batches/r-mixed-01.json',JSON.stringify(batch,null,2)+'\n');
writeFileSync(base+'reviews/r-mixed-01.json',JSON.stringify(review,null,2)+'\n');
const ids=['hemp-q2-rm01-seed-oil-gla-omega6','hemp-seeds-omega-trois'];
const questions=(await loadQuizEditorialBatches()).flatMap(batch=>batch.questions);
const paired=ids.map(id=>questions.find(q=>q.id===id));
assert(paired.every(Boolean));
assert.equal(paired[0].editorial.subjectKey,paired[1].editorial.subjectKey);
const resolutions=read('semantic-resolutions.json');
assert(!resolutions.some(item=>item.ids.includes(ids[0])));
resolutions.push({ids,decision:'distinct',reviewer:'root',basedOn:'reviews/r-mixed-01.json#summary.closePairGLA',reason:'B a lu les deux objets complets et la source Galasso : la question ancienne identifie l’ALA comme oméga3, la nouvelle identifie le GLA minoritaire comme oméga6. Deux molécules et deux familles distinctes, sans inversion du même fait. La clé huile-chenevis commune évite leur présence ensemble dans une partie.',contentHashes:Object.fromEntries(paired.map(q=>[q.id,hash(q)])),approvalStatusById:Object.fromEntries(ids.map(id=>[id,'approved']))});
writeFileSync(base+'semantic-resolutions.json',JSON.stringify(resolutions,null,2)+'\n');
console.log('rm01:25 approved (12food/13materials); MAPP replaced; GLA/ALA distinction recorded');
