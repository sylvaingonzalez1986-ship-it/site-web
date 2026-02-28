"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { TutorialScratchDemo } from "@/components/tutorial/TutorialScratchDemo";
import type { TutorialStep } from "@/data/tutorial-steps";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type BubblePosition = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
};

type TutorialOverlayProps = {
  active: boolean;
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

const MIN_GAP = 14;
const DEFAULT_SPOTLIGHT_PADDING = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getViewportRect(): Rect {
  if (typeof window === "undefined") {
    return {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
  };
}

export function TutorialOverlay({
  active,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewportRect, setViewportRect] = useState<Rect>(getViewportRect());

  useEffect(() => {
    if (!active) {
      return;
    }

    let animationFrame = 0;

    const computeRect = () => {
      setViewportRect(getViewportRect());
      if (!step.target) {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(step.target);
      if (!(element instanceof HTMLElement)) {
        setTargetRect(null);
        return;
      }

      const elementRect = element.getBoundingClientRect();
      const padding = step.spotlightPadding ?? DEFAULT_SPOTLIGHT_PADDING;
      const nextRect: Rect = {
        top: Math.max(elementRect.top - padding, 0),
        left: Math.max(elementRect.left - padding, 0),
        width: Math.min(elementRect.width + padding * 2, window.innerWidth),
        height: Math.min(elementRect.height + padding * 2, window.innerHeight),
        right: Math.min(elementRect.right + padding, window.innerWidth),
        bottom: Math.min(elementRect.bottom + padding, window.innerHeight),
      };

      setTargetRect(nextRect);
    };

    const scheduleCompute = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(computeRect);
    };

    computeRect();

    // Poll for the target element every 500ms until found (handles race
    // conditions after route changes where the DOM isn't ready yet).
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    if (step.target) {
      pollingInterval = setInterval(() => {
        const el = document.querySelector(step.target!);
        if (el instanceof HTMLElement) {
          computeRect();
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        }
      }, 500);
    }

    window.addEventListener("resize", scheduleCompute);
    window.addEventListener("scroll", scheduleCompute, true);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      window.removeEventListener("resize", scheduleCompute);
      window.removeEventListener("scroll", scheduleCompute, true);
    };
  }, [active, step.id, step.target, step.spotlightPadding]);

  useEffect(() => {
    if (!active || !step.target) {
      return;
    }

    const element = document.querySelector(step.target);
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [active, step.id, step.target]);

  const bubblePosition: BubblePosition = useMemo(() => {
    const isMobile = viewportRect.width < 768;
    const estimatedBubbleHeight = step.variant === "scratch-demo" ? 560 : 300;
    if (isMobile) {
      return {
        left: 12,
        right: 12,
        bottom: 12,
      };
    }

    const bubbleWidth = Math.min(430, viewportRect.width - MIN_GAP * 2);
    if (!targetRect) {
      return {
        width: bubbleWidth,
        left: clamp((viewportRect.width - bubbleWidth) / 2, MIN_GAP, viewportRect.width - bubbleWidth - MIN_GAP),
        top: clamp(viewportRect.height * 0.18, MIN_GAP, viewportRect.height - estimatedBubbleHeight),
      };
    }

    const preferredTop = targetRect.bottom + 18;
    const hasRoomBelow = preferredTop + estimatedBubbleHeight < viewportRect.height;
    const hasRoomAbove = targetRect.top - estimatedBubbleHeight > MIN_GAP;
    const left = clamp(
      targetRect.left + targetRect.width / 2 - bubbleWidth / 2,
      MIN_GAP,
      viewportRect.width - bubbleWidth - MIN_GAP,
    );

    if (hasRoomBelow) {
      return {
        width: bubbleWidth,
        top: preferredTop,
        left,
      };
    }

    if (hasRoomAbove) {
      return {
        width: bubbleWidth,
        top: targetRect.top - estimatedBubbleHeight,
        left,
      };
    }

    return {
      width: bubbleWidth,
      top: clamp(
        (viewportRect.height - estimatedBubbleHeight) / 2,
        MIN_GAP,
        viewportRect.height - estimatedBubbleHeight - MIN_GAP,
      ),
      left,
    };
  }, [step.variant, targetRect, viewportRect.height, viewportRect.width]);

  if (!active) {
    return null;
  }

  const progressLabel = `${stepIndex + 1}/${totalSteps}`;
  const canGoBack = stepIndex > 0;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutoriel guide">
      {targetRect ? (
        <>
          <div
            className="fixed left-0 top-0 bg-black/70"
            style={{ width: "100vw", height: `${targetRect.top}px` }}
          />
          <div
            className="fixed left-0 bg-black/70"
            style={{
              top: `${targetRect.top}px`,
              width: `${targetRect.left}px`,
              height: `${targetRect.height}px`,
            }}
          />
          <div
            className="fixed bg-black/70"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.right}px`,
              width: `${Math.max(viewportRect.width - targetRect.right, 0)}px`,
              height: `${targetRect.height}px`,
            }}
          />
          <div
            className="fixed left-0 bg-black/70"
            style={{
              top: `${targetRect.bottom}px`,
              width: "100vw",
              height: `${Math.max(viewportRect.height - targetRect.bottom, 0)}px`,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-lg border-2 border-[#f7efc9] shadow-[0_0_0_4px_rgba(247,239,201,0.25)] transition-all duration-300"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      <div
        className="fixed"
        style={{
          top: bubblePosition.top,
          left: bubblePosition.left,
          right: bubblePosition.right,
          bottom: bubblePosition.bottom,
          width: bubblePosition.width,
        }}
      >
        <div className="cartoon-border max-h-[calc(100vh-24px)] overflow-y-auto bg-cream p-4 text-ink md:p-5">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
              <Image src="/charles.png" alt="Charles" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Tutoriel {progressLabel}</p>
              <h2 className="mt-1 font-display text-2xl leading-tight">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal">{step.text}</p>
              {step.details && step.details.length > 0 && (
                <ul className="mt-3 grid gap-1 text-sm text-ink">
                  {step.details.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              )}
              {step.variant === "scratch-demo" && <TutorialScratchDemo />}
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full border border-[#1a1a1a] bg-white">
            <div
              className="h-full bg-[#d35400] transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-cartoon btn-secondary h-10 px-3 text-xs" onClick={onSkip}>
              Passer
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-cartoon btn-secondary h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onPrev}
                disabled={!canGoBack}
              >
                Precedent
              </button>
              <button type="button" className="btn-cartoon btn-primary h-10 px-3 text-xs" onClick={onNext}>
                {stepIndex === totalSteps - 1 ? "Terminer" : "Suivant"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
