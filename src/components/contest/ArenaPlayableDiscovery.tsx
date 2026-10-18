"use client";

import { useEffect, useState } from "react";
import { PackOpeningFlowModal } from "../account/PackOpeningFlowModal";
import { KqBotteCollection } from "../placard/KqBotteCollection";
import { KqMissionCenter } from "../placard/KqMissionCenter";
import { KqSupportBoosterShop } from "../placard/KqSupportBoosterShop";
import { createKqTutorialApi, KqTutorialApiProvider, useKqTutorialApi } from "../placard/KqTutorialApiContext";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ContestTastingBook } from "./ContestTastingBook";
import { createDiscoveryTransport, DISCOVERY_NOTEBOOK_ENTRY, DISCOVERY_TICKET, DISCOVERY_TIME, type ArenaDiscoveryLesson } from "@/lib/arena-playable-discovery";
import type { ArenaLessonProgress } from "@/lib/arena-playable-learning";
import styles from "./ArenaPlayableDiscovery.module.css";

function BuddiesLesson({ onClose }: { onClose: () => void }) {
  const api = useKqTutorialApi();
  const [view, setView] = useState<"pack" | "album">("pack");
  const [opened, setOpened] = useState(false);
  return <div className={styles.collection} data-playable-discovery="collection">
    {view === "pack" ? <PackOpeningFlowModal inline ticket={DISCOVERY_TICKET} onOpen={async () => {
      const response = await api.request("/api/releve/collection/open", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Le pack est indisponible.");
      setOpened(true); api.notify("kq:collection-updated"); return result;
    }} onClose={() => {
      if (!opened) { onClose(); return; }
      void api.request("/api/releve/collection/continue", { method: "POST" }); setView("album");
    }} /> : <KqBotteCollection initialSection="buddies" onClose={onClose} />}
  </div>;
}

export function ArenaPlayableDiscovery({ lesson, onProgress, onClose }: { lesson: ArenaDiscoveryLesson; onProgress?: (progress: ArenaLessonProgress) => void; onClose: () => void }) {
  const [transport] = useState(() => createDiscoveryTransport(lesson, onProgress));
  const [api] = useState(() => createKqTutorialApi(transport.request));
  const [missionShop, setMissionShop] = useState(false);
  const [missionAlbum, setMissionAlbum] = useState(false);
  useEffect(() => { onProgress?.(transport.progress()); }, [onProgress, transport]);
  return <KqTutorialApiProvider api={api}>
    {lesson === "collection" ? <BuddiesLesson onClose={onClose} /> : null}
    {lesson === "specialties" ? <ChanvrierProfileEditor profile={null} onClose={onClose} onSaved={() => undefined} /> : null}
    {lesson === "missions" ? <div className={styles.missions} data-playable-discovery="missions">
      <KqMissionCenter onOpen={view => {
        if (view === "shop") setMissionShop(true);
        else onProgress?.({ complete: transport.progress().complete, instruction: "Dans cet essai, 15 variétés sont déjà récoltées. Récupère le pack du Jardin des connaisseurs, puis ouvre-le directement depuis son reçu." });
      }} />
      {missionShop ? <KqSupportBoosterShop autoOpen autoClaimWelcome={false} onExit={() => setMissionShop(false)} onOpenCollection={() => { setMissionShop(false); setMissionAlbum(true); }} /> : null}
      {missionAlbum ? <KqBotteCollection onClose={() => setMissionAlbum(false)} /> : null}
    </div> : null}
    {lesson === "notebook" ? <ContestTastingBook entries={[DISCOVERY_NOTEBOOK_ENTRY]} unlocks={[{ entryId: DISCOVERY_NOTEBOOK_ENTRY.id, unlockedAt: DISCOVERY_TIME, source: "purchase" }]}
      viewerProfile={{ pseudo: "Apprenti", createdAt: DISCOVERY_TIME, updatedAt: DISCOVERY_TIME }} badges={[]} isAuthenticated
      seasonLabel="Carnet d’entraînement · notes fictives" initialTrack="regular" initialCategory="indoor" initialEntryId={DISCOVERY_NOTEBOOK_ENTRY.id} onExitTutorial={onClose} /> : null}
  </KqTutorialApiProvider>;
}
