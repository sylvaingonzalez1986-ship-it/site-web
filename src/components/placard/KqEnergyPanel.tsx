"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Leaf, RefreshCw, Sun, Zap } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ENERGY_MODES, type KqEnergyMode, type KqEnergyQuote, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import styles from "./KqEnergyPanel.module.css";

export function KqEnergyPanel({ selectedMode, onModeChange, onQuoteChange, lockedQuote, runId, disabled = false }: {
  disabled?: boolean;
  selectedMode?: KqEnergyMode;
  onModeChange?: (mode: KqEnergyMode) => void;
  onQuoteChange?: (quote: KqEnergyQuote | null) => void;
  lockedQuote?: KqEnergyQuote;
  runId?: string | null;
}) {
  const [snapshot, setSnapshot] = useState<KqEnergySnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const payment = useRef<{ amount: number; key: string } | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    try {
      const response = await fetch("/api/arena/placard/energy", { cache: "no-store" });
      const body = await response.json() as KqEnergySnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error || "Compteur indisponible.");
      if (id === generation.current) { setSnapshot(body); setError(""); }
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error ? reason.message : "Compteur indisponible.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener("kq:equipment-updated", update);
    const invalidate = () => { generation.current++; };
    return () => { invalidate(); window.removeEventListener("kq:equipment-updated", update); };
  }, [refresh]);
  const quote = lockedQuote ?? (selectedMode ? snapshot?.quotes[selectedMode] : undefined);
  useEffect(() => { onQuoteChange?.(error ? null : quote ?? null); }, [quote, error, onQuoteChange]);
  const invoice = snapshot?.invoices.find((item) => item.runId === runId);
  const due = snapshot?.outstandingCents ?? 0;
  const pay = async () => {
    if (inFlight.current || !snapshot || due <= 0 || snapshot.cashCents < due) return;
    inFlight.current = true; setPending(true); setError(""); setNotice("");
    if (payment.current?.amount !== due) payment.current = { amount: due, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/arena/placard/energy", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: payment.current.key, expectedCents: due }) });
      const result = await response.json() as { error?: string; paidCents: number };
      if (!response.ok) throw new Error(result.error || "Règlement impossible.");
      setNotice(`${formatKqCash(result.paidCents)} réglés. Factures acquittées !`);
      await refresh(); window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Règlement impossible."); }
    finally { inFlight.current = false; setPending(false); }
  };

  return <section className={styles.panel} aria-label="Électricité du Placard">
    <header><Zap aria-hidden="true" /><div><small>{lockedQuote ? "Facture de fin de cycle" : selectedMode ? "Avant de lancer la culture" : "Électricité du Placard"}</small><h3>{lockedQuote ? KQ_ENERGY_MODES[lockedQuote.mode].name : "Maîtrise ta consommation"}</h3></div><button type="button" aria-label="Actualiser l’électricité" onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
    {selectedMode && onModeChange ? <div className={styles.modes} role="group" aria-label="Mode énergétique">
      {(Object.entries(KQ_ENERGY_MODES) as [KqEnergyMode, typeof KQ_ENERGY_MODES[KqEnergyMode]][]).map(([mode, config]) => <button type="button" key={mode} disabled={disabled} aria-pressed={selectedMode === mode} onClick={() => onModeChange(mode)}><strong>{config.name}</strong><small>{config.label}</small>{snapshot ? <b>{formatKqCash(snapshot.quotes[mode].totalCents)}</b> : null}</button>)}
    </div> : null}
    {quote ? <>
      <div className={styles.meter}><div><small>Consommation du cycle</small><strong>{(quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <em>kWh</em></strong></div><div><small>{lockedQuote ? "Facture" : "Facture prévue"}</small><strong>{formatKqCash(quote.totalCents)}</strong></div></div>
      {quote.savingsCents > 0 ? <p className={styles.solar}><Sun size={16} /> Solaire : {quote.solarPercent} % couverts · {formatKqCash(quote.savingsCents)} économisés</p> : null}
      <details><summary>Détail par appareil</summary><ul>{quote.lines.map((line) => <li key={line.code}><span>{line.name} · niv. {line.level}</span><b>{(line.wattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh</b></li>)}</ul><p>0,30 $US virtuel / kWh. Seuls les appareils de culture installés comptent. Le temps hors ligne ne change pas le montant.</p></details>
      {invoice ? <p className={styles.stamp} data-paid={invoice.remainingCents === 0}>{invoice.remainingCents === 0 ? <><Check size={17} /> Réglée</> : `Reste sur ce cycle : ${formatKqCash(invoice.remainingCents)}`}</p> : null}
      {lockedQuote && invoice && quote.totalWattHours > 0 ? <p><Leaf size={16} /> Rendement énergétique : {(invoice.harvestGrams * 1000 / quote.totalWattHours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g/kWh</p> : null}
    </> : !snapshot && !error ? <p role="status">Lecture du compteur…</p> : null}
    {snapshot && !selectedMode ? <>
      {snapshot.bestGramsPerKwh !== null ? <p><Leaf size={16} /> Record personnel : {Number(snapshot.bestGramsPerKwh).toLocaleString("fr-FR")} g/kWh</p> : null}
      {due > 0 ? <div className={styles.payment}><strong>Total restant dû : {formatKqCash(due)}</strong><button type="button" disabled={pending || snapshot.cashCents < due} onClick={() => void pay()}>{pending ? "Règlement…" : `Tout régler · ${formatKqCash(due)}`}</button><p>Sinon, tes prochaines ventes règlent automatiquement les factures, dans la limite de 50 % de chaque versement. Tu peux continuer à jouer.</p>{snapshot.cashCents < due ? <small>Trésorerie disponible : {formatKqCash(snapshot.cashCents)}</small> : null}</div> : <p className={styles.stamp} data-paid><Check size={17} /> Aucune facture en attente</p>}
      {!lockedQuote && snapshot.invoices.length > 0 ? <details><summary>Dernières factures · {snapshot.invoiceCount} cycles au total</summary><ul>{snapshot.invoices.map((item) => <li key={item.runId}><span>{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {KQ_ENERGY_MODES[item.quote.mode].name}<small>Cycle {item.runId.slice(0, 8)}</small></span><b>{formatKqCash(item.totalCents)}<small>{item.remainingCents ? `${formatKqCash(item.remainingCents)} restants` : "Réglée"}</small></b></li>)}</ul></details> : null}
    </> : selectedMode ? <p>Facture à la récolte. Paiement immédiat ou prélèvement progressif sur tes ventes.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error} Utilise Actualiser pour réessayer.</p> : null}
  </section>;
}
