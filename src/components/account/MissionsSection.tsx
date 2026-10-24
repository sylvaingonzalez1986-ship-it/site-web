"use client";

import { CommunityMissionWelcome, CommunityMissionsBoard } from "@/components/missions/CommunityMissionsBoard";

export function MissionsSection() {
  return <section data-ui-account="mission-panel" data-ui-shape="panel" style={{ background: "#fff1d6", color: "#172923", border: "2px solid #172923", borderRadius: 16, padding: "clamp(16px, 3vw, 32px)" }}>
    <CommunityMissionWelcome />
    <CommunityMissionsBoard />
  </section>;
}
