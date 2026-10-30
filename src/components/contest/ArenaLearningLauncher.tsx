"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { ARENA_LEARNING_ENTRY_KEY } from "@/lib/arena-introduction";
import { useArenaLearningStorage } from "./ArenaLearningStorage";

const LearningHub = dynamic(() => import("./ArenaLearningHub").then(module => module.ArenaLearningHub), {
  ssr: false,
  loading: () => <p role="status">Ouverture de l’aide…</p>,
});

export function ArenaLearningLauncher({ className, disabled = false, onOpenQuarter }: { className?: string; disabled?: boolean; onOpenQuarter?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const storage = useArenaLearningStorage();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  const openQuarter = () => {
    close();
    try { storage?.setItem(ARENA_LEARNING_ENTRY_KEY, 'quarter'); }
    catch { /* The destination remains available if this browser cannot remember the choice. */ }
    if (onOpenQuarter) onOpenQuarter();
    else if (pathname !== '/arene/placard') router.push('/arene/placard');
  };
  return <>
    <button ref={trigger} type="button" className={className} data-arena-learning-trigger
      aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
      <Compass size={17} aria-hidden="true" />Apprendre à jouer
    </button>
    {open ? createPortal(<LearningHub onClose={close} onOpenQuarter={openQuarter} />, document.body) : null}
  </>;
}
