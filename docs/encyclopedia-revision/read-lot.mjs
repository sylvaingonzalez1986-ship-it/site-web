import { readFile } from 'node:fs/promises';
const [name, offset = '0', count = '99'] = process.argv.slice(2);
const lot = JSON.parse(await readFile(`docs/encyclopedia-revision/batches/${name}.json`, 'utf8'));
for (const a of lot.articles.slice(Number(offset), Number(offset) + Number(count))) {
  console.log(`\n${a.id}\n${a.patch.lead}`);
  for (const s of a.patch.sections) console.log(`${s.title} [${s.sourceIds.join(', ')}]\n${s.paragraphs.join('\n')}`);
  if (a.patch.facts) console.log('FAITS', JSON.stringify(a.patch.facts));
  if (a.patch.image) console.log('IMAGE', JSON.stringify(a.patch.image));
  if (a.patch.diagram) console.log('DIAGRAMME', JSON.stringify(a.patch.diagram));
  console.log('BLOCAGES', JSON.stringify(a.blockers));
}
