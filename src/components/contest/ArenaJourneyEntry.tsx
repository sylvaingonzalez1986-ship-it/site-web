"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Tour=dynamic(()=>import("./ArenaJourneyTour").then(module=>module.ArenaJourneyTour),{ssr:false});

export function ArenaJourneyEntry() {
  const pathname=usePathname();
  // The usual first-login destination is /profil. Keep checkout and browsing uninterrupted.
  return pathname==="/profil"||pathname==="/arene"||pathname?.startsWith("/arene/")?<Tour key={pathname} isArenaHome={pathname==="/arene"}/>:null;
}
