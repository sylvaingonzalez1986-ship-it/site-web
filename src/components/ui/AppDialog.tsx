"use client";

import { createContext, useContext, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import styles from "./AppDialog.module.css";

const DialogNavigation = createContext<(action: () => void) => void>(action => action());
export const useDialogNavigation = () => useContext(DialogNavigation);

export type AppDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  label?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  footer?: ReactNode;
  dialogProps?: { id?: string } & { [key: `data-${string}`]: string | boolean | undefined };
};

/** A native top-layer dialog with a persistent exit and one scrolling body. */
export function AppDialog({ open, onClose, title, label, labelledBy, children, className = "", bodyClassName = "", headerClassName = "", closeLabel = "Fermer", closeOnBackdrop = true, footer, dialogProps }: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { close, navigate } = useOverlayHistory(open, onClose);
  useBodyScrollLock(open);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      if (opener?.isConnected && !opener.closest("[inert]")) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return <dialog
    {...dialogProps}
    ref={dialogRef}
    role="dialog"
    className={`${styles.dialog} ${className}`}
    aria-label={label}
    aria-labelledby={labelledBy ?? (!label && title ? titleId : undefined)}
    data-app-dialog
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }}
    onKeyDown={event => {
      // Do not let legacy parent overlays close on the child's Escape.
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab" || !(event.target instanceof Element) || event.target.closest("dialog") !== event.currentTarget) return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe, video[controls], audio[controls], summary',
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== "hidden" && !element.closest("[inert]")
        && element.closest("dialog") === event.currentTarget);
      const first = focusable[0], last = focusable.at(-1);
      // Native media controls manage their internal tab order in a shadow tree.
      if (event.target.matches("video, audio, iframe")) return;
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault(); first.focus();
      }
    }}
    onClick={event => {
      if (!closeOnBackdrop || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}
  >
    <header className={`${styles.header} ${headerClassName}`}>
      {title ? <div className={styles.title} id={titleId}>{title}</div> : <span />}
      <button ref={closeRef} type="button" className={styles.close} aria-label={closeLabel} onClick={close}>
        <X size={20} aria-hidden="true" /><span>Fermer</span>
      </button>
    </header>
    <DialogNavigation value={navigate}>
      <div className={`${styles.body} ${bodyClassName}`} data-app-dialog-body>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </DialogNavigation>
  </dialog>;
}
