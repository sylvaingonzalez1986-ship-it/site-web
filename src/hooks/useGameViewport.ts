"use client";

import { useLayoutEffect, useRef } from "react";

let activeSurfaces = 0;
let previousOverflowAnchor = "";

/** Keep changing game content in view, without following the site's footer. */
export function useGameViewport<T extends HTMLElement = HTMLElement>(view: string) {
  const surfaceRef = useRef<T>(null);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const html = document.documentElement;
    if (activeSurfaces++ === 0) {
      previousOverflowAnchor = html.style.overflowAnchor;
      // Excluding only the game allows the browser to anchor to the footer.
      html.style.overflowAnchor = "none";
    }

    let previousBottom = surface.getBoundingClientRect().bottom + window.scrollY;
    const observer = new ResizeObserver(() => {
      const rect = surface.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = rect.bottom + window.scrollY;
      const wasInGame = window.scrollY < previousBottom - 64;
      const lastGameViewport = Math.max(top, bottom - window.innerHeight);
      // A shorter result/list must not leave the viewport entirely in the footer.
      // Ordinary scrolling into the footer remains possible.
      if (bottom < previousBottom && wasInGame && window.scrollY > lastGameViewport) {
        window.scrollTo({ top: lastGameViewport, behavior: "instant" });
      }
      previousBottom = bottom;
    });
    observer.observe(surface);
    return () => {
      observer.disconnect();
      if (--activeSurfaces === 0) html.style.overflowAnchor = previousOverflowAnchor;
    };
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    // Run after the destination is committed, rather than retrying on timers.
    window.scrollTo({ top: Math.max(0, surface.getBoundingClientRect().top + window.scrollY), behavior: "instant" });
  }, [view]);

  return surfaceRef;
}
