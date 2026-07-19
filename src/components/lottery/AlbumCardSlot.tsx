"use client";

import Image from "next/image";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityCardClasses } from "@/lib/lottery-card-ui";
import type { ReactNode } from "react";
import type { LotteryCollectionCardSlot } from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

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
    `group ${styles.cardSlot} ${styles.missingSlot}`;
  const imageClass = "h-full w-full object-cover grayscale brightness-[0.25] transition-[filter] duration-300";

  const interactiveImage = (
    <>
      {hasRenderableImage ? (
        <>
          <Image
            src={normalizedImageUrl}
            alt={`Carte mystère #${slot.cardNumber}`}
            fill
            className={`${imageClass} ${interactive ? "group-hover:brightness-[0.35]" : ""}`}
            sizes="(max-width: 640px) 42vw, (max-width: 768px) 28vw, (max-width: 1280px) 18vw, 14vw"
          />
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
    </>
  );

  if (!interactive) {
    return (
      <div className={containerClassName} title={`#${slot.cardNumber} - carte manquante`}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3">{interactiveImage}</div>
        {cardFooter}
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
    <div className={styles.cardFooter}>
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
            <Image
              src={normalizedImageUrl}
              alt={slot.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 42vw, (max-width: 768px) 28vw, (max-width: 1280px) 18vw, 14vw"
            />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/25">
            <span className="text-4xl">[]</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,0.32),rgba(0,0,0,0))]" />

        <span className={styles.cardNumber}>
          #{slot.cardNumber}
        </span>

        {slot.ownedCount > 1 && (
          <span className={styles.cardCount} style={{ backgroundColor: accent }}>
            x{slot.ownedCount}
          </span>
        )}

        {slot.burnableCount > 0 && (
          <span className={styles.cardBurn}>
            recyclable
          </span>
        )}
      </div>

      <div className={`${styles.cardFooter} lottery-slot-footer`}>
        <p className="lottery-slot-title text-left text-[11px] font-semibold leading-[1.2] text-ink">{slot.name}</p>
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div
        className={`group ${styles.cardSlot} ${styles.ownedSlot} ${cardBg}`}
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
      className={`group ${styles.cardSlot} ${styles.ownedSlot} ${cardBg}`}
      style={{ borderColor: `${accent}55` }}
      title={`#${slot.cardNumber} ${slot.name}`}
    >
      {ownedSlotContent}
    </button>
  );
}
