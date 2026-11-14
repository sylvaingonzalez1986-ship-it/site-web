import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision/batches';
for (const file of (await readdir(root)).filter(f => f.endsWith('.json'))) {
  const path = `${root}/${file}`, lot = JSON.parse(await readFile(path, 'utf8'));
  for (const s of lot.sources) if (['terpenes-lesson-terpenes', 'terpenes-lesson-terpenoids', 'terpenes-lesson-esters'].includes(s.id)) s.verifiedAt = '2026-11-14';
  for (const t of lot.termReviews || []) if (t.id === 'products-term-carbonation') t.sourceIds = ['qh-nature-hemp-lime'];
  for (const q of lot.quizPatches || []) if (q.id === 'hemp-seeds-decorticage') q.sourceIds = ['products-lesson-parts'];
  const article = lot.articles.find(a => a.id === 'ref-matieres-chanvre');
  if (article) {
    const section = article.patch.sections.find(s => s.title === 'La chènevotte');
    section.paragraphs[0] = 'La partie ligneuse intérieure fournit la chènevotte. Elle entre dans des litières et dans des matériaux de construction, notamment avec un liant à base de chaux et de l’eau. L’eau intervient dans la mise en œuvre et les réactions du liant. Un béton de chanvre courant remplit et isole une ossature : il ne remplace pas automatiquement une structure porteuse.';
    if (!section.sourceIds.includes('qh-nature-hemp-lime')) section.sourceIds.push('qh-nature-hemp-lime');
    if (!article.patch.sourceIds.includes('qh-nature-hemp-lime')) article.patch.sourceIds.push('qh-nature-hemp-lime');
  }
  await writeFile(path, JSON.stringify(lot, null, 2) + '\n');
}
