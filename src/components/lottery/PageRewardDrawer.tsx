"use client";

import Image from "next/image";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityLabels } from "@/lib/lottery-card-ui";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type {
  LotteryCollectionPageRarity,
  LotteryCollectionPageState,
} from "@/types/lottery";

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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-2xl bg-cream shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-ink hover:bg-ink/20"
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <h3 className="font-display text-xl text-ink mt-2">
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
                className="group w-full cartoon-border bg-cream p-4 text-left transition-all hover:bg-cream-dark/20 hover:shadow-md disabled:opacity-50"
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
                        {isRemoteImageUrl(normalizedImageUrl) ? (
                          <img
                            src={normalizedImageUrl}
                            alt={option.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Image
                            src={normalizedImageUrl}
                            alt={option.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        )}
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
