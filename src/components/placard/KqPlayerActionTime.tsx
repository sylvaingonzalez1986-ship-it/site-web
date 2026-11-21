"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getKqCommunicationActionLevel, getKqPlayerActionHours, type KqPlayerActionDomain } from "@/lib/kanab-quest-player-action-costs";
import { getKqPlayerSkills, getKqPlayerWorkday, KQ_WORK_EVENTS, type KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { useKqTutorialApi } from "./KqTutorialApiContext";

export const KqPlayerWorkAvailabilityContext = createContext<KqPlayerWorkAvailability | null>(null);

const loading: KqPlayerWorkAvailability = { status: "loading" };

/** Refresh action costs from the server without mounting a workday meter. */
export function useKqPlayerWorkAvailability(scope: string | null) {
  const api = useKqTutorialApi();
  const [read, setRead] = useState<{ scope: string; availability: KqPlayerWorkAvailability } | null>(null);
  useEffect(() => {
    if (!scope) return;
    let controller: AbortController | undefined;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const publish = (availability: KqPlayerWorkAvailability) => setRead({ scope, availability });

    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      clearTimeout(renewal);
      publish(loading);
      try {
        const response = await api.request("/api/arena/placard/staff", { cache: "no-store", signal: request.signal });
        const data = await response.json() as KqStaffSnapshot;
        if (request.signal.aborted) return;
        const clock = Date.parse(data.serverNow);
        const nextDay = Date.parse(data.calendar?.nextDayAt);
        if (!response.ok || !data.state || !Number.isFinite(clock) || !Number.isFinite(nextDay) || nextDay <= clock) throw new Error("unavailable");
        const workday = getKqPlayerWorkday(data);
        if (!Number.isFinite(workday.usedHours) || workday.usedHours < 0 || workday.usedHours > workday.dailyHours
          || !Number.isFinite(workday.remainingHours)) throw new Error("invalid");
        publish({ status: "ready", workday, serverNow: data.serverNow, skills: getKqPlayerSkills(data.state) });
        renewal = setTimeout(() => { if (!document.hidden) void load(); }, Math.max(1000, nextDay - clock + 100));
      } catch {
        if (!request.signal.aborted) publish({ status: "unavailable" });
      }
    }

    function schedule() {
      if (document.hidden) return;
      controller?.abort();
      publish(loading);
      clearTimeout(renewal);
      clearTimeout(queued);
      queued = setTimeout(() => { void load(); }, 180);
    }

    void load();
    const unsubscribe = api.subscribe(KQ_WORK_EVENTS, schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    return () => {
      controller?.abort();
      clearTimeout(renewal);
      clearTimeout(queued);
      unsubscribe();
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("focus", schedule);
    };
  }, [api, scope]);
  return read?.scope === scope ? read.availability : loading;
}

/** Only a loaded skill can provide the player's current action duration. */
export function useKqPlayerActionTime(domain: KqPlayerActionDomain, action: string) {
  const availability = useContext(KqPlayerWorkAvailabilityContext);
  const experience = availability?.status === "ready" ? availability.skills?.communication : undefined;
  if (typeof experience !== "number" || !Number.isFinite(experience) || experience < 0) {
    return {
      hours: null,
      communicationLevel: null,
      label: "Temps joueur à confirmer · 1 h au niveau 1 → 0,1 h (6 min) au niveau 10 de Communication.",
    };
  }
  const communicationLevel = getKqCommunicationActionLevel(experience);
  const hours = getKqPlayerActionHours(domain, action, { communication: experience });
  const duration = `${hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h${hours < 1 ? ` (${Math.round(hours * 60)} min)` : ""}`;
  return { hours, communicationLevel, label: `Temps joueur : ${duration} de ta journée · Communication niveau ${communicationLevel}.` };
}
