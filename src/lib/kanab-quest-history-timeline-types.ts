export type HistoryTimelinePeriod = 'origins' | 'antiquity' | 'medieval' | 'early-modern' | 'nineteenth' | 'twentieth' | 'contemporary';
export type HistoryTimelineTheme = 'plant' | 'textile' | 'culture' | 'medicine' | 'science' | 'policy';

export type HistoryTimelineSource = Readonly<{
  id: string; title: string; author: string; organization: string; published: string; url: string;
  passage: string; access: 'full-text' | 'abstract' | 'catalogue' | 'official-page' | 'excerpt';
  documentKind: string; limitation: string; verifiedAt: string;
}>;

export type HistoryTimelineEvent = Readonly<{
  id: string; year: number; endYear?: number; dateLabel: string; dateNote?: string;
  title: string; place: string; period: HistoryTimelinePeriod; theme: HistoryTimelineTheme;
  summary: string; paragraphs: readonly string[];
  anecdote: Readonly<{ title: string; text: string; sourceIds: readonly string[] }>;
  caution: string; sourceIds: readonly string[]; articleId?: string;
}>;
