"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatPrice } from "@/lib/utils";
import type { LotteryPrizeRarity, ScratchResult } from "@/types/lottery";

type LotteryResultModalProps = {
  result: ScratchResult | null;
  onClose: () => void;
};

const rarityLabels: Record<LotteryPrizeRarity, string> = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};

const rarityBadgeClasses: Record<LotteryPrizeRarity, string> = {
  common: "bg-[#e9e2d4] text-ink",
  rare: "bg-[#cdeae3] text-[#0a7b61]",
  epic: "bg-[#fbe4b5] text-[#8a4b00]",
  legendary: "bg-[#f5d2d2] text-[#8a1f1f]",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "Date inconnue";
  }
  return parsed.toLocaleString("fr-FR");
}

export function LotteryResultModal({ result, onClose }: LotteryResultModalProps) {
  useBodyScrollLock(Boolean(result));

  useEffect(() => {
    if (!result) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, result]);

  const scratchedAtLabel = useMemo(
    () => (result ? formatDate(result.scratchedAt) : ""),
    [result],
  );

  if (!result) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cartoon-border relative z-10 w-full max-w-3xl bg-cream p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-3xl text-ink">
            {result.isWin ? "Ticket gagnant !" : "Resultat du ticket"}
          </h3>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
          <div className="card-cartoon bg-[#f8f3e8] p-3">
            <div className="relative mx-auto h-60 w-44 md:h-72 md:w-52">
              <Image
                src="/sylvain.png"
                alt="Sylvain"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 176px, 208px"
                priority
              />
            </div>
          </div>

          <div className="card-cartoon bg-white p-4">
            <p
              className={`font-display text-3xl ${
                result.isWin ? "text-[#0a7b61]" : "text-ink"
              }`}
            >
              {result.isWin
                ? `Bravo ! ${result.prize?.name ?? "Tu as gagne un lot."}`
                : "Dommage, ce sera pour la prochaine fois."}
            </p>

            <div className="mt-4 grid gap-2 text-sm text-charcoal">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">Ticket</span>
                <span className="font-mono text-xs text-ink">{result.ticketNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">Date</span>
                <span>{scratchedAtLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">Lot</span>
                <span>{result.isWin ? result.prize?.name ?? "Lot" : "Aucun gain"}</span>
              </div>

              {result.isWin && result.prize?.rarity && (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">Rarete</span>
                  <span
                    className={`pill-cartoon px-2 py-1 text-xs ${
                      rarityBadgeClasses[result.prize.rarity]
                    }`}
                  >
                    {rarityLabels[result.prize.rarity]}
                  </span>
                </div>
              )}

              {result.isWin &&
                typeof result.prize?.valueEuros === "number" &&
                Number.isFinite(result.prize.valueEuros) &&
                result.prize.valueEuros > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">Valeur estimee</span>
                    <span className="font-semibold text-ink">
                      {formatPrice(result.prize.valueEuros)}
                    </span>
                  </div>
                )}
            </div>

            {result.isWin && result.prize?.description && (
              <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#f8f3e8] p-3 text-sm text-charcoal">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink">
                  Recap lot
                </p>
                <p className="mt-1">{result.prize.description}</p>
              </div>
            )}

            {result.isWin && (
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
                Utilise ce ticket dans le panier avant paiement.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
