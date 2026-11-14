import { readFile } from 'node:fs/promises';
const baseline = JSON.parse(await readFile('src/lib/kanab-quest-cannabis-reviewed.json', 'utf8'));
const previous = new Map(baseline.articles.map(a => [a.id, a]));
for (const name of process.argv.slice(2)) {
  const lot = JSON.parse(await readFile(`docs/encyclopedia-revision/batches/${name}.json`, 'utf8'));
  console.log(name);
  for (const a of lot.articles) {
    const before = previous.get(a.id) || {};
    const changes = Object.entries(a.patch).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]));
    if (!changes.length) continue;
    console.log(a.id);
    for (const [key, value] of changes) {
      if (key === 'sections') for (const s of value) {
        if (JSON.stringify(before.sections?.find(item => item.id === s.id)) !== JSON.stringify(s)) console.log(s.title, s.sourceIds.join(', '), '\n' + s.paragraphs.join('\n'));
      }
      else console.log(key, JSON.stringify(value));
    }
  }
  console.log('TERMES', JSON.stringify(lot.termReviews || []));
}
