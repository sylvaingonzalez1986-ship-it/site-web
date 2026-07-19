"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { isRenderableImageSource } from "@/lib/image-source";
import { rarityLabels, rarityShellClasses, rarityGlowClasses } from "@/lib/lottery-card-ui";
import type { ScratchResult } from "@/types/lottery";
import { PackSwipeCut } from "@/components/lottery/PackSwipeCut";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PackAnimationPhase = "idle" | "opening" | "revealing" | "done" | "error";

type PackOpeningAnimationProps = {
  packNumber: string;
  onOpen: () => Promise<ScratchResult>;
  onContinue?: (result: ScratchResult) => void;
  disabled?: boolean;
  demo?: boolean;
  compact?: boolean;
};

const CARD_BACK_IMAGE_SRC = "/app/lottery/tcg-card-back.png";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Card sub-components                                                */
/* ------------------------------------------------------------------ */

function RevealedCard({ card }: { card: ScratchResult["cards"][number] }) {
  const isBonus = card.isBonus === true;
  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl border-[3px] border-[#1a1a1a] ${rarityShellClasses[card.rarity]} ${rarityGlowClasses[card.rarity]}`}
    >
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-end">
          <span className="shrink-0 rounded-full border-[1.5px] border-current px-2 py-0.5 text-xs font-black sm:text-sm">
            {isBonus ? "BONUS" : `#${card.cardNumber}`}
          </span>
        </div>

        <div className="mt-3 flex-1 overflow-hidden rounded-xl border-2 border-current/40 bg-white/50">
          <div className="relative h-full min-h-0">
            {isRenderableImageSource(card.imageUrl) ? (
              <div className="absolute inset-3">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes="(max-width: 768px) 70vw, 400px"
                  className="object-contain object-center"
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <p className="font-display text-lg leading-tight sm:text-xl">{card.name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-xl border-2 border-current/30 bg-white/50 px-3 py-2 text-center">
          <p className="text-xs font-black uppercase tracking-[0.1em] sm:text-sm">
            {isBonus ? "Carte Bonus" : rarityLabels[card.rarity]}
          </p>
          <p className="mt-1 text-sm font-bold leading-tight sm:text-base">{card.name}</p>
          <p className="mt-0.5 text-xs font-semibold opacity-75 sm:text-sm">
            {isBonus ? "Bon a choisir" : card.ownedCount > 1 ? `Doublon ×${card.ownedCount}` : "Nouvelle carte"}
          </p>
        </div>
      </div>
    </div>
  );
}

function CardBack({ isClickable }: { isClickable: boolean }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl border-[3px] border-[#1a1a1a] bg-[#091013] shadow-[0_12px_28px_rgba(0,0,0,0.5)] ${
        isClickable ? "cursor-pointer ring-2 ring-white/30 ring-offset-2 ring-offset-black" : ""
      }`}
    >
      <Image
        src={CARD_BACK_IMAGE_SRC}
        alt="Dos de carte TCG"
        fill
        sizes="(max-width: 768px) 70vw, 400px"
        className="object-cover"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15)_0%,transparent_45%)]" />
      {isClickable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-white/80 backdrop-blur-sm">
            Touchez pour révéler
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flip card wrapper — full-screen single card                        */
/* ------------------------------------------------------------------ */

function FlipCard({
  card,
  revealed,
  canReveal,
  onReveal,
}: {
  card: ScratchResult["cards"][number];
  revealed: boolean;
  canReveal: boolean;
  onReveal: () => void;
}) {
  return (
    <div
      className="aspect-[2/3] w-full [perspective:1200px]"
      onClick={() => canReveal && onReveal()}
      role="button"
      tabIndex={canReveal ? 0 : -1}
      onKeyDown={(e) => {
        if (canReveal && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onReveal();
        }
      }}
      aria-label={revealed ? `Carte ${card.name} révélée` : "Révéler cette carte"}
    >
      <div
        className="relative h-full w-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Back */}
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <CardBack isClickable={canReveal} />
        </div>
        {/* Front */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <RevealedCard card={card} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Arrow button                                                       */
/* ------------------------------------------------------------------ */

function ArrowButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={`absolute top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 disabled:pointer-events-none disabled:opacity-0 ${
        direction === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4"
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Carte précédente" : "Carte suivante"}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PackOpeningAnimation({
  packNumber,
  onOpen,
  onContinue,
  disabled = false,
  demo = false,
}: PackOpeningAnimationProps) {
  const [phase, setPhase] = useState<PackAnimationPhase>("idle");
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedIndexes, setRevealedIndexes] = useState<number[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
  }, []);

  const canStart = !disabled && (phase === "idle" || phase === "error");
  const totalCards = result?.cards.length ?? 0;

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setResult(null);
    setError(null);
    setRevealedIndexes([]);
    setCurrentCardIndex(0);
  }, []);

  const beginOpening = useCallback(async () => {
    if (!canStart) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setError(null);
    setResult(null);
    setRevealedIndexes([]);
    setCurrentCardIndex(0);
    setPhase("opening");

    try {
      const nextResult = await onOpen();
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setResult(nextResult);
      await sleep(600);
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setPhase("revealing");
    } catch (openError) {
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setPhase("error");
      setError(
        openError instanceof Error ? openError.message : "Impossible d'ouvrir ce booster.",
      );
    }
  }, [canStart, onOpen]);

  const revealCard = useCallback(
    (index: number) => {
      if (!result || phase !== "revealing") return;
      setRevealedIndexes((current) => {
        if (current.includes(index)) return current;
        const next = [...current, index].sort((a, b) => a - b);
        if (next.length >= result.cards.length) setPhase("done");
        return next;
      });
    },
    [phase, result],
  );

  const goToCard = useCallback(
    (dir: "prev" | "next") => {
      setCurrentCardIndex((i) => {
        if (dir === "prev") return Math.max(0, i - 1);
        return Math.min(totalCards - 1, i + 1);
      });
    },
    [totalCards],
  );

  // Keyboard navigation for arrows
  useEffect(() => {
    if (!result || !(phase === "revealing" || phase === "done")) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToCard("prev");
      if (e.key === "ArrowRight") goToCard("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, result, goToCard]);

  // Demo: auto-reveal cards
  useEffect(() => {
    if (!demo || !result || phase !== "revealing") return;
    const timeouts = result.cards.map((_, i) =>
      window.setTimeout(() => {
        setCurrentCardIndex(i);
        revealCard(i);
      }, 400 + i * 800),
    );
    return () => timeouts.forEach(clearTimeout);
  }, [demo, phase, result, revealCard]);

  // Done → onContinue after delay
  useEffect(() => {
    if (!result || !onContinue || phase !== "done") return;
    const t = window.setTimeout(() => onContinue(result), 3000);
    return () => clearTimeout(t);
  }, [onContinue, phase, result]);

  /* ---------- derived ---------- */
  const showPack = phase === "idle" || phase === "opening" || phase === "error";
  const showCards = phase === "revealing" || phase === "done";
  const newCards = result ? result.cards.filter((c) => c.ownedCount <= 1).length : 0;
  const duplicates = result ? result.cards.length - newCards : 0;
  const bonusWon = Boolean(result?.bonusPrize);

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">

      {/* ==================== PACK PHASE ==================== */}
      {showPack && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-16">
          {/* Pack number */}
          <p className="mb-4 font-mono text-[11px] font-semibold tracking-wider text-white/40">
            {packNumber}
          </p>

          {/* Booster pack — explicit h/w so children resolve fill */}
          <div className="relative h-[336px] w-56 sm:h-[384px] sm:w-64 md:h-[432px] md:w-72">
            {/* Light burst */}
            <div
              className={`absolute inset-x-[15%] top-[12%] h-[55%] rounded-full bg-white/80 blur-3xl transition-opacity duration-500 ${
                phase === "opening" ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Mystery card behind */}
            <div
              className={`absolute inset-[8%] z-0 overflow-hidden rounded-2xl bg-[#111] transition-all duration-700 ${
                phase === "opening" ? "scale-[1.02] opacity-100" : "scale-90 opacity-0"
              }`}
            >
              <Image
                src={CARD_BACK_IMAGE_SRC}
                alt="Dos de carte"
                fill
                sizes="(max-width: 768px) 224px, 288px"
                className="object-cover rounded-2xl"
              />
            </div>

            {/* Swipe-to-cut overlay */}
            <PackSwipeCut
              onThresholdReached={() => void beginOpening()}
              disabled={disabled || !canStart}
              splitting={phase === "opening"}
            />
          </div>

          {/* Hint text */}
          {phase === "idle" && (
            <p className="mt-8 text-center text-sm font-semibold text-white/50">
              ← Glissez horizontalement pour ouvrir →
            </p>
          )}
          {phase === "opening" && (
            <p className="mt-8 text-center text-sm font-semibold text-white/50">
              Ouverture en cours…
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-lg bg-red-900/50 px-4 py-2 text-center text-sm font-semibold text-red-300">
              {error}
            </p>
          )}

          {/* Button — bottom-right */}
          {(phase === "idle" || phase === "error") && (
            <button
              type="button"
              className="fixed bottom-6 right-6 z-40 rounded-full bg-white/15 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm transition-colors hover:bg-white/25"
              onClick={() => void beginOpening()}
              disabled={disabled}
            >
              {phase === "error" ? "Réessayer" : "Ouvrir le pack"}
            </button>
          )}
        </div>
      )}

      {/* ==================== CARDS PHASE — FULL-SCREEN CAROUSEL ==================== */}
      {showCards && result && (
        <div className="relative flex flex-1 flex-col">
          {/* Counter */}
          <div className="flex items-center justify-center px-4 pt-4">
            <p className="text-sm font-semibold text-white/60">
              {currentCardIndex + 1} / {totalCards}
            </p>
          </div>

          {/* Card area with arrows */}
          <div className="relative flex flex-1 items-center justify-center px-14 py-4 sm:px-20">
            {/* Left arrow */}
            <ArrowButton
              direction="left"
              onClick={() => goToCard("prev")}
              disabled={currentCardIndex === 0}
            />

            {/* Current card — large, centered */}
            <div className="h-full max-h-[72vh] w-full max-w-sm">
              <FlipCard
                key={`${result.ticketId}-${currentCardIndex}-${result.cards[currentCardIndex].id}`}
                card={result.cards[currentCardIndex]}
                revealed={revealedIndexes.includes(currentCardIndex)}
                canReveal={phase === "revealing" && !revealedIndexes.includes(currentCardIndex)}
                onReveal={() => revealCard(currentCardIndex)}
              />
            </div>

            {/* Right arrow */}
            <ArrowButton
              direction="right"
              onClick={() => goToCard("next")}
              disabled={currentCardIndex >= totalCards - 1}
            />
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 pb-2">
            {result.cards.map((card, i) => (
              <button
                key={`${result.ticketId}-${i}-${card.id}`}
                type="button"
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  i === currentCardIndex
                    ? "scale-125 bg-white"
                    : revealedIndexes.includes(i)
                      ? "bg-white/40"
                      : "bg-white/15"
                }`}
                onClick={() => setCurrentCardIndex(i)}
                aria-label={`Carte ${i + 1}`}
              />
            ))}
          </div>

          {/* Status / action text */}
          <div className="px-4 pb-3 text-center">
            {phase === "revealing" && !revealedIndexes.includes(currentCardIndex) && (
              <p className="text-sm font-semibold text-white/50">
                Touchez la carte pour la révéler
              </p>
            )}
            {phase === "revealing" && revealedIndexes.includes(currentCardIndex) && (
              <p className="text-sm font-semibold text-white/50">
                {revealedIndexes.length < totalCards
                  ? `${revealedIndexes.length}/${totalCards} révélée(s) — passez à la suivante`
                  : ""}
              </p>
            )}
          </div>

          {/* Recap stats — appears when done */}
          {phase === "done" && (
            <div className="mx-4 mb-2 animate-[packFadeIn_0.4s_ease] rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
                <span>
                  <span className="font-bold text-white/80">Collection</span>{" "}
                  {result.inventory.uniqueOwned}/{result.inventory.totalCards}
                </span>
                <span>
                  <span className="font-bold text-white/80">Doublons</span>{" "}
                  {result.inventory.duplicateCopies}
                </span>
                <span>
                  <span className="font-bold text-white/80">{newCards} nouvelle(s)</span>,{" "}
                  {duplicates} doublon(s)
                </span>
                {bonusWon && (
                  <span>
                    <span className="font-bold text-white/80">Bonus gagne</span>{" "}
                    {result?.bonusPrize?.title}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Continue button */}
          {phase === "done" && (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                className="rounded-full bg-white/15 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm transition-colors hover:bg-white/25"
                onClick={() => result && onContinue?.(result)}
              >
                Continuer
              </button>
            </div>
          )}

          {/* Demo replay */}
          {demo && phase === "done" && (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                className="text-xs font-semibold text-white/40 underline underline-offset-2 hover:text-white/60"
                onClick={reset}
              >
                Rejouer la démo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
