"use client";

import { ChevronDown, Plus, RefreshCcw, Save, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  ProducerPayment,
  ProducerProductSales,
  ProducerRate,
  ProducerSalesPeriod,
  ProducerSettlementsDashboard,
} from "@/types/producer-settlements";

const endpoint = "/api/admin/producer-settlements";
const inputClass = "min-h-11 w-full min-w-0 rounded border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm text-ink disabled:opacity-60";
const smallButtonClass = "min-h-11 rounded border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-[#f4f1ea] disabled:cursor-wait disabled:opacity-50";
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 });
const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

type PaymentInput = Pick<ProducerPayment, "id" | "producerId" | "producerName" | "salesMonth" | "amountCents" | "paidOn" | "reference" | "note"> & { salesFromMonth: string };
type Mutation = ({ action: "rate" } & ProducerRate) | ({ action: "payment" } & PaymentInput) | { action: "void"; id: string; reason: string };
type PaymentDraft = { id: string; producerId: string; salesFromMonth: string; salesMonth: string; amount: string; paidOn: string; reference: string; note: string };
type RateSelection = { period: ProducerSalesPeriod; product: ProducerProductSales };
type ProducerTotal = { producerId: string; producerName: string; fromMonth: string; toMonth: string; dueCents: number; paidCents: number; balanceCents: number; revenueHtCents: number; missingRateCount: number; grams: number; unknownGrams: boolean; months: number };

function euros(cents: number): string {
  return money.format(cents / 100);
}

function parisToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function monthLabel(value: string): string {
  return monthFormatter.format(new Date(`${value}-15T12:00:00Z`));
}

function dateLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function rateLabel(rate: ProducerRate | null): string {
  if (!rate) return "Tarif à renseigner";
  if (rate.mode === "percent_ht") return `${number.format(rate.rate)} % du CA HT`;
  if (rate.mode === "gram") return `${number.format(rate.rate)} €/g × ${number.format(rate.gramsPerUnit ?? 0)} g/unité`;
  return `${number.format(rate.rate)} €/unité`;
}

function balanceLabel(value: number, incomplete: boolean): string {
  if (incomplete) return "Solde provisoire";
  if (value < 0) return "Avance";
  if (value === 0) return "Soldé";
  return "Reste à payer";
}

function RateForm({ selection, rates, busy, onClose, onSave }: {
  selection: RateSelection;
  rates: ProducerRate[];
  busy: boolean;
  onClose: () => void;
  onSave: (rate: ProducerRate) => Promise<boolean>;
}) {
  const { period, product } = selection;
  const [effectiveMonth, setEffectiveMonth] = useState(period.month);
  const [mode, setMode] = useState<ProducerRate["mode"]>(product.rate?.mode ?? "percent_ht");
  const [rate, setRate] = useState(product.rate ? String(product.rate.rate) : "80");
  const [grams, setGrams] = useState(product.rate?.gramsPerUnit != null ? String(product.rate.gramsPerUnit) : "");
  const titleId = useId();
  const history = rates.filter((item) => item.producerId === period.producerId && item.productId === product.productId).sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));

  return (
    <form
      aria-labelledby={titleId}
      className="rounded border-2 border-[#1a1a1a] bg-[#fff8db] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ producerId: period.producerId, productId: product.productId, effectiveMonth, mode, rate: Number(rate), gramsPerUnit: mode === "gram" ? Number(grams) : null });
      }}
    >
      <fieldset disabled={busy} className="min-w-0">
        <legend id={titleId} className="mb-2 font-semibold text-ink">Tarif particulier · {product.productName}</legend>
        <p className="mb-4 break-all text-xs text-charcoal">{period.producerName} · {product.productId}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold">
            Applicable dès le mois
            <input type="month" required min="2000-01" max="2099-12" className={inputClass} value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Mode de rémunération
            <select className={inputClass} value={mode} onChange={(event) => setMode(event.target.value as ProducerRate["mode"])}>
              <option value="unit">€ par unité vendue</option>
              <option value="gram">€ par gramme vendu</option>
              <option value="percent_ht">% du chiffre d’affaires HT</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {mode === "percent_ht" ? "Part du CA HT (%)" : mode === "gram" ? "Tarif par gramme (€)" : "Tarif par unité (€)"}
            <input type="number" inputMode="decimal" required min="0" max={mode === "percent_ht" ? 100 : 1000000} step="0.0001" className={inputClass} value={rate} onChange={(event) => setRate(event.target.value)} />
          </label>
          {mode === "gram" && (
            <label className="grid gap-1 text-sm font-semibold">
              Grammes par unité vendue
              <input type="number" inputMode="decimal" required min="0.001" max="100000" step="0.001" className={inputClass} value={grams} onChange={(event) => setGrams(event.target.value)} />
            </label>
          )}
        </div>
        <p className="mt-3 text-sm text-charcoal">
          Par défaut, le producteur reçoit 80 % des ventes HT. Ce tarif particulier remplace cette règle pour cette référence exacte, à partir du mois choisi et jusqu’au prochain changement. Une correction recalcule le dû des mois concernés, y compris ceux déjà réglés.
        </p>
        {history.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">Tarifs déjà enregistrés ({history.length})</summary>
            <ul className="mt-2 grid gap-1 pl-4">
              {history.map((item) => <li key={item.effectiveMonth}>Dès {monthLabel(item.effectiveMonth)} : {rateLabel(item)}</li>)}
            </ul>
          </details>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn-cartoon btn-primary"><Save size={15} aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer le tarif"}</button>
          <button type="button" className={smallButtonClass} onClick={onClose}>Fermer</button>
        </div>
      </fieldset>
    </form>
  );
}

