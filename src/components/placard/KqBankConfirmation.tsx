"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  getKqBankTerms,
  KQ_BANK_INSTALLMENT_COUNT,
  KQ_BANK_INSTALLMENT_GAME_DAYS,
  KQ_BANK_TERM_DAYS,
  type KqBankCommand,
} from "@/lib/kanab-quest-bank";
import styles from "./KqBankConfirmation.module.css";

export type KqBankDraft =
  | Omit<Extract<KqBankCommand, { action: "borrow" }>, "requestKey">
  | Omit<Extract<KqBankCommand, { action: "repay" }>, "requestKey">;

type Props = {
  draft: KqBankDraft | null;
  cashCents: number | null;
  busy: boolean;
  retrying: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const percent = (bps: number) => `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const realDaysPerInstallment = KQ_BANK_TERM_DAYS / KQ_BANK_INSTALLMENT_COUNT;

export function KqBankConfirmation({ draft, cashCents, busy, retrying, error, onCancel, onConfirm }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const open = draft !== null;
  useBodyScrollLock(open);

  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    cancel.current?.focus({ preventScroll: true });
    return () => {
      if (element?.open) element.close();
      if (opener?.isConnected && !opener.closest("[inert]")) opener.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (open && error) errorMessage.current?.focus({ preventScroll: true });
  }, [open, error]);

  if (!draft) return null;

  const terms = draft.action === "borrow" ? getKqBankTerms(draft.amountCents, draft.expectedRateBps) : null;
  const knownCash = cashCents !== null && Number.isSafeInteger(cashCents) && cashCents >= 0;
  const remainingCash = knownCash && cashCents !== null ? cashCents - draft.amountCents : null;
  const repaymentBlocked = !retrying && draft.action === "repay" && (remainingCash === null || remainingCash < 0);
  const installmentMin = terms ? Math.min(...terms.installments) : null;
  const installmentMax = terms ? Math.max(...terms.installments) : null;

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} tabIndex={-1}
    data-bank-confirmation={draft.action}
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onCancel();
    }}
    onKeyDown={event => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary',
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== "hidden" && !element.closest("[inert]")
        && element.closest("dialog") === event.currentTarget);
      const first = focusable[0], last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
        event.preventDefault(); first.focus();
      }
    }}>
    <header className={styles.header}>
      <h2 id={`${id}-title`}>{retrying
        ? draft.action === "borrow" ? "Vérifier le prêt" : "Vérifier le remboursement"
        : draft.action === "borrow" ? "Confirmer le prêt" : "Confirmer le remboursement"}</h2>
    </header>
    <div className={styles.body} data-bank-confirmation-body>
      <p className={styles.currency}>Montants en euros de jeu.</p>
      {draft.action === "borrow" && terms ? <>
        <dl className={styles.amounts}>
          <div><dt>Capital reçu</dt><dd data-bank-contract-capital>{euros(draft.amountCents)}</dd></div>
          <div><dt>Intérêts fixes</dt><dd data-bank-contract-interest>{euros(terms.interestCents)}</dd></div>
          <div className={styles.total}><dt>Total à rembourser</dt><dd data-bank-contract-total>{euros(terms.totalCents)}</dd></div>
        </dl>
        <p className={styles.rate}>{percent(draft.expectedRateBps)} pour les {KQ_BANK_TERM_DAYS} jours réels du prêt. Ce taux n’est pas annuel.</p>
        <div className={styles.cadence}>
          <strong>{KQ_BANK_INSTALLMENT_COUNT} prélèvements, tous les {realDaysPerInstallment} jours réels</strong>
          <span data-bank-contract-payment-range>{installmentMin !== null && installmentMax !== null
            ? installmentMin === installmentMax ? euros(installmentMin) : `${euros(installmentMin)} à ${euros(installmentMax)}`
            : null} par prélèvement</span>
          <span>Premier prélèvement {realDaysPerInstallment} jours réels après la signature.</span>
          <small>Soit {KQ_BANK_INSTALLMENT_GAME_DAYS} jours de jeu entre deux prélèvements.</small>
        </div>
        <p className={styles.condition}>Les intérêts restent dus même si tu rembourses plus tôt, sans frais supplémentaires.</p>
        <details className={styles.schedule} data-bank-contract-schedule>
          <summary>Les {KQ_BANK_INSTALLMENT_COUNT} prélèvements<ChevronDown size={16} aria-hidden="true" /></summary>
          <ol>{terms.installments.map((amountCents, index) => <li key={index}>
            <span><strong>Après {(index + 1) * realDaysPerInstallment} jours réels</strong><small>{(index + 1) * KQ_BANK_INSTALLMENT_GAME_DAYS} jours de jeu après la signature</small></span>
            <b>{euros(amountCents)}</b>
          </li>)}</ol>
        </details>
      </> : <>
        <dl className={styles.amounts}>
          <div className={styles.total}><dt>{retrying ? "Remboursement demandé" : "Prélevé maintenant"}</dt><dd data-bank-contract-total>{euros(draft.amountCents)}</dd></div>
          <div><dt>Trésorerie actuelle</dt><dd data-bank-repayment-cash>{knownCash && cashCents !== null ? euros(cashCents) : "À vérifier"}</dd></div>
          {!retrying && remainingCash !== null && remainingCash >= 0 ? <div><dt>Après remboursement<small>Estimation</small></dt><dd data-bank-repayment-after>{euros(remainingCash)}</dd></div> : null}
        </dl>
        <p className={styles.condition}>Ce montant solde le prêt, intérêts contractuels inclus. Le remboursement anticipé ne réduit pas ces intérêts et n’ajoute aucun frais.</p>
        {repaymentBlocked ? <p className={styles.blocked} id={`${id}-blocked`} role="status">{remainingCash === null
          ? "La trésorerie doit être vérifiée. Reviens au dossier pour l’actualiser."
          : "La trésorerie disponible ne suffit plus. Reviens au dossier pour l’actualiser."}</p> : null}
      </>}
    </div>
    <footer className={styles.footer}>
      {error ? <p ref={errorMessage} className={styles.error} id={`${id}-error`} role="alert" tabIndex={0} data-bank-confirmation-error>{error}</p> : null}
      <div className={styles.commitment} id={`${id}-commitment`}>
        {terms ? <><strong>À rembourser : {euros(terms.totalCents)}</strong><span>Capital {euros(draft.amountCents)} + intérêts {euros(terms.interestCents)}</span></>
          : <><strong>{retrying ? "Montant demandé" : "Prélevé maintenant"} : {euros(draft.amountCents)}</strong><span>Intérêts contractuels inclus</span></>}
        {retrying ? <span>Vérifie la même demande pour connaître son résultat.</span> : null}
        {busy ? <span role="status">Confirmation en cours…</span> : null}
      </div>
      <div className={styles.actions}>
        <button ref={cancel} type="button" data-bank-cancel disabled={busy} onClick={onCancel}>Revenir au dossier</button>
        <button type="button" className={styles.confirm} data-bank-confirm disabled={busy || repaymentBlocked}
          aria-busy={busy || undefined}
          aria-describedby={`${id}-commitment${repaymentBlocked ? ` ${id}-blocked` : ""}${error ? ` ${id}-error` : ""}`}
          onClick={onConfirm}>{busy ? "Validation…" : retrying
            ? draft.action === "borrow" ? "Vérifier le prêt" : "Vérifier le remboursement"
            : draft.action === "borrow" ? "Signer le prêt" : "Rembourser"}</button>
      </div>
    </footer>
  </dialog>;
}
