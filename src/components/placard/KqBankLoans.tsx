"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, Landmark, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { getKqBankerDialogue, getKqBankTerms, isKqBankSnapshot, parseKqBankEuros, KQ_BANK_SCENARIOS, KQ_BANK_TIERS, type KqBankCommand, type KqBankSnapshot } from "@/lib/kanab-quest-bank";
import styles from "./KqBankLoans.module.css";

const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const percent = (bps: number) => (bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Draft = Omit<Extract<KqBankCommand, { action: "borrow" }>, "requestKey"> | Omit<Extract<KqBankCommand, { action: "repay" }>, "requestKey">;

export function KqBankLoans() {
  const [data, setData] = useState<KqBankSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState("1000");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const retry = useRef<{ fingerprint: string; command: KqBankCommand } | null>(null);
  const inFlight = useRef(false);
  const mutationVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = mutationVersion.current;
    async function load() {
      try {
        const response = await fetch("/api/arena/placard/bank", { cache: "no-store", signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !isKqBankSnapshot(value)) throw new Error("Le banquier ne peut pas ouvrir ton dossier pour le moment.");
        if (!controller.signal.aborted && version === mutationVersion.current && !inFlight.current) {
          setData(value); setError("");
          if (value.autoPaidCents > 0) {
            setNotice(`${euros(value.autoPaidCents)} prélevés pour les échéances de ton prêt.`);
            window.dispatchEvent(new CustomEvent("kq:equipment-updated"));
            window.dispatchEvent(new CustomEvent("kq:treasury-updated"));
          }
        }
      } catch (cause) { if (!controller.signal.aborted && version === mutationVersion.current) setError(cause instanceof Error ? cause.message : "Guichet indisponible."); }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const update = () => { if (!document.hidden && !inFlight.current) setRefresh(value => value + 1); };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("kq:equipment-updated", update);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); window.removeEventListener("kq:equipment-updated", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const amountCents = parseKqBankEuros(amount) ?? 0;
  const offer = data?.offer;
  const validAmount = !!offer && amountCents >= offer.minCents && amountCents <= offer.maxCents;
  const terms = validAmount && offer ? getKqBankTerms(amountCents, offer.rateBps) : null;
  const dailyMinCents = terms ? Math.min(...terms.installments) : 0;
  const dailyMaxCents = terms ? Math.max(...terms.installments) : 0;
  function review(value: Draft) { setDraft(value); setError(""); dialog.current?.showModal(); }
  async function confirm() {
    if (!draft || inFlight.current) return;
    inFlight.current = true; mutationVersion.current++; setBusy(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify(draft);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, command: { ...draft, requestKey: crypto.randomUUID() } };
    try {
      const response = await fetch("/api/arena/placard/bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(retry.current.command) });
      const value = await response.json();
      if (!response.ok) {
        if (response.status < 500) retry.current = null;
        throw new Error(value.error || "L’opération n’a pas pu être confirmée.");
      }
      if (!isKqBankSnapshot(value)) throw new Error("Réponse bancaire incomplète. Réessaie la même opération.");
      setData(value); retry.current = null;
      setNotice(draft.action === "borrow" ? "Contrat signé. Le capital est disponible dans ta trésorerie." : "Prêt soldé. Ton dossier est à jour.");
      dialog.current?.close(); setDraft(null);
      window.dispatchEvent(new CustomEvent("kq:equipment-updated"));
      window.dispatchEvent(new CustomEvent("kq:treasury-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion interrompue. Réessaie la même opération."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const scenario = data ? KQ_BANK_SCENARIOS[data.market.scenario] : null;
  return <section className={styles.bank} aria-labelledby="bank-loans-title">
    <header className={styles.heading}><Landmark aria-hidden="true" size={25} /><div><small>Le bureau du banquier</small><h3 id="bank-loans-title">On parle affaires ?</h3></div><button type="button" className={styles.refresh} disabled={busy} aria-label="Actualiser le dossier bancaire" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></button></header>
    {!data && !error ? <p role="status">Le banquier examine ton dossier…</p> : null}
    {error && !draft ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.notice} role="status"><BadgeCheck size={18} aria-hidden="true" />{notice}</p> : null}
    {data && scenario ? <>
      <blockquote className={styles.dialogue}>{getKqBankerDialogue(data)}</blockquote>
      <div className={styles.market}>
        <span>{data.market.changeBps < 0 ? <TrendingDown size={20} aria-hidden="true" /> : <TrendingUp size={20} aria-hidden="true" />}<strong>{scenario.title}</strong><b>{data.market.changeBps > 0 ? "+" : ""}{(data.market.changeBps / 100).toLocaleString("fr-FR")} pt</b></span>
        <p>{data.market.changeBps === 0 && data.market.scenario !== "steady" ? `Le taux reste à son ${data.market.rateBps === 150 ? "plancher" : "plafond"} malgré ce scénario.` : scenario.description}</p><small>Conditions communes du jour · prochain scénario le {date(data.market.expiresAt)}. Tirage quotidien à minuit UTC.</small>
      </div>
      {offer ? <div className={styles.offer}>
        <div className={styles.offerHeading}><div className={styles.offerLimit}><span>Ton plafond personnel</span><strong id="bank-personal-limit">{euros(offer.maxCents)}</strong><small>{data.reputation.toLocaleString("fr-FR")} points de réputation · euros de jeu</small></div><strong>{percent(offer.rateBps)}<small>coût total sur 7 jours réels</small></strong></div>
        <label htmlFor="bank-loan-amount">Capital à emprunter · euros de jeu</label>
        <div className={styles.amount}><input id="bank-loan-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="bank-amount-bounds" /><span>€</span></div>
        <div className={styles.amountPresets} role="group" aria-label="Choisir un montant de prêt">{([{ label: "25 %", share: .25 }, { label: "50 %", share: .5 }, { label: "Maximum", share: 1 }] as const).map(preset => {
          const cents = Math.min(offer.maxCents, Math.max(offer.minCents, Math.round(offer.maxCents * preset.share)));
          return <button type="button" key={preset.label} disabled={busy} aria-pressed={amountCents === cents} aria-label={`${preset.label} du plafond : ${euros(cents)}`} onClick={() => setAmount((cents / 100).toFixed(2))}>{preset.label}</button>;
        })}</div>
        <small id="bank-amount-bounds">De {euros(offer.minCents)} à {euros(offer.maxCents)} · offre valable jusqu’au {date(offer.expiresAt)}.</small>
        {terms ? <><div className={styles.dailyRepayment} id="bank-daily-repayment"><small>7 échéances · toutes les 24 heures réelles</small><strong>{dailyMinCents === dailyMaxCents ? euros(dailyMinCents) : `${euros(dailyMinCents)} à ${euros(dailyMaxCents)}`}</strong><span>par jour, à partir de demain. Le contrat détaille les sept prélèvements.</span></div><dl className={styles.totals}><div><dt>Capital reçu</dt><dd>{euros(amountCents)}</dd></div><div><dt>Intérêts fixes</dt><dd>{euros(terms.interestCents)}</dd></div><div><dt>Total à rendre</dt><dd>{euros(terms.totalCents)}</dd></div></dl></> : <p className={styles.hint}>Choisis un montant dans les limites de ton dossier, avec deux décimales maximum.</p>}
        <button type="button" className={styles.primary} disabled={!terms || busy} onClick={() => { if (offer && terms) review({ action: "borrow", quoteId: offer.quoteId, amountCents, expectedRateBps: offer.rateBps }); }}>Examiner le contrat</button>
      </div> : null}
      {data.blockedReason === "experience" && data.eligibleAt ? <p className={styles.hint}>Ton ancienneté sera suffisante le {date(data.eligibleAt)}.</p> : null}
      {data.loan ? <div className={styles.loan}>
        <div className={styles.offerHeading}><span>Ton prêt en cours</span><strong>{euros(data.loan.remainingCents)}<small>restant à rembourser</small></strong></div>
        <p>Capital : {euros(data.loan.principalCents)} · coût fixe : {euros(data.loan.interestCents)} ({percent(data.loan.rateBps)}). Échéance finale le {date(data.loan.dueAt)}.</p>
        {data.loan.overdueCents > 0 ? <p className={styles.error} role="status">{euros(data.loan.overdueCents)} en retard. Tes prochains fonds disponibles régulariseront ces échéances pendant le jeu. Aucun nouveau prêt avant remboursement.</p> : null}
        <ol className={styles.schedule}>{data.loan.schedule.map((item, i) => <li key={item.at}><span><b>Échéance {i + 1}</b><small>{date(item.at)}</small></span><strong>{euros(item.amountCents)}<small>{item.paidCents === item.amountCents ? "Réglée" : item.paidCents > 0 ? `${euros(item.paidCents)} réglés` : Date.parse(item.at) <= Date.parse(data.serverNow) ? "À régulariser" : "À venir"}</small></strong></li>)}</ol>
        <button type="button" className={styles.primary} disabled={busy || data.cashCents < data.loan.remainingCents} onClick={() => { if (data.loan) review({ action: "repay", loanId: data.loan.id, amountCents: data.loan.remainingCents }); }}>Solder le prêt · {euros(data.loan.remainingCents)}</button>
        <small>Disponible : {euros(data.cashCents)}. Remboursement anticipé sans frais supplémentaires ; les intérêts convenus restent dus.</small>
      </div> : null}
      <details className={styles.rules}><summary>Les règles du bureau <ChevronDown size={16} aria-hidden="true" /></summary><p>Un seul prêt à la fois, dès 200 points de réputation et 24 heures après ta première culture terminée. Les sept prélèvements sont espacés de 24 heures réelles et rattrapés automatiquement pendant le jeu, dans la limite de ta trésorerie.</p><p>Les taux changent pour les nouvelles offres. Ton contrat signé reste fixe jusqu’au remboursement. Les retards n’ajoutent aucun intérêt. Tout se passe en monnaie de jeu.</p><ul>{KQ_BANK_TIERS.map(tier => <li key={tier.reputation}>{tier.reputation.toLocaleString("fr-FR")} points : jusqu’à {euros(tier.maxCents)}{tier.discountBps ? ` · réduction de ${(tier.discountBps / 100).toLocaleString("fr-FR")} point sur le taux` : ""}.</li>)}</ul></details>
      {data.history.length ? <details className={styles.rules}><summary>Prêts remboursés <ChevronDown size={16} aria-hidden="true" /></summary><ul>{data.history.map(loan => <li key={loan.id}>{euros(loan.principalCents)} empruntés · {euros(loan.totalCents)} remboursés · soldé le {date(loan.paidAt!)}.</li>)}</ul></details> : null}
    </> : null}
    <dialog className={styles.modal} ref={dialog} aria-labelledby="bank-contract-title" onCancel={event => { if (busy) event.preventDefault(); else setDraft(null); }}>
      <h3 id="bank-contract-title">{draft?.action === "borrow" ? "Ton contrat de prêt" : "Solder ton prêt"}</h3>
      {draft?.action === "borrow" ? <><p>Tu reçois <strong>{euros(draft.amountCents)}</strong> de monnaie de jeu. Le coût fixe est de <strong>{euros(getKqBankTerms(draft.amountCents, draft.expectedRateBps).interestCents)}</strong> ({percent(draft.expectedRateBps)} pour la durée totale).</p><p>Tu t’engages à rendre <strong>{euros(getKqBankTerms(draft.amountCents, draft.expectedRateBps).totalCents)}</strong> en sept prélèvements, toutes les 24 heures réelles à partir de demain.</p><ol className={styles.preview}>{getKqBankTerms(draft.amountCents, draft.expectedRateBps).installments.map((value, i) => <li key={i}>J + {i + 1} : <strong>{euros(value)}</strong></li>)}</ol><p>Les conditions sont figées à la signature. Le remboursement anticipé conserve ces intérêts, sans frais supplémentaires.</p></> : draft ? <p>Confirme le prélèvement de <strong>{euros(draft.amountCents)}</strong> sur ta trésorerie de jeu pour clôturer ce prêt, intérêts contractuels inclus.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => { dialog.current?.close(); setDraft(null); setError(""); setRefresh(value => value + 1); }}>Revenir au dossier</button><button type="button" className={styles.primary} disabled={busy || !draft} onClick={() => void confirm()}>{busy ? "Validation…" : draft?.action === "borrow" ? "Signer et recevoir le capital" : "Confirmer le remboursement"}</button></div>
    </dialog>
  </section>;
}
