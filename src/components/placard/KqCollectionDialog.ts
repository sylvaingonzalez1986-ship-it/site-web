"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export function useKqCollectionDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}

export function clickedCollectionBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
}
