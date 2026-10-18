"use client";

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, MapPin, RotateCcw, Sprout } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { ARENA_RELEVE_CHAPTERS, ARENA_RELEVE_MEETINGS, ARENA_RELEVE_SCENES, type ArenaReleveMeetingId, type ArenaReleveStage } from '@/lib/arena-releve';
import { advanceArenaReleve, createArenaReleveSession, getArenaReleveProgress, restartArenaReleveChapter } from '@/lib/arena-releve-session';
import { getKqReleveProductionProgress } from '@/lib/kanab-quest-releve-production';
import { getReleveCommerceCash, getReleveCommerceProgress } from '@/lib/kanab-quest-releve-commerce';
import { createReleveMeetingSession } from '@/lib/arena-releve-meeting-session';
import type { ArenaPlayableLessonId } from '@/lib/arena-playable-learning';
import type { ReleveGuideStep } from '@/lib/arena-releve-guide';
import { getReleveProductionGuide } from '@/lib/arena-releve-production-guide';
import { getReleveCommerceGuide, getReleveWorkshopGuide } from '@/lib/arena-releve-commerce-guide';
import { ArenaReleveGuide, ReleveGuideProvider } from './ArenaReleveGuide';
import { ArenaReleveArrival } from './ArenaReleveArrival';
import { ArenaReleveJournal } from './ArenaReleveJournal';
import { useArenaLearningStorage } from './ArenaLearningStorage';
import { KqPlacardNavigation, type PlacardNavKey } from '../placard/KqPlacardNavigation';
import { KqPlacardMap, type PlacardMapOpen } from '../placard/KqPlacardMap';
import placardStyles from '../placard/PlacardPlayerShell.module.css';
import retro from './ArenaRetro.module.css';
import styles from './ArenaReleve.module.css';

const loading = () => <div className={styles.loadingScene} role="status"><Image src="/contest/releve/renovation-sylvain-v1.webp" alt="" fill sizes="100vw" /><span>Ouverture de ton atelier…</span></div>;
const Production = dynamic(() => import('../placard/KqReleveProduction').then(m => m.KqReleveProduction), { ssr: false, loading });
const Commerce = dynamic(() => import('../placard/KqReleveCommerce').then(m => m.KqReleveCommerce), { ssr: false, loading });
const Lesson = dynamic(() => import('./ArenaPlayableLesson').then(m => m.ArenaPlayableLesson), { ssr: false, loading });
const Workshop = dynamic(() => import('../placard/KqReleveWorkshop').then(m => m.KqReleveWorkshop), { ssr: false, loading });
const RENOVATION_ACTIONS = {
  locked: { label: 'Prendre les clés et ouvrir la grange', next: 'opened' },
  opened: { label: 'Vider la grange', next: 'emptied' },
  emptied: { label: 'Rénover tout l’intérieur', next: 'renovated' },
} as const;
const LESSON_TITLES: Partial<Record<ArenaPlayableLessonId, string>> = { bank: 'Le guichet et le livret', investments: 'Le portefeuille fictif', specialties: 'Mon personnage et ses spécialités', missions: 'Mes défis et leurs récompenses', collection: 'Mon pack et mon album' };
const LESSON_ARTWORK: Partial<Record<ArenaPlayableLessonId, string>> = {
  bank: '/placard/bureau-bank-sylvain-v2.webp',
  investments: '/placard/bureau-accounting-sylvain-v2.webp',
  specialties: '/app-character-cropped.png',
  missions: '/contest/mascot/arena-lobby-sylvain-v1.png',
  collection: '/app/lottery/album-booster-mascot-v3.webp',
};
const CHAPTER_PLACES: Record<ArenaReleveStage, string> = {
  arrival: 'La ferme', plan: 'L’Entrepôt', buddies: 'L’Entrepôt', launch: 'Ma culture', culture: 'Ma culture',
  jury: 'Mes récoltes · Jury & duels', delivery: 'Mon commerce', shop: 'Mon commerce · Boutique', ledger: 'Mes finances',
};
const CHAPTER_NAV: Record<ArenaReleveStage, PlacardNavKey> = { arrival: 'hub', plan: 'workshop', buddies: 'workshop', launch: 'game', culture: 'game', jury: 'harvests', delivery: 'market', shop: 'market', ledger: 'treasury' };
const NEXT_ACTIONS: Record<ArenaReleveStage, string> = { arrival: 'Aménager l’entrepôt', plan: 'Choisir mes Buddies', buddies: 'Préparer ma campagne', launch: 'Commencer la culture', culture: 'Rejoindre le jury', jury: 'Aller au marché', delivery: 'Ouvrir ma boutique', shop: 'Passer au bureau', ledger: 'Terminer l’aventure' };
const NEXT_REPLIES: Record<ArenaReleveStage, string> = { arrival: 'La chambre est prête. Passons au plan !', plan: 'Matériel installé ! Choisissons les Buddies de tes zones.', buddies: 'Tes Buddies sont en place. Préparons leur campagne.', launch: 'Tout est prêt. À toi de cultiver !', culture: 'La récolte est là ! Le jury attend tes Fleurs.', jury: 'Verdict reçu ! Retrouvons ton lot au marché.', delivery: 'Première vente ! Donnons maintenant une enseigne à la ferme.', shop: 'La boutique est ouverte. Regardons ce qui reste en caisse.', ledger: 'Le registre se remplit. Tu peux faire vivre ta ferme.' };
const NAV_KEYS: PlacardNavKey[] = ['hub', 'workshop', 'game', 'harvests', 'market', 'treasury', 'collection', 'missions', 'shop'];

