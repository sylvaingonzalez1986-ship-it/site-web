"use client";

import { isArenaPrelaunch, hasArenaBetaAccess } from "@/lib/arena-opening";
import { useCart } from "@/context/CartContext";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Tour=dynamic(()=>import("./ArenaJourneyTour").then(module=>module.ArenaJourneyTour),{ssr:false});

export function ArenaJourneyEntry() {
  const pathname=usePathname();
  const { user, authLoading } = useCart();
  // Mount onboarding only on the arena home, including for first-time players.
  if (isArenaPrelaunch() && (authLoading || !hasArenaBetaAccess(user))) return null;
  return pathname==="/arene"?<Tour key={pathname} isArenaHome/>:null;
}
