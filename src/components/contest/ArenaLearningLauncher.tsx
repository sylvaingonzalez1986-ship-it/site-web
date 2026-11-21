"use client";

import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { KQ_FARM_GUIDE_OPEN_EVENT } from "@/lib/kanab-quest-guide-navigation";
import { navigateAfterOverlays } from "@/lib/overlay-history";

export function ArenaLearningLauncher({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const startGuide = () => {
    navigateAfterOverlays(() => {
      if (pathname === '/arene/placard' || document.querySelector('[data-sylvain-guide]')) window.dispatchEvent(new Event(KQ_FARM_GUIDE_OPEN_EVENT));
      else router.push('/arene/placard?guide=1');
    });
  };
  return <button type="button" className={className} data-arena-learning-trigger disabled={disabled} onClick={startGuide}>
      <Compass size={17} aria-hidden="true" />Carnet de Loïc
    </button>;
}
