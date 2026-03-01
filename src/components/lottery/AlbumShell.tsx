"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LotteryCollectionAlbum } from "@/types/lottery";

type AlbumShellProps = {
  album: LotteryCollectionAlbum;
  children: ReactNode;
  embedded?: boolean;
  subtitle?: string;
};

export function AlbumShell({ album, children, embedded = false, subtitle }: AlbumShellProps) {
  const { summary } = album;
  const resolvedSubtitle = subtitle?.trim() || "Ta collection de cartes. Complete chaque page pour debloquer ses recompenses.";

  return (
    <div className="space-y-6">
      <div className="cartoon-border bg-cream p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {embedded ? (
              <h2 className="font-display text-3xl text-ink md:text-4xl">{album.collectionTitle}</h2>
            ) : (
              <h1 className="font-display text-3xl text-ink md:text-4xl">{album.collectionTitle}</h1>
            )}
            <p className="mt-1 text-sm text-charcoal">
              {resolvedSubtitle}
            </p>
          </div>
          {!embedded && (
            <Link
              href="/profil"
              className="btn-cartoon btn-secondary inline-flex min-h-[44px] items-center whitespace-nowrap px-4 text-sm"
            >
              Retour au profil
            </Link>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Cartes" value={`${summary.ownedUnique} / ${summary.totalCards}`} />
          <SummaryStat label="Completion" value={`${summary.completionPercent}%`} />
          <SummaryStat label="Pages completes" value={String(summary.completedPages)} />
          <SummaryStat
            label="Recompenses"
            value={String(summary.availableClaims)}
            highlight={summary.availableClaims > 0}
          />
        </div>

        <div className="mt-4">
          <div className="h-3 overflow-hidden rounded-full border border-ink/10 bg-[#e9ddcb]">
            <div
              className="h-full rounded-full bg-[#0a7b61] transition-all duration-500"
              style={{ width: `${Math.min(100, summary.completionPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-ink/10 px-3 py-2 text-center ${
        highlight ? "bg-[#e7f4e8] ring-2 ring-[#0a7b61]/25" : "bg-[#efe7d8]"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal">{label}</p>
      <p className={`font-display text-lg ${highlight ? "text-[#0a7b61]" : "text-ink"}`}>{value}</p>
    </div>
  );
}
