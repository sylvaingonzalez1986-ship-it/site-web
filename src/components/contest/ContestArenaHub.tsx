"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowUpRight, BookOpen, LockKeyhole, Sprout, Trophy } from "lucide-react";
import { ArenaJourneyEntry } from "./ArenaJourneyEntry";
import { ArenaPrelaunchCharacter } from "./ArenaPrelaunchCharacter";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import retro from "./ArenaRetro.module.css";
import styles from "./ArenaHome.module.css";

const ACTIVITIES = {
  carnet: { Icon: BookOpen, title: "Déguster", description: "Note les fleurs que tu as goûtées." },
  jouer: { Icon: Sprout, title: "Cultiver", description: "Fais grandir tes cultures." },
  classement: { Icon: Trophy, title: "Voir le classement", description: "Retrouve ta place dans la saison." },
};

type ArenaHubProps = {
  activitiesLocked?: boolean;
  initialMode?: ArenaLobbyMode;
  /** Kept for incoming prelaunch routes; the opening date is now always visible. */
  initialNotice?: boolean;
};

export function ContestArenaHub({ activitiesLocked = false, initialMode = "jouer" }: ArenaHubProps) {
  const scene = ARENA_LOBBY_MODES[initialMode];

  return (
    <main data-world="arena" data-lobby-mode={initialMode} className={`${retro.surface} ${styles.home}`}>
      <div className={styles.scene} data-arena-scene={initialMode}>
        <Image src={scene.image} alt={scene.imageAlt} fill sizes="100vw" loading="eager" fetchPriority="high" />
      </div>
      <div className={styles.shade} aria-hidden="true" />

      <header className={styles.topBar}>
        <div className={styles.brand}><span>Kanab Quest</span><h1>L’Arène.</h1></div>
        <div className={styles.tools}>
          {activitiesLocked ? <ArenaPrelaunchCharacter /> : <ArenaJourneyEntry />}
        </div>
      </header>

      <div className={styles.breathingRoom} aria-hidden="true" />

      <section className={styles.activities} aria-labelledby="arena-activities-title">
        {activitiesLocked ? <div className={styles.intro}>
          <span className={styles.eyebrow}>Ouverture de l’Arène</span>
          <h2 id="arena-activities-title">{ARENA_OPENING_MESSAGE}</h2>
          <p>Prépare ton personnage. Les activités arrivent bientôt !</p>
        </div> : <div className={styles.intro}>
          <h2 id="arena-activities-title">À toi de jouer.</h2>
          <p>Choisis ton activité.</p>
        </div>}

        <nav className={styles.activityGrid} aria-label="Choisir une activité">
          {ARENA_LOBBY_MODE_ORDER.map(id => {
            const { Icon, title, description } = ACTIVITIES[id];
            const content = <>
              <span className={styles.activityIcon}><Icon size={23} aria-hidden="true" /></span>
              <span className={styles.activityText}>
                <strong className={styles.activityName}>{ARENA_LOBBY_MODES[id].name}</strong>
                <span className={styles.activityAction}>{title}</span>
                <span className={styles.description}>{description}</span>
              </span>
              {activitiesLocked ? <span className={styles.soon}><LockKeyhole size={14} aria-hidden="true" />Bientôt</span>
                : <ArrowUpRight className={styles.arrow} size={22} aria-hidden="true" />}
            </>;
            return activitiesLocked
              ? <div key={id} data-arena-activity={id} className={`${styles.activity} ${styles.locked}`}>{content}</div>
              : <Link key={id} data-arena-activity={id} className={styles.activity} href={ARENA_LOBBY_MODES[id].href}>{content}</Link>;
          })}
        </nav>

        {!activitiesLocked && <Link href="/arene?vue=classement" className={styles.rewardLink}>
          Des fleurs à gagner en fin de saison <ArrowUpRight size={16} aria-hidden="true" />
        </Link>}
      </section>
    </main>
  );
}
