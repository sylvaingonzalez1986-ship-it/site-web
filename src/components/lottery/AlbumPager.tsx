"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { rarityAccentColor } from "@/lib/lottery-card-ui";
import type { LotteryCollectionPageState } from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

type AlbumPagerProps = {
  pages: LotteryCollectionPageState[];
  activeIndex: number;
  onPageChange: (index: number) => void;
  isPreview?: boolean;
};

export function AlbumPager({ pages, activeIndex, onPageChange, isPreview = false }: AlbumPagerProps) {
  const canGoPrevious = !isPreview && activeIndex > 0;
  const canGoNext = !isPreview && activeIndex < pages.length - 1;

  return (
    <nav className={styles.pager} aria-label="Pages de l'album">
      <button
        type="button"
        className={styles.pagerArrow}
        disabled={!canGoPrevious}
        onClick={() => canGoPrevious && onPageChange(activeIndex - 1)}
        aria-label="Page précédente"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <div className={styles.pagerTabs}>
        {pages.map((page, index) => {
          const active = index === activeIndex;
          const accent = rarityAccentColor[page.rarity];
          const claimable = page.rewardStatus === "claimable";

          return (
            <button
              key={page.rarity}
              type="button"
              onClick={() => {
                if (!isPreview) {
                  onPageChange(index);
                }
              }}
              disabled={isPreview}
              className={`${styles.pagerTab} ${active ? styles.pagerTabActive : ""}`}
              aria-disabled={isPreview || undefined}
              style={{ "--rarity-accent": accent } as CSSProperties}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.pagerDot} aria-hidden="true" />
              <span>
                <strong>{page.label}</strong>
                <small>{page.ownedUnique}/{page.totalSlots} cartes</small>
              </span>

              {claimable && (
                <span className={styles.pagerStatus}>
                  !
                </span>
              )}
              {page.rewardStatus === "claimed" && (
                <span className={styles.pagerStatus}>✓</span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.pagerArrow}
        disabled={!canGoNext}
        onClick={() => canGoNext && onPageChange(activeIndex + 1)}
        aria-label="Page suivante"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}
