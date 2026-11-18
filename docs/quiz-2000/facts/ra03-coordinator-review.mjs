// Historical, single-use arbitration after the independent Sol review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const batchPath='docs/quiz-2000/batches/r-actives-a-03.json';
const reviewPath='docs/quiz-2000/reviews/r-actives-a-03.json';
const batch=JSON.parse(readFileSync(batchPath,'utf8'));
const review=JSON.parse(readFileSync(reviewPath,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const suffix=id=>'hemp-q2-ra03-'+id;
const notes=new Map([
  [suffix('thc-experimental-pain-higher-worsens'),'La formulation nomme les doses étudiées et le moment de mesure, sans valeur ni consigne. Le résultat expérimental et les limites temporelles relus par B sont conservés.'],
  [suffix('thc-stress-nonlinear-response-human'),'Les quatre choix comparent désormais la détresse à la dose basse et l’humeur à la dose élevée. La nuance des deux mesures est conservée ; aucune valeur de dose ni instruction ajoutée.'],
  [suffix('oral-cbd-thc-metabolic-clearance-inhibition'),'Clé commune cbd-thc-interaction appliquée conformément à la revue. Le fait oral pharmacocinétique reste distinct du résultat Haney après cannabis fumé.'],
  [suffix('switzerland-cannabis-pilots-scientific-limited'),'La question ne révèle plus la nature expérimentale par les mots essais pilotes. Quatre cadres comparables distinguent le périmètre local/temporaire des cadres permanents ou nationaux. Le fait et la source sont inchangés.'],
  [suffix('us-2026-schedule3-qualified-medical-only'),'Quatre périmètres juridiques sont proposés sans opposition grammaticale Tout/Toute contre Certaines. La date et le champ médical fédéral restent explicites.'],
]);
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  assert.equal(item.contentHash,hash(q),'question changed since first review: '+q.id);
  for(const sourceId of q.sourceIds){
    const source=batch.sources.find(source=>source.id===sourceId);
    assert.equal(item.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(source),'source changed: '+sourceId);
  }
  if(!notes.has(q.id)) continue;
  assert.equal(item.status,'changes_requested');
  const before=structuredClone(q);
  if(q.id===suffix('thc-experimental-pain-higher-worsens')){
    q.prompt='Dans l’essai sur la douleur provoquée cité par Santé Canada, quel effet avait la dose de THC la plus élevée au moment étudié ?';
    q.options[0]='Un soulagement plus important qu’avec la dose intermédiaire';
    q.options[1]='Le même soulagement qu’avec la dose intermédiaire';
    q.explanation='Dans cet essai sur une douleur provoquée, la dose intermédiaire soulageait au moment étudié, tandis que la plus élevée augmentait la douleur. L’effet variait avec la dose et le temps : plus de THC ne signifiait pas plus de soulagement.';
    q.editorial.subject='Hyperalgésie possible à la dose élevée étudiée';
    q.editorial.property=q.editorial.subject;
  } else if(q.id===suffix('thc-stress-nonlinear-response-human')){
    q.prompt='Dans l’essai de Childs (2017) sur le stress, comment les effets du THC variaient-ils entre les deux doses étudiées ?';
    q.options=[
      'Moins de détresse à faible dose, humeur plus négative à dose élevée',
      'Moins de détresse à faible dose, humeur moins négative à dose élevée',
      'Plus de détresse à faible dose, humeur plus négative à dose élevée',
      'Plus de détresse à faible dose, humeur moins négative à dose élevée',
    ];
    q.explanation='Dans cet essai, la dose basse réduisait la détresse après l’épreuve ; la plus élevée augmentait l’humeur négative avant et pendant l’épreuve. Le résultat ne définit pas une dose antistress adaptée à chacun.';
  } else if(q.id===suffix('oral-cbd-thc-metabolic-clearance-inhibition')){
    q.editorial.subjectKey='cbd-thc-interaction';
  } else if(q.id===suffix('switzerland-cannabis-pilots-scientific-limited')){
    q.prompt='Quel cadre permet la remise encadrée de cannabis non médical en Suisse en novembre 2026 ?';
    q.options=[
      'Un marché national permanent sous licence publique',
      'Un accès expérimental limité dans le temps et l’espace',
      'Un marché cantonal permanent réservé aux résidents',
      'Un accès temporaire ouvert à tout adulte dans le pays',
    ];
  } else if(q.id===suffix('us-2026-schedule3-qualified-medical-only')){
    q.prompt=q.prompt.replace('ScheduleIII','Schedule III');
    q.options=[
      'Les ventes récréatives sous licence d’un État',
      'La possession personnelle dans les États qui l’autorisent',
      'Les ventes de fleurs sous le seuil de THC fixé pour le chanvre',
      'Les activités médicales remplissant les critères fédéraux',
    ];
    q.explanation=q.explanation.replace('ScheduleI','Schedule I');
  }
  q.editorial.expectedAnswer=q.options[q.answer];
  assert(q.prompt.length<=150,q.id+' prompt');
  assert(q.options.every(option=>option.length<=75),q.id+' options');
  assert(q.explanation.length<=240,q.id+' explanation');
  const previous=structuredClone(item);
  Object.assign(item,{
    status:'approved',contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',
    comment:notes.get(q.id),coordinatorScope:'Correction ciblée après la première lecture indépendante de B ; aucune nouvelle consultation de source revendiquée par root.',
    coordinatorHistory:[...(item.coordinatorHistory||[]),previous],
    coordinatorChange:{before,after:structuredClone(q)},
  });
}
const removedId=suffix('canada-legal-cannabis-not-border-permission');
const removed=batch.questions.find(q=>q.id===removedId);
assert(removed,'single-use script: removed duplicate already absent');
const removedReview=review.items.find(item=>item.id===removedId);
review.supersededItems=[...(review.supersededItems||[]),{...removedReview,status:'rejected',finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorScope:'Doublon exact de hemp-q2-en02-canada-border-domestic-legal retiré avant activation ; la place est réaffectée au dernier lot A.',question:removed}];
batch.questions=batch.questions.filter(q=>q.id!==removedId);
review.items=review.items.filter(item=>item.id!==removedId);
review.coordinatorSummary='28 approuvées ; un complément terminologique NHS rédigé par A reste en attente de contrelecture B. Un doublon retiré avant activation ; version initiale préservée dans facts/r-actives-a-03-before-independent-corrections.json.';
assert.equal(review.items.filter(item=>item.status==='approved').length,28);
assert.equal(review.items.filter(item=>item.status==='changes_requested').length,1);
writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');
writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('ra03:28 approved,1 targeted terminology addition pending,1 duplicate archived');
