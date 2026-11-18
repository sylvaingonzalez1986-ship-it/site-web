// Single-use targeted arbitration after the independent Sol reviews.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const edits={
  'hemp-q2-rb06-ganja-herbe':q=>{q.options[1]='Une boisson traditionnelle contenant des feuilles de cannabis';},
  'hemp-q2-rb06-reefer-adaptation-musicale':q=>{
    q.options=['Une pièce de théâtre de boulevard','Un spectacle de marionnettes','Un ballet narratif','Une comédie musicale'];
    q.level=2;q.editorial.difficultyRationale='Identifier le genre d’une adaptation précise exige un repère de culture cannabique, même si les noms des genres sont courants.';
  },
  'hemp-q2-rb06-cannabis-cup-jury-public':q=>{
    q.prompt='Dans l’édition new-yorkaise 2025 de la Cannabis Cup, qui attribue les notes départageant les produits ?';
    q.level=2;q.editorial.difficultyRationale='Reconnaître le fonctionnement d’une édition précise d’un concours exige une connaissance de la culture cannabique ; le nom du modèle ne donne plus la réponse.';
  },
  'hemp-q2-rb06-cbg-cannabigerol':q=>{q.subjectKey='cbg';q.editorial.subjectKey='cbg';},
  'hemp-q2-ra05-trainwreck-arcata-california':q=>{q.level=2;q.editorial.difficultyRationale='La provenance annoncée d’une lignée nommée exige un repère variétal précis ; le vocabulaire courant ne suffit pas à trouver la réponse.';},
  'hemp-q2-ra05-super-skunk-afghani-addition':()=>{},
  'hemp-q2-ra05-la-confidential-dna-parentage':()=>{},
  'hemp-q2-ra05-maui-waui-nirvana-tropical-aroma':q=>{q.topicId='molecules';},
  'hemp-q2-ra05-acapulco-gold-central-american-origin':q=>{q.level=2;q.editorial.difficultyRationale='La région génétique revendiquée par une maison pour sa version est une connaissance variétale précise, non une simple devinette sur le nom.';},
  'hemp-q2-ra05-france-2025-medical-last-line-announcement':q=>{
    q.options=['En première intention pour les indications retenues','En relais après stabilisation par un traitement habituel','En dernière ligne de traitement','En association d’emblée au traitement habituel'];
  },
  'hemp-q2-ra05-chs-hot-baths-not-specific':q=>{
    q.prompt='Selon le consensus européen de 2025, hors hyperémèse cannabique, dans quel tableau le soulagement par les bains chauds est-il aussi rapporté ?';
    q.options=['Le reflux gastro-œsophagien','La gastroparesie diabétique','L’occlusion intestinale','D’autres syndromes de vomissements cycliques'];
    q.explanation='Le consensus rapporte ce comportement dans l’hyperémèse cannabique, mais aussi chez d’autres patients souffrant de vomissements cycliques. Il ne permet donc pas, à lui seul, de distinguer les deux tableaux.';
  },
  'hemp-q2-ra05-aasm-2018-cannabis-not-osa-treatment':q=>{
    q.options=['Usage déconseillé : sécurité et efficacité insuffisamment établies','Usage déconseillé : aggravation des apnées démontrée','Usage envisageable après échec de la pression positive','Usage envisageable pour les apnées légères sans somnolence'];
  },
};
const notes={
  'hemp-q2-rb06-ganja-herbe':'Quatre types de préparations comparables ; le distracteur de graines sans actifs est remplacé. Le fait relu par C reste inchangé.',
  'hemp-q2-rb06-reefer-adaptation-musicale':'Quatre genres scéniques pouvant porter une satire, sans indice comique limité à la bonne réponse. Niveau2 retenu pour ce repère culturel précis.',
  'hemp-q2-rb06-cannabis-cup-jury-public':'L’énoncé ne traduit plus le nom People’s Choice. Le modèle reste expliqué dans le corrigé. Niveau2 retenu pour le fonctionnement d’une édition précise.',
  'hemp-q2-rb06-cbg-cannabigerol':'Clé de sujet harmonisée en cbg, identique aux autres questions portant sur le composé ; aucun autre champ factuel changé.',
  'hemp-q2-ra05-trainwreck-arcata-california':'Niveau2 cohérent avec une provenance variétale spécifique ; fait et source inchangés.',
  'hemp-q2-ra05-super-skunk-afghani-addition':'Date affichée conservée littéralement après lecture indépendante explicite de B ; aucune interprétation de son format.',
  'hemp-q2-ra05-la-confidential-dna-parentage':'Auteur Adam rattaché à DNA Genetics ; date affichée conservée littéralement, suppression de la normalisation non prouvée.',
  'hemp-q2-ra05-maui-waui-nirvana-tropical-aroma':'Thème affiché Arômes et terpènes, catégorie éditoriale varieties conservée.',
  'hemp-q2-ra05-acapulco-gold-central-american-origin':'Niveau2 pour une provenance annoncée précise, sans utiliser le nom comme raccourci de difficulté.',
  'hemp-q2-ra05-france-2025-medical-last-line-announcement':'Quatre places thérapeutiques distinctes et plausibles remplacent les options redondantes ou hors sujet. L’annonce reste explicitement historique.',
  'hemp-q2-ra05-chs-hot-baths-not-specific':'Question recentrée sur l’autre tableau clinique explicitement nommé dans le consensus, avec quatre catégories cliniques parallèles. Aucun diagnostic personnel ni fait nouveau.',
  'hemp-q2-ra05-aasm-2018-cannabis-not-osa-treatment':'Quatre positions motivées et plausibles, dont deux déconseillent et deux envisagent un usage conditionnel. L’avis reste daté2018.',
};
for(const name of ['r-actives-b-06','r-actives-a-05']){
  const batchPath=base+'batches/'+name+'.json',reviewPath=base+'reviews/'+name+'.json';
  const snapshot=base+'facts/'+name+'-before-coordinator.json';
  assert(!existsSync(snapshot),'single-use script');
  const batch=JSON.parse(readFileSync(batchPath,'utf8')),review=JSON.parse(readFileSync(reviewPath,'utf8'));
  const original=structuredClone({batch,review});
  const oldSources=new Map(batch.sources.map(s=>[s.id,structuredClone(s)]));
  const changedSources=new Set();
  if(name==='r-actives-a-05'){
    batch.sources.find(s=>s.id==='q2-ra05-super-skunk').published='Updated on 05/09/2020 (date affichée ; format non interprété)';
    const dna=batch.sources.find(s=>s.id==='q2-ra05-la-confidential');
    dna.author='Adam (DNA Genetics)';dna.published='Posted on 11-2-2025 (date affichée ; format non interprété)';
    changedSources.add('q2-ra05-super-skunk');changedSources.add('q2-ra05-la-confidential');
  }
  let changed=0;
  for(const q of batch.questions){
    const item=review.items.find(i=>i.id===q.id),previous=structuredClone(item),before=structuredClone(q);
    assert.equal(item.contentHash,hash(q),'question changed '+q.id);
    for(const sourceId of q.sourceIds){
      const oldSource=oldSources.get(sourceId),source=batch.sources.find(s=>s.id===sourceId),check=item.sourceChecks.find(s=>s.sourceId===sourceId);
      assert.equal(check.sourceHash,hash(oldSource),'source changed '+sourceId);
      if(changedSources.has(sourceId)){
        check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(oldSource),previousSource:oldSource,basis:'B a explicitement lu auteur et date affichés. Correction documentaire seulement, sans nouvelle consultation revendiquée par root.'};
        check.sourceHash=hash(source);
      }
    }
    if(!edits[q.id]){assert.equal(item.status,'approved');continue;}
    assert.equal(item.status,'changes_requested');
    edits[q.id](q);q.editorial.expectedAnswer=q.options[q.answer];
    assert(q.prompt.length<=150&&q.options.every(o=>o.length<=75)&&q.explanation.length<=240,q.id+' length');
    item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];
    item.coordinatorChange={before,after:structuredClone(q)};
    item.coordinatorScope='Arbitrage ciblé après première lecture indépendante Sol. Les faits testés et passages probants sont conservés ; deux notices ra05 corrigées sur les constats explicites de B. Aucune nouvelle consultation de source revendiquée par root.';
    item.status='approved';item.contentHash=hash(q);item.comment=notes[q.id];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';changed++;
  }
  assert.equal(changed,name==='r-actives-b-06'?4:8);assert(review.items.every(i=>i.status==='approved'));
  review.coordinatorSummary=`${batch.questions.length} questions approuvées ; ${changed} corrections ciblées. Première revue et objets avant correction archivés séparément.`;
  writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');
  writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');
  writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
  console.log(name+': '+batch.questions.length+' approved');
}
