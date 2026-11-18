import fs from 'node:fs';
import crypto from 'node:crypto';
const root='docs/quiz-2000';
const batch=JSON.parse(fs.readFileSync(`${root}/batches/r-actives-b-01.json`,'utf8'));
const review=JSON.parse(fs.readFileSync(`${root}/reviews/r-actives-b-01.json`,'utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const oldId='hemp-q2-rb01-poils-glandulaires-resine';
const newId='hemp-q2-rb01-cannabinoides-toxicite-cellules-plante';
const index=review.items.findIndex(x=>x.id===oldId);
if(index<0)throw new Error('Prior decision not found');
const previous=review.items[index];
const question=batch.questions.find(x=>x.id===newId);
const source=batch.sources.find(x=>x.id==='q2-rb01-morimoto07');
if(!question||!source)throw new Error('Replacement missing');
review.supersededItems.push({...previous,supersededBy:newId,supersededAt:'2026-11-17',reason:'Remplacement du doublon glandulaire après seconde demande indépendante.'});
review.items[index]={id:newId,status:'approved',reviewer:'rebalance_products_sol',reviewedAt:'2026-11-17',
 domain:'active',domainComment:'Effet de cannabinoïdes de la résine sur les cellules de la plante qui les produit ; le cannabis est nécessaire au fait.',
 comment:'Résumé scientifique original ouvert et lu sur le portail des auteurs. THCA/CBCA induisent une mort cellulaire dans le cannabis exposé en laboratoire. L’explication distingue ce résultat de l’intérêt protecteur du compartimentage, présenté comme une possibilité. Quatre effets cellulaires comparables, niveau 2 cohérent, aucun doublon trouvé.',
 contentHash:hash(question),
 revisionHistory:[...(previous.revisionHistory||[]),{replacedId:oldId,previousStatus:previous.status,previousContentHash:previous.contentHash,reason:'Le fait précédent doublonnait hemp-plant-trichome ; la nouvelle autotoxicité est un fait distinct.'}],
 sourceChecks:[{sourceId:source.id,url:source.url,locator:'Abstract intégral du portail Kyushu, paragraphes 1–4 ; Publication status',
 result:'Résumé original effectivement ouvert : la résine, puis THCA/CBCA identifiés, entraînent la mort de cellules foliaires ou cultivées de Cannabis sativa ; effets mitochondriaux et baisse d’ATP décrits. Publication datée du 13 juillet 2007. Lecture limitée au résumé, comme déclaré par l’auteur.',sourceHash:hash(source)}]};
review.summary.approved=review.items.filter(x=>x.status==='approved').length;
review.summary.changesRequested=review.items.filter(x=>x.status==='changes_requested').length;
review.summary.autotoxicityFollowup={date:'2026-11-17',reviewer:'rebalance_products_sol',newId,status:'approved',otherDecisionsUnchanged:29,
 neighbours:['hemp-plant-trichome : production/stockage, pas autotoxicité','hemp-q2-c-trichome-cavite-sous-cuticule : lieu de stockage, pas effet sur les cellules','hemp-q2-rb01-thca-synthese-extracellulaire : localisation d’enzyme, pas autotoxicité'],
 note:'Les autres décisions ne sont pas réévaluées par cette reprise ; le coordinateur traite les corrections ciblées restantes.'};
fs.writeFileSync(`${root}/reviews/r-actives-b-01.json`,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review.summary.autotoxicityFollowup));
