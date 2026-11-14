import type { CannabisReferenceArticle, CannabisReferenceImage, CannabisReferenceSection, CannabisTopicId } from './kanab-quest-cannabis-reference-types';
import { TERPENE_COMPOUNDS } from './kanab-quest-school-terpenes-compounds';
import { CANNABIS_TERPENE_CARD_IDS } from './kanab-quest-cannabis-terpene-selection';
import { CANNABINOID_COMPOUNDS } from './kanab-quest-school-cannabinoids-compounds';
import { CANNABINOID_STUDIES, CANNABINOID_STUDY_MODEL_LABELS } from './kanab-quest-school-cannabinoids-studies';
import { BOTANY_VARIETIES } from './kanab-quest-school-botany-varieties';
import { HEALTH_ATLAS_ENTRIES } from './kanab-quest-school-health-atlas';
import { HEALTH_PHOTOS } from './kanab-quest-school-health-documents';
import { PRODUCTS_ATLAS, PRODUCTS_REGULATIONS } from './kanab-quest-school-products-tools';

const images: Record<string, CannabisReferenceImage> = {
  plant: { src: '/placard/school/course-plant-v1.webp', alt: 'Planche illustrée du chanvre avec feuilles, racines et structures florales.', caption: 'Cannabis sativa. Illustration de synthèse, sans variété identifiée.' },
  terpenes: { src: '/placard/school/course-molecules-v1.webp', alt: 'Illustration du chanvre et de ses composés aromatiques.', caption: 'Chanvre et composés aromatiques. Illustration de synthèse.' },
  cannabinoids: { src: '/placard/school/course-evidence-v1.webp', alt: 'Illustration du chanvre et de documents scientifiques.', caption: 'Recherche sur le cannabis. Illustration de synthèse.' },
  products: { src: '/placard/school/products/plate-v1.webp', alt: 'Graines, fibres, chènevotte et produits issus du chanvre.', caption: 'Matières issues du chanvre. Illustration de synthèse, sans échelle commune.' },
};
const section = (id: string, title: string, paragraphs: readonly string[], sourceIds: readonly string[]): CannabisReferenceSection => ({ id, title, paragraphs: paragraphs.filter(Boolean), sourceIds });
function record(id: string, topicId: CannabisTopicId, title: string, lead: string, image: CannabisReferenceImage, sections: readonly CannabisReferenceSection[], legacy: { courseId: string; passageId: string }, relatedArticleIds: readonly string[], facts?: CannabisReferenceArticle['facts']): CannabisReferenceArticle {
  return { id, topicId, title, lead, image, sections: sections.filter(item => item.paragraphs.length), sourceIds: [...new Set(sections.flatMap(item => item.sourceIds))], relatedArticleIds, glossaryIds: [], legacyPassages: [legacy], facts };
}
const terpeneFamilies = { 'monoterpene-hydrocarbon': 'Monoterpène hydrocarboné', 'oxygenated-monoterpene': 'Monoterpénoïde oxygéné', 'sesquiterpene-hydrocarbon': 'Sesquiterpène hydrocarboné', 'oxygenated-sesquiterpene': 'Sesquiterpénoïde oxygéné', other: 'Autre famille' };
const selectedTerpenes = new Set<string>(CANNABIS_TERPENE_CARD_IDS);
const models = { 'plant-enzyme': 'Enzymes végétales', 'plant-ecology': 'Écologie végétale', cell: 'Cellules et récepteurs', animal: 'Modèles animaux', human: 'Observations humaines', analytical: 'Analyses chimiques', surveillance: 'Surveillance sanitaire' };
const cannabinoidFamilies = { thc: 'THC', cbd: 'CBD', cbg: 'CBG', cbc: 'CBC', cbn: 'CBN', thcv: 'THCV', cbdv: 'CBDV', 'other-phyto': 'Autres phytocannabinoïdes', endocannabinoid: 'Endocannabinoïdes', emerging: 'Cannabinoïdes émergents' };
function healthImage(id: string): CannabisReferenceImage {
  const photo = HEALTH_PHOTOS.find(item => item.atlasIds.includes(id));
  return photo ? { src: photo.src, alt: photo.alt, caption: `${photo.caption} ${photo.credit}`, sourceUrl: photo.originalUrl, licenseUrl: photo.license } : images.plant;
}

