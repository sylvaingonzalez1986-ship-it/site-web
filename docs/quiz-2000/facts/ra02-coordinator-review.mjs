// Targeted final review, with two duplicate candidates removed before activation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batchPath=`${root}/batches/r-actives-a-02.json`, path=`${root}/reviews/r-actives-a-02.json`;
const batch=await read(batchPath), review=await read(path);
const notes={
 'thc-excretion-mainly-fecal':'La voie urinaire est maintenant une alternative présente ; distinction pharmacocinétique et explication inchangées.',
 'thc-plasma-decline-effects-persist':'Quatre évolutions concentration/effets remplacent la conversion fantaisiste en CBD ; dissociation temporelle limitée à la source.',
 'alpha-pinene-no-thc-memory-protection-human':'Quatre conclusions expérimentales comparables, sans garantie universelle. Le coordinateur remplace le jargon ambigu atténuation mnésique par troubles de mémoire, après lecture du résumé original Results/Conclusions.',
 'france-cbd-flowers-2022-blanket-ban-annulled':'Quatre interdictions commerciales comparables ; annulation historiquement bornée, sans déduction d’autorisation générale.',
 'germany-club-residency-six-months':'Allemagne explicitement nommée dans le prompt ; objet associatif partagé avec les autres propriétés du même régime.',
 'germany-club-consumption-prohibited':'Clé germany-cannabis-clubs commune au même objet ; contenu factuel et source inchangés.',
 'germany-consumption-near-minors-prohibited':'Restriction relative aux jeunes remplace le faux seuil65ans ; alternatives cohérentes avec des régimes d’accès au cannabis.',
 'malta-one-association-membership':'Clé malta-cannabis-associations commune au même objet ; contenu factuel et source inchangés.',
 'luxembourg-four-plants-per-household':'Quatre unités juridiques/résidentielles remplacent les chambres. Le coordinateur retire seulement une phrase défensive sans utilité pédagogique.'
};
for(const [suffix,comment] of Object.entries(notes)){
 const id='hemp-q2-ra02-'+suffix, q=batch.questions.find(q=>q.id===id), item=review.items.find(item=>item.id===id);
 assert(q && item?.status==='changes_requested');
 for(const proof of item.sourceChecks) assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)));
 const previous=structuredClone(item);
 if(suffix==='alpha-pinene-no-thc-memory-protection-human'){
  item.coordinatorChange={optionsBefore:[...q.options],explanationBefore:q.explanation};
  q.options=['Pas de baisse des troubles de mémoire ni de changement ressenti détectés','Moins de troubles de mémoire, sans changer les effets ressentis','Troubles de mémoire inchangés, avec moins d’effets ressentis','Plus de troubles de mémoire et des effets ressentis renforcés'];
  assert(q.options.every(option=>option.length<=75)); q.answer=0;
  q.editorial.expectedAnswer=q.options[0];
  q.explanation='L’alpha-pinène n’a pas atténué les troubles de mémoire provoqués par le THC dans cet essai. Une odeur de pin ou la présence de ce terpène ne constitue donc pas une protection démontrée contre ces troubles.';
  q.editorial.sourceEvidence[0].support='Dans cet essai randomisé chez19adultes, l’association n’a ni atténué les troubles de mémoire du THC ni modifié significativement les autres effets aigus.';
  item.coordinatorChange.optionsAfter=[...q.options]; item.coordinatorChange.explanationAfter=q.explanation;
  item.coordinatorConsultation={reader:'root',date:'2026-11-17',url:'https://pubmed.ncbi.nlm.nih.gov/40734690/',access:'abstract',locator:'Résumé original, Results et Conclusions',result:'Absence d’atténuation de la mémoire et de modification significative des autres effets aigus confirmée. Lecture du résumé, sans revendication de lecture intégrale.'};
 }
 if(suffix==='luxembourg-four-plants-per-household'){
  item.coordinatorChange={explanationBefore:q.explanation};
  q.explanation='Le plafond de quatre plantes s’applique par communauté domestique, pas par adulte. Le texte prévoit aussi des conditions de lieu et de visibilité des plantes.';
  item.coordinatorChange.explanationAfter=q.explanation;
 }
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[previous],coordinatorScope:'Neuf QCM corrigés relus entièrement. Sources exactes de la première revue Sol préservées ; seul le résumé Kumar2025 a également été consulté par le coordinateur pour une clarification de vocabulaire.'});
}
const ids=new Set(batch.questions.map(q=>q.id)), removed=review.items.filter(item=>!ids.has(item.id));
assert.equal(removed.length,2);
review.supersededItems??=[];
review.supersededItems.push(...removed.map(item=>({...item,status:'rejected',finalReviewer:'root',finalReviewedAt:'2026-11-17',comment:'Fait aromatique déjà actif : candidat doublon retiré avant activation, sans nouvelle variante.'})));
review.items=review.items.filter(item=>ids.has(item.id));
review.revisionHistory??=[]; review.revisionHistory.push({date:'2026-11-17',reviewer:'root',removedIds:removed.map(item=>item.id),replacementSlots:'ra06 grows to32; A total stays180'});
assert.equal(batch.questions.length,28);
for(const q of batch.questions){const item=review.items.find(item=>item.id===q.id);assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));}
await writeFile(batchPath,JSON.stringify(batch,null,2)+'\n');
await writeFile(path,JSON.stringify(review,null,2)+'\n');
console.log('ra02:28 approved;2 duplicate candidates archived');
