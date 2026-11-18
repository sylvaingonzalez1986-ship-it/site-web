import fs from 'node:fs';
import crypto from 'node:crypto';
const path='docs/quiz-2000';
const batch=JSON.parse(fs.readFileSync(`${path}/batches/r-actives-b-01.json`,'utf8'));
const review=JSON.parse(fs.readFileSync(`${path}/reviews/r-actives-b-01.json`,'utf8'));
const hash=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const swaps=[
 {oldId:'hemp-q2-rb01-oxidocyclases-cbca',newId:'hemp-q2-rb01-cbdas-sous-produit-thca',status:'approved',
 comment:'Nouveau fait recevable : origine probable du THCA résiduel dans des profils CBD sans THCAS fonctionnelle. Le prompt attribue l’interprétation à Allen et l’explication conserve la portée enzymatique. Niveau 3 cohérent ; pas de protocole ni garantie de teneur.',
 domainComment:'Directement lié à la biosynthèse et à la coexistence de THCA dans des profils à dominante CBD.',
 locator:'Discussion §3.1, paragraphes The origin of THCA et The most likely source of THCA',
 result:'Passage original PMC rouvert et lu. Les auteurs présentent CBDAS comme source la plus probable du THCA dans les cultivars CBD sans THCAS fonctionnelle, en lien avec une activité secondaire documentée. Le fait ne prétend pas que toute la teneur de chaque produit a cette origine.'},
 {oldId:'hemp-q2-rb01-fleur-terminale-meristeme',newId:'hemp-q2-rb01-poils-glandulaires-resine',status:'changes_requested',
 comment:'Source correcte, domaine réellement actif et choix mieux formés, mais doublon exact de hemp-plant-trichome : l’ancien item demande déjà quelles structures produisent et accumulent cannabinoïdes et terpènes, réponse trichomes glandulaires. Les distracteurs cystolithiques et le nouveau factKey ne changent pas le fait. Remplacer par un autre fait ; une inversion « quels poils ne produisent pas » ne suffira pas.',
 domainComment:'Le domaine active est correct, mais ce fait glandulaire est déjà couvert dans la banque.',
 locator:'Introduction §1.2, synthèse/stockage dans les glandes et dernier paragraphe sur les poils cystolithiques',
 result:'Passage original PMC rouvert et lu. Les glandes synthétisent et stockent les cannabinoïdes/terpènes, contrairement aux structures cystolithiques. Ce soutien ne lève pas le doublon pédagogique déjà présent.'}
];
review.supersededItems ??= [];
for(const swap of swaps){
 const index=review.items.findIndex(x=>x.id===swap.oldId);
 if(index<0)throw new Error('Missing prior decision '+swap.oldId);
 const old=review.items[index];
 const question=batch.questions.find(x=>x.id===swap.newId);
 if(!question)throw new Error('Missing replacement '+swap.newId);
 review.supersededItems.push({...old,supersededBy:swap.newId,supersededAt:'2026-11-17',reason:'Auteur remplace le fait après la première revue indépendante.'});
 review.items[index]={id:question.id,status:swap.status,domain:'active',domainComment:swap.domainComment,
  comment:swap.comment,contentHash:hash(question),reviewer:'rebalance_products_sol',reviewedAt:'2026-11-17',
  revisionHistory:[{replacedId:swap.oldId,previousStatus:old.status,previousContentHash:old.contentHash,reason:'Nouvelle lecture Sol du fait de remplacement et de ses preuves originales.'}],
  sourceChecks:question.sourceIds.map(sourceId=>{const source=batch.sources.find(s=>s.id===sourceId);return {sourceId,url:source.url,locator:swap.locator,result:swap.result,sourceHash:hash(source)};})};
}
review.summary.approved=review.items.filter(x=>x.status==='approved').length;
review.summary.changesRequested=review.items.filter(x=>x.status==='changes_requested').length;
review.summary.replacementFollowup={reviewer:'rebalance_products_sol',date:'2026-11-17',readReplacementQuestions:2,
 retainedOtherDecisions:28,approvedReplacement:'hemp-q2-rb01-cbdas-sous-produit-thca',
 unresolvedReplacement:'hemp-q2-rb01-poils-glandulaires-resine',
 duplicateNeighbour:'hemp-plant-trichome',
 note:'Les 28 autres décisions sont conservées exactement, y compris leurs hashes initiaux. Les 10 corrections ciblées sont réservées à l’arbitrage du coordinateur ; ce suivi ne les approuve pas implicitement.'};
fs.writeFileSync(`${path}/reviews/r-actives-b-01.json`,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review.summary.replacementFollowup));
