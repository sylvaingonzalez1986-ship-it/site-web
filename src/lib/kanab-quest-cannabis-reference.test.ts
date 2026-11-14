import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cannabisReferenceTopic, findCannabisReferenceArticle, loadCannabisReferenceCatalog, normalizeCannabisSearch } from './kanab-quest-cannabis-reference';
import { loadSchoolEncyclopediaIndex } from './kanab-quest-school-encyclopedia';

describe('Cannabis reference encyclopedia', () => {
  it('publishes factual articles and detailed records with complete navigation and source references', async () => {
    const catalog = await loadCannabisReferenceCatalog();
    const articles = [...catalog.articles, ...catalog.records];
    const ids = new Set(articles.map(article => article.id));
    const sources = new Set(catalog.sources.map(source => source.id));
    expect(catalog.topics).toHaveLength(9);
    expect(catalog.articles).toHaveLength(52);
    expect(catalog.articles.filter(article => article.topicId === 'history').map(article => article.id)).toEqual(['ref-histoire-culture', 'ref-histoire-politiques']);
    expect(catalog.records).toHaveLength(137);
    expect(catalog.records.filter(article => article.topicId === 'terpenes')).toHaveLength(28);
    expect(ids.size).toBe(articles.length);
    for (const article of articles) {
      expect(catalog.topics.some(topic => topic.id === article.topicId), article.id).toBe(true);
      expect(existsSync('public' + article.image.src), article.image.src).toBe(true);
      expect(article.image.caption, article.id).toBeTruthy();
      expect(Boolean(article.diagram || article.image.kind), `${article.id}: instructional visual`).toBe(true);
      if (article.image.kind) {
        for (const field of ['alt', 'caption', 'author', 'sourceUrl', 'license', 'licenseUrl'] as const) expect(article.image[field], `${article.id}: visual ${field}`).toBeTruthy();
      }
      if (article.diagram) {
        expect(article.diagram.nodes.length, article.id).toBeGreaterThan(1);
        expect(article.diagram.caption, article.id).toBeTruthy();
        for (const source of article.diagram.sourceIds) expect(sources.has(source), `${article.id}: diagram ${source}`).toBe(true);
        if (article.diagram.afterSectionId) expect(article.sections.some(section => section.id === article.diagram!.afterSectionId || section.anchorIds?.includes(article.diagram!.afterSectionId!)), `${article.id}: diagram follows an existing section`).toBe(true);
        for (const node of article.diagram.nodes) if (node.carbonAtoms !== undefined) {
          expect(Number.isInteger(node.carbonAtoms)).toBe(true);
          expect(node.carbonAtoms).toBeGreaterThan(0);
          expect(node.carbonAtoms).toBeLessThanOrEqual(40);
        }
      }
      expect(article.lead, article.id).toBeTruthy();
      expect(article.sourceIds.length, article.id).toBeGreaterThan(0);
      expect(new Set(article.sections.map(section => section.id)).size, article.id).toBe(article.sections.length);
      const anchors = article.sections.flatMap(section => [section.id, ...(section.anchorIds || [])]);
      expect(new Set(anchors).size, `${article.id}: unique legacy anchors`).toBe(anchors.length);
      for (const source of [...article.sourceIds, ...article.sections.flatMap(section => [...section.sourceIds, ...(section.details?.sourceIds || [])])]) expect(sources.has(source), `${article.id}: ${source}`).toBe(true);
      for (const related of article.relatedArticleIds) expect(ids.has(related), `${article.id}: ${related}`).toBe(true);
      for (const section of article.sections) {
        expect(section.sourceIds.some(id => catalog.sources.some(source => source.id === id && source.access !== 'unavailable')), `${article.id}/${section.id}: consulted evidence`).toBe(true);
        if (section.details) {
          expect(section.details.title).toBeTruthy();
          expect(section.details.paragraphs.length).toBeGreaterThan(0);
          expect(section.details.sourceIds.some(id => catalog.sources.some(source => source.id === id && source.access !== 'unavailable')), `${article.id}/${section.id}: details evidence`).toBe(true);
        }
      }
    }
    for (const topic of catalog.topics) {
      expect(existsSync('public' + topic.image), topic.image).toBe(true);
      expect(catalog.articles.some(article => article.topicId === topic.id), topic.id).toBe(true);
    }
  });
  it('redirects every former lesson and record to a factual article, without mounting a course', async () => {
    const [catalog, previous] = await Promise.all([loadCannabisReferenceCatalog(), loadSchoolEncyclopediaIndex()]);
    const lessons = previous.entries.filter(entry => entry.kind === 'article');
    expect(lessons).toHaveLength(168);
    for (const entry of previous.entries.filter(entry => entry.courseId !== 'history' && (entry.kind === 'article' || entry.kind === 'record'))) {
      expect(findCannabisReferenceArticle(catalog, entry.courseId, entry.passageId), `${entry.courseId}/${entry.passageId}`).toBeDefined();
    }
    const destinations = catalog.articles.flatMap(article => article.legacyPassages.map(link => `${link.courseId}/${link.passageId}`));
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(findCannabisReferenceArticle(catalog, 'history', 'history-evidence-1')).toBeUndefined();
    expect(findCannabisReferenceArticle(catalog, 'reference', 'ref-chanvre-bretagne')).toBeUndefined();
  });
  it('removes retired terpene records from the whole catalog and keeps their bookmarks useful', async () => {
    const catalog = await loadCannabisReferenceCatalog();
    for (const id of ['gamma-eudesmol', 'alpha-bergamotene', 'alpha-farnesene', 'beta-fenchol', 'citronellol']) {
      expect(catalog.records.some(article => article.id === `record-terpene-${id}`)).toBe(false);
      expect(findCannabisReferenceArticle(catalog, 'reference', `record-terpene-${id}`)?.id).toBe('ref-terpenes-terpenoides');
      expect(findCannabisReferenceArticle(catalog, 'molecules', `compound-${id}`)?.id).toBe('ref-terpenes-terpenoides');
    }
  });
  it('retains an editorial glossary and supports chemical synonyms and accented searches', async () => {
    const catalog = await loadCannabisReferenceCatalog();
    expect(catalog.terms.length).toBeGreaterThan(50);
    expect(catalog.terms.length).toBeLessThan(300);
    expect(new Set(catalog.terms.map(term => term.id)).size).toBe(catalog.terms.length);
    for (const term of catalog.terms) expect(catalog.articles.some(article => article.id === term.articleId && article.glossaryIds.includes(term.id)), term.id).toBe(true);
    expect(normalizeCannabisSearch('Œuvre, α-pinène et β−caryophyllène')).toBe(normalizeCannabisSearch('oeuvre alpha pinene et beta caryophyllene'));
    expect(normalizeCannabisSearch('FÉCONDATION')).toBe('fecondation');
    expect(catalog.records.some(article => article.facts?.some(fact => ['Synonymes', 'Autres noms rencontrés'].includes(fact.label) && /myrcene/i.test(normalizeCannabisSearch(fact.value))))).toBe(true);
    expect(cannabisReferenceTopic('genetics')).toBe('cultivation');
    expect(cannabisReferenceTopic('diversity')).toBe('diversity');
    expect(cannabisReferenceTopic('law')).toBe('quality');
    expect(findCannabisReferenceArticle(catalog, 'law', 'law-3')?.id).toBe('ref-reglementation-produits');
  });
  it('keeps educational completion and activity UI out of every encyclopedia route', () => {
    const parent = readFileSync('src/components/placard/KqSchool.tsx', 'utf8');
    const host = readFileSync('src/components/placard/KqCannabisReference.tsx', 'utf8');
    const reader = readFileSync('src/components/placard/KqCannabisArticle.tsx', 'utf8');
    const hub = readFileSync('src/components/placard/KqSchoolEncyclopedia.tsx', 'utf8');
    expect(parent).toContain("section === 'learn' ? <Reference");
    expect(parent).not.toMatch(/import\(["']\.\/KqSchool(?:History|Botany|Terpenes|Cannabinoids|Cultivation|Health|Soil|Products|Harvest)["']|<KqSchoolLesson/);
    for (const source of [host, reader, hub]) expect(source).not.toMatch(/<KqSchoolCurriculum|<KqSchoolActivity|onComplete=|onReadLesson=|legacyRead=|completedLessons=|curriculum\/progress/);
    const clientData = JSON.parse(readFileSync('src/lib/kanab-quest-cannabis-reviewed.json', 'utf8'));
    expect(Object.keys(clientData).sort()).toEqual(['articles', 'sources', 'terms', 'terpeneCards']);
    expect(JSON.stringify(clientData)).not.toMatch(/"answer"\s*:|"quizPatches"\s*:/);
  });
});
