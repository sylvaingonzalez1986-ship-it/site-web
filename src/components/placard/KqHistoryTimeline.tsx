"use client";

import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, FlaskConical, Landmark, Leaf, ScrollText, Search, Shirt } from 'lucide-react';
import { AppDialog } from '../ui/AppDialog';
import { HISTORY_TIMELINE_EVENTS, HISTORY_TIMELINE_PERIODS, HISTORY_TIMELINE_SOURCES, HISTORY_TIMELINE_THEMES, filterHistoryTimeline } from '@/lib/kanab-quest-history-timeline';
import type { HistoryTimelineEvent, HistoryTimelinePeriod, HistoryTimelineSource, HistoryTimelineTheme } from '@/lib/kanab-quest-history-timeline-types';
import styles from './KqHistoryTimeline.module.css';

const icons = { plant: Leaf, textile: Shirt, culture: BookOpen, medicine: ScrollText, science: FlaskConical, policy: Landmark };
const sourceById = new Map(HISTORY_TIMELINE_SOURCES.map(source => [source.id, source]));
const accessLabels = { 'full-text': 'Texte consulté', abstract: 'Résumé scientifique', catalogue: 'Notice de collection', 'official-page': 'Page institutionnelle', excerpt: 'Extrait consulté' };

function SourceList({ sources, expanded = false }: { sources: readonly HistoryTimelineSource[]; expanded?: boolean }) {
  return <ol className={styles.sources}>{sources.map(source => <li key={source.id}>
    <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
    <span>{source.documentKind} · {source.author} · {source.published}</span>
    <details open={expanded || undefined}><summary>{source.organization} · {accessLabels[source.access]}</summary>
      <p>{source.passage}</p>{source.limitation ? <p>{source.limitation}</p> : null}
    </details>
  </li>)}</ol>;
}

