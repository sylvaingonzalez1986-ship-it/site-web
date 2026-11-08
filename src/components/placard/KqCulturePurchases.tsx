"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { getKqCareProduct } from "@/lib/kanab-quest-care";
import { isKqCarePurchasesPage, type KqCarePurchasesPage } from "@/lib/kanab-quest-care-purchases";
import { formatKqCash as money } from "@/lib/kanab-quest-equipment";
import { KqAllocationBar } from "./KqVisuals";
import { useKqTutorialApi, type KqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqTreasuryInvoices.module.css";

const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const labels = { input: "Intrants", pbi: "PBI", basic: "Entretien" } as const;

async function readPurchases(api: KqTutorialApi, signal: AbortSignal, cursor?: string) {
  const response = await api.request(`/api/arena/placard/care/purchases${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal });
  const body: unknown = await response.json();
  if (!response.ok || !isKqCarePurchasesPage(body)) throw new Error("Le registre des achats n’a pas pu être chargé.");
  return body;
}

/** Paid purchase receipts stay separate from outstanding invoices. */
export function KqCulturePurchases({ refreshKey }: { refreshKey: string }) {
  const api = useKqTutorialApi();
  const [retry, setRetry] = useState(0);
  const key = `${refreshKey}:${retry}`;
  const [result, setResult] = useState<{ key: string; data?: KqCarePurchasesPage; error?: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState("");
  const pendingPage = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void readPurchases(api, controller.signal).then(data => {
      if (!controller.signal.aborted) { setResult({ key, data }); setPageError(""); }
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, error: "Le registre des achats n’a pas pu être chargé. Actualise pour retrouver les montants enregistrés." });
    });
    return () => { controller.abort(); pendingPage.current?.abort(); };
  }, [api, key]);
  const current = result?.key === key ? result : null;
  const data = current?.data;
  async function loadMore() {
    if (!data?.nextCursor || pendingPage.current) return;
    const controller = new AbortController();
    pendingPage.current = controller;
    setLoadingMore(true); setPageError("");
    try {
      const next = await readPurchases(api, controller.signal, data.nextCursor);
      if (controller.signal.aborted) return;
      setResult(previous => {
        if (previous?.key !== key || !previous.data) return previous;
        const ids = new Set(previous.data.items.map(item => item.id));
        return { key, data: { ...next, items: [...previous.data.items, ...next.items.filter(item => !ids.has(item.id))] } };
      });
    } catch {
      if (!controller.signal.aborted) setPageError("Les achats plus anciens n’ont pas pu être chargés. Réessaie.");
    } finally {
      if (pendingPage.current === controller) pendingPage.current = null;
      setLoadingMore(false);
    }
  }
  return <details className={styles.register} aria-label="Achats d’intrants" data-culture-purchases aria-busy={!current || loadingMore}>
    <summary className={styles.purchaseToggle}><h2>Achats d’intrants</h2><ChevronDown size={22} aria-hidden="true" /></summary>
    <div className={styles.purchaseContent}>
    <div className={styles.heading}><p className={styles.incomplete}>Intrants, PBI et entretien payés à l’achat, pendant la culture ou pour la réserve.</p><button type="button" className={styles.secondary} aria-label="Actualiser les achats d’intrants" disabled={!current || loadingMore} onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></div>
    {!current ? <p role="status">Chargement du registre…</p> : current.error ? <p className={styles.purchaseError} role="alert">{current.error}</p> : data ? <>
      <div className={styles.purchaseSummary}><div><span>Total déjà payé</span><strong>{money(data.totalPaidCents)}</strong></div><p><Check size={17} aria-hidden="true" /> {data.totalCount.toLocaleString("fr-FR")} achat{data.totalCount !== 1 ? "s" : ""} enregistré{data.totalCount !== 1 ? "s" : ""}<small>Ces montants ne sont plus à régler.</small></p></div>
      {data.items.length > 0 ? <>
        <div className={styles.purchaseTableWrap}><table className={styles.purchaseTable}>
          <caption>Achats enregistrés · {data.items.length} sur {data.totalCount}</caption>
          <thead><tr><th scope="col">Date et achat</th><th scope="col">Culture et surface</th><th scope="col">Payé</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id} data-culture-purchase={item.id}>
            <th scope="row"><strong>{item.kind === "basic" ? "Entretien de culture" : getKqCareProduct(item.productCode ?? "")?.name ?? item.productCode ?? "Intrant"}</strong><time dateTime={item.createdAt}>{date(item.createdAt)}</time><small>{labels[item.kind]} · {item.quantity} {item.areaM2 === null ? `unité${item.quantity > 1 ? "s" : ""}` : `passage${item.quantity > 1 ? "s" : ""}`}</small></th>
            <td><span>{item.runId ? `Culture ${item.runId.slice(0, 8)}` : "Réserve / achat non rattaché"}</span>{item.stageIndex !== null ? <small>Étape {item.stageIndex + 1}</small> : null}<small>{item.areaM2 === null ? "Surface non enregistrée" : `${item.areaM2.toLocaleString("fr-FR")} m² par passage`}</small></td>
            <td className={styles.purchaseAmount}><strong>{money(item.amountCents)}</strong><small>Réglé</small></td>
          </tr>)}</tbody>
        </table></div>
        {pageError ? <p className={styles.purchaseError} role="alert">{pageError}</p> : null}
        {data.nextCursor ? <button type="button" className={styles.secondary} data-more-purchases disabled={loadingMore} onClick={() => void loadMore()}><ChevronDown size={16} aria-hidden="true" /> {loadingMore ? "Chargement…" : "Voir les achats plus anciens"}</button> : null}
        <details className={styles.history}><summary>Répartition des achats affichés</summary><KqAllocationBar label="Montants déjà payés dans les lignes affichées" items={(["input", "pbi", "basic"] as const).map(kind => {
          const value = data.items.filter(item => item.kind === kind).reduce((sum, item) => sum + item.amountCents, 0);
          return { label: labels[kind], value, displayValue: money(value) };
        })} /><p className={styles.incomplete}>Les anciens reçus conservent leurs montants d’origine. Une surface ou une culture absente du reçu n’est pas reconstituée.</p></details>
      </> : <p className={styles.incomplete}>Aucun achat d’intrant enregistré.</p>}
    </> : null}
    </div>
  </details>;
}
