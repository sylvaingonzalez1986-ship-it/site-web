import { describe, expect, it } from 'vitest';
import { HISTORY_TIMELINE_EVENTS as events, HISTORY_TIMELINE_SOURCES as sources, HISTORY_TIMELINE_PERIODS as periods, filterHistoryTimeline } from './kanab-quest-history-timeline';

describe('History timeline evidence and browsing', () => {
  it('publishes dated events and traceable anecdotes in chronological order', () => {
    expect(events.length).toBeGreaterThanOrEqual(28);
    expect(new Set(events.map(event => event.id)).size).toBe(events.length);
    const sourceIds = new Set(sources.map(source => source.id));
    expect(sourceIds.size).toBe(sources.length);
    expect(events.map(event => event.year)).toEqual(events.map(event => event.year).sort((a, b) => a - b));
    expect(periods.flatMap(period => events.filter(event => event.period === period.id).map(event => event.year))).toEqual(events.map(event => event.year));
    for (const event of events) {
      expect(periods.some(period => period.id === event.period), event.id).toBe(true);
      expect(event.year, event.id).not.toBe(0);
      if (event.endYear !== undefined) expect(event.endYear, event.id).toBeGreaterThanOrEqual(event.year);
      expect(event.paragraphs.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.anecdote.sourceIds.length, event.id).toBeGreaterThan(0);
      expect(event.sourceIds.length, event.id).toBeGreaterThan(0);
      for (const id of [...event.sourceIds, ...event.anecdote.sourceIds]) expect(sourceIds.has(id), `${event.id}: ${id}`).toBe(true);
      expect(event.caution, event.id).toBeTruthy();
    }
    for (const source of sources) {
      expect(new URL(source.url).protocol, source.id).toBe('https:');
      expect(source.passage, source.id).toBeTruthy();
      expect(source.verifiedAt, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('combines text, period and subject without dropping dates or changing their order', () => {
    const event = events.find(item => item.period === 'nineteenth')!;
    const matches = filterHistoryTimeline(events, event.period, event.title, event.theme);
    expect(matches.some(item => item.id === event.id)).toBe(true);
    expect(matches.every(item => item.period === event.period && item.theme === event.theme)).toBe(true);
    expect(filterHistoryTimeline(events, 'all', 'ZZZaucuneCorrespondance999', 'all')).toEqual([]);
    expect(filterHistoryTimeline(events, 'all', '', 'all')).toEqual(events);
    expect(filterHistoryTimeline(events, 'all', 'Bretagne', 'all').length).toBeGreaterThan(0);
  });
});
