import Image from "next/image";
import { ArenaNavigation } from "@/components/contest/ArenaNavigation";
import { ArenaFirstVisitTutorial } from "@/components/contest/ArenaFirstVisitTutorial";
import styles from "@/components/contest/ContestArena.module.css";

export function ContestArenaHub() {
  return (
    <main data-world="arena" className={`${styles.page} ${styles.arenaLanding}`}>
      <header className={`${styles.hero} ${styles.arenaLandingHero}`}>
        <div className={styles.noise} aria-hidden="true" />
        <div className={`retro-container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              L&apos;<span className={styles.heroTitleAccent}>Arène.</span>
            </h1>
            <div className={styles.heroRule} aria-hidden="true" />
            <p className={styles.heroLead}>
              Trois espaces, une seule progression : remplis ton Carnet, joue dans le Placard,
              puis mesure-toi aux autres dans les classements de la saison.
            </p>
          </div>

          <div className={styles.heroArt} aria-hidden="true">
            <Image
              src="/contest/mascot/arena-journey-v2.webp"
              alt=""
              width={1254}
              height={1254}
              sizes="(max-width: 767px) 92vw, 560px"
              className={styles.heroDuo}
              fetchPriority="high"
              priority
            />
          </div>
        </div>
      </header>

      <div className={`retro-container ${styles.arenaLandingNavigation}`}>
        <ArenaNavigation activeView="hub" />
        <ArenaFirstVisitTutorial />
      </div>
    </main>
  );
}
