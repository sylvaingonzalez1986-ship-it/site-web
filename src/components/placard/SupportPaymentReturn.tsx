"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { supportEuros, type SupportAttempt, type SupportStatus } from "@/lib/support-campaign";
import {
  goToSupportPayment, readSupportAttempt, readSupportGameReturnHref, SUPPORT_GAME_HOME, SUPPORT_PROVIDER_LABELS,
  supportRequest, supportReturnIdentity, supportStatusIsFinal, supportStatusMessage, validateSupportStatus,
} from "@/lib/support-client";
import { KqChapterHeading } from "./KqChapterHeading";
import styles from "./KqFinancialSupport.module.css";

export function SupportPaymentReturn({ supportId, transactionId, orderCode }: { supportId?: string | string[]; transactionId?: string | string[]; orderCode?: string | string[] }) {
  const [attempt, setAttempt] = useState<SupportAttempt | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [returnHref, setReturnHref] = useState(SUPPORT_GAME_HOME);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [stopped, setStopped] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const flight = useRef<AbortSignal | null>(null);
  const verifyButton = useRef<HTMLButtonElement>(null);
  const returnLink = useRef<HTMLAnchorElement>(null);

  const check = useCallback(async (saved: SupportAttempt, signal: AbortSignal) => {
    const identity = supportReturnIdentity(saved, supportId, transactionId, orderCode);
    if (!identity || signal.aborted || flight.current === signal) return null;
    flight.current = signal;
    setBusy(true);
    try {
      const result = validateSupportStatus(await supportRequest<SupportStatus>("/api/support/status", identity, signal), saved);
      if (!signal.aborted) {
        if (result.state === "paid" && document.activeElement === verifyButton.current) returnLink.current?.focus();
        setStatus(result);
        setError("");
      }
      return result;
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Vérification momentanément indisponible.");
      return null;
    } finally {
      if (flight.current === signal) flight.current = null;
      if (!signal.aborted) setBusy(false);
    }
  }, [supportId, transactionId, orderCode]);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saved: SupportAttempt | null = null;
    try { saved = readSupportAttempt(); } catch { /* La fiche peut manquer ou avoir été effacée. */ }
    if (!saved || !supportReturnIdentity(saved, supportId, transactionId, orderCode)) {
      setError("La fiche correspondant à ce retour est introuvable dans cet onglet. Tu peux retrouver ton soutien dans l’onglet d’origine.");
      setBusy(false);
      return;
    }
    const matched = saved;
    setAttempt(matched);
    setReturnHref(readSupportGameReturnHref(matched.id));
    let polls = 0;
    const poll = async () => {
      const result = await check(matched, current.signal);
      if (current.signal.aborted || supportStatusIsFinal(result) || result?.state === "review") return;
      if (++polls < 10) timer = setTimeout(() => void poll(), 3000);
      else setStopped(true);
    };
    void poll();
    return () => {
      current.abort();
      clearTimeout(timer);
    };
  }, [check, supportId, transactionId, orderCode]);

  const provider = attempt?.provider ?? "viva";
  const confirmed = status?.state === "paid";
  const title = confirmed ? "Merci pour ton soutien !" : status?.state === "refunded" ? "Soutien remboursé" : "Ton soutien aux producteurs";

  return <section className={styles.support} data-support-return>
    <KqChapterHeading title={title} level={1} />
    <div role="status" aria-live="polite">
      {status && <p className={styles.receiptAmount}><strong>{supportEuros(status.amountCents)}</strong> · {SUPPORT_PROVIDER_LABELS[provider]}</p>}
      {status ? <p>{confirmed ? "Le versement est confirmé." : supportStatusMessage(status)}</p> : busy ? <p>Vérification de ton paiement…</p> : null}
      {status?.refundedCents ? <p>Montant remboursé de {supportEuros(status.refundedCents)}.</p> : null}
      {busy && status && <p>Vérification auprès du prestataire…</p>}
      {stopped && !supportStatusIsFinal(status) && status?.state !== "review" && <p>Tu peux vérifier de nouveau plus tard. Le suivi continue après la fermeture de cette page.</p>}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      {status?.state === "ready" && status.checkoutUrl && (provider === "swiss-bitcoin-pay"
        ? <a href={status.checkoutUrl} className={`${styles.buttonLink} ${styles.primary}`}>Ouvrir Swiss Bitcoin Pay</a>
        : <button type="button" className={styles.primary} disabled={busy} onClick={() => {
          try { goToSupportPayment(status); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Lien de paiement indisponible."); }
        }}>Reprendre sur Viva</button>)}
      {attempt && !confirmed && <button ref={verifyButton} type="button" aria-disabled={busy} onClick={() => {
        if (controller.current) void check(attempt, controller.current.signal);
      }}>Vérifier à nouveau</button>}
      <Link className={styles.buttonLink} href="/soutenir">Voir la cagnotte</Link>
      <Link ref={returnLink} className={confirmed ? `${styles.buttonLink} ${styles.primary}` : styles.buttonLink} href={returnHref}>Retour au Quartier</Link>
    </div>
    {status && <small className={styles.reference}>Référence de ton soutien&nbsp;: {status.id}</small>}
    <p className={styles.contact}>Besoin d’aide ? <a href={`mailto:${BUSINESS_IDENTITY.email}`}>{BUSINESS_IDENTITY.email}</a></p>
  </section>;
}
