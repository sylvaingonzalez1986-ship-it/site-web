"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Globe2, Megaphone, Monitor, Paintbrush, PencilLine, ShoppingBag } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_FEE_PERCENT, KQ_ONLINE_SITE_TIERS } from "@/lib/kanab-quest-online";
import { KqMarketingCampaigns } from "./KqMarketingCampaigns";
import { KqOnlineSiteProgression } from "./KqOnlineSiteProgression";
import { KqMerchWorkshop } from "./KqMerchWorkshop";
import { KqBrandStudio } from "./KqBrandStudio";
import styles from "./KqOnlineBusiness.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const views = [
  { code: "site", label: "Site internet", hint: "Niveaux et abonnement", icon: Globe2 },
  { code: "brand", label: "Studio", hint: "Photos et identité", icon: Paintbrush },
  { code: "merch", label: "Produits dérivés", hint: "Nom et collections", icon: ShoppingBag },
  { code: "marketing", label: "Promouvoir", hint: "Audience et campagnes", icon: Megaphone },
] as const;
export type KqOnlineBusinessTab = typeof views[number]["code"];
type View = KqOnlineBusinessTab;
/** Old callers are mapped to the direct destinations on entry. */
export type KqOnlineBusinessView = View | "upgrades" | "settings" | "activity" | "pricing";
export type KqOnlineUpgradeView = "site" | "brand" | "merch";

function ShopIdentity({ name, canCreate, busy, onAsk }: { name: string | null; canCreate: boolean; busy: boolean; onAsk: Ask }) {
  const helpId = useId();
  const [value, setValue] = useState(name ?? "");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  const valid = [...normalized].length >= 3 && [...normalized].length <= 40 && !/[\p{Cc}\p{Cf}<>]/u.test(value);
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault();
    if (!valid || busy || (!name && !canCreate)) return;
    onAsk(name ? "Renommer ton entreprise" : "Ouvrir ta boutique de base", name ? `Ton entreprise s’appellera « ${normalized} ». Ce nom sera commun à tes produits dérivés et à ta boutique. Le changement est gratuit ; ton audience, tes stocks et tes ventes sont conservés.` : `« ${normalized} » ouvre gratuitement, sans abonnement. Les ventes automatiques supportent 2,5 % de frais en plus de la TVA de jeu. Tu prépareras ensuite tes paquets dans Commerce → Vendre.`, { action: name ? "rename-shop" : "create-shop", name: normalized }, 0);
  }}>
    <label>Nom de ton entreprise<input value={value} onChange={event => setValue(event.target.value)} maxLength={80} placeholder="Ton nom de marque" autoComplete="off" disabled={busy} aria-describedby={helpId} /></label>
    <small id={helpId}>3 à 40 caractères. {value && !valid ? "Ajuste le nom pour continuer." : "Ce nom accompagne tes produits et ta communication."}</small>
    <button className={styles.primary} disabled={busy || !valid || (name ? normalized === name : !canCreate)}>{name ? "Enregistrer le nom" : "Ouvrir gratuitement"}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>;
}

