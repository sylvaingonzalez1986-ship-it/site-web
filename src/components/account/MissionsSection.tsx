"use client";

import { CommunityMissionWelcome, CommunityMissionsBoard } from "@/components/missions/CommunityMissionsBoard";

export function MissionsSection() {
  return <section style={{ background: "#003f30", borderRadius: 16, padding: "clamp(16px, 3vw, 32px)" }}>
    <CommunityMissionWelcome />
    <CommunityMissionsBoard />
  </section>;
}
