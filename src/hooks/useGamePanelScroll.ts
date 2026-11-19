"use client";

import { useLayoutEffect, useRef } from "react";

/** Activity windows keep their own scroll position when browser Back is used. */
export function useGamePanelScroll(location: string) {
  const ref = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const restoring = useRef(false);
  const currentLocation = useRef(location);
  const navigating = useRef(false);
  useLayoutEffect(() => {
    const record = () => {
      if (ref.current && !navigating.current) positions.current.set(currentLocation.current, ref.current.scrollTop);
      navigating.current = true;
    };
    const back = () => {
      // Closing a drawer/dialog traverses history without changing the activity.
      if (currentLocation.current === window.location.search) return;
      record(); restoring.current = true;
    };
    const navigate = () => { record(); restoring.current = false; };
    // Capture runs before location stores can synchronously commit the next screen.
    window.addEventListener("popstate", back, true);
    window.addEventListener("game:navigate", navigate, true);
    return () => { window.removeEventListener("popstate", back, true); window.removeEventListener("game:navigate", navigate, true); };
  }, []);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    currentLocation.current = location;
    navigating.current = false;
    const storedPositions = positions.current;
    const target = restoring.current ? storedPositions.get(location) ?? 0 : 0;
    node.scrollTop = target;
    // Dynamic activities can load after the initial navigation commit.
    let pending = restoring.current;
    const observer = new ResizeObserver(() => { if (pending) node.scrollTop = target; });
    const stage = node.querySelector("[data-placard-stage]");
    if (stage) observer.observe(stage);
    const interact = () => { pending = false; };
    const record = () => {
      if (!navigating.current && (!pending || node.scrollTop >= target)) storedPositions.set(location, node.scrollTop);
    };
    node.addEventListener("scroll", record, { passive: true });
    node.addEventListener("wheel", interact, { passive: true });
    node.addEventListener("touchstart", interact, { passive: true });
    node.addEventListener("keydown", interact);
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", record);
      node.removeEventListener("wheel", interact); node.removeEventListener("touchstart", interact); node.removeEventListener("keydown", interact);
    };
  }, [location]);
  return ref;
}