function PaymentForm({ draft, producers, busy, onChange, onClose, onSave }: {
  draft: PaymentDraft;
  producers: ProducerSettlementsDashboard["producers"];
  busy: boolean;
  onChange: (value: PaymentDraft) => void;
  onClose: () => void;
  onSave: (payment: PaymentInput) => Promise<boolean>;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const update = (key: keyof PaymentDraft, value: string) => onChange({ ...draft, [key]: value });

  return (
    <form
      aria-labelledby={titleId}
      className="card-cartoon bg-[#eaf2e0] p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const producer = producers.find((item) => item.id === draft.producerId);
        if (!producer) return;
        void onSave({ id: draft.id, producerId: producer.id, producerName: producer.name, salesFromMonth: draft.salesFromMonth, salesMonth: draft.salesMonth, amountCents: Math.round(Number(draft.amount) * 100), paidOn: draft.paidOn, reference: draft.reference.trim(), note: draft.note.trim() });
      }}
    >
      <fieldset disabled={busy} className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} tabIndex={-1} ref={heading} className="font-display text-2xl text-ink">Enregistrer un règlement effectué</h3>
            <p className="mt-1 text-sm text-charcoal">Saisissez un paiement déjà effectué, total ou partiel. Aucun virement n’est déclenché ici.</p>
          </div>
          <button type="button" aria-label="Fermer le formulaire de règlement" className={smallButtonClass} onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            Producteur payé
            <select required className={inputClass} value={draft.producerId} onChange={(event) => update("producerId", event.target.value)}>
              <option value="">Choisir un producteur</option>
              {producers.map((producer) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Premier mois des ventes
            <input type="month" required min="2000-01" max={draft.salesMonth || "2099-12"} className={inputClass} value={draft.salesFromMonth} onChange={(event) => update("salesFromMonth", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Dernier mois des ventes
            <input type="month" required min={draft.salesFromMonth || "2000-01"} max="2099-12" className={inputClass} value={draft.salesMonth} onChange={(event) => update("salesMonth", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Montant payé (€)
            <input type="number" inputMode="decimal" required min="0.01" max="1000000" step="0.01" className={inputClass} value={draft.amount} onChange={(event) => update("amount", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Date réelle du paiement
            <input type="date" required min="2000-01-01" max={parisToday()} className={inputClass} value={draft.paidOn} onChange={(event) => update("paidOn", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Référence du paiement (facultatif)
            <input type="text" maxLength={160} className={inputClass} placeholder="Ex. virement du 5 octobre" value={draft.reference} onChange={(event) => update("reference", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2 xl:col-span-3">
            Note (facultatif)
            <input type="text" maxLength={1000} className={inputClass} placeholder="Ex. acompte sur les ventes de septembre" value={draft.note} onChange={(event) => update("note", event.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-sm text-charcoal">Un seul règlement peut couvrir plusieurs mois cumulés. Le montant est imputé aux soldes des mois sélectionnés, du plus ancien au plus récent ; un excédent reste visible en avance.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn-cartoon btn-primary"><Save size={15} aria-hidden="true" /> {busy ? "Enregistrement…" : "Valider le paiement effectué"}</button>
          <button type="button" className={smallButtonClass} onClick={onClose}>Fermer</button>
        </div>
      </fieldset>
    </form>
  );
}

function PaymentHistoryEntry({ payment, busy, onVoid }: { payment: ProducerPayment; busy: boolean; onVoid: (id: string, reason: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <li className="rounded border-2 border-[#1a1a1a] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{payment.producerName} · {euros(payment.amountCents)}</p>
          <p className="mt-1 text-sm text-charcoal">Payé le {dateLabel(payment.paidOn)} · Ventes {payment.salesFromMonth && payment.salesFromMonth !== payment.salesMonth ? `de ${monthLabel(payment.salesFromMonth)} à ${monthLabel(payment.salesMonth)}` : `de ${monthLabel(payment.salesMonth)}`}</p>
          {payment.reference && <p className="mt-1 break-words text-sm">Référence : {payment.reference}</p>}
          {payment.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-charcoal">{payment.note}</p>}
          <p className="mt-2 text-xs text-charcoal">Enregistré le {dateLabel(payment.createdAt)}</p>
        </div>
        {payment.voidedAt ? <span className="pill-cartoon bg-[#f4f1ea] px-3 py-1 text-xs font-semibold">Annulé · exclu des totaux</span> : <button type="button" disabled={busy} className={smallButtonClass} onClick={() => setEditing(!editing)}>{editing ? "Fermer" : "Annuler cette saisie"}</button>}
      </div>
      {payment.voidedAt && <p className="mt-3 text-sm text-charcoal">Annulé le {dateLabel(payment.voidedAt)} : {payment.voidReason}</p>}
      {editing && !payment.voidedAt && (
        <form className="mt-4 rounded border border-[#1a1a1a] bg-[#fff8db] p-3" onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) void onVoid(payment.id, reason.trim()).then((success) => { if (success) setEditing(false); });
        }}>
          <fieldset disabled={busy} className="min-w-0">
            <label className="grid gap-1 text-sm font-semibold">
              Motif de l’annulation
              <input className={inputClass} required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. doublon de saisie" />
            </label>
            <p className="mt-2 text-sm text-charcoal">Cette saisie restera dans l’historique et ne sera plus comptée comme payée. Cela n’annule pas le virement bancaire.</p>
            <button type="submit" disabled={!reason.trim()} className={`${smallButtonClass} mt-3`}>{busy ? "Annulation…" : "Confirmer l’annulation de la saisie"}</button>
          </fieldset>
        </form>
      )}
    </li>
  );
}

export function AdminProducerSettlementsPanel() {
  const [dashboard, setDashboard] = useState<ProducerSettlementsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [producerId, setProducerId] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rateSelection, setRateSelection] = useState<RateSelection | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const mutationRunning = useRef(false);
  const alive = useRef(true);

  const loadDashboard = useCallback(async () => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as { dashboard?: ProducerSettlementsDashboard; error?: string };
      if (!response.ok || !payload.dashboard) throw new Error(payload.error || "Impossible de charger les ventes et règlements des producteurs.");
      if (sequence === request.current.sequence && alive.current) setDashboard(payload.dashboard);
    } catch (cause) {
      if (!controller.signal.aborted && sequence === request.current.sequence && alive.current) {
        setError(cause instanceof Error ? cause.message : "Impossible de charger les règlements. Réessayez.");
        setDashboard(null);
      }
    } finally {
      if (sequence === request.current.sequence && alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const activeRequest = request.current;
    void loadDashboard();
    return () => { alive.current = false; activeRequest.controller?.abort(); };
  }, [loadDashboard]);

  const mutate = async (body: Mutation, successMessage: string): Promise<boolean> => {
    if (mutationRunning.current) return false;
    mutationRunning.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {
        throw new Error("La connexion a été interrompue. Réessayez avec ce formulaire pour conserver la même référence de saisie.");
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "L’enregistrement a échoué. Vous pouvez réessayer.");
      if (!alive.current) return true;
      setNotice(successMessage);
      if (body.action === "payment") setPaymentDraft(null);
      if (body.action === "rate") setRateSelection(null);
      await loadDashboard();
      return true;
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "La connexion a été interrompue. Réessayez avec ce formulaire pour conserver la même référence de saisie.");
      return false;
    } finally {
      mutationRunning.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const invalidRange = !!fromMonth && !!toMonth && fromMonth > toMonth;
  const matchesFilters = useCallback((id: string, month: string) => !invalidRange && (!producerId || producerId === id) && (!fromMonth || month >= fromMonth) && (!toMonth || month <= toMonth), [fromMonth, toMonth, producerId, invalidRange]);
  const periods = useMemo(() => (dashboard?.periods ?? []).filter((period) => matchesFilters(period.producerId, period.month)).sort((a, b) => b.month.localeCompare(a.month) || a.producerName.localeCompare(b.producerName, "fr")), [dashboard, matchesFilters]);
  const payments = useMemo(() => (dashboard?.payments ?? []).filter((payment) => !invalidRange && (!producerId || payment.producerId === producerId) && (!fromMonth || payment.salesMonth >= fromMonth) && (!toMonth || (payment.salesFromMonth ?? payment.salesMonth) <= toMonth)).sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt)), [dashboard, fromMonth, toMonth, producerId, invalidRange]);
  const totals = useMemo(() => periods.reduce((acc, period) => ({ revenue: acc.revenue + period.revenueTtcCents, revenueHt: acc.revenueHt + period.revenueHtCents, due: acc.due + period.dueCents, paid: acc.paid + period.paidCents, balance: acc.balance + period.balanceCents, missing: acc.missing + period.missingRateCount, advance: acc.advance + Math.max(0, -period.balanceCents) }), { revenue: 0, revenueHt: 0, due: 0, paid: 0, balance: 0, missing: 0, advance: 0 }), [periods]);
  const producerTotals = useMemo(() => {
    const grouped = new Map<string, ProducerTotal>();
    for (const period of periods) {
      const aggregate = grouped.get(period.producerId) ?? { producerId: period.producerId, producerName: period.producerName, fromMonth: period.month, toMonth: period.month, dueCents: 0, paidCents: 0, balanceCents: 0, revenueHtCents: 0, missingRateCount: 0, grams: 0, unknownGrams: false, months: 0 };
      aggregate.fromMonth = aggregate.fromMonth < period.month ? aggregate.fromMonth : period.month;
      aggregate.toMonth = aggregate.toMonth > period.month ? aggregate.toMonth : period.month;
      aggregate.dueCents += period.dueCents;
      aggregate.paidCents += period.paidCents;
      aggregate.balanceCents += period.balanceCents;
      aggregate.revenueHtCents += period.revenueHtCents;
      aggregate.missingRateCount += period.missingRateCount;
      aggregate.months++;
      for (const product of period.products) {
        if (product.gramsSold == null) aggregate.unknownGrams = true;
        else aggregate.grams += product.gramsSold;
      }
      grouped.set(period.producerId, aggregate);
    }
    return [...grouped.values()].sort((a, b) => a.producerName.localeCompare(b.producerName, "fr"));
  }, [periods]);
  const remainingCents = producerTotals.reduce((sum, producer) => sum + Math.max(0, producer.balanceCents), 0);
  const advanceCents = producerTotals.reduce((sum, producer) => sum + Math.max(0, -producer.balanceCents), 0);
  const disabled = busy || loading;

  const openPayment = (period?: ProducerSalesPeriod, cumulative?: ProducerTotal) => {
    const targetId = period?.producerId ?? cumulative?.producerId ?? producerId;
    const summary = cumulative ?? producerTotals.find((item) => item.producerId === targetId);
    const targetTo = period?.month ?? (toMonth || summary?.toMonth || parisToday().slice(0, 7));
    const targetFrom = period?.month ?? (fromMonth || summary?.fromMonth || targetTo);
    const balance = period?.balanceCents ?? summary?.balanceCents ?? 0;
    const missing = period?.missingRateCount ?? summary?.missingRateCount ?? 0;
    setPaymentDraft({ id: crypto.randomUUID(), producerId: targetId, salesFromMonth: targetFrom, salesMonth: targetTo, amount: !missing && balance > 0 ? (balance / 100).toFixed(2) : "", paidOn: parisToday(), reference: "", note: "" });
    setError(null);
    setNotice(null);
  };

  const changePaymentDraft = (draft: PaymentDraft) => {
    if (draft.producerId !== paymentDraft?.producerId) {
      const summary = producerTotals.find((item) => item.producerId === draft.producerId);
      if (summary) {
        setPaymentDraft({ ...draft, salesFromMonth: fromMonth || summary.fromMonth, salesMonth: toMonth || summary.toMonth, amount: !summary.missingRateCount && summary.balanceCents > 0 ? (summary.balanceCents / 100).toFixed(2) : "" });
        return;
      }
    }
    setPaymentDraft(draft);
  };

  return (
    <section className="cartoon-border min-w-0 bg-cream p-4 sm:p-6 md:p-8" aria-busy={loading || busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-ink">Ventes & règlements producteurs</h2>
          <p className="mt-2 max-w-3xl text-sm text-charcoal">Cumulez les ventes sur plusieurs mois, suivez vos volumes par palier de 100 g et enregistrez les règlements quand vous les effectuez.</p>
        </div>
        <button type="button" disabled={disabled} className="btn-cartoon btn-secondary" onClick={() => void loadDashboard()}><RefreshCcw size={14} aria-hidden="true" /> Recharger</button>
      </div>
      {notice && <p role="status" className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#eaf2e0] p-3 text-sm">{notice}</p>}
      {error && <div role="alert" className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fff0e5] p-3 text-sm"><p>{error}</p>{!dashboard && <button type="button" disabled={disabled} className={`${smallButtonClass} mt-2`} onClick={() => void loadDashboard()}>Réessayer le chargement</button>}</div>}
      {loading && !dashboard && <p role="status" className="mt-5 card-cartoon bg-white p-4 text-charcoal">Chargement des ventes et règlements…</p>}
      {dashboard && <div className="mt-5 grid min-w-0 gap-5">
        <div className="rounded border-2 border-[#1a1a1a] bg-[#eaf2e0] p-4 text-sm">
          <p className="font-semibold">Part producteur : 80 % des ventes HT · Marge boutique : 20 %</p>
          <p className="mt-1 text-charcoal">Pour 100 € de ventes HT, 80 € reviennent au producteur et 20 € à la boutique. Cette règle s’applique automatiquement, sauf tarif particulier enregistré dans le détail d’un produit.</p>
        </div>
        <div className="card-cartoon bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-ink">Mois de ventes à cumuler</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={smallButtonClass} onClick={() => { setFromMonth(""); setToMonth(""); }}>Depuis le début</button>
              <button type="button" className={smallButtonClass} onClick={() => { const month = parisToday().slice(0, 7); setFromMonth(month); setToMonth(month); }}>Ce mois-ci</button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">Producteur
              <select className={inputClass} value={producerId} onChange={(event) => setProducerId(event.target.value)}>
                <option value="">Tous les producteurs</option>
                {dashboard.producers.map((producer) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Du mois (inclus)
              <input type="month" min="2000-01" max="2099-12" className={inputClass} value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">Au mois (inclus)
              <input type="month" min="2000-01" max="2099-12" className={inputClass} value={toMonth} onChange={(event) => setToMonth(event.target.value)} />
            </label>
          </div>
          <p className="mt-3 text-xs text-charcoal">Un mois laissé vide ne limite pas la période. Les règlements sont filtrés par mois de ventes, quelle que soit la date du paiement.</p>
          {invalidRange && <p role="alert" className="mt-2 font-semibold text-sm">Le mois de fin doit être égal ou postérieur au mois de début.</p>}
        </div>

        {dashboard.unattributed.quantity > 0 && <p className="rounded border-2 border-[#1a1a1a] bg-[#fff8db] p-4 text-sm"><strong>Ventes à attribuer :</strong> {number.format(dashboard.unattributed.quantity)} unité(s), soit {euros(dashboard.unattributed.revenueTtcCents)} TTC, sans producteur identifié. Ces ventes sont exclues du calcul des règlements. Ce signalement couvre toutes les périodes.</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="card-cartoon bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-charcoal">Ventes HT</p><p className="mt-2 text-2xl font-bold text-ink">{euros(totals.revenueHt)}</p><p className="mt-1 text-xs text-charcoal">{euros(totals.revenue)} TTC · Sélection en cours</p></article>
          <article className="card-cartoon bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-charcoal">Montant dû {totals.missing > 0 ? "connu" : "aux producteurs"}</p><p className="mt-2 text-2xl font-bold text-ink">{euros(totals.due)}</p><p className="mt-1 text-xs text-charcoal">{totals.missing > 0 ? `Calcul incomplet · ${totals.missing} tarif(s) manquant(s)` : "Selon les tarifs convenus"}</p></article>
          <article className="card-cartoon bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-charcoal">Déjà payé</p><p className="mt-2 text-2xl font-bold text-ink">{euros(totals.paid)}</p><p className="mt-1 text-xs text-charcoal">Règlements validés, hors annulations</p></article>
          <article className="card-cartoon bg-[#fff8db] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-charcoal">{totals.missing > 0 ? "Reste connu · provisoire" : "Reste à payer"}</p><p className="mt-2 text-2xl font-bold text-ink">{euros(remainingCents)}</p><p className="mt-1 text-xs text-charcoal">{totals.missing > 0 ? "À compléter avant de solder les comptes" : "Total des soldes dus à chaque producteur"}</p>{advanceCents > 0 && <p className="mt-2 text-xs font-semibold">Avances : {euros(advanceCents)}, séparées du reste à payer</p>}</article>
        </div>

        {totals.missing > 0 && <p className="rounded border-2 border-[#1a1a1a] bg-[#fff8db] p-3 text-sm"><strong>Des tarifs restent à définir.</strong> Ouvrez le détail des ventes pour renseigner votre rémunération par unité, par gramme ou en pourcentage du CA HT. Le dû et le solde restent provisoires tant que tous les tarifs ne sont pas renseignés.</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-ink">Cumul par producteur</h3>
          <button type="button" disabled={disabled || dashboard.producers.length === 0 || paymentDraft !== null} className="btn-cartoon btn-primary" onClick={() => openPayment()}><Plus size={16} aria-hidden="true" /> Enregistrer un règlement</button>
        </div>
        {paymentDraft && <PaymentForm draft={paymentDraft} producers={dashboard.producers} busy={disabled} onChange={changePaymentDraft} onClose={() => setPaymentDraft(null)} onSave={(payment) => mutate({ action: "payment", ...payment }, "Le règlement a été enregistré et réparti sur les mois de ventes concernés.")} />}

        {producerTotals.length > 0 && <div className="grid gap-3">{producerTotals.map((producer) => <article key={producer.producerId} className="card-cartoon min-w-0 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h4 className="text-xl font-bold text-ink">{producer.producerName}</h4><p className="mt-1 text-sm text-charcoal">{monthLabel(producer.fromMonth)}{producer.fromMonth !== producer.toMonth && ` → ${monthLabel(producer.toMonth)}`} · {producer.months} mois cumulé(s)</p></div>
            <button type="button" disabled={disabled || paymentDraft !== null} className="btn-cartoon btn-primary" onClick={() => openPayment(undefined, producer)}>Règlement de cette période</button>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div><dt className="text-xs text-charcoal">Grammes vendus cumulés</dt><dd className="mt-1"><p className="text-xl font-bold">{number.format(producer.grams)} g{producer.unknownGrams ? " connus" : ""}</p><p className="mt-1 text-xs text-charcoal">{producer.unknownGrams ? "Poids de certaines ventes indisponible" : `${Math.floor(producer.grams / 100)} palier(s) de 100 g atteint(s)`}</p></dd></div>
            <div><dt className="text-xs text-charcoal">Ventes HT</dt><dd className="mt-1 text-xl font-bold">{euros(producer.revenueHtCents)}</dd></div>
            <div><dt className="text-xs text-charcoal">{producer.missingRateCount ? "Dû connu · incomplet" : "Dû au producteur"}</dt><dd className="mt-1 text-xl font-bold">{euros(producer.dueCents)}</dd></div>
            <div><dt className="text-xs text-charcoal">Déjà payé</dt><dd className="mt-1 text-xl font-bold">{euros(producer.paidCents)}</dd></div>
            <div><dt className="text-xs font-semibold text-charcoal">{balanceLabel(producer.balanceCents, producer.missingRateCount > 0)}</dt><dd className="mt-1 text-xl font-bold">{euros(producer.missingRateCount ? producer.balanceCents : Math.abs(producer.balanceCents))}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-charcoal">Le volume est celui des ventes de la période, paiements déjà effectués compris. Le reste à payer tient compte de tous les règlements enregistrés.</p>
        </article>)}</div>}

        <details className="min-w-0" open={periods.length === 0}>
          <summary className="cursor-pointer font-display text-2xl text-ink">Détail par mois et par produit</summary>
          <div className="mt-4">

        {periods.length === 0 ? <p className="card-cartoon bg-white p-4 text-sm text-charcoal">{invalidRange ? "Corrigez la période pour afficher les ventes et les règlements." : "Aucune vente ni aucun règlement pour cette sélection. Vous pouvez enregistrer un paiement antérieur avec son mois de ventes."}</p> : (
          <div className="grid gap-3">
            {periods.map((period) => {
              const key = `${period.producerId}:${period.month}`;
              const open = expanded === key;
              const incomplete = period.missingRateCount > 0;
              return <article key={key} className="card-cartoon min-w-0 bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:items-center">
                  <div><h4 className="break-words text-lg font-bold text-ink">{period.producerName}</h4><p className="text-sm capitalize text-charcoal">{monthLabel(period.month)}</p><p className="mt-1 text-xs text-charcoal">{number.format(period.quantity)} unité(s) · {period.ordersCount} commande(s)</p></div>
                  <div><p className="text-xs text-charcoal">CA TTC · HT</p><p className="font-semibold">{euros(period.revenueTtcCents)}</p><p className="text-xs text-charcoal">{euros(period.revenueHtCents)} HT</p></div>
                  <div><p className="text-xs text-charcoal">{incomplete ? "Dû connu (incomplet)" : "Dû au producteur"}</p><p className="font-semibold">{euros(period.dueCents)}</p>{incomplete && <p className="mt-1 text-xs font-semibold">{period.missingRateCount} tarif(s) manquant(s)</p>}</div>
                  <div><p className="text-xs text-charcoal">Déjà payé</p><p className="font-semibold">{euros(period.paidCents)}</p></div>
                  <div><p className="text-xs font-semibold text-charcoal">{balanceLabel(period.balanceCents, incomplete)}</p><p className="text-xl font-bold">{euros(incomplete ? period.balanceCents : Math.abs(period.balanceCents))}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" aria-expanded={open} aria-controls={`producer-details-${key}`} className={smallButtonClass} onClick={() => setExpanded(open ? null : key)}><span className="flex items-center gap-2"><ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />{open ? "Masquer le détail" : "Détail des ventes et tarifs"}</span></button>
                  <button type="button" disabled={disabled || paymentDraft !== null} className={smallButtonClass} onClick={() => openPayment(period)}>Saisir un paiement pour ce mois</button>
                </div>
                {open && <div id={`producer-details-${key}`} className="mt-4 border-t-2 border-[#1a1a1a] pt-4">
                  {period.products.length === 0 ? <p className="text-sm text-charcoal">Aucune vente comptabilisée pour ce mois. Le solde correspond aux règlements enregistrés.</p> : <>
                    <p className="mb-2 text-xs text-charcoal lg:hidden">Faites défiler le tableau horizontalement pour voir les tarifs et les montants.</p>
                    <div className="overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-offset-4" role="region" aria-label={`Produits vendus par ${period.producerName} en ${monthLabel(period.month)}`} tabIndex={0}>
                      <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                        <caption className="sr-only">Ventes et rémunération par référence exacte</caption>
                        <thead><tr className="bg-[#f4f1ea]">{["Produit / variante", "Quantité", "CA TTC / HT", "Tarif producteur", "Dû"].map((label) => <th key={label} scope="col" className="border border-[#1a1a1a] p-2 font-semibold">{label}</th>)}</tr></thead>
                        <tbody>{period.products.map((product) => <Fragment key={product.productId}><tr>
                          <th scope="row" className="max-w-64 border border-[#1a1a1a] p-2 font-normal"><p className="font-semibold">{product.productName}</p><p className="mt-1 break-all text-xs text-charcoal">{product.productId}</p></th>
                          <td className="border border-[#1a1a1a] p-2"><p>{number.format(product.quantity)} unité(s)</p><p className="mt-1 text-xs text-charcoal">{product.gramsSold == null ? "Poids indisponible" : `${number.format(product.gramsSold)} g vendus`}</p></td>
                          <td className="border border-[#1a1a1a] p-2"><p>{euros(product.revenueTtcCents)}</p><p className="text-xs text-charcoal">{euros(product.revenueHtCents)} HT</p>{product.gramsSold != null && product.gramsSold > 0 && <p className="mt-1 text-xs text-charcoal">{euros(product.revenueHtCents / product.gramsSold)} HT/g</p>}</td>
                          <td className="border border-[#1a1a1a] p-2"><p className="text-xs">{rateLabel(product.rate)}</p>{product.rate && <p className="mt-1 text-xs text-charcoal">{dashboard.rates.some((rate) => rate.producerId === period.producerId && rate.productId === product.productId && rate.effectiveMonth === product.rate?.effectiveMonth) ? `Depuis ${monthLabel(product.rate.effectiveMonth)}` : "Règle par défaut"}</p>}<button type="button" disabled={disabled} className={`${smallButtonClass} mt-2`} aria-label={`${product.rate ? "Modifier" : "Définir"} le tarif de ${product.productName}, ${product.productId}`} onClick={() => setRateSelection({ period, product })}>{product.rate ? "Modifier le tarif" : "Définir le tarif"}</button></td>
                          <td className="border border-[#1a1a1a] p-2 font-semibold">{product.dueCents === null ? "À calculer" : euros(product.dueCents)}</td>
                        </tr></Fragment>)}</tbody>
                      </table>
                    </div>
                  </>}
                  {rateSelection?.period.producerId === period.producerId && rateSelection.period.month === period.month && <div className="mt-4"><RateForm key={`${rateSelection.product.productId}:${rateSelection.period.month}`} selection={rateSelection} rates={dashboard.rates} busy={disabled} onClose={() => setRateSelection(null)} onSave={(rate) => mutate({ action: "rate", ...rate }, "Tarif enregistré. Les montants dus ont été recalculés pour les mois concernés.")} /></div>}
                </div>}
              </article>;
            })}
          </div>
        )}
          </div>
        </details>

        <section aria-labelledby="producer-payments-title" className="mt-2 min-w-0">
          <h3 id="producer-payments-title" className="font-display text-2xl text-ink">Historique des règlements</h3>
          <p className="mt-1 text-sm text-charcoal">{payments.length} saisie(s) couvrant au moins un mois sélectionné. Chaque règlement est affiché en entier ; le total payé ci-dessus correspond à la part imputée à la sélection. Les annulations restent visibles.</p>
          {payments.length === 0 ? <p className="mt-3 rounded border-2 border-dashed border-[#1a1a1a] p-4 text-sm text-charcoal">Aucun règlement enregistré sur cette sélection.</p> : <ul className="mt-3 grid gap-3">{payments.map((payment) => <PaymentHistoryEntry key={payment.id} payment={payment} busy={disabled} onVoid={(id, reason) => mutate({ action: "void", id, reason }, "La saisie a été annulée. Elle est conservée dans l’historique et exclue du total payé.")} />)}</ul>}
        </section>
      </div>}
    </section>
  );
}