function StoryFrame({ title, onClose, children, coach, immersive = false, navigation, label = 'Aventure d’essai · La relève' }: {
  title: string; onClose: () => void; children: ReactNode; coach: ReactNode; immersive?: boolean; navigation?: ReactNode; label?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const gameFrame = Boolean(navigation);
  const [coachHost, setCoachHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const sync = () => {
      const dialogs = Array.from(content.current?.querySelectorAll<HTMLElement>('dialog[open], .contest-pack-opening-modal') ?? []).filter(element => element.getClientRects().length);
      setCoachHost(dialogs.at(-1) ?? null);
    };
    const observer = new MutationObserver(sync);
    if (content.current) observer.observe(content.current, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    sync();
    return () => observer.disconnect();
  }, [gameFrame]);
  return <ReleveGuideProvider><AppDialog open onClose={onClose} title={<span className={styles.frameTitle}><Sprout size={20} aria-hidden="true" /><span>{title}{navigation ? <small>La relève · Partie d’essai</small> : null}</span></span>} label={label}
    className={`${styles.dialog} ${navigation ? styles.gameDialog : ''}`} bodyClassName={`${styles.body} ${immersive ? styles.immersiveBody : navigation ? styles.gameBody : ''}`} headerClassName={`${styles.frameHeader} ${navigation ? styles.gameHeader : ''}`} closeLabel="Mettre l’essai en pause" dialogProps={{ 'data-releve': true }} footer={!coachHost && !gameFrame ? coach : undefined}>
    {navigation ? <div className={`${retro.surface} ${placardStyles.shell} ${styles.gameShell}`}>{navigation}<div ref={content} className={placardStyles.content}>{children}</div></div> : <div ref={content}>{children}</div>}
    {coachHost ? createPortal(<div className={styles.nestedCoach} data-releve-floating-guide>{coach}</div>, coachHost) : null}
    {gameFrame && !coachHost ? <div className={`${styles.nestedCoach} ${styles.screenCoach}`} data-releve-floating-guide>{coach}</div> : null}
  </AppDialog></ReleveGuideProvider>;
}

export function ArenaReleve({ onClose, onCompleted, onExplore, onReady }: { onClose: () => void; onCompleted?: () => void; onExplore?: () => void; onReady?: () => void }) {
  const storage = useArenaLearningStorage();
  const [session] = useState(() => createArenaReleveSession(storage));
  useEffect(() => { onReady?.(); }, [onReady]);
  const { state, storageWarning } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [confirm, setConfirm] = useState<'chapter' | 'all' | null>(null);
  const [generation, setGeneration] = useState(0);
  const [quarter, setQuarter] = useState(false);
  const [warehouseVisit, setWarehouseVisit] = useState(false);
  const [commerceDestination, setCommerceDestination] = useState<'storage' | 'market'>('market');
  const [quarterNotice, setQuarterNotice] = useState('');
  const [highlightedBuilding, setHighlightedBuilding] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const chapter = ARENA_RELEVE_CHAPTERS[state.chapter];
  const isArrival = !state.completed && chapter.stage === 'arrival';
  const progress = getArenaReleveProgress(state);
  const cashCents = state.commerce ? getReleveCommerceCash(state.commerce) : state.production.cashCents;
  const currentNav = CHAPTER_NAV[chapter.stage];
  const canVisitWarehouse = chapter.stage === 'launch' || chapter.stage === 'culture';
  const place = warehouseVisit ? CHAPTER_PLACES.plan : CHAPTER_PLACES[chapter.stage];
  const nextChapter = ARENA_RELEVE_CHAPTERS[state.chapter + 1];
  const nextNav = nextChapter ? CHAPTER_NAV[nextChapter.stage] : null;
  const recommendedBuilding = currentNav === 'game' || currentNav === 'workshop' ? 'warehouse' : currentNav === 'harvests' ? 'arena' : currentNav === 'treasury' ? 'office' : currentNav;
  const unavailable = Object.fromEntries(NAV_KEYS.filter(key => key !== 'hub' && key !== currentNav && !(canVisitWarehouse && key === 'workshop') && !(progress.complete && key === nextNav)).map(key => [key, 'À découvrir dans la suite de La relève.'])) as Partial<Record<PlacardNavKey, string>>;
  useEffect(() => {
    if (chapter.stage === 'arrival') void import('../placard/KqReleveProduction').catch(() => undefined);
    if (chapter.stage === 'jury') void import('../placard/KqReleveCommerce').catch(() => undefined);
  }, [chapter.stage]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest('[data-app-dialog-body]')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [state.chapter, state.completed]);
  const next = () => {
    const result = advanceArenaReleve(state);
    session.update(result);
    setQuarter(false);
    setWarehouseVisit(false);
    setQuarterNotice('');
    if (result.completed) onCompleted?.();
  };
  const resumeCulture = () => { setWarehouseVisit(false); setGeneration(value => value + 1); };
  const navigate = (key: PlacardNavKey) => {
    if (key === 'hub') { setQuarter(true); setQuarterNotice(''); return; }
    if (key === 'workshop' && canVisitWarehouse) { setWarehouseVisit(true); setQuarter(false); setQuarterNotice(''); return; }
    if (key === currentNav) { if (warehouseVisit) resumeCulture(); setQuarter(false); setQuarterNotice(''); return; }
    if (progress.complete && key === nextNav) { next(); return; }
    setQuarterNotice(`Nous découvrirons ce lieu plus tard. Sylvain t’attend : ${CHAPTER_PLACES[chapter.stage]}.`);
  };
  const openMap: PlacardMapOpen = (view, options) => {
    if (view === 'treasury' && options?.treasuryPole === 'bank') {
      setQuarterNotice('Sylvain te présentera la banque après ta première récolte, dans les rencontres du quartier.');
      return;
    }
    navigate(view === 'arena' ? 'harvests' : view);
  };
  const guide: ReleveGuideStep[] = quarter ? [{ id: 'quarter-resume', selector: '[data-releve-resume]', title: place, instruction: 'Ta ferme est sauvegardée. Retrouve-moi pour continuer.' }] : warehouseVisit ? [
    { id: 'warehouse-resume', selector: '[data-warehouse-campaign-action="resume"], [data-warehouse-campaign-action="start"]', title: 'Retour à ta culture', instruction: 'Retrouve ta campagne avec ce bouton, comme dans le jeu.' },
    { id: 'warehouse-cultures', selector: '[aria-label="Mode du plan"] > button:last-child[aria-pressed=false]', title: 'Tes cultures', instruction: 'Passe en mode Cultures pour retrouver ta campagne.' },
  ] : progress.complete || state.completed ? [{ id: 'chapter-complete', selector: '[data-releve-next]:not(:disabled)', title: state.completed ? 'Le quartier t’attend' : chapter.milestone, instruction: state.completed ? 'Ta ferme a ses premières recettes. Viens découvrir les six rencontres du quartier.' : NEXT_REPLIES[chapter.stage] }]
    : chapter.stage === 'arrival' ? [{ id: `arrival-${state.renovation}`, selector: '[data-releve-action="renovate"]', title: 'Bienvenue chez toi !', instruction: state.renovation === 'locked' ? 'Bienvenue chez toi ! Prends les clés.' : state.renovation === 'opened' ? 'Un coup de balai : on vide toute la grange !' : 'On finit le chantier ? Tes 2 000 € restent pour le matériel.' }]
      : chapter.stage === 'delivery' || chapter.stage === 'shop' || chapter.stage === 'ledger' ? state.commerce ? getReleveCommerceGuide(chapter.stage, state.commerce) : []
        : getReleveProductionGuide(chapter.stage, state.production);
  const coach = <ArenaReleveGuide steps={guide} compact complete={!quarter && !warehouseVisit && (progress.complete || state.completed)} instruction={progress.instruction || chapter.coach}>
      {!isArrival && !quarter && !warehouseVisit ? <button type="button" className={styles.primary} data-releve-next disabled={!state.completed && !progress.complete} onClick={state.completed ? onExplore ?? onClose : next}>
        {state.completed ? 'Explorer le quartier' : NEXT_ACTIONS[chapter.stage]}<ArrowRight size={18} aria-hidden="true" />
      </button> : null}
  </ArenaReleveGuide>;
  const journal = <ArenaReleveJournal chapter={chapter} chapterIndex={state.chapter} completed={state.completed} onPause={onClose} onRestartChapter={() => setConfirm('chapter')} onRestartAll={() => setConfirm('all')} />;
  return <>
    <StoryFrame title={isArrival ? 'La relève' : quarter ? 'Mon quartier' : place} onClose={onClose} coach={coach} immersive={isArrival} navigation={!isArrival ? <KqPlacardNavigation active={quarter ? 'hub' : warehouseVisit ? 'workshop' : currentNav} onNavigate={navigate} onHighlight={setHighlightedBuilding} unavailable={unavailable} localNavigation /> : undefined}>
      {!isArrival ? <header className={placardStyles.sectionHeader} data-releve-hud><button type="button" onClick={() => { if (canVisitWarehouse && !warehouseVisit && !quarter) setWarehouseVisit(true); else setQuarter(value => !value); setQuarterNotice(''); }} aria-label={quarter ? 'Revenir à mon activité' : canVisitWarehouse && !warehouseVisit ? 'Retour à l’entrepôt' : 'Retour au quartier'}><ArrowLeft size={18} aria-hidden="true" />{quarter ? 'Mon activité' : canVisitWarehouse && !warehouseVisit ? 'Entrepôt' : 'Quartier'}</button><h1>{quarter ? 'Mon quartier' : place}</h1><details className={styles.storyMenu}><summary aria-label="Registre et options de l’essai"><BookOpen size={20} aria-hidden="true" /></summary><div>{journal}<button type="button" onClick={onClose}>Mettre l’essai en pause</button></div></details></header> : null}
      {storageWarning ? <p className={styles.warning} role="status">{storageWarning}</p> : null}
      {quarter ? <section className={styles.quarter} data-releve-quarter><div className={styles.resumeTask}><MapPin size={18} aria-hidden="true" /><div><small>Ton objectif en cours</small><strong>{chapter.title}</strong></div><button type="button" data-releve-resume onClick={() => setQuarter(false)}>Reprendre<ArrowRight size={17} aria-hidden="true" /></button></div>{quarterNotice ? <p role="status" className={styles.warning}>{quarterNotice}</p> : null}<KqPlacardMap isolated cashCents={cashCents} tents={1} activeRun={!!state.production.game && state.production.game.phase !== 'complete'} recommended={recommendedBuilding} highlightedBuilding={highlightedBuilding} onOpen={openMap} onOpenCollection={() => navigate('collection')} /></section> : null}
      {warehouseVisit && !quarter ? <Production chapter="plan" state={state.production} onChange={production => session.update(current => ({ ...current, production }))} onOpenCulture={resumeCulture} /> : null}
      <div hidden={quarter || warehouseVisit} className={isArrival ? styles.immersiveActivity : styles.activity} data-releve-activity>
      {!isArrival ? <h2 ref={heading} tabIndex={-1} className={styles.activityHeading}>{state.completed ? 'Le registre se remplit.' : chapter.title}</h2> : null}
      {state.completed ? <section className={styles.completion}><div className={styles.completionScene}><Image src={ARENA_RELEVE_SCENES.packing} alt="Sylvain t’accompagne pour ta première livraison, dans la chambre de culture rénovée." width={1536} height={1024} sizes="(max-width:700px) 100vw, 1100px" /><div><Check size={24} aria-hidden="true" /><h3>Ta ferme a pris vie.</h3><p>Le quartier t’attend pour la suite.</p></div></div><details className={styles.why}><summary><Check size={17} aria-hidden="true" />9 chapitres accomplis</summary><ul>{ARENA_RELEVE_CHAPTERS.map(item => <li key={item.id}><Check size={17} aria-hidden="true" />{item.milestone}</li>)}</ul></details><details className={styles.why}><summary>Retrouver mon registre et mes comptes</summary>{state.commerce ? <Commerce chapter="ledger" state={state.commerce} onChange={commerce => session.update(current => ({ ...current, commerce }))} /> : null}</details></section>
        : <div className={`${styles.workspace} ${isArrival ? styles.immersiveWorkspace : ''}`} data-releve-workspace key={`${chapter.stage}:${generation}`}>
          {chapter.stage === 'arrival' ? <ArenaReleveArrival renovation={state.renovation} onRenovate={() => session.update(current => ({ ...current, renovation: RENOVATION_ACTIONS[current.renovation as keyof typeof RENOVATION_ACTIONS]?.next ?? current.renovation }))} onContinue={next} toolbar={journal} cashCents={cashCents} />
            : chapter.stage === 'delivery' || chapter.stage === 'shop' || chapter.stage === 'ledger' ? state.commerce && <Commerce chapter={chapter.stage} initialDestination={chapter.stage === 'delivery' ? commerceDestination : undefined} state={state.commerce} onChange={commerce => session.update(current => ({ ...current, commerce }))} />
              : <Production embedded chapter={chapter.stage} state={state.production} onChange={production => session.update(current => ({ ...current, production }))}
                onOpenCulture={() => { if (chapter.stage === 'buddies' && progress.complete) next(); else setWarehouseVisit(false); }}
                onOpenWarehouse={() => setWarehouseVisit(true)} onOpenArena={() => { if (chapter.stage === 'culture' && progress.complete) next(); }}
                onOpenMarket={() => { if (chapter.stage === 'jury' && progress.complete) { setCommerceDestination('market'); next(); } }}
                onOpenStorage={() => { if (chapter.stage === 'jury' && progress.complete) { setCommerceDestination('storage'); next(); } }} onOpenGame={resumeCulture} />}
        </div>}
      </div>
    </StoryFrame>
    <AppDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'all' ? 'Recommencer La relève ?' : 'Revenir au début du chapitre ?'} className={styles.confirm}>
      <p>{confirm === 'all' ? 'Le plan, les achats et la récolte de cette aventure d’essai seront remis à zéro.' : 'Tu retrouveras exactement le budget, le matériel et les stocks du début de ce chapitre. Les actions réalisées depuis seront annulées dans cet essai.'}</p>
      <div className={styles.coachActions}><button type="button" onClick={() => setConfirm(null)}>Garder ma progression</button><button type="button" className={styles.primary} onClick={() => { if (confirm === 'all') session.restart(); else session.update(restartArenaReleveChapter); setGeneration(value => value + 1); setQuarter(false); setWarehouseVisit(false); setQuarterNotice(''); setConfirm(null); }}>Recommencer cet essai</button></div>
    </AppDialog>
  </>;
}

