import type { HistoryChapter, HistoryTerm } from "./kanab-quest-school-history-types";

export type SchoolEncyclopediaKind = "article" | "term" | "record" | "tool";
export type SchoolEncyclopediaShelf = Readonly<{
  id: string; courseId: string; title: string; description: string; image: string;
  lessonCount: number; tools: readonly Readonly<{ id: string; title: string; summary: string }>[];
}>;
export const SCHOOL_ENCYCLOPEDIA_SHELVES: readonly SchoolEncyclopediaShelf[] = [
  { id: "history", courseId: "history", title: "Histoire", description: "Des vestiges aux archives, examiner les preuves.", image: "/placard/school/course-history-v1.webp", lessonCount: 22, tools: [
    { id: "history-timeline", title: "Frise chronologique", summary: "Distinguer les dates des objets, des événements et des publications." },
    { id: "history-map", title: "Carte des circulations", summary: "Explorer les liens documentés et leurs limites." },
  ] },
  { id: "botany", courseId: "plant", title: "Botanique", description: "Observer les organes, les cycles et la diversité.", image: "/placard/school/course-plant-v1.webp", lessonCount: 16, tools: [
    { id: "botany-dossiers", title: "Variétés et filiations", summary: "Comparer les origines déclarées aux preuves disponibles." },
  ] },
  { id: "terpenes", courseId: "molecules", title: "Terpènes", description: "Relier les odeurs aux molécules et aux mesures.", image: "/placard/school/course-molecules-v1.webp", lessonCount: 20, tools: [
    { id: "terpenes-encyclopedia", title: "Fiches des terpènes", summary: "Consulter les composés et leurs sources." },
    { id: "terpenes-wheel", title: "Roue des odeurs", summary: "Explorer les familles de mots utilisées pour décrire une odeur." },
  ] },
  { id: "cannabinoids", courseId: "evidence", title: "Cannabinoïdes", description: "Distinguer les molécules, les mécanismes et les preuves.", image: "/placard/school/course-evidence-v1.webp", lessonCount: 20, tools: [
    { id: "cannabinoids-register", title: "Registre moléculaire", summary: "Lire les identités, les présences documentées et les inconnues." },
    { id: "cannabinoids-network", title: "Réseau des transformations", summary: "Distinguer les voies biologiques, le métabolisme et les conversions." },
    { id: "cannabinoids-evidence", title: "Preuves et études", summary: "Examiner les modèles et la portée des résultats." },
  ] },
  { id: "cultivation", courseId: "genetics", title: "Modes de culture", description: "Comparer les systèmes selon leurs objectifs et contraintes.", image: "/placard/school/cultivation/greenhouse-v1.webp", lessonCount: 16, tools: [
    { id: "cultivation-compare", title: "Comparer les systèmes", summary: "Séparer l’environnement de culture et le milieu racinaire." },
    { id: "cultivation-greenhouse", title: "Explorer la serre", summary: "Observer les repères d’une serre pédagogique." },
    { id: "cultivation-cases", title: "Dossiers de choix", summary: "Raisonner sur des situations fictives explicites." },
    { id: "cultivation-balance", title: "Bilan fictif", summary: "Comparer énergie, émissions et périmètres." },
    { id: "cultivation-guide", title: "Quel système pour quel objectif ?", summary: "Examiner les questions nécessaires avant de choisir." },
  ] },
  { id: "health", courseId: "biodiversity", title: "Santé des plantes", description: "Observer les signes avant de proposer un diagnostic.", image: "/placard/school/learning/evidence-desk-v1.webp", lessonCount: 16, tools: [
    { id: "health-atlas", title: "Atlas de santé", summary: "Consulter les organismes, les indices et les confusions possibles." },
    { id: "health-photos", title: "Photographies documentées", summary: "Examiner des images de référence avec leurs crédits et leurs limites." },
    { id: "health-investigations", title: "Enquêtes", summary: "Choisir des observations pour éprouver plusieurs hypothèses." },
    { id: "health-authorization", title: "Vérifier un usage autorisé", summary: "Lire une fiche réglementaire datée et sa portée." },
  ] },
  { id: "soil", courseId: "uses", title: "Sol et racines", description: "Relier les propriétés du sol aux observations et aux analyses.", image: "/placard/school/soil/cutaway-v1.webp", lessonCount: 20, tools: [
    { id: "soil-cutaway", title: "Coupe du sol", summary: "Explorer les racines, les pores, les agrégats et les résidus." },
    { id: "soil-network", title: "Relations biologiques", summary: "Examiner les fonctions conditionnelles des organismes." },
    { id: "soil-indicators", title: "Indicateurs du sol", summary: "Lire une mesure, sa méthode et sa limite." },
    { id: "soil-analyses", title: "Comparer deux analyses", summary: "Vérifier les méthodes avant de comparer les valeurs fictives." },
    { id: "soil-inputs", title: "Fonctions des apports", summary: "Distinguer les fonctions recherchées et les limites." },
    { id: "soil-method", title: "Raisonner une décision", summary: "Passer de l’observation à un suivi proportionné." },
  ] },
  { id: "products", courseId: "profiles", title: "Produits et qualité", description: "Suivre les matières, les transformations et les contrôles.", image: "/placard/school/products/plate-v1.webp", lessonCount: 20, tools: [
    { id: "products-atlas", title: "Atlas des produits", summary: "Consulter les matières, les propriétés et les limites." },
    { id: "products-fibres", title: "Parcours des fibres", summary: "Suivre les étapes et les matières du parcours textile." },
    { id: "products-overview", title: "Du végétal au produit", summary: "Relier les grandes fractions végétales aux familles de produits." },
    { id: "products-processes", title: "Distinguer les procédés", summary: "Comparer les principes des opérations sans recette." },
    { id: "products-labels", title: "Lire les étiquettes", summary: "Éprouver les affirmations commerciales." },
    { id: "products-certificate", title: "Certificat d’analyse", summary: "Lire le périmètre d’un certificat fictif." },
    { id: "products-traceability", title: "Enquête de lot", summary: "Retrouver les preuves concernant le produit final." },
    { id: "products-regulations", title: "Règles datées", summary: "Vérifier le cadre réglementaire et ses limites." },
  ] },
  { id: "harvest", courseId: "prevention", title: "Récolte et mesures", description: "Comparer les résultats sans confondre quantité et qualité.", image: "/placard/school/harvest/desk-v1.webp", lessonCount: 18, tools: [
    { id: "harvest-lots", title: "Comparer trois lots", summary: "Choisir une grandeur et conserver la même base de comparaison." },
    { id: "harvest-advice", title: "Conseils à vérifier", summary: "Chercher ce qui confirmerait ou contredirait un conseil." },
    { id: "harvest-results", title: "Résultats recherchés", summary: "Définir ce que signifie une amélioration." },
    { id: "harvest-records", title: "Carnet d’observations", summary: "Conserver le contexte et les données nécessaires." },
    { id: "harvest-trials", title: "Dossiers d’essai", summary: "Distinguer une différence observée d’un effet démontré." },
    { id: "harvest-plan", title: "Plan de comparaison", summary: "Préparer une comparaison interprétable." },
    { id: "harvest-workshop", title: "Enquête sur la qualité", summary: "Éprouver des hypothèses sur une situation fictive." },
  ] },
];

