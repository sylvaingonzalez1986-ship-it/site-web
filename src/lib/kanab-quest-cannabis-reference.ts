import type { CannabisReferenceArticle, CannabisReferenceCatalog, CannabisReferenceTopic, CannabisTopicId } from './kanab-quest-cannabis-reference-types';
import { CANNABIS_REVIEWED_SOURCES, reviseCannabisArticle, reviseCannabisTerm } from './kanab-quest-cannabis-revision';
import { HEMP_QUIZ_ADDITIONAL_SOURCES, withHempQuizReferences } from './kanab-quest-hemp-quiz-public-sources';

export const CANNABIS_REFERENCE_TOPICS: readonly CannabisReferenceTopic[] = [
  { id: 'botany', title: 'La plante', description: 'Cannabis sativa, organes, fleurs, graines et cycle biologique.', image: '/placard/school/course-plant-v1.webp' },
  { id: 'diversity', title: 'Variétés et génétique', description: 'Populations, cultivars, hérédité et lignées connues.', image: '/placard/school/course-genetics-v1.webp' },
  { id: 'cannabinoids', title: 'Cannabinoïdes', description: 'THC, CBD, autres cannabinoïdes et système endocannabinoïde.', image: '/placard/school/course-evidence-v1.webp' },
  { id: 'terpenes', title: 'Arômes et terpènes', description: 'Molécules odorantes, profils aromatiques et transformations.', image: '/placard/school/course-molecules-v1.webp' },
  { id: 'cultivation', title: 'Culture, sol et nutrition', description: 'Milieux de culture, racines, eau, climat et éléments nutritifs.', image: '/placard/school/cultivation/greenhouse-v1.webp' },
  { id: 'health', title: 'Maladies et ravageurs', description: 'Organismes, symptômes, auxiliaires et facteurs de risque.', image: '/placard/school/soil/cutaway-v1.webp' },
  { id: 'products', title: 'Usages et matériaux', description: 'Graines, huile, fibres, chènevotte, résines et produits transformés.', image: '/placard/school/products/plate-v1.webp' },
  { id: 'quality', title: 'Qualité et réglementation', description: 'Conservation, composition, contaminants et statuts des produits.', image: '/placard/school/harvest/desk-v1.webp' },
  { id: 'history', title: 'Histoire et anecdotes', description: 'Une frise à explorer : usages anciens, savoir-faire bretons, écrivains, découvertes et politiques du cannabis.', image: '/placard/school/course-history-v1.webp' },
];
export const normalizeCannabisSearch = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr')
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/α/g, ' alpha ').replace(/β/g, ' beta ').replace(/γ/g, ' gamma ').replace(/δ/g, ' delta ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

const oldTopics: Readonly<Record<string, CannabisTopicId>> = { plant: 'botany', botany: 'botany', diversity: 'diversity', history: 'history', evidence: 'cannabinoids', cannabinoids: 'cannabinoids', molecules: 'terpenes', terpenes: 'terpenes', genetics: 'cultivation', cultivation: 'cultivation', uses: 'cultivation', soil: 'cultivation', biodiversity: 'health', health: 'health', profiles: 'products', products: 'products', prevention: 'quality', harvest: 'quality', quality: 'quality', law: 'quality' };
export function cannabisReferenceTopic(id?: string): CannabisTopicId | undefined { return id ? oldTopics[id] : undefined; }

let cached: Promise<CannabisReferenceCatalog> | undefined;
export function loadCannabisReferenceCatalog(): Promise<CannabisReferenceCatalog> {
  return cached ??= Promise.all([
    import('./kanab-quest-cannabis-reference-biology'), import('./kanab-quest-cannabis-reference-society'), import('./kanab-quest-cannabis-reference-records'),
    import('./kanab-quest-school-history'), import('./kanab-quest-school-botany'), import('./kanab-quest-school-terpenes'),
    import('./kanab-quest-school-cannabinoids'), import('./kanab-quest-school-cultivation'), import('./kanab-quest-school-health'),
    import('./kanab-quest-school-soil'), import('./kanab-quest-school-products'), import('./kanab-quest-school-harvest'),
    import('./kanab-quest-cannabis-reference-expansion'), import('./kanab-quest-hemp-quiz-expansion-sources'),
  ]).then(([biology, society, records, history, botany, terpenes, cannabinoids, cultivation, health, soil, products, harvest, expansion, expansionSources]) => {
    // New historical trivia articles are independent of the retired methodology courses.
    const factualArticles = [...biology.CANNABIS_BIOLOGY_ARTICLES, ...society.CANNABIS_SOCIETY_ARTICLES].filter(article => article.topicId !== 'history').concat(expansion.CANNABIS_EXPANSION_ARTICLES);
    const availableIds = new Set([...factualArticles, ...records.CANNABIS_REFERENCE_RECORDS].map(article => article.id));
    const articles = factualArticles.map(reviseCannabisArticle).map(withHempQuizReferences).map(article => ({ ...article, relatedArticleIds: article.relatedArticleIds.filter(id => availableIds.has(id)) }));
    const revisedRecords = records.CANNABIS_REFERENCE_RECORDS.map(reviseCannabisArticle).map(withHempQuizReferences);
    const sources = [...history.HISTORY_SOURCES, ...botany.BOTANY_SOURCES, ...terpenes.TERPENE_SOURCES, ...cannabinoids.CANNABINOID_SOURCES, ...cultivation.CULTIVATION_SOURCES, ...health.HEALTH_SOURCES, ...soil.SOIL_SOURCES, ...products.PRODUCTS_SOURCES, ...harvest.HARVEST_SOURCES, ...expansionSources.HEMP_QUIZ_EXPANSION_SOURCES];
    const terms = [...history.HISTORY_TERMS, ...botany.BOTANY_TERMS, ...terpenes.TERPENE_TERMS, ...cannabinoids.CANNABINOID_TERMS, ...cultivation.CULTIVATION_TERMS, ...health.HEALTH_TERMS, ...soil.SOIL_TERMS, ...products.PRODUCTS_TERMS, ...harvest.HARVEST_TERMS];
    // Glossary membership is editorial: only terms attached to the new factual articles.
    const selectedTerms = terms.flatMap(term => {
      const article = articles.find(item => item.glossaryIds.includes(term.id));
      return article ? [{ id: term.id, term: term.term, definition: term.definition, articleId: article.id, sourceIds: term.sourceIds }] : [];
    });
    const revisedTerms = selectedTerms.map(reviseCannabisTerm);
    const usedSources = new Set([...articles, ...revisedRecords].flatMap(article => [...article.sourceIds, ...article.sections.flatMap(section => [...section.sourceIds, ...(section.details?.sourceIds || [])]), ...(article.diagram?.sourceIds || [])]).concat(revisedTerms.flatMap(term => [...term.sourceIds])));
    return { topics: CANNABIS_REFERENCE_TOPICS, articles, records: revisedRecords,
      sources: [...new Map([...sources, ...CANNABIS_REVIEWED_SOURCES, ...HEMP_QUIZ_ADDITIONAL_SOURCES].filter(source => usedSources.has(source.id)).map(source => [source.id, source])).values()],
      terms: revisedTerms.sort((a, b) => a.term.localeCompare(b.term, 'fr')) };
  }).catch(error => { cached = undefined; throw error; });
}

export function findCannabisReferenceArticle(catalog: CannabisReferenceCatalog, courseId?: string, passageId?: string): CannabisReferenceArticle | undefined {
  if (!passageId) return undefined;
  const all = [...catalog.articles, ...catalog.records];
  const direct = all.find(article => article.id === passageId);
  if (direct) return direct;
  const legacy = all.find(article => article.legacyPassages.some(link => link.courseId === courseId && link.passageId === passageId));
  if (legacy) return legacy;
  // Retired inventory bookmarks lead to a general article, without republishing a removed card.
  if (passageId.startsWith('record-terpene-') || (courseId === 'molecules' && passageId.startsWith('compound-'))) return all.find(article => article.id === 'ref-terpenes-terpenoides');
  if (courseId === 'law' && passageId.startsWith('law-')) return all.find(article => article.id === 'ref-reglementation-produits');
  const term = catalog.terms.find(item => item.id === passageId);
  return term ? all.find(article => article.id === term.articleId) : undefined;
}
