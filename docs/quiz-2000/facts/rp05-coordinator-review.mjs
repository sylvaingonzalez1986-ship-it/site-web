// Final targeted arbitration after A's independent reading of every item/source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const root='docs/quiz-2000/',bp=root+'batches/r-products-05.json',rp=root+'reviews/r-products-05.json',snapshot=root+'facts/r-products-05-before-coordinator.json';
assert(!existsSync(snapshot),'single-use script');
const batch=JSON.parse(readFileSync(bp,'utf8')),review=JSON.parse(readFileSync(rp,'utf8')),original=structuredClone({batch,review});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),oldSources=new Map(batch.sources.map(s=>[s.id,structuredClone(s)]));
const replacementUrl='https://wholesales.sweetseeds.info/descargas/descripciones/2020/en/descripciones.pdf';
const replacementLocator='PDF p.23 (indice22), rubrique Cream Caramel (SWS04), premières lignes1100–1102';
const changedSources=new Set(['q2-rp05-pib-malana','q2-rp05-chemdog-concert','q2-rp05-sweet-cream-caramel']);
batch.sources.find(s=>s.id==='q2-rp05-pib-malana').title='3 kg of Charas seized by NCB Chennai: Two persons arrested in this connection';
batch.sources.find(s=>s.id==='q2-rp05-chemdog-concert').published='Numéro Northeast Leaf de novembre2021 cité ; date de cette page non déterminée';
const sweet=batch.sources.find(s=>s.id==='q2-rp05-sweet-cream-caramel');
Object.assign(sweet,{
  title:'Cream Caramel (SWS04) — descriptions variétales Sweet Seeds en anglais',
  url:replacementUrl,
  published:'Archive2020 ; date de mise en ligne non indiquée (métadonnée de titre : 20201117_variedades_ingles.docx)',
  passage:'Sweet Seeds attribue Cream Caramel (SWS04) à Blue Black, Maple Leaf Indica et White Rhino.',
  access:'full-text',
  limitation:'Description commerciale du breeder, précisément attribuée à SWS04. Le catalogue2024 initial n’est plus la preuve retenue ; aucune promesse thérapeutique ni donnée de culture reprise.',
  consultation:{reader:'rebalance_classify_a',date:'2026-11-17',locator:replacementLocator,result:'Document primaire accessible effectivement lu indépendamment ; trio parental confirmé. Consultation décrite dans supplementalConsultations de la première revue.'},
  supplementaryConsultations:[{reader:'root',date:'2026-11-17',url:replacementUrl,locator:replacementLocator,result:'PDF primaire ouvert ; rubrique SWS04 et trio parental lus. Métadonnée de titre examinée ; aucune date de publication déduite de cette seule métadonnée.'}],
});
const notes={
  'hemp-q2-rp05-sebsi-wood-clay-materials':'Clé de sujet harmonisée avec le sebsi déjà présent : morocco-kif-tradition. Le fait sur ses deux matériaux reste distinct de son identification comme pipe.',
  'hemp-q2-rp05-malana-cream-himachal-origin':'Titre exact du communiqué corrigé d’après la lecture indépendante de A. Le fait géographique et l’accès limité à un extrait restent inchangés.',
  'hemp-q2-rp05-chemdog-grateful-dead-concert':'Date du numéro cité distinguée de la date inconnue de mise en ligne. Espacement de l’année corrigé dans l’énoncé.',
  'hemp-q2-rp05-cream-caramel-three-parents':'Preuve remplacée par le document primaire directement accessible lu par A puis root, précisément SWS04 ; le trio parental reste identique. Justification du niveau3 variétale, sans pharmacocinétique.',
  'hemp-q2-rp05-cbd-cartridge-crystallization':'Le profil riche en CBD est maintenant à identifier parmi quatre compositions. L’énoncé ne donne plus la réponse et les certitudes artificielles ont disparu. Même fait et même source.',
  'hemp-q2-rp05-picasso-paris-hashish-account':'Indice période rose retiré de l’énoncé, conservé après réponse dans le récit attribué au musée.',
};
let changed=0;
for(const q of batch.questions){
  const item=review.items.find(i=>i.id===q.id),previous=structuredClone(item),before=structuredClone(q);
  assert.equal(item.contentHash,hash(q),'question changed '+q.id);
  for(const id of q.sourceIds){
    const check=item.sourceChecks.find(c=>c.sourceId===id),oldSource=oldSources.get(id),source=batch.sources.find(s=>s.id===id);
    assert.equal(check.sourceHash,hash(oldSource),'source changed '+id);
    if(changedSources.has(id)){
      check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(oldSource),previousSource:oldSource,basis:id===sweet.id?'Changement de document primaire conformément à la consultation supplémentaire explicite de A, puis lecture root. Le trio parental est identique ; l’objet précédent et sa limite d’accès sont conservés.':'Correction de notice demandée explicitement après lecture indépendante A ; aucun nouveau fait.'};
      check.sourceHash=hash(source);
      if(id===sweet.id){check.url=replacementUrl;check.locator=replacementLocator;check.result='Document primaire Sweet Seeds lu par A dans supplementalConsultations, puis par root : rubrique SWS04 et trio Blue Black, Maple Leaf Indica, White Rhino. La preuve2024 inaccessible est remplacée, sans prétendre l’avoir lue intégralement.';}
    }
  }
  if(!notes[q.id]){assert.equal(item.status,'approved');continue;}assert.equal(item.status,'changes_requested');
  if(q.id.endsWith('sebsi-wood-clay-materials'))q.editorial.subjectKey='morocco-kif-tradition';
  else if(q.id.endsWith('chemdog-grateful-dead-concert'))q.prompt=q.prompt.replace('en1991','en 1991');
  else if(q.id.endsWith('cream-caramel-three-parents')){
    q.prompt='Quel trio Sweet Seeds donne-t-il comme ascendance de Cream Caramel dans sa description SWS04 ?';
    q.options[3]='Blue Black, Maple Leaf Indica et White Rhino';
    q.explanation='Sweet Seeds attribue Cream Caramel SWS04 à Blue Black, Maple Leaf Indica et White Rhino. Cette parenté commerciale est distincte des arômes suggérés par le nom de la variété.';
    q.editorial.property='Trio parental de Cream Caramel SWS04 annoncé par Sweet Seeds';
    q.editorial.difficultyRationale='Reconnaissance d’un trio parental précis parmi plusieurs ensembles de lignées crédibles.';
    q.editorial.sourceEvidence[0].locator=replacementLocator;q.editorial.sourceEvidence[0].support=sweet.passage;
    item.coordinatorConsultation=sweet.supplementaryConsultations[0];
  }else if(q.id.endsWith('cbd-cartridge-crystallization')){
    q.prompt='Quel type de cartouche le guide OCS associe-t-il à une cristallisation possible sans défaut nécessaire du produit ?';
    q.options=['Une cartouche riche en delta-9-THC','Une cartouche riche en CBD','Une cartouche riche en terpènes','Une cartouche riche en CBN'];
  }else if(q.id.endsWith('picasso-paris-hashish-account'))q.prompt='Quel peintre la notice du Hash Museum associe-t-elle à des consommations de haschich à Paris ?';
  q.editorial.expectedAnswer=q.options[q.answer];assert(q.prompt.length<=150&&q.options.every(o=>o.length<=75)&&q.explanation.length<=240,q.id+' lengths');
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];item.coordinatorChange={before,after:structuredClone(q)};
  item.coordinatorScope='Arbitrage ciblé après lecture indépendante A des27 objets et28 notices. Trois notices corrigées, dont une preuve primaire remplacée par l’archive accessible déjà lue par A puis root. Les autres sources restent inchangées.';
  item.status='approved';item.contentHash=hash(q);item.comment=notes[q.id];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';changed++;
}
assert.equal(changed,6);assert.equal(batch.questions.length,27);assert(review.items.every(i=>i.status==='approved'));
review.coordinatorSummary='27 questions approuvées :21 inchangées et6 corrections ciblées. Les contributions de recherche B restent attribuées dans facts/r-products-05.json et sont relues par A, indépendant de leur rédaction et de leur recherche.';
writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');writeFileSync(bp,JSON.stringify(batch,null,2)+'\n');writeFileSync(rp,JSON.stringify(review,null,2)+'\n');console.log('rp05:27 approved; all564 replacements now approved');
