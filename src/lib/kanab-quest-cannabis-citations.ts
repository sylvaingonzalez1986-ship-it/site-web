import type { CannabisReferenceArticle } from './kanab-quest-cannabis-reference-types';
import type { HistorySource } from './kanab-quest-school-history-types';

/** Keep every source ID addressable while displaying a document only once. */
export function cannabisArticleReferences(article: CannabisReferenceArticle, sources: readonly HistorySource[]) {
  const ids = [...new Set([
    ...article.sourceIds,
    ...article.sections.flatMap(section => [...section.sourceIds, ...(section.details?.sourceIds || [])]),
    ...(article.diagram?.sourceIds || []),
  ])];
  const references: HistorySource[] = [];
  const numbers = new Map<string, number>();
  const documents = new Map<string, number>();
  const combine = (a?: string, b?: string) => [...new Set([a, b].filter(Boolean))].join(' ');
  for (const id of ids) {
    const source = sources.find(item => item.id === id);
    if (!source) continue;
    const key = source.url.trim();
    const index = documents.get(key);
    if (index === undefined) {
      documents.set(key, references.length);
      references.push(source);
      numbers.set(id, references.length);
    } else {
      const previous = references[index];
      const preferred = previous.access === 'unavailable' && source.access !== 'unavailable' ? source : previous;
      references[index] = { ...preferred, passage: combine(previous.passage, source.passage), limitation: combine(previous.limitation, source.limitation) };
      numbers.set(id, index + 1);
    }
  }
  return { references, numbers };
}
