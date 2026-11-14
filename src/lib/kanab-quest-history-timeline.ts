import { HISTORY_TIMELINE_EARLY_EVENTS, HISTORY_TIMELINE_EARLY_SOURCES } from './kanab-quest-history-timeline-early';
import { HISTORY_TIMELINE_MODERN_EVENTS, HISTORY_TIMELINE_MODERN_SOURCES } from './kanab-quest-history-timeline-modern';
import type { HistoryTimelineEvent, HistoryTimelinePeriod, HistoryTimelineTheme } from './kanab-quest-history-timeline-types';

export const HISTORY_TIMELINE_PERIODS: readonly { id: HistoryTimelinePeriod; label: string }[] = [
  { id: 'origins', label: 'Les origines' },
  { id: 'antiquity', label: 'L’Antiquité' },
  { id: 'medieval', label: 'Le Moyen Âge' },
  { id: 'early-modern', label: 'XVIe–XVIIIe siècles' },
  { id: 'nineteenth', label: 'Le XIXe siècle' },
  { id: 'twentieth', label: 'Le XXe siècle' },
  { id: 'contemporary', label: 'Depuis 2000' },
];
export const HISTORY_TIMELINE_THEMES: Record<HistoryTimelineTheme, string> = {
  plant: 'La plante', textile: 'Fibres et savoir-faire', culture: 'Textes et sociétés',
  medicine: 'Histoire médicale', science: 'Découvertes scientifiques', policy: 'Lois et politiques',
};
export const HISTORY_TIMELINE_EVENTS = [...HISTORY_TIMELINE_EARLY_EVENTS, ...HISTORY_TIMELINE_MODERN_EVENTS]
  .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
export const HISTORY_TIMELINE_SOURCES = [...HISTORY_TIMELINE_EARLY_SOURCES, ...HISTORY_TIMELINE_MODERN_SOURCES];
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');

export function filterHistoryTimeline(events: readonly HistoryTimelineEvent[], period: HistoryTimelinePeriod | 'all', query: string, theme: HistoryTimelineTheme | 'all') {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return events.filter(event => (period === 'all' || event.period === period) && (theme === 'all' || event.theme === theme)
    && words.every(word => normalize([event.dateLabel, event.title, event.place, event.summary, ...event.paragraphs, event.anecdote.title, event.anecdote.text].join(' ')).includes(word)));
}
