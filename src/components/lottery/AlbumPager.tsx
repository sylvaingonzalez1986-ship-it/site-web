"use client";

import { rarityAccentColor } from "@/lib/lottery-card-ui";
import type { LotteryCollectionPageState } from "@/types/lottery";

type AlbumPagerProps = {
  pages: LotteryCollectionPageState[];
  activeIndex: number;
  onPageChange: (index: number) => void;
  isPreview?: boolean;
};

export function AlbumPager({ pages, activeIndex, onPageChange, isPreview = false }: AlbumPagerProps) {
  return (
    <nav className="cartoon-border bg-cream p-3" aria-label="Pages de l'album">
      <div className="flex flex-wrap justify-center gap-2">
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
              className={`relative flex min-w-[110px] flex-col items-center rounded-xl border-2 px-3 py-2 text-sm transition-all duration-200 ${
                active
                  ? "scale-105 border-ink bg-[#efe7d8] shadow-md"
                  : `border-ink/15 bg-cream ${isPreview ? "" : "hover:border-ink/40 hover:bg-[#f4ecde]"}`
              }`}
              aria-disabled={isPreview || undefined}
              style={active ? { borderColor: accent } : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span className="mb-1 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
              <span className="font-display text-xs text-ink">{page.label}</span>
              <span className="mt-0.5 text-[10px] text-charcoal">
                {page.ownedUnique}/{page.totalSlots}
              </span>

              {claimable && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0a7b61] text-[9px] font-bold text-white">
                  !
                </span>
              )}
              {page.rewardStatus === "claimed" && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a835] text-[9px] text-white">
                  +
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
