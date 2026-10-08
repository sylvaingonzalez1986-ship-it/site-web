"use client";

import { useEffect, useState } from "react";
import { PackOpeningAnimation } from "../lottery/PackOpeningAnimation";
import { AlbumPage } from "../lottery/AlbumPage";
import { CardDetailModal } from "../lottery/CardDetailModal";
import { KqMissionCenter } from "../placard/KqMissionCenter";
import { KqSupportBoosterShop } from "../placard/KqSupportBoosterShop";
import { createKqTutorialApi, KqTutorialApiProvider } from "../placard/KqTutorialApiContext";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ContestTastingBook } from "./ContestTastingBook";
import { createDiscoveryAlbum, createDiscoveryPack, createDiscoveryTransport, DISCOVERY_NOTEBOOK_ENTRY, DISCOVERY_TIME, type ArenaDiscoveryLesson } from "@/lib/arena-playable-discovery";
import type { ArenaLessonProgress } from "@/lib/arena-playable-learning";
import type { LotteryCollectionCardSlot } from "@/types/lottery";
import styles from "./ArenaPlayableDiscovery.module.css";

function BuddiesLesson({ onProgress }: { onProgress?: (progress: ArenaLessonProgress) => void }) {
  const [opened, setOpened] = useState(false);
  const [view, setView] = useState<"pack" | "album">("pack");
  const [detail, setDetail] = useState<LotteryCollectionCardSlot | null>(null);
  useEffect(() => {
    onProgress?.({ complete: opened, instruction: opened ? "Tes trois cartes d’essai sont rangées. Clique sur une carte de l’album pour la regarder." : "Ouvre le pack d’essai puis révèle les trois cartes. Ce pack est préparé pour apprendre ; il ne prédit pas tes futurs tirages." });
  }, [opened, onProgress]);
  return <div className={styles.collection} data-playable-discovery="collection">
    <nav className={styles.tabs} aria-label="Ton album d’essai"><button type="button" aria-pressed={view === "pack"} onClick={() => setView("pack")}>Mon pack</button><button type="button" aria-pressed={view === "album"} onClick={() => setView("album")}>Mon album · {opened ? 3 : 0} cartes</button></nav>
    <div hidden={view !== "pack"}><PackOpeningAnimation packNumber="Pack d’essai · 3 cartes préparées" onOpen={async () => createDiscoveryPack()} onContinue={() => { setOpened(true); setView("album"); }} /></div>
    {view === "album" ? <AlbumPage page={createDiscoveryAlbum(opened)} onSlotClick={setDetail} onClaimClick={() => undefined} onBurnClick={() => undefined} /> : null}
    {detail ? <CardDetailModal slot={detail} onClose={() => setDetail(null)} /> : null}
  </div>;
}

export function ArenaPlayableDiscovery({ lesson, onProgress, onClose }: { lesson: ArenaDiscoveryLesson; onProgress?: (progress: ArenaLessonProgress) => void; onClose: () => void }) {
  const [transport] = useState(() => createDiscoveryTransport(lesson, onProgress));
  const [api] = useState(() => createKqTutorialApi(transport.request));
  const [missionShop, setMissionShop] = useState(false);
  useEffect(() => { if (lesson !== "collection") onProgress?.(transport.progress()); }, [lesson, onProgress, transport]);
  return <KqTutorialApiProvider api={api}>
    {lesson === "collection" ? <BuddiesLesson onProgress={onProgress} /> : null}
    {lesson === "specialties" ? <ChanvrierProfileEditor profile={null} onClose={onClose} onSaved={() => undefined} /> : null}
    {lesson === "missions" ? <div className={styles.missions} data-playable-discovery="missions">
      <KqMissionCenter onOpen={view => {
        if (view === "shop") setMissionShop(true);
        else onProgress?.({ complete: false, instruction: "Dans cet essai, la première récolte est déjà accomplie : récupère son pack pour découvrir le circuit des récompenses." });
      }} />
      {missionShop ? <KqSupportBoosterShop autoOpen autoClaimWelcome={false} onExit={() => setMissionShop(false)} onOpenCollection={() => onProgress?.({ complete: transport.progress().complete, instruction: "Les cartes gagnées apparaissent dans le pack ouvert. Elles restent dans cet essai." })} /> : null}
    </div> : null}
    {lesson === "notebook" ? <ContestTastingBook entries={[DISCOVERY_NOTEBOOK_ENTRY]} unlocks={[{ entryId: DISCOVERY_NOTEBOOK_ENTRY.id, unlockedAt: DISCOVERY_TIME, source: "purchase" }]}
      viewerProfile={{ pseudo: "Apprenti", createdAt: DISCOVERY_TIME, updatedAt: DISCOVERY_TIME }} badges={[]} isAuthenticated
      seasonLabel="Carnet d’entraînement · notes fictives" initialTrack="regular" initialCategory="indoor" initialEntryId={DISCOVERY_NOTEBOOK_ENTRY.id} onExitTutorial={onClose} /> : null}
  </KqTutorialApiProvider>;
}
