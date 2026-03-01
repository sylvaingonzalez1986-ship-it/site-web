"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import {
  rarityLabels,
  rarityShellClasses,
  rarityGlowClasses,
  rarityBackdropClasses,
} from "@/lib/lottery-card-ui";
import type { LotteryCardRarity, ScratchResult } from "@/types/lottery";

type PackAnimationPhase = "idle" | "tapping" | "opening" | "revealing" | "done" | "error";

type PackOpeningAnimationProps = {
  packNumber: string;
  onOpen: () => Promise<ScratchResult>;
  onContinue?: (result: ScratchResult) => void;
  disabled?: boolean;
  demo?: boolean;
  compact?: boolean;
};

const CARD_BACK_IMAGE_SRC = "/app/lottery/tcg-card-back.png";
const SEALED_BOOSTER_IMAGE_SRC = "/app/lottery/sealed-booster-pack.png";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function resolvePhaseLabel(phase: PackAnimationPhase, result: ScratchResult | null, demo: boolean): string {
  if (phase === "idle") {
    return demo ? "Demo booster - tapez pour lancer l'ouverture" : "Tapez sur le booster pour reveler vos 3 cartes";
  }

  if (phase === "tapping") {
    return "Le booster reagit...";
  }

  if (phase === "opening") {
    return "Ouverture du booster en cours...";
  }

  if (phase === "revealing") {
    return result?.card.rarity === "legendary"
      ? "Les 3 cartes sortent du pack. Clique sur chaque dos pour les reveler."
      : "Les 3 cartes sortent du pack. Clique sur chaque dos pour les reveler.";
  }

  if (phase === "done" && result) {
    const newCards = result.cards.filter((card) => card.ownedCount <= 1).length;
    const duplicates = result.cards.length - newCards;
    return `${result.cards.length} cartes revelees, ${newCards} nouvelle(s), ${duplicates} doublon(s)`;
  }

  return "Impossible d'ouvrir ce booster.";
}

