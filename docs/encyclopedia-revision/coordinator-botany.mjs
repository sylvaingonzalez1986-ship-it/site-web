import { readFile, writeFile } from 'node:fs/promises';
const dir = 'docs/encyclopedia-revision';
const batches = await Promise.all([1, 2, 3, 4].map(async n => [n, JSON.parse(await readFile(`${dir}/batches/botany-0${n}.json`, 'utf8'))]));
const all = new Map(batches.flatMap(([, batch]) => batch.articles.map(article => [article.id, article])));
const section = (id, name) => all.get(`record-variety-${id}`).patch.sections.find(item => item.id === name);
function paragraphs(id, name, values) { section(id, name).paragraphs = values; }
paragraphs('skunk', 'evidence', ['Le témoignage de Sam est une source primaire attribuée mais rétrospective. Il ne suffit pas à reconstituer les dates de lancement de toutes les versions régulières, féminisées et automatiques. Le terme courant « skunk » ne certifie pas une descendance de Skunk #1.']);
all.get('record-variety-northern-lights').patch.lead = 'Northern Lights désigne une famille de sélections numérotées et de descendants. Leurs catalogues documentent des ascendances annoncées, sans établir tous les fondateurs historiques.';
paragraphs('northern-lights', 'history', ['Northern Lights désigne une famille de matériels avec des sélections numérotées. Une mention dans un catalogue date la présence d’un nom dans ce catalogue ; elle ne suffit pas à dater la création biologique ni à identifier les plantes fondatrices. La chronologie précise de la diffusion européenne reste à confirmer par les archives correspondantes.']);
all.get('record-variety-northern-lights').patch.diagram.nodes[3] = { label: 'Chronologie des catalogues', detail: 'La date d’une annonce ne suffit pas à dater la création du matériel.' };
all.get('record-variety-kush').patch.lead = 'Hindu Kush désigne un massif et des matériels qui lui sont attribués. Les produits appelés OG Kush et leurs dérivés ont des identités propres : le mot partagé ne suffit pas à établir une parenté.';
paragraphs('kush', 'history', ['Hindu Kush est à la fois un toponyme et une appellation de matériels sélectionnés. Sensi attribue sa version au massif entre Afghanistan et Pakistan. Cette provenance revendiquée ne permet pas de déduire celle de chaque produit portant le mot Kush. Le récit historique de transmission d’OG Kush demande une documentation distincte et ne sert pas ici à nommer ses parents.']);
all.get('record-variety-cookies').patch.lead = 'Cookies regroupe des noms de sélections et de descendants. Leurs parentés doivent être attribuées à une version et à un détenteur précis.';
paragraphs('cookies', 'history', ['Girl Scout Cookies et ses descendants sont liés à des récits de sélection californiens. Les noms de sélection, leur circulation et l’identité des plantes fondatrices sont trois objets de preuve différents. La chronologie détaillée et les fondateurs de cette famille ne sont pas établis par les documents retenus ici.']);
paragraphs('cookies', 'parents', ['La parenté fondatrice de Girl Scout Cookies reste à confirmer dans le témoignage primaire de Jigga. Le nom F1 Durban demande lui aussi une attribution précise. En génétique, F1 désigne une première génération filiale issue de parents définis ; les caractères F1 dans un nom propre ne constituent pas à eux seuls une certification génétique.']);
paragraphs('cookies', 'evidence', ['Une annonce de Sherbinskis peut documenter les parents revendiqués de sa Gelato sans démontrer les fondateurs de toute la famille Cookies. Un pedigree indépendant demanderait des archives de croisements ou des échantillons identifiés. Les relations non établies restent donc ouvertes.']);
paragraphs('gelato', 'history', ['Gelato est une famille de sélections associée à Sherbinskis. La parenté actuellement annoncée par la marque et la date de création initiale sont deux informations distinctes. La chronologie précise des croisements et de leur diffusion reste à confirmer par des archives primaires.']);
paragraphs('gelato', 'variants', ['La page Sherbinskis identifie notamment Bacio Gelato / #41 et plusieurs membres de sa famille Gelato. Les numéros désignent des sélections : ce ne sont ni des pourcentages ni des générations filiales. Une liste de numéros ne suffit pas à établir les dates de création ni l’identité de chaque clone.']);
paragraphs('gelato', 'evidence', ['La parenté annoncée par Sherbinskis est documentée, sans analyse de parentage indépendante fournie. Un lot simplement étiqueté Gelato sans numéro, détenteur et traçabilité ne permet pas de choisir un clone précis. La chronologie historique reste une question distincte de cette annonce actuelle.']);
all.get('record-variety-gelato').patch.diagram.nodes[2] = { label: 'Date du croisement', detail: 'Chronologie exacte non établie par la page actuelle de la marque.' };
paragraphs('cbd-hybrids', 'history', ['Les hybrides CBD regroupent plusieurs programmes de sélection, et non une espèce ou une origine géographique unique. Resin Seeds publie une correction du pedigree de Cannatonic en novembre 2015. CBD Crew décrit séparément son programme CBD Therapy, sans que sa page courante établisse la date exacte de son lancement.']);
const blueberry = all.get('record-variety-blueberry').patch;
blueberry.lead = 'Dutch Passion attribue la Blue Family à DJ Short et décrit une coopération pour sa diffusion néerlandaise. Une annonce d’ascendance ne suffit pas à identifier chaque plante fondatrice.';
section('blueberry', 'parents').paragraphs[0] = section('blueberry', 'parents').paragraphs[0].replace('La page Dutch Passion donne davantage de détails que le dossier initial : elle cite', 'Dutch Passion cite');
const bySection = {
  haze: [['haze-ag'], ['haze-ag', 'ssh'], ['mango', 'ssh', 'buddies'], ['identity', 'haze-ag', 'ssh']],
  skunk: [['skunk-sam'], ['skunk-sam'], ['buddies', 'identity'], ['skunk-sam', 'identity']],
  'northern-lights': [['identity'], ['mango', 'ssh'], ['mango', 'buddies'], ['mango', 'ssh', 'identity']],
  kush: [['kush-sensi'], ['og-cbd'], ['buddies', 'identity'], ['kush-sensi', 'og-cbd', 'identity']],
  diesel: [['soma', 'cannatonic'], ['soma', 'cannatonic'], ['buddies', 'identity'], ['soma', 'cannatonic', 'identity']],
  blueberry: [['blueberry', 'hso2017'], ['blueberry', 'hso-blue', 'hso-cbd'], ['buddies', 'identity'], ['blueberry', 'hso2017', 'identity']],
  'white-widow': [['black-widow', 'trikoma'], ['black-widow', 'trikoma'], ['black-widow', 'buddies'], ['black-widow', 'trikoma', 'identity']],
  cookies: [['identity'], ['identity', '=botany-diversity-f1f2'], ['=botany-gelato-sherbinskis-2026', 'identity'], ['=botany-gelato-sherbinskis-2026', 'identity']],
  gelato: [['=botany-gelato-sherbinskis-2026'], ['=botany-gelato-sherbinskis-2026'], ['=botany-gelato-sherbinskis-2026'], ['=botany-gelato-sherbinskis-2026', 'identity']],
  'cbd-hybrids': [['cannatonic', 'therapy'], ['cannatonic', 'therapy'], ['therapy', 'buddies'], ['cannatonic', 'therapy', 'identity']],
};
for (const [name, refs] of Object.entries(bySection)) {
  const review = all.get(`record-variety-${name}`);
  review.patch.sections.forEach((item, index) => { item.sourceIds = refs[index].map(ref => ref.startsWith('=') ? ref.slice(1) : `botany-variety-${ref}`); });
  review.patch.sourceIds = [...new Set([...review.patch.sections.flatMap(item => item.sourceIds), ...review.patch.diagram.sourceIds])];
  review.findings.push('Contre-lecture du coordinateur : références réparties par section ; détails techniques de collecte retirés de la lecture publique, incertitudes historiques conservées.');
}
const genetics = all.get('ref-genetique-heredite');
genetics.patch.sections[1].sourceIds = ['botany-diversity-f1f2', 'botany-diversity-lynch2025'];
genetics.patch.sourceIds = [...new Set(genetics.patch.sections.flatMap(item => item.sourceIds))];
for (const [n, batch] of batches) await writeFile(`${dir}/batches/botany-0${n}.json`, JSON.stringify(batch, null, 2) + '\n');
await writeFile(`${dir}/cross-reviews/botany-coordinator.json`, JSON.stringify({ date: '2026-11-14', entriesRead: [...all.keys()], finalApproval: false, findings: ['23 fiches relues intégralement, y compris tous les paragraphes, faits, légendes et diagrammes.', 'Distinctions biologiques cohérentes ; quatre chronologies/généalogies restent bloquées.', 'Sources de sections des dix variétés resserrées ; procédés internes de consultation supprimés du texte de lecture.', 'Image trichomes Figure 12 inspectée : photographies A–D, mesures E–F et unités confirmées.', 'Validation finale attend contrôles visuels restants, termes et références sensibles.'] }, null, 2) + '\n');
