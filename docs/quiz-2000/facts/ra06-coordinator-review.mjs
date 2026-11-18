// Single-use targeted corrections after B's independent complete review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const root='docs/quiz-2000/',bp=root+'batches/r-actives-a-06.json',rp=root+'reviews/r-actives-a-06.json',snapshot=root+'facts/r-actives-a-06-before-coordinator.json';
assert(!existsSync(snapshot),'single-use script');
const batch=JSON.parse(readFileSync(bp,'utf8')),review=JSON.parse(readFileSync(rp,'utf8')),original=structuredClone({batch,review});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),prefix='hemp-q2-ra06-';
const notes={
  'black-domina-sensi-four-lines':'Justification du niveau3 alignée sur la reconnaissance de quatre ascendances variétales ; aucune référence clinique hors sujet.',
  'lemon-skunk-dna-parental-places':'Portée bornée à Lemon Skunk256 dans la question, le corrigé et les métadonnées du fait. Même déclaration commerciale et source.',
  'thcp-33-fold-binding-not-human-high':'Quatre mesures expérimentales plausibles remplacent dose thérapeutique et généralités humaines. La comparaison reste exclusivement une affinité CB1 in vitro.',
  'nida-gateway-not-inevitable':'Quatre interprétations distinctes : fréquence, association, causalité et majorité sans progression. Aucun pourcentage inventé ni distracteurs numériques recouvrants.',
  'rimonabant-suspension-psychiatric-risk':'Quatre préoccupations de sécurité médicales plausibles et parallèles, avec la même recommandation historique et le même motif psychiatrique.',
};
for(const q of batch.questions){
  const item=review.items.find(i=>i.id===q.id),before=structuredClone(q),previous=structuredClone(item);
  assert.equal(item.contentHash,hash(q));for(const id of q.sourceIds)assert.equal(item.sourceChecks.find(c=>c.sourceId===id).sourceHash,hash(batch.sources.find(s=>s.id===id)));
  const key=q.id.slice(prefix.length);if(!notes[key]){assert.equal(item.status,'approved');continue;}assert.equal(item.status,'changes_requested');
  if(key==='black-domina-sensi-four-lines'){
    q.editorial.difficultyRationale='Reconnaissance précise de quatre lignées fondatrices annoncées, parmi plusieurs ensembles de noms variétaux crédibles.';
    q.editorial.learningObjective='Reconnaître les quatre ascendances annoncées par Sensi pour Black Domina.';
  }else if(key==='lemon-skunk-dna-parental-places'){
    q.prompt='D’où viennent les deux sélections parentales de Lemon Skunk256 selon DNA Genetics ?';
    q.explanation='DNA décrit Lemon Skunk256 comme l’association d’une sélection Skunk de Las Vegas et d’une sélection des Pays-Bas. Il s’agit du récit de cette maison pour la version présentée.';
    q.editorial.property='Lieux d’origine annoncés des deux sélections de Lemon Skunk256';
    q.editorial.learningObjective='Situer les deux sélections parentales annoncées pour la version Lemon Skunk256 de DNA.';
    q.editorial.sourceEvidence[0].support='DNA situe les deux sélections Skunk réunies dans Lemon Skunk256 à Las Vegas et aux Pays-Bas.';
  }else if(key==='thcp-33-fold-binding-not-human-high'){
    q.options=['À l’affinité de liaison à CB1 mesurée in vitro','À l’activité de CB1 mesurée dans un essai fonctionnel','À la baisse de l’activité motrice observée chez la souris','À la concentration sanguine mesurée chez la souris'];
  }else if(key==='nida-gateway-not-inevitable'){
    q.options=['Le passage à ces substances est le parcours le plus fréquent','Les études ne retrouvent pas d’association entre ces usages','Les associations observées établissent un effet causal du cannabis','La majorité des usagers de cannabis ne le font pas'];
  }else if(key==='rimonabant-suspension-psychiatric-risk'){
    q.options=['Des troubles cardiovasculaires, dont les arythmies','Des atteintes hépatiques, dont l’insuffisance hépatique','Des troubles métaboliques, dont l’hypoglycémie','Des troubles psychiatriques, dont la dépression'];
  }
  q.editorial.expectedAnswer=q.options[q.answer];assert(q.prompt.length<=150&&q.options.every(o=>o.length<=75)&&q.explanation.length<=240,q.id+' lengths');
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];item.coordinatorChange={before,after:structuredClone(q)};
  item.coordinatorScope='Arbitrage ciblé après lecture indépendante B des34 objets et36 sources. Les36 objets sources restent inchangés ; aucune nouvelle consultation revendiquée par root.';
  item.status='approved';item.contentHash=hash(q);item.comment=notes[key];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
}
assert.equal(batch.questions.length,34);assert(review.items.every(i=>i.status==='approved'));
review.coordinatorSummary='34 questions approuvées :29 inchangées et5 corrections ciblées de justification, version commerciale et distracteurs.36 objets sources inchangés.';
writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');writeFileSync(bp,JSON.stringify(batch,null,2)+'\n');writeFileSync(rp,JSON.stringify(review,null,2)+'\n');console.log('ra06:34 approved');
