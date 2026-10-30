"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, RefreshCw } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { isKqOnlineSalesPage, type KqOnlineSalesPage } from "@/lib/kanab-quest-online-sales";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqOnlineSalesJournal.module.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const money = (cents: number | null) => cents === null ? "Indisponible" : formatKqCash(cents);

function JournalEntries({ revision }: { revision: string }) {
  const api = useKqTutorialApi();
  const [page, setPage] = useState<KqOnlineSalesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedRevision, setLoadedRevision] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const olderLoaded = useRef(false);
  const retryCursor = useRef<string | null>(null);

  const load = useCallback(async (cursor: string | null, currentRevision: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    olderLoaded.current = cursor !== null;
    retryCursor.current = cursor;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "50" });
      if (cursor) query.set("cursor", cursor);
      const response = await api.request(`/api/arena/placard/commerce/sales?${query}`, { cache: "no-store", signal: controller.signal });
      const result: unknown = await response.json();
      if (!response.ok || !isKqOnlineSalesPage(result)) throw new Error("Le journal des ventes est indisponible. Réessaie dans un instant.");
      if (controller.signal.aborted) return;
      setPage(previous => {
        if (!cursor || !previous) return result;
        const known = new Set(previous.receipts.map(sale => sale.id));
        return { ...result, receipts: [...previous.receipts, ...result.receipts.filter(sale => !known.has(sale.id))] };
      });
      if (!cursor) setLoadedRevision(currentRevision);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Le journal des ventes est indisponible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // Keep older pages in place while the player is reading their history.
    if (!olderLoaded.current) void load(null, revision);
  }, [load, revision]);
  useEffect(() => () => pending.current?.abort(), []);

  return <div className={styles.body} aria-busy={loading}>
    <div className={styles.toolbar}>
      <p>Les versements sont les montants crédités en trésorerie, après retenues. Ce ne sont pas des bénéfices.</p>
      <button type="button" onClick={() => void load(null, revision)} disabled={loading} data-online-sales-refresh><RefreshCw size={16} aria-hidden="true" />Actualiser</button>
    </div>
    {loadedRevision !== null && loadedRevision !== revision && !loading ? <p className={styles.notice} role="status">De nouvelles ventes sont disponibles. Actualise le journal pour les consulter.</p> : null}
    {page?.receipts.length ? <ol className={styles.receipts}>
      {page.receipts.map(sale => <li key={sale.id} data-online-sale={sale.id}>
        <div className={styles.identity}>
          <strong>{sale.name} · {sale.quantity.toLocaleString("fr-FR")} {sale.quantity === 1 ? sale.kind === "flower" ? "paquet" : "article" : sale.unitLabel}{sale.kind === "flower" && sale.formatGrams ? ` de ${sale.formatGrams} g` : ""}</strong>
          <span>{sale.kind === "merch" ? "Merch" : "Fleurs et extraits"} · <time dateTime={sale.soldAt}>{dateFormat.format(new Date(sale.soldAt))}</time></span>
        </div>
        <dl className={styles.amounts}>
          <div><dt>Vente TTC</dt><dd>{money(sale.revenueCents)}</dd></div>
          <div><dt>Frais du site</dt><dd>{money(sale.feesCents)}</dd></div>
          <div><dt>Versé en trésorerie</dt><dd>{money(sale.netPayoutCents)}</dd></div>
        </dl>
        <p className={styles.receiptNote}>{sale.kind === "flower"
          ? `Satisfaction : ${sale.satisfaction === null ? "indisponible" : `${sale.satisfaction.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/100`}. Emballages déjà payés à la préparation.`
          : `Fabrication déjà payée : ${money(sale.costCents)}.`}</p>
      </li>)}
    </ol> : !loading && !error ? <p>Aucune vente effectuée pour le moment.</p> : null}
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load(retryCursor.current, revision)} disabled={loading} data-online-sales-retry>Réessayer</button></div> : null}
    <div className={styles.footer}>
      <p role="status">{loading ? "Chargement des ventes…" : page?.receipts.length ? `${page.receipts.length.toLocaleString("fr-FR")} vente${page.receipts.length > 1 ? "s" : ""} affichée${page.receipts.length > 1 ? "s" : ""}.` : ""}</p>
      {page?.receipts.length ? <button type="button" disabled={loading || !page.nextCursor} onClick={() => void load(page.nextCursor, revision)} data-online-sales-more>{page.nextCursor ? "Afficher les ventes précédentes" : "Toutes les ventes sont affichées"}<ChevronDown size={16} aria-hidden="true" /></button> : null}
    </div>
  </div>;
}

export function KqOnlineSalesJournal({ revision }: { revision: string }) {
  const [open, setOpen] = useState(false);
  return <details className={styles.journal} open={open} onToggle={event => setOpen(event.currentTarget.open)} data-online-sales-journal>
    <summary><BookOpen size={21} aria-hidden="true" /><strong>Journal des ventes</strong><ChevronDown className={styles.chevron} size={19} aria-hidden="true" /></summary>
    {open ? <JournalEntries revision={revision} /> : null}
  </details>;
}
