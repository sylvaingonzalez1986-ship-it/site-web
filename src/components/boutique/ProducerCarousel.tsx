"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProducerCarouselProps = {
  /** Number of real (non-cloned) items */
  itemCount: number;
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
export function ProducerCarousel({ itemCount, children }: ProducerCarouselProps) {
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

  /* ---- rAF scroll loop ---- */
  const tick = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft += dirRef.current * SCROLL_SPEED;
    clampScroll();
    rafRef.current = requestAnimationFrame(tick);
  }, [clampScroll]);

  const startScroll = useCallback(
    (direction: -1 | 1) => {
      dirRef.current = direction;
      if (rafRef.current !== null) return; // already running
      rafRef.current = requestAnimationFrame(tick);
    },
    [tick],
  );

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
    <div className="tcg-carousel">
      {/* Left arrow – desktop only */}
      <button
        type="button"
        className="tcg-carousel-arrow tcg-carousel-arrow--left"
        aria-label="Défiler à gauche"
        onMouseEnter={() => startScroll(-1)}
        onMouseLeave={stopScroll}
      >
        <ChevronLeft size={22} strokeWidth={3} />
      </button>

      {/* Track */}
      <div ref={trackRef} className="tcg-carousel-track">
        {children}
      </div>

      {/* Right arrow – desktop only */}
      <button
        type="button"
        className="tcg-carousel-arrow tcg-carousel-arrow--right"
        aria-label="Défiler à droite"
        onMouseEnter={() => startScroll(1)}
        onMouseLeave={stopScroll}
      >
        <ChevronRight size={22} strokeWidth={3} />
      </button>
    </div>
  );
}
