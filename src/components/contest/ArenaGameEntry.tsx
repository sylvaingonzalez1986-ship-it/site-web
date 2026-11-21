'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSyncExternalStore } from 'react';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { ARENA_RELEVE_SCENES } from '@/lib/arena-releve';
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
type EntryProps = { userId: string; betaConnectionKey?: string | null };

function ReadyEntry({ userId, betaConnectionKey }: EntryProps) {
  const { showBanner } = useCookieConsent();
  if (showBanner) return <IntroductionLoading />;
  return <QuarterCharacterGate key={userId} ownerId={userId}>
    <KqBetaWelcome ownerId={userId} connectionKey={betaConnectionKey} />
    <Game draftOwnerId={userId} />
  </QuarterCharacterGate>;
}

/** First arrival leads through the story and character before entering the farm. */
export function ArenaGameEntry(props: EntryProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return <IntroductionLoading />;
  return <ReadyEntry key={props.userId} {...props} />;
}
