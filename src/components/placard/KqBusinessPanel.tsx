"use client";

import { useState } from "react";
import { CalendarClock, Check, ChevronDown, FlaskConical, Megaphone, Monitor, ReceiptText, Store, Wallet } from "lucide-react";
import { KQ_ADVERTISING, KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS, KQ_LAB_ANALYSIS_CENTS, KQ_SHOP_CREATION_CENTS, KQ_SHOP_MONTHLY_CENTS, getKqBusinessClock } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KqOnlineBusiness, type KqOnlineBusinessView, type KqOnlineUpgradeView } from "./KqOnlineBusiness";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import styles from "./KqBusinessPanel.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
const dateLabel = (value: string | number) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function remaining(value: string | number, now: number) {
  const minutes = Math.ceil(((typeof value === "number" ? value : Date.parse(value)) - now) / 60000);
  if (minutes <= 0) return "Échéance atteinte";
  if (minutes >= 1440) return `dans ${Math.floor(minutes / 1440)} j ${Math.floor(minutes % 1440 / 60)} h réels`;
  if (minutes >= 60) return `dans ${Math.floor(minutes / 60)} h ${minutes % 60} min réelles`;
  return `dans ${minutes} min réelles`;
}
function Deadline({ at, now }: { at: string | number; now: number }) {
  return <span className={styles.deadline}><time dateTime={new Date(at).toISOString()}>{dateLabel(at)}</time><small>{remaining(at, now)}</small></span>;
}

function ShopNameForm({ name, busy, canCreate, onAsk, now }: { name: string | null; busy: boolean; canCreate: boolean; onAsk: Ask; now: number }) {
  const [value, setValue] = useState(name ?? "");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  const valid = [...normalized].length >= 3 && [...normalized].length <= 40 && !/[\p{Cc}\p{Cf}<>]/u.test(value);
  return <form className={styles.nameForm} onSubmit={event => {
    event.preventDefault();
    if (!valid || busy || (!name && !canCreate)) return;
    onAsk(name ? "Renommer ton shop" : "Créer ton site internet", name
      ? `Ton shop s’appellera « ${normalized} ». Le changement de nom est gratuit et conserve la date de renouvellement.`
      : `« ${normalized} » : création à ${formatKqCash(KQ_SHOP_CREATION_CENTS)}, premier mois de jeu inclus. Puis ${formatKqCash(KQ_SHOP_MONTHLY_CENTS)} tous les 30 jours de jeu (5 jours réels), à partir du ${dateLabel(now + KQ_GAME_MONTH_MS)}. Reconduction automatique désactivable à tout moment.`,
    { action: name ? "rename-shop" : "create-shop", name: normalized }, name ? 0 : KQ_SHOP_CREATION_CENTS);
  }}>
    <label>Nom de ton shop<input type="text" value={value} onChange={event => setValue(event.target.value)} maxLength={80} placeholder="Le nom de ta boutique" autoComplete="off" disabled={busy} aria-describedby="kq-shop-name-help" /></label>
    <small id="kq-shop-name-help">3 à 40 caractères. {value && !valid ? "Choisis un nom de cette longueur pour continuer." : "Ce nom apparaîtra dans ton commerce."}</small>
    <button className={styles.primary} disabled={busy || !valid || (name ? normalized === name : !canCreate)}>{name ? "Enregistrer le nom" : `Créer mon site · ${formatKqCash(KQ_SHOP_CREATION_CENTS)}`}</button>
  </form>;
}

