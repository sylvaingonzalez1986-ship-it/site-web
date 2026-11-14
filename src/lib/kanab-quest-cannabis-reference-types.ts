import type { HistorySource } from './kanab-quest-school-history-types';

export type CannabisTopicId = 'botany' | 'diversity' | 'history' | 'cannabinoids' | 'terpenes' | 'cultivation' | 'health' | 'products' | 'quality';
export type CannabisReferenceImage = Readonly<{ src: string; alt: string; caption: string; sourceUrl?: string; licenseUrl?: string; author?: string; license?: string; kind?: 'photograph' | 'diagram' | 'illustration' }>;
export type CannabisReferenceDiagram = Readonly<{
  kind: 'sequence' | 'comparison' | 'timeline' | 'evidence'; title: string;
  nodes: readonly Readonly<{ label: string; detail: string; carbonAtoms?: number }>[];
  caption: string; sourceIds: readonly string[];
  afterSectionId?: string;
}>;
export type CannabisReferenceSection = Readonly<{
  id: string; title: string; paragraphs: readonly string[]; sourceIds: readonly string[];
  anchorIds?: readonly string[];
  details?: Readonly<{ title: string; paragraphs: readonly string[]; sourceIds: readonly string[] }>;
}>;
export type CannabisReferenceArticle = Readonly<{
  id: string; topicId: CannabisTopicId; title: string; lead: string;
  image: CannabisReferenceImage;
  diagram?: CannabisReferenceDiagram;
  sections: readonly CannabisReferenceSection[];
  sourceIds: readonly string[];
  relatedArticleIds: readonly string[];
  facts?: readonly Readonly<{ label: string; value: string }>[];
  glossaryIds: readonly string[];
  legacyPassages: readonly Readonly<{ courseId: string; passageId: string }>[];
}>;
export type CannabisReferenceTopic = Readonly<{ id: CannabisTopicId; title: string; description: string; image: string }>;
export type CannabisReferenceTerm = Readonly<{ id: string; term: string; definition: string; articleId: string; sourceIds: readonly string[] }>;
export type CannabisReferenceCatalog = Readonly<{
  topics: readonly CannabisReferenceTopic[];
  articles: readonly CannabisReferenceArticle[];
  records: readonly CannabisReferenceArticle[];
  sources: readonly HistorySource[];
  terms: readonly CannabisReferenceTerm[];
}>;
