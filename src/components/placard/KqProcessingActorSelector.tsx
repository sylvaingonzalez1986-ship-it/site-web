"use client";

import { UserRound } from "lucide-react";
import type { KqProcessingWorkQuote } from "@/lib/kanab-quest-processing-work";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqWorkActorSelector } from "./KqWorkActorSelector";
import { useKqSocialPlayer } from "./useKqSocialPlayer";

export function KqProcessingActorSelector({ quote, actorId, disabled, onChange }: {
  quote: KqProcessingWorkQuote; actorId?: string; disabled?: boolean; onChange: (id: string) => void;
}) {
  const player = useKqSocialPlayer();
  if (quote.actorChoiceVersion !== 1 || !quote.actors) return null;
  const selection = actorId ?? quote.actorId ?? "auto";
  return <KqWorkActorSelector label="Qui transforme ce lot ?" value={selection === "auto" ? quote.employee?.id ?? "player" : selection}
    onChange={onChange} disabled={disabled} options={quote.actors.map(option => ({
      id: option.id, name: option.name,
      portrait: option.employee ? <KqStaffPortrait person={option.employee} /> : player.profile ? <ChanvrierAvatar profile={player.profile} view="portrait" /> : <UserRound size={32} />,
      detail: `${option.employee ? `Niv. ${option.employee.level} · ` : ""}${option.remainingHours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h ${option.employee ? "réservées" : "sur ta journée"}`,
      disabledReason: option.available ? undefined : option.reason ?? "Travail indisponible pour ce lot.",
    }))} />;
}
