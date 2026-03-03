"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

type ProducerCarouselProps = {
  /** Number of real (non-cloned) items */
  itemCount: number;
  /** Enable infinite loop (clones expected in children) */
  loop?: boolean;
  children: ReactNode;
};

const SCROLL_SPEED = 3; // px per frame
const GAP = 16; // matches gap-4 (1rem)

/**
 * Infinite-loop carousel for TCG producer cards.
 *
 * – Mobile: native horizontal swipe (scrollbar hidden via CSS).
 * – Desktop: hover-to-scroll arrows that loop continuously.
 *
 * To achieve infinite loop on desktop we duplicate the children
 * (done by the parent passing duplicated elements) and silently
 * reset scrollLeft when crossing the seam.
 */
export function ProducerCarousel({
  itemCount,
  loop = true,
  children,
}: ProducerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const dirRef = useRef<-1 | 1>(1);

  /* ---- Width of all *real* items (first half of the track) ---- */
  const getRealWidth = useCallback(() => {
    const track = trackRef.current;
    if (!track || itemCount === 0) return 0;
    // Each real item occupies itemWidth + gap, minus the trailing gap
    const totalChildren = track.children.length;
    const realCount = Math.min(itemCount, totalChildren);
    let width = 0;
    for (let i = 0; i < realCount; i++) {
      width += (track.children[i] as HTMLElement).offsetWidth + GAP;
    }
    return width; // includes trailing gap — that's fine for wrapping
  }, [itemCount]);

  /* ---- Seamless loop reset ---- */
  const clampScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const realWidth = getRealWidth();
    if (realWidth <= 0) return;

    if (track.scrollLeft >= realWidth) {
      track.scrollLeft -= realWidth;
    } else if (track.scrollLeft <= 0) {
      track.scrollLeft += realWidth;
    }
  }, [getRealWidth]);

  function tick() {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft += dirRef.current * SCROLL_SPEED;
    clampScroll();
    rafRef.current = requestAnimationFrame(tick);
  }

  function startScroll(direction: -1 | 1) {
    dirRef.current = direction;
    if (rafRef.current !== null) return; // already running
    rafRef.current = requestAnimationFrame(tick);
  }

  const stopScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /* ---- Initialise scroll position to the start of the "first real set" ---- */
  useEffect(() => {
    // On desktop we start at scrollLeft = 0 which is already the first real item.
    // Nothing extra needed.
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={`tcg-carousel${loop ? "" : " tcg-carousel--no-loop"}`}>
      {/* Left arrow – desktop only, hidden when no loop */}
      {loop && (
        <button
          type="button"
          className="tcg-carousel-arrow tcg-carousel-arrow--left text-2xl font-bold leading-none"
          aria-label="Défiler à gauche"
          onMouseEnter={() => startScroll(-1)}
          onMouseLeave={stopScroll}
        >
          ‹
        </button>
      )}

      {/* Track */}
      <div ref={trackRef} className={`tcg-carousel-track${loop ? "" : " tcg-carousel-track--center"}`}>
        {children}
      </div>

      {/* Right arrow – desktop only, hidden when no loop */}
      {loop && (
        <button
          type="button"
          className="tcg-carousel-arrow tcg-carousel-arrow--right text-2xl font-bold leading-none"
          aria-label="Défiler à droite"
          onMouseEnter={() => startScroll(1)}
          onMouseLeave={stopScroll}
        >
          ›
        </button>
      )}
    </div>
  );
}
