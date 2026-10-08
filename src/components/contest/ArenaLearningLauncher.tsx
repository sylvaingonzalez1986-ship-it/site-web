"use client";

import dynamic from "next/dynamic";
import { Compass } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

const LearningHub = dynamic(() => import("./ArenaLearningHub").then(module => module.ArenaLearningHub), {
  ssr: false,
  loading: () => <p role="status">Ouverture des ateliers…</p>,
});

export function ArenaLearningLauncher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className={className} data-arena-learning-trigger
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Compass size={17} aria-hidden="true" />Explorer les possibilités
    </button>
    {open ? createPortal(<LearningHub onClose={() => {
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    }} />, document.body) : null}
  </>;
}
