"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { isKqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { KqWarehouseViewSnapshot } from "./KqWarehouse";
import styles from "./KqWarehouse.module.css";

type RemovalQuote = {
  zoneId: string; revision: number; resaleCents: number; unknownPurchaseCount: number;
  lines: Array<{ code: string; name: string; quantity: number; wearPercent: number; purchaseCents: number | null; resaleCents: number | null }>;
};
export type KqWarehouseRemovalAttempt = {
  action: "remove-zone"; zoneId: string; expectedRevision: number; resellEquipment: boolean; expectedResaleCents: number; requestKey: string;
};
export type KqWarehouseRemovalReceipt = { resaleCents: number; soldCount: number; keptCount: number };

export function KqWarehouseZoneRemoval({ zoneId, revision, saved, dirty, locked, attempt, onBusyChange, onRemoved, onRemoveDraft }: {
  zoneId: string; revision: number; saved: boolean; dirty: boolean; locked: boolean;
  attempt: { current: KqWarehouseRemovalAttempt | null };
  onBusyChange: (busy: boolean) => void;
  onRemoved: (snapshot: KqWarehouseViewSnapshot, receipt: KqWarehouseRemovalReceipt) => void;
  onRemoveDraft: () => void;
}) {
  const api = useKqTutorialApi();
  const [quote, setQuote] = useState<RemovalQuote | null>(null);
  const [resell, setResell] = useState(() => attempt.current?.zoneId === zoneId && attempt.current.resellEquipment || false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(() => attempt.current?.zoneId === zoneId);
  const [refresh, setRefresh] = useState(0);
  const mounted = useRef(true);
  const sending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const otherPending = !!attempt.current && attempt.current.zoneId !== zoneId;
  const loadQuote = useCallback(async (signal: AbortSignal) => {
    setReading(true); setError(""); setQuote(null);
    try {
      const response = await api.request("/api/arena/placard/warehouse", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote-zone-removal", zoneId, expectedRevision: revision }), signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Le montant de reprise est indisponible.");
      if (result.zoneId !== zoneId || result.revision !== revision || !Number.isSafeInteger(result.resaleCents) || result.resaleCents < 0
        || !Number.isSafeInteger(result.unknownPurchaseCount) || result.unknownPurchaseCount < 0 || !Array.isArray(result.lines)
        || result.lines.some((line: RemovalQuote["lines"][number]) => typeof line.code !== "string" || typeof line.name !== "string"
          || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.wearPercent) || line.wearPercent < 0 || line.wearPercent > 100
          || line.purchaseCents !== null && (!Number.isSafeInteger(line.purchaseCents) || line.purchaseCents < 0)
          || line.resaleCents !== null && (!Number.isSafeInteger(line.resaleCents) || line.resaleCents < 0))) throw new Error("Le devis de reprise est incomplet. Actualise-le avant de continuer.");
      if (!signal.aborted) setQuote(result);
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : "Devis indisponible."); }
    finally { if (!signal.aborted) setReading(false); }
  }, [api, revision, zoneId]);
  useEffect(() => {
    if (!saved || dirty || retry || otherPending) return;
    const controller = new AbortController();
    void loadQuote(controller.signal);
    return () => controller.abort();
  }, [saved, dirty, retry, otherPending, refresh, loadQuote]);

  async function confirm() {
    if (sending.current || locked || otherPending) return;
    if (!saved) { onRemoveDraft(); return; }
    if (dirty || !retry && !quote) return;
    const body = attempt.current?.zoneId === zoneId ? attempt.current : {
      action: "remove-zone" as const, zoneId, expectedRevision: revision, resellEquipment: resell,
      expectedResaleCents: resell ? quote!.resaleCents : 0, requestKey: createClientRequestKey(),
    };
    attempt.current = body;
    sending.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      const response = await api.request("/api/arena/placard/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) {
        // A rejected request has not changed the plan. A server/network failure
        // can hide an applied transaction: only retry its exact request key.
        if (response.status >= 400 && response.status < 500) { attempt.current = null; setRetry(false); setQuote(null); }
        throw new Error(result.error || "La suppression n’a pas pu être confirmée.");
      }
      const receipt = result.removalReceipt as KqWarehouseRemovalReceipt | undefined;
      if (!isKqWarehouseState(result.state) || !Number.isSafeInteger(result.revision) || !Number.isSafeInteger(result.cashCents)
        || !receipt || ![receipt.resaleCents, receipt.soldCount, receipt.keptCount].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("Le reçu est incomplet. Vérifie la même opération pour éviter une seconde demande.");
      attempt.current = null;
      if (mounted.current) onRemoved(result, receipt);
    } catch (reason) {
      if (mounted.current) { setError(reason instanceof Error ? reason.message : "Connexion interrompue."); setRetry(attempt.current?.zoneId === zoneId); }
    } finally { sending.current = false; onBusyChange(false); if (mounted.current) setBusy(false); }
  }

  return <div className={styles.zoneRemoval} data-warehouse-removal>
    <p>La zone sera supprimée et son Buddie libéré. Choisis ce que devient son matériel.</p>
    {!saved ? <p>Cette zone n’est pas encore installée. Son retrait annule seulement ce choix dans le devis, sans vente de matériel.</p>
      : otherPending ? <p role="alert">Une autre suppression doit être vérifiée. Rouvre la zone concernée avant de continuer.</p>
      : dirty ? <p role="status">Enregistre ou annule les modifications du plan avant de supprimer une zone installée.</p>
      : <>
        {reading && <p role="status">Calcul du montant de reprise…</p>}
        <fieldset disabled={busy || retry || locked || !quote} className={styles.removalChoices}>
          <legend>Matériel de la zone</legend>
          <label><input type="radio" name={`removal-${zoneId}`} checked={!resell} onChange={() => setResell(false)} /><span><strong>Garder en réserve</strong><small>Disponible pour une autre zone, avec son usure actuelle.</small></span></label>
          <label><input type="radio" name={`removal-${zoneId}`} checked={resell} onChange={() => setResell(true)} /><span><strong>Revendre d’occasion</strong><small>{quote ? `${formatKqCash(quote.resaleCents)} versés au portefeuille` : retry && attempt.current?.resellEquipment ? `${formatKqCash(attempt.current.expectedResaleCents)} attendus pour cette demande` : "Montant en cours de vérification"}</small></span></label>
        </fieldset>
        <p className={styles.removalRule}>La reprise suit l’état restant : 20 % d’usure rapporte 80 % du prix d’achat ; 50 % d’usure rapporte 50 %. La pose n’est pas remboursée.</p>
        {quote && <>
          {quote.unknownPurchaseCount > 0 && <p role="status">Le prix d’achat de {quote.unknownPurchaseCount} élément{quote.unknownPurchaseCount > 1 ? "s" : ""} est inconnu. Ce matériel restera en réserve.</p>}
          <details><summary>Matériel concerné et montant de reprise</summary><ul className={styles.removalLines}>{quote.lines.map((line, index) => <li key={`${line.code}-${index}`}><span><strong>{line.name} × {line.quantity}</strong><small>Usure : {line.wearPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</small></span><strong>{line.resaleCents === null ? "Conservé en réserve" : formatKqCash(line.resaleCents)}</strong></li>)}</ul></details>
        </>}
        {retry && <p role="status">Le résultat de la demande reste à vérifier. Le bouton renvoie exactement la même opération, sans double paiement.</p>}
      </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {saved && !dirty && !reading && !quote && !retry && !otherPending && <button type="button" className={styles.secondary} disabled={locked} onClick={() => setRefresh(value => value + 1)}>Actualiser le devis</button>}
    <button type="button" className={styles.danger} data-warehouse-remove-confirm disabled={locked || busy || otherPending || saved && (dirty || !retry && !quote)} onClick={() => void confirm()}>{busy ? "Suppression en cours…" : retry ? "Vérifier la suppression" : !saved ? "Retirer cette zone du devis" : resell ? `Supprimer et revendre · ${quote ? formatKqCash(quote.resaleCents) : "…"}` : "Supprimer et garder le matériel"}</button>
  </div>;
}
