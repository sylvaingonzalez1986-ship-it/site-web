/** Integrate individually reviewed editorial lots without changing IDs or exposing quiz answers to clients. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
const directory = 'docs/encyclopedia-revision';
const pedagogicalDirectory = 'docs/encyclopedia-vulgarisation';
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const baseline = await read(`${directory}/baseline-catalog.json`);
const quiz = await read(`${directory}/baseline-quiz.json`);
const inventory = await read(`${directory}/inventory.json`);
const originals = new Map([...baseline.articles, ...baseline.records].map(article => [article.id, article]));
const originalTerms = new Map(baseline.terms.map(term => [term.id, term]));
const originalQuiz = new Map(quiz.map(question => [question.id, question]));
const sourceRegistry = new Map(baseline.sources.map(source => [source.id, source]));
const bibliography = new Map();
const actuallyRead = source => source.reviewEvidence?.some(item =>
  !['not-reverified', 'unavailable', 'inaccessible'].includes(item.status) &&
  !['inaccessible', 'unavailable', 'not-read'].includes(item.result));
const articles = new Map(), terms = new Map(), questions = new Map(), reviews = new Map(), cards = new Map();
const pedagogical = existsSync(`${pedagogicalDirectory}/integration.json`);
const validationFile = `${pedagogical ? pedagogicalDirectory : directory}/validation.json`;
const approved = existsSync(validationFile) ? await read(validationFile) : {};
const pilot = pedagogical ? await read(`${pedagogicalDirectory}/pilot.json`) : undefined;
const files = (await readdir(`${directory}/batches`)).filter(file => file.endsWith('.json')).sort();
for (const file of files) {
  const batch = await read(`${pedagogical ? pedagogicalDirectory : directory}/batches/${file}`);
  if (pilot && batch.articles.some(entry => entry.id === pilot.article.id)) {
    batch.articles = batch.articles.map(entry => entry.id === pilot.article.id ? pilot.article : entry);
    const pilotQuestions = new Set(pilot.quizPatches.map(entry => entry.id));
    batch.quizPatches = [...batch.quizPatches.filter(entry => !pilotQuestions.has(entry.id)), ...pilot.quizPatches];
  }
  for (const source of batch.sources || []) {
    for (const field of ['id', 'title', 'author', 'organization', 'published', 'url', 'verifiedAt', 'passage', 'access', 'documentKind']) assert(source[field], `${file}: source ${source.id} missing ${field}`);
    const internalGameSource = source.url.startsWith('/arene/') && baseline.sources.some(item => item.id === source.id && item.url === source.url);
    assert(internalGameSource || ['https:', 'http:'].includes(new URL(source.url).protocol), source.id);
    assert(source.reviewEvidence?.length, `${file}: ${source.id} needs evidence of the actual reading`);
    sourceRegistry.set(source.id, source);
    const prior = bibliography.get(source.id);
    bibliography.set(source.id, { ...source,
      access: actuallyRead(source) || (prior && actuallyRead(prior)) ? source.access : 'unavailable',
      passage: [...new Set([prior?.passage, source.passage].filter(Boolean))].join(' '),
      limitation: [...new Set([prior?.limitation, source.limitation].filter(Boolean))].join(' '),
      reviewEvidence: [...new Map([...(prior?.reviewEvidence || []), ...source.reviewEvidence].map(item => [JSON.stringify(item), item])).values()],
      reviewedBy: [...new Set([...(prior?.reviewedBy || []), batch.domain])], lots: [...new Set([...(prior?.lots || []), file])] });
  }
  for (const review of batch.articles || []) {
    const original = originals.get(review.id);
    assert(original, `${file}: unknown article ${review.id}`);
    assert(!reviews.has(review.id), `${file}: duplicate article review ${review.id}`);
    assert(review.fullyRead, `${file}: ${review.id} has not been fully read`);
    const patch = { ...review.patch, id: review.id };
    // A diagram replaces the old decorative image in the reader; retain its legacy path for cards/bookmarks.
    if (patch.image === null && patch.diagram) delete patch.image;
    for (const field of ['topicId', 'glossaryIds', 'legacyPassages']) if (patch[field] !== undefined) assert.deepEqual(patch[field], original[field], `${review.id}: preserve ${field}`);
    const merged = { ...original, ...patch };
    assert(merged.lead && merged.sections?.length, review.id);
    const anchors = merged.sections.flatMap(section => [section.id, ...(section.anchorIds || [])]);
    assert.equal(new Set(anchors).size, anchors.length, `${review.id}: repeated section anchors`);
    for (const oldSection of original.sections) assert(anchors.includes(oldSection.id), `${review.id}: preserve anchor ${oldSection.id}`);
    for (const section of merged.sections) {
      assert(section.title && section.paragraphs?.length && section.sourceIds?.length, `${review.id}: incomplete section ${section.id}`);
      if (section.details) assert(section.details.title && section.details.paragraphs?.length && section.details.sourceIds?.length, `${review.id}: incomplete details ${section.id}`);
    }
    assert(existsSync('public' + merged.image.src), `${review.id}: missing image ${merged.image.src}`);
    if (merged.image.kind === 'photograph') for (const field of ['alt', 'caption', 'author', 'sourceUrl', 'license', 'licenseUrl']) assert(merged.image[field], `${review.id}: missing photo ${field}`);
    if (merged.diagram) {
      assert(['sequence', 'comparison', 'timeline', 'evidence'].includes(merged.diagram.kind), `${review.id}: diagram kind`);
      assert(merged.diagram.title && merged.diagram.caption && merged.diagram.sourceIds.length && merged.diagram.nodes.length > 1, `${review.id}: incomplete diagram`);
      if (merged.diagram.afterSectionId) assert(anchors.includes(merged.diagram.afterSectionId), `${review.id}: unknown diagram position`);
      for (const node of merged.diagram.nodes) {
        assert(node.label && node.detail, `${review.id}: empty diagram node`);
        if (node.carbonAtoms !== undefined) assert(Number.isInteger(node.carbonAtoms) && node.carbonAtoms > 0 && node.carbonAtoms <= 40, `${review.id}: invalid atom count`);
      }
    }
    articles.set(review.id, patch);
    reviews.set(review.id, { ...review, lot: file, specialist: batch.domain });
  }
  for (const term of batch.termReviews || []) {
    assert(originalTerms.has(term.id), `${file}: unknown term ${term.id}`);
    if (terms.has(term.id)) assert.deepEqual(terms.get(term.id), { id: term.id, definition: term.definition, sourceIds: term.sourceIds }, `${file}: conflicting term ${term.id}`);
    assert(term.definition && term.sourceIds?.length, `${file}: incomplete term ${term.id}`);
    terms.set(term.id, { id: term.id, definition: term.definition, sourceIds: term.sourceIds });
  }
  for (const patch of batch.quizPatches || []) {
    assert(originalQuiz.has(patch.id), `${file}: unknown quiz question ${patch.id}`);
    const merged = { ...originalQuiz.get(patch.id), ...patch };
    assert.equal(merged.options.length, 4, patch.id);
    assert(Number.isInteger(merged.answer) && merged.answer >= 0 && merged.answer <= 3, patch.id);
    assert(originals.has(merged.articleId), `${patch.id}: unknown article`);
    questions.set(patch.id, patch);
  }
  for (const card of batch.cardPatches || []) {
    assert(originals.has(`record-terpene-${card.id}`), `Unknown terpene card ${card.id}`);
    cards.set(card.id, { id: card.id, isomerNotes: card.fields.isomerNotes,
      cannabisEvidence: card.fields.cannabisEvidence.map(evidence => ({ ...evidence, locator: 'Notice encyclopédique révisée et références associées' })),
      sourceIds: card.sourceIds });
  }
}
for (const [id, patch] of articles) {
  const article = { ...originals.get(id), ...patch };
  const sources = [...article.sourceIds, ...article.sections.flatMap(section => [...section.sourceIds, ...(section.details?.sourceIds || [])]), ...(article.diagram?.sourceIds || [])];
  for (const source of sources) assert(sourceRegistry.has(source), `${id}: missing source ${source}`);
  for (const related of article.relatedArticleIds) assert(originals.has(related), `${id}: broken related article ${related}`);
}
for (const term of terms.values()) for (const source of term.sourceIds) assert(sourceRegistry.has(source), `${term.id}: missing source ${source}`);
for (const patch of questions.values()) for (const source of patch.sourceIds || []) assert(sourceRegistry.has(source), `${patch.id}: missing source ${source}`);
for (const entry of inventory.entries) {
  const review = reviews.get(entry.id);
  if (!review) continue;
  entry.verification = 'reviewed';
  entry.rewrite = Object.keys(review.patch).length ? 'integrated' : 'retained-after-review';
  entry.illustration = review.visual?.status || 'pending';
  entry.lot = review.lot;
  entry.responsible = review.specialist;
  entry.sources = [...new Set([...(review.patch.sourceIds || originals.get(entry.id).sourceIds), ...(review.patch.sections || originals.get(entry.id).sections).flatMap(section => [...section.sourceIds, ...(section.details?.sourceIds || [])]), ...(review.patch.diagram?.sourceIds || [])])];
  entry.sourcesReviewed = entry.sources.filter(id => bibliography.has(id) && actuallyRead(bibliography.get(id)));
  entry.sourcesNotReverified = entry.sources.filter(id => !entry.sourcesReviewed.includes(id));
  entry.questions = review.questions;
  entry.quizReviewed = review.quizIdsReviewed || [];
  entry.blockers = review.blockers || [];
  const contentHash = createHash('sha256').update(JSON.stringify(articles.get(entry.id))).digest('hex');
  const validation = approved[entry.id];
  entry.finalValidation = validation?.approved && validation.contentHash === contentHash && !entry.blockers.length && entry.illustration === 'verified'
    ? 'validated' : entry.blockers.length ? 'blocked' : 'pending-coordinator';
}
for (const entry of inventory.glossary) if (terms.has(entry.id)) entry.verification = 'reviewed';
const counts = {
  inventoried: inventory.entries.length,
  reviewed: reviews.size,
  corrected: [...articles.values()].filter(patch => Object.entries(patch).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(originals.get(patch.id)[key]))).length,
  illustrated: [...reviews.values()].filter(review => review.visual?.status === 'verified').length,
  validated: inventory.entries.filter(entry => entry.finalValidation === 'validated').length,
  blocked: inventory.entries.filter(entry => entry.finalValidation === 'blocked').length,
  pending: inventory.entries.filter(entry => entry.finalValidation !== 'validated' && entry.finalValidation !== 'blocked').length,
  glossaryReviewed: terms.size,
  quizReviewed: new Set([...reviews.values()].flatMap(review => review.quizIdsReviewed || [])).size,
  quizCorrected: [...questions.values()].filter(patch => Object.entries(patch).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(originalQuiz.get(patch.id)[key]))).length,
  sourcesRead: [...bibliography.values()].filter(source => source.url.startsWith('http') && actuallyRead(source)).length,
  sourceUrlsRead: new Set([...bibliography.values()].filter(source => source.url.startsWith('http') && actuallyRead(source)).map(source => source.url)).size,
};
if (!process.argv.includes('--check')) {
  await save('src/lib/kanab-quest-cannabis-reviewed.json', { articles: [...articles.values()], terms: [...terms.values()], terpeneCards: [...cards.values()], sources: [...bibliography.values()].map(entry => { const source = { ...entry }; delete source.reviewEvidence; delete source.reviewedBy; delete source.lots; return source; }) });
  await save('src/lib/kanab-quest-hemp-quiz-reviewed.json', [...questions.values()]);
  await save(`${directory}/bibliography.json`, [...bibliography.values()]);
  await save(`${directory}/inventory.json`, inventory);
  await save(`${directory}/coverage.json`, counts);
}
console.log(JSON.stringify(counts, null, 2));
