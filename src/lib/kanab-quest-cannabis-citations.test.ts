import { describe, expect, it } from 'vitest';
import { cannabisArticleReferences } from './kanab-quest-cannabis-citations';
import type { CannabisReferenceArticle } from './kanab-quest-cannabis-reference-types';
import type { HistorySource } from './kanab-quest-school-history-types';

const source = (id: string, url: string, access: HistorySource['access'] = 'full-text'): HistorySource => ({
  id, url, title: id, author: 'Auteur', organization: 'Revue', published: '2024', verifiedAt: '2026-11-14',
  passage: `Passage ${id}`, limitation: '', documentKind: 'article', access,
});
const article: CannabisReferenceArticle = {
  id: 'example', topicId: 'terpenes', title: 'Exemple', lead: 'Introduction',
  image: { src: '/example.webp', alt: 'Exemple', caption: 'Exemple' },
  sourceIds: ['old-id', 'new-id', 'missing'],
  sections: [{ id: 'first', title: 'Section', paragraphs: ['Texte'], sourceIds: ['new-id'],
    details: { title: 'Explication', paragraphs: ['Détail'], sourceIds: ['details-only'] } }],
  diagram: { kind: 'comparison', title: 'Comparaison', caption: 'Légende', nodes: [], sourceIds: ['diagram-only'] },
  relatedArticleIds: [], glossaryIds: [], legacyPassages: [],
};

describe('Encyclopedia document citations', () => {
  it('gives aliases of one document the same number, including citations inside details and diagrams', () => {
    const { references, numbers } = cannabisArticleReferences(article, [
      source('old-id', 'https://example.org/paper', 'unavailable'),
      source('new-id', 'https://example.org/paper'),
      source('details-only', 'https://example.org/method'),
      source('diagram-only', 'https://example.org/figure'),
    ]);
    expect(references).toHaveLength(3);
    expect(numbers.get('old-id')).toBe(1);
    expect(numbers.get('new-id')).toBe(1);
    expect(numbers.get('details-only')).toBe(2);
    expect(numbers.get('diagram-only')).toBe(3);
    expect(numbers.has('missing')).toBe(false);
    expect(references[0].access).toBe('full-text');
    expect(references[0].passage).toContain('Passage old-id');
    expect(references[0].passage).toContain('Passage new-id');
  });
  it('keeps different documents from the same publisher separate', () => {
    const { references, numbers } = cannabisArticleReferences(article, [
      source('old-id', 'https://example.org/article?id=1'),
      source('new-id', 'https://example.org/article?id=2'),
    ]);
    expect(references).toHaveLength(2);
    expect(numbers.get('new-id')).toBe(2);
  });
});
