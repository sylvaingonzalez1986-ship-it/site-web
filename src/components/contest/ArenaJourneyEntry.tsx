"use client";

import dynamic from "next/dynamic";

const Tour=dynamic(()=>import("./ArenaJourneyTour").then(module=>module.ArenaJourneyTour),{ssr:false});

export function ArenaJourneyEntry() {
  return <Tour />;
}
