"use client";

import { useKqTutorialApi } from "./KqTutorialApiContext";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, Landmark, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { getKqBankerDialogue, getKqBankTerms, isKqBankSnapshot, parseKqBankEuros, KQ_BANK_INSTALLMENT_COUNT, KQ_BANK_SCENARIOS, KQ_BANK_TIERS, type KqBankCommand, type KqBankSnapshot } from "@/lib/kanab-quest-bank";
import { getKqBankLoanSummary } from "@/lib/kanab-quest-bank-summary";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { KqBankCreditChart, KqBankRepaymentChart } from "./KqBankVisuals";
import { KqBankConfirmation, type KqBankDraft } from "./KqBankConfirmation";
import styles from "./KqBankLoans.module.css";

const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const percent = (bps: number) => (bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export function KqBankLoans() {
  const api = useKqTutorialApi();
  const [data, setData] = useState<KqBankSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState("1000");
  const [draft, setDraft] = useState<KqBankDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const noticeElement = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ fingerprint: string; command: KqBankCommand } | null>(null);
  const inFlight = useRef(false);
  const mutationVersion = useRef(0);

  useEffect(() => {
    if (!notice) return;
    const frame = requestAnimationFrame(() => {
      noticeElement.current?.focus({ preventScroll: true });
      noticeElement.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [notice]);

  useEffect(() => {
    const controller = new AbortController();
    const version = mutationVersion.current;
    async function load() {
      try {
        const response = await api.request("/api/arena/placard/bank", { cache: "no-store", signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !isKqBankSnapshot(value)) throw new Error("Le banquier ne peut pas ouvrir ton dossier pour le moment.");
        if (!controller.signal.aborted && version === mutationVersion.current && !inFlight.current) {
          setData(value); setError("");
          if (value.autoPaidCents > 0) {
            setNotice(`${euros(value.autoPaidCents)} prélevés pour les échéances de ton prêt.`);
            api.notify("kq:equipment-updated");
            api.notify("kq:treasury-updated");
          }
        }
      } catch (cause) { if (!controller.signal.aborted && version === mutationVersion.current) setError(cause instanceof Error ? cause.message : "Guichet indisponible."); }
    }
    void load();
    return () => controller.abort();
  }, [api, refresh]);
  useEffect(() => {
    const update = () => { if (!document.hidden && !inFlight.current) setRefresh(value => value + 1); };
    const timer = window.setInterval(update, 60_000);
    const unsubscribe_kq_equipment_updated = api.subscribe(["kq:equipment-updated"], update);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); unsubscribe_kq_equipment_updated(); document.removeEventListener("visibilitychange", update); };
  }, [api]);
  const amountCents = parseKqBankEuros(amount) ?? 0;
  const offer = data?.offer;
  const validAmount = !!offer && amountCents >= offer.minCents && amountCents <= offer.maxCents;
  const terms = validAmount && offer ? getKqBankTerms(amountCents, offer.rateBps) : null;
  const installmentMinCents = terms ? Math.min(...terms.installments) : 0;
  const installmentMaxCents = terms ? Math.max(...terms.installments) : 0;
  function review(value: KqBankDraft) {
    if (inFlight.current) return;
    setRetrying(retry.current?.fingerprint === JSON.stringify(value));
    setNotice("");
    setDraft(value); setError("");
  }
  function cancelReview() {
    if (inFlight.current) return;
    setDraft(null); setRetrying(false); setError(""); setRefresh(value => value + 1);
  }
  async function confirm() {
    if (!draft || inFlight.current) return;
    inFlight.current = true; mutationVersion.current++; setBusy(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify(draft);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, command: { ...draft, requestKey: createClientRequestKey() } };
    try {
      const response = await api.request("/api/arena/placard/bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(retry.current.command) });
      const value = await response.json();
      if (!response.ok) {
        if (response.status < 500) retry.current = null;
        throw new Error(value.error || "L’opération n’a pas pu être confirmée.");
      }
      if (!isKqBankSnapshot(value)) throw new Error("Réponse bancaire incomplète. Réessaie la même opération.");
      setData(value); retry.current = null; setRetrying(false);
      setNotice(draft.action === "borrow" ? "Contrat signé. Le capital est disponible dans ta trésorerie." : "Prêt soldé. Ton dossier est à jour.");
      setDraft(null);
      api.notify("kq:equipment-updated");
      api.notify("kq:treasury-updated");
    } catch (cause) {
      setRetrying(retry.current !== null);
      setError(cause instanceof Error ? cause.message : "Connexion interrompue. Réessaie la même opération.");
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  const scenario = data ? KQ_BANK_SCENARIOS[data.market.scenario] : null;
  const loan = data?.loan;
  const loanSummary = data && loan ? getKqBankLoanSummary(loan, data.serverNow, data.cashCents) : null;
  const next = loanSummary?.nextInstallment;
  const minimumReputation = KQ_BANK_TIERS[0].reputation;
  const maximumTier = KQ_BANK_TIERS[KQ_BANK_TIERS.length - 1];
  const blockedReason = data?.blockedReason === "reputation"
    ? "Il te manque " + Math.max(0, minimumReputation - data.reputation).toLocaleString("fr-FR") + " points pour atteindre les " + minimumReputation + " points requis."
    : data?.blockedReason === "experience"
      ? data.eligibleAt ? "Tu pourras emprunter à partir du " + date(data.eligibleAt) + "." : "Une première culture terminée depuis au moins 24 heures est nécessaire."
      : data?.blockedReason === "arrears" ? "Régularise ton prêt en cours avant d’en demander un autre."
        : "Un seul prêt peut être en cours. Actualise ton dossier pour consulter son état.";

  return <section className={styles.bank} aria-labelledby="bank-loans-title">
    <header className={styles.heading}><Landmark aria-hidden="true" size={25} /><h3 id="bank-loans-title">{loan ? "Mon prêt" : "Emprunter"}</h3><button type="button" className={styles.refresh} disabled={busy} aria-label="Actualiser le dossier bancaire" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></button></header>
    {!data && !error ? <p role="status">Le banquier examine ton dossier…</p> : null}
    {error && !draft ? <p className={styles.error} role="alert">{error}</p> : null}
    <p ref={noticeElement} className={styles.notice} role="status" tabIndex={-1} data-bank-notice>{notice ? <><BadgeCheck size={18} aria-hidden="true" />{notice}</> : null}</p>
    {data && scenario ? <>
      {loan && loanSummary ? <div className={styles.loan} data-bank-active-loan>
        <dl className={styles.keyNumbers}>
          <div><dt>Restant à rembourser</dt><dd>{euros(loan.remainingCents)}</dd></div>
          <div data-bank-cash><dt>Trésorerie disponible</dt><dd>{euros(data.cashCents)}</dd></div>
        </dl>
        {next ? <div className={styles.nextPayment} data-bank-next-installment data-state={next.status}>
          <span>{next.status === "overdue" ? "Échéance à régulariser" : "Prochaine échéance"} · {next.number}/{loanSummary.installmentCount}</span>
          <strong>{euros(next.remainingCents)}{next.paidCents > 0 ? <small>restant sur {euros(next.amountCents)}</small> : null}</strong>
          <time dateTime={next.at}>{date(next.at)}</time>
        </div> : <p className={styles.hint}>Toutes les échéances sont réglées.</p>}
        {loanSummary.overdueCents > 0 ? <p className={styles.error} role="status" data-bank-overdue><strong>{euros(loanSummary.overdueCents)} en retard au total.</strong> Les fonds disponibles régularisent ces échéances pendant le jeu. Aucun intérêt supplémentaire.</p>
          : next ? <p className={styles.hint}>Les échéances sont prélevées automatiquement pendant le jeu, à partir de leur date.</p> : null}
        <p className={styles.fixedTerms}>Taux signé : <strong>{percent(loan.rateBps)} fixe</strong> pour ce contrat. Les intérêts convenus restent dus même si tu soldes maintenant.</p>
        <button type="button" className={styles.primary} data-bank-repay disabled={busy || !loanSummary.canRepay}
          aria-describedby="bank-repay-funds" onClick={() => review({ action: "repay", loanId: loan.id, amountCents: loan.remainingCents })}>Solder le prêt · {euros(loan.remainingCents)}</button>
        <p className={styles.hint} id="bank-repay-funds">{loanSummary.missingCents > 0
          ? "Il manque " + euros(loanSummary.missingCents) + " pour solder tout le prêt. Les prélèvements prévus continuent."
          : loanSummary.canRepay ? "Après remboursement : " + euros(loanSummary.cashAfterRepaymentCents!) + " en trésorerie. Aucun frais supplémentaire."
            : "Prêt remboursé. Actualise le dossier pour consulter les nouvelles offres."}</p>
        <KqProgressMeter label="Remboursement" value={loan.paidCents} max={loan.totalCents} valueLabel={euros(loan.paidCents) + " réglés sur " + euros(loan.totalCents)} hint={loanSummary.paidInstallments + " échéance" + (loanSummary.paidInstallments > 1 ? "s" : "") + " réglée" + (loanSummary.paidInstallments > 1 ? "s" : "") + " sur " + loanSummary.installmentCount} />
        <details className={styles.details} data-bank-schedule-details>
          <summary>Échéancier et contrat <ChevronDown size={16} aria-hidden="true" /></summary>
          <KqBankRepaymentChart installments={loan.schedule} serverNow={data.serverNow} />
          <p>Capital reçu : {euros(loan.principalCents)} · intérêts fixes : {euros(loan.interestCents)}. Dernière échéance le {date(loan.dueAt)}.</p>
          <ol className={styles.schedule}>{loan.schedule.map((item, i) => <li key={item.at}><span><strong>Échéance {i + 1}</strong><time dateTime={item.at}>{date(item.at)}</time></span><span><strong>{euros(item.amountCents)}</strong><small>{euros(item.paidCents)} réglés · {euros(item.amountCents - item.paidCents)} restant</small></span></li>)}</ol>
        </details>
      </div> : offer ? <div className={styles.offer} data-bank-offer>
        <dl className={styles.keyNumbers}>
          <div><dt>Plafond autorisé</dt><dd id="bank-personal-limit">{euros(offer.maxCents)}</dd></div>
          <div data-bank-cash><dt>Trésorerie disponible</dt><dd>{euros(data.cashCents)}</dd></div>
        </dl>
        <label className={styles.amountLabel} htmlFor="bank-loan-amount">Montant à emprunter · euros de jeu</label>
        <div className={styles.amount}><input id="bank-loan-amount" inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} aria-describedby="bank-amount-bounds" aria-invalid={!validAmount} /><span>€</span></div>
        <p className={styles.bounds} id="bank-amount-bounds">De {euros(offer.minCents)} à {euros(offer.maxCents)}.</p>
        {terms ? <>
          <dl className={styles.costs}>
            <div><dt>Intérêts fixes · {percent(offer.rateBps)}</dt><dd>{euros(terms.interestCents)}</dd></div>
            <div><dt>Total à rembourser</dt><dd>{euros(terms.totalCents)}</dd></div>
          </dl>
          <p className={styles.installments} id="bank-installment-repayment"><strong>{KQ_BANK_INSTALLMENT_COUNT} prélèvements de {installmentMinCents === installmentMaxCents ? euros(installmentMinCents) : euros(installmentMinCents) + " à " + euros(installmentMaxCents)}</strong><span>Tous les 5 jours réels, pendant 35 jours. Premier prélèvement 5 jours après la signature.</span></p>
        </> : <p className={styles.error} role="status">Saisis un montant entre {euros(offer.minCents)} et {euros(offer.maxCents)}, avec au maximum deux décimales.</p>}
        <button type="button" className={styles.primary} data-bank-review disabled={!terms || busy} onClick={() => { if (terms) review({ action: "borrow", quoteId: offer.quoteId, amountCents, expectedRateBps: offer.rateBps }); }}>Examiner le contrat</button>
        <p className={styles.hint}>Aucun prêt avant ta confirmation. Les intérêts restent dus en cas de remboursement anticipé.</p>
        <details className={styles.details}>
          <summary>Choisir un montant rapidement <ChevronDown size={16} aria-hidden="true" /></summary>
          <input className={styles.amountRange} type="range" aria-label="Ajuster le montant du prêt" min={offer.minCents} max={offer.maxCents} step={100} value={Math.max(offer.minCents, Math.min(amountCents, offer.maxCents))} aria-valuetext={euros(Math.max(offer.minCents, Math.min(amountCents, offer.maxCents)))} disabled={busy} onChange={event => setAmount((Number(event.target.value) / 100).toFixed(2))} />
          <div className={styles.amountPresets} role="group" aria-label="Choisir un montant de prêt">{([{ label: "25 %", share: .25 }, { label: "50 %", share: .5 }, { label: "Maximum", share: 1 }] as const).map(preset => {
            const cents = Math.min(offer.maxCents, Math.max(offer.minCents, Math.round(offer.maxCents * preset.share)));
            return <button type="button" key={preset.label} disabled={busy} aria-pressed={amountCents === cents} aria-label={preset.label + " du plafond : " + euros(cents)} onClick={() => setAmount((cents / 100).toFixed(2))}>{preset.label}</button>;
          })}</div>
        </details>
        {terms ? <details className={styles.details} data-bank-schedule-details><summary>Répartition et échéancier <ChevronDown size={16} aria-hidden="true" /></summary>
          <KqAllocationBar label="Ce que tu rembourseras" items={[{ label: "Capital reçu", value: amountCents, displayValue: euros(amountCents), tone: "teal" }, { label: "Intérêts fixes", value: terms.interestCents, displayValue: euros(terms.interestCents), tone: "gold" }]} />
          <KqBankRepaymentChart installments={terms.installments.map(cents => ({ amountCents: cents }))} />
          <p>Les repères « J + » du graphique sont en jours de jeu : 30 jours de jeu correspondent à 5 jours réels.</p>
        </details> : null}
      </div> : <div className={styles.eligibility} data-bank-blocked-reason>
        <h4>{data.blockedReason === "reputation" ? "Réputation à développer" : data.blockedReason === "experience" ? "Encore un peu d’expérience" : "Dossier à actualiser"}</h4>
        <p>{blockedReason}</p>
        {data.blockedReason === "reputation" ? <KqProgressMeter label="Réputation pour un premier prêt" value={data.reputation} max={minimumReputation} valueLabel={data.reputation.toLocaleString("fr-FR") + " / " + minimumReputation + " points"} /> : null}
        <p className={styles.hint}>Il faut aussi une réputation d’au moins {minimumReputation} points et une première culture terminée depuis 24 heures.</p>
      </div>}

      <details className={styles.details} data-bank-market>
        <summary>Marché et capacité d’emprunt <ChevronDown size={16} aria-hidden="true" /></summary>
        <div className={styles.market}><span>{data.market.changeBps < 0 ? <TrendingDown size={20} aria-hidden="true" /> : <TrendingUp size={20} aria-hidden="true" />}<strong>{scenario.title}</strong><b>{data.market.changeBps > 0 ? "+" : ""}{(data.market.changeBps / 100).toLocaleString("fr-FR")} pt</b></span>
          <p>{scenario.description}</p><p>Taux du marché pour les nouvelles offres : <strong>{percent(data.market.rateBps)}</strong>. Prochain taux le {date(data.market.expiresAt)}.</p>
          {loan ? <p>Ton prêt reste au taux signé de <strong>{percent(loan.rateBps)}</strong>.</p> : offer ? <p>Ton offre personnelle : <strong>{percent(offer.rateBps)}</strong> pour les 35 jours réels du prêt. Valable jusqu’au {date(offer.expiresAt)}.</p> : null}
        </div>
        {offer ? <div data-bank-credit-details><KqBankCreditChart reputation={data.reputation} maxCents={offer.maxCents} /></div> : <p>Ta réputation : {data.reputation.toLocaleString("fr-FR")} points.</p>}
        <p className={styles.banker}>{getKqBankerDialogue(data)}</p>
      </details>
      <details className={styles.details}><summary>Règles des prêts <ChevronDown size={16} aria-hidden="true" /></summary>
        <p>Un seul prêt à la fois, dès 200 points de réputation et 24 heures après ta première culture terminée. Les sept prélèvements sont espacés de 5 jours réels (30 jours de jeu), soit 35 jours réels (210 jours de jeu) au total. Les échéances dues sont rattrapées automatiquement pendant le jeu, dans la limite de ta trésorerie.</p>
        <p>Les intérêts sont un coût fixe pour toute la durée du prêt, pas un taux annuel. Ils restent dus en cas de remboursement anticipé, sans frais supplémentaires. Les retards n’ajoutent aucun intérêt. Tout se passe en monnaie de jeu.</p>
        <p>Le plafond progresse à chaque point de réputation entre les repères ci-dessous, avec un arrondi à l’euro inférieur. Il atteint son maximum à {maximumTier.reputation.toLocaleString("fr-FR")} points. Les réductions du taux changent aux paliers indiqués ; le taux du marché évolue chaque jour pour les nouvelles offres.</p>
        <ul>{KQ_BANK_TIERS.map(tier => <li key={tier.reputation}>{tier.reputation.toLocaleString("fr-FR")} points : plafond de {euros(tier.maxCents)}{tier.discountBps ? " · réduction de " + (tier.discountBps / 100).toLocaleString("fr-FR") + " point sur le taux dès ce palier" : ""}.</li>)}</ul>
      </details>
      {data.history.length ? <details className={styles.details}><summary>Prêts remboursés <ChevronDown size={16} aria-hidden="true" /></summary><ul>{data.history.map(item => <li key={item.id}>{euros(item.principalCents)} empruntés · {euros(item.totalCents)} remboursés · {item.paidAt ? "soldé le " + date(item.paidAt) : "date de clôture indisponible"}.</li>)}</ul></details> : null}
    </> : null}
    <KqBankConfirmation draft={draft} cashCents={data?.cashCents ?? null} busy={busy} retrying={retrying} error={error} onCancel={cancelReview} onConfirm={() => void confirm()} />
  </section>;
}
