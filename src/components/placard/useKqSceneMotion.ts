"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const reduceQuery = "(prefers-reduced-motion: reduce)";
const noMotionOnServer = () => true;
const notVisibleOnServer = () => false;

function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia(reduceQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const readReducedMotion = () => window.matchMedia(reduceQuery).matches;
function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}
const readVisibility = () => !document.hidden;

function createViewportStore(node: Element | null) {
  let visible = false;
  return {
    read: () => visible,
    subscribe: (notify: () => void) => {
      if (!node) return () => {};
      if (typeof IntersectionObserver === "undefined") {
        visible = true;
        notify();
        return () => {};
      }
      const observer = new IntersectionObserver(entries => {
        const next = entries.some(entry => entry.isIntersecting);
        if (next !== visible) { visible = next; notify(); }
      });
      observer.observe(node);
      return () => observer.disconnect();
    },
  };
}

/** Only controls decoration. Pausing a scene never pauses a game task or its clock. */
export function useKqSceneMotion<T extends Element = HTMLElement>(paused = false) {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((element: T | null) => setNode(element), []);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, noMotionOnServer);
  const documentVisible = useSyncExternalStore(subscribeVisibility, readVisibility, notVisibleOnServer);
  const viewport = useMemo(() => createViewportStore(node), [node]);
  const inView = useSyncExternalStore(viewport.subscribe, viewport.read, notVisibleOnServer);
  const status = reducedMotion ? "reduced" : paused ? "paused" : !documentVisible ? "hidden" : !inView ? "offscreen" : "running";
  return { ref, motionEnabled: status === "running", status, reducedMotion, visible: documentVisible && inView } as const;
}
