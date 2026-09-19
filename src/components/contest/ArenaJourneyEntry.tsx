"use client";

import { isArenaPrelaunch } from "@/lib/arena-opening";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Tour=dynamic(()=>import("./ArenaJourneyTour").then(module=>module.ArenaJourneyTour),{ssr:false});

export function ArenaJourneyEntry() {
  const pathname=usePathname();
  // Mount onboarding only on the arena home, including for first-time players.
  if (isArenaPrelaunch()) return null;
  return pathname==="/arene"?<Tour key={pathname} isArenaHome/>:null;
}