const ledgerLabels: Record<string, string> = {
  "shop-created": "Création du site", "shop-renewed": "Hébergement et maintenance", "shop-suspended": "Site suspendu",
  "rename-shop": "Nom du shop modifié", "lab-overdue": "Analyse arrivée à échéance", "shop-renewal": "Reconduction du site modifiée", "advertising-started": "Campagne publicitaire lancée",
  "advertising-ended": "Campagne publicitaire terminée", "vat-paid": "TVA reversée", "lab-issued": "Analyse facturée", "lab-paid": "Analyse réglée", "domicile-paid": "Domiciliation extérieure réglée", "domicile-expired": "Domiciliation extérieure suspendue", "domicile-home": "Domiciliation à domicile",
  "lab-adjusted": "Dette d’analyse excédentaire annulée", "lab-refunded": "Trop-perçu d’analyse remboursé",
  "storage-climate-issued": "Climatisation du stockage facturée", "storage-climate-paid": "Climatisation du stockage réglée", "storage-climate-credit": "Crédit de climatisation déjà facturée",
};

export function KqBusinessPanel({ data, now: liveNow, busy, onAsk, onOpenShop, onPrepareStock, onViewSales, initialView, initialUpgradeView, expanded = false, showAccounting = true }: {
  data: KqCommerceSnapshot; now?: number; busy: boolean; onAsk: Ask; onOpenShop: () => void; onPrepareStock?: () => void; onViewSales?: () => void; initialView?: KqOnlineBusinessView; initialUpgradeView?: KqOnlineUpgradeView; expanded?: boolean; showAccounting?: boolean;
}) {
  const business = data.business;
  if (!business) return null;
  const now = liveNow ?? Date.parse(business.serverNow);
  const calendar = getKqBusinessClock(business.startedAt, now);
  const { shop, vat, lab } = business;
  const active = data.online?.site.active ?? (shop.active && Boolean(shop.paidUntil && Date.parse(shop.paidUntil) > now));
  const advertising = business.advertising && Date.parse(business.advertising.endsAt) > now ? business.advertising : null;
  const missing = Math.max(0, KQ_SHOP_CREATION_CENTS - data.cashCents);
  const invoices = lab.invoices.filter(invoice => invoice.remainingCents > 0).toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const calendarPanel = <details className={styles.clockDetails}><summary><CalendarClock size={18} aria-hidden="true" />Calendrier du jeu · Mois {calendar.month}, jour {calendar.dayOfMonth}</summary><div className={styles.calendar}><div><strong>Mois {calendar.month} · Jour {calendar.dayOfMonth}</strong><span>1 jour = 4 h réelles · 1 mois = 5 jours réels</span></div><div className={styles.nextDay}><span>Prochain jour</span><Deadline at={calendar.nextDayAt} now={now} /></div></div><p className={styles.timeNote}>{data.online ? "Les ventes en ligne et le calendrier continuent hors connexion. Un jour de jeu dure 4 heures réelles ; les estimations de commandes sont données par jour réel." : "Le calendrier continue hors connexion. Les ventes se font lorsque tu joues ; les abonnements, publicités et factures suivent le temps réel."}</p></details>;
  const accountingPanel = showAccounting ? <section className={styles.accounts} aria-label="Charges et échéances">
    <header><Wallet size={22} aria-hidden="true" /><h2>Ta trésorerie</h2></header>
    <dl className={styles.balances}><div><dt>Disponible</dt><dd>{formatKqCash(data.cashCents)}</dd></div><div><dt>TVA réservée à part</dt><dd>{formatKqCash(vat.reservedCents)}</dd></div></dl>
    <KqBarChart title="Charges restant dues" items={[{ label: "Analyses", value: lab.outstandingCents, displayValue: formatKqCash(lab.outstandingCents), tone: "gold" }, { label: "Électricité et soins", value: data.electricityOutstandingCents, displayValue: formatKqCash(data.electricityOutstandingCents), tone: "ink" }]} />{lab.overdueCents > 0 ? <p className={styles.overdue}>{formatKqCash(lab.overdueCents)} d’analyses déjà échues.</p> : null}
    <div className={styles.tax}><h3><ReceiptText size={18} aria-hidden="true" /> TVA de jeu · {vat.ratePercent} %</h3><div className={styles.dueRow}><span>Reversement automatique</span><Deadline at={vat.nextSettlementAt} now={now} /></div><small>{formatKqCash(vat.paidCents)} déjà reversés.</small><details className={styles.explanation}><summary>Comment fonctionne la TVA</summary><p>Incluse dans les prix TTC et réservée à chaque vente. Cette réserve est séparée de ta trésorerie : aucun second débit au reversement.</p></details></div>
    <div className={styles.lab}><h3><FlaskConical size={18} aria-hidden="true" /> Analyses laboratoire</h3><dl className={styles.facts}><div><dt>Par session terminée</dt><dd>{formatKqCash(KQ_LAB_ANALYSIS_CENTS)}</dd></div><div><dt>Délai de règlement</dt><dd>30 jours de jeu</dd></div></dl><details className={styles.explanation}><summary>Facturation et prélèvement</summary><p>Une seule analyse par session, quel que soit le nombre de tentes. Paiement sous 30 jours de jeu (5 jours réels), automatique à l’échéance si les fonds suffisent.</p></details>
      {invoices.length ? <ul className={styles.invoices}>{invoices.map((invoice, index) => <li key={invoice.id}><div><strong>Analyse · {formatKqCash(invoice.remainingCents)}</strong><small>Facturée le {dateLabel(invoice.issuedAt)}{invoice.remainingCents < invoice.amountCents ? " · reste à régler" : ""}</small></div><Deadline at={invoice.dueAt} now={now} /><button className={styles.secondary} disabled={busy || data.cashCents < invoice.remainingCents} aria-label={`Régler l’analyse ${index + 1} de ${formatKqCash(invoice.remainingCents)}`} onClick={() => onAsk("Régler l’analyse", `Règlement du solde de l’analyse facturée le ${dateLabel(invoice.issuedAt)}. Cette facture ne sera pas prélevée une seconde fois.`, { action: "pay-lab", invoiceId: invoice.id }, invoice.remainingCents)}>Régler</button></li>)}</ul> : <small>Aucune analyse à régler.</small>}
      {lab.overdueCents > 0 ? <p className={styles.overdue}>Les analyses échues sont remboursées en priorité sur tes prochaines ventes. Avec l’électricité, la retenue est limitée à 50 % de la recette après TVA.</p> : null}
    </div>
  </section> : null;
  const advertisingPanel = <details className={styles.advertising}><summary><Megaphone size={20} aria-hidden="true" /><span>Publicité payante<small>{advertising ? `En cours · fin le ${dateLabel(advertising.endsAt)}` : "Attirer plus de visiteurs"}</small></span></summary>
      <div className={styles.comparison}><KqBarChart title="Gain de fréquentation" items={Object.values(KQ_ADVERTISING).map(ad => ({ label: ad.name, value: ad.boostPercent, displayValue: `+${ad.boostPercent} %`, tone: "teal" }))} /><KqBarChart title="Budget par campagne" items={Object.values(KQ_ADVERTISING).map(ad => ({ label: ad.name, value: ad.costCents, displayValue: formatKqCash(ad.costCents), tone: "gold" }))} /></div>
      <details className={styles.explanation}><summary>Effet sur les ventes</summary><p>Une campagne à la fois augmente la fréquentation et la demande en ligne. Le prix, la qualité et le stock déterminent tes ventes.</p></details>
      {advertising ? <div className={styles.activeAd}><strong>{KQ_ADVERTISING[advertising.kind].name} · +{advertising.boostPercent} % de fréquentation</strong><Deadline at={advertising.endsAt} now={now} />{!active ? <small>Le site est suspendu : le bonus est indisponible, la campagne continue de s’écouler.</small> : null}</div> : !active ? <p className={styles.requirement}>Ouvre ton site pour lancer une campagne.</p> : null}
      <div className={styles.adCards}>{(Object.keys(KQ_ADVERTISING) as Array<keyof typeof KQ_ADVERTISING>).map(kind => {
        const ad = KQ_ADVERTISING[kind];
        const subscriptionEndsFirst = Boolean(shop.paidUntil && Date.parse(shop.paidUntil) < now + ad.durationDays * KQ_GAME_DAY_MS);
        return <article key={kind}><h3>{ad.name}</h3><strong className={styles.adBoost}>+{ad.boostPercent} % <small>de fréquentation</small></strong><p>{ad.durationDays} jours de jeu · {ad.durationDays * 4} h réelles</p><strong>{formatKqCash(ad.costCents)}</strong>{active && !advertising && subscriptionEndsFirst ? <small className={styles.warning}>Ton abonnement arrive à échéance avant la fin de cette campagne.</small> : null}<button className={styles.secondary} disabled={busy || !active || Boolean(advertising) || data.cashCents < ad.costCents} onClick={() => onAsk(`Lancer ${ad.name}`, `+${ad.boostPercent} % de fréquentation pendant ${ad.durationDays} jours de jeu (${ad.durationDays * 4} h réelles). Paiement unique, sans reconduction. ${subscriptionEndsFirst ? "Ton abonnement expire avant la fin : le site doit rester actif pour profiter du bonus." : data.online ? "Les annonces actives continuent à vendre automatiquement, selon leur prix et leur qualité." : "Les ventes restent manuelles."}`, { action: "advertise", kind }, ad.costCents)}>{advertising ? "Une campagne est déjà en cours" : !active ? "Site actif requis" : data.cashCents < ad.costCents ? "Trésorerie insuffisante" : "Lancer la campagne"}</button></article>;
      })}</div>
    </details>;
  const administrativeSettings = <>
    {!data.online ? advertisingPanel : null}
    {business.ledger.length ? <details className={styles.activity}><summary>Derniers mouvements et échéances <ChevronDown size={16} aria-hidden="true" /></summary><ul>{business.ledger.toSorted((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 8).map(entry => <li key={entry.id}><span>{ledgerLabels[entry.kind] ?? "Mouvement de gestion"}<small>{dateLabel(entry.occurredAt)}</small></span><strong>{entry.amountCents ? formatKqCash(Math.abs(entry.amountCents)) : "—"}</strong></li>)}</ul></details> : null}
  </>;
  if (data.online) return <KqOnlineBusiness data={data} now={now} busy={busy} onAsk={onAsk} onOpenShop={onOpenShop} onPrepareStock={onPrepareStock} onViewSales={onViewSales} initialView={initialView} initialUpgradeView={initialUpgradeView} advertising={<div className={styles.settings}>{advertisingPanel}</div>} businessDetails={<div className={styles.settings}>{calendarPanel}{accountingPanel}{administrativeSettings}</div>} />;
  return <section className={styles.panel} aria-label="Calendrier et gestion du commerce">
    {calendarPanel}
    <details id="kq-business-management" className={styles.management} open={expanded}>
      <summary><Store size={24} aria-hidden="true" /><span><strong>{shop.name ?? "Construis ton commerce"}</strong><small>{shop.createdAt ? active ? "Site ouvert · audience, présentation et échéances" : "Site suspendu · réactive tes ventes en ligne" : "Économise pour ouvrir ton site · objectif 1 000 €"}</small></span><ChevronDown className={styles.chevron} size={22} aria-hidden="true" /></summary>
      <div className={styles.content}>
        <div className={styles.columns} data-management-only={!showAccounting}>
          <section className={styles.shop} aria-label="Ton site internet">
            <header><Store size={22} aria-hidden="true" /><h2>{shop.createdAt ? "Ton site internet" : "Ton prochain investissement"}</h2><span className={styles.badge} data-active={active}>{shop.createdAt ? active ? "Ouvert" : "Suspendu" : "À financer"}</span></header>
            {!shop.createdAt ? <>
              <div className={styles.savings}><KqProgressMeter label="Budget de création" value={data.cashCents} max={KQ_SHOP_CREATION_CENTS} valueLabel={`${formatKqCash(data.cashCents)} / ${formatKqCash(KQ_SHOP_CREATION_CENTS)}`} hint={missing ? `Encore ${formatKqCash(missing)}` : "Budget réuni"} tone="gold" /></div>
              <dl className={styles.facts}><div><dt>Création · premier mois inclus</dt><dd>{formatKqCash(KQ_SHOP_CREATION_CENTS)}</dd></div><div><dt>Puis tous les 5 jours réels</dt><dd>{formatKqCash(KQ_SHOP_MONTHLY_CENTS)}</dd></div></dl>
              <details className={styles.explanation}><summary>Développer ton commerce</summary><p>Vends aux boutiques et grossistes pour financer ton site. Il ouvre les ventes au détail. Hébergement et maintenance sont facturés chaque mois de jeu.</p></details>
              {!data.computerOwned ? <div className={styles.requirement}><Monitor size={20} aria-hidden="true" /><p>Il te faut aussi l’ordinateur : achat permanent de 450 €.</p><button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur</button></div> : <p className={styles.good}><Check size={16} aria-hidden="true" /> Ordinateur acheté</p>}
              <ShopNameForm key="create" name={null} busy={busy} canCreate={data.computerOwned && !missing} onAsk={onAsk} now={now} />
            </> : <>
              <strong className={styles.shopName}>{shop.name}</strong>
              <p>{active ? "Tes clients peuvent commander au prix de détail." : "Les ventes en ligne sont suspendues. Tes stocks et le nom de ton shop sont conservés."}</p>
              {shop.paidUntil && active ? <div className={styles.dueRow}><span>{shop.renew ? "Prochain renouvellement · 100 €" : "Accès payé jusqu’au"}</span><Deadline at={shop.paidUntil} now={now} /></div> : null}
              <details className={styles.explanation}><summary>Abonnement · 100 € / 5 jours réels</summary><p>100 € tous les 30 jours de jeu. Si les fonds manquent, le site est suspendu et les nouvelles mensualités s’arrêtent.</p></details>
              {!active ? <><button className={styles.primary} disabled={busy || data.cashCents < KQ_SHOP_MONTHLY_CENTS} onClick={() => onAsk("Réactiver ton site", "100 € réouvrent les commandes pour 30 jours de jeu, soit 5 jours réels. La période commence maintenant.", { action: "renew-shop" }, KQ_SHOP_MONTHLY_CENTS)}>Réactiver · {formatKqCash(KQ_SHOP_MONTHLY_CENTS)}</button>{data.cashCents < KQ_SHOP_MONTHLY_CENTS ? <small>Économise encore {formatKqCash(KQ_SHOP_MONTHLY_CENTS - data.cashCents)} auprès des professionnels.</small> : null}</> : null}
              <div className={styles.renewal}><span>Reconduction automatique <strong>{shop.renew ? "activée" : "désactivée"}</strong></span><button className={styles.secondary} disabled={busy} onClick={() => onAsk(shop.renew ? "Désactiver la reconduction" : "Activer la reconduction", shop.renew ? "La période déjà payée reste ouverte. À son terme, ton site sera suspendu sans nouvelle mensualité." : "À chaque échéance, 100 € seront prélevés si ta trésorerie le permet. Sinon, le site sera suspendu sans accumuler de mensualités.", { action: "shop-renewal", enabled: !shop.renew }, 0)}>{shop.renew ? "Désactiver" : "Activer"}</button></div>
              <details className={styles.rename}><summary>Modifier le nom du shop</summary><ShopNameForm key={shop.name} name={shop.name} busy={busy} canCreate={false} onAsk={onAsk} now={now} /></details>
            </>}
          </section>
          {accountingPanel}
        </div>
        {administrativeSettings}
      </div>
    </details>
  </section>;
}
