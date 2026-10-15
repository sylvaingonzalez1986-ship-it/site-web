"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

let activeSurfaces = 0;
let previousOverflowAnchor = "";
const surfaces = new Map<HTMLElement, RefObject<boolean>>();

function ancestorIsRestoring(surface: HTMLElement) {
  return [...surfaces].some(([ancestor, restoring]) => ancestor !== surface && ancestor.contains(surface) && restoring.current);
}

/** Keep changing game content in view, without following the site's footer. */
export function useGameViewport<T extends HTMLElement = HTMLElement>(view: string, { restoreOnBack = false }: { restoreOnBack?: boolean } = {}) {
  const surfaceRef = useRef<T>(null);
  const positions = useRef(new Map<string, number>());
  const currentView = useRef(view);
  const restoring = useRef(false);
  const pendingPosition = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!restoreOnBack) return;
    const record = () => { if (pendingPosition.current === null) positions.current.set(currentView.current, window.scrollY); };
    const back = () => { record(); restoring.current = true; };
    const forward = () => { record(); restoring.current = false; pendingPosition.current = null; };
    const interrupt = () => { pendingPosition.current = null; restoring.current = false; };
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("popstate", back);
    window.addEventListener("game:navigate", forward);
    window.addEventListener("pointerdown", interrupt, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => { window.removeEventListener("scroll", record); window.removeEventListener("popstate", back); window.removeEventListener("game:navigate", forward); window.removeEventListener("pointerdown", interrupt); window.removeEventListener("wheel", interrupt); window.removeEventListener("touchstart", interrupt); window.removeEventListener("keydown", interrupt); };
  }, [restoreOnBack]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const html = document.documentElement;
    surfaces.set(surface, restoring);
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
      const lastGameViewport = Math.max(top, bottom - window.innerHeight);
      // A child loading/result view must not undo its parent's Back restoration.
      if (ancestorIsRestoring(surface)) {
        previousBottom = bottom;
        return;
      }
      if (pendingPosition.current !== null) {
        const target = pendingPosition.current;
        // Wait for the game itself to be tall enough, not the permanent footer.
        window.scrollTo({ top: Math.min(target, lastGameViewport), behavior: "instant" });
        // Retain the destination through successive loading/loaded commits.
        // A child can briefly shrink after the first restoration already fit.
        previousBottom = bottom;
        return;
      }
      const wasInGame = window.scrollY < previousBottom - 64;
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
      surfaces.delete(surface);
      if (--activeSurfaces === 0) html.style.overflowAnchor = previousOverflowAnchor;
    };
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (ancestorIsRestoring(surface)) return;
    // Run after the destination is committed, rather than retrying on timers.
    const target = restoreOnBack && restoring.current ? positions.current.get(view) : undefined;
    currentView.current = view;
    pendingPosition.current = target ?? null;
    const rect = surface.getBoundingClientRect();
    const top = Math.max(0, rect.top + window.scrollY);
    const lastGameViewport = Math.max(top, rect.bottom + window.scrollY - window.innerHeight);
    window.scrollTo({ top: target === undefined ? top : Math.min(target, lastGameViewport), behavior: "instant" });
    // Keep precedence over delayed child state changes until the user interacts.
    restoring.current = target !== undefined;
  }, [view, restoreOnBack]);

  return surfaceRef;
}
