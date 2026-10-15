"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Activity, ArrowRight, Camera, Check, Clock3, Globe2, Megaphone, Monitor, Paintbrush, Settings2, Store, Tags } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_SITE_TIERS, KQ_ONLINE_UPGRADES, getKqOnlineUpgradeCost } from "@/lib/kanab-quest-online";
import { KqShopTycoon } from "./KqShopTycoon";
import { KqMarketingCampaigns } from "./KqMarketingCampaigns";
import styles from "./KqOnlineBusiness.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const views = [
  { code: "activity", label: "Activité", icon: Activity },
  { code: "pricing", label: "Prix", icon: Tags },
  { code: "marketing", label: "Communication", icon: Megaphone },
  { code: "upgrades", label: "Améliorations", icon: Paintbrush },
  { code: "settings", label: "Réglages", icon: Settings2 },
] as const;
type View = typeof views[number]["code"];

function ShopIdentity({ name, canCreate, busy, onAsk }: { name: string | null; canCreate: boolean; busy: boolean; onAsk: Ask }) {
  const helpId = useId();
  const [value, setValue] = useState(name ?? "");
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  const valid = [...normalized].length >= 3 && [...normalized].length <= 40 && !/[\p{Cc}\p{Cf}<>]/u.test(value);
  return <form className={styles.form} onSubmit={event => {
    event.preventDefault();
    if (!valid || busy || (!name && !canCreate)) return;
    onAsk(name ? "Renommer ta boutique" : "Ouvrir ta boutique de base", name ? `Ta boutique s’appellera « ${normalized} ». Son audience, sa confiance et ses annonces sont conservées.` : `« ${normalized} » ouvre gratuitement, sans abonnement. Les ventes automatiques supportent 2,5 % de frais en plus de la TVA de jeu. Tu prépareras ensuite tes paquets au Marché.`, { action: name ? "rename-shop" : "create-shop", name: normalized }, 0);
  }}>
    <label>Nom de ta boutique<input value={value} onChange={event => setValue(event.target.value)} maxLength={80} placeholder="Ton nom de marque" autoComplete="off" disabled={busy} aria-describedby={helpId} /></label>
    <small id={helpId}>3 à 40 caractères. {value && !valid ? "Ajuste le nom pour continuer." : "Ce nom accompagne tes produits et ta communication."}</small>
    <button className={styles.primary} disabled={busy || !valid || (name ? normalized === name : !canCreate)}>{name ? "Enregistrer le nom" : "Ouvrir gratuitement"}<ArrowRight size={16} aria-hidden="true" /></button>
  </form>;
}

