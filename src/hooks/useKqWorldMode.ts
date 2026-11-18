"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { kqWorldModeStorageKey, readKqWorldMode, refreshKqWorldMode, rememberKqWorldMode, requestedKqWorldMode, type KqWorldMode } from "@/lib/kanab-quest-world-mode";

export type { KqWorldMode } from "@/lib/kanab-quest-world-mode";
const changed = "kq:world-mode";
const locationChanged = "kq:placard-location";
function storage() { try { return window.localStorage; } catch { return null; } }

/** URL choices win; ordinary game links resume this player's saved presentation. */
export function useKqWorldMode(ownerId?: string, initialWorldMode?: KqWorldMode) {
  const subscribe = useCallback((listener: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && (!ownerId || event.key !== kqWorldModeStorageKey(ownerId))) return;
      refreshKqWorldMode(ownerId);
      listener();
    };
    window.addEventListener("popstate", listener);
    window.addEventListener(locationChanged, listener);
    window.addEventListener(changed, listener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("popstate", listener);
      window.removeEventListener(locationChanged, listener);
      window.removeEventListener(changed, listener);
      window.removeEventListener("storage", onStorage);
    };
  }, [ownerId]);
  const snapshot = useCallback(() => requestedKqWorldMode(window.location.search) ?? readKqWorldMode(ownerId, storage()), [ownerId]);
  const serverSnapshot = useCallback(() => initialWorldMode ?? "2d", [initialWorldMode]);
  const worldMode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  useEffect(() => {
    const requested = requestedKqWorldMode(window.location.search);
    if (requested) rememberKqWorldMode(ownerId, requested, storage());
  }, [ownerId, worldMode]);

  const setWorldMode = useCallback((mode: KqWorldMode) => {
    rememberKqWorldMode(ownerId, mode, storage());
    const url = new URL(window.location.href);
    url.searchParams.set("world", mode);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(changed));
    window.dispatchEvent(new Event(locationChanged));
  }, [ownerId]);

  return { worldMode, setWorldMode };
}
