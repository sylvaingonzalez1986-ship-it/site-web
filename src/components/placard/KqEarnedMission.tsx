"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KQ_MISSION_COPY, KQ_MISSION_DEFINITIONS } from "@/lib/kanab-quest-missions";
import { readKqPinnedMissionProgress } from "@/lib/kanab-quest-pinned-mission";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { useKqTutorialApi } from "./KqTutorialApiContext";

export function KqEarnedMission() {
  const api = useKqTutorialApi();
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (api.isTutorial) return;
    const controller = new AbortController();
    async function read() {
      const response = await api.request("/api/arena/placard/missions", {
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      for (const { code } of KQ_MISSION_DEFINITIONS) {
        const mission = readKqPinnedMissionProgress(data, code);
        if (mission?.claimable && mission.unlocked && !mission.claimed && mission.rewardAvailable !== false &&
            mission.reward?.kind === "cash" && Number.isSafeInteger(mission.reward.amountCents) && mission.reward.amountCents > 0) {
          if (!controller.signal.aborted) setLabel(`${KQ_MISSION_COPY[code].title} · ${formatKqCash(mission.reward.amountCents)} à récupérer`);
          return;
        }
      }
    }
    void read().catch(() => {});
    return () => controller.abort();
  }, [api]);
  return label ? <p><Link prefetch={false} href="/arene/placard?view=missions">{label}</Link></p> : null;
}