export function KqOnlineBusiness({ data, busy, now, onAsk, onOpenShop, onPrepareStock, onViewSales, settings, advertising }: { data: KqCommerceSnapshot; busy: boolean; now: number; onAsk: Ask; onOpenShop: () => void; onPrepareStock?: () => void; onViewSales?: () => void; settings?: ReactNode; advertising?: ReactNode }) {
  const id = useId();
  const [view, setView] = useState<View>("activity");
  const [pricingListingId, setPricingListingId] = useState("");
  const [upgradeView, setUpgradeView] = useState<"site" | "brand">("site");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const online = data.online;
  if (!online || !data.business) return null;
  const shop = data.business.shop;
  const site = online.site;
  const tier = KQ_ONLINE_SITE_TIERS.find(item => item.code === site.tier) ?? KQ_ONLINE_SITE_TIERS[0];
  const currentTierIndex = KQ_ONLINE_SITE_TIERS.findIndex(item => item.code === site.tier);
  const nextTier = KQ_ONLINE_SITE_TIERS[currentTierIndex + 1];
  const nextCost = nextTier ? getKqOnlineUpgradeCost(site.tier, nextTier.code) : 0;
  const progression = nextTier ? Math.round((Math.min(1, online.stats.orders / nextTier.minimumOrders) + Math.min(1, online.confidence / nextTier.minimumConfidence) + Math.min(1, data.cashCents / nextCost)) / 3 * 100) : 100;
  const open = Boolean(shop.createdAt);
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command: name, payload }, cost);
  function selectView(next: View, focus = false) {
    setView(next);
    if (focus) {
      const tab = tabs.current[views.findIndex(item => item.code === next)];
      tab?.focus({ preventScroll: true });
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % views.length
      : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length
        : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectView(views[next].code, true);
  }
  function develop(section: "site" | "brand" | "marketing") {
    if (section !== "marketing") setUpgradeView(section);
    selectView(section === "marketing" ? "marketing" : "upgrades", true);
  }
  return <section className={styles.business} aria-label="Développer ma boutique en ligne">
    <header className={styles.heading}><div><span className={styles.eyebrow}><Store size={16} aria-hidden="true" />Ma boutique en ligne</span><h2>{shop.name ?? "Ta première boutique"}</h2>{open ? <button type="button" className={styles.siteLink} onClick={() => develop("site")}>Site : {tier.name}<ArrowRight size={14} aria-hidden="true" /></button> : null}</div><div className={styles.capital}><span className={styles.badge} data-active={site.active}>{open ? site.active ? "Ouverte" : "Suspendue" : "À créer"}</span><span>Trésorerie disponible <strong>{formatKqCash(data.cashCents)}</strong></span></div></header>
    {!open ? <>
      <p>De la première récolte à ta propre marque : construis une boutique qui continue de vendre hors connexion.</p>
      <div className={styles.notice}><p><strong>Le site de base est gratuit.</strong> Aucun abonnement : 2,5 % de frais sur les ventes. Au départ, les premières commandes se gagnent progressivement ; tes ventes aux shops peuvent financer la culture.</p></div>
      {!data.computerOwned ? <div className={styles.notice}><p><Monitor size={17} aria-hidden="true" /> Un ordinateur est nécessaire pour gérer ta boutique.</p><button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button></div> : null}
      <ShopIdentity name={null} canCreate={data.computerOwned} busy={busy} onAsk={onAsk} />
      {settings ? <details className={styles.rename}><summary>Calendrier et réglages de mon activité</summary>{settings}</details> : null}
    </> : <>
      <div className={styles.tabs} role="tablist" aria-label="Gérer ma boutique">{views.map((item, index) => {
        const Icon = item.icon;
        return <button type="button" key={item.code} ref={node => { tabs.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-selected={view === item.code} aria-controls={`${id}-panel`} tabIndex={view === item.code ? 0 : -1} onClick={() => selectView(item.code)} onKeyDown={event => navigate(event, index)}><Icon size={17} aria-hidden="true" />{item.label}</button>;
      })}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}-tab`} className={styles.viewPanel} tabIndex={0}>
      <div hidden={view !== "activity" && view !== "pricing"}>
        <KqShopTycoon data={data} now={now} busy={busy} view={view === "pricing" ? "pricing" : "activity"} listingId={pricingListingId} onSelectListing={setPricingListingId} onOpenPricing={() => selectView("pricing", true)} onAsk={onAsk} onDevelop={develop} onPrepareStock={onPrepareStock} onViewSales={onViewSales} />
      </div>

      <section hidden={view !== "settings"} className={styles.settingsView} aria-label="Réglages de la boutique">
        <h3>Les réglages de ta boutique</h3>
        <ShopIdentity key={shop.name} name={shop.name} canCreate={false} busy={busy} onAsk={onAsk} />
        {settings}
      </section>

      <div hidden={view !== "upgrades"}>
      <div className={styles.upgradeChoice} role="group" aria-label="Choisir les améliorations"><button type="button" aria-pressed={upgradeView === "site"} onClick={() => setUpgradeView("site")}><Globe2 size={17} aria-hidden="true" />Le site internet</button><button type="button" aria-pressed={upgradeView === "brand"} onClick={() => setUpgradeView("brand")}><Paintbrush size={17} aria-hidden="true" />Photos et marque</button></div>

    <section hidden={upgradeView !== "site"} className={styles.section} aria-label="Améliorer et gérer mon site"><h3>La formule de ton site internet</h3><p>Ta formule actuelle est <strong>{tier.name.toLocaleLowerCase("fr-FR")}</strong>. Elle détermine l’efficacité du parcours d’achat et le coût d’hébergement. Les formules suivantes se débloquent avec les commandes et la confiance de tes clients.</p>
      {nextTier ? <div className={styles.nextChapter}><div><small>Pour passer à la {nextTier.name.toLocaleLowerCase("fr-FR")}</small><ul><li data-complete={online.stats.orders >= nextTier.minimumOrders}>{online.stats.orders >= nextTier.minimumOrders ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{number(Math.min(online.stats.orders, nextTier.minimumOrders))}/{nextTier.minimumOrders} commandes</li><li data-complete={online.confidence >= nextTier.minimumConfidence}>{online.confidence >= nextTier.minimumConfidence ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{number(online.confidence)}/{nextTier.minimumConfidence} confiance</li><li data-complete={data.cashCents >= nextCost}>{data.cashCents >= nextCost ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{formatKqCash(nextCost)} à investir</li></ul><progress max={100} value={progression} aria-label={`Conditions pour passer à ${nextTier.name}`} /></div></div> : <p><Check size={16} aria-hidden="true" /> La formule professionnelle est installée.</p>}
      <div className={styles.tiers}>{KQ_ONLINE_SITE_TIERS.map((item, index) => {
        const current = item.code === site.tier;
        const previous = index < currentTierIndex;
        const cost = getKqOnlineUpgradeCost(site.tier, item.code);
        const affordable = data.cashCents >= cost;
        const eligible = online.stats.orders >= item.minimumOrders && online.confidence >= item.minimumConfidence;
        return <article className={styles.card} key={item.code} data-current={current}><span className={styles.tierStep}>{current ? "Formule actuelle" : previous ? "Formule précédente" : "Formule à débloquer"}</span><h4>{item.name}</h4><strong>{current ? "Installée" : previous ? "Déjà dépassée" : cost ? formatKqCash(cost) : "Gratuit"}</strong><small>{item.monthlyCents ? `${formatKqCash(item.monthlyCents)} / mois de jeu · tous les 5 jours réels` : "Sans abonnement · 2,5 % sur les ventes"}</small><p>{item.description}</p>{item.code !== "basic" ? <><small>À offre et audience identiques : +{Math.round((item.conversionMultiplier - 1) * 100)} % de cadence de vente estimée par rapport au site de base.</small><small>{item.minimumOrders} commandes et {item.minimumConfidence}/100 de confiance requis. Premier mois inclus à l’amélioration.</small></> : null}
          {current ? <span className={styles.owned}>{open ? <Check size={16} aria-hidden="true" /> : <Store size={16} aria-hidden="true" />}{open ? "Version actuelle" : "Site de départ"}</span> : <button className={styles.secondary} disabled={busy || !open || previous || !affordable || !eligible} onClick={() => command(`Passer à la ${item.name.toLocaleLowerCase("fr-FR")}`, `${formatKqCash(cost)} pour cette amélioration, premier mois inclus. Puis ${formatKqCash(item.monthlyCents)} tous les 30 jours de jeu (5 jours réels). Le site améliore la conversion sans garantir des commandes.`, "upgrade-site", { tier: item.code }, cost)}>{!open ? "Ouvre d’abord ta boutique" : previous ? "Version précédente" : !eligible ? "Développe d’abord ta clientèle" : !affordable ? "Trésorerie insuffisante" : "Améliorer le site"}</button>}
        </article>;
      })}</div>
      {open && tier.monthlyCents > 0 ? <div className={styles.renewal}><span><strong>{site.active ? "Hébergement de ta boutique" : "Hébergement suspendu"}</strong><small>{site.paidUntil ? `${site.renew ? "Renouvellement" : "Période payée jusqu’au"} : ${date(site.paidUntil)}` : "Aucune période payée"}</small><small>{formatKqCash(tier.monthlyCents)} tous les 5 jours réels.</small></span>{!site.active ? <button className={styles.primary} disabled={busy || data.cashCents < tier.monthlyCents} onClick={() => onAsk("Réactiver la boutique", `${formatKqCash(tier.monthlyCents)} pour 30 jours de jeu, soit 5 jours réels. Les paquets encore en vente pourront retrouver leurs clients.`, { action: "renew-shop" }, tier.monthlyCents)}>Réactiver · {formatKqCash(tier.monthlyCents)}</button> : <button className={styles.secondary} disabled={busy} onClick={() => onAsk(site.renew ? "Désactiver la reconduction" : "Activer la reconduction", site.renew ? "La période déjà payée est conservée. Aucun renouvellement ne sera facturé à son terme." : `${formatKqCash(tier.monthlyCents)} seront prélevés à chaque échéance si les fonds suffisent.`, { action: "shop-renewal", enabled: !site.renew }, 0)}>{site.renew ? "Arrêter la reconduction" : "Activer la reconduction"}</button>}</div> : null}
    </section>

    <section hidden={upgradeView !== "brand"} className={styles.section} aria-label="Photos et identité de marque"><h3>Photos et identité de marque</h3><p>Des investissements permanents pour présenter ce que tu produis. Ils n’ajoutent aucun point à la qualité de tes lots.</p><div className={styles.upgrades}>{KQ_ONLINE_UPGRADES.map(upgrade => {
      const owned = online.upgrades[upgrade.code];
      const Icon = upgrade.code === "photography" ? Camera : Paintbrush;
      return <article key={upgrade.code} className={`${styles.card} ${styles.contract}`} data-current={owned}><span className={styles.contractLabel}><Icon size={22} aria-hidden="true" />{upgrade.code === "photography" ? "Le coin photo" : "L’atelier du graphiste"}</span><h4>{upgrade.name}</h4><strong>{formatKqCash(upgrade.costCents)}</strong><p>{upgrade.description}</p>{owned ? <span className={styles.owned}><Check size={16} aria-hidden="true" /> Déjà installé</span> : <button className={styles.secondary} disabled={busy || !open || data.cashCents < upgrade.costCents} onClick={() => command(upgrade.name, `${upgrade.description} Achat permanent de ${formatKqCash(upgrade.costCents)}.`, "buy-upgrade", { code: upgrade.code }, upgrade.costCents)}>{!open ? "Ouvre d’abord ta boutique" : data.cashCents < upgrade.costCents ? "Trésorerie insuffisante" : "Investir"}</button>}</article>;
    })}</div></section>
    </div>

    <section hidden={view !== "marketing"} aria-label="Faire conna?tre ma boutique">
      <KqMarketingCampaigns data={data} now={now} busy={busy} onAsk={onAsk} onOpenPricing={listingId => { if (listingId) setPricingListingId(listingId); selectView("pricing", true); }} onPrepareStock={onPrepareStock} advertising={advertising} />
    </section>
    </div>
    </>}
  </section>;
}
