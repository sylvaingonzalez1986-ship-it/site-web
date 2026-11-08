"use client";

import { createContext, useContext } from "react";
import { getKqCommunicationActionLevel, getKqPlayerActionHours, type KqPlayerActionDomain } from "@/lib/kanab-quest-player-action-costs";
import type { KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";

export const KqPlayerWorkAvailabilityContext = createContext<KqPlayerWorkAvailability | null>(null);

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
