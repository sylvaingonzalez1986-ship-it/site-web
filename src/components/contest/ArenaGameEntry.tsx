'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { createArenaLearningStorage, hasSeenArenaIntroduction, markArenaIntroductionCompleted, rememberArenaIntroduction, type ArenaIntroductionState } from '@/lib/arena-introduction';
import { ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
import { ArenaLearningStorageProvider } from './ArenaLearningStorage';
import styles from './ArenaGameEntry.module.css';

function IntroductionLoading() {
  return <div className={styles.loading} data-arena-introduction-loading role="status">
    <Image src={ARENA_RELEVE_SCENES.arrival} alt="" fill sizes="100vw" priority />
    <span>Sylvain t’attend à la ferme…</span>
  </div>;
}

const Story = dynamic(() => import('./ArenaReleve').then(module => module.ArenaReleve), { ssr: false, loading: IntroductionLoading });
const Game = dynamic(() => import('../placard/PlacardPlayerShell').then(module => module.PlacardPlayerShell), {
  loading: () => <p role="status">Ton quartier se prépare…</p>,
});
const subscribeHydration = () => () => undefined;
type EntryProps = { userId: string; introductionState: ArenaIntroductionState };

function ReadyEntry({ userId, introductionState }: EntryProps) {
  const { showBanner } = useCookieConsent();
  const [introductionOpen, setIntroductionOpen] = useState(() => introductionState !== 'seen' && !hasSeenArenaIntroduction(userId));
  const [storage] = useState(() => createArenaLearningStorage(userId, introductionState === 'seen' && !hasSeenArenaIntroduction(userId)));
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
  const enterGame = useCallback(() => setIntroductionOpen(false), []);

  return <ArenaLearningStorageProvider storage={storage}>
    {introductionOpen ? showBanner ? <IntroductionLoading /> : <Story onReady={onReady} onClose={enterGame}
      onCompleted={() => markArenaIntroductionCompleted(storage)} onExplore={enterGame} />
      : <Game draftOwnerId={userId} />}
  </ArenaLearningStorageProvider>;
}

/** Keep the live game unmounted until the first introduction has been shown.
 * The server supplies account history; hydration checks the offline fallback. */
export function ArenaGameEntry(props: EntryProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return props.introductionState === 'seen' ? <p role="status">Ton quartier se prépare…</p> : <IntroductionLoading />;
  return <ReadyEntry key={props.userId} {...props} />;
}
