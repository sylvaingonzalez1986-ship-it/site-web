"use client";

import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { ARENA_LEARNING_ENTRY_KEY } from "@/lib/arena-introduction";
import { KQ_FARM_GUIDE_OPEN_EVENT } from "@/lib/kanab-quest-farm-guide";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { useArenaLearningStorage } from "./ArenaLearningStorage";

export function ArenaLearningLauncher({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const storage = useArenaLearningStorage();
  const startGuide = () => {
    try { storage?.setItem(ARENA_LEARNING_ENTRY_KEY, 'quarter'); }
    catch { /* Opening the guide still works when this browser cannot remember it. */ }
    navigateAfterOverlays(() => {
      if (pathname === '/arene/placard') window.dispatchEvent(new Event(KQ_FARM_GUIDE_OPEN_EVENT));
      else router.push('/arene/placard?guide=1');
    });
  };
  return <button type="button" className={className} data-arena-learning-trigger disabled={disabled} onClick={startGuide}>
      <Compass size={17} aria-hidden="true" />Apprendre à jouer
    </button>;
}
