"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KqSchoolCannabinoidsProgressCommand } from "@/lib/kanab-quest-school-cannabinoids-progress";
import { KqHistoryProgressController, emptyKqHistoryProgressState, type KqHistoryProgressState } from "@/lib/kanab-quest-school-history-outbox";

/** Shared serial outbox, with a separate cannabinoids namespace and ID whitelist. */
export function useKqCannabinoidsProgress(ownerId?: string) {
  const [state, setState] = useState<{ ownerId?: string; value: KqHistoryProgressState }>({ value: emptyKqHistoryProgressState() });
  const controller = useRef<KqHistoryProgressController | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Tab-memory queue remains available. */ }
    const instance = new KqHistoryProgressController(ownerId, async (method, body, signal) => {
      const response = await fetch("/api/arena/placard/school/cannabinoids", {
        method, cache: "no-store", signal,
        ...(method === "POST" ? { headers: { "Content-Type": "application/json", "X-Kq-School-Owner": ownerId }, body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement interrompu. Tes étapes restent en attente.");
      return data;
    }, value => setState({ ownerId, value }), { storage, course: "cannabinoids" });
    controller.current = instance;
    void instance.load();
    return () => { instance.dispose(); if (controller.current === instance) controller.current = null; };
  }, [ownerId]);
  const load = useCallback(async () => { await controller.current?.load(); }, []);
  const save = useCallback(async (delta: Partial<KqSchoolCannabinoidsProgressCommand>) => { await controller.current?.save(delta); }, []);
  return { ...(state.ownerId === ownerId ? state.value : emptyKqHistoryProgressState()), load, save };
}
