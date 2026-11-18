// Single-use corrections of B's targeted independent review.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const base='docs/quiz-2000/';
const batchPath=base+'batches/r-actives-a-04.json';
const reviewPath=base+'reviews/r-actives-a-04.json';
const snapshot=base+'facts/r-actives-a-04-before-coordinator.json';
assert(!existsSync(snapshot),'single-use script');
const batch=JSON.parse(readFileSync(batchPath,'utf8'));
const review=JSON.parse(readFileSync(reviewPath,'utf8'));
const original=structuredClone({batch,review});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const prefix='hemp-q2-ra04-';
const notes={
  'sterilized-cannabis-mycotoxins-can-remain':'La neutralisation magique par la résine est remplacée par une hypothèse de réapparition après repousse. Les choix comparent le devenir de toxines déjà formées et celui de leurs producteurs.',
  'flower-pesticide-residues-transfer-to-smoke':'Les quatre choix décrivent des résultats de détection comparables ; la réponse n’est plus la seule formulation partielle face à trois complètes. Le transfert observé reste borné aux résidus testés.',
  'madrid-illicit-resin-fecal-bacteria':'Quatre bactéries compatibles avec un contexte de contamination alimentaire/environnementale remplacent les distracteurs respiratoire et tétanique. Le prompt cible l’association aux échantillons à odeur fécale explicitement rapportée dans le résumé.',
  'dronabinol-alzheimer-agitation-trial-signal':'Les lésions sont remplacées par une manifestation clinique. La portée symptomatique et la distinction avec les indications américaines sont conservées.',
  'adhd-thc-cbd-no-primary-cognitive-benefit':'Le critère principal cognition/activité, l’année2017 et les quatre résultats possibles sont explicites. La mémoire ancienne hors critère a disparu ; absence de différence ne signifie pas preuve d’équivalence.',
  'cbd-social-anxiety-public-speaking-signal':'Les quatre choix comparent l’anxiété lors du discours face au placebo, sans détour par sommeil/mémoire. L’essai2011 et sa population sont précisés.',
  'advanced-cancer-thc-cbd-limited-pain-toxicity-tradeoff':'L’essai est daté2025. Les options comparent douleur et effets psychiques ; le corrigé précise que la douleur est un critère secondaire sans correction des comparaisons multiples, et que le critère global est négatif.',
};
for(const q of batch.questions){
  const item=review.items.find(item=>item.id===q.id);
  assert.equal(item.contentHash,hash(q),'changed question '+q.id);
  for(const sourceId of q.sourceIds) assert.equal(item.sourceChecks.find(check=>check.sourceId===sourceId).sourceHash,hash(batch.sources.find(source=>source.id===sourceId)),'changed source '+sourceId);
  const key=q.id.slice(prefix.length);
  if(!notes[key]){assert.equal(item.status,'approved');continue;}
  assert.equal(item.status,'changes_requested');
  const before=structuredClone(q);
  if(key==='sterilized-cannabis-mycotoxins-can-remain'){
    q.options=[
      'Elles disparaissent avec les organismes qui les produisaient',
      'Elles peuvent subsister sans champignons encore viables',
      'Elles deviennent inactives lorsque la croissance s’arrête',
      'Elles ne réapparaissent que si les champignons repoussent',
    ];
  } else if(key==='flower-pesticide-residues-transfer-to-smoke'){
    q.options=[
      'Une absence de résidus détectables dans la fumée inhalée',
      'Des résidus des fleurs détectés dans la fumée inhalée',
      'Des résidus détectés dans l’eau, mais absents de la fumée',
      'Des résidus détectés dans les cendres, mais absents de la fumée',
    ];
  } else if(key==='madrid-illicit-resin-fecal-bacteria'){
    q.prompt='Quelle bactérie l’étude de 2019 à Madrid associe-t-elle aux résines de cannabis présentant une odeur fécale ?';
    q.options=['Salmonella enterica','Staphylococcus aureus','Listeria monocytogenes','Escherichia coli'];
  } else if(key==='dronabinol-alzheimer-agitation-trial-signal'){
    q.options[1]='Les troubles du langage';
    q.explanation='L’essai visait l’agitation et a observé sa réduction, sans démontrer une restauration de la mémoire ou une action sur la progression de la maladie. Alzheimer ne figure pas dans les indications américaines de l’étiquette citée.';
  } else if(key==='adhd-thc-cbd-no-primary-cognitive-benefit'){
    q.prompt='Dans l’essai de 2017 sur le THC/CBD chez des adultes avec TDAH, quel résultat a donné le critère principal de cognition et d’activité ?';
    q.options=[
      'Une amélioration significative face au placebo',
      'Une dégradation significative face au placebo',
      'Un critère principal non interprétable faute de mesures',
      'Aucune différence significative face au placebo',
    ];
    q.explanation='L’essai pilote n’a pas trouvé de différence significative du critère principal cognitif et d’activité. Les résultats secondaires exploratoires n’ont pas été confirmés après correction des comparaisons multiples.';
  } else if(key==='cbd-social-anxiety-public-speaking-signal'){
    q.prompt='Dans l’essai de 2011 chez des patients souffrant d’anxiété sociale, quel effet du CBD a été observé pendant un discours simulé ?';
    q.options=[
      'Une anxiété plus forte que sous placebo pendant le discours',
      'Une anxiété plus faible que sous placebo pendant le discours',
      'Une anxiété semblable au placebo pendant le discours',
      'Une anxiété plus forte que sous placebo, puis plus faible après',
    ];
  } else if(key==='advanced-cancer-thc-cbd-limited-pain-toxicity-tradeoff'){
    q.prompt='Dans l’essai de Hardy de 2025 en cancer avancé, quel bilan a donné une huile orale équilibrée THC/CBD ajoutée aux soins palliatifs ?';
    q.options=[
      'Signal de baisse de la douleur, sans hausse des effets psychiques',
      'Signal de baisse de la douleur, avec plus d’effets psychiques',
      'Pas de signal sur la douleur, avec plus d’effets psychiques',
      'Pas de signal sur la douleur, avec moins d’effets psychiques',
    ];
    q.explanation='Le critère global de détresse symptomatique n’a pas été amélioré. Un signal de réduction de la douleur, critère secondaire sans correction des comparaisons multiples, s’accompagnait de plus d’effets psychiques.';
  }
  q.editorial.expectedAnswer=q.options[q.answer];
  assert(q.prompt.length<=150,q.id+' prompt');assert(q.options.every(option=>option.length<=75),q.id+' options');assert(q.explanation.length<=240,q.id+' explanation');
  const previous=structuredClone(item);
  item.coordinatorHistory=[...(item.coordinatorHistory||[]),previous];
  item.coordinatorChange={before,after:structuredClone(q)};
  item.coordinatorScope='Correction ciblée après première lecture indépendante de B. Les23 objets sources sont inchangés. Une consultation supplémentaire du résumé FAO pour la question Madrid est décrite séparément ; aucune autre nouvelle lecture revendiquée.';
  if(key==='madrid-illicit-resin-fecal-bacteria') item.coordinatorConsultation={reader:'root',date:'2026-11-17',url:'https://agris.fao.org/search/en/providers/122535/records/65de47ab0f3e94b9e5ccde61',access:'abstract',locator:'Résumé original, paragraphes microbiological contamination et fecal odor',result:'Résumé intégral ouvert : E.coli est la bactérie nommée et associée aux échantillons à odeur fécale. Aspergillus est aussi cité comme champignon ; aucun des trois nouveaux distracteurs bactériens n’est cité dans le résumé. Aucun accès au texte payant revendiqué.'};
  item.status='approved';item.contentHash=hash(q);item.comment=notes[key];item.finalReviewer='root';item.finalReviewedAt='2026-11-17';
}
assert.equal(batch.questions.length,25);assert(review.items.every(item=>item.status==='approved'));
review.coordinatorSummary='25 questions approuvées :18 inchangées et7 corrections ciblées de distracteurs ou de portée des résultats.23 objets sources inchangés ; consultation supplémentaire limitée au résumé de Madrid tracée.';
writeFileSync(snapshot,JSON.stringify(original,null,2)+'\n');
writeFileSync(batchPath,JSON.stringify(batch,null,2)+'\n');
writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('ra04:25 approved;7 targeted corrections;23 sources unchanged');
