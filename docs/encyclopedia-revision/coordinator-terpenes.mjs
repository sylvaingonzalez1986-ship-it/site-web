import { readFile, writeFile } from 'node:fs/promises';
const dir = 'docs/encyclopedia-revision';
const batches = await Promise.all([1, 2, 3, 4, 5].map(async n => [n, JSON.parse(await readFile(`${dir}/batches/terpenes-0${n}.json`, 'utf8'))]));
const all = new Map(batches.flatMap(([, b]) => b.articles.map(a => [a.id, a])));
const changes = [
  ['camphene', 'biology', 'tp-sage1998'], ['alpha-phellandrene', 'biology', 'tp-herbs2021'],
  ['e-beta-ocimene', 'biology', 'tp-snapdragon2008'], ['z-beta-ocimene', 'biology', 'tp-lavender2022'],
  ['fenchol', 'cannabis', 'tp-janta2024'], ['fenchol', 'biology', 'tp-fennel2021'],
  ['borneol', 'biology', 'tp-herbs2021'], ['alpha-terpineol', 'cannabis', 'tp-ovidi2022'],
  ['eucalyptol', 'cannabis', 'qh-nature-aroma-key-compounds'], ['p-cymene', 'cannabis', 'tp-janta2024'],
  ['alpha-humulene', 'cannabis', 'tp-hops2021'], ['e-beta-farnesene', 'cannabis', 'tp-hops2021'],
  ['alpha-selinene', 'cannabis', 'tp-hops2021'], ['nerolidol', 'biology', 'tp-snapdragon2008'],
  ['geranyl-acetate', 'biology', 'tp-lavender2022'],
];
for (const [id, section, source] of changes) {
  const review = all.get(`record-terpene-${id}`);
  const target = review.patch.sections.find(s => s.id === section);
  target.sourceIds = [...new Set([...target.sourceIds, source])];
  review.patch.sourceIds = [...new Set([...review.patch.sourceIds, source])];
}
// These second identity paragraphs repeat the first paragraph or the detailed presence section.
const duplicates = ['myrcene', 'limonene', 'alpha-phellandrene', 'alpha-terpinene', 'terpinolene', 'e-beta-ocimene', 'z-beta-ocimene', 'linalool', 'fenchol', 'borneol', 'terpinen4-ol', 'eucalyptol', 'p-cymene', 'alpha-humulene', 'e-beta-farnesene', 'alpha-selinene', 'guaiol', 'alpha-bisabolol', 'nerolidol'];
for (const id of duplicates) {
  const review = all.get(`record-terpene-${id}`);
  const identity = review.patch.sections.find(s => s.id === 'identity');
  if (identity.paragraphs.length === 3) identity.paragraphs.splice(1, 1);
}
const geranyl = all.get('record-terpene-geranyl-acetate').patch.sections.find(s => s.id === 'biology');
geranyl.paragraphs = geranyl.paragraphs.map(p => p.replace('Une absolute est', 'Une absolue est'));
for (const [n, batch] of batches) await writeFile(`${dir}/batches/terpenes-0${n}.json`, JSON.stringify(batch, null, 2) + '\n');
await writeFile(`${dir}/cross-reviews/terpenes-coordinator.json`, JSON.stringify({date:'2026-11-14', entriesRead:[...all.keys()], glossaryRead:26, finalApproval:false, findings:['35 fiches intégralement relues : résumé, sections, faits hérités, crédits et diagrammes ; 26 termes relus.', 'Références rapprochées des passages précis qu’elles documentent ; suppression de paragraphes d’identité redondants sans retirer de connaissances distinctes.', 'Niveaux analytiques, géométries et modèles biologiques cohérents ; contre-vérification pharmacologique indépendante encore attendue.']},null,2)+'\n');