function renderPackRevealCard(card: ScratchResult["cards"][number], index: number) {
  const cardRotation = index === 0 ? "-8deg" : index === 1 ? "0deg" : "8deg";

  return (
    <div
      key={`${card.id}-${index}`}
      className={`relative overflow-hidden rounded-[24px] border-[4px] border-[#1a1a1a] ${rarityShellClasses[card.rarity]} ${rarityGlowClasses[card.rarity]}`}
      style={{
        transform: `rotate(${cardRotation})`,
      }}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.11em]">{card.collectionTitle}</p>
          <span className="rounded-full border-2 border-current px-2 py-1 text-[10px] font-black uppercase">
            #{card.cardNumber}
          </span>
        </div>

        <div className="mt-3 flex-1 overflow-hidden rounded-[18px] border-[3px] border-current/50 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.55)_58%,rgba(255,255,255,0.3)_100%)]">
          <div className="relative h-full min-h-[220px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.02)_100%)]">
            {isRenderableImageSource(card.imageUrl) ? (
              <div className="absolute inset-3">
                {isRemoteImageUrl(card.imageUrl) ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="h-full w-full object-contain object-center drop-shadow-[0_16px_24px_rgba(0,0,0,0.18)]"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    fill
                    sizes="320px"
                    className="object-contain object-center drop-shadow-[0_16px_24px_rgba(0,0,0,0.18)]"
                  />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-white/35 px-4 text-center">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]">Carte revelee</p>
                  <p className="mt-2 font-display text-xl leading-tight">{card.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-[16px] border-[3px] border-current/35 bg-white/60 p-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.12em]">{rarityLabels[card.rarity]}</p>
          <p className="mt-2 font-display text-[1.15rem] leading-tight">{card.name}</p>
          <p className="mt-2 text-xs font-semibold">
            {card.ownedCount > 1 ? `Doublon x${card.ownedCount}` : "Nouvelle carte"}
          </p>
        </div>
      </div>
    </div>
  );
}

function renderCardBack(index: number, isClickable: boolean) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[24px] border-[4px] border-[#1a1a1a] bg-[#091013] shadow-[0_18px_36px_rgba(16,23,47,0.28)] ${
        isClickable ? "cursor-pointer" : ""
      }`}
      style={{ transform: `rotate(${index === 0 ? "-4deg" : index === 1 ? "0deg" : "4deg"})` }}
    >
      <Image src={CARD_BACK_IMAGE_SRC} alt="Dos de carte TCG" fill sizes="220px" className="object-cover" priority />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_42%)]" />
    </div>
  );
}

function renderSparkles(rarity: LotteryCardRarity | null) {
  if (!rarity || rarity === "common") {
    return null;
  }

  const sparkles = [
    { top: "10%", left: "12%", size: "h-2 w-2" },
    { top: "18%", right: "14%", size: "h-3 w-3" },
    { top: "30%", left: "8%", size: "h-2.5 w-2.5" },
    { top: "34%", right: "10%", size: "h-2 w-2" },
    { bottom: "26%", left: "14%", size: "h-2 w-2" },
    { bottom: "18%", right: "16%", size: "h-3 w-3" },
  ];

  const className =
    rarity === "silver"
      ? "bg-white/85"
      : rarity === "gold"
        ? "bg-[#fff6bf]"
        : rarity === "epic"
          ? "bg-[#ffd9ff]"
          : "bg-[#fff4d3]";

  return sparkles.map((sparkle, index) => (
    <span
      key={`${rarity}-sparkle-${index}`}
      className={`absolute ${sparkle.size} rounded-full ${className} shadow-[0_0_18px_rgba(255,255,255,0.75)]`}
      style={sparkle}
    />
  ));
}

function renderRevealEffects(rarity: LotteryCardRarity | null, phase: PackAnimationPhase) {
  if (!rarity || (phase !== "revealing" && phase !== "done")) {
    return null;
  }

  if (rarity === "common") {
    return (
      <div className="pointer-events-none absolute inset-[8%] rounded-[28px] border-[3px] border-white/60 shadow-[0_0_28px_rgba(255,255,255,0.5)]" />
    );
  }

  if (rarity === "silver") {
    return (
      <>
        <div className="pointer-events-none absolute inset-[3%] rounded-[30px] border-[3px] border-white/80 opacity-90" />
        <div className="pointer-events-none absolute inset-x-[18%] top-[6%] h-[84%] rounded-full bg-white/55 blur-3xl" />
        {[
          "rotate-0",
          "rotate-[20deg]",
          "rotate-[-20deg]",
          "rotate-[40deg]",
          "rotate-[-40deg]",
        ].map((rotation) => (
          <div
            key={`silver-ray-${rotation}`}
            className={`pointer-events-none absolute inset-[14%] rounded-full border border-white/35 ${rotation}`}
          />
        ))}
      </>
    );
  }

  if (rarity === "gold") {
    const stars = [
      { top: "8%", left: "18%", size: "h-5 w-5" },
      { top: "16%", right: "14%", size: "h-4 w-4" },
      { top: "52%", left: "10%", size: "h-4 w-4" },
      { top: "64%", right: "12%", size: "h-5 w-5" },
      { bottom: "10%", left: "26%", size: "h-4 w-4" },
      { bottom: "16%", right: "24%", size: "h-4 w-4" },
    ];

    return (
      <>
        <div className="pointer-events-none absolute inset-[2%] rounded-[30px] bg-[radial-gradient(circle,rgba(255,243,186,0.3)_0%,rgba(255,243,186,0)_68%)]" />
        {stars.map((star, index) => (
          <span
            key={`gold-star-${index}`}
            className={`pointer-events-none absolute ${star.size} rotate-45 bg-[#fff4af] shadow-[0_0_22px_rgba(255,234,128,0.95)]`}
            style={star}
          />
        ))}
      </>
    );
  }

  if (rarity === "epic") {
    return (
      <>
        <div className="pointer-events-none absolute inset-[1%] rounded-[32px] bg-[radial-gradient(circle,rgba(255,224,255,0.22)_0%,rgba(255,224,255,0)_64%)]" />
        <div className="pointer-events-none absolute inset-[6%] rounded-[28px] border-[3px] border-[#ffd7ff]/70 shadow-[0_0_34px_rgba(234,170,255,0.9)]" />
        {[
          "rotate-0",
          "rotate-[30deg]",
          "rotate-[-30deg]",
          "rotate-[60deg]",
          "rotate-[-60deg]",
        ].map((rotation) => (
          <div
            key={`epic-burst-${rotation}`}
            className={`pointer-events-none absolute inset-[12%] rounded-full border border-[#ffd5ff]/35 ${rotation}`}
          />
        ))}
      </>
    );
  }

  const stars = [
    { top: "4%", left: "12%", size: "h-6 w-6" },
    { top: "10%", right: "10%", size: "h-5 w-5" },
    { top: "28%", left: "5%", size: "h-4 w-4" },
    { top: "38%", right: "6%", size: "h-5 w-5" },
    { bottom: "18%", left: "8%", size: "h-5 w-5" },
    { bottom: "10%", right: "14%", size: "h-6 w-6" },
  ];

  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,247,201,0.3)_0%,rgba(255,247,201,0)_62%)]" />
      <div className="pointer-events-none absolute inset-[4%] rounded-[30px] border-[3px] border-[#fff0b9]/85 shadow-[0_0_54px_rgba(255,215,111,0.95)]" />
      {[
        "rotate-0",
        "rotate-[24deg]",
        "rotate-[-24deg]",
        "rotate-[48deg]",
        "rotate-[-48deg]",
        "rotate-[72deg]",
        "rotate-[-72deg]",
      ].map((rotation) => (
        <div
          key={`legendary-ray-${rotation}`}
          className={`pointer-events-none absolute inset-[10%] rounded-full border border-[#ffe5a4]/30 ${rotation}`}
        />
      ))}
      {stars.map((star, index) => (
        <span
          key={`legendary-star-${index}`}
          className={`pointer-events-none absolute ${star.size} rotate-45 bg-[#fff5ca] shadow-[0_0_28px_rgba(255,239,171,1)]`}
          style={star}
        />
      ))}
    </>
  );
}

