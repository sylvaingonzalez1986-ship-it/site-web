"use client";

import { useState } from "react";
import { CalendarClock, Check, FlaskConical, ReceiptText, RefreshCw, Zap } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import type { KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { formatKqCash as money } from "@/lib/kanab-quest-equipment";
import styles from "./KqTreasuryInvoices.module.css";

const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
export function KqTreasuryInvoices({ data, energy, energyError, now: liveNow, busy, onAsk, onRetry, onPayEnergy }: {
  data: KqCommerceSnapshot; energy: KqEnergySnapshot | null; energyError: string; now?: number; busy: boolean;
  onAsk: Ask; onRetry: () => void; onPayEnergy: (amount: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | "lab" | "energy">("all");
  const business = data.business;
  if (!business) return null;
  const now = liveNow ?? Date.parse(business.serverNow);
  const { lab, vat, shop, domiciliation } = business;
  const energyDue = energy?.outstandingCents ?? data.electricityOutstandingCents;
  const due = lab.outstandingCents + energyDue;
  const invoices = lab.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const energyInvoices = energy?.invoices.filter(invoice => invoice.remainingCents > 0) ?? [];
  const paidEnergy = energy?.invoices.filter(invoice => invoice.remainingCents === 0) ?? [];
  return <div className={styles.desk}>
    <div className={styles.summary}>
      <article><small>Factures à régler</small><strong>{money(due)}</strong><span>Laboratoire, électricité et soins</span></article>
      <article><small>Trésorerie disponible</small><strong>{money(data.cashCents)}</strong><span>{due > data.cashCents ? `${money(due - data.cashCents)} manquent pour tout régler` : `${money(data.cashCents - due)} après règlement des factures`}</span></article>
      <article><small>TVA déjà réservée</small><strong>{money(vat.reservedCents)}</strong><span>Mise de côté, séparée de ton disponible</span></article>
    </div>
    <section className={styles.inbox} aria-label="Factures à régler">
      <header className={styles.heading}><div><small>Le courrier du bureau</small><h2>Factures & échéances</h2></div><button type="button" className={styles.secondary} disabled={busy} onClick={onRetry} aria-label="Actualiser les factures"><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></header>
      <div className={styles.filters} role="group" aria-label="Type de factures">{([{ id: "all", label: "Toutes" }, { id: "lab", label: "Laboratoire" }, { id: "energy", label: "Électricité & soins" }] as const).map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      {filter !== "energy" ? <section className={styles.folder} aria-label="Factures laboratoire"><header><FlaskConical size={20} aria-hidden="true" /><h3>Laboratoire</h3><strong>{money(lab.outstandingCents)}</strong></header>
        <p>45 € par culture terminée. Paiement automatique à l’échéance si les fonds suffisent, ou règlement anticipé ici.</p>
        {invoices.length ? <ul className={styles.invoices}>{invoices.map(invoice => { const overdue = Date.parse(invoice.dueAt) <= now; return <li key={invoice.id}>
          <div className={styles.invoiceTitle}><strong>Analyse de culture</strong><small>Facturée le <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></small><span className={styles.status} data-overdue={overdue}>{overdue ? "Échue" : invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div>
          <div className={styles.invoiceDue}><small>Échéance</small><time dateTime={invoice.dueAt}>{date(invoice.dueAt)}</time><small>30 jours de jeu après émission</small></div>
          <div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div>
          <div className={styles.invoiceAction}><button type="button" className={styles.primary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler l’analyse du ${date(invoice.issuedAt)} de ${money(invoice.remainingCents)}`} onClick={() => onAsk("Régler l’analyse", `Règlement du solde de l’analyse facturée le ${date(invoice.issuedAt)}. Cette facture ne sera pas prélevée une seconde fois.`, { action: "pay-lab", invoiceId: invoice.id }, invoice.remainingCents)}>Régler · {money(invoice.remainingCents)}</button>{data.cashCents < invoice.remainingCents ? <small>Il manque {money(invoice.remainingCents - data.cashCents)}.</small> : null}</div>
        </li>; })}</ul> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> Aucune analyse à régler.</p>}
        {lab.overdueCents > 0 ? <p className={styles.warning}>{money(lab.overdueCents)} d’analyses échues : tes prochaines ventes les remboursent en priorité.</p> : null}
      </section> : null}
      {filter !== "lab" ? <section className={styles.folder} aria-label="Factures électricité et soins"><header><Zap size={20} aria-hidden="true" /><h3>Électricité & soins</h3><strong>{money(energyDue)}</strong></header><p>Facturés à la récolte. Règle le solde en une fois ou laisse tes prochaines ventes le rembourser progressivement.</p>
        {energyError ? <p className={styles.warning} role="alert">{energyError} <button type="button" className={styles.secondary} onClick={onRetry}>Réessayer</button></p> : null}
        {energyDue > 0 ? <>
          {energyInvoices.length ? <ul className={styles.invoices}>{energyInvoices.map(invoice => <li key={invoice.runId}><div className={styles.invoiceTitle}><strong>Électricité{invoice.dogCare ? " & soins du compagnon" : " de culture"}</strong><small>Facturée le <time dateTime={invoice.createdAt}>{date(invoice.createdAt)}</time></small><span className={styles.status}>{invoice.remainingCents < invoice.totalCents ? "Partiellement réglée" : "À régler"}</span></div><div className={styles.invoiceDue}><small>Règlement</small><span>À la récolte ou sur les ventes</span></div><div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.totalCents)}</small></div></li>)}</ul> : null}
          {energy && energyInvoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0) < energyDue ? <p>Seules les dernières factures sont détaillées ici. Le solde à régler inclut aussi les plus anciennes.</p> : null}
          <div className={styles.payment}><button type="button" className={styles.primary} disabled={busy || !energy || data.cashCents < energyDue} onClick={() => onPayEnergy(energyDue)}>Régler l’électricité et les soins · {money(energyDue)}</button>{data.cashCents < energyDue ? <small>Il manque {money(energyDue - data.cashCents)} pour régler ce solde.</small> : !energy ? <small>Actualise le détail des factures pour régler ce solde.</small> : null}</div>
        </> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> Aucune facture d’électricité ou de soins à régler.</p>}
        {paidEnergy.length ? <details className={styles.history}><summary>Dernières factures d’énergie réglées · {paidEnergy.length}</summary><ul>{paidEnergy.map(invoice => <li key={invoice.runId}><time dateTime={invoice.createdAt}>{date(invoice.createdAt)}</time><strong>{money(invoice.totalCents)}</strong><span>Réglée</span></li>)}</ul></details> : null}
      </section> : null}
      <p className={styles.note}>Les analyses échues et l’électricité peuvent être retenues sur tes ventes, dans la limite de 50 % de la recette après TVA. Les règlements sont aussi visibles dans le journal comptable.</p>
    </section>
    <div className={styles.calendarGrid}>
      <section className={styles.calendar} aria-label="TVA réservée"><header><ReceiptText size={21} aria-hidden="true" /><h3>TVA · déjà mise de côté</h3><span className={styles.status}>Automatique</span></header><strong className={styles.reserve}>{money(vat.reservedCents)}</strong><p>La TVA de jeu ({vat.ratePercent} %) est réservée à chaque vente. Son reversement ne débite pas une seconde fois ta trésorerie disponible.</p><dl><div><dt>Prochain reversement</dt><dd><time dateTime={vat.nextSettlementAt}>{date(vat.nextSettlementAt)}</time></dd></div><div><dt>Déjà reversé</dt><dd>{money(vat.paidCents)}</dd></div></dl></section>
      <section className={styles.calendar} aria-label="Échéances des abonnements"><header><CalendarClock size={21} aria-hidden="true" /><h3>Prochains abonnements</h3></header><p>1 mois de jeu = 5 jours réels. Retrouve les réglages et les renouvellements dans le pôle Gestion.</p><dl><div><dt>Site internet <small>{shop.active && shop.paidUntil ? `${shop.renew ? "Renouvellement" : "Fin d’accès"} le ${date(shop.paidUntil)}` : shop.createdAt ? "Site suspendu" : "Site non créé"}</small></dt><dd>{shop.active && shop.renew ? "100 €" : "Pas de prélèvement"}</dd></div><div><dt>Domiciliation <small>{domiciliation?.active && domiciliation.paidUntil ? `${domiciliation.renew ? "Renouvellement" : "Fin d’accès"} le ${date(domiciliation.paidUntil)}` : "À domicile · gratuit"}</small></dt><dd>{domiciliation?.active && domiciliation.renew ? "50 €" : "Pas de prélèvement"}</dd></div></dl><small>Un renouvellement à venir n’est pas encore une facture impayée.</small></section>
    </div>
  </div>;
}
