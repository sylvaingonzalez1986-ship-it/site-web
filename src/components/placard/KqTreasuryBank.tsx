"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChartNoAxesCombined, Landmark, LockKeyhole, PiggyBank, RefreshCw } from "lucide-react";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ChanvrierSavingsPanel } from "../contest/ChanvrierSavingsPanel";
import { KqBankLoans } from "./KqBankLoans";
import { KqCryptoMarket } from "./KqCryptoMarket";
import styles from "./KqTreasuryBank.module.css";

const DESKS = [
  { id: "loans", label: "Le banquier", icon: Landmark },
  { id: "savings", label: "Livret d’épargne", icon: PiggyBank },
  { id: "crypto", label: "Crypto · Top 100", icon: ChartNoAxesCombined },
] as const;
type Desk = typeof DESKS[number]["id"];

function SavingsDesk() {
  const [state, setState] = useState<{ profile: ChanvrierProfile | null; loaded: boolean; error: string }>({ profile: null, loaded: false, error: "" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/arena/chanvrier", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body || !("profile" in body)) throw new Error("Ton accès au livret est momentanément indisponible.");
        if (!controller.signal.aborted) setState({ profile: body.profile, loaded: true, error: "" });
      } catch (cause) { if (!controller.signal.aborted) setState(previous => ({ ...previous, error: cause instanceof Error ? cause.message : "Livret indisponible." })); }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    const resume = () => { if (!document.hidden) update(); };
    window.addEventListener("kq:equipment-updated", update);
    document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("kq:equipment-updated", update); document.removeEventListener("visibilitychange", resume); };
  }, []);
  return <div className={styles.columns}>
    <section className={styles.savings} aria-label="Placements"><header><PiggyBank size={24} aria-hidden="true" /><div><small>La réserve du Trésorier</small><h3>Ton livret</h3></div></header>
      {state.error ? <div className={styles.error} role="alert">{state.error}<button type="button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" /> Réessayer</button></div> : !state.loaded ? <p role="status">Ouverture de ton livret…</p> : state.profile?.strength === "treasurer" ? <ChanvrierSavingsPanel embedded refreshKey={refresh} /> : <div className={styles.locked}><LockKeyhole size={24} aria-hidden="true" /><h4>Le livret du Trésorier</h4><p>Le livret est l’avantage de la spécialité Trésorier : 5 % toutes les 24 heures sur la monnaie du jeu, avec retrait libre.</p><span>Spécialité Trésorier requise</span><p>{state.profile ? "Ta spécialité actuelle ne donne pas accès à ce placement. Le marché crypto reste accessible depuis son guichet." : "Ton personnage n’a pas encore de spécialité enregistrée."}</p></div>}
    </section>
    <aside className={styles.reputation}><header><PiggyBank size={23} aria-hidden="true" /><h3>Une réserve disponible</h3></header><p>Chaque dépôt commence son propre délai de 24 heures. Les intérêts sont réinvestis sur le livret, même pendant ton absence.</p><p>Tu peux retirer ton épargne pour régler une facture, une échéance de prêt ou financer ton prochain équipement.</p><small>Le livret utilise uniquement les euros virtuels du Placard. Ses règles restent celles de la spécialité Trésorier.</small></aside>
  </div>;
}

export function KqTreasuryBank() {
  const [desk, setDesk] = useState<Desk>("loans");
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % DESKS.length : event.key === "ArrowLeft" ? (index + DESKS.length - 1) % DESKS.length : event.key === "Home" ? 0 : event.key === "End" ? DESKS.length - 1 : null;
    if (target === null) return;
    event.preventDefault(); setDesk(DESKS[target].id); document.getElementById(`bank-desk-${DESKS[target].id}`)?.focus();
  }
  return <div className={styles.bank}>
    <header className={styles.intro}><small>02 / Banque</small><h2>La Banque du Placard</h2><p>Un œil sur ta réputation. L’autre sur les taux.</p></header>
    <nav className={styles.desks} role="tablist" aria-label="Guichets de la banque">{DESKS.map((item, index) => <button type="button" role="tab" key={item.id} id={`bank-desk-${item.id}`} aria-controls={`bank-panel-${item.id}`} aria-selected={desk === item.id} tabIndex={desk === item.id ? 0 : -1} onClick={() => setDesk(item.id)} onKeyDown={event => navigate(event, index)}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span></button>)}</nav>
    <section id={`bank-panel-${desk}`} role="tabpanel" aria-labelledby={`bank-desk-${desk}`} tabIndex={0} className={styles.deskPanel}>
      {desk === "loans" ? <KqBankLoans /> : desk === "crypto" ? <KqCryptoMarket /> : <SavingsDesk />}
    </section>
  </div>;
}
