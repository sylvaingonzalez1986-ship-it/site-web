"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, type ReactNode, type RefObject } from "react";
import { ArrowRight, Check, ChevronRight, Clock3, Globe2, Leaf, Megaphone, Package, PackageOpen, RefreshCw, ShoppingBag, Sparkles, Sprout, Store, TrendingUp, Truck, Wallet } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqOnlinePackaging } from "@/lib/kanab-quest-online";
import { getKqShopDashboard } from "@/lib/kanab-quest-shop-strategy";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqMerchActivity } from "./KqMerchActivity";
import { KqBuddieFlavors } from "./KqBuddieFlavors";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import styles from "./KqShopOverview.module.css";

type Props = {
  data: KqCommerceSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  now?: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRefresh: () => void;
  onPrepareStock: () => void;
  onViewSales: () => void;
  onViewDemands: () => void;
  onOpenBusiness?: () => void;
  onOpenMerch?: () => void;
  onOpenTreasury?: () => void;
  onOpenCulture?: () => void;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const circuits = {
  online: { name: "En ligne", icon: Globe2 },
  "cbd-shop": { name: "Shops", icon: Store },
  wholesale: { name: "Grossistes", icon: Truck },
};

function Destination({ href, onNavigate, className, children }: {
  href: string; onNavigate?: () => void; className: string; children: ReactNode;
}) {
  return <Link href={href} prefetch={false} className={className} onClick={event => {
    if (onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onNavigate();
    }
  }}>{children}</Link>;
}

export function KqShopOverview({ data, loading, refreshing, error, now, headingRef, onRefresh, onPrepareStock, onViewSales, onViewDemands, onOpenBusiness, onOpenMerch, onOpenTreasury, onOpenCulture }: Props) {
  const id = useId();
  const online = data?.online;
  const dashboard = data ? getKqShopDashboard(data) : null;
  const activity = data ? getKqShopActivity(data) : null;
  const rawLots = data?.rawLots.filter(lot => lot.harvestGrams > 0) ?? [];
  const stocks = data?.stocks.filter(stock => stock.remainingUnits > 0) ?? [];
  const listings = dashboard?.listings ?? [];
  const demand = data?.customerDemand;
  const demandNow = now ?? (demand ? Date.parse(demand.serverNow) : 0);
  const demandActive = Boolean(demand && demandNow < Date.parse(demand.endsAt));
  const hoursRemaining = demand ? Math.max(0, Math.ceil((Date.parse(demand.endsAt) - demandNow) / 3600000)) : 0;
  const recentSales = activity?.receipts.slice(0, 3) ?? [];
  const hasLots = rawLots.length + stocks.length > 0;
  const needsStock = dashboard?.bottleneck.code === "stock" || dashboard?.bottleneck.code === "restock";
  const hasPausedPackets = online?.listings.some(listing => ["paused", "closed"].includes(listing.status) && listing.remainingPackets > 0 && listing.qualityScore >= 5.8);
  const priority = !online
    ? { title: "Ta production reste accessible", description: "Le suivi de la boutique en ligne est indisponible. Tu peux consulter tes lots et les autres circuits de vente.", action: "Voir mes lots", href: "/arene/placard?view=market&section=sales", navigate: onPrepareStock }
    : online.site.active && !listings.length && activity?.merch.available && activity.merch.activeUnits === null
      ? { title: "Vérifie ta collection", description: "Le stock ou son état en vitrine n’est pas confirmé. Retrouve ton atelier avant de choisir la suite.", action: "Voir mon merch", href: "/arene/placard?view=market&section=management", navigate: onOpenMerch ?? onOpenBusiness }
    : online.site.active && !listings.length && (activity?.merch.inventory?.length ?? 0) > 0
      ? { title: activity?.merch.soldOut?.length ? "Prépare la prochaine série" : (activity?.merch.activeUnits ?? 0) > 0 ? "Ta collection est en rayon" : "Expose ta collection", description: activity?.merch.soldOut?.length ? "Une référence est épuisée. Choisis les articles à refabriquer et le budget à engager." : "Retrouve tes articles, choisis ceux à exposer et ajuste les prix dans ton atelier merch.", action: "Gérer mon merch", href: "/arene/placard?view=market&section=management", navigate: onOpenMerch ?? onOpenBusiness }
    : needsStock
      ? hasPausedPackets && !listings.length
        ? { title: "Remets tes paquets en rayon", description: "Des paquets sont déjà prêts dans tes annonces en pause. Retrouve-les pour reprendre les ventes.", action: "Voir mes annonces", href: "/arene/placard?view=market&section=dashboard", navigate: onViewSales }
        : { title: hasLots ? "Fais une place à ta récolte" : "Tout commence par une récolte", description: hasLots ? "Choisis un lot, prépare tes produits et trouve le bon circuit de vente." : "Lance ou retrouve tes cultures. Tes prochaines récoltes viendront remplir les rayons.", action: hasLots ? "Préparer mes produits" : "Voir mes cultures", href: hasLots ? "/arene/placard?view=market&section=sales" : "/arene/placard?view=game", navigate: hasLots ? onPrepareStock : onOpenCulture }
      : { title: dashboard?.bottleneck.title ?? "Développe ta boutique", description: dashboard?.bottleneck.description ?? "Retrouve tes prix, ta communication et les améliorations de ta boutique.", action: !online.site.createdAt ? "Ouvrir ma boutique" : !online.site.active ? "Réactiver ma boutique" : "Développer ma boutique", href: "/arene/placard?view=market&section=management", navigate: onOpenBusiness };

  return <main className={styles.overview} data-screen="overview" data-shop-overview>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Ton commerce · Vue d’ensemble</p><h1 ref={headingRef} data-commerce-view-heading tabIndex={-1}>Ma boutique</h1></div>
      <button type="button" className={styles.refresh} onClick={onRefresh} disabled={loading || refreshing} aria-label="Actualiser le tableau de bord"><RefreshCw size={17} aria-hidden="true" /><span>{refreshing ? "Actualisation…" : "Actualiser"}</span></button>
    </header>
    {error ? <p className={styles.error} role="alert">{error} <button type="button" onClick={onRefresh} disabled={refreshing}>Réessayer</button></p> : null}
    {!data ? <div className={styles.loading} role="status"><Store size={32} aria-hidden="true" /><p>{loading ? "Ouverture de ton tableau de bord…" : "Le tableau de bord n’a pas pu être chargé."}</p></div> : <>
      <section className={styles.hero} aria-label="La prochaine étape de ma boutique">
        <div className={styles.heroCopy}>
          <span className={styles.status} data-active={online?.site.active || undefined}><span aria-hidden="true" />{!online ? "Suivi en ligne indisponible" : !online.site.createdAt ? "Boutique à ouvrir" : online.site.active ? "Boutique ouverte" : "Boutique en pause"}{data.business?.shop.name ? ` · ${data.business.shop.name}` : ""}</span>
          <p className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" />Ta prochaine étape</p>
          <h2>{priority.title}</h2>
          <Destination href={priority.href} onNavigate={priority.navigate} className={styles.primary}>{priority.action}<ArrowRight size={18} aria-hidden="true" /></Destination>
          <details className={styles.heroDetails}><summary>Pourquoi cette étape ?</summary><p>{priority.description}</p></details>
        </div>
        <div className={styles.heroArt}><Image src="/placard/channel-online-sylvain-v2.webp" alt="" fill sizes="(max-width: 600px) 100vw, 400px" priority /><span><Store size={16} aria-hidden="true" />De la récolte au client</span></div>
      </section>

      <div className={styles.metrics} aria-label="Les chiffres de ma boutique">
        <Destination href="/arene/placard?view=treasury&pole=accounting" onNavigate={onOpenTreasury} className={styles.metric}><span className={styles.metricLabel}><Wallet size={18} aria-hidden="true" />Trésorerie</span><strong>{formatKqCash(data.cashCents)}</strong><small>Disponible dans le jeu<ChevronRight size={14} aria-hidden="true" /></small></Destination>
        <button type="button" className={styles.metric} onClick={onPrepareStock}><span className={styles.metricLabel}><Leaf size={18} aria-hidden="true" />Lots en stock</span><strong>{number(rawLots.length + stocks.length)}</strong><small>À préparer ou à vendre<ChevronRight size={14} aria-hidden="true" /></small></button>
        <button type="button" className={styles.metric} onClick={onViewSales}><span className={styles.metricLabel}><Package size={18} aria-hidden="true" />Paquets en rayon</span><strong>{online ? number(dashboard?.remainingPackets ?? 0) : "—"}</strong><small>{!online ? "Suivi indisponible" : !online.site.active ? "Ventes en ligne à l’arrêt" : `${listings.length} annonce${listings.length > 1 ? "s" : ""} active${listings.length > 1 ? "s" : ""}`}<ChevronRight size={14} aria-hidden="true" /></small></button>
        <button type="button" className={styles.metric} data-open-merch onClick={onOpenMerch ?? onOpenBusiness ?? onViewSales}><span className={styles.metricLabel}><ShoppingBag size={18} aria-hidden="true" />Articles merch en rayon</span><strong>{activity?.merch.activeUnits == null ? "—" : number(activity.merch.activeUnits)}</strong><small>{!activity?.merch.available ? "Suivi indisponible" : !online?.site.active ? "Ventes en ligne à l’arrêt" : `${activity.merch.active?.length ?? "—"} références exposées`}<ChevronRight size={14} aria-hidden="true" /></small></button>
      </div>

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby={`${id}-journey`}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Le chemin de tes produits</p><h2 id={`${id}-journey`}>De la récolte à la vente</h2></div></div>
            <div className={styles.visual}><KqAllocationBar label="Où se trouve ton stock ?" items={[
              { label: "Récoltes", value: rawLots.reduce((sum, lot) => sum + lot.harvestGrams, 0), displayValue: `${number(rawLots.reduce((sum, lot) => sum + lot.harvestGrams, 0))} g`, tone: "gold" },
              { label: "Lots préparés", value: stocks.reduce((sum, stock) => sum + stock.remainingUnits / 10, 0), displayValue: `${number(stocks.reduce((sum, stock) => sum + stock.remainingUnits / 10, 0))} g`, tone: "teal" },
              ...(online ? [{ label: "Conditionné", value: online.listings.reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams, 0), displayValue: `${number(online.listings.reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams, 0))} g`, tone: "ink" as const }] : []),
            ]} emptyLabel="Aucun stock pour le moment" />{!online ? <small>Stock conditionné indisponible.</small> : null}</div>
            <ol className={styles.journey}>
              <li><button type="button" onClick={onPrepareStock}><span className={styles.stepIcon}><Sprout size={25} aria-hidden="true" /><b>1</b></span><strong>Préparer</strong><span>{rawLots.length} récolte{rawLots.length > 1 ? "s" : ""} en attente</span><small>Choisir et transformer<ArrowRight size={14} aria-hidden="true" /></small></button></li>
              <li><button type="button" onClick={onPrepareStock}><span className={styles.stepIcon}><PackageOpen size={25} aria-hidden="true" /><b>2</b></span><strong>Mettre en vente</strong><span>{stocks.length} lot{stocks.length > 1 ? "s" : ""} préparé{stocks.length > 1 ? "s" : ""}</span><small>Choisir son circuit<ArrowRight size={14} aria-hidden="true" /></small></button></li>
              <li><button type="button" onClick={onViewSales}><span className={styles.stepIcon}><ShoppingBag size={25} aria-hidden="true" /><b>3</b></span><strong>Suivre les ventes</strong><span>Paquets et commandes</span><small>Gérer les annonces<ArrowRight size={14} aria-hidden="true" /></small></button></li>
            </ol>
          </section>

          <section className={styles.panel} aria-labelledby={`${id}-demands`}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}><TrendingUp size={14} aria-hidden="true" />À saisir au marché</p><h2 id={`${id}-demands`}>Les envies du moment</h2></div><button type="button" className={styles.textButton} onClick={onViewDemands}>Tout voir<ArrowRight size={15} aria-hidden="true" /></button></div>
            {demand ? <>
              <div className={styles.demands}>{demand.requests.map(request => {
                const circuit = circuits[request.channel];
                const Icon = circuit.icon;
                const active = demandActive && request.remainingUnits > 0;
                return <button key={request.id} type="button" className={styles.demand} onClick={onViewDemands} aria-label={`Voir la demande ${circuit.name}`}>
                  <span className={styles.demandTitle}><Icon size={17} aria-hidden="true" />{circuit.name}</span>
                  <KqBuddieFlavors flavorCodes={request.flavorCodes} compact />
                  <strong className={styles.bonus} data-active={active}>{active ? `Jusqu’à +${number(request.bonusPercent)} %` : demandActive ? "Demande satisfaite" : "Période terminée"}</strong>
                  <span className={styles.demandCapacity}><span aria-hidden="true" style={{ width: `${request.capacityUnits > 0 ? Math.max(0, Math.min(100, request.remainingUnits / request.capacityUnits * 100)) : 0}%` }} /></span>
                  <span className={styles.demandHint}>{number(request.remainingUnits / 10)} g restants</span>
                  <span className={styles.demandHint}>Voir les conditions<ChevronRight size={13} aria-hidden="true" /></span>
                </button>;
              })}</div>
              <p className={styles.footnote}><Clock3 size={14} aria-hidden="true" />{demandActive ? `Renouvellement dans ${hoursRemaining} h environ` : "Nouvelles envies en cours d’actualisation"}</p>
            </> : <div className={styles.empty}><TrendingUp size={28} aria-hidden="true" /><p>Les demandes sont momentanément indisponibles. Tes lots restent accessibles à la vente.</p><button type="button" className={styles.textButton} onClick={onViewDemands}>Voir les demandes<ArrowRight size={15} aria-hidden="true" /></button></div>}
          </section>
        </div>

        <div className={styles.sideColumn}>
          {online && dashboard ? <section className={styles.panel} aria-label="Rythme estimé de la boutique"><h2 className={styles.rhythmTitle}>Le rythme des rayons</h2><dl className={styles.rhythm}><div><dt>Fleurs et extraits · paquets / jour</dt><dd>{number(dashboard.ordersPerDay)}</dd></div><div><dt>Merch · articles / jour</dt><dd>{activity?.merch.estimatedUnitsPerDay == null ? "—" : number(activity.merch.estimatedUnitsPerDay)}</dd></div></dl><small>Estimations · {number(dashboard.visitorsPerDay)} visites / jour</small><div className={styles.visual}><KqProgressMeter label="Confiance commerciale" value={online.confidence} max={100} valueLabel={`${number(online.confidence)} / 100`} /></div><details className={styles.explanationDetails}><summary>Lire ces estimations</summary><p>Rythme calculé avec tes prix, ton audience et tes produits actuels. Les campagnes ciblées concernent les récoltes et leurs extraits. Les ventes ne sont pas garanties.</p></details></section> : null}
          <section className={styles.panel} aria-labelledby={`${id}-shelf`}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Ta vitrine en ligne</p><h2 id={`${id}-shelf`}>Fleurs et extraits</h2></div><span className={styles.count}>{online ? listings.length : "—"}</span></div>
            {listings.length ? <ul className={styles.shelf}>{listings.slice(0, 3).map(({ listing }) => <li key={listing.id}><button type="button" onClick={onViewSales}><Image src={getKqOnlinePackaging(listing.packagingCode)?.image ?? "/placard/equipment-sylvain-v1/packaging-kraft.webp"} alt="" width={58} height={68} /><span><strong>{listing.name}</strong><small>{number(listing.remainingPackets)} paquets · {listing.formatGrams} g</small><b>{formatKqCash(listing.packetPriceCents)}<small> / paquet</small></b></span><ChevronRight size={16} aria-hidden="true" /></button></li>)}</ul> : <div className={styles.empty}><PackageOpen size={32} aria-hidden="true" /><strong>{!online ? "Rayon indisponible" : "Ton rayon attend ses produits"}</strong><p>{!online ? "Réessaie d’actualiser pour retrouver tes annonces." : "Prépare des paquets ou reprends une annonce depuis tes ventes."}</p></div>}
            <button type="button" className={styles.fullLink} onClick={onViewSales}>Gérer mes annonces<ArrowRight size={16} aria-hidden="true" /></button>
          </section>

          <KqMerchActivity data={data} compact onOpenMerch={onOpenMerch ?? onOpenBusiness} />

          <Destination href="/arene/placard?view=market&section=management" onNavigate={onOpenBusiness} className={styles.growth}>
            <span className={styles.growthIcon}><Megaphone size={25} aria-hidden="true" /></span><span><strong>Fais grandir ta boutique</strong><small>Prix, communication, site et identité.</small></span><ArrowRight size={18} aria-hidden="true" />
          </Destination>

          {online ? <section className={styles.panel} aria-labelledby={`${id}-sales`}>
            <div className={styles.sectionHeading}><h2 id={`${id}-sales`}>Dernières ventes</h2><Check size={18} aria-hidden="true" /></div>
            {recentSales.length ? <ul className={styles.sales}>{recentSales.map(sale => <li key={sale.id}><span><strong>{sale.name}</strong><small>{number(sale.quantity)} {sale.unitLabel} · {new Date(sale.soldAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small></span><b>{sale.netPayoutCents === null ? "—" : formatKqCash(sale.netPayoutCents)}<small>Versés en trésorerie</small></b></li>)}</ul> : <p className={styles.explanation}>{activity?.receiptsComplete ? "Tes prochaines ventes de fleurs et de merch apparaîtront ici." : "L’historique complet des deux rayons est momentanément indisponible."}</p>}
          </section> : null}
        </div>
      </div>
    </>}
  </main>;
}
