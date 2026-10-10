"use client";

import { useRef, useState } from "react";
import { ArenaJourneyEntry } from "./ArenaJourneyEntry";
import { ArenaPrelaunchCharacter } from "./ArenaPrelaunchCharacter";
import { ArenaLearningLauncher } from "./ArenaLearningLauncher";
import { ArenaPlayerResume } from "./ArenaPlayerResume";
import { type ArenaLobbyMode } from "@/lib/arena-lobby";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle } from "@/lib/arena-profile-launcher";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import { ArenaWorldMap } from "./ArenaWorldMap";
import retro from "./ArenaRetro.module.css";
import styles from "./ArenaHome.module.css";

type ArenaHubProps = {
  activitiesLocked?: boolean;
  initialMode?: ArenaLobbyMode;
  /** Kept for incoming prelaunch routes; the opening date is now always visible. */
  initialNotice?: boolean;
  personalSummaryEnabled?: boolean;
};

export function ContestArenaHub({ activitiesLocked = false, initialMode = "jouer", personalSummaryEnabled = false }: ArenaHubProps) {
  const profileLauncher = useRef<ArenaProfileLauncherHandle | null>(null);
  const [profileAvailability, setProfileAvailability] = useState<ArenaProfileAvailability>("loading");

  return (
    <main data-world="arena" data-lobby-mode={initialMode} className={`${retro.surface} ${styles.home}`}>
      <header className={styles.topBar}>
        <div className={styles.brand}><span>Kanab Quest</span><h1>L’Arène<span>.</span></h1></div>
        <div className={styles.tools}>
          {activitiesLocked ? <ArenaPrelaunchCharacter launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} /> : <ArenaJourneyEntry launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} />}
        </div>
      </header>

      <section className={styles.activities} aria-label="Activités de l’Arène">
        {activitiesLocked && <div className={styles.intro}>
          <span className={styles.eyebrow}>Ouverture de l’Arène</span>
          <h2>{ARENA_OPENING_MESSAGE}</h2>
        </div>}

        <ArenaWorldMap activitiesLocked={activitiesLocked} initialMode={initialMode} profileLauncher={profileLauncher} profileAvailability={profileAvailability} />
        <div className={styles.mapFooter}>
          <div className={styles.discovery} data-arena-discovery-entry><ArenaLearningLauncher className={styles.discoveryButton} /></div>
        </div>
        {personalSummaryEnabled && !activitiesLocked ? <ArenaPlayerResume /> : null}
      </section>
    </main>
  );
}
