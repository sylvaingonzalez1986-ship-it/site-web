"use client";

import { useState } from "react";
import { CalendarClock, Check, FlaskConical, Package, ReceiptText, RefreshCw, Snowflake, Zap } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import type { KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { formatKqCash as money } from "@/lib/kanab-quest-equipment";
import { KQ_SHOP_MONTHLY_CENTS } from "@/lib/kanab-quest-business";
import { getKqOnlineSiteTier } from "@/lib/kanab-quest-online";
import styles from "./KqTreasuryInvoices.module.css";

const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
export function KqTreasuryInvoices({ data, energy, energyError, now: liveNow, busy, onAsk, onRetry, onPayEnergy }: {
  data: KqCommerceSnapshot; energy: KqEnergySnapshot | null; energyError: string; now?: number; busy: boolean;
  onAsk: Ask; onRetry: () => void; onPayEnergy: (amount: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | "lab" | "energy" | "suppliers">("all");
  const business = data.business;
  if (!business) return null;
  const now = liveNow ?? Date.parse(business.serverNow);
  const { lab, vat, shop, domiciliation, suppliers } = business;
  const site = data.online?.site ?? shop;
  const siteMonthlyCents = data.online ? getKqOnlineSiteTier(data.online.site.tier).monthlyCents : KQ_SHOP_MONTHLY_CENTS;
  const siteStatus = !site.createdAt ? "Site non créé" : !site.active ? "Site suspendu" : siteMonthlyCents === 0 ? "Boutique de base · sans abonnement" : site.paidUntil ? `${site.renew ? "Renouvellement" : "Fin d’accès"} le ${date(site.paidUntil)}` : "Aucune période payée";
  const energyDue = energy?.outstandingCents ?? data.electricityOutstandingCents;
  const due = lab.outstandingCents + energyDue + (suppliers?.outstandingCents ?? 0);
  const invoices = lab.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const energyInvoices = energy?.invoices.filter(invoice => invoice.remainingCents > 0) ?? [];
  const paidEnergy = energy?.invoices.filter(invoice => invoice.remainingCents === 0) ?? [];
  const climate = energy?.storageClimate ?? business.storageClimate;
  const climateInvoices = climate?.invoices.filter(invoice => invoice.remainingCents > 0) ?? [];
  const paidClimate = climate?.invoices.filter(invoice => invoice.remainingCents === 0) ?? [];
  const supplierInvoices = suppliers?.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)) ?? [];
  const paidSuppliers = suppliers?.invoices.filter(invoice => invoice.remainingCents === 0).toSorted((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)) ?? [];
  return <div className={styles.desk}>
    <div className={styles.summary}>
      <article><small>Factures à régler</small><strong>{money(due)}</strong><span>Fournisseurs, laboratoire, électricité et soins</span></article>
      <article><small>Trésorerie disponible</small><strong>{money(data.cashCents)}</strong><span>{due > data.cashCents ? `${money(due - data.cashCents)} manquent pour tout régler` : `${money(data.cashCents - due)} après règlement des factures`}</span></article>
      <article><small>TVA déjà réservée</small><strong>{money(vat.reservedCents)}</strong><span>Mise de côté, séparée de ton disponible</span></article>
    </div>
    <section className={styles.inbox} aria-label="Factures à régler">
      <header className={styles.heading}><div><small>Le courrier du bureau</small><h2>Factures & échéances</h2></div><button type="button" className={styles.secondary} disabled={busy} onClick={onRetry} aria-label="Actualiser les factures"><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></header>
      <div className={styles.filters} role="group" aria-label="Type de factures">{([{ id: "all", label: "Toutes" }, { id: "suppliers", label: "Fournisseurs" }, { id: "lab", label: "Laboratoire" }, { id: "energy", label: "Électricité & soins" }] as const).map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      {filter === "all" || filter === "suppliers" ? <section className={styles.folder} aria-label="Factures fournisseurs"><header><Package size={20} aria-hidden="true" /><h3>Fournisseurs · consommables</h3><strong>{money(suppliers?.outstandingCents ?? 0)}</strong></header>
        <p>À régler sous 30 jours de jeu, soit 5 jours réels après le lancement.</p>
        <details className={styles.history}><summary>Comment sont réglés les consommables ?</summary><p>Le lancement crée la facture sans prélèvement immédiat. Tu peux la régler ici avant l’échéance. Un prélèvement automatique est tenté une fois à l’échéance, dans la limite des fonds disponibles ; tout solde impayé reste dû.</p></details>
        {supplierInvoices.length ? <ul className={styles.invoices}>{supplierInvoices.map(invoice => { const overdue = Date.parse(invoice.dueAt) <= now; return <li key={invoice.id} data-supplier-invoice={invoice.id}>
          <div className={styles.invoiceTitle}><strong>Consommables de culture</strong><small>Culture {invoice.runId.slice(0, 8)} · facturée le <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></small><span className={styles.status} data-overdue={overdue}>{overdue ? "Échue" : invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div>
          <div className={styles.invoiceDue}><small>Échéance</small><time dateTime={invoice.dueAt}>{date(invoice.dueAt)}</time><small>30 jours de jeu · 5 jours réels après le lancement</small></div>
          <div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div>
          <div className={styles.invoiceAction}><button type="button" className={styles.primary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler les consommables de la culture ${invoice.runId.slice(0, 8)} de ${money(invoice.remainingCents)}`} onClick={() => onAsk("Régler le fournisseur", `Le solde de ${money(invoice.remainingCents)} des consommables de la culture ${invoice.runId.slice(0, 8)} sera débité de ta trésorerie. L’échéance de cette facture est le ${date(invoice.dueAt)}.`, { action: "pay-supplier", invoiceId: invoice.id }, invoice.remainingCents)}>Régler · {money(invoice.remainingCents)}</button>{data.cashCents < invoice.remainingCents ? <small>Il manque {money(invoice.remainingCents - data.cashCents)} pour ce règlement.</small> : null}</div>
        </li>; })}</ul> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> {suppliers ? "Aucune facture fournisseur à régler." : "Les nouvelles factures fournisseur apparaîtront ici."}</p>}
        {suppliers && suppliers.outstandingCents > supplierInvoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0) ? <p>Seules les dernières factures sont détaillées ici. Le solde inclut aussi les plus anciennes.</p> : null}
        {(suppliers?.overdueCents ?? 0) > 0 ? <p className={styles.warning}>{money(suppliers!.overdueCents)} de factures fournisseur échues. Règle-les ici ou laisse tes prochaines ventes les rembourser progressivement.</p> : null}
        {paidSuppliers.length ? <details className={styles.history}><summary>Dernières factures fournisseur réglées · {paidSuppliers.length}</summary><ul>{paidSuppliers.map(invoice => <li key={invoice.id}><span>Culture {invoice.runId.slice(0, 8)} · <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></span><strong>{money(invoice.amountCents)}</strong><span>Réglée</span></li>)}</ul></details> : null}
      </section> : null}
      {filter === "all" || filter === "lab" ? <section className={styles.folder} aria-label="Factures laboratoire"><header><FlaskConical size={20} aria-hidden="true" /><h3>Laboratoire</h3><strong>{money(lab.outstandingCents)}</strong></header>
        <p>45 € une seule fois par session de culture terminée, pour le lot commun à toutes les tentes. Paiement automatique à l’échéance si les fonds suffisent, ou règlement anticipé ici.</p>
        {invoices.length ? <ul className={styles.invoices}>{invoices.map(invoice => { const overdue = Date.parse(invoice.dueAt) <= now; return <li key={invoice.id}>
          <div className={styles.invoiceTitle}><strong>Analyse de culture</strong><small>Facturée le <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></small><span className={styles.status} data-overdue={overdue}>{overdue ? "Échue" : invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div>
          <div className={styles.invoiceDue}><small>Échéance</small><time dateTime={invoice.dueAt}>{date(invoice.dueAt)}</time><small>30 jours de jeu après émission</small></div>
          <div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div>
          <div className={styles.invoiceAction}><button type="button" className={styles.primary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler l’analyse du ${date(invoice.issuedAt)} de ${money(invoice.remainingCents)}`} onClick={() => onAsk("Régler l’analyse", `Règlement du solde de l’analyse facturée le ${date(invoice.issuedAt)}. Cette facture ne sera pas prélevée une seconde fois.`, { action: "pay-lab", invoiceId: invoice.id }, invoice.remainingCents)}>Régler · {money(invoice.remainingCents)}</button>{data.cashCents < invoice.remainingCents ? <small>Il manque {money(invoice.remainingCents - data.cashCents)}.</small> : null}</div>
        </li>; })}</ul> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> Aucune analyse à régler.</p>}
        {lab.overdueCents > 0 ? <p className={styles.warning}>{money(lab.overdueCents)} d’analyses échues : tes prochaines ventes les remboursent en priorité.</p> : null}
      </section> : null}
      {filter === "all" || filter === "energy" ? <section className={styles.folder} aria-label="Factures électricité et soins"><header><Zap size={20} aria-hidden="true" /><h3>Électricité & soins</h3><strong>{money(energyDue)}</strong></header><p>La culture et les soins sont facturés à la récolte ; la climatisation du stockage, chaque mois de jeu. Règle le solde en une fois ou laisse tes prochaines ventes le rembourser progressivement.</p>
        {energyError ? <p className={styles.warning} role="alert">{energyError} <button type="button" className={styles.secondary} onClick={onRetry}>Réessayer</button></p> : null}
        {energyDue > 0 ? <>
          {energyInvoices.length ? <ul className={styles.invoices}>{energyInvoices.map(invoice => <li key={invoice.runId}><div className={styles.invoiceTitle}><strong>Électricité{invoice.dogCare ? " & soins du compagnon" : " de culture"}</strong><small>Facturée le <time dateTime={invoice.createdAt}>{date(invoice.createdAt)}</time></small><span className={styles.status}>{invoice.remainingCents < invoice.totalCents ? "Partiellement réglée" : "À régler"}</span></div><div className={styles.invoiceDue}><small>Règlement</small><span>À la récolte ou sur les ventes</span></div><div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.totalCents)}</small></div></li>)}</ul> : null}
          {climateInvoices.length > 0 && <ul className={styles.invoices}>{climateInvoices.map(invoice => <li key={invoice.id} data-climate-invoice={invoice.id}><div className={styles.invoiceTitle}><strong>Climatisation du stockage</strong><small>Du {date(invoice.periodStartedAt)} au {date(invoice.periodEndedAt)}</small><span className={styles.status} data-overdue>{invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div><div className={styles.invoiceDue}><small>Échéance mensuelle</small><time dateTime={invoice.periodEndedAt}>{date(invoice.periodEndedAt)}</time></div><div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div></li>)}</ul>}
          {energy && energyInvoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0) + climateInvoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0) < energyDue ? <p>Seules les dernières factures sont détaillées ici. Le solde à régler inclut aussi les plus anciennes.</p> : null}
          <div className={styles.payment}><button type="button" className={styles.primary} disabled={busy || !energy || data.cashCents < energyDue} onClick={() => onPayEnergy(energyDue)}>Régler l’électricité et les soins · {money(energyDue)}</button>{data.cashCents < energyDue ? <small>Il manque {money(energyDue - data.cashCents)} pour régler ce solde.</small> : !energy ? <small>Actualise le détail des factures pour régler ce solde.</small> : null}</div>
        </> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> Aucune facture d’électricité ou de soins à régler.</p>}
        {paidEnergy.length ? <details className={styles.history}><summary>Dernières factures d’énergie réglées · {paidEnergy.length}</summary><ul>{paidEnergy.map(invoice => <li key={invoice.runId}><time dateTime={invoice.createdAt}>{date(invoice.createdAt)}</time><strong>{money(invoice.totalCents)}</strong><span>Réglée</span></li>)}</ul></details> : null}
        {paidClimate.length > 0 && <details className={styles.history}><summary>Dernières factures de climatisation réglées · {paidClimate.length}</summary><ul>{paidClimate.map(invoice => <li key={invoice.id}><span>Climatisation · <time dateTime={invoice.periodEndedAt}>{date(invoice.periodEndedAt)}</time></span><strong>{money(invoice.amountCents)}</strong><span>Réglée</span></li>)}</ul></details>}
      </section> : null}
      <details className={styles.history}><summary>Ordre des retenues sur les ventes</summary><p className={styles.note}>Les retenues sur les ventes règlent d’abord les analyses échues, puis l’électricité et les soins, puis les fournisseurs échus. Elles partagent une limite totale de 50 % de la recette après TVA et, pour les ventes en ligne, après les frais. Les règlements sont aussi visibles dans le journal comptable.</p></details>
    </section>
    <div className={styles.calendarGrid}>
      {climate && (climate.code || climate.accruedCents > 0) && <section className={styles.calendar} aria-label="Échéance de la climatisation"><header><Snowflake size={21} aria-hidden="true" /><h3>Climatisation du stockage</h3><span className={styles.status}>Mensuel</span></header><strong className={styles.reserve}>{money(climate.monthlyCostCents)} / mois de jeu</strong><p>{climate.areaM2} m² de stockage · {climate.monthlyKwh} kWh / mois. Consommation au prorata du temps installé, facturée tous les 30 jours de jeu (5 jours réels).</p><dl><div><dt>Consommation engagée</dt><dd>{money(climate.accruedCents)}</dd></div>{climate.nextBillingAt && <div><dt>Prochain débit automatique</dt><dd><time dateTime={climate.nextBillingAt}>{date(climate.nextBillingAt)}</time></dd></div>}</dl><small>Le montant dépend des changements de surface ou de climatiseur pendant le mois. Tout solde impayé reste dans les factures d’électricité.</small></section>}
      <section className={styles.calendar} aria-label="TVA réservée"><header><ReceiptText size={21} aria-hidden="true" /><h3>TVA · déjà mise de côté</h3><span className={styles.status}>Automatique</span></header><strong className={styles.reserve}>{money(vat.reservedCents)}</strong><p>La TVA de jeu ({vat.ratePercent} %) est réservée à chaque vente. Son reversement ne débite pas une seconde fois ta trésorerie disponible.</p><dl><div><dt>Prochain reversement</dt><dd><time dateTime={vat.nextSettlementAt}>{date(vat.nextSettlementAt)}</time></dd></div><div><dt>Déjà reversé</dt><dd>{money(vat.paidCents)}</dd></div></dl></section>
      <section className={styles.calendar} aria-label="Échéances des abonnements"><header><CalendarClock size={21} aria-hidden="true" /><h3>Prochains abonnements</h3></header><p>1 mois de jeu = 5 jours réels. Retrouve les réglages et les renouvellements au Marché, dans « Ma boutique ».</p><dl><div><dt>Site internet <small>{siteStatus}</small></dt><dd>{site.active && siteMonthlyCents === 0 ? "Sans abonnement" : site.active && site.renew && site.paidUntil ? money(siteMonthlyCents) : "Pas de prélèvement"}</dd></div><div><dt>Domiciliation <small>{domiciliation?.active && domiciliation.paidUntil ? `${domiciliation.renew ? "Renouvellement" : "Fin d’accès"} le ${date(domiciliation.paidUntil)}` : "À domicile · gratuit"}</small></dt><dd>{domiciliation?.active && domiciliation.renew ? "50 €" : "Pas de prélèvement"}</dd></div></dl><small>Un renouvellement à venir n’est pas encore une facture impayée.</small></section>
    </div>
  </div>;
}
