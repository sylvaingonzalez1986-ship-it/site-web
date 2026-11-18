'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { createArenaLearningStorage, getArenaLearningEntryScreen, hasSeenArenaIntroduction, readArenaLearningEntryChoice, rememberArenaIntroduction, rememberArenaLearningEntryChoice, type ArenaIntroductionState } from '@/lib/arena-introduction';
import { ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
import { requestedKqWorldMode, type KqWorldMode } from '@/lib/kanab-quest-world-mode';
import { ArenaLearningStorageProvider } from './ArenaLearningStorage';
import { KqBetaWelcome } from '../placard/KqBetaWelcome';
import { QuarterCharacterGate } from './QuarterCharacterGate';
import styles from './ArenaGameEntry.module.css';

function IntroductionLoading() {
  return <div className={styles.loading} data-arena-introduction-loading role="status">
    <Image src={ARENA_RELEVE_SCENES.arrival} alt="" fill sizes="100vw" loading="eager" fetchPriority="high" />
    <span>Ton accueil se prépare…</span>
  </div>;
}

const Game = dynamic(() => import('../placard/PlacardPlayerShell').then(module => module.PlacardPlayerShell), {
  loading: () => <p role="status">Ton quartier se prépare…</p>,
});
const subscribeHydration = () => () => undefined;
type EntryProps = { userId: string; introductionState: ArenaIntroductionState; betaConnectionKey?: string | null; worldMode?: KqWorldMode };
type EntryScreen = 'choice' | 'quarter';

function ReadyEntry({ userId, introductionState, betaConnectionKey, worldMode }: EntryProps) {
  const { showBanner } = useCookieConsent();
  const [storage] = useState(() => createArenaLearningStorage(userId, introductionState === 'seen' && !hasSeenArenaIntroduction(userId)));
  const [preference] = useState(() => readArenaLearningEntryChoice(userId, storage));
  const [requestedGuide] = useState(() => new URLSearchParams(window.location.search).get('guide') === '1');
  const [guideOpen, setGuideOpen] = useState(requestedGuide);
  const [arrivalStarted, setArrivalStarted] = useState(false);
  const [screen, setScreen] = useState<EntryScreen>(() => requestedGuide ? 'quarter' : getArenaLearningEntryScreen(introductionState, hasSeenArenaIntroduction(userId), preference.choice));
  const [warning, setWarning] = useState(preference.storageUnavailable);
  const acknowledged = useRef(false);
  const onReady = useCallback(() => {
    if (acknowledged.current) return;
    acknowledged.current = true;
    rememberArenaIntroduction(userId);
    // Record only the introduction preference. The guide never performs a game action.
    void fetch('/api/arena/tutorial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'introduction', step: 0, status: 'active' }), keepalive: true,
    }).catch(() => undefined);
  }, [userId]);
  const enterGame = useCallback((withGuide = false) => {
    if (!rememberArenaLearningEntryChoice(userId, storage, 'quarter')) setWarning(true);
    onReady();
    setGuideOpen(withGuide);
    setScreen('quarter');
  }, [onReady, storage, userId]);
  const startArrival = () => {
    const url = new URL(window.location.href);
    const requestedWorld = requestedKqWorldMode(url.search);
    url.search = '?view=workshop&guide=1';
    if (requestedWorld) url.searchParams.set('world', requestedWorld);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
    setArrivalStarted(true);
    enterGame(true);
  };

  return <ArenaLearningStorageProvider storage={storage}>
    {showBanner ? <IntroductionLoading /> : <QuarterCharacterGate key={userId} ownerId={userId} onArrivalComplete={startArrival}>
    {screen === 'quarter' ? <>
      <KqBetaWelcome ownerId={userId} connectionKey={betaConnectionKey} />
      <Game draftOwnerId={userId} initialGuideOpen={guideOpen} initialGuideStep={arrivalStarted ? 'zone' : undefined} {...(worldMode ? { worldMode } : {})} />
    </> : <main className={styles.entry} data-arena-entry-choice>
        <picture className={styles.scene}>
          <source media="(max-width: 850px)" srcSet="/contest/releve/arrival-sylvain-portrait-v1.webp" />
          <Image src={ARENA_RELEVE_SCENES.arrival} alt="Loïc t’attend devant la grange aux portes turquoise." fill sizes="100vw" loading="eager" fetchPriority="high" />
        </picture>
        <div className={styles.content}>
          <h1>Bienvenue au Quartier</h1>
          <p className={styles.reply}><span>Loïc</span>« Allez, viens. On a une ferme à faire grandir. »</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} data-entry-guide onClick={() => enterGame(true)}>
              Retrouver ma ferme avec Loïc<ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" data-entry-quarter onClick={() => enterGame()}>Jouer librement</button>
          </div>
          {warning ? <p className={styles.warning} role="status">Ce navigateur ne peut pas mémoriser tes choix. Tu peux continuer à jouer.</p> : null}
        </div>
      </main>}
    </QuarterCharacterGate>}
  </ArenaLearningStorageProvider>;
}

/** First arrival leads through the story and character before entering the farm. */
export function ArenaGameEntry(props: EntryProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return props.introductionState === 'seen' ? <p role="status">Ton quartier se prépare…</p> : <IntroductionLoading />;
  return <ReadyEntry key={props.userId} {...props} />;
}
