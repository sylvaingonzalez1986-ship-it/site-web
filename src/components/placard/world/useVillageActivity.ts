"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { KQ_STORAGE_REFRESH_MS } from "@/lib/kanab-quest-storage-refresh";
import { useKqTutorialApi } from "../KqTutorialApiContext";
import { useKqTentSelection } from "../KqTentSelector";

export type VillageSnapshot = { activeRun: boolean; cashCents: number; readyLotCount: number; availableFlowerCount: number; curingFlowerCount?: number };
export function useVillageActivity() {
  const api = useKqTutorialApi(), tent = useKqTentSelection();
  const [result, setResult] = useState<{ tent: number; snapshot: VillageSnapshot | null; status: "ready" | "error" | "signed-out" } | null>(null);
  const polling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        // Identical snapshot and ordinary settlements to the existing 2D lobby.
        const response = await api.request(`/api/arena/placard/equipment?tentNumber=${tent}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setResult({ tent, snapshot: null, status: "signed-out" });
          return;
        }
        if (!response.ok) throw new Error("Résumé indisponible");
        const data = await response.json() as VillageSnapshot;
        if (typeof data.activeRun !== "boolean" || !Number.isFinite(data.cashCents)
          || !Number.isSafeInteger(data.readyLotCount) || data.readyLotCount < 0
          || !Number.isSafeInteger(data.availableFlowerCount) || data.availableFlowerCount < 0
          || (data.curingFlowerCount !== undefined && (!Number.isSafeInteger(data.curingFlowerCount) || data.curingFlowerCount < 0))) throw new Error("Résumé incomplet");
        if (!controller.signal.aborted) setResult({ tent, snapshot: data, status: "ready" });
      } catch { if (!controller.signal.aborted) setResult({ tent, snapshot: null, status: "error" }); }
    };
    const poll = startArenaVisiblePolling(refresh, KQ_STORAGE_REFRESH_MS); polling.current = poll;
    const unsubscribe = api.subscribe(["kq:equipment-updated", "kq:storage-updated", "arena:progress-updated"], () => void poll.refresh());
    return () => { controller.abort(); poll(); unsubscribe(); polling.current = null; };
  }, [api, tent]);
  return { snapshot: result?.tent === tent ? result.snapshot : null, status: result?.tent === tent ? result.status : "loading", retry: () => void polling.current?.refresh() };
}

function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener); document.addEventListener("visibilitychange", listener);
  return () => { media.removeEventListener("change", listener); document.removeEventListener("visibilitychange", listener); };
}
export function useVillageMotionPreference() {
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const hidden = useSyncExternalStore(subscribeMotion, () => document.hidden, () => false);
  return { reduced, hidden };
}

export function villageBuildingStatus(id: string, snapshot: VillageSnapshot | null) {
  if (!snapshot) return null;
  if (id === "warehouse") return snapshot.activeRun ? "En culture" : snapshot.curingFlowerCount ? `${snapshot.curingFlowerCount} lot${snapshot.curingFlowerCount > 1 ? "s" : ""} en affinage` : "À cultiver";
  if (id === "market") return snapshot.readyLotCount ? `${snapshot.readyLotCount} lot${snapshot.readyLotCount > 1 ? "s" : ""} à vendre` : "Aucun lot prêt";
  if (id === "arena") return snapshot.availableFlowerCount ? `${snapshot.availableFlowerCount} Fleur${snapshot.availableFlowerCount > 1 ? "s prêtes" : " prête"}` : "Aucune Fleur prête";
  return null;
}
