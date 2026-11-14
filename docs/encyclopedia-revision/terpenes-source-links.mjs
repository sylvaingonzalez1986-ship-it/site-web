import { readFile,writeFile } from 'node:fs/promises';
const file='docs/encyclopedia-revision/batches/terpenes-01.json';
const lot=JSON.parse(await readFile(file,'utf8'));
const article=lot.articles.find(a=>a.id==='ref-terpenes-terpenoides');
const section=article.patch.sections.find(s=>s.id==='ref-terpenes-terpenoides-oxygenes');
section.paragraphs=section.paragraphs.map(p=>p.replace('les terpénoïdes comprennent des dérivés oxygénés ou autrement modifiés','les terpénoïdes sont des dérivés oxygénés dont le squelette peut aussi être modifié'));
section.sourceIds=[...new Set([...section.sourceIds,'rev-terpene-pubchem-linalool'])];
article.patch.sourceIds=[...new Set([...article.patch.sourceIds,'rev-terpene-pubchem-linalool'])];
for(const [id,sourceIds] of [
  ['hemp-molecules-linalol-fonction',['rev-terpene-pubchem-linalool']],
  ['hemp-molecules-enantiomeres',['revision-iupac-stereochemistry']],
]) {
  const patch=lot.quizPatches.find(q=>q.id===id);
  if(patch) patch.sourceIds=sourceIds;
  else lot.quizPatches.push({id,sourceIds});
}
await writeFile(file,JSON.stringify(lot,null,2)+'\n');
