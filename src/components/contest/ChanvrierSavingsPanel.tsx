"use client";
import { useEffect, useRef, useState } from "react";
import { PiggyBank, RefreshCw } from "lucide-react";
import { parseSavingsAmount, type ChanvrierSavings, type ChanvrierSavingsCommand } from "@/lib/chanvrier-savings";
import styles from "./ChanvrierSavingsPanel.module.css";
const euro = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export function ChanvrierSavingsPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChanvrierSavings | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const inFlight = useRef(false);
  const pending = useRef<ChanvrierSavingsCommand | null>(null);
  const cents = parseSavingsAmount(amount);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setError("");
    void fetch("/api/arena/chanvrier/savings", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (!disposed) setData(body);
    }).catch(() => { if (!disposed) setError("Impossible d’ouvrir le livret. Réessaie."); }).finally(() => { clearTimeout(timer); if (!disposed) setBusy(false); });
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [open, refresh]);
  async function transfer(action: "deposit" | "withdraw") {
    if (!cents || busy || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    const command = pending.current?.action === action && pending.current.amountCents === cents ? pending.current : { action, amountCents: cents, requestKey: crypto.randomUUID() };
    pending.current = command;
    try {
      const response = await fetch("/api/arena/chanvrier/savings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok) { if (response.status < 500) pending.current = null; throw new Error(body.error); }
      setData(body); setAmount(""); pending.current = null;
      setNotice(`${euro(cents)} ${action === "deposit" ? "déposés sur ton livret" : "retirés vers ta trésorerie"}.`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (cause) { setError(cause instanceof Error && cause.name !== "TimeoutError" && !(cause instanceof TypeError) ? cause.message : "Réponse interrompue. Réessaie le même montant : l’opération ne sera comptée qu’une fois."); }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <section className={styles.panel}>
    <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(value => !value)}><PiggyBank size={22} /><span><strong>Mon livret d’épargne</strong><small>Trésorier · +5 % toutes les 24 h</small></span><b>{open ? "−" : "+"}</b></button>
    {open ? <div className={styles.body} aria-busy={busy}>
      <p>Place la monnaie de ton jeu. Chaque dépôt rapporte 5 % après 24 h complètes, puis les intérêts sont réinvestis chaque jour, même pendant ton absence. Les centimes sont arrondis à l’inférieur.</p>
      {data ? <><div className={styles.balances}><div><small>Sur ton livret</small><strong>{euro(data.balanceCents)}</strong></div><div><small>Disponible en jeu</small><strong>{euro(data.cashCents)}</strong></div></div>
        {data.nextInterestAt ? <p>Prochains intérêts : {new Date(data.nextInterestAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</p> : <p>{data.balanceCents >= data.maxBalanceCents ? "Le plafond du livret est atteint." : "Dépose au moins 0,20 € pour commencer à gagner des intérêts."}</p>}
        {data.interestCreditedCents > 0 ? <p className={styles.gain}>+{euro(data.interestCreditedCents)} d’intérêts ajoutés au livret.</p> : null}
        <label>Montant en euros<input inputMode="decimal" placeholder="Ex. 100,00" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} /></label>
        <div className={styles.actions}><button type="button" disabled={busy || !cents || cents > data.cashCents || cents + data.balanceCents > data.maxBalanceCents} onClick={() => void transfer("deposit")}>Déposer</button><button type="button" disabled={busy || !cents || cents > data.balanceCents} onClick={() => void transfer("withdraw")}>Retirer</button><button type="button" aria-label="Actualiser le livret" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} /></button></div>
        <small>Retrait libre. Chaque nouveau dépôt garde son propre délai de 24 h. Plafond, intérêts compris : {euro(data.maxBalanceCents)}.</small>
      </> : busy ? <p role="status">Ouverture du livret…</p> : <button type="button" onClick={() => setRefresh(value => value + 1)}>Réessayer</button>}
      {notice ? <p role="status" className={styles.gain}>{notice}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div> : null}
  </section>;
}
