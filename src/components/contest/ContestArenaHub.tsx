"use client";

import { type ArenaLobbyMode } from "@/lib/arena-lobby";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import Link from "@/components/navigation/NavigationLink";
import { ArenaWorldMap } from "./ArenaWorldMap";
import retro from "./ArenaRetro.module.css";
import styles from "./ArenaHome.module.css";

type ArenaHubProps = {
  activitiesLocked?: boolean;
  notebookOpen?: boolean;
  gameOpen?: boolean;
  guest?: boolean;
  initialMode?: ArenaLobbyMode;
  /** Kept for incoming prelaunch routes; the opening date is now always visible. */
  initialNotice?: boolean;
};

export function ContestArenaHub({ activitiesLocked = false, notebookOpen = true, gameOpen = true, guest = false, initialMode = "jouer" }: ArenaHubProps) {

  return (
    <main data-world="arena" data-lobby-mode={initialMode} className={`${retro.gameSurface} ${styles.home}`}>
      <header className={styles.topBar}>
        <div className={styles.brand}><h1>L’Arène<span>.</span></h1></div>
      </header>

      <section className={styles.activities} aria-label="Activités de l’Arène">
        {activitiesLocked && <div className={styles.intro}>
          <h2>{ARENA_OPENING_MESSAGE}</h2>
          {notebookOpen && <p>Le Carnet est ouvert : tu peux déjà noter les fleurs que tu as achetées.</p>}
        </div>}

        <ArenaWorldMap activitiesLocked={activitiesLocked} notebookOpen={notebookOpen} gameOpen={gameOpen} initialMode={initialMode} />
        {guest && !activitiesLocked && gameOpen && <div className={styles.mapFooter}>
          <p>Crée ton personnage et retrouve ta progression avec un compte gratuit.</p>
          <Link href="/compte/inscription?next=%2Farene%2Fplacard" className={styles.discoveryButton}>Créer mon compte pour jouer</Link>
        </div>}
        {guest && !activitiesLocked && !gameOpen && <p className={styles.mapFooter}>
          Le Quartier est en test privé. <Link href="/compte/connexion?next=%2Farene%2Fplacard">J’ai un accès de test</Link>
        </p>}
      </section>
    </main>
  );
}
