"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, type TouchEvent } from "react";
import { TutorialPackDemo } from "@/components/tutorial/TutorialPackDemo";
import { HOME_TUTORIAL_STEPS } from "@/data/tutorial-steps";
import type { TutorialStep } from "@/data/tutorial-steps";

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
      const SWIPE_THRESHOLD = 48;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

      if (deltaX < 0) {
        onNext();
      } else {
        onPrev();
      }
    },
    [onNext, onPrev],
  );

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onNext, onPrev]);

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
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${stepIndex * 100}%)` }}
        >
          {HOME_TUTORIAL_STEPS.map((s, i) => {
            const isCurrentPackDemo = s.variant === "pack-demo" || s.variant === "scratch-demo";
            return (
              <div
                key={s.id}
                className="flex h-full w-full shrink-0 items-center justify-center px-4 py-8"
              >
                <div
                  className={`cartoon-border flex w-full flex-col bg-cream text-ink ${
                    isCurrentPackDemo
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
                        {i + 1} / {totalSteps}
                      </p>
                      <h2 className="font-display text-xl leading-tight md:text-2xl">{s.title}</h2>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {s.text.trim().length > 0 ? (
                      <p className="text-sm leading-relaxed text-charcoal md:text-base">{s.text}</p>
                    ) : null}
                    {s.details && s.details.length > 0 ? (
                      <ul className={`${s.text.trim().length > 0 ? "mt-3" : "mt-0"} grid gap-1.5 text-sm text-ink`}>
                        {s.details.map((line) => (
                          <li key={line} className="flex gap-2">
                            <span className="shrink-0 text-[#d35400]">▸</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {isCurrentPackDemo ? <TutorialPackDemo /> : null}
                  </div>

                  <div className="mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-[#1a1a1a]/10 pt-3">
                    <div className="flex items-center gap-1.5">
                      {HOME_TUTORIAL_STEPS.map((_, di) => (
                        <div
                          key={di}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            di === stepIndex
                              ? "w-5 bg-[#d35400]"
                              : di < stepIndex
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
                        {isLast ? "C'est parti !" : "Suivant"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
