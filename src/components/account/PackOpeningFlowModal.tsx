"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PackOpeningAnimation } from "@/components/lottery/PackOpeningAnimation";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { LotteryTicket, ScratchResult } from "@/types/lottery";
import styles from "@/components/lottery/PackOpening.module.css";

type PackOpeningFlowModalProps = {
  ticket: LotteryTicket | null;
  onClose: () => void;
  onOpen: (ticketId: string) => Promise<ScratchResult>;
  inline?: boolean;
};

export function PackOpeningFlowModal({ ticket, onClose, onOpen, inline = false }: PackOpeningFlowModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const ticketId = ticket?.id;
  useBodyScrollLock(Boolean(ticket));

  useEffect(() => {
    if (!ticketId) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab" && dialogRef.current) {
        const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length > 0 && el.getAttribute("aria-disabled") !== "true");
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [ticketId]);

  if (!ticket) return null;

  const modalClassName = inline
    ? "contest-pack-opening-modal contest-pack-opening-modal-inline"
    : "contest-pack-opening-modal contest-pack-opening-modal-global";

  const modal = (
    <div ref={dialogRef} className={`${modalClassName} ${styles.modal}`} data-inline={inline || undefined} role="dialog" aria-modal="true" aria-label="Ouverture du booster">
      {/* Close — always visible */}
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Fermer"
      >
        ✕
      </button>

      <PackOpeningAnimation
        key={ticket.id}
        packNumber={ticket.ticketNumber}
        onOpen={() => onOpen(ticket.id)}
        onContinue={onClose}
      />
    </div>
  );

  if (inline) {
    return modal;
  }

  if (typeof document === "undefined") return null;

  return createPortal(modal, document.body);
}
