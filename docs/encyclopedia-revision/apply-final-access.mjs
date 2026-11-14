import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const varieties = await read(`${root}/cross-reviews/varieties-final-access.json`);
const cannabinoids = await read(`${root}/cross-reviews/cannabinoids-final-access.json`);
const successes = varieties.targets.filter(t => t.result === 'read');
for (const t of successes) {
  // Readable typography; do not infer dates from filenames or adjacent articles.
  if (t.articleId === 'record-variety-kush') t.sourceUpdateProposal.published = 'Édition imprimée du 17 au 23 avril 2020';
  else { t.sourceUpdateProposal.title = 'Sensi Seeds at 40: The Roots of Dutch Cannabis History'; t.sourceUpdateProposal.published = '2025-03-27 ; mise à jour 2025-12-17'; }
}
for (const file of (await readdir(`${root}/batches`)).filter(f => f.endsWith('.json'))) {
  const path = `${root}/batches/${file}`, lot = await read(path);
  for (const t of successes) {
    lot.sources = lot.sources.map(s => s.id === t.sourceUpdateProposal.id ? t.sourceUpdateProposal : s);
    const a = lot.articles.find(a => a.id === t.articleId);
    if (!a) continue;
    for (const s of t.articlePatchProposal.sectionPatches) {
      const section = a.patch.sections.find(section => section.id === s.id);
      section.paragraphs = s.paragraphs.map(p => p.replace(/en(\d{4})/g, 'en $1'));
      section.sourceIds = s.sourceIds;
    }
    a.patch.sourceIds = [...new Set([...a.patch.sourceIds, t.sourceUpdateProposal.id])];
    a.sourceIdsReviewed = [...new Set([...(a.sourceIdsReviewed || []), t.sourceUpdateProposal.id])];
    a.blockers = [];
    a.status = 'ready-for-integration';
    a.findings.push('Dernier accès primaire résolu et proposition relue par le coordinateur ; voir cross-reviews/varieties-final-access.json. Attribution rétrospective maintenue, aucune certification génétique ajoutée.');
  }
  const history = lot.articles.find(a => a.id === 'ref-decouvertes-cannabinoides');
  if (history) {
    const proposed = cannabinoids.articles.find(a => a.id === history.id).proposedSectionAddition;
    const section = history.patch.sections.find(s => s.id === proposed.sectionId);
    if (!section.paragraphs.includes(proposed.paragraph)) section.paragraphs.push(proposed.paragraph);
    section.sourceIds = [...new Set([...section.sourceIds, ...proposed.sourceIds])];
    history.patch.sourceIds = [...new Set([...history.patch.sourceIds, ...proposed.sourceIds])];
    history.sourceIdsReviewed = [...new Set([...(history.sourceIdsReviewed || []), ...proposed.sourceIds])];
    history.blockers[0] = 'Originaux de Wood, Spivey et Easterfield et jalon de liaison avant le clonage : documents primaires toujours inaccessibles. Le sous-point CB2 est désormais confirmé par le résumé original de Munro (1993). Aucune question du quiz ne dépend des précisions historiques non relues.';
    lot.sources = [...lot.sources.filter(s => s.id !== 'qh-sci-cb2'), cannabinoids.sources.find(s => s.id === 'qh-sci-cb2')];
  }
  await save(path, lot);
}
