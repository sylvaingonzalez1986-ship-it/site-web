"use client";

import { useState } from "react";
import { CalendarClock, Check, FlaskConical, Package, ReceiptText, RefreshCw, Snowflake, Zap } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import type { KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { formatKqCash as money } from "@/lib/kanab-quest-equipment";
import { KQ_SHOP_MONTHLY_CENTS } from "@/lib/kanab-quest-business";
import { getKqOnlineSiteTier } from "@/lib/kanab-quest-online";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqCulturePurchases } from "./KqCulturePurchases";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";
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
  const canPayAll = Boolean(energy && !energyError && suppliers);
  const invoices = lab.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const energyInvoices = energy?.invoices.filter(invoice => invoice.remainingCents > 0) ?? [];
  const paidEnergy = energy?.invoices.filter(invoice => invoice.remainingCents === 0) ?? [];
  const climate = energy?.storageClimate ?? business.storageClimate;
  const climateInvoices = climate?.invoices.filter(invoice => invoice.remainingCents > 0) ?? [];
  const paidClimate = climate?.invoices.filter(invoice => invoice.remainingCents === 0) ?? [];
  const supplierInvoices = suppliers?.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)) ?? [];
  const paidSuppliers = suppliers?.invoices.filter(invoice => invoice.remainingCents === 0).toSorted((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)) ?? [];
  const overdue = suppliers ? suppliers.overdueCents + lab.overdueCents : null;
  const paidLab = lab.invoices.filter(invoice => invoice.remainingCents === 0);
  return <div className={styles.desk}>
    <KqChapterHeading art="accounts" title="Factures & échéances" compact actions={<button type="button" className={styles.secondary} disabled={busy} onClick={onRetry} aria-label="Actualiser les factures"><RefreshCw size={16} aria-hidden="true" /> Actualiser</button>} />
    <section className={styles.inbox} aria-label="Factures à régler">
      <dl className={styles.summary} aria-label="Situation avant règlement">
        <div data-priority><dt>Total à régler</dt><dd><strong>{canPayAll ? money(due) : "À actualiser"}</strong><span>Factures émises, toutes catégories</span></dd></div>
        <div><dt>Trésorerie disponible</dt><dd><strong>{money(data.cashCents)}</strong><span>{!canPayAll ? "Solde après règlement à confirmer" : due > data.cashCents ? `Il manque ${money(due - data.cashCents)} pour tout régler` : `${money(data.cashCents - due)} après règlement`}</span></dd></div>
        <div data-warning={overdue !== null && overdue > 0 || undefined}><dt>Fournisseurs & labo échus</dt><dd><strong>{overdue !== null ? money(overdue) : "À actualiser"}</strong><span>Inclus dans le total à régler</span></dd></div>
      </dl>
      {canPayAll ? <div className={styles.financialOverview}>
        <KqAllocationBar label="Factures restant à régler" emptyLabel="Aucune facture en attente." items={[
          { label: "Fournisseurs", value: suppliers!.outstandingCents, displayValue: money(suppliers!.outstandingCents), tone: "ink" },
          { label: "Laboratoire", value: lab.outstandingCents, displayValue: money(lab.outstandingCents), tone: "gold" },
          { label: "Électricité et soins", value: energyDue, displayValue: money(energyDue), tone: "teal" },
        ]} />
        <KqProgressMeter label="Couverture par ta trésorerie" value={Math.min(data.cashCents, due)} max={due}
          valueLabel={due > 0 ? `${Math.floor(Math.min(1, data.cashCents / due) * 100)} % des factures` : "Aucune facture à payer"}
          tone={data.cashCents < due ? "gold" : "teal"} hint={data.cashCents < due ? `Il manque ${money(due - data.cashCents)}` : `${money(data.cashCents - due)} disponibles après règlement`} />
      </div> : <p className={styles.incomplete}>Actualise les factures pour consulter leur répartition complète.</p>}
      <div className={styles.bulkPayment}>
        <button type="button" className={styles.primary} data-pay-all-invoices disabled={busy || !canPayAll || due <= 0 || data.cashCents < due}
          aria-describedby="pay-all-invoices-help"
          onClick={() => onAsk("Régler toutes les factures",
            `Tu vas régler toutes les factures déjà émises, même avant leur échéance : fournisseurs ${money(suppliers!.outstandingCents)}, laboratoire ${money(lab.outstandingCents)}, électricité et soins (climatisation comprise) ${money(energyDue)}. Le total de ${money(due)} sera débité de ta trésorerie disponible. Il te restera ${money(data.cashCents - due)}.`,
            { action: "pay-all-invoices", expectedCents: due }, due)}>
          <Check size={18} aria-hidden="true" /> Régler toutes les factures · {canPayAll ? money(due) : "Total à actualiser"}
        </button>
        <small id="pay-all-invoices-help">{!canPayAll ? "Actualise les factures pour charger le total complet." : due <= 0 ? "Toutes tes factures sont réglées." : data.cashCents < due ? `Il manque ${money(due - data.cashCents)} pour tout régler. Tu peux encore payer certaines factures séparément.` : "Toutes les catégories, y compris les factures non échues."}</small>
      </div>
    </section>
    <section className={styles.register} aria-label="Détail des factures">
      <header className={styles.heading}><h2>Registre des factures</h2></header>
      <div className={styles.filters} role="group" aria-label="Type de factures">{([{ id: "all", label: "Toutes" }, { id: "suppliers", label: "Fournisseurs" }, { id: "lab", label: "Laboratoire" }, { id: "energy", label: "Électricité & soins" }] as const).map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      {filter === "all" || filter === "suppliers" ? <section className={styles.folder} aria-label="Factures fournisseurs"><header><Package size={20} aria-hidden="true" /><h3>Fournisseurs · consommables</h3><strong>{suppliers ? money(suppliers.outstandingCents) : "À actualiser"}</strong></header>
        {supplierInvoices.length ? <ul className={styles.invoices}>{supplierInvoices.map(invoice => { const overdue = Date.parse(invoice.dueAt) <= now; return <li key={invoice.id} data-supplier-invoice={invoice.id}>
          <div className={styles.invoiceTitle}><strong>Consommables de culture</strong><small>Culture {invoice.runId.slice(0, 8)} · facturée le <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></small><span className={styles.status} data-overdue={overdue}>{overdue ? "Échue" : invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div>
          <div className={styles.invoiceDue}><small>Échéance</small><time dateTime={invoice.dueAt}>{date(invoice.dueAt)}</time><small>30 jours de jeu · 5 jours réels après le lancement</small></div>
          <div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div>
          <div className={styles.invoiceAction}><button type="button" className={styles.primary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler les consommables de la culture ${invoice.runId.slice(0, 8)} de ${money(invoice.remainingCents)}`} onClick={() => onAsk("Régler le fournisseur", `Le solde de ${money(invoice.remainingCents)} des consommables de la culture ${invoice.runId.slice(0, 8)} sera débité de ta trésorerie. L’échéance de cette facture est le ${date(invoice.dueAt)}.`, { action: "pay-supplier", invoiceId: invoice.id }, invoice.remainingCents)}>Régler · {money(invoice.remainingCents)}</button>{data.cashCents < invoice.remainingCents ? <small>Il manque {money(invoice.remainingCents - data.cashCents)} pour ce règlement.</small> : null}</div>
        </li>; })}</ul> : <p className={styles.clear}>{suppliers ? <><Check size={17} aria-hidden="true" /> Aucune facture fournisseur à régler.</> : "Factures fournisseur indisponibles. Actualise pour les consulter."}</p>}
        {suppliers && suppliers.outstandingCents > supplierInvoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0) ? <p>Seules les dernières factures sont détaillées ici. Le solde inclut aussi les plus anciennes.</p> : null}
        {(suppliers?.overdueCents ?? 0) > 0 ? <p className={styles.warning}>{money(suppliers!.overdueCents)} de factures fournisseur échues. Règle-les ici ou laisse tes prochaines ventes les rembourser progressivement.</p> : null}
        {paidSuppliers.length ? <details className={styles.history}><summary>Dernières factures fournisseur réglées · {paidSuppliers.length}</summary><ul>{paidSuppliers.map(invoice => <li key={invoice.id}><span>Culture {invoice.runId.slice(0, 8)} · <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></span><strong>{money(invoice.amountCents)}</strong><span>Réglée</span></li>)}</ul></details> : null}
      </section> : null}
      {filter === "all" || filter === "lab" ? <section className={styles.folder} aria-label="Factures laboratoire"><header><FlaskConical size={20} aria-hidden="true" /><h3>Laboratoire</h3><strong>{money(lab.outstandingCents)}</strong></header>
        {invoices.length ? <ul className={styles.invoices}>{invoices.map(invoice => { const overdue = Date.parse(invoice.dueAt) <= now; return <li key={invoice.id}>
          <div className={styles.invoiceTitle}><strong>Analyse de culture</strong><small>Facturée le <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></small><span className={styles.status} data-overdue={overdue}>{overdue ? "Échue" : invoice.remainingCents < invoice.amountCents ? "Partiellement réglée" : "À régler"}</span></div>
          <div className={styles.invoiceDue}><small>Échéance</small><time dateTime={invoice.dueAt}>{date(invoice.dueAt)}</time><small>30 jours de jeu après émission</small></div>
          <div className={styles.invoiceAmount}><small>Reste à payer</small><strong>{money(invoice.remainingCents)}</strong><small>Facture initiale : {money(invoice.amountCents)}</small></div>
          <div className={styles.invoiceAction}><button type="button" className={styles.primary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler l’analyse du ${date(invoice.issuedAt)} de ${money(invoice.remainingCents)}`} onClick={() => onAsk("Régler l’analyse", `Règlement du solde de l’analyse facturée le ${date(invoice.issuedAt)}. Cette facture ne sera pas prélevée une seconde fois.`, { action: "pay-lab", invoiceId: invoice.id }, invoice.remainingCents)}>Régler · {money(invoice.remainingCents)}</button>{data.cashCents < invoice.remainingCents ? <small>Il manque {money(invoice.remainingCents - data.cashCents)}.</small> : null}</div>
        </li>; })}</ul> : <p className={styles.clear}><Check size={17} aria-hidden="true" /> Aucune analyse à régler.</p>}
        {lab.overdueCents > 0 ? <p className={styles.warning}>{money(lab.overdueCents)} d’analyses échues : tes prochaines ventes les remboursent en priorité.</p> : null}
        {paidLab.length ? <details className={styles.history}><summary>Dernières analyses réglées · {paidLab.length}</summary><ul>{paidLab.map(invoice => <li key={invoice.id}><span>Analyse · <time dateTime={invoice.issuedAt}>{date(invoice.issuedAt)}</time></span><strong>{money(invoice.amountCents)}</strong><span>Réglée</span></li>)}</ul></details> : null}
      </section> : null}
      {filter === "all" || filter === "energy" ? <section className={styles.folder} aria-label="Factures électricité et soins"><header><Zap size={20} aria-hidden="true" /><h3>Électricité & soins du compagnon</h3><strong>{money(energyDue)}</strong></header>
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
    </section>
    <KqCulturePurchases refreshKey={business.serverNow} />
    <details className={styles.breakdown} data-invoice-analysis>
      <summary>Règles de facturation et de règlement</summary>
      <KqHelpDashboard><KqHelpSteps steps={[
        { art: "help-culture" as const, label: "Lancer la culture", detail: "Facture de consommables, sans débit immédiat." },
        { art: "help-accounts" as const, label: "Régler avant l’échéance", detail: "Paiement possible ici à tout moment." },
        { art: "help-time" as const, label: "À l’échéance", detail: "1 tentative automatique selon les fonds. Le solde impayé reste dû." },
      ]} /><KqHelpGrid items={[
        { art: "commerce" as const, label: "Retenues sur les ventes", value: "50 % maximum au total", detail: "De la recette après TVA et, en ligne, après frais." },
        { art: "accounts" as const, label: "Ordre de règlement", value: "Analyses → énergie → fournisseurs", detail: "Analyses échues, électricité et soins, puis fournisseurs échus." },
      ]} /><KqHelpNote>Consommables de lancement : échéance à 30 jours de jeu, soit 5 jours réels. Laboratoire : 45 € par session terminée, pour le lot commun à toutes les tentes. Électricité et soins du compagnon : facturés à la récolte ; climatisation du stockage : chaque mois de jeu. Les achats d’intrants en cours de culture sont payés immédiatement et ne s’ajoutent pas au solde à régler. Les règlements figurent aussi dans le journal comptable.</KqHelpNote></KqHelpDashboard>
    </details>
    <section className={styles.calendarPanel} aria-label="À venir et TVA" data-upcoming-finances>
      <h2>À venir et TVA</h2>
      <div className={styles.calendarGrid}>
        {climate && (climate.code || climate.accruedCents > 0) && <section className={styles.calendar} aria-label="Échéance de la climatisation">
          <header><Snowflake size={20} aria-hidden="true" /><h3>Climatisation du stockage</h3></header>
          <strong className={styles.reserve}>{money(climate.monthlyCostCents)} <small>/ mois de jeu</small></strong>
          <dl><div><dt>Consommation engagée</dt><dd>{money(climate.accruedCents)}</dd></div>{climate.nextBillingAt && <div><dt>Prochain débit automatique</dt><dd><time dateTime={climate.nextBillingAt}>{date(climate.nextBillingAt)}</time></dd></div>}</dl>
        </section>}
        <section className={styles.calendar} aria-label="TVA réservée">
          <header><ReceiptText size={20} aria-hidden="true" /><h3>TVA déjà mise de côté</h3></header>
          <strong className={styles.reserve}>{money(vat.reservedCents)}</strong>
          <p>Reversement automatique · aucun nouveau débit du disponible.</p>
          <dl><div><dt>Prochain reversement</dt><dd><time dateTime={vat.nextSettlementAt}>{date(vat.nextSettlementAt)}</time></dd></div></dl>
        </section>
        <section className={styles.calendar} aria-label="Échéances des abonnements">
          <header><CalendarClock size={20} aria-hidden="true" /><h3>Site internet</h3></header>
          <strong className={styles.reserve}>{site.active && siteMonthlyCents === 0 ? "Sans abonnement" : site.active && site.renew && site.paidUntil ? <>{money(siteMonthlyCents)} <small>au renouvellement</small></> : "Pas de prélèvement"}</strong>
          <p>{siteStatus}</p>
          {domiciliation?.retired !== true && domiciliation?.active && domiciliation.renew && domiciliation.paidUntil ? <dl><div data-legacy-domiciliation><dt>Ancienne domiciliation <small>Renouvellement le {date(domiciliation.paidUntil)}</small></dt><dd>50 €</dd></div></dl> : null}
        </section>
      </div>
      <details className={styles.history} data-upcoming-rules>
        <summary>Comprendre les montants à venir</summary>
        <KqHelpDashboard><KqHelpGrid items={[
          { art: "help-time" as const, label: "1 mois de jeu", value: "5 jours réels", detail: "30 jours de jeu." },
          { art: "help-plan" as const, label: "Renouvellement à venir", value: "Pas encore impayé", detail: "Réglages : Commerce → Développer → Site internet." },
          { art: "help-accounts" as const, label: "TVA réservée à chaque vente", value: `${vat.ratePercent} %`, detail: "Reversement sans second débit du disponible." },
          { art: "accounts" as const, label: "TVA déjà reversée", value: money(vat.paidCents) },
        ]} />{climate && (climate.code || climate.accruedCents > 0) ? <><KqHelpGrid items={[
          { art: "warehouse" as const, label: "Stockage climatisé", value: `${climate.areaM2} m²` },
          { art: "help-time" as const, label: "Consommation / mois de jeu", value: `${climate.monthlyKwh} kWh`, detail: "Prorata du temps installé ; facture tous les 30 jours de jeu." },
        ]} /><KqHelpNote>Le montant varie avec la surface ou le climatiseur installé pendant le mois. Le solde impayé reste dans les factures d’électricité.</KqHelpNote></> : null}</KqHelpDashboard>
      </details>
    </section>
  </div>;
}
