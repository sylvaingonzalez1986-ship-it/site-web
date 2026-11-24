"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { closeOverlayHistory, registerOverlayHistory } from "@/lib/overlay-history";

/** Back closes the current layer; explicit navigation retires its entries first. */
export function useOverlayHistory(open: boolean, onClose: () => void, trackHistory = true) {
  const id = useId();
  const callback = useRef(onClose);
  useEffect(() => { callback.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !trackHistory) return;
    return registerOverlayHistory(id, () => callback.current());
  }, [open, id, trackHistory]);
  const close = useCallback(() => {
    if (trackHistory) closeOverlayHistory(id);
    else callback.current();
  }, [id, trackHistory]);
  const navigate = useCallback((action: () => void) => {
    if (trackHistory) closeOverlayHistory(id, action);
    else action();
  }, [id, trackHistory]);
  return { close, navigate };
}
