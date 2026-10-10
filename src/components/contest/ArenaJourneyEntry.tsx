"use client";

import dynamic from "next/dynamic";
import type { ArenaProfileLauncherProps } from "@/lib/arena-profile-launcher";

const Tour=dynamic(()=>import("./ArenaJourneyTour").then(module=>module.ArenaJourneyTour),{ssr:false});

export function ArenaJourneyEntry(props: ArenaProfileLauncherProps) {
  return <Tour {...props} />;
}
