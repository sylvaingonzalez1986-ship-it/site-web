"use client";

import { useEffect, useState } from "react";
import { isKqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { CultureRoomSnapshot } from "./culture-room-state";

export function useObservedCultureRoom(enabled: boolean) {
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<CultureRoomSnapshot | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController;
    const load = async () => {
      controller?.abort();
      const request = controller = new AbortController();
      try {
        const response = await api.request("/api/arena/placard/warehouse?layout=observation", { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error();
        const view = await response.json();
        if (!request.signal.aborted) setSnapshot(isKqWarehouseState(view?.state) && Array.isArray(view.activeRuns) ? view : null);
      } catch { if (!request.signal.aborted) setSnapshot(null); }
    };
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const stop = api.subscribe(["kq:equipment-updated", "kq:storage-updated"], refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller?.abort(); stop(); document.removeEventListener("visibilitychange", refresh); };
  }, [api, enabled]);
  return enabled ? snapshot : null;
}