export type SchoolEncyclopediaEntry = Readonly<{
  id: string; courseId: string; shelfId: string; passageId: string; kind: SchoolEncyclopediaKind;
  title: string; summary: string; searchText: string; minutes?: number;
}>;
export type SchoolEncyclopediaChapter = Readonly<{
  id: string; shelfId: string; title: string; articleIds: readonly string[];
}>;
export type SchoolEncyclopediaIndex = Readonly<{
  entries: readonly SchoolEncyclopediaEntry[]; chapters: readonly SchoolEncyclopediaChapter[];
  articleCount: number; termCount: number; recordCount: number; toolCount: number;
}>;
export const normalizeSchoolSearch = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("fr").replace(/œ/g, "oe").replace(/æ/g, "ae")
  .replace(/α/g, " alpha ").replace(/β/g, " beta ").replace(/γ/g, " gamma ").replace(/δ/g, " delta ")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

export const schoolEncyclopediaLetter = (title: string) => {
  const letter = normalizeSchoolSearch(title).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "#";
};

export function buildSchoolEncyclopediaIndex(courses: readonly Readonly<{ shelfId: string; chapters: readonly HistoryChapter[]; terms: readonly HistoryTerm[] }>[], records: readonly Readonly<{ shelfId: string; passageId: string; title: string; summary: string; text: string }>[] = []): SchoolEncyclopediaIndex {
  const entries: SchoolEncyclopediaEntry[] = [];
  const chapters: SchoolEncyclopediaChapter[] = [];
  for (const course of courses) {
    const shelf = SCHOOL_ENCYCLOPEDIA_SHELVES.find(item => item.id === course.shelfId);
    if (!shelf) throw new Error(`Unknown school shelf: ${course.shelfId}`);
    const add = (passageId: string, kind: SchoolEncyclopediaKind, title: string, summary: string, text: string, minutes?: number) => entries.push({
      id: `${shelf.id}:${kind}:${passageId}`, courseId: shelf.courseId, shelfId: shelf.id, passageId, kind, title, summary, minutes,
      searchText: normalizeSchoolSearch(`${shelf.title} ${title} ${summary} ${text}`),
    });
    for (const chapter of course.chapters) {
      chapters.push({ id: chapter.id, shelfId: shelf.id, title: chapter.title, articleIds: chapter.lessons.map(lesson => `${shelf.id}:article:${lesson.id}`) });
      for (const lesson of chapter.lessons) add(lesson.id, "article", lesson.title, lesson.question,
        [chapter.title, lesson.objective, ...lesson.essential.map(block => block.text), lesson.example.text, ...lesson.deeper.map(block => block.text)].join(" "), lesson.minutes);
    }
    for (const term of course.terms) add(term.id, "term", term.term, term.definition, "");
    for (const tool of shelf.tools) add(tool.id, "tool", tool.title, tool.summary, "");
  }
  for (const record of records) {
    const shelf = SCHOOL_ENCYCLOPEDIA_SHELVES.find(item => item.id === record.shelfId);
    if (!shelf) throw new Error(`Unknown school record shelf: ${record.shelfId}`);
    entries.push({ id: `${shelf.id}:record:${record.passageId}`, shelfId: shelf.id, courseId: shelf.courseId, passageId: record.passageId,
      kind: "record", title: record.title, summary: record.summary, searchText: normalizeSchoolSearch(`${shelf.title} ${record.title} ${record.summary} ${record.text}`) });
  }
  return { entries, chapters, articleCount: entries.filter(item => item.kind === "article").length, termCount: entries.filter(item => item.kind === "term").length, recordCount: records.length, toolCount: entries.filter(item => item.kind === "tool").length };
}

