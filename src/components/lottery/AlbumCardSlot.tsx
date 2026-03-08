"use client";

import Image from "next/image";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityCardClasses } from "@/lib/lottery-card-ui";
import type { ReactNode } from "react";
import type { LotteryCollectionCardSlot } from "@/types/lottery";

type AlbumCardSlotProps = {
  slot: LotteryCollectionCardSlot;
  onClick: () => void;
  interactive?: boolean;
};

const MissingCardSlot = ({
  normalizedImageUrl,
  hasRenderableImage,
  onClick,
  slot,
  interactive,
  cardFooter,
}: {
  normalizedImageUrl: string;
  hasRenderableImage: boolean;
  onClick: () => void;
  slot: LotteryCollectionCardSlot;
  interactive: boolean;
  cardFooter: ReactNode;
}) => {
  const containerClassName =
    "group relative flex aspect-[0.72] flex-col overflow-hidden rounded-[18px] border-2 border-dashed border-ink/20 bg-[#efe7d8] transition-all";
  const imageClass = "h-full w-full object-cover grayscale brightness-[0.25] transition-[filter] duration-300";

  const interactiveImage = (
    <>
      {hasRenderableImage ? (
        <>
          {isRemoteImageUrl(normalizedImageUrl) ? (
            <img
              src={normalizedImageUrl}
              alt={`Carte mystère #${slot.cardNumber}`}
              className={`${imageClass} ${interactive ? "group-hover:brightness-[0.35]" : ""}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image
              src={normalizedImageUrl}
              alt={`Carte mystère #${slot.cardNumber}`}
              fill
              className={`${imageClass} ${interactive ? "group-hover:brightness-[0.35]" : ""}`}
              sizes="(max-width: 640px) 42vw, (max-width: 768px) 28vw, (max-width: 1280px) 18vw, 14vw"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="block text-5xl font-display leading-none text-white/85">?</span>
              <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.08em] text-white/80">
                Carte manquante
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),rgba(255,255,255,0))]">
          <div className="text-center">
            <span className="block text-4xl font-display leading-none text-ink/25">?</span>
            <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.08em] text-charcoal/55">
              Carte manquante
            </span>
          </div>
        </div>
      )}
      {cardFooter}
    </>
  );

  if (!interactive) {
    return (
      <div className={containerClassName} title={`#${slot.cardNumber} - carte manquante`}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3">{interactiveImage}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${containerClassName} hover:border-ink/35 hover:bg-[#eadfce]`}
      title={`#${slot.cardNumber} - carte manquante`}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3">{interactiveImage}</div>
      {cardFooter}
    </button>
  );
};

export function AlbumCardSlot({ slot, onClick, interactive = true }: AlbumCardSlotProps) {
  const accent = rarityAccentColor[slot.rarity];
  const cardBg = rarityCardClasses[slot.rarity];
  const rawImageUrl = slot.imageUrl.trim();
  const normalizedImageUrl = rawImageUrl
    ? rawImageUrl.startsWith("/") || isRemoteImageUrl(rawImageUrl)
      ? rawImageUrl
      : `/${rawImageUrl}`
    : "";
  const hasRenderableImage = isRenderableImageSource(normalizedImageUrl);

  const cardFooter = (
    <div className="border-t-2 border-ink/10 bg-white/65 px-2 py-2 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal/65">Case #{slot.cardNumber}</p>
    </div>
  );

  if (!slot.isOwned) {
    return (
      <MissingCardSlot
        normalizedImageUrl={normalizedImageUrl}
        hasRenderableImage={hasRenderableImage}
        onClick={onClick}
        slot={slot}
        interactive={interactive}
        cardFooter={cardFooter}
      />
    );
  }

  const ownedSlotContent = (
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {hasRenderableImage ? (
          isRemoteImageUrl(normalizedImageUrl) ? (
            <img
              src={normalizedImageUrl}
              alt={slot.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image
              src={normalizedImageUrl}
              alt={slot.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 42vw, (max-width: 768px) 28vw, (max-width: 1280px) 18vw, 14vw"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/25">
            <span className="text-4xl">[]</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,0.32),rgba(0,0,0,0))]" />

        <span className="absolute left-2 top-2 rounded-full border border-white/50 bg-black/45 px-2 py-1 text-[10px] font-black text-white">
          #{slot.cardNumber}
        </span>

        {slot.ownedCount > 1 && (
          <span
            className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            x{slot.ownedCount}
          </span>
        )}

        {slot.burnableCount > 0 && (
          <span className="absolute left-2 bottom-2 flex h-5 min-w-[24px] items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-black text-amber-900">
            burn
          </span>
        )}
      </div>

      <div className="lottery-slot-footer border-t-2 border-ink/10 bg-white/72 px-2.5 py-2">
        <p className="lottery-slot-title text-left text-[11px] font-semibold leading-[1.2] text-ink">{slot.name}</p>
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div
        className={`group relative flex aspect-[0.72] min-w-0 flex-col overflow-hidden rounded-[18px] border-2 border-ink/20 transition-all ${cardBg}`}
        style={{ borderColor: `${accent}55` }}
        title={`#${slot.cardNumber} ${slot.name}`}
      >
        {ownedSlotContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex aspect-[0.72] min-w-0 flex-col overflow-hidden rounded-[18px] border-2 border-ink/20 transition-all hover:-translate-y-1 hover:shadow-md ${cardBg}`}
      style={{ borderColor: `${accent}55` }}
      title={`#${slot.cardNumber} ${slot.name}`}
    >
      {ownedSlotContent}
    </button>
  );
}
