"use client";

import type { ReactNode } from "react";
import type { LotteryCollectionAlbum } from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

type AlbumShellProps = {
  album: LotteryCollectionAlbum;
  children: ReactNode;
  embedded?: boolean;
  subtitle?: string;
  seasonLabel?: string;
};

export function AlbumShell({ album, children, subtitle, seasonLabel }: AlbumShellProps) {
  const { summary } = album;
  const resolvedSubtitle = subtitle?.trim() || "Ta collection de cartes. Complète chaque page pour débloquer ses récompenses.";
  const resolvedSeasonLabel = seasonLabel?.trim();

  return (
    <div className={styles.book}>
      <div className={styles.bookHeader}>
        <div>
          {resolvedSeasonLabel && <span className={styles.seasonLabel}>{resolvedSeasonLabel}</span>}
          <h2>{album.collectionTitle}</h2>
          <p>{resolvedSubtitle}</p>
        </div>
        <div className={styles.bookProgress} aria-label={`Album complété à ${summary.completionPercent}%`}>
          <strong>{summary.completionPercent}%</strong>
          <span>{summary.ownedUnique}/{summary.totalCards} cartes</span>
          <div className={styles.bookProgressBar} aria-hidden="true">
            <i style={{ width: `${Math.min(100, summary.completionPercent)}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.bookPages}>{children}</div>
    </div>
  );
}