// The nine rich curricula are loaded only when the reader opens the encyclopedia.
// No private quiz answers, progress API, or copy of the scientific content is introduced.
let indexPromise: Promise<SchoolEncyclopediaIndex> | undefined;
export function loadSchoolEncyclopediaIndex(): Promise<SchoolEncyclopediaIndex> {
  return indexPromise ??= Promise.all([
    import("./kanab-quest-school-history-early"), import("./kanab-quest-school-history-modern"),
    import("./kanab-quest-school-botany-foundations"), import("./kanab-quest-school-botany-diversity"),
    import("./kanab-quest-school-terpenes-lessons"), import("./kanab-quest-school-cannabinoids-lessons"),
    import("./kanab-quest-school-cultivation-lessons"), import("./kanab-quest-school-health-lessons"),
    import("./kanab-quest-school-soil-lessons"), import("./kanab-quest-school-products-lessons"), import("./kanab-quest-school-harvest-lessons"),
    import("./kanab-quest-school-terpenes-compounds"), import("./kanab-quest-school-cannabinoids-compounds"),
    import("./kanab-quest-school-botany-varieties"), import("./kanab-quest-school-health-atlas"), import("./kanab-quest-school-products-tools"),
  ]).then(([early, modern, foundations, diversity, terpenes, cannabinoids, cultivation, health, soil, products, harvest, terpeneRecords, cannabinoidRecords, varieties, healthRecords, productRecords]) => buildSchoolEncyclopediaIndex([
    { shelfId: "history", chapters: [...early.HISTORY_EARLY_CHAPTERS, ...modern.HISTORY_MODERN_CHAPTERS], terms: [...early.HISTORY_EARLY_TERMS, ...modern.HISTORY_MODERN_TERMS] },
    { shelfId: "botany", chapters: [...foundations.BOTANY_FOUNDATIONS_CHAPTERS, ...diversity.BOTANY_DIVERSITY_CHAPTERS], terms: [...foundations.BOTANY_FOUNDATIONS_TERMS, ...diversity.BOTANY_DIVERSITY_TERMS] },
    { shelfId: "terpenes", chapters: terpenes.TERPENE_CHAPTERS, terms: terpenes.TERPENE_TERMS },
    { shelfId: "cannabinoids", chapters: cannabinoids.CANNABINOID_CHAPTERS, terms: cannabinoids.CANNABINOID_TERMS },
    { shelfId: "cultivation", chapters: cultivation.CULTIVATION_CHAPTERS, terms: cultivation.CULTIVATION_TERMS },
    { shelfId: "health", chapters: health.HEALTH_CHAPTERS, terms: health.HEALTH_TERMS },
    { shelfId: "soil", chapters: soil.SOIL_CHAPTERS, terms: soil.SOIL_TERMS },
    { shelfId: "products", chapters: products.PRODUCTS_CHAPTERS, terms: products.PRODUCTS_TERMS },
    { shelfId: "harvest", chapters: harvest.HARVEST_CHAPTERS, terms: harvest.HARVEST_TERMS },
  ], [
    ...terpeneRecords.TERPENE_COMPOUNDS.map(item => ({ shelfId: "terpenes", passageId: `compound-${item.id}`, title: item.name, summary: item.identification.statement, text: [item.synonyms.join(" "), item.isomerNotes, item.aroma.description].join(" ") })),
    ...cannabinoidRecords.CANNABINOID_COMPOUNDS.map(item => ({ shelfId: "cannabinoids", passageId: `compound-${item.id}`, title: item.name, summary: item.identity.statement, text: [item.synonyms.join(" "), item.identity.distinction].join(" ") })),
    ...varieties.BOTANY_VARIETIES.map(item => ({ shelfId: "botany", passageId: item.id, title: item.title, summary: `Origine revendiquée : ${item.claimedOrigin}`, text: [item.family, item.declaredBreeder, ...item.variants].join(" ") })),
    ...healthRecords.HEALTH_ATLAS_ENTRIES.map(item => ({ shelfId: "health", passageId: `health-atlas-${item.id}`, title: item.commonName, summary: `${item.scientificName}. ${item.regionNote}`, text: [item.scientificName, ...item.organs, ...item.signs, item.taxonomyNote].join(" ") })),
    ...productRecords.PRODUCTS_ATLAS.map(item => ({ shelfId: "products", passageId: `products-atlas-${item.id}`, title: item.title, summary: item.principle, text: [item.plantPart, item.origin, ...item.properties].join(" ") })),
  ])).catch(error => { indexPromise = undefined; throw error; });
}

