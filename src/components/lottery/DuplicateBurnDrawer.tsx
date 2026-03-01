"use client";

import Image from "next/image";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityLabels } from "@/lib/lottery-card-ui";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type {
  LotteryCollectionPageState,
  LotteryDuplicateGroup,
} from "@/types/lottery";

type DuplicateBurnDrawerProps = {
  page: LotteryCollectionPageState;
  group: LotteryDuplicateGroup;
  acting: boolean;
  onBurn: (group: LotteryDuplicateGroup) => Promise<void>;
  onClose: () => void;
};

export function DuplicateBurnDrawer({ page, group, acting, onBurn, onClose }: DuplicateBurnDrawerProps) {
  useBodyScrollLock(true);
  const accent = rarityAccentColor[page.rarity];
  const burnOffer = page.burnOffer;
  const normalizedImageUrl = group.imageUrl.startsWith("/") || isRemoteImageUrl(group.imageUrl)
    ? group.imageUrl
    : `/${group.imageUrl}`;
  if (!burnOffer) return null;

  const canBurn = group.burnableInstanceIds.length >= burnOffer.duplicatesRequired;

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
            <p className="text-4xl">♻️</p>
            <h3 className="font-display text-xl text-ink mt-2">
              Recycler des doublons
            </h3>
            <p className="mt-1 text-sm text-charcoal">
              Échange{" "}
              <span className="font-bold">{burnOffer.duplicatesRequired} doublons</span>{" "}
              de <span className="font-semibold" style={{ color: accent }}>{group.name}</span>{" "}
              contre un code promo de{" "}
              <span className="font-bold text-forest">{burnOffer.discountPercent}%</span>
            </p>
          </div>

          {/* Card preview */}
          <div className="flex items-center gap-4 rounded-xl border-2 border-ink/10 bg-cream-dark/15 p-4">
            {isRenderableImageSource(normalizedImageUrl) ? (
              <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                {isRemoteImageUrl(normalizedImageUrl) ? (
                  <img
                    src={normalizedImageUrl}
                    alt={group.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Image
                    src={normalizedImageUrl}
                    alt={group.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                )}
              </div>
            ) : (
              <div className="flex h-20 w-16 items-center justify-center rounded-lg bg-cream-dark/30">
                <span className="text-3xl">🃏</span>
              </div>
            )}
            <div>
              <p className="font-display text-sm text-ink">{group.name}</p>
              <p className="text-xs text-charcoal">
                #{group.cardNumber} — {rarityLabels[group.rarity]}
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: accent }}>
                {group.duplicateCount} doublon{group.duplicateCount > 1 ? "s" : ""} disponible{group.duplicateCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-sm text-amber-800">
              <span className="font-bold">{burnOffer.duplicatesRequired}</span> cartes seront
              détruites → tu reçois un code{" "}
              <span className="font-bold text-forest">-{burnOffer.discountPercent}%</span>
            </p>
          </div>

          {/* Action */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-cartoon btn-secondary flex-1 min-h-[44px] text-sm"
            >
              Annuler
            </button>
            <button
              onClick={() => onBurn(group)}
              disabled={acting || !canBurn}
              className="btn-cartoon btn-primary flex-1 min-h-[44px] text-sm disabled:opacity-50"
            >
              {acting ? "Recyclage…" : `♻️ Recycler ×${burnOffer.duplicatesRequired}`}
            </button>
          </div>

          {!canBurn && (
            <p className="text-center text-xs text-red-500">
              Il faut au moins {burnOffer.duplicatesRequired} doublons pour recycler.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
