import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = 'docs/encyclopedia-revision';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const save = (p, value) => writeFile(p, JSON.stringify(value, null, 2) + '\n');
const reviews = new Map();
for (const file of (await readdir(`${root}/batches`)).filter(f => f.endsWith('.json'))) {
  const path = `${root}/batches/${file}`, lot = await read(path);
  for (const source of lot.sources) {
    if (source.id === 'botany-variety-buddies') {
      source.verifiedAt = '2026-11-14';
      source.passage = 'Registre KQ_BUDDIE_NAMES et tables locales 001–026 / 027–052 : existence des noms et rattachements des notices de variétés aux cartes du jeu.';
      source.limitation = 'Vérification locale des liens et des versions nommées ; ces fichiers ne constituent ni une archive indépendante de création ni un test génétique des parentés commerciales.';
      source.reviewEvidence = [{ status: 'read', url: source.url, sectionsOpened: ['src/lib/kanab-quest-game.ts: KQ_BUDDIE_NAMES', 'src/data/buddie-varieties/001-026.json', 'src/data/buddie-varieties/027-052.json', 'src/lib/kanab-quest-school-botany-varieties.ts: variantes et buddyCodes'], result: 'Registre des 52 noms lu et correspondances des dix notices de variétés contrôlées dans les fichiers locaux ; aucune nouvelle preuve externe de pedigree revendiquée.', assertionsSupported: ['Existence et distinction des fiches Buddies référencées'] }];
    }
    if (source.id === 'health-atlas-powdery-2024') source.author = 'Barbora Mieslerová et collaborateurs';
    if (source.id === 'products-tool-food-law') source.title = 'Règlement (CE) nº 178/2002 — texte original, articles 18 et 19';
  }
  for (const a of lot.articles) {
    if (!reviews.has(lot.domain)) reviews.set(lot.domain, { ids: [], terms: [] });
    reviews.get(lot.domain).ids.push(a.id);
    if (a.id.startsWith('record-variety-') && a.visual.status === 'reviewed-with-source-limitations') {
      a.visual.status = 'verified';
      a.visual.notes += ' Contrôle du coordinateur : le diagramme final ne reprend pas les dates ou filiations historiques encore bloquées ; son contenu est limité aux distinctions et déclarations effectivement lues.';
    }
    if (a.id === 'record-product-products-aerosol') a.patch.diagram.title = 'Du liquide à l’exposition';
    if (a.id === 'record-product-products-formulated') a.blockers = ['Confirmer les articles 18–19 dans la consolidation courante du règlement 178/2002 : texte original effectivement lu, consolidation 2026 inaccessible. Les affirmations de retrait et rappel ne sont pas validées comme vérification réglementaire actuelle.'];
    if (a.id === 'record-health-rhizoctonia') {
      a.patch.image.caption = a.patch.image.caption.replace('à160', 'à 160');
      const s = a.patch.sections.find(s => s.id === 'management');
      if (s) s.paragraphs = s.paragraphs.map(p => p.replace('L’historique du sol et des hôtes, ainsi que les déplacements de milieu ou de matériel végétal, aide', 'L’historique du sol et des hôtes, ainsi que les déplacements de milieu ou de matériel végétal, aident'));
    }
    if (a.id === 'record-health-psylliodes-attenuata') a.patch.image.caption = a.patch.image.caption.replace('Journal12:', 'Journal 12 : ');
    if (a.id === 'record-health-myzus-persicae') {
      for (const s of a.patch.sections) if (s.id === 'identification') s.paragraphs = s.paragraphs.map(p => p.replace('NC State le cite parmi les pucerons signalés sur chanvre. L’inventaire floridien le cite parmi les signalements d’autres régions, sans le compter parmi ses quatre pucerons identifiés localement. ', ''));
    }
    if (a.id === 'record-health-birds') {
      const s = a.patch.sections.find(s => s.id === 'identification');
      if (s) s.paragraphs = ['La qualité des semences, l’état du sol et d’autres consommateurs peuvent aussi expliquer des manques. Il faut confronter observations d’oiseaux en alimentation, graines manquantes et autres indices ; une présence à proximité ne suffit pas à attribuer les pertes.'];
    }
  }
  for (const t of lot.termReviews || []) reviews.get(lot.domain)?.terms.push(t.id);
  await save(path, lot);
}
for (const [domain, { ids, terms }] of reviews) {
  if (!['health', 'products', 'cannabinoids', 'history'].includes(domain)) continue;
  await save(`${root}/cross-reviews/${domain}-coordinator.json`, {
    date: '2026-11-14', entriesRead: ids, glossaryRead: [...new Set(terms)], finalApproval: false,
    method: 'Lecture intégrale des textes de chaque fiche par le coordinateur ; les dernières modifications ont été relues individuellement après stabilisation des lots. Les sections, légendes, diagrammes, faits, définitions et références associées ont été examinés. Validation finale distincte après contrôles techniques et visuels.',
    findings: domain === 'health' ? ['31 fiches et 11 termes relus. Limites hôte/territoire, signes/symptômes et détection/causalité vérifiées ; revue croisée des points sensibles dans health-final.json.'] : domain === 'products' ? ['36 fiches et 18 termes relus. Distinctions matières/procédés, teneurs/unités alimentaires, preuve de performance et présentation commerciale cohérentes. Blocage réglementaire résiduel reporté sur la formulation.'] : domain === 'cannabinoids' ? ['51 fiches et 21 termes relus. Sources de sections resserrées ; modèles animaux/cellulaires/humains séparés, critères principaux/secondaires conservés, même cohorte HHC non additionnée. Trois fiches conservent des points non vérifiés.'] : ['Deux fiches historiques relues intégralement ; dates, territoire, nature de preuve et frises contrôlés.']
  });
}
const botany = await read(`${root}/cross-reviews/botany-coordinator.json`);
botany.findings.push('Contrôle complémentaire : figures 2 et 4 de Spitzer-Rimon 2019 inspectées, retrait des stigmates du panneau 4E confirmé ; auteur Shai Duchin corrigé. Lynch 2025, section Domesticated cannabinoid pathway : localisation des ensembles de synthases sur chromosome 7 relue dans le texte intégral.', 'Registre local des Buddies et rattachements des dix notices lus ; les diagrammes des quatre notices historiquement bloquées sont contrôlés sans reprendre les détails non vérifiés.');
await save(`${root}/cross-reviews/botany-coordinator.json`, botany);
