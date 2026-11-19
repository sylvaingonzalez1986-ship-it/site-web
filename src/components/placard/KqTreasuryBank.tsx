"use client";

import { useKqTutorialApi } from "./KqTutorialApiContext";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChartNoAxesCombined, ChartCandlestick, Landmark, LockKeyhole, PiggyBank, RefreshCw } from "lucide-react";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";
import { KQ_BANK_DESK_LABELS, type KqBankDesk } from "@/lib/kanab-quest-bank-navigation";
import { ChanvrierSavingsPanel } from "../contest/ChanvrierSavingsPanel";
import { KqBankLoans } from "./KqBankLoans";
import { KqCryptoMarket } from "./KqCryptoMarket";
import { KqStockMarket } from "./KqStockMarket";
import officeStyles from "./KqTreasuryDesk.module.css";
import styles from "./KqTreasuryBank.module.css";

const DESKS = [
  { id: "loans", icon: Landmark },
  { id: "savings", icon: PiggyBank },
  { id: "stocks", icon: ChartCandlestick },
  { id: "crypto", icon: ChartNoAxesCombined },
] as const;

function SavingsDesk() {
  const api = useKqTutorialApi();
  const [state, setState] = useState<{ profile: ChanvrierProfile | null; loaded: boolean; error: string }>({ profile: null, loaded: false, error: "" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await api.request("/api/arena/chanvrier", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body || !("profile" in body)) throw new Error("Ton accès au livret est momentanément indisponible.");
        if (!controller.signal.aborted) setState({ profile: body.profile, loaded: true, error: "" });
      } catch (cause) { if (!controller.signal.aborted) setState(previous => ({ ...previous, error: cause instanceof Error ? cause.message : "Livret indisponible." })); }
    }
    void load();
    return () => controller.abort();
  }, [api, refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    const resume = () => { if (!document.hidden) update(); };
    const unsubscribe_kq_equipment_updated = api.subscribe(["kq:equipment-updated"], update);
    document.addEventListener("visibilitychange", resume);
    return () => { unsubscribe_kq_equipment_updated(); document.removeEventListener("visibilitychange", resume); };
  }, [api]);
  return <div className={styles.columns}>
    <section className={styles.savings} aria-label="Placements" data-tutorial-observation={state.loaded && !state.error && state.profile?.strength !== "treasurer" ? "banking-savings" : undefined}><header><PiggyBank size={24} aria-hidden="true" /><div><h3>Ton livret</h3></div></header>
      {state.error ? <div className={styles.error} role="alert">{state.error}<button type="button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" /> Réessayer</button></div> : !state.loaded ? <p role="status">Ouverture de ton livret…</p> : state.profile?.strength === "treasurer" ? <ChanvrierSavingsPanel embedded refreshKey={refresh} /> : <div className={styles.locked}><LockKeyhole size={24} aria-hidden="true" /><h4>Le livret du Trésorier</h4><p>Le livret est l’avantage de la spécialité Trésorier : 5 % toutes les 24 heures sur la monnaie du jeu, avec retrait libre.</p><span>Spécialité Trésorier requise</span><p>{state.profile ? "Ta spécialité actuelle ne donne pas accès à ce placement. Les guichets Crypto et Bourse restent accessibles." : "Ton personnage n’a pas encore de spécialité enregistrée."}</p></div>}
    </section>
  </div>;
}

function BankDeskContent({ desk }: { desk: KqBankDesk }) {
  switch (desk) {
    case "loans": return <KqBankLoans />;
    case "savings": return <SavingsDesk />;
    case "stocks": return <KqStockMarket />;
    case "crypto": return <KqCryptoMarket />;
  }
}

export function KqTreasuryBank({ desk }: { desk: KqBankDesk }) {
  return <section id={`bank-panel-${desk}`} role="region" className={`${officeStyles.page} ${officeStyles.embedded} ${styles.bank}`} aria-label={KQ_BANK_DESK_LABELS[desk]} data-treasury-bank>
    <BankDeskContent desk={desk} />
  </section>;
}

export function KqTutorialBank({ initialDesk = "loans", onDeskChange }: { initialDesk?: KqBankDesk; onDeskChange?: (desk: KqBankDesk) => void }) {
  const [localDesk, setLocalDesk] = useState(initialDesk);
  const desk = onDeskChange ? initialDesk : localDesk;
  const selectDesk = onDeskChange ?? setLocalDesk;
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % DESKS.length : event.key === "ArrowLeft" ? (index + DESKS.length - 1) % DESKS.length : event.key === "Home" ? 0 : event.key === "End" ? DESKS.length - 1 : null;
    if (target === null) return;
    event.preventDefault(); selectDesk(DESKS[target].id); document.getElementById(`bank-desk-${DESKS[target].id}`)?.focus();
  }
  return <section className={`${officeStyles.page} ${officeStyles.embedded} ${styles.bank}`} aria-label="Banque" data-treasury-bank>
    <nav className={styles.desks} role="tablist" aria-label="Guichets de la banque">
      {DESKS.map((item, index) => <button type="button" role="tab" key={item.id} id={`bank-desk-${item.id}`} aria-controls={`bank-panel-${item.id}`} aria-selected={desk === item.id} tabIndex={desk === item.id ? 0 : -1} onClick={() => selectDesk(item.id)} onKeyDown={event => navigate(event, index)}>
        <item.icon size={20} aria-hidden="true" /><span>{KQ_BANK_DESK_LABELS[item.id]}</span>
      </button>)}
    </nav>
    <section id={`bank-panel-${desk}`} role="tabpanel" aria-labelledby={`bank-desk-${desk}`} tabIndex={0} className={styles.deskPanel}>
      <BankDeskContent desk={desk} />
    </section>
  </section>;
}
