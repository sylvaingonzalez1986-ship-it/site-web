"use client";

import Image from "next/image";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityCardClasses, rarityLabels } from "@/lib/lottery-card-ui";
import type { LotteryCollectionCardSlot } from "@/types/lottery";

type CardDetailModalProps = {
  slot: LotteryCollectionCardSlot;
  onClose: () => void;
};

export function CardDetailModal({ slot, onClose }: CardDetailModalProps) {
  useBodyScrollLock(true);
  const rawImageUrl = slot.imageUrl.trim();
  const normalizedImageUrl = rawImageUrl
    ? rawImageUrl.startsWith("/") || isRemoteImageUrl(rawImageUrl)
      ? rawImageUrl
      : `/${rawImageUrl}`
    : "";
  const hasRenderableImage = isRenderableImageSource(normalizedImageUrl);
  const imageAlt = slot.isOwned ? slot.name : `Carte mystere #${slot.cardNumber}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-ink/20 shadow-xl ${rarityCardClasses[slot.rarity]}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50"
          aria-label="Fermer"
        >
          x
        </button>

        {hasRenderableImage ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden">
            {isRemoteImageUrl(normalizedImageUrl) ? (
              <img
                src={normalizedImageUrl}
                alt={imageAlt}
                className={`h-full w-full object-cover ${slot.isOwned ? "" : "grayscale brightness-[0.25]"}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Image
                src={normalizedImageUrl}
                alt={imageAlt}
                fill
                className={`object-cover ${slot.isOwned ? "" : "grayscale brightness-[0.25]"}`}
                sizes="(max-width: 640px) 90vw, 384px"
                priority
              />
            )}

            {!slot.isOwned && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/40" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0))]" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-8xl leading-none text-white/85">?</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-[#eadfce]">
            <span className="text-7xl">{slot.isOwned ? "[]" : "?"}</span>
          </div>
        )}

        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl text-ink">{slot.isOwned ? slot.name : "Carte inconnue"}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: rarityAccentColor[slot.rarity] }}
            >
              #{slot.cardNumber}
            </span>
          </div>

          <p className="text-xs text-charcoal">{rarityLabels[slot.rarity]}</p>

          {slot.isOwned && slot.description && <p className="text-sm text-charcoal/80">{slot.description}</p>}

          {slot.isOwned && (
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="pill-cartoon bg-ink/10 px-2 py-0.5 text-ink">Possédée x{slot.ownedCount}</span>
              {slot.burnableCount > 0 && (
                <span className="pill-cartoon bg-amber-100 px-2 py-0.5 text-amber-800">
                  burn {slot.burnableCount}
                </span>
              )}
              {slot.firstOwnedAt && (
                <span className="pill-cartoon bg-[#efe7d8] px-2 py-0.5 text-charcoal">
                  Obtenue le {new Date(slot.firstOwnedAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          )}

          {!slot.isOwned && (
            <p className="text-sm italic text-charcoal/60">
              Tu n&apos;as pas encore cette carte. Continue à ouvrir des boosters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
