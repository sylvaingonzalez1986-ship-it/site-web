"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getVillageCalendar, getVillageCalendarPreview, VILLAGE_GAME_MINUTE_MS, type VillageCalendar } from "./village-calendar";

export type VillageClockAnchor = {
  startedAt: string;
  serverNowMs: number;
  receivedAtMs: number;
  simulated: boolean;
};

function subscribePreview(listener: () => void) {
  if (process.env.NODE_ENV !== "development") return () => {};
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}

function getPreviewSearch() {
  return process.env.NODE_ENV === "development" ? window.location.search : "";
}

const getServerSearch = () => "";

export function useVillageCalendar(clock: VillageClockAnchor | null): VillageCalendar | null {
  const search = useSyncExternalStore(subscribePreview, getPreviewSearch, getServerSearch);
  const preview = useMemo(() => getVillageCalendarPreview(search), [search]);
  const [sample, setSample] = useState<{ clock: VillageClockAnchor; elapsedMs: number } | null>(null);

  useEffect(() => {
    if (!clock || clock.simulated || preview) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (document.hidden) return;
      const elapsedMs = Math.max(0, performance.now() - clock.receivedAtMs);
      setSample({ clock, elapsedMs });
      schedule(elapsedMs);
    };
    const schedule = (elapsedMs: number) => {
      const gameElapsedMs = Math.max(0, clock.serverNowMs + elapsedMs - Date.parse(clock.startedAt));
      timer = setTimeout(tick, Math.ceil(VILLAGE_GAME_MINUTE_MS - gameElapsedMs % VILLAGE_GAME_MINUTE_MS));
    };
    const sync = () => {
      clearTimeout(timer);
      tick();
    };
    if (!document.hidden) schedule(Math.max(0, performance.now() - clock.receivedAtMs));
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [clock, preview]);

  const elapsedMs = sample?.clock === clock ? sample.elapsedMs : 0;
  return useMemo(() => preview ?? (clock ? getVillageCalendar(clock.startedAt, clock.serverNowMs + elapsedMs) : null), [clock, elapsedMs, preview]);
}
