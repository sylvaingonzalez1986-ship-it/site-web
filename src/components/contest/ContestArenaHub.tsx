"use client";

import Link from "@/components/navigation/NavigationLink";
import { ArrowUpRight, Map } from "lucide-react";
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
        <div className={styles.brand}><span>Kanab Quest</span><h1>L’Arène<span>.</span></h1><p>Un village. Mille façons de te faire un nom.</p></div>
        <div className={styles.tools}>
          {activitiesLocked ? <ArenaPrelaunchCharacter launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} /> : <ArenaJourneyEntry launcherRef={profileLauncher} onProfileAvailabilityChange={setProfileAvailability} />}
        </div>
      </header>

      <section className={styles.activities} aria-labelledby="arena-activities-title">
        {activitiesLocked ? <div className={styles.intro}>
          <span className={styles.eyebrow}>Ouverture de l’Arène</span>
          <h2 id="arena-activities-title">{ARENA_OPENING_MESSAGE}</h2>
          <p>Découvre les possibilités de l’Arène avant l’ouverture.</p>
        </div> : <div className={styles.intro}>
          <h2 id="arena-activities-title"><Map size={17} aria-hidden="true" /> À toi d’explorer.</h2>
          <p>Le Carnet, le jeu, les talents de la saison… choisis ta destination.</p>
        </div>}

        <ArenaWorldMap activitiesLocked={activitiesLocked} initialMode={initialMode} profileLauncher={profileLauncher} profileAvailability={profileAvailability} />
        <div className={styles.mapFooter}>
          <div className={styles.discovery} data-arena-discovery-entry><ArenaLearningLauncher className={styles.discoveryButton} /></div>
          {!activitiesLocked && <Link href="/arene?vue=classement" className={styles.rewardLink}>Des fleurs à gagner en fin de saison <ArrowUpRight size={16} aria-hidden="true" /></Link>}
        </div>
        {personalSummaryEnabled && !activitiesLocked ? <ArenaPlayerResume /> : null}
      </section>
    </main>
  );
}
