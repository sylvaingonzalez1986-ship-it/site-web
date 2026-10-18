"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import styles from "./KqWorkshopMachineDialog.module.css";

/** Keep the machine sheet in its workshop subtree so teaching guides can observe it. */
export function KqWorkshopMachineDialog({ open, busy, title, onClose, children }: {
  open: boolean;
  busy: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useBodyScrollLock(open);

  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    // A successful purchase/upgrade refreshes the slot and can remove its focused
    // button. Recover focus inside this top-layer sheet while its content reloads.
    let focusFrame = 0;
    const recoverFocus = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (!element?.open || Array.from(document.querySelectorAll("dialog[open]")).at(-1) !== element) return;
        const active = document.activeElement;
        if (active !== element && active && element.contains(active)) return;
        const control = closeButton.current && !closeButton.current.disabled ? closeButton.current
          : Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]'))
            .find(candidate => candidate.getClientRects().length > 0 && getComputedStyle(candidate).visibility !== "hidden");
        (control ?? element).focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(recoverFocus);
    if (element) observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(focusFrame);
      if (element?.open) element.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return <dialog ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-app-dialog data-workshop-machine-dialog
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      if (!controls.length) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}
    onClick={event => {
      if (busy || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className={styles.header}><strong id={titleId}>{title}</strong><button ref={closeButton} type="button" disabled={busy} onClick={onClose} aria-label="Fermer la fiche de la machine"><X size={19} aria-hidden="true"/><span>Fermer</span></button></header>
    <div className={styles.body}>{children}</div>
  </dialog>;
}
