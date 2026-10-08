"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { KanabQuestDicePrototype } from "./KanabQuestDicePrototype";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";
import { quoteKqEnergy, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { KQ_TRIAL_EQUIPMENT } from "@/lib/kanab-quest-trial";
import { createKqLessonStorage, createKqPlayableLesson, getKqPlayableLessonProgress, type KqPlayableLessonId, type KqPlayableLessonProgress, type KqPlayableLessonSnapshot } from "@/lib/kanab-quest-playable-lesson";

export function KqPlayableCultureLesson({ lesson, scope = "discovery", onProgress, onComplete }: {
  lesson: KqPlayableLessonId;
  scope?: string;
  onClose?: () => void;
  onProgress?: (progress: KqPlayableLessonProgress) => void;
  onComplete?: () => void;
}) {
  const callbacks = useRef({ onProgress, onComplete });
  const completed = useRef(false);
  useEffect(() => { callbacks.current = { onProgress, onComplete }; }, [onProgress, onComplete]);
  const reportProgress = useCallback((snapshot: KqPlayableLessonSnapshot) => {
    const progress = getKqPlayableLessonProgress(lesson, snapshot);
    callbacks.current.onProgress?.(progress);
    if (progress.complete && !completed.current) {
      completed.current = true;
      callbacks.current.onComplete?.();
    }
  }, [lesson]);
  const tutorial = useMemo(() => {
    let backing: Storage | undefined;
    try { if (typeof window !== "undefined") backing = window.localStorage; } catch { /* Memory fallback. */ }
    return { ...createKqPlayableLesson(lesson, createKqLessonStorage(scope, lesson, backing), () => undefined), onProgress: reportProgress };
  }, [lesson, scope, reportProgress]);
  const api = useMemo(() => createKqTutorialApi(async (input, init) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    if (path !== "/api/arena/placard/energy" || (init?.method ?? "GET") !== "GET") {
      return Response.json({ error: "Cette action n’est pas disponible dans cet essai." }, { status: 400 });
    }
    const snapshot: KqEnergySnapshot = {
      cashCents: 200000, productionUnits: 1, outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [],
      quotes: {
        eco: quoteKqEnergy(KQ_TRIAL_EQUIPMENT, {}, "eco"),
        balanced: quoteKqEnergy(KQ_TRIAL_EQUIPMENT, {}, "balanced"),
        intensive: quoteKqEnergy(KQ_TRIAL_EQUIPMENT, {}, "intensive"),
      },
    };
    return Response.json(snapshot);
  }), []);
  return <KqTutorialApiProvider api={api}>
    <KanabQuestDicePrototype key={`${scope}:${lesson}`} tutorial={tutorial} showAdminOperations={false} viewMode="game" />
  </KqTutorialApiProvider>;
}
