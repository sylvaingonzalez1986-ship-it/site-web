"use client";

import { useContext, useEffect } from "react";
import { ChanvrierAvatar } from "@/components/contest/ChanvrierAvatar";
import { QuarterCharacterContext } from "@/components/contest/QuarterCharacterContext";
import { getKqPlayerSkills, getKqPlayerWorkday, type KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";
import { KqQuarterTeamPanel } from "./KqQuarterTeamPanel";
import { useKqStaffOperations } from "./KqStaffOperations";

export function KqQuarterTeamAccess({ onAvailabilityChange }: { onAvailabilityChange: (value: KqPlayerWorkAvailability) => void }) {
  const profile = useContext(QuarterCharacterContext);
  const controller = useKqStaffOperations("Équipe", undefined, { refreshTeamDay: true });
  const { snapshot, error, authProblem } = controller;
  useEffect(() => {
    if (error || authProblem) onAvailabilityChange({ status: "unavailable" });
    else if (!snapshot) onAvailabilityChange({ status: "loading" });
    else onAvailabilityChange({ status: "ready", workday: getKqPlayerWorkday(snapshot), serverNow: snapshot.serverNow, skills: getKqPlayerSkills(snapshot.state) });
  }, [snapshot, error, authProblem, onAvailabilityChange]);
  return <KqQuarterTeamPanel controller={controller} playerName={profile?.nickname ?? "Toi"}
    playerPortrait={profile ? <ChanvrierAvatar profile={profile} view="portrait" /> : undefined} />;
}
