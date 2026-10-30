"use client";

import { useRef, useState } from "react";
import { ArenaJourneyEntry } from "./ArenaJourneyEntry";
import { ArenaPrelaunchCharacter } from "./ArenaPrelaunchCharacter";
import { type ArenaLobbyMode } from "@/lib/arena-lobby";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle } from "@/lib/arena-profile-launcher";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import { ArenaWorldMap } from "./ArenaWorldMap";
import retro from "./ArenaRetro.module.css";
import styles from "./ArenaHome.module.css";

type ArenaHubProps = {
  activitiesLocked?: boolean;
  notebookOpen?: boolean;
  initialMode?: ArenaLobbyMode;
  /** Kept for incoming prelaunch routes; the opening date is now always visible. */
  initialNotice?: boolean;
};

export function ContestArenaHub({ activitiesLocked = false, notebookOpen = true, initialMode = "jouer" }: ArenaHubProps) {
  const profileLauncher = useRef<ArenaProfileLauncherHandle | null>(null);
  const [profileAvailability, setProfileAvailability] = useState<ArenaProfileAvailability>("loading");

  return (
    <main data-world="arena" data-lobby-mode={initialMode} className={`${retro.gameSurface} ${styles.home}`}>
      <header className={styles.topBar}>
        <div className={styles.brand}><h1>L’Arène<span>.</span></h1></div>
        <div className={styles.tools}>
          {activitiesLocked ? <ArenaPrelaunchCharacter launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} /> : <ArenaJourneyEntry launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} />}
        </div>
      </header>

      <section className={styles.activities} aria-label="Activités de l’Arène">
        {activitiesLocked && <div className={styles.intro}>
          <h2>{ARENA_OPENING_MESSAGE}</h2>
          {notebookOpen && <p>Le Carnet est ouvert : tu peux déjà noter les fleurs que tu as achetées.</p>}
        </div>}

        <ArenaWorldMap activitiesLocked={activitiesLocked} notebookOpen={notebookOpen} initialMode={initialMode} profileLauncher={profileLauncher} profileAvailability={profileAvailability} />
      </section>
    </main>
  );
}