/** Dates keep chronological order; spacing represents reading space, not elapsed years. */
export function KqHistoryTimeline() {
  const [period, setPeriod] = useState<HistoryTimelinePeriod | 'all'>('all');
  const [theme, setTheme] = useState<HistoryTimelineTheme | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const filterId = useId();
  const eventTitle = useRef<HTMLHeadingElement>(null);
  const events = filterHistoryTimeline(HISTORY_TIMELINE_EVENTS, period, query, theme);
  const selectedEvent = HISTORY_TIMELINE_EVENTS.find(event => event.id === selected);
  const position = events.findIndex(event => event.id === selected);
  const selectedSources = selectedEvent ? [...new Set([...selectedEvent.sourceIds, ...selectedEvent.anecdote.sourceIds])]
    .flatMap(id => sourceById.has(id) ? [sourceById.get(id)!] : []) : [];
  const groups = HISTORY_TIMELINE_PERIODS.map(item => ({ ...item, events: events.filter(event => event.period === item.id) })).filter(item => item.events.length);
  function move(direction: number) {
    const next = events[position + direction];
    if (!next) return;
    setSelected(next.id);
    requestAnimationFrame(() => {
      const heading = eventTitle.current;
      heading?.focus({ preventScroll: true });
      const body = heading?.closest('[data-app-dialog-body]');
      body?.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  function eventRow(event: HistoryTimelineEvent) {
    const Icon = icons[event.theme];
    return <li key={event.id} className={styles.event}>
      <button type="button" className={styles.eventButton} aria-haspopup="dialog"
        aria-label={`${event.dateLabel} : ${event.title}`} data-history-event={event.id} onClick={() => setSelected(event.id)}>
        <span className={styles.date}>{event.dateLabel}</span>
        <span className={styles.node} aria-hidden="true" />
        <span className={styles.eventCopy}>
          <strong>{event.title}</strong>
          <span className={styles.place}><Icon size={16} aria-hidden="true" />{event.place}</span>
          <span>{event.summary}</span>
          <span className={styles.read}>Découvrir l’événement <ArrowRight size={15} aria-hidden="true" /></span>
        </span>
      </button>
    </li>;
  }
  return <section className={styles.timeline} aria-label="Frise historique du chanvre et du cannabis" data-history-timeline>
    <p className={styles.introduction}>Clique sur une date pour découvrir son histoire et son anecdote.</p>
    <p className={styles.count}>{HISTORY_TIMELINE_EVENTS.length} événements documentés · {HISTORY_TIMELINE_SOURCES.length} références</p>
    <details className={styles.filterPanel} data-history-filters>
      <summary>Filtrer les dates</summary>
      <div className={styles.filters}>
      <label htmlFor={`${filterId}-period`}>Période<select id={`${filterId}-period`} value={period} data-history-period onChange={event => setPeriod(event.target.value as HistoryTimelinePeriod | 'all')}>
        <option value="all">Toute l’histoire</option>{HISTORY_TIMELINE_PERIODS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <label htmlFor={`${filterId}-query`}><span><Search size={16} aria-hidden="true" />Chercher dans l’histoire</span>
        <input id={`${filterId}-query`} type="search" value={query} maxLength={120} placeholder="Bretagne, cordages, Baudelaire…" onChange={event => setQuery(event.target.value)} data-history-search />
      </label>
      <label htmlFor={`${filterId}-theme`}>Sujet<select id={`${filterId}-theme`} value={theme} onChange={event => setTheme(event.target.value as HistoryTimelineTheme | 'all')} data-history-theme>
        <option value="all">Tous les sujets</option>{Object.entries(HISTORY_TIMELINE_THEMES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      </div>
    </details>
    <div className={styles.resultLine}><p role="status">{events.length} événement{events.length > 1 ? 's' : ''}</p>
      {period !== 'all' || theme !== 'all' || query ? <button type="button" onClick={() => { setPeriod('all'); setTheme('all'); setQuery(''); }}>Tout afficher</button> : null}
    </div>
    <p className={styles.scale}>Dates espacées pour la lecture, sans échelle de durée.</p>
    {groups.length ? <div className={styles.chronology}>{groups.map(group => <section key={group.id} className={styles.period} aria-labelledby={`${filterId}-${group.id}`}>
      <h3 id={`${filterId}-${group.id}`}>{group.label}</h3>
      <ol>{group.events.map(eventRow)}</ol>
    </section>)}</div> : <p className={styles.empty}>Aucun événement ne correspond à ces filtres. Essaie un autre mot ou affiche toute l’histoire.</p>}
    <details className={styles.bibliography}><summary>Bibliographie · {HISTORY_TIMELINE_SOURCES.length} références</summary>
      <p>Textes d’époque, publications scientifiques, collections de musées et archives patrimoniales. Chaque événement indique les documents qui l’étayent.</p>
      <SourceList sources={HISTORY_TIMELINE_SOURCES} />
    </details>
    <AppDialog open={Boolean(selectedEvent)} onClose={() => setSelected(undefined)}
      title={selectedEvent?.dateLabel} label={selectedEvent ? `${selectedEvent.dateLabel} : ${selectedEvent.title}` : undefined}
      className={styles.dialog} bodyClassName={styles.dialogBody} dialogProps={{ 'data-history-dialog': selectedEvent?.id }}
      footer={<nav className={styles.dialogNav} aria-label="Parcourir les événements">
        <button type="button" disabled={position <= 0} onClick={() => move(-1)} aria-label="Événement précédent"><ArrowLeft size={18} aria-hidden="true" /><span>Précédent</span></button>
        <span aria-live="polite">{position + 1} / {events.length}</span>
        <button type="button" disabled={position < 0 || position >= events.length - 1} onClick={() => move(1)} aria-label="Événement suivant"><span>Suivant</span><ArrowRight size={18} aria-hidden="true" /></button>
      </nav>}>
      {selectedEvent ? <article key={selectedEvent.id} className={styles.story}>
        <p className={styles.location}>{selectedEvent.place} · {HISTORY_TIMELINE_THEMES[selectedEvent.theme]}</p>
        <h3 ref={eventTitle} tabIndex={-1}>{selectedEvent.title}</h3>
        <p className={styles.lead}>{selectedEvent.summary}</p>
        {selectedEvent.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <aside className={styles.anecdote} aria-labelledby={`${filterId}-anecdote`}>
          <h4 id={`${filterId}-anecdote`}>{selectedEvent.anecdote.title}</h4><p>{selectedEvent.anecdote.text}</p>
          <p className={styles.anecdoteSources}>Documenté par {selectedEvent.anecdote.sourceIds.map((id, index) => {
            const source = sourceById.get(id); return source ? <span key={id}>{index ? ' ; ' : ''}<a href={source.url} target="_blank" rel="noreferrer">{source.organization}</a></span> : null;
          })}.</p>
        </aside>
        <details className={styles.context}><summary>Dates et contexte</summary>
          {selectedEvent.dateNote ? <p>{selectedEvent.dateNote}</p> : null}<p>{selectedEvent.caution}</p>
        </details>
        <section className={styles.eventSources}><h4>Sources de cet événement</h4><SourceList sources={selectedSources} /></section>
      </article> : null}
    </AppDialog>
  </section>;
}
