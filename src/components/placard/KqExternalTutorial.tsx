"use client";

import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import type { FarmGuideDestination } from "@/lib/kanab-quest-farm-guide";
import { ArenaLearningLauncher } from "../contest/ArenaLearningLauncher";
import retro from "../contest/ArenaRetro.module.css";
import styles from "./KqExternalTutorial.module.css";

const Guide = dynamic(() => import("./KqFarmGuide").then(module => module.KqFarmGuide), { ssr: false });
const unchanged = () => undefined;

/** Keep the same account's learning journey on the Carnet and the Arène. */
export function KqExternalTutorial({ children }: { children: ReactNode }) {
  const pathname = usePathname(), params = useSearchParams(), router = useRouter();
  const { user } = useCart();
  const navigate = useCallback((destination: FarmGuideDestination) => {
    if (destination.href) { router.push(destination.href); return; }
    const query = new URLSearchParams({ view: destination.view });
    if (destination.section) query.set("section", destination.section);
    if (destination.pole) query.set("pole", destination.pole);
    router.push(`/arene/placard?${query}`);
  }, [router]);
  if (!user || pathname === "/arene/placard" || (!pathname.startsWith("/arene/carnet") && pathname !== "/arene")) return children;
  const view = pathname.startsWith("/arene/carnet") ? "notebook" : params.get("vue") === "classement" ? "ranking" : "profile";
  return <div className={retro.gameSurface} data-placard-view={view}>
    <nav className={styles.nav} aria-label="Aide du jeu"><ArenaLearningLauncher /></nav>
    <Guide key={user.id} ownerId={user.id} destination={{ view }} onNavigate={navigate} onActiveChange={unchanged} />
    {children}
  </div>;
}
