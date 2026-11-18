import data from './kanab-quest-hemp-quiz-public-sources.json';
import type { HistorySource } from './kanab-quest-school-history-types';
import type { CannabisReferenceArticle } from './kanab-quest-cannabis-reference-types';

/** Public bibliography only: never import the private authoring bank here. */
export const HEMP_QUIZ_ADDITIONAL_SOURCES: readonly HistorySource[] = data.sources as HistorySource[];
const links: Readonly<Record<string, readonly string[]>> = data.articleSourceIds;
export function withHempQuizReferences(article: CannabisReferenceArticle): CannabisReferenceArticle {
  const additional = links[article.id];
  return additional?.length ? {...article, sourceIds: [...new Set([...article.sourceIds, ...additional])]} : article;
}
