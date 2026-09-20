"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import styles from "./CartBenefitSummaryModal.module.css";

type CartBenefitSummaryModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  hint?: string;
  lines: string[];
};

export function CartBenefitSummaryModal({
  open,
  onClose,
  title,
  eyebrow,
  hint,
  lines,
}: CartBenefitSummaryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hintId = `${titleId}-hint`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h3 id={titleId} className={styles.title}>{title}</h3>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le récapitulatif">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body}>
        {hint ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
        <ul className={styles.lines}>
          {lines.map((line, index) => <li key={`${eyebrow}-${index}`}>{line}</li>)}
        </ul>
      </div>
    </dialog>
  );
}
