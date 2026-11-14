import { readFile, writeFile } from 'node:fs/promises';
const dir = 'docs/encyclopedia-revision';
const batches = await Promise.all([1,2,3,4,5].map(async n => [n, JSON.parse(await readFile(`${dir}/batches/terpenes-0${n}.json`, 'utf8'))]));
const all = new Map(batches.flatMap(([,b])=>b.articles.map(a=>[a.id,a])));
const cross = JSON.parse(await readFile(`${dir}/cross-reviews/terpenes-pharmacology.json`,'utf8'));
for (const source of cross.sources) {
  const existing = batches.flatMap(([,b])=>b.sources).filter(s=>s.id===source.id);
  if (existing.length) for (const s of existing) { s.reviewEvidence.push(...source.reviewEvidence); s.passage += ' Contrelecture pharmacologique : ' + source.passage; }
  else batches[0][1].sources.push(source);
}
// One main home for each detailed comparison; the other notices keep the shorter contextual explanation.
const targets = ['record-terpene-limonene','record-terpene-alphapinene','record-terpene-myrcene','record-terpene-beta-caryophyllene','ref-odeur-cannabis'];
cross.proposals.forEach((proposal, index)=>{
  const a = all.get(targets[index]);
  const s = a.patch.sections.find(s=>s.id===(index===4?'ref-odeur-cannabis-pharmacologie':'biology'));
  if (!s.paragraphs.includes(proposal.proposedParagraphAddition)) s.paragraphs.push(proposal.proposedParagraphAddition);
  s.sourceIds = [...new Set([...s.sourceIds,...proposal.sourceIds])];
  a.patch.sourceIds = [...new Set([...a.patch.sourceIds,...proposal.sourceIds])];
});
for (const [id, url, passage] of [
  ['terpenes-lesson-terpenes','https://iupac.qmul.ac.uk/class/terp.html','Entrées terpenes et isoprenoids : hydrocarbures et classement C5/C10/C15 ; dérivation formelle, pas polymérisation biologique d’isoprène libre.'],
  ['terpenes-lesson-terpenoids','https://iupac.qmul.ac.uk/class/terp.html','Entrées terpenoids et monoterpenoids : fonctions oxygénées, squelette pouvant perdre ou déplacer un fragment.'],
  ['terpenes-lesson-esters','https://iupac.qmul.ac.uk/class/carba.html','Entrée esters : famille générale des dérivés d’oxoacides et exemples carboxyliques R–C(=O)–O–R′.'],
]) {
  const s = batches[0][1].sources.find(s=>s.id===id);
  Object.assign(s,{title:'Glossary of class names of organic compounds and reactive intermediates based on structure — '+id.split('-').at(-1),author:'G. P. Moss, P. A. S. Smith et D. Tavernier',organization:'IUPAC / version électronique Queen Mary University of London',published:'1995, Pure and Applied Chemistry 67, 1307–1375',url,access:'full-text',passage,documentKind:'Recommandations de nomenclature originales',limitation:'Version web autorisée par l’IUPAC, identité avec le document publié déclarée dans l’index ; les pages Gold Book actuelles ont refusé l’accès.'});
  s.reviewEvidence.push({url,sectionsOpened:[passage,'Index éditorial : auteurs, publication 1995 et autorisation IUPAC'],result:'Document ouvert et passages lus par le coordinateur le 14 novembre 2026.',status:'read'});
}
const stereo = {id:'revision-iupac-stereochemistry',title:'Nomenclature of Organic Chemistry — Chapter P-9',author:'Henri A. Favre et Warren H. Powell (éditeurs)',organization:'IUPAC / Royal Society of Chemistry ; version web QMUL',published:'2013',url:'https://iupac.qmul.ac.uk/BlueBook/P9.html',verifiedAt:'2026-11-14',access:'full-text',documentKind:'Recommandations de nomenclature',passage:'P-91.1, P-92.1.1 et P-93.1.3 : traits/coins stéréochimiques, image miroir non superposable, racémate équimolaire.',limitation:'Seules ces définitions et conventions sont utilisées ; pas preuve de présence ou de pharmacologie.',reviewEvidence:[{status:'read',sectionsOpened:['P-91.1','P-92.1.1','P-93.1.3'],result:'Passages effectivement ouverts et lus par le coordinateur le 14 novembre 2026.'}]};
if (!batches[0][1].sources.some(s=>s.id===stereo.id)) batches[0][1].sources.push(stereo);
for (const [,b] of batches) {
  for (const a of b.articles) for (const s of a.patch.sections) if (s.sourceIds.includes('terpenes-lesson-enantiomer')) {
    s.sourceIds=[...new Set([...s.sourceIds,stereo.id])]; a.patch.sourceIds=[...new Set([...a.patch.sourceIds,stereo.id])];
  }
  for(const t of b.termReviews||[]) if(t.sourceIds.includes('terpenes-lesson-enantiomer')) t.sourceIds=[...new Set([...t.sourceIds,stereo.id])];
}
for(const [n,b] of batches) await writeFile(`${dir}/batches/terpenes-0${n}.json`,JSON.stringify(b,null,2)+'\n');
