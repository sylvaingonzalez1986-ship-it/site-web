"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
import type { KqSchoolSnapshot } from '@/lib/kanab-quest-school';
import type { KqSchoolSource } from '@/lib/kanab-quest-school-content';
import { formatKqCash } from '@/lib/kanab-quest-equipment';
import { getKqStaffReconnectHref } from '@/lib/kanab-quest-staff-reauth';
import { resolveKqSchoolSection, type KqSchoolSection } from '@/lib/kanab-quest-school-navigation';
import { KqSchoolHome } from './KqSchoolHome';
import styles from './KqSchool.module.css';

const Tournament = dynamic(() => import('./KqSchoolTournament').then(module => module.KqSchoolTournament), { ssr: false, loading: () => <p role="status">Ouverture du tournoi…</p> });
const Reference = dynamic(() => import('./KqCannabisReference').then(module => module.KqCannabisReference), { ssr: false, loading: () => <p role="status">Ouverture de l’encyclopédie…</p> });
const Rankings = dynamic(() => import('./KqSchoolRankings').then(module => module.KqSchoolRankings), { ssr: false, loading: () => <p role="status">Ouverture du classement…</p> });
export type { KqSchoolSection } from '@/lib/kanab-quest-school-navigation';
/** Retained for archived components, which are no longer mounted by the school. */
export function SchoolSources({ sources }: { sources: readonly KqSchoolSource[] }) {
  return <details><summary>Sources</summary><ul className={styles.sources}>{sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — {source.organization}.</li>)}</ul></details>;
}
export function KqSchool({ initialSection, initialModuleId, initialPassageId, onSectionChange }: {
  initialSection?: KqSchoolSection | 'quiz' | 'workshops'; initialModuleId?: string; initialPassageId?: string;
  onSectionChange: (section: KqSchoolSection, moduleId?: string, passageId?: string) => void;
  onOpenBuddy: (buddyCode: string, moduleId: string, passageId?: string) => void;
  onExit: () => void;
}) {
  const [snapshot, setSnapshot] = useState<KqSchoolSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [reconnectHref, setReconnectHref] = useState('');
  const section = resolveKqSchoolSection(initialSection, initialModuleId, initialPassageId);
  const chapterTitle = useRef<HTMLSpanElement>(null);
  const previousSection = useRef(section);
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    // The clicked furniture/tab disappears. Resume before the destination controls.
    chapterTitle.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [section]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/arena/placard/school', { cache: 'no-store', signal: controller.signal });
      const payload = await response.json();
      if (response.status === 401) setReconnectHref(getKqStaffReconnectHref(window.location));
      if (!response.ok) throw new Error(payload.error || 'La connexion à QuizzShow est momentanément indisponible.');
      setReconnectHref(''); setSnapshot(payload as KqSchoolSnapshot);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Connexion interrompue. Réessaie pour retrouver ta partie.');
    } finally { clearTimeout(timeout); setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const navigate = (next: KqSchoolSection, moduleId?: string, passageId?: string) => onSectionChange(next, moduleId, passageId);
  return <div className={styles.school} data-school>
    <span ref={chapterTitle} id="school-chapter-title" tabIndex={-1} className={styles.screenReaderOnly}>{section === 'home' ? 'Accueil de QuizzShow' : section === 'learn' ? 'Encyclopédie du chanvre' : section === 'ranking' ? 'Classement de QuizzShow' : 'Tournoi du chanvre'}</span>
    {section !== 'home' ? <nav className={styles.tabs} aria-label="Les espaces de QuizzShow">
      <button type="button" onClick={() => navigate('home')} data-school-home-return><ArrowLeft size={20} aria-hidden/>La salle</button>
      {section === 'learn'
        ? <button type="button" onClick={() => navigate('tournament')}><Users size={20} aria-hidden/>Tournoi</button>
        : <button type="button" onClick={() => navigate('learn')}><BookOpen size={20} aria-hidden/>Encyclopédie</button>}
    </nav> : null}
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={() => void load()}>Réessayer la connexion</button></div> : null}
    {reconnectHref ? <a className={styles.buttonLink} href={reconnectHref}>Se reconnecter et reprendre</a> : null}
    {section === 'home' ? <KqSchoolHome onChoose={navigate}/> : section === 'learn' ? <Reference moduleId={initialModuleId} passageId={initialPassageId} onOpen={(module, passage) => navigate('learn', module, passage)} onHome={() => navigate('learn')}/>
      : section === 'ranking' ? loading && !snapshot ? <p role="status">Connexion au classement…</p> : <Rankings ownerId={snapshot?.ownerId} onTournament={() => navigate('tournament')}/>
      : loading && !snapshot ? <p role="status">Connexion à QuizzShow…</p> : <Tournament key={'tournament:'+(snapshot?.ownerId || 'guest')} ownerId={snapshot?.ownerId} onEncyclopedia={() => navigate('learn')} onOpen={(module, passage) => navigate('learn', module, passage)}/>}
    {snapshot && snapshot.totalPaidCents > 0 ? <details><summary>Mes gains déjà reçus</summary><p>{formatKqCash(snapshot.totalPaidCents)} déjà versés.</p></details> : null}
  </div>;
}
