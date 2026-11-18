// Single-use arbitration of C's first independent review; preserves all proofs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const base='docs/quiz-2000/';
const batchPath=base+'batches/r-actives-b-04.json';
const reviewPath=base+'reviews/r-actives-b-04.json';
const snapshot=base+'facts/r-actives-b-04-before-coordinator.json';
assert(!existsSync(snapshot),'single-use script');
const batch=JSON.parse(readFileSync(batchPath,'utf8'));
const review=JSON.parse(readFileSync(reviewPath,'utf8'));
const original=structuredClone({batch,review});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const byId=new Map(batch.questions.map(q=>[q.id,q]));
const get=suffix=>byId.get('hemp-q2-rb04-'+suffix);
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  assert.equal(item.contentHash,hash(q),'changed question '+q.id);
  for(const sourceId of q.sourceIds) assert.equal(item.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(batch.sources.find(source=>source.id===sourceId)),'changed source '+sourceId);
}
const sourceNotes=new Map();
const reefer=batch.sources.find(source=>source.id==='q2-rb04-reefer');
reefer.author='Ben Pubols, Franklin A. Robinson Jr. et Wendy Shay';
reefer.published='2001';
reefer.passage='Couverture ; p. 5 imprimée, Reel OF491.2-1, numéro 4 ; rubrique Drug Songs, Reefer Man';
reefer.consultation.locator=reefer.passage;
sourceNotes.set(reefer.id,'C a lu la couverture et identifié explicitement les trois auteurs et2001. Repères limités aux pages imprimées et rubriques pour éviter une ambiguïté d’index PDF.');
get('reefer-man-calloway').editorial.sourceEvidence[0].locator=reefer.passage;
const iom=batch.sources.find(source=>source.id==='q2-rb04-iom');
iom.passage='Chapitre 2, p. 16 imprimée, commission1893–1894 ; chapitre 11, p. 157–158 imprimées, contraintes du Tax Act';
iom.consultation.locator=iom.passage;
iom.limitation='Ouvrage historique utilisé pour la commission1893–1894 et le régime médical du Tax Act1937 ; ses appréciations anciennes de sécurité ne sont pas présentées comme actuelles.';
sourceNotes.set(iom.id,'C a explicitement localisé les deux faits aux p.16 et157–158 imprimées. Correction des repères et de la portée historique de la notice, sans nouvelle assertion.');
const tax=get('taxact1937-usage-medical');
tax.options=[
  'Une délivrance médicale interdite par la loi fédérale',
  'Un usage possible sous de fortes contraintes administratives',
  'Une délivrance médicale exemptée des formalités fédérales',
  'Une délivrance réservée aux établissements hospitaliers',
];
tax.editorial.sourceEvidence[0].locator='Chapitre 11, p. 157–158 imprimées, contraintes du Tax Act';
tax.editorial.sourceEvidence[0].support='Les pages157–158 expliquent que l’usage médical restait possible mais soumis à une bureaucratie dissuasive pour médecins et industriels.';
get('commission-indienne-prohibition').editorial.sourceEvidence[0].locator='Chapitre 2, p. 16 imprimée, commission1893–1894';
const pharma=batch.sources.find(source=>source.id==='q2-rb04-pharmahistory');
pharma.passage='§4 avant §4.1 : définition Herba Cannabis Indicae1925 et appellation Indian hemp ; §4.1 : cannabine et haschischine';
pharma.consultation.locator=pharma.passage;
sourceNotes.set(pharma.id,'C a lu les trois passages et distingué §4 avant4.1 pour Herba/Indian hemp de §4.1 pour cannabine/haschischine. Repères seuls corrigés, aucun nouveau fait.');
get('herba-indicae-resine1925').editorial.sourceEvidence[0].locator='§4 avant le titre §4.1, définition Herba Cannabis Indicae de1925';
get('indian-hemp-appellation-pharmacie').editorial.sourceEvidence[0].locator='§4 avant le titre §4.1, appellation Indian hemp / Cannabis Indicae';
get('indian-hemp-appellation-pharmacie').editorial.sourceEvidence[0].support='Le passage en §4 distingue le terme pharmaceutique et géographique de la classification botanique.';
get('cannabine-extrait-historique').editorial.sourceEvidence[0].locator='§4.1, cannabine et haschischine comme noms d’extraits';
const variable=get('medecine-variabilite-lots');
variable.prompt='Quel obstacle à des résultats médicaux constants la revue historique de Zuardi met-elle en avant pour les anciens extraits de cannabis ?';
variable.options=[
  'Une conservation trop courte des solutions pendant le transport',
  'Une absorption digestive trop lente pour une utilisation médicale',
  'Des puissances différentes selon les lots de plante',
  'Une incompatibilité chimique avec les excipients huileux',
];
// Remove boilerplate that adds no useful information about the cultural fact.
get('how-high-harvard').explanation='How High place ses deux personnages dans l’univers de Harvard. Le classement québécois décrit cette aventure comme une comédie burlesque.';
get('rif-hybrides-resine').explanation='L’EUDA décrit l’arrivée d’hybrides au potentiel plus élevé en résine et en THC. Ce changement de matériel végétal aide à comprendre l’évolution du marché.';
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  const before=original.batch.questions.find(before=>before.id===q.id);
  const oldReview=original.review.items.find(before=>before.id===q.id);
  q.editorial.expectedAnswer=q.options[q.answer];
  const changedSources=q.sourceIds.filter(id=>sourceNotes.has(id));
  const changedQuestion=hash(before)!==hash(q);
  if(!changedQuestion&&!changedSources.length){assert.equal(item.status,'approved');continue;}
  for(const sourceId of changedSources){
    const source=batch.sources.find(source=>source.id===sourceId);
    const oldSource=original.batch.sources.find(source=>source.id===sourceId);
    const check=item.sourceChecks.find(check=>check.sourceId===sourceId);
    check.metadataAdjustment={approvedAndAppliedBy:'root',date:'2026-11-17',previousSourceHash:hash(oldSource),previousSource:oldSource,basis:sourceNotes.get(sourceId),independentEvidence:oldReview.sourceChecks.find(check=>check.sourceId===sourceId)};
    check.sourceHash=hash(source);
  }
  assert(q.prompt.length<=150,q.id+' prompt');
  assert(q.options.every(option=>option.length<=75),q.id+' options');
  assert(q.explanation.length<=240,q.id+' explanation');
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),oldReview];
  item.coordinatorChange={before,after:structuredClone(q)};
  item.coordinatorScope='Arbitrage ciblé après la lecture indépendante de C : corrections des repères explicitement vérifiés, distracteurs comparables et suppression de deux précautions génériques sans ajout factuel. Root ne revendique aucune nouvelle consultation de source.';
  item.comment=q.id===tax.id?'Les quatre options décrivent des régimes administratifs comparables ; seule la possibilité sous contraintes correspond au passage relu par C.':q.id===variable.id?'Le prompt est explicitement rattaché à la revue de Zuardi et les quatre options comparent des obstacles pharmaceutiques ; la variabilité de puissance reste le fait testé.':'Correction ciblée appliquée conformément aux passages et métadonnées vérifiés par C ; le fait soutenu reste inchangé.';
  item.status='approved';item.contentHash=hash(q);item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
}
assert.equal(batch.questions.length,31);
assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='31 questions approuvées ; cinq demandes initiales résolues. Les notices partagées et toutes leurs preuves ont été rescéllées avec historique des empreintes, sur les corrections précisément constatées par C. Deux explications allégées sans ajout de fait.';
writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');
writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');
writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('rb04:31 approved; exact source metadata corrections and prior proofs recorded');