export function KqOnlineBusiness({ data, busy, now, onAsk, onOpenShop, onPrepareStock, onViewSales, view: controlledView, onViewChange, initialView = "site", initialUpgradeView = "site", businessDetails, advertising }: { data: KqCommerceSnapshot; busy: boolean; now: number; onAsk: Ask; onOpenShop: () => void; onPrepareStock?: () => void; onViewSales?: (listingId?: string) => void; view?: KqOnlineBusinessTab; onViewChange?: (view: KqOnlineBusinessTab) => void; initialView?: KqOnlineBusinessView; initialUpgradeView?: KqOnlineUpgradeView; businessDetails?: ReactNode; advertising?: ReactNode }) {
  const id = useId();
  const router = useRouter();
  const availableViews = views;
  const entryView = initialView === "upgrades" ? initialUpgradeView : initialView === "settings" ? "merch" : initialView === "activity" || initialView === "pricing" ? "site" : initialView;
  const [localView, setLocalView] = useState<View>(entryView);
  const view = controlledView ?? localView;
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusEntry = useRef(initialView !== "activity");
  const online = data.online;
  const open = Boolean(data.business?.shop.createdAt);
  useEffect(() => {
    if (!open || !focusEntry.current) return;
    const target = tabs.current[availableViews.findIndex(item => item.code === view)];
    focusEntry.current = false;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, view, availableViews]);
  if (!online || !data.business) return null;
  const shop = data.business.shop;
  const site = online.site;
  const tier = KQ_ONLINE_SITE_TIERS.find(item => item.code === site.tier);
  const hostingCents = shop.monthlyCents === undefined ? tier?.monthlyCents ?? null
    : Number.isSafeInteger(shop.monthlyCents) && shop.monthlyCents >= 0 ? shop.monthlyCents : null;
  const hostingPrice = hostingCents === null ? "Tarif à confirmer" : formatKqCash(hostingCents);
  const hostingDate = site.paidUntil && Number.isFinite(Date.parse(site.paidUntil)) ? date(site.paidUntil) : null;
  const cashKnown = Number.isSafeInteger(data.cashCents) && data.cashCents >= 0;
  const canReactivate = cashKnown && hostingCents !== null && data.cashCents >= hostingCents;
  const hostingApplies = hostingCents === null || hostingCents > 0;
  function selectView(next: View, focus = false) {
    setLocalView(next);
    onViewChange?.(next);
    if (focus) {
      const tab = tabs.current[availableViews.findIndex(item => item.code === next)];
      tab?.focus({ preventScroll: true });
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % availableViews.length
      : event.key === "ArrowLeft" ? (index + availableViews.length - 1) % availableViews.length
        : event.key === "Home" ? 0 : event.key === "End" ? availableViews.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectView(availableViews[next].code, true);
  }
  function develop(section: KqOnlineUpgradeView | "marketing") {
    selectView(section, true);
  }
  return <section className={styles.business} aria-label="Développer ma boutique en ligne">
    <header className={styles.heading}><div><h2>{shop.name ?? "Ta première boutique"}</h2>{open ? <button type="button" className={styles.siteLink} onClick={() => develop("site")}>Site : {tier?.name ?? "niveau à confirmer"}<ArrowRight size={14} aria-hidden="true" /></button> : null}</div><div className={styles.capital}><span className={styles.badge} data-active={site.active}>{open ? site.active ? "Ouverte" : "Suspendue" : "À créer"}</span><span>Trésorerie disponible <strong>{cashKnown ? formatKqCash(data.cashCents) : "À confirmer"}</strong></span></div></header>
    {!open ? <>
      <dl className={styles.metrics}><div><dt>Ouverture</dt><dd>Gratuite</dd></div><div><dt>Abonnement</dt><dd>0 €</dd></div><div><dt>Frais par vente</dt><dd>{number(KQ_ONLINE_FEE_PERCENT)} %</dd></div></dl>
      <details className={styles.explanation}><summary>Comment démarrer</summary><p>Les ventes continuent hors connexion. Prépare tes paquets après l’ouverture ; les premières commandes se gagnent progressivement. Les frais de vente s’ajoutent à la TVA du jeu. Tes ventes aux shops peuvent financer la culture.</p></details>
      {!data.computerOwned ? <div className={styles.notice}><p><Monitor size={17} aria-hidden="true" /> Un ordinateur est nécessaire pour gérer ta boutique.</p><button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button></div> : null}
      <ShopIdentity name={null} canCreate={data.computerOwned} busy={busy} onAsk={onAsk} />
      {businessDetails ? <details className={styles.rename}><summary>Calendrier et suivi du commerce</summary>{businessDetails}</details> : null}
    </> : <>
      <div className={styles.destination}><p>Améliore ton site, tes produits et ta communication. Les prix et les commandes se gèrent dans Mon stock en vente.</p><Link className={styles.secondary} href="/arene/placard?view=market&section=dashboard" prefetch={false} onClick={event => { if (onViewSales) { event.preventDefault(); onViewSales(); } }}>Mon stock en vente<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className={styles.tabs} role="tablist" aria-label="Gérer ma boutique">{availableViews.map((item, index) => {
        const Icon = item.icon;
        return <button type="button" key={item.code} data-shop-view={item.code} ref={node => { tabs.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-label={item.label} aria-describedby={`${id}-${item.code}-hint`} aria-selected={view === item.code} aria-controls={`${id}-panel`} tabIndex={view === item.code ? 0 : -1} onClick={() => selectView(item.code)} onKeyDown={event => navigate(event, index)}><Icon size={18} aria-hidden="true" /><span><strong>{item.label}</strong><small id={`${id}-${item.code}-hint`}>{item.hint}</small></span></button>;
      })}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}-tab`} className={styles.viewPanel} tabIndex={0}>
      <section hidden={view !== "merch"} aria-label="Nom et collections de produits dérivés">
        <details className={styles.identity} data-shop-identity>
          <summary><PencilLine size={20} aria-hidden="true" /><span><small>Ton entreprise</small><strong>{shop.name}</strong></span><b>Modifier le nom</b><ChevronDown size={17} aria-hidden="true" /></summary>
          <div><p>Un nom commun à tes produits dérivés, ta boutique et tes fiches produits. Modification gratuite.</p><ShopIdentity key={shop.name} name={shop.name} canCreate={false} busy={busy} onAsk={onAsk} /></div>
        </details>
        <KqMerchWorkshop data={data} busy={busy} onAsk={onAsk} onOpenBrand={() => develop("brand")} onOpenSite={() => develop("site")} />
      </section>

    <section hidden={view !== "site"} aria-label="Site internet et abonnement">
      {hostingApplies ? site.active ? <details className={styles.hosting} data-online-hosting="active">
        <summary><span><strong>Hébergement actuel · {hostingPrice}</strong><small>Tous les 5 jours réels · reconduction {site.renew ? "activée" : "désactivée"}</small><small>{hostingDate ? `${site.renew ? "Prochaine échéance" : "Payé jusqu’au"} : ${hostingDate}` : "Échéance à confirmer"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className={styles.hostingBody}>
          <p>{site.renew ? "Le tarif sera prélevé à l’échéance si ta trésorerie suffit. Sinon, les ventes en ligne seront suspendues." : "La boutique reste ouverte jusqu’à la fin de la période payée. Les ventes en ligne seront ensuite suspendues."}</p>
          <button type="button" className={styles.secondary} disabled={busy || (hostingCents === null && !site.renew)} data-online-renewal onClick={() => onAsk(site.renew ? "Arrêter la reconduction" : "Activer la reconduction", site.renew ? "La période déjà payée est conservée. Aucun renouvellement ne sera facturé à son terme ; les ventes en ligne seront alors suspendues." : `${hostingPrice} seront prélevés tous les 5 jours réels à partir de la prochaine échéance si les fonds suffisent. Aucun débit immédiat.`, { action: "shop-renewal", enabled: !site.renew }, 0)}>{site.renew ? "Arrêter la reconduction" : "Activer la reconduction"}</button>
        </div>
      </details> : <section className={styles.hostingSuspended} data-online-hosting="suspended" aria-label="Hébergement suspendu">
        <div><h3>Hébergement suspendu</h3><p>Les ventes en ligne sont en pause. Réactive la boutique pour 5 jours réels.</p></div>
        <strong>{hostingPrice}<small>pour 5 jours réels</small></strong>
        <button type="button" className={styles.primary} disabled={busy || !canReactivate} data-online-reactivate onClick={() => {
          if (busy || !canReactivate || hostingCents === null) return;
          onAsk("Réactiver la boutique", `${hostingPrice} pour 5 jours réels, soit 30 jours de jeu. Les paquets encore en vente pourront retrouver leurs clients. La reconduction automatique reste ${site.renew ? "activée" : "désactivée"}.`, { action: "renew-shop" }, hostingCents);
        }}>Réactiver · {hostingPrice}</button>
        {!canReactivate ? <p className={styles.hostingWarning}>{hostingCents === null || !cashKnown ? "Actualise les données pour vérifier le tarif et ta trésorerie." : `Il manque ${formatKqCash(hostingCents - data.cashCents)} dans ta trésorerie.`}</p> : null}
      </section> : null}
      <KqOnlineSiteProgression online={online} cashCents={data.cashCents} currentHostingCents={hostingCents} shopName={shop.name ?? "Ma boutique"} busy={busy} onAsk={onAsk} onOpenBrand={() => develop("brand")} onOpenMarketing={() => develop("marketing")} />
      {businessDetails ? <details className={styles.rename}><summary>Calendrier et suivi du commerce</summary>{businessDetails}</details> : null}
    </section>

    <section hidden={view !== "brand"} aria-label="Studio photo et identité"><KqBrandStudio data={data} busy={busy} onAsk={onAsk} onOpenSite={() => develop("site")} onOpenMerch={() => develop("merch")} /></section>

    <section hidden={view !== "marketing"} aria-label="Faire connaître ma boutique">
      <KqMarketingCampaigns data={data} now={now} busy={busy} onAsk={onAsk} onOpenPricing={listingId => { if (onViewSales) onViewSales(listingId); else router.push("/arene/placard?view=market&section=dashboard"); }} onPrepareStock={onPrepareStock} advertising={advertising} />
    </section>
    </div>
    </>}
  </section>;
}
