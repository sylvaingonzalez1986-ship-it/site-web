"use client";

import dynamic from "next/dynamic";
import { Compass } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARENA_RELEVE_LABELS } from "@/lib/arena-releve";

const LearningHub = dynamic(() => import("./ArenaLearningHub").then(module => module.ArenaLearningHub), {
  ssr: false,
  loading: () => <p role="status">Ouverture de La relève…</p>,
});

export function ArenaLearningLauncher({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className={className} data-arena-learning-trigger
      aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
      <Compass size={17} aria-hidden="true" />{ARENA_RELEVE_LABELS.launcher}
    </button>
    {open ? createPortal(<LearningHub onClose={() => {
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    }} />, document.body) : null}
  </>;
}
