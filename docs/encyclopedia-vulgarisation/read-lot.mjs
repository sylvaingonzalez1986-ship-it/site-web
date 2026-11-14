import fs from 'node:fs';
const [name, start = '0', count = '6'] = process.argv.slice(2);
const lot = JSON.parse(fs.readFileSync(`docs/encyclopedia-vulgarisation/batches/${name}.json`, 'utf8'));
const baseline = JSON.parse(fs.readFileSync('docs/encyclopedia-revision/baseline-catalog.json', 'utf8'));
const originals = [...baseline.articles, ...baseline.records];
for (const entry of lot.articles.slice(+start, +start + +count)) {
  console.log(`\n${entry.id} | ${entry.patch.title || ''}\n${entry.patch.lead}`);
  for (const section of entry.patch.sections) {
    console.log(`\n${section.title}\n${section.paragraphs.join('\n')}`);
    if (section.details) console.log(`À ouvrir : ${section.details.title}\n${section.details.paragraphs.join('\n')}`);
  }
  const facts = entry.patch.facts || originals.find(original => original.id === entry.id)?.facts;
  if (facts) console.log('Repères :', JSON.stringify(facts));
  if (entry.patch.diagram) console.log('Schéma :', JSON.stringify(entry.patch.diagram));
  if (entry.patch.image) console.log('Image :', entry.patch.image.alt, '|', entry.patch.image.caption);
  console.log('Quiz lus :', entry.quizIdsReviewed?.join(', '));
}
if (process.argv.includes('--extras')) {
  console.log('\nGLOSSAIRE');
  for (const term of lot.termReviews || []) console.log(term.id, '|', term.definition);
  console.log('\nQUIZ');
  for (const question of lot.quizPatches || []) console.log(question.id, '|', question.explanation || '', question.question || '');
}
