'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { createArenaLearningStorage, getArenaLearningEntryScreen, hasSeenArenaIntroduction, readArenaLearningEntryChoice, rememberArenaIntroduction, rememberArenaLearningEntryChoice, type ArenaIntroductionState } from '@/lib/arena-introduction';
import { ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
import { ArenaLearningStorageProvider } from './ArenaLearningStorage';
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
type EntryProps = { userId: string; introductionState: ArenaIntroductionState };
type EntryScreen = 'choice' | 'quarter';

function ReadyEntry({ userId, introductionState }: EntryProps) {
  const { showBanner } = useCookieConsent();
  const [storage] = useState(() => createArenaLearningStorage(userId, introductionState === 'seen' && !hasSeenArenaIntroduction(userId)));
  const [preference] = useState(() => readArenaLearningEntryChoice(userId, storage));
  const [requestedGuide] = useState(() => new URLSearchParams(window.location.search).get('guide') === '1');
  const [guideOpen, setGuideOpen] = useState(requestedGuide);
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
  useEffect(() => {
    if (requestedGuide && !showBanner) {
      rememberArenaLearningEntryChoice(userId, storage, 'quarter');
      onReady();
    }
  }, [onReady, requestedGuide, showBanner, storage, userId]);

  return <ArenaLearningStorageProvider storage={storage}>
    {screen === 'quarter' && (!guideOpen || !showBanner) ? <Game draftOwnerId={userId} initialGuideOpen={guideOpen} /> : showBanner ? <IntroductionLoading />
      : <main className={styles.entry} data-arena-entry-choice>
        <picture className={styles.scene}>
          <source media="(max-width: 850px)" srcSet="/contest/releve/arrival-sylvain-portrait-v1.webp" />
          <Image src={ARENA_RELEVE_SCENES.arrival} alt="Sylvain te tend les clés devant la grange de ton grand-père. Son registre et sa lettre t’attendent." fill sizes="100vw" loading="eager" fetchPriority="high" />
        </picture>
        <div className={styles.content}>
          <h1>La ferme de Grand-père</h1>
          <p className={styles.reply}><span>Sylvain</span>« Il t’a laissé les clés. On lui donne une nouvelle vie ? »</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} data-entry-guide onClick={() => enterGame(true)}>
              Reprendre la ferme avec Sylvain<ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" data-entry-quarter onClick={() => enterGame()}>Jouer librement</button>
          </div>
          {warning ? <p className={styles.warning} role="status">Ce navigateur ne peut pas mémoriser tes choix. Tu peux continuer à jouer.</p> : null}
        </div>
      </main>}
  </ArenaLearningStorageProvider>;
}

/** New players choose guided or free play in their own farm. */
export function ArenaGameEntry(props: EntryProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return props.introductionState === 'seen' ? <p role="status">Ton quartier se prépare…</p> : <IntroductionLoading />;
  return <ReadyEntry key={props.userId} {...props} />;
}
