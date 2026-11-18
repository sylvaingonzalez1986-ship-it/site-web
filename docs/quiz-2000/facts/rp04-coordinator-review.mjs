// Single-use arbitration; the off-scope item is archived before replacement.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const base='docs/quiz-2000/',batchPath=base+'batches/r-products-04.json',reviewPath=base+'reviews/r-products-04.json';
const snapshot=base+'facts/r-products-04-before-coordinator.json';
assert(!existsSync(snapshot),'single-use script');
const batch=JSON.parse(readFileSync(batchPath,'utf8')),review=JSON.parse(readFileSync(reviewPath,'utf8'));
const original=structuredClone({batch,review}),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const prefix='hemp-q2-rp04-',removed=prefix+'dog-edible-chocolate-xylitol';
const source=batch.sources.find(s=>s.id==='q2-rp04-vandrey-rem'),previousSource=structuredClone(source);
const remUrl='https://www.med.upenn.edu/cbti/assets/user-content/documents/nihms273324.pdf';
const remLocator='Manuscrit primaire UPenn : §2.4 p.5, §3.1 p.6 et tableau2 p.15 (PDF indice14)';
const remSupport='Pendant l’abstinence sous placebo, la proportion de sommeil paradoxal augmente et la durée totale de sommeil diminue. La variable REM est un pourcentage, pas une durée absolue.';
const edits={
  'chillum-without-water':q=>{
    q.prompt='Quelle description du chillum traditionnel correspond à la notice des Sanskriti Museums ?';
    q.options=['Une pipe à main avec réservoir d’eau','Une pipe à main sans réservoir d’eau','Une pipe à tuyau avec réservoir d’eau','Une pipe à tuyau sans réservoir d’eau'];
  },
  'dynavap-no-integrated-battery':q=>{
    q.prompt='Comment DynaVap décrit-il l’alimentation en chaleur de ses vaporisateurs ?';
    q.options=['Par une batterie rechargeable intégrée','Par une résistance branchée sur secteur','Par une résistance branchée sur un port USB','Par une source de chaleur externe'];
    q.explanation='Le fabricant décrit une conception reposant sur une chaleur externe, sans batterie ni électronique intégrées au vaporisateur.';
  },
  'frenchy-cannoli-hash-artisan':q=>{
    q.options=['L’artisanat et la transmission du haschich traditionnel','La création de lignées de cannabis riches en CBD','Le soufflage d’objets en verre pour la culture cannabique','Le journalisme dans la presse spécialisée sur le cannabis'];
  },
  'emerald-cup-sungrown-tradition':q=>{
    q.prompt='Quelle tradition de cannabis l’Emerald Cup met-elle particulièrement à l’honneur dans son communiqué de 2021 ?';
    q.options=['Les fleurs produites sous lampes en intérieur','Les récoltes de plein air cultivées au soleil','Les nouvelles variétés issues de la sélection néerlandaise','Les résines traditionnelles importées d’Asie centrale'];
  },
  'spannabis-fair-nature':q=>{
    q.options=['Un festival de cinéma consacré à la culture cannabique','Un congrès réservé aux essais cliniques sur les cannabinoïdes','Un salon réunissant exposants, produits et conférences','Un circuit de compétitions entre clubs cannabiques'];
    q.explanation='Spannabis réunit des exposants et des produits du secteur cannabique. Les World Cannabis Conferences complètent le salon par des rencontres et des conférences.';
  },
  'commercial-hhc-epimer-mixture':q=>{
    q.options=['Du 9R-HHC purifié, avec quelques traces de 9S-HHC','Un mélange de 9R-HHC et de 9S-HHC à proportions variables','Du 9S-HHC purifié, avec quelques traces de 9R-HHC','Un mélange à parts égales de 9R-HHC et de 9S-HHC'];
    q.editorial.subjectKey='hhc-9r-9s';
  },
  'cooked-with-cannabis-competition':q=>{
    q.prompt='Quel format propose l’émission « Cooked with Cannabis » de 2020 ?';
    q.options=['Une série d’entretiens avec des restaurateurs cannabiques','Un voyage à la découverte des traditions culinaires cannabiques','Une compétition entre chefs autour de plats au cannabis','Des cours de cuisine cannabique présentés par un chef unique'];
    q.explanation='Netflix présente une compétition de chefs autour de plats au cannabis. Le THC et le CBD font partie des ingrédients cités dans le synopsis officiel de cette émission.';
  },
  'gg4-trademark-renaming':q=>{
    q.prompt='Pourquoi GG Strains a-t-il remplacé le nom « Gorilla Glue #4 » par « GG4 » ou « Original Glue » en 2017 ?';
    q.options=['À la suite d’un litige de marque avec une société d’adhésifs','Pour distinguer une nouvelle lignée de l’ancienne','À la suite d’un changement de propriétaire de la marque','Pour unifier ses noms sur les marchés internationaux'];
    q.editorial.subjectKey='gg4';
  },
  'withdrawal-rem-rebound-trial':q=>{
    q.prompt='Dans l’essai de Vandrey (2011), quel changement du sommeil observe-t-on pendant l’abstinence de cannabis sous placebo ?';
    q.options=['Part de sommeil paradoxal accrue et durée totale réduite','Part de sommeil paradoxal réduite et durée totale accrue','Part de sommeil paradoxal réduite et durée totale réduite','Part de sommeil paradoxal accrue et durée totale accrue'];
    q.explanation='Dans ce petit essai, le sommeil paradoxal occupait une plus grande part du sommeil, alors que la durée totale de sommeil diminuait. Une proportion accrue ne prouve pas une augmentation de la durée absolue de cette phase.';
    q.editorial.property='Proportion accrue de sommeil paradoxal et durée totale réduite';
    q.editorial.sourceEvidence[0].locator=remLocator;q.editorial.sourceEvidence[0].support=remSupport;
  },
  'purple-flower-keracyanin':q=>{q.options[2]='La cyanidine-3-rutinoside';q.explanation='La cyanidine-3-rutinoside, ou kéracyanine, est majoritaire dans ces inflorescences analysées. Ce résultat décrit leur pigmentation ; il ne mesure ni leur teneur en THC ni leur puissance.';},
};
const notes={
  'chillum-without-water':'Quatre architectures de pipe comparables remplacent les objets incomplets ; absence d’eau et pipe à main sont soutenues par la notice déjà relue.',
  'dynavap-no-integrated-battery':'L’énoncé ne donne plus sans batterie ; quatre alimentations crédibles, sans procédure de chauffe. La note de méthode inutile au joueur est retirée du corrigé.',
  'frenchy-cannoli-hash-artisan':'Quatre activités plausibles de la culture cannabique, sans premières inventions ou exclusivité alimentaire artificielles.',
  'emerald-cup-sungrown-tradition':'Quatre traditions de produits actifs remplacent les catégories de fibres et de graines alimentaires.',
  'spannabis-fair-nature':'Quatre formats d’événements cannabiques comparables ; le corrigé décrit le salon et ses conférences déjà confirmés par B.',
  'commercial-hhc-epimer-mixture':'Quatre compositions relatives aux mêmes épimères, sans absolus absent/toujours ; clé hhc-9r-9s commune à la famille existante.',
  'cooked-with-cannabis-competition':'Quatre formats culinaires, pour que la traduction du titre ne suffise pas. Le corrigé décrit seulement le repère télévisuel sourcé.',
  'gg4-trademark-renaming':'Quatre motifs commerciaux crédibles ; clé gg4 commune transmise à A pour sa lignée.',
  'withdrawal-rem-rebound-trial':'Le résultat est exprimé en proportion de sommeil paradoxal ; la durée totale reste un indicateur séparé. Manuscrit primaire effectivement consulté par B puis root.',
  'purple-flower-keracyanin':'Quatre noms moléculaires parallèles ; alias kéracyanine conservé uniquement dans le corrigé. Portée florale S1750/S1759 inchangée.',
};
let changed=0;
for(const q of batch.questions){
  const item=review.items.find(i=>i.id===q.id),previous=structuredClone(item),before=structuredClone(q);
  assert.equal(item.contentHash,hash(q),'changed question '+q.id);
  for(const id of q.sourceIds)assert.equal(item.sourceChecks.find(s=>s.sourceId===id).sourceHash,hash(batch.sources.find(s=>s.id===id)),'changed source '+id);
  if(q.id===removed){assert.equal(item.domain,'offscope');continue;}
  const key=q.id.slice(prefix.length);
  if(!edits[key]){assert.equal(item.status,'approved');continue;}
  assert.equal(item.status,'changes_requested');edits[key](q);q.editorial.expectedAnswer=q.options[q.answer];
  assert(q.prompt.length<=150&&q.options.every(o=>o.length<=75)&&q.explanation.length<=240,q.id+' length');
  if(key==='withdrawal-rem-rebound-trial'){
    source.passage=remSupport;source.access='full-text';source.fullTextUrl=remUrl;
    source.supplementaryConsultations=[{reader:'rebalance_classify_b',date:'2026-11-17',url:remUrl,locator:remLocator,result:'Première revue indépendante : %REM identifié dans méthodes, résultats et tableau2 ; demande de précision consignée dans reviews/r-products-04.json.'},{reader:'root',date:'2026-11-17',url:remUrl,locator:remLocator,result:'Manuscrit ouvert : variable %REM et temps total séparés, tableau2 lu. Aucune durée REM recalculée à partir de moyennes.'}];
    const check=item.sourceChecks.find(s=>s.sourceId===source.id);
    check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(previousSource),previousSource,basis:'Précision du résultat après lecture indépendante B et consultation supplémentaire root du manuscrit primaire. Consultation initiale du résumé par C conservée.'};
    check.sourceHash=hash(source);check.locator=remLocator;
    item.coordinatorConsultation=source.supplementaryConsultations[1];
  }
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];item.coordinatorChange={before,after:structuredClone(q)};
  item.coordinatorScope='Correction ciblée après première revue indépendante B. Une consultation supplémentaire root du manuscrit sommeil est tracée ; aucune autre nouvelle lecture revendiquée.';
  item.status='approved';item.contentHash=hash(q);item.comment=notes[key];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';changed++;
}
assert.equal(changed,10);
review.supersededItems=[...(review.supersededItems||[]),{...review.items.find(i=>i.id===removed),removedBeforeActivation:true,decision:'Fait hors périmètre actif ; remplacement original soumis à une nouvelle première revue indépendante.'}];
review.items=review.items.filter(i=>i.id!==removed);batch.questions=batch.questions.filter(q=>q.id!==removed);batch.sources=batch.sources.filter(s=>s.id!=='q2-rp04-cornell-edible-co-toxins');
assert.equal(batch.questions.length,26);assert(review.items.every(i=>i.status==='approved'));
review.coordinatorSummary='26 approuvées :16 inchangées et10 corrections ciblées ; une question hors périmètre retirée avant activation et conservée dans le snapshot. Un remplacement reste requis pour ce lot final de27.';
writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('rp04:26 approved;1 offscope archived pending replacement');