export function searchSchoolEncyclopedia(index: SchoolEncyclopediaIndex, options: { query?: string; shelfId?: string; kind?: SchoolEncyclopediaKind | "all"; page?: number; pageSize?: number }) {
  const query = normalizeSchoolSearch(options.query ?? ""), words = query.split(" ").filter(Boolean);
  const matches = index.entries.filter(entry => (!options.shelfId || options.shelfId === "all" || entry.shelfId === options.shelfId)
    && (!options.kind || options.kind === "all" || entry.kind === options.kind)
    && (!(options.query ?? "").trim() || words.length > 0)
    && words.every(word => entry.searchText.includes(word)));
  const rank = (entry: SchoolEncyclopediaEntry) => {
    const title = normalizeSchoolSearch(entry.title);
    return query ? (title === query ? 3 : title.includes(query) ? 2 : words.every(word => title.includes(word)) ? 1 : 0) : 0;
  };
  matches.sort((a, b) => rank(b) - rank(a) || ({ article: 0, term: 1, record: 2, tool: 3 }[a.kind] - { article: 0, term: 1, record: 2, tool: 3 }[b.kind]) || a.title.localeCompare(b.title, "fr"));
  const pageSize = Math.max(1, Math.min(24, Math.trunc(options.pageSize || 12))), pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.trunc(options.page || 1)));
  return { items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pages };
}
