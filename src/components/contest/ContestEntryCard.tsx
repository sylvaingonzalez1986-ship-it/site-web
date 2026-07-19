"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CONTEST_ENTRY_CATEGORY_LABELS,
  type ContestEntrySummary,
} from "@/types/contest";
import { CONTEST_CATEGORY_THEME, formatContestAverage } from "@/lib/contest-ui";
import {
  CONTEST_SCORE_MAX,
  CONTEST_SCORE_RARITY_DOTS,
  CONTEST_SCORE_STRONG_THRESHOLD,
} from "@/lib/contest-score";

type ContestEntryCardProps = {
  entry: ContestEntrySummary;
  href?: string;
  compact?: boolean;
  selected?: boolean;
  imagePriority?: boolean;
  onClick?: () => void;
};

function toTerpeneList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 3);
}

export function ContestEntryCard({
  entry,
  href,
  compact = false,
  selected = false,
  imagePriority = false,
  onClick,
}: ContestEntryCardProps) {
  const categoryTheme = CONTEST_CATEGORY_THEME[entry.category];
  const dominantTerpenes = entry.track === "concours" ? toTerpeneList(entry.technicalSheet.dominantTerpenes) : [];
  const description = entry.story.trim() || String(entry.technicalSheet.notes ?? "").trim();
  const variety =
    typeof entry.technicalSheet.variety === "string" && entry.technicalSheet.variety.trim()
      ? entry.technicalSheet.variety.trim()
      : entry.title;
  const soil =
    typeof entry.technicalSheet.soil === "string" && entry.technicalSheet.soil.trim()
      ? entry.technicalSheet.soil.trim()
      : entry.producer?.soil?.trim() || "Non renseigne";
  const averageScore = entry.stats.averageScore;
  const producerName = entry.producer?.name ?? "Les Chanvriers Bretons";
  const footerHref = href ?? "#";
  const isClickable = typeof onClick === "function";
  const hasHolographicEffect =
    (entry.ranking?.seasonCategoryRank ?? 99) <= 3 || averageScore >= CONTEST_SCORE_STRONG_THRESHOLD;
  const rarityDots = Math.max(
    1,
    Math.min(
      CONTEST_SCORE_RARITY_DOTS,
      Math.round((averageScore / CONTEST_SCORE_MAX) * CONTEST_SCORE_RARITY_DOTS),
    ),
  );

  const cardStyle = {
    "--tcg-w": compact ? "300px" : "340px",
  } as CSSProperties;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-pressed={isClickable ? selected : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`tcg-card ${hasHolographicEffect ? "tcg-card--holographic" : ""} ${
        selected ? "tcg-card--selected" : ""
      } ${isClickable ? "cursor-pointer" : ""}`}
      style={cardStyle}
    >
      <div className="tcg-card-inner">
        <header className="tcg-card-header">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
              L&apos;Arène
            </p>
            <h3 className="tcg-card-name" title={entry.title}>
              {entry.title}
            </h3>
          </div>
          <span
            className={`inline-flex min-h-6 items-center rounded-full border-2 border-[#1a1a1a] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${categoryTheme.chipClass}`}
          >
            {CONTEST_ENTRY_CATEGORY_LABELS[entry.category]}
          </span>
        </header>

        <div className="tcg-card-image-frame">
          <Image
            src={entry.imageUrl || entry.product?.image || "/product_flower.jpg"}
            alt={entry.title}
            fill
            priority={imagePriority}
            sizes={compact ? "300px" : "340px"}
            className="object-cover"
          />
          <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            <span className="rounded-full border border-[#1a1a1a] bg-[#fffaf0]/95 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
              {entry.season?.label ?? "Saison active"}
            </span>
            {entry.ranking?.seasonCategoryRank ? (
              <span className="rounded-full border border-[#1a1a1a] bg-[#f4c26f]/95 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink">
                #{entry.ranking.seasonCategoryRank}
              </span>
            ) : null}
          </div>
          <div className="tcg-card-location-ribbon">
            <span className="tcg-card-location-text">{producerName}</span>
          </div>
        </div>

        <div className="tcg-card-stats">
          <div className="tcg-stat">
            <span className="tcg-stat-label">Moyenne</span>
            <span className="tcg-stat-value">{formatContestAverage(averageScore)} / {CONTEST_SCORE_MAX}</span>
          </div>
          <div className="tcg-stat">
            <span className="tcg-stat-label">Avis</span>
            <span className="tcg-stat-value">{entry.stats.approvedReviewCount}</span>
          </div>
          <div className="tcg-stat">
            <span className="tcg-stat-label">Prix</span>
            <span className="tcg-stat-value">
              {entry.product ? `${entry.product.price.toFixed(2)} EUR` : "À confirmer"}
            </span>
          </div>
          <div className="tcg-stat">
            <span className="tcg-stat-label">Variété</span>
            <span className="tcg-stat-value">{variety}</span>
          </div>
        </div>

        {(dominantTerpenes.length > 0 || soil) && (
          <div className="tcg-card-certifications">
            {dominantTerpenes.map((terpene) => (
              <span key={terpene} className="tcg-cert-pill">
                {terpene}
              </span>
            ))}
            <span className="tcg-cert-pill">{soil}</span>
          </div>
        )}

        <div className="tcg-card-description">
          {description || "Lot premium en attente de notes et de commentaires dégustateurs."}
        </div>

        <footer className="tcg-card-footer">
          <span className={`tcg-card-footer-text ${categoryTheme.accentClass}`}>
            {entry.product?.name ?? "Lot dégustation"}
          </span>
          {href ? (
            <Link
              href={footerHref}
              className="rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-ink"
              onClick={(event) => event.stopPropagation()}
            >
              Voir la fiche
            </Link>
          ) : (
            <div className="tcg-card-rarity" aria-label="Niveau du lot">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={`tcg-card-rarity-dot ${
                    index < rarityDots
                      ? ""
                      : "tcg-card-rarity-dot--empty"
                  }`}
                />
              ))}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
