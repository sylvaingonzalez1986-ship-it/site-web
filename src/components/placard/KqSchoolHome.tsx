"use client";

import Image from 'next/image';
import styles from './KqSchoolHome.module.css';

/** Each illustrated object is one keyboard- and touch-accessible destination. */
export function KqSchoolHome({ onChoose }: {
  onChoose: (section: 'tournament' | 'learn' | 'ranking') => void;
}) {
  return <nav className={styles.home} aria-label="Les espaces de QuizzShow" data-school-home>
    <div className={styles.scene}>
      <Image
        className={styles.illustration}
        src="/placard/school/quizzshow-home-v3.webp"
        alt="La salle de QuizzShow : un pupitre à buzzer à gauche, un tableau de classement au centre et une bibliothèque à droite. La fenêtre donne sur la banque du quartier."
        width={1536}
        height={1024}
        sizes="(max-width: 700px) 100vw, (max-width: 1400px) 85vw, 1120px"
        loading="eager"
        unoptimized
      />
      <button type="button" className={`${styles.hotspot} ${styles.tournament}`} onClick={() => onChoose('tournament')}
        data-school-destination="tournament" aria-label="Pupitre : ouvrir le tournoi">
        <span className={styles.caption}>
          <span className={styles.sign}>Tournoi</span>
        </span>
      </button>
      <button type="button" className={`${styles.hotspot} ${styles.ranking}`} onClick={() => onChoose('ranking')}
        data-school-destination="ranking" aria-label="Tableau : ouvrir le classement">
        <span className={styles.caption}>
          <span className={styles.sign}>Classement</span>
        </span>
      </button>
      <button type="button" className={`${styles.hotspot} ${styles.library}`} onClick={() => onChoose('learn')}
        data-school-destination="learn" aria-label="Bibliothèque : ouvrir l’encyclopédie">
        <span className={styles.caption}>
          <span className={styles.sign}>Encyclopédie</span>
        </span>
      </button>
    </div>
  </nav>;
}