/** Existing scientific records, presented as reference entries without learning tasks. */
export const CANNABIS_REFERENCE_RECORDS: readonly CannabisReferenceArticle[] = [
  ...TERPENE_COMPOUNDS.filter(item => selectedTerpenes.has(item.id)).map(item => record(`record-terpene-${item.id}`, 'terpenes', item.name, item.aroma.description, images.terpenes, [
    section('identity', 'Identité et isomères', [item.isomerNotes, item.identification.statement, ...item.identification.limitations], item.identification.sourceIds),
    section('aroma', 'Odeur', [item.aroma.description, item.aroma.limitations], item.aroma.sourceIds),
    section('cannabis', 'Présence dans le cannabis', item.cannabisEvidence.map(value => value.statement), item.cannabisEvidence.flatMap(value => value.sourceIds)),
    section('plants', 'Autres plantes', item.otherPlants.map(value => `${value.name} : ${value.statement}`), item.otherPlants.flatMap(value => value.sourceIds)),
    section('biology', 'Fonctions biologiques étudiées', item.biology.map(value => `${models[value.model]} : ${value.statement} ${value.limitations}`), item.biology.flatMap(value => value.sourceIds)),
  ], { courseId: 'molecules', passageId: `compound-${item.id}` }, ['ref-terpenes-terpenoides', 'ref-odeur-cannabis'], [
    { label: 'Famille', value: terpeneFamilies[item.family] },
    ...(item.synonyms.length ? [{ label: 'Synonymes', value: item.synonyms.join(' · ') }] : []),
    { label: 'Identification', value: { 'reference-standard': 'Référence analytique', 'ri-ms-supported': 'Attribution appuyée par les données chromatographiques et spectrales', tentative: 'Attribution provisoire', 'not-established': 'Identité non établie' }[item.identification.level] },
  ])),
  ...CANNABINOID_COMPOUNDS.map(item => record(`record-cannabinoid-${item.id}`, 'cannabinoids', item.name, item.identity.statement, images.cannabinoids, [
    section('identity', 'Identité chimique', [item.identity.distinction], item.identity.sourceIds),
    section('occurrence', 'Origine et présence', item.occurrence.map(value => `${value.matrix} : ${value.statement} ${value.limitation}`), item.occurrence.flatMap(value => value.sourceIds)),
    section('human', 'Données humaines', [item.humanEvidence.statement, item.humanEvidence.limitation], item.humanEvidence.sourceIds),
    section('risks', 'Risques et inconnues', [...item.risks, ...item.unknowns], item.sourceIds),
    section('mechanisms', 'Mécanismes étudiés', item.mechanisms.map(value => `${models[value.model]} : ${value.statement} ${value.limitation}`), item.mechanisms.flatMap(value => value.sourceIds)),
  ], { courseId: 'evidence', passageId: `compound-${item.id}` }, ['ref-phytocannabinoides', ...item.studyIds.map(id => `record-study-${id}`)], [
    { label: 'Famille', value: cannabinoidFamilies[item.family] },
    { label: 'Forme', value: { acidic: 'Acide', neutral: 'Neutre', 'lipid-mediator': 'Médiateur lipidique' }[item.form] },
    ...(item.synonyms.length ? [{ label: 'Synonymes', value: item.synonyms.join(' · ') }] : []),
  ])),
  ...BOTANY_VARIETIES.map(item => record(`record-variety-${item.id}`, 'diversity', item.title, item.claimedOrigin, images.plant, [
    section('history', 'Origine et diffusion', [item.documentedPeriod, item.declaredBreeder], item.sourceIds),
    section('parents', 'Parentés annoncées', item.announcedParents, item.sourceIds),
    section('variants', 'Versions et récits', item.variants, item.sourceIds),
    section('evidence', 'Documents et inconnues', [...item.evidence, ...item.unknowns], item.sourceIds),
  ], { courseId: 'plant', passageId: item.id }, ['ref-noms-lignees', 'ref-cultivars-clones'], [{ label: 'Désignation', value: item.family }])),
  ...HEALTH_ATLAS_ENTRIES.map(item => record(`record-health-${item.id}`, 'health', item.commonName, `${item.scientificName}. ${item.taxonomyNote}`, healthImage(item.id), [
    section('context', 'Répartition et contexte', [item.regionNote, ...item.evidence.map(value => `${value.finding} ${value.limitation}`)], item.sourceIds),
    section('signs', 'Organes et signes', [`Organes concernés : ${item.organs.join(', ')}.`, ...item.signs], item.sourceIds),
    section('biology', 'Cycle et dispersion', [item.lifeCycle, ...item.spread, ...item.conditions], item.sourceIds),
    section('identification', 'Identification et confusions', [...item.confusions, ...item.confirmation], item.sourceIds),
    section('management', 'Prévention et gestion', [...item.prevention, ...item.management, ...item.limits], item.sourceIds),
  ], { courseId: 'biodiversity', passageId: `health-atlas-${item.id}` }, ['ref-maladies-chanvre', 'ref-ravageurs-auxiliaires'], [{ label: 'Nom scientifique', value: item.scientificName }])),
  ...PRODUCTS_ATLAS.map(item => record(`record-product-${item.id}`, 'products', item.title, item.principle, images.products, [
    section('origin', 'Matière et origine', [item.plantPart, item.origin], item.sourceIds),
    section('properties', 'Propriétés et usages', [...item.properties, item.marketEvidence], item.sourceIds),
    section('quality', 'Qualité et limites', [...item.limits, ...item.checks], item.sourceIds),
    section('regulations', 'Cadre réglementaire documenté', PRODUCTS_REGULATIONS.filter(value => item.regulationIds.includes(value.id)).flatMap(value => [`${value.territory}, état documentaire du ${value.checkedAt} : ${value.rule}`, ...value.limits]), PRODUCTS_REGULATIONS.filter(value => item.regulationIds.includes(value.id)).flatMap(value => value.sourceIds)),
  ], { courseId: 'profiles', passageId: `products-atlas-${item.id}` }, item.relatedIds.map(id => `record-product-${id}`).concat('ref-origines-formulations'))),
  ...CANNABINOID_STUDIES.map(item => record(`record-study-${item.id}`, 'cannabinoids', item.title, item.results, images.cannabinoids, [
    section('study', 'Étude publiée', [item.population, item.sample, `Publication : ${item.publicationDate}. Observations : ${item.observationDate}.`, item.formulation, item.comparator, item.duration], item.sourceIds),
    section('results', 'Résultats et portée', [item.primaryEndpoint, item.results, item.uncertainty, item.limits], item.sourceIds),
    section('safety', 'Événements indésirables', [item.adverseEvents], item.sourceIds),
    section('publication', 'Publication et financement', [item.funding, item.registration.note, item.cohortNote], item.sourceIds),
  ], { courseId: 'evidence', passageId: `study-${item.id}` }, item.compoundIds.map(id => `record-cannabinoid-${id}`), [{ label: 'Type de recherche', value: CANNABINOID_STUDY_MODEL_LABELS[item.model] }, { label: 'Publication', value: item.publicationDate }])),
];