function renderRevealFlipCard(
  card: ScratchResult["cards"][number],
  index: number,
  phase: PackAnimationPhase,
  revealedIndexes: number[],
  onReveal: (index: number) => void,
) {
  const revealed = revealedIndexes.includes(index);

  return (
    <div
      key={`${card.id}-${index}-wrap`}
      className="min-w-[78vw] snap-center transition-all duration-700 sm:min-w-[62vw] md:min-w-0"
      style={{
        transitionDelay: `${index * 120}ms`,
        transform:
          phase === "revealing" || phase === "done"
            ? "translateY(0px) scale(1)"
            : "translateY(28px) scale(0.92)",
        opacity: phase === "revealing" || phase === "done" ? 1 : 0.88,
      }}
    >
      <div
        className="relative h-full min-h-[440px] [perspective:1400px] md:min-h-[560px]"
        onClick={() => onReveal(index)}
        role="button"
        tabIndex={phase === "revealing" && !revealed ? 0 : -1}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && phase === "revealing") {
            event.preventDefault();
            onReveal(index);
          }
        }}
        aria-label={revealed ? `Carte ${card.name} revelee` : `Reveler la carte ${index + 1}`}
      >
        <div
          className="relative h-full w-full transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            {renderCardBack(index, phase === "revealing" && !revealed)}
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            {renderPackRevealCard(card, index)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PackOpeningAnimation({
  packNumber,
  onOpen,
  onContinue,
  disabled = false,
  demo = false,
  compact = false,
}: PackOpeningAnimationProps) {
  const [phase, setPhase] = useState<PackAnimationPhase>("idle");
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedIndexes, setRevealedIndexes] = useState<number[]>([]);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
  }, []);

  const activeRarity = result?.card.rarity ?? null;
  const phaseLabel = resolvePhaseLabel(phase, result, demo);
  const canStart = !disabled && (phase === "idle" || phase === "error");
  const canReplay = demo && (phase === "done" || phase === "error");

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setResult(null);
    setError(null);
    setRevealedIndexes([]);
  }, []);

  const beginOpening = useCallback(async () => {
    if (!canStart) {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setError(null);
    setResult(null);
    setRevealedIndexes([]);
    setPhase("tapping");

    const openPromise = Promise.resolve().then(() => onOpen());
    let nextResult: ScratchResult;

    try {
      await sleep(220);
      if (!mountedRef.current || runIdRef.current !== runId) {
        return;
      }

      setPhase("opening");
      nextResult = await openPromise;
    } catch (openError) {
      if (!mountedRef.current || runIdRef.current !== runId) {
        return;
      }

      setPhase("error");
      setError(openError instanceof Error ? openError.message : "Impossible d'ouvrir ce booster.");
      return;
    }

    if (!mountedRef.current || runIdRef.current !== runId) {
      return;
    }

    setResult(nextResult);
    await sleep(180);
    if (!mountedRef.current || runIdRef.current !== runId) {
      return;
    }

    setPhase("revealing");
  }, [canStart, onOpen]);

  const revealCard = useCallback(
    (index: number) => {
      if (!result || phase !== "revealing") {
        return;
      }

      setRevealedIndexes((current) => {
        if (current.includes(index)) {
          return current;
        }

        const next = [...current, index].sort((left, right) => left - right);
        if (next.length >= result.cards.length) {
          setPhase("done");
        }
        return next;
      });
    },
    [phase, result],
  );

  useEffect(() => {
    if (!demo || !result || phase !== "revealing") {
      return;
    }

    const timeouts = result.cards.map((_, index) =>
      window.setTimeout(() => {
        revealCard(index);
      }, 320 + index * 260),
    );

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [demo, phase, result, revealCard]);

  useEffect(() => {
    if (!result || !onContinue || phase !== "done") {
      return;
    }

    const timeout = window.setTimeout(() => {
      onContinue(result);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [onContinue, phase, result]);

  const backdropClasses = activeRarity
    ? rarityBackdropClasses[activeRarity]
    : "bg-[radial-gradient(circle_at_top,rgba(255,252,245,0.96)_0%,rgba(245,235,214,0.92)_56%,rgba(235,221,201,0.9)_100%)]";

  const packSurface = useMemo(
    () => (
      <div className="absolute inset-0 overflow-hidden rounded-[30px]">
        <Image
          src={SEALED_BOOSTER_IMAGE_SRC}
          alt="Booster scelle Hemp Heroes"
          fill
          sizes="(max-width: 768px) 240px, 280px"
          className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.32)]"
          priority
        />
      </div>
    ),
    [],
  );

  const showPackShell = phase === "idle" || phase === "tapping" || phase === "opening" || phase === "error";
  const showRevealedCard = Boolean(result) && (phase === "revealing" || phase === "done");

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border-[3px] border-[#1a1a1a] ${backdropClasses} ${
        compact ? "p-4" : "p-4 md:p-6"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ${
          activeRarity === "legendary" && phase === "revealing" ? "opacity-100" : "opacity-0"
        } bg-white/55`}
      />
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-x-[12%] top-[6%] h-28 rounded-full bg-white/35 blur-3xl" />
        <div className="absolute inset-x-[20%] bottom-[8%] h-24 rounded-full bg-[#ffd16f]/30 blur-3xl" />
        {renderSparkles(activeRarity)}
      </div>

      {showRevealedCard && result ? (
        <div className="relative z-10 py-2 md:py-6">
          <div className="relative min-h-[460px] md:min-h-[620px]">
            {renderRevealEffects(result.card.rarity, phase)}
            <div className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-6 md:pb-0">
              {result.cards.map((card, index) =>
                renderRevealFlipCard(card, index, phase, revealedIndexes, revealCard),
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={`relative z-10 ${compact ? "grid gap-3" : "grid gap-5 md:grid-cols-[280px_1fr] md:items-start"}`}>
          <div className="rounded-[20px] border-[3px] border-[#1a1a1a] bg-white/55 p-3">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
              {demo ? "Booster demo" : "Ouverture de booster"}
            </p>
            <div className="relative mx-auto mt-3 aspect-[2/3] w-full max-w-[240px] [perspective:1400px]">
              <div
                className={`absolute inset-0 rounded-[34px] transition-all duration-300 ${
                  phase === "tapping" ? "scale-[1.03] rotate-[1.5deg]" : "scale-100 rotate-0"
                } ${phase === "error" ? "opacity-90" : "opacity-100"}`}
              >
                {showPackShell && (
                  <>
                    <div
                      className={`absolute inset-0 transition-all duration-700 ${
                        phase === "opening"
                          ? "translate-y-[-42%] opacity-0"
                          : "translate-y-0 opacity-100"
                      }`}
                      style={{ clipPath: "polygon(0 0, 100% 0, 100% 52%, 0 52%)" }}
                    >
                      {packSurface}
                    </div>
                    <div
                      className={`absolute inset-0 transition-all duration-700 ${
                        phase === "opening"
                          ? "translate-y-[42%] opacity-0"
                          : "translate-y-0 opacity-100"
                      }`}
                      style={{ clipPath: "polygon(0 48%, 100% 48%, 100% 100%, 0 100%)" }}
                    >
                      {packSurface}
                    </div>
                  </>
                )}

                <div
                  className={`absolute inset-[8%] rounded-[26px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96)_0%,rgba(229,238,246,0.92)_52%,rgba(170,186,204,0.95)_100%)] transition-all duration-700 ${
                    phase === "opening" ? "scale-[1.03] opacity-100" : "scale-90 opacity-0"
                  }`}
                >
                  <div className="absolute inset-[7%] rounded-[22px] border-[3px] border-[#1a1a1a] bg-[linear-gradient(180deg,#2c4c66_0%,#0e2234_100%)]" />
                  <div className="absolute inset-[18%] rounded-full border-[3px] border-[#f6d77b] bg-[radial-gradient(circle,#ffe39b_0%,#f6c44e_45%,#c7891a_100%)]" />
                  <div className="absolute inset-x-[22%] bottom-[12%] rounded-[16px] border-[3px] border-[#1a1a1a] bg-white/80 px-3 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-charcoal">Carte mystere</p>
                  </div>
                </div>

                <div
                  className={`absolute inset-x-[18%] top-[16%] h-[52%] rounded-full bg-white/90 blur-3xl transition-opacity duration-500 ${
                    phase === "opening" || phase === "revealing" ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            </div>

            {error && <p className="mt-3 text-center text-sm font-semibold text-red-700">{error}</p>}
          </div>

          <div className={`rounded-[20px] border-[3px] border-[#1a1a1a] bg-white/70 ${compact ? "p-4" : "p-5"}`}>
            <p className="text-xs font-black uppercase tracking-[0.11em] text-charcoal">
              {demo ? "Demo pack opening" : "Booster actif"}
            </p>
            <p className="mt-2 font-mono text-xs font-semibold text-ink">{packNumber}</p>
            <h3 className="mt-3 font-display text-3xl text-ink">
              {phase === "done" && result ? "3 cartes revelees" : "Ouverture de pack"}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-charcoal">{phaseLabel}</p>

            <div className="mt-4 rounded-[16px] border-[2px] border-[#1a1a1a] bg-[#f8f3e8] p-3 text-sm text-charcoal">
              <p className="text-[11px] font-black uppercase tracking-[0.11em] text-ink">
              {phase === "done" && result ? "Resume du booster" : "Comment ca marche"}
              </p>
              {phase === "done" && result ? (
                <div className="mt-2 grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">Collection</span>
                    <span>
                      {result.inventory.uniqueOwned}/{result.inventory.totalCards} uniques
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
              ) : (
                <ul className="mt-2 grid gap-1">
                  <li>- 1 pack revele 3 cartes.</li>
                  <li>- Le tirage est calcule cote serveur.</li>
                  <li>- Clique sur chaque dos de carte pour retourner le pack complet.</li>
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(phase === "idle" || phase === "error") && (
                <button
                  type="button"
                  className="btn-cartoon btn-primary inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                  onClick={() => void beginOpening()}
                  disabled={disabled}
                >
                  {phase === "error" ? "Reessayer l'ouverture" : "Ouvrir le pack"}
                </button>
              )}

              {(phase === "tapping" || phase === "opening") && (
                <div className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                  Ouverture en cours...
                </div>
              )}

              {phase === "revealing" && (
                <div className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                  Retourne les 3 cartes
                </div>
              )}

              {phase === "done" && result && !onContinue && (
                <div className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none">
                  Reveal termine
                </div>
              )}

              {canReplay && (
                <button
                  type="button"
                  className="btn-cartoon btn-secondary inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                  onClick={reset}
                >
                  Rejouer la demo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
