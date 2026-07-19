"use client";

import Image from "next/image";
import { Gift } from "lucide-react";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityLabels } from "@/lib/lottery-card-ui";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type {
  LotteryCollectionPageRarity,
  LotteryCollectionPageState,
} from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

type PageRewardDrawerProps = {
  page: LotteryCollectionPageState;
  acting: boolean;
  onClaim: (pageRarity: LotteryCollectionPageRarity, rewardDefinitionId: string) => Promise<void>;
  onClose: () => void;
};

export function PageRewardDrawer({ page, acting, onClaim, onClose }: PageRewardDrawerProps) {
  useBodyScrollLock(true);
  const accent = rarityAccentColor[page.rarity];

  if (page.rewardStatus !== "claimable") {
    return null;
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-reward-title"
      onClick={onClose}
    >
      <div
        className={styles.modalShell}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className={styles.modalClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="text-center">
            <Gift className="mx-auto h-10 w-10 text-forest" aria-hidden="true" />
            <h3 id="page-reward-title" className="font-display text-xl text-ink mt-2">
              Page {page.label} complète !
            </h3>
            <p className="mt-1 text-sm text-charcoal">
              Choisis ta récompense pour la page{" "}
              <span className="font-semibold" style={{ color: accent }}>
                {rarityLabels[page.rarity]}
              </span>
            </p>
          </div>

          {/* Reward options */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {page.rewardOptions.map((option) => (
              <button
                key={option.rewardDefinitionId}
                disabled={acting}
                onClick={() => onClaim(page.rarity, option.rewardDefinitionId)}
                className="group w-full border-2 border-[#003f30] bg-[#fffaf1] p-4 text-left transition-all hover:bg-[#fff4cb] disabled:opacity-50"
              >
                <div className="flex gap-3">
                  {(() => {
                    if (!option.imageUrl) {
                      return null;
                    }

                    const normalizedImageUrl =
                      option.imageUrl.startsWith("/") || isRemoteImageUrl(option.imageUrl)
                        ? option.imageUrl
                        : `/${option.imageUrl}`;

                    if (!isRenderableImageSource(normalizedImageUrl)) {
                      return null;
                    }

                    return (
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={normalizedImageUrl}
                          alt={option.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm text-ink">{option.title}</p>
                    <p className="mt-0.5 text-xs text-charcoal line-clamp-2">
                      {option.description}
                    </p>
                    {option.discountPercent && (
                      <span className="mt-1 inline-block rounded bg-forest/15 px-1.5 py-0.5 text-[10px] font-bold text-forest">
                        -{option.discountPercent}%
                      </span>
                    )}
                    {option.giftWeightGrams && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        🎁 {option.giftWeightGrams}g
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {page.rewardOptions.length === 0 && (
            <p className="text-center text-sm text-charcoal/60 italic">
              Aucune récompense disponible pour cette page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
