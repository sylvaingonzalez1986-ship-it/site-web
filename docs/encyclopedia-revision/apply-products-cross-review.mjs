import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision';
const report = JSON.parse(await readFile(`${root}/cross-reviews/products-final.json`, 'utf8'));
const extra = report.additionalTargetedVerification;
const [claims, penal] = extra.sourceProposals.map(proposal => {
  const source = { ...proposal };
  delete source.replacementScope;
  return source;
});
const paperCorrection = report.requiredCorrections.find(c => c.id === 'products-final-paper-food-contact');
const paper = {
  id: 'products-official-paper-food-contact', title: 'Matériaux organiques à base de fibres végétales — contact alimentaire',
  author: 'DGCCRF', organization: 'Ministère de l’Économie', published: 'Page institutionnelle, date éditoriale non relevée',
  url: paperCorrection.evidence[1].url, verifiedAt: '2026-11-14', access: 'official-page', documentKind: 'Explication originale de l’autorité française chargée du contrôle',
  passage: 'Introduction et domaine d’application : aptitude au contact alimentaire, transferts de constituants, bonnes pratiques et conditions d’emploi prévisibles.',
  limitation: 'Cadre général du produit fini ; aucun seuil historique détaillé transposé et aucune certification attribuée au papier expérimental de Naithani.',
  reviewEvidence: paperCorrection.evidence.map(e => ({ ...e, status: 'read', openedAt: '2026-11-14', assertionsSupported: ['Aptitude au contact alimentaire à examiner pour le papier fini et ses conditions d’emploi ; propriétés mécaniques seules insuffisantes.'] }))
};
for (let i = 1; i <= 5; i++) {
  const path = `${root}/batches/products-0${i}.json`;
  const lot = JSON.parse(await readFile(path, 'utf8'));
  lot.sources = lot.sources.map(s => s.id === penal.id ? penal : s);
  for (const s of lot.sources) {
    for (const e of s.reviewEvidence) if (e.result === 'inaccessible') e.status = 'not-reverified';
    if (s.id === 'products-tool-seed-protein') {
      s.access = 'excerpt';
      s.passage = 'Résumé, Protein recovery, Amino acid composition et SDS-PAGE du texte intégral Wiley effectivement ouverts : récupération des fractions, composition et changements structuraux distincts.';
      s.limitation = 'Sections scientifiques du texte intégral consultées ; pas de méthode opératoire, de rendement universel ou d’équivalence nutritionnelle garantie. L’accès PMC bloqué ne décrit pas l’accès au texte Wiley.';
      s.reviewEvidence.push({ ...report.independentlyOpenedEvidence.find(e => e.sourceId === s.id), status: 'read', openedAt: '2026-11-14', assertionsSupported: ['Récupération, composition et structure des fractions protéiques distinctes.'] });
    }
    if (s.id === 'qh-nature-hemp-lime') s.reviewEvidence.push(...extra.carbonationEvidence);
  }
  for (const t of lot.termReviews || []) if (t.id === extra.termProposal.id) Object.assign(t, extra.termProposal);
  if (lot.articles.some(a => a.patch.sourceIds.includes('products-tool-claims'))) lot.sources.push(claims);
  for (const a of lot.articles) {
    // Keep the unavailable original citation explicit; add the authority's actually read explanation.
    if (a.patch.sourceIds.includes('products-tool-claims')) {
      a.patch.sourceIds.push(claims.id);
      for (const s of a.patch.sections) if (s.sourceIds.includes('products-tool-claims')) s.sourceIds.push(claims.id);
    }
    if (a.id === 'record-product-products-paper') {
      a.patch.sections.find(s => s.id === 'regulations').paragraphs[1] = paperCorrection.suggestedText;
      a.patch.sections.find(s => s.id === 'regulations').sourceIds.push(paper.id);
      a.patch.sourceIds.push(paper.id);
      lot.sources.push(paper);
    }
  }
  lot.sources = [...new Map(lot.sources.map(s => [s.id, s])).values()];
  await writeFile(path, JSON.stringify(lot, null, 2) + '\n');
}
