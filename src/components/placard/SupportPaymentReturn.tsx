"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { SUPPORT_UUID, supportEuros, type SupportAttempt, type SupportStatus } from "@/lib/support-campaign";
import { goToSupportPayment, readSupportAttempt, supportRequest } from "@/lib/support-client";
import styles from "./KqFinancialSupport.module.css";

export function SupportPaymentReturn({ transactionId }: { transactionId?: string }) {
  const [attempt, setAttempt] = useState<SupportAttempt | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [stopped, setStopped] = useState(false);
  const flight = useRef(false);
  const mounted = useRef(true);
  const check = useCallback(async (saved: SupportAttempt) => {
    if (flight.current) return null;
    flight.current = true;
    try {
      const result = await supportRequest<SupportStatus>("/api/support/status", { id: saved.id, token: saved.token,
        ...(transactionId && SUPPORT_UUID.test(transactionId) ? { transactionId } : {}) });
      if (mounted.current) { setStatus(result); setError(""); }
      return result;
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Vérification momentanément indisponible."); return null; }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  }, [transactionId]);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saved: SupportAttempt | null = null;
    try { saved = readSupportAttempt(); } catch { /* Show recovery instructions, never infer success. */ }
    if (!saved) { setError("La fiche de soutien n’est pas disponible dans cet onglet. Le paiement sera comptabilisé après sa confirmation par Viva."); setBusy(false); return; }
    setAttempt(saved);
    let polls = 0;
    const poll = async () => {
      const result = await check(saved!);
      if (!mounted.current || (result && ["paid", "refunded", "cancelled", "review"].includes(result.state))) return;
      if (++polls < 10) timer = setTimeout(() => void poll(), 3000);
      else setStopped(true);
    };
    void poll();
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [check]);
  const confirmed = status?.state === "paid";
  return <section className={styles.support} data-support-return>
    <h1 className="font-display text-3xl">{confirmed ? "Merci pour ton soutien !" : status?.state === "refunded" ? "Soutien remboursé" : "Ton soutien aux producteurs"}</h1>
    <div role="status" aria-live="polite">
      {confirmed ? <p>Ton versement de <strong>{supportEuros(status.amountCents)}</strong> est confirmé. La cagnotte a été mise à jour.</p>
        : status?.state === "refunded" ? <p>Le remboursement de {supportEuros(status.refundedCents)} a été confirmé.</p>
        : status?.state === "cancelled" ? <p>Cette session de paiement a été annulée.</p>
        : status?.state === "review" ? <p>Le versement est en cours de rapprochement par l’équipe.</p>
        : <p>{busy ? "Vérification de ton paiement auprès de Viva…" : "Ton paiement n’est pas encore confirmé."}</p>}
      {confirmed && status.refundedCents > 0 && <p>Dont {supportEuros(status.refundedCents)} remboursés.</p>}
      {stopped && !confirmed && <p>La confirmation peut prendre un peu de temps. Tu peux revenir vérifier : fermer cette page n’interrompt pas le suivi du versement.</p>}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      {attempt && <button type="button" disabled={busy} onClick={() => { setBusy(true); void check(attempt); }}>Vérifier à nouveau</button>}
      {status?.checkoutUrl && !confirmed && <button type="button" onClick={() => { try { goToSupportPayment(status); } catch (cause) { setError((cause as Error).message); } }}>Reprendre sur Viva</button>}
      <Link className={styles.buttonLink} href="/soutenir">Voir la cagnotte</Link>
      <Link className={styles.buttonLink} href="/arene/placard">Retour au Quartier</Link>
    </div>
    {attempt && <p className={styles.reference}>Référence : {attempt.id}</p>}
    <p>Besoin d’aide ? <a href={`mailto:${BUSINESS_IDENTITY.email}`}>{BUSINESS_IDENTITY.email}</a></p>
  </section>;
}
