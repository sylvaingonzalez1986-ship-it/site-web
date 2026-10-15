"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { closeOverlayHistory, registerOverlayHistory } from "@/lib/overlay-history";

/** Back closes the current layer; explicit navigation retires its entries first. */
export function useOverlayHistory(open: boolean, onClose: () => void) {
  const id = useId();
  const callback = useRef(onClose);
  useEffect(() => { callback.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    return registerOverlayHistory(id, () => callback.current());
  }, [open, id]);
  const close = useCallback(() => closeOverlayHistory(id), [id]);
  const navigate = useCallback((action: () => void) => closeOverlayHistory(id, action), [id]);
  return { close, navigate };
}
