"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, type TouchEvent } from "react";
import { TutorialPackDemo } from "@/components/tutorial/TutorialPackDemo";
import type { TutorialStep } from "@/data/tutorial-steps";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type TutorialOverlayProps = {
  active: boolean;
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

export function TutorialOverlay({
  active,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TutorialOverlayProps) {
  const touchStartXRef = useRef<number | null>(null);
  useBodyScrollLock(active);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current;
      const endX = event.changedTouches[0]?.clientX ?? null;
      touchStartXRef.current = null;

      if (startX == null || endX == null) return;

      const deltaX = endX - startX;
      const swipeThreshold = 48;

      if (Math.abs(deltaX) < swipeThreshold) return;

      if (deltaX < 0) onNext();
      else onPrev();
    },
    [onNext, onPrev],
  );

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") onNext();
      else if (event.key === "ArrowLeft") onPrev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onNext, onPrev]);

  useEffect(() => {
    if (!active) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [active, step.id]);

  if (!active) return null;

  const isLast = stepIndex === totalSteps - 1;
  const isPackDemo = step.variant === "pack-demo" || step.variant === "scratch-demo";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tutoriel guide"
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="h-full w-full overflow-hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          key={step.id}
          className="flex h-full w-full items-center justify-center px-4 py-8 motion-safe:animate-[producerModalPopIn_220ms_ease-out]"
        >
          <div
            className={`cartoon-border flex w-full flex-col bg-cream text-ink ${
              isPackDemo
                ? "max-h-[calc(100vh-48px)] max-w-xl"
                : "max-h-[520px] max-w-lg"
            } overflow-hidden p-5 md:p-7`}
          >
            <div className="flex items-center gap-3 pb-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white md:h-14 md:w-14">
                <Image src="/sylvain.png" alt="Sylvain" fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-charcoal/60">
                  {stepIndex + 1} / {totalSteps}
                </p>
                <h2 className="font-display text-xl leading-tight md:text-2xl">{step.title}</h2>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {step.text.trim().length > 0 ? (
                <p className="text-sm leading-relaxed text-charcoal md:text-base">{step.text}</p>
              ) : null}
              {step.details && step.details.length > 0 ? (
                <ul className={`${step.text.trim().length > 0 ? "mt-3" : "mt-0"} grid gap-1.5 text-sm text-ink`}>
                  {step.details.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="shrink-0 text-[#d35400]">▶</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {isPackDemo ? <TutorialPackDemo /> : null}
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-[#1a1a1a]/10 pt-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, indicatorIndex) => (
                  <div
                    key={indicatorIndex}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      indicatorIndex === stepIndex
                        ? "w-5 bg-[#d35400]"
                        : indicatorIndex < stepIndex
                          ? "w-2 bg-[#d35400]/40"
                          : "w-2 bg-[#1a1a1a]/15"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                  onClick={onSkip}
                >
                  Passer
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-9 px-3 text-xs"
                  onClick={onNext}
                >
                  {isLast ? "C&apos;est parti !" : "Suivant"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
