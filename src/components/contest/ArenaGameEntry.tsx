'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ArrowRight, KeyRound, Sprout } from 'lucide-react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { createArenaLearningStorage, getArenaLearningEntryScreen, hasSeenArenaIntroduction, markArenaIntroductionCompleted, readArenaLearningEntryChoice, rememberArenaIntroduction, rememberArenaLearningEntryChoice, type ArenaIntroductionState, type ArenaLearningEntryChoice } from '@/lib/arena-introduction';
import { ARENA_RELEVE_CHAPTERS, ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
import { readArenaReleveResume } from '@/lib/arena-releve-session';
import { readArenaQuickTrialResume } from '@/lib/arena-quick-trial';
import { ArenaLearningStorageProvider } from './ArenaLearningStorage';
import styles from './ArenaGameEntry.module.css';

function IntroductionLoading() {
  return <div className={styles.loading} data-arena-introduction-loading role="status">
    <Image src={ARENA_RELEVE_SCENES.arrival} alt="" fill sizes="100vw" priority />
    <span>Ton accueil se prépare…</span>
  </div>;
}

const Story = dynamic(() => import('./ArenaReleve').then(module => module.ArenaReleve), { ssr: false, loading: IntroductionLoading });
const QuickTrial = dynamic(() => import('./ArenaQuickTrial').then(module => module.ArenaQuickTrial), { ssr: false, loading: IntroductionLoading });
const LearningHub = dynamic(() => import('./ArenaLearningHub').then(module => module.ArenaLearningHub), { ssr: false, loading: IntroductionLoading });
const Game = dynamic(() => import('../placard/PlacardPlayerShell').then(module => module.PlacardPlayerShell), {
  loading: () => <p role="status">Ton quartier se prépare…</p>,
});
const subscribeHydration = () => () => undefined;
type EntryProps = { userId: string; introductionState: ArenaIntroductionState };
type EntryScreen = 'choice' | 'quick' | 'story' | 'learning' | 'quarter';

function ReadyEntry({ userId, introductionState }: EntryProps) {
  const { showBanner } = useCookieConsent();
  const [storage] = useState(() => createArenaLearningStorage(userId, introductionState === 'seen' && !hasSeenArenaIntroduction(userId)));
  const [preference] = useState(() => readArenaLearningEntryChoice(userId, storage));
  const [screen, setScreen] = useState<EntryScreen>(() => getArenaLearningEntryScreen(introductionState, hasSeenArenaIntroduction(userId), preference.choice));
  const [warning, setWarning] = useState(preference.storageUnavailable);
  const [storyResume, setStoryResume] = useState(() => readArenaReleveResume(storage));
  const [quickResume, setQuickResume] = useState(() => readArenaQuickTrialResume(storage));
  const acknowledged = useRef(false);
  const onReady = useCallback(() => {
    if (acknowledged.current) return;
    acknowledged.current = true;
    rememberArenaIntroduction(userId);
    // This records only the one-time introduction preference. All playable
    // actions continue to use the tutorial's isolated, local transports.
    void fetch('/api/arena/tutorial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'introduction', step: 0, status: 'active' }), keepalive: true,
    }).catch(() => undefined);
  }, [userId]);
  const choose = useCallback((choice: ArenaLearningEntryChoice) => {
    if (!rememberArenaLearningEntryChoice(userId, storage, choice)) setWarning(true);
    if (choice === 'quarter') onReady();
    setScreen(choice);
  }, [onReady, storage, userId]);
  const enterGame = useCallback(() => choose('quarter'), [choose]);
  const returnToChoice = () => {
    setStoryResume(readArenaReleveResume(storage));
    setQuickResume(readArenaQuickTrialResume(storage));
    setScreen('choice');
  };
  const storyChapter = storyResume && !storyResume.completed ? ARENA_RELEVE_CHAPTERS[storyResume.chapter] : null;
  const quickInProgress = quickResume && !quickResume.completed;

  return <ArenaLearningStorageProvider storage={storage}>
    {screen === 'quarter' ? <Game draftOwnerId={userId} /> : showBanner ? <IntroductionLoading />
      : screen === 'quick' ? <QuickTrial onReady={onReady} onClose={returnToChoice} onOpenQuarter={enterGame} onContinueLearning={() => setScreen('learning')} />
      : screen === 'story' ? <Story onReady={onReady} onClose={returnToChoice} onCompleted={() => markArenaIntroductionCompleted(storage)} onExplore={() => setScreen('learning')} />
      : screen === 'learning' ? <LearningHub onClose={returnToChoice} onOpenQuarter={enterGame} />
      : <main className={styles.entry} data-arena-entry-choice>
        <div className={styles.content}>
          <div className={styles.heading}>
            <h1>{quickInProgress || storyChapter ? 'Reprendre ou jouer' : 'Commencer à jouer'}</h1>
            <p>Essaie le jeu avec Sylvain, ou entre directement dans ton quartier.</p>
          </div>
          <section className={styles.quick} aria-labelledby="entry-quick-title">
            <Sprout size={26} aria-hidden="true" />
            <div><h2 id="entry-quick-title">{quickInProgress ? `Essai en cours · ${quickResume.label}` : 'Ma première récolte'}</h2>
              <p>Une culture déjà installée, jusqu’à la première vente. Temps accéléré, budget fictif.</p>
              <button type="button" className={styles.primary} data-entry-quick onClick={() => choose('quick')}>
                {quickInProgress ? `Reprendre · ${quickResume.label}` : quickResume?.completed ? 'Revoir mon essai' : 'Essayer la première récolte'}<ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
          <div className={styles.alternatives}>
            <section className={styles.alternative} aria-labelledby="entry-quarter-title">
              <div><h2 id="entry-quarter-title">Mon quartier</h2><p>Retrouve ta partie. Les essais restent accessibles dans « Apprendre à jouer ».</p></div>
              <button type="button" data-entry-quarter onClick={enterGame}>Entrer dans mon quartier<ArrowRight size={18} aria-hidden="true" /></button>
            </section>
            <section className={styles.alternative} aria-labelledby="entry-story-title">
              <div><h2 id="entry-story-title">La Relève</h2><p>{storyChapter ? `Chapitre ${storyResume!.chapter + 1} · ${storyChapter.title}` : 'L’histoire complète : reprends la ferme, aménage-la et découvre le quartier.'}</p></div>
              <button type="button" data-entry-story onClick={() => choose('story')}><KeyRound size={18} aria-hidden="true" />{storyChapter ? `Reprendre · ${storyChapter.title}` : storyResume?.completed ? 'Retrouver ma ferme d’essai' : 'Jouer l’histoire complète'}</button>
            </section>
          </div>
          {warning ? <p className={styles.warning} role="status">Ce navigateur ne peut pas mémoriser tes choix. Tu peux jouer ; garde l’essai ouvert pour conserver ta progression.</p> : null}
        </div>
        <div className={styles.scene}><Image src={ARENA_RELEVE_SCENES.arrival} alt="" fill sizes="(max-width: 850px) 0px, 42vw" priority /></div>
      </main>}
  </ArenaLearningStorageProvider>;
}

/** The first visit offers a choice. Only entering the quarter mounts its live game.
 * Account history and a local preference keep later visits predictable. */
export function ArenaGameEntry(props: EntryProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return props.introductionState === 'seen' ? <p role="status">Ton quartier se prépare…</p> : <IntroductionLoading />;
  return <ReadyEntry key={props.userId} {...props} />;
}
