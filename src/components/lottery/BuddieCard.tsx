import Image from "next/image";
import { getBuddieArtwork, hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { isRenderableImageSource } from "@/lib/image-source";
import { rarityLabels } from "@/lib/lottery-card-ui";
import type { LotteryCardRarity } from "@/types/lottery";
import styles from "./BuddieCard.module.css";

export type BuddieCardProps = {
  code: string;
  name: string;
  rarity: LotteryCardRarity;
  cardNumber: number;
  imageUrl?: string;
  hidden?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

function RaritySymbol({ rarity }: { rarity: LotteryCardRarity }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      {rarity === "common" && (
        <>
          <path d="M24 40V22M24 30C9 31 7 19 8 13c13-2 19 6 16 17ZM24 23C22 12 30 6 40 7c2 10-4 19-16 16Z" fill="currentColor" />
        </>
      )}
      {rarity === "silver" && (
        <>
          <path d="m24 5 16 19-16 19L8 24 24 5Z" stroke="currentColor" strokeWidth="3" />
          <path d="m24 13 9 11-9 11-9-11 9-11Z" fill="currentColor" />
        </>
      )}
      {rarity === "gold" && (
        <>
          <circle cx="24" cy="24" r="9" fill="currentColor" />
          <path d="M24 3v7m0 28v7M3 24h7m28 0h7M9 9l5 5m20 20 5 5M9 39l5-5m20-20 5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {rarity === "epic" && (
        <>
          <path d="m24 3 5.3 14.3L45 18l-12.2 10 4 16L24 35l-12.8 9 4-16L3 18l15.7-.7L24 3Z" fill="currentColor" />
          <path d="m24 15 2.2 6.5 6.8.5-5.3 4.2 1.7 6.6-5.4-3.9-5.4 3.9 1.7-6.6L15 22l6.8-.5L24 15Z" className={styles.symbolInset} />
        </>
      )}
      {rarity === "legendary" && (
        <>
          <path d="m8 16 9 7 7-16 7 16 9-7-5 20H13L8 16Z" fill="currentColor" />
          <path d="M13 41h22M6 31C2 28 2 23 3 21c5 2 7 6 3 10Zm36 0c4-3 4-8 3-10-5 2-7 6-3 10Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="m24 23 3 5-3 5-3-5 3-5Z" className={styles.symbolInset} />
        </>
      )}
    </svg>
  );
}

function FrameOrnaments({ rarity }: { rarity: LotteryCardRarity }) {
  return (
    <svg className={styles.frame} viewBox="0 0 1024 1536" fill="none" aria-hidden="true" focusable="false">
      <rect x="12" y="12" width="1000" height="1512" rx="46" stroke="currentColor" strokeWidth="12" />
      <rect x="34" y="34" width="956" height="1468" rx="25" stroke="currentColor" strokeWidth="2" opacity=".65" />
      {rarity !== "common" && (
        <rect x="43" y="43" width="938" height="1450" rx="18" stroke="currentColor" strokeWidth="2" opacity=".45" />
      )}
      {[false, true].map((right) => (
        <g key={String(right)} transform={right ? "translate(1024 0) scale(-1 1)" : undefined}>
          {rarity === "common" && (
            <>
              <path d="M34 152v34m0 1164v34" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
              <circle cx="34" cy="768" r="7" fill="currentColor" />
            </>
          )}
          {rarity === "silver" && (
            <>
              {[274, 390, 506, 622, 914, 1030, 1146, 1262].map((y) => (
                <path key={y} d={`M22 ${y + 12}l23-24m-23 37 23-24`} stroke="currentColor" strokeWidth="3" opacity=".65" />
              ))}
              <path d="m34 720 13 48-13 48-13-48 13-48Z" fill="currentColor" />
            </>
          )}
          {rarity === "gold" && (
            <>
              {[258, 1278].map((y) => (
                <g key={y} transform={`translate(34 ${y})`} stroke="currentColor" strokeWidth="3">
                  <path d="M0-45v18M0 27v18M-13-32l6 12m20-12L7-20M-13 32l6-12m20 12L7 20" />
                  <ellipse rx="9" ry="17" fill="currentColor" />
                </g>
              ))}
              <path d="M34 376v278m0 228v278" stroke="currentColor" strokeWidth="4" />
              <path d="m34 710 12 58-12 58-12-58 12-58Z" fill="currentColor" />
            </>
          )}
          {rarity === "epic" && (
            <>
              <path d="m34 242-11 168 21 165-21 193 21 193-21 165 11 168" stroke="currentColor" strokeWidth="2" opacity=".75" />
              {[274, 522, 768, 1014, 1262].map((y, index) => (
                <path key={y} d={`m34 ${y - 24} 5 17 11 7-11 7-5 17-5-17-11-7 11-7 5-17Z`} fill="currentColor" opacity={index % 2 ? ".65" : "1"} />
              ))}
              {[390, 646, 890, 1146].map((y) => (
                <circle key={y} cx="34" cy={y} r="4" fill="currentColor" />
              ))}
            </>
          )}
          {rarity === "legendary" && (
            <>
              <path d="M34 225c-18 92 18 132 0 210s18 131 0 210 18 132 0 210 18 132 0 210 18 132 0 210" stroke="currentColor" strokeWidth="3" />
              {[274, 390, 506, 622, 738, 854, 970, 1086, 1202].map((y, index) => (
                <g key={y} transform={`translate(34 ${y}) scale(${index % 2 ? -1 : 1} 1)`}>
                  <path d="M0 18C-14 6-17-5-12-19 2-13 6 2 0 18Z" fill="currentColor" />
                  <path d="M0 29C10 18 15 10 12-2 0 0-4 16 0 29Z" fill="currentColor" opacity=".7" />
                </g>
              ))}
            </>
          )}
        </g>
      ))}
      <path d="M82 188h860M82 1340h860" stroke="currentColor" strokeWidth={rarity === "common" ? "2" : "4"} opacity=".6" />
      {(rarity === "gold" || rarity === "epic" || rarity === "legendary") && (
        <path d="m476 27 36-10 36 10-36 10-36-10Zm0 1482 36-10 36 10-36 10-36-10Z" fill="currentColor" />
      )}
    </svg>
  );
}

/** The complete 2:3 card; parent components own selection, buttons and count badges. */
export function BuddieCard({
  code,
  name,
  rarity,
  cardNumber,
  imageUrl,
  hidden = false,
  sizes = "(max-width: 640px) 42vw, (max-width: 1024px) 25vw, 240px",
  priority = false,
  className,
}: BuddieCardProps) {
  // Missing cards keep a muted illustration, while their name stays concealed.
  const artwork = getBuddieArtwork(code, imageUrl);
  const hasImage = isRenderableImageSource(artwork);
  const isLegacy = !hidden && hasImage && !hasModernBuddieArtwork(code);
  const label = hidden
    ? `Carte mystère numéro ${cardNumber}, ${rarityLabels[rarity]}`
    : `${name}, carte numéro ${cardNumber}, ${rarityLabels[rarity]}`;
  const rootClassName = [styles.card, styles[rarity], isLegacy ? styles.legacy : "", hidden ? styles.hidden : "", className].filter(Boolean).join(" ");

  return (
    <span className={rootClassName} role="img" aria-label={label} data-rarity={rarity} data-artwork={hidden ? "hidden" : isLegacy ? "legacy" : "scene"}>
      {isLegacy ? (
        <Image
          src={artwork}
          alt=""
          fill
          sizes={sizes}
          className={styles.legacyImage}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
      ) : (
        <>
          <FrameOrnaments rarity={rarity} />
          <span className={styles.title} aria-hidden="true">
            <span className={name.length > 28 && !hidden ? styles.longName : undefined}>{hidden ? "Carte mystère" : name}</span>
          </span>
          <span className={styles.scene} aria-hidden="true">
            {hasImage && (
              <Image
                src={artwork}
                alt=""
                fill
                sizes={sizes}
                className={styles.sceneImage}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
              />
            )}
            {(!hasImage || hidden) && (
              <span className={styles.placeholder}>
                <span className={styles.placeholderSymbol}>{hidden ? "?" : <RaritySymbol rarity="common" />}</span>
                <span className={styles.placeholderLabel}>{hidden ? "À découvrir" : "Buddies"}</span>
              </span>
            )}
          </span>
          <span className={styles.footer} aria-hidden="true">
            <span className={styles.number}>Nº {String(cardNumber).padStart(2, "0")}</span>
            <span className={styles.rarity}>
              <span className={styles.raritySymbol}><RaritySymbol rarity={rarity} /></span>
              <span>{rarityLabels[rarity]}</span>
            </span>
          </span>
        </>
      )}
    </span>
  );
}