export function ArenaReleveMeeting({ meeting, onClose, onCompleted }: { meeting: ArenaReleveMeetingId; onClose: () => void; onCompleted?: () => void }) {
  const definition = ARENA_RELEVE_MEETINGS.find(item => item.id === meeting)!;
  const [lesson, setLesson] = useState<ArenaPlayableLessonId | null>(null);
  const [lessonCoachHost, setLessonCoachHost] = useState<HTMLDivElement | null>(null);
  const lastLesson = useRef<ArenaPlayableLessonId | null>(null);
  useEffect(() => {
    if (lesson) lastLesson.current = lesson;
    else if (lastLesson.current) document.querySelector<HTMLButtonElement>(`[data-releve-open-lesson="${lastLesson.current}"]`)?.focus({ preventScroll: true });
  }, [lesson]);
  const [session] = useState(() => createReleveMeetingSession(meeting));
  const { state: { production, business, completed }, storageWarning } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [restartOpen, setRestartOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [workshopComplete, setWorkshopComplete] = useState(false);
  const finishWorkshop = useCallback(() => setWorkshopComplete(true), []);
  const finishLesson = useCallback((id: ArenaPlayableLessonId) => session.update(current => current.completed.includes(id) ? current : { ...current, completed: [...current.completed, id] }), [session]);
  const complete = meeting === 'expansion' ? getKqReleveProductionProgress('expansion', production).complete
    : meeting === 'business' && business ? getReleveCommerceProgress(business, 'business').complete
      : meeting === 'workshop' ? workshopComplete : definition.lessons.length > 0 && definition.lessons.every(id => completed.includes(id));
  const finish = () => { onCompleted?.(); onClose(); };
  const currentNav: PlacardNavKey = meeting === 'business' ? 'market' : meeting === 'bank' ? 'treasury' : meeting === 'community' ? 'missions' : meeting === 'notebook' ? 'collection' : 'workshop';
  const placeTitle = meeting === 'business' ? 'Mon commerce' : meeting === 'bank' ? 'Mes finances' : meeting === 'community' ? 'Mes objectifs' : meeting === 'notebook' ? 'Mes collections' : 'L’Entrepôt';
  const unavailable = Object.fromEntries(NAV_KEYS.filter(key => key !== 'hub' && key !== currentNav).map(key => [key, 'Ce lieu possède sa propre rencontre dans le quartier.'])) as Partial<Record<PlacardNavKey, string>>;
  const guide: ReleveGuideStep[] = complete ? [{ id: 'meeting-complete', selector: '[data-releve-finish-meeting]', title: 'Une nouvelle corde à ton arc', instruction: 'Tu as essayé les gestes de cette rencontre. Retournons au quartier pour continuer.' }]
    : meeting === 'expansion' ? getReleveProductionGuide('expansion', production)
      : meeting === 'business' && business ? getReleveCommerceGuide('business', business)
        : meeting === 'workshop' ? getReleveWorkshopGuide()
          : definition.lessons.filter(id => !completed.includes(id)).map(id => ({ id: `meeting-${id}`, selector: `[data-releve-open-lesson="${id}"]`, title: LESSON_TITLES[id] ?? definition.title, instruction: 'Ouvre ce dossier. Je te montrerai directement les commandes du jeu, puis ce sera à toi de les utiliser.' }));
  return <>
    <StoryFrame title={placeTitle} label={`Rencontre d’essai : ${definition.title}`} onClose={onClose}
      navigation={<KqPlacardNavigation active={currentNav} localNavigation unavailable={unavailable} onHighlight={() => undefined} onNavigate={key => { if (key === 'hub') onClose(); else if (key === currentNav) setLesson(null); }} />}
      coach={lesson ? <div ref={setLessonCoachHost} /> : <ArenaReleveGuide compact steps={guide} instruction={definition.hint} complete={complete}><div className={styles.coachActions}><button type="button" onClick={onClose}>Retour au quartier</button>{complete ? <button type="button" className={styles.primary} data-releve-finish-meeting onClick={finish}><Check size={18} aria-hidden="true" />Terminer la rencontre</button> : null}</div></ArenaReleveGuide>}>
      <header className={placardStyles.sectionHeader} data-releve-hud><button type="button" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" />Quartier</button><h1>{placeTitle}</h1><details className={styles.storyMenu}><summary aria-label="Les conseils et options de cette rencontre"><BookOpen size={20} aria-hidden="true" /></summary><div><p>{definition.coach}</p><p>{definition.rationale}</p><p>{definition.hint}</p>{meeting === 'expansion' || meeting === 'business' ? <button type="button" onClick={() => setRestartOpen(true)}><RotateCcw size={16} aria-hidden="true" />Recommencer ce dossier prêté</button> : null}</div></details></header>
      {storageWarning ? <p className={styles.warning} role="status">{storageWarning}</p> : null}
      <div data-releve-workspace>
      {lesson ? <Lesson key={lesson} embedded coachContainer={lessonCoachHost} lesson={lesson} onClose={() => setLesson(null)} onCompleted={finishLesson} /> : <>
      {definition.lessons.length > 0 ? <div className={styles.meetingLessons}>{definition.lessons.map((id, index) => <button key={id} type="button" data-releve-open-lesson={id} onClick={() => setLesson(id)}><span className={styles.lessonArtwork}>{LESSON_ARTWORK[id] ? <Image src={LESSON_ARTWORK[id]} alt="" fill sizes="(max-width:700px) 90vw, 600px" /> : null}</span><span className={styles.lessonCaption}><span className={styles.lessonNumber}>{completed.includes(id) ? <Check size={20} aria-hidden="true" /> : index + 1}</span><strong>{LESSON_TITLES[id]}</strong><ArrowRight size={18} aria-hidden="true" /></span></button>)}</div> : null}
      {meeting === 'expansion' ? <Production key={generation} embedded chapter="expansion" state={production} onChange={production => session.update(current => ({ ...current, production }))} /> : null}
      {meeting === 'business' && business ? <Commerce key={generation} chapter="business" state={business} onChange={business => session.update(current => ({ ...current, business }))} /> : null}
      {meeting === 'workshop' ? <Workshop onComplete={finishWorkshop} /> : null}</>}
      </div>
    </StoryFrame>
    <AppDialog open={restartOpen} onClose={() => setRestartOpen(false)} title="Recommencer cette rencontre ?" className={styles.confirm}><p>Le dossier prêté retrouvera son budget et son stock de départ. Les choix de cette rencontre seront effacés ; ta ferme conserve sa propre progression.</p><div className={styles.coachActions}><button type="button" onClick={() => setRestartOpen(false)}>Garder mon dossier</button><button type="button" className={styles.primary} onClick={() => { session.restart(); setGeneration(value => value + 1); setRestartOpen(false); }}>Recommencer le dossier</button></div></AppDialog>
  </>;
}
