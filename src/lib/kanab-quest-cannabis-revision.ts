import reviewed from './kanab-quest-cannabis-reviewed.json';
import type { CannabisReferenceArticle, CannabisReferenceTerm } from './kanab-quest-cannabis-reference-types';
import type { HistorySource } from './kanab-quest-school-history-types';
import type { TerpeneCompound } from './kanab-quest-school-terpenes-types';

/** Published editorial changes; research remains in encyclopedia-revision and reading revisions in encyclopedia-vulgarisation. */
type ArticleRevision = Partial<CannabisReferenceArticle> & Pick<CannabisReferenceArticle, 'id'>;
type TermRevision = Pick<CannabisReferenceTerm, 'id' | 'definition' | 'sourceIds'>;
const articles = new Map((reviewed.articles as ArticleRevision[]).map(article => [article.id, article]));
const terms = new Map((reviewed.terms as TermRevision[]).map(term => [term.id, term]));
const terpeneCards = new Map((reviewed.terpeneCards as (Partial<TerpeneCompound> & { id: string })[]).map(card => [card.id, card]));
export const CANNABIS_REVIEWED_SOURCES = reviewed.sources as HistorySource[];
export function cannabisArticleRevision(id: string): ArticleRevision | undefined {
  return articles.get(id);
}
export function reviseCannabisArticle(article: CannabisReferenceArticle): CannabisReferenceArticle {
  return { ...article, ...articles.get(article.id), id: article.id };
}
export function reviseCannabisTerm(term: CannabisReferenceTerm): CannabisReferenceTerm {
  return { ...term, ...terms.get(term.id), id: term.id, articleId: term.articleId };
}
export function reviseTerpeneCard(card: TerpeneCompound): TerpeneCompound {
  return { ...card, ...terpeneCards.get(card.id), id: card.id };
}
