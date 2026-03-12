"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isRenderableImageSource } from "@/lib/image-source";
import { rarityLabels } from "@/lib/lottery-card-ui";
import type { ScratchResult } from "@/types/lottery";

type LotteryResultModalProps = {
  result: ScratchResult | null;
  onClose: () => void;
};

type LotteryResultSummaryProps = {
  result: ScratchResult;
};

const rarityBadgeClasses = {
  common: "bg-[#e9e2d4] text-ink",
  silver: "bg-[#dce4ea] text-[#4f5b66]",
  gold: "bg-[#f7df91] text-[#7d5800]",
  epic: "bg-[#f5c8ff] text-[#74318f]",
  legendary: "bg-[#ffe59e] text-[#8a3d00]",
} as const;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "Date inconnue";
  }

  return parsed.toLocaleString("fr-FR");
}

function buildHeadline(result: ScratchResult): string {
  return result.cards.some((card) => card.rarity === "legendary") ? "Pack legendaire !" : "Pack revele";
}

function buildMessage(result: ScratchResult): string {
  const newCards = result.cards.filter((card) => card.ownedCount <= 1).length;
  const duplicates = result.cards.length - newCards;
  return `Ton booster a revele ${result.cards.length} cartes. ${newCards} nouvelle(s) carte(s) et ${duplicates} doublon(s) ont ete ajoutes a ta collection.`;
}

export function LotteryResultSummary({ result }: LotteryResultSummaryProps) {
  const scratchedAtLabel = useMemo(() => formatDate(result.scratchedAt), [result.scratchedAt]);

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="card-cartoon bg-[#f8f3e8] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Cartes obtenues</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {result.cards.map((card, index) => (
            <div
              key={`${card.id}-${index}`}
              className={`rounded-[18px] border-2 border-[#1a1a1a] p-3 shadow-[6px_6px_0_rgba(26,26,26,0.15)] ${rarityBadgeClasses[card.rarity]}`}
            >
              <div className="flex items-start justify-end gap-3">
                <span className="rounded-full border-2 border-current px-2 py-1 text-[10px] font-black">
                  #{card.cardNumber}
                </span>
              </div>
              <div className="mt-3 overflow-hidden rounded-[14px] border-2 border-current/50 bg-white/55">
                <div className="relative h-[180px] bg-white/45">
                  {isRenderableImageSource(card.imageUrl) ? (
                    <Image src={card.imageUrl} alt={card.name} fill sizes="220px" className="object-cover" />
                  ) : null}
                </div>
                <div className="p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em]">{rarityLabels[card.rarity]}</p>
                  <p className="mt-2 text-base font-black leading-tight">{card.name}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em]">
                {card.ownedCount > 1 ? `Doublon x${card.ownedCount}` : "Nouvelle carte"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card-cartoon bg-white p-4">
        <p className="font-display text-3xl text-ink">{buildMessage(result)}</p>

        <div className="mt-4 grid gap-2 text-sm text-charcoal">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">Pack</span>
            <span className="font-mono text-xs text-ink">{result.ticketNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">Date</span>
            <span>{scratchedAtLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">Collection</span>
            <span>
              {result.inventory.uniqueOwned}/{result.inventory.totalCards} cartes uniques
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">Doublons</span>
            <span>{result.inventory.duplicateCopies}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">Carte premium</span>
            <span>{result.card.name}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(["common", "silver", "gold", "epic", "legendary"] as const).map((rarity) => (
            <div key={rarity} className="rounded border-2 border-[#1a1a1a] bg-[#f8f3e8] p-3 text-sm">
              <p className="font-semibold text-ink">{rarityLabels[rarity]}</p>
              <p className="mt-1 text-charcoal">{result.inventory.byRarity[rarity]} copie(s)</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#f8f3e8] p-3 text-sm text-charcoal">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink">Description</p>
          <p className="mt-1">{result.card.description}</p>
        </div>
      </div>
    </div>
  );
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
      <div className="cartoon-border relative z-10 w-full max-w-4xl bg-cream p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-3xl text-ink">{buildHeadline(result)}</h3>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            x
          </button>
        </div>

        <div className="mt-4">
          <LotteryResultSummary result={result} />
        </div>
      </div>
    </div>
  );
}
