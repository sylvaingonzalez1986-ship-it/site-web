// Targeted arbitration after the independent Sol review; no new source consultation claimed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before=await read(`${root}/facts/rb01-before-corrections.json`);
const batch=await read(`${root}/batches/r-actives-b-01.json`);
const path=`${root}/reviews/r-actives-b-01.json`, review=await read(path);
const approved={
 'glandes-monoterpenes':'Thème corrigé vers Arômes et terpènes ; fait, choix et preuve inchangés.',
 'fecondation-sesquiterpenes':'Thème corrigé vers Arômes et terpènes ; restriction à cet essai conservée.',
 'pollen-hermaphrodite-fonctionnel':'Quatre observations reproductrices comparables ; disparition du choix Oui unique ; niveau 2 cohérent.',
 'descendance-hermaphrodite-femelle':'Niveau 2 et justification corrigés ; fait limité à la descendance étudiée, sans changement de preuve.',
 'glandes-maturation-asynchrone':'Quatre organisations des stades remplacent les Oui/Non ; distinction réelle entre développement simultané et asynchrone.',
 'fleur-apport-sucres-glandes':'Les distracteurs sont désormais des tissus sources candidats ; la réponse garde son statut de modèle proposé.',
 'densite-glandes-pas-dosage':'La question teste une propriété des glandes ; les autres choix sont des confusions de localisation ou de fonction, sans réponse Non prudente unique.'
};
const pending={
 'gouttes-resine-tetes-collees':'Les pieds enroulés, gonflés en sphères ou les têtes en écailles restent des distracteurs fantaisistes. Comparer des conséquences physiques plausibles de la sécrétion, ou remplacer le fait si les quatre choix restent triviaux.',
 'glandes-fragilite-manipulation':'Trois distracteurs impliquent une nouvelle croissance ou une transformation peu plausible après récolte. La réponse est encore trouvable sans connaître les glandes. Proposer des altérations anatomiques plausibles et non ambiguës, ou un autre fait soutenu.',
 'sans-cannabinoides-autres-phenols':'Les trois distracteurs conservent le même profil cannabinoïde malgré le cannabis pauvre en cannabinoïdes annoncé. Refaire les alternatives sans contradiction immédiate avec le prompt ; conserver un fait propre aux produits/constituants du cannabis.'
};
for(const [suffix,comment] of Object.entries({...approved,...pending})){
 const id='hemp-q2-rb01-'+suffix, question=batch.questions.find(item=>item.id===id);
 const original=before.questions.find(item=>item.id===id), item=review.items.find(item=>item.id===id);
 assert(question && original && item?.status==='changes_requested' && item.finalReviewer!=='root',`${id}: unexpected review state`);
 assert.equal(JSON.stringify(question.sourceIds),JSON.stringify(original.sourceIds));
 assert.equal(JSON.stringify(question.editorial.sourceEvidence),JSON.stringify(original.editorial.sourceEvidence));
 for(const sourceCheck of item.sourceChecks){
  const source=batch.sources.find(source=>source.id===sourceCheck.sourceId);
  assert.equal(sourceCheck.sourceHash,hash(source),`${id}: original source proof changed`);
 }
 const previous={...item}; delete previous.coordinatorHistory;
 Object.assign(item,{status:Object.hasOwn(approved,suffix)?'approved':'changes_requested',contentHash:hash(question),comment,finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[...(item.coordinatorHistory??[]),previous],coordinatorScope:'Lecture des quatre choix, réponse, explication et différences entre versions. Les passages sources déjà contrôlés par le premier relecteur Sol sont inchangés ; aucune nouvelle consultation revendiquée.'});
}
await writeFile(path,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({approved:review.items.filter(item=>item.status==='approved').length,pending:review.items.filter(item=>item.status!=='approved').length}));
