"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, type ReactNode, type RefObject } from "react";
import { ArrowRight, ChevronRight, Leaf, Package, RefreshCw, ShoppingBag, Store, TrendingUp, Wallet } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqOnlinePackaging } from "@/lib/kanab-quest-online";
import { getKqShopDashboard } from "@/lib/kanab-quest-shop-strategy";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { hasKqCommerceProfessionalLot } from "@/lib/kanab-quest-commerce-guidance";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { useKqTutorialApi } from "./KqTutorialApiContext";
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
  onViewSales: (listingId?: string) => void;
  onViewDemands: () => void;
  onOpenBusiness?: () => void;
  onOpenMerch?: () => void;
  onOpenTreasury?: () => void;
  onOpenCulture?: () => void;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
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
  const api = useKqTutorialApi();
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
  const professionalFirst = Boolean(online && !online.site.createdAt && data && hasKqCommerceProfessionalLot(data, now));
  const priority = !online
    ? { title: "Ta production reste accessible", description: "Le suivi de la boutique en ligne est indisponible. Tu peux consulter tes lots et les autres circuits de vente.", action: "Voir mes lots", href: "/arene/placard?view=market&section=sales", navigate: onPrepareStock }
    : professionalFirst
      ? { title: "Choisis le circuit de vente de ton lot", description: "Les grossistes et CBD shops sont accessibles sans site ni ordinateur. Choisis un lot pour comparer les commandes, les conditions et le montant proposé. Tu peux développer la vente en ligne ensuite.", action: "Vendre mes lots", href: "/arene/placard?view=market&section=sales", navigate: onPrepareStock }
    : online.site.active && !listings.length && activity?.merch.available && activity.merch.activeUnits === null
      ? { title: "Vérifie ta collection", description: "Le stock ou son état en vitrine n’est pas confirmé. Retrouve ton atelier avant de choisir la suite.", action: "Voir mes produits dérivés", href: "/arene/placard?view=market&section=management&business=merch", navigate: onOpenMerch ?? onOpenBusiness }
    : online.site.active && !listings.length && (activity?.merch.inventory?.length ?? 0) > 0
      ? { title: activity?.merch.soldOut?.length ? "Prépare la prochaine série" : (activity?.merch.activeUnits ?? 0) > 0 ? "Ta collection est en rayon" : "Expose ta collection", description: activity?.merch.soldOut?.length ? "Une référence est épuisée. Choisis les articles à refabriquer et le budget à engager." : "Retrouve tes articles, choisis ceux à exposer et ajuste les prix dans Commerce → Développer → Produits dérivés.", action: "Gérer mes produits dérivés", href: "/arene/placard?view=market&section=management&business=merch", navigate: onOpenMerch ?? onOpenBusiness }
    : needsStock
      ? hasPausedPackets && !listings.length
        ? { title: "Remets tes paquets en rayon", description: "Des paquets sont déjà prêts dans tes annonces en pause. Retrouve-les pour reprendre les ventes.", action: "Mon stock en vente", href: "/arene/placard?view=market&section=dashboard", navigate: onViewSales }
        : { title: hasLots ? "Fais une place à ta récolte" : "Tout commence par une récolte", description: hasLots ? "Choisis un lot, prépare tes produits et trouve le bon circuit de vente." : "Lance ou retrouve tes cultures. Tes prochaines récoltes viendront remplir les rayons.", action: hasLots ? "Préparer mes produits" : "Voir mes cultures", href: hasLots ? "/arene/placard?view=market&section=sales" : "/arene/placard?view=game", navigate: hasLots ? onPrepareStock : onOpenCulture }
      : { title: dashboard?.bottleneck.title ?? "Développe ta boutique", description: dashboard?.bottleneck.description ?? "Retrouve tes prix, ta communication et les améliorations de ta boutique.", action: !online.site.createdAt ? "Ouvrir ma boutique" : !online.site.active ? "Réactiver ma boutique" : "Développer ma boutique", href: "/arene/placard?view=market&section=management", navigate: onOpenBusiness };

  const activeDemands = demandActive ? demand?.requests.filter(request => request.remainingUnits > 0) ?? [] : [];
  const merchOnly = listings.length === 0 && (activity?.merch.inventory?.length ?? 0) > 0;
  const hasActivity = listings.length > 0 || (activity?.merch.inventory?.length ?? 0) > 0 || recentSales.length > 0;
  const rawGrams = rawLots.reduce((sum, lot) => sum + lot.harvestGrams, 0);
  const preparedGrams = stocks.reduce((sum, stock) => sum + stock.remainingUnits / 10, 0);
  const packagedGrams = online?.listings.reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams, 0);

  return <main className={styles.overview} data-screen="overview" data-shop-overview>
    <header className={styles.heading}>
      <h1 ref={headingRef} data-commerce-view-heading tabIndex={-1}>Ma boutique en bref</h1>
      <button type="button" className={styles.refresh} onClick={onRefresh} disabled={loading || refreshing} aria-label="Actualiser la synthèse"><RefreshCw size={17} aria-hidden="true" /><span>{refreshing ? "Actualisation…" : "Actualiser"}</span></button>
    </header>
    {error ? <p className={styles.error} role="alert">{error} <button type="button" onClick={onRefresh} disabled={refreshing}>Réessayer</button></p> : null}
    {!data ? <div className={styles.loading} role="status"><Store size={32} aria-hidden="true" /><p>{loading ? "Ouverture de ta boutique…" : "La boutique n’a pas pu être chargée."}</p></div> : <>
      <section className={styles.hero} aria-label="La prochaine étape de ma boutique">
        <div className={styles.heroCopy}>
          <span className={styles.status} data-active={online?.site.active || undefined}><span aria-hidden="true" />{!online ? "Suivi en ligne indisponible" : professionalFirst ? "Lots à préparer ou vendre" : !online.site.createdAt ? "Boutique à ouvrir" : online.site.active ? "Boutique ouverte" : "Boutique en pause"}{data.business?.shop.name ? ` · ${data.business.shop.name}` : ""}</span>
          <h2>{priority.title}</h2>
          {professionalFirst ? <p>Sans site ni ordinateur pour les circuits professionnels.</p> : null}
          <Destination href={priority.href} onNavigate={priority.navigate} className={styles.primary}>{priority.action}<ArrowRight size={18} aria-hidden="true" /></Destination>
          <details className={styles.heroDetails}><summary>Pourquoi cette étape ?</summary><p>{priority.description}</p></details>
        </div>
        <div className={styles.heroArt}><Image src="/placard/channel-online-sylvain-v2.webp" alt="" fill sizes="(max-width: 600px) 100vw, 400px" priority /></div>
      </section>

      <div className={styles.metrics} aria-label="Les chiffres de ma boutique">
        <Destination href="/arene/placard?view=treasury&pole=accounting" onNavigate={onOpenTreasury} className={styles.metric}><span className={styles.metricLabel}><Wallet size={18} aria-hidden="true" />Trésorerie</span><strong>{formatKqCash(data.cashCents)}</strong><small>Disponible dans le jeu<ChevronRight size={14} aria-hidden="true" /></small></Destination>
        <button type="button" className={styles.metric} onClick={onPrepareStock}><span className={styles.metricLabel}><Leaf size={18} aria-hidden="true" />Lots à vendre</span><strong>{number(rawLots.length + stocks.length)}</strong><small>Récoltes et produits préparés<ChevronRight size={14} aria-hidden="true" /></small></button>
        {merchOnly ? <button type="button" className={styles.metric} data-open-merch onClick={onOpenMerch ?? onOpenBusiness ?? (() => onViewSales())}><span className={styles.metricLabel}><ShoppingBag size={18} aria-hidden="true" />Produits dérivés</span><strong>{activity?.merch.activeUnits == null ? "—" : number(activity.merch.activeUnits)}</strong><small>{activity?.merch.activeUnits == null ? "Stock indisponible" : !online?.site.active ? "Ventes en ligne à l’arrêt" : "En rayon"}<ChevronRight size={14} aria-hidden="true" /></small></button> : <button type="button" className={styles.metric} onClick={() => onViewSales()}><span className={styles.metricLabel}><Package size={18} aria-hidden="true" />Paquets en rayon</span><strong>{activity?.flowers.activePackets == null ? "—" : number(activity.flowers.activePackets)}</strong><small>{!online ? "Suivi indisponible" : !online.site.active ? "Ventes en ligne à l’arrêt" : `${listings.length} annonce${listings.length > 1 ? "s" : ""} active${listings.length > 1 ? "s" : ""}`}<ChevronRight size={14} aria-hidden="true" /></small></button>}
      </div>

      <button type="button" className={styles.demandShortcut} onClick={onViewDemands}>
        <TrendingUp size={22} aria-hidden="true" /><span><strong>Demandes clients</strong><small>{!demand ? "Suivi indisponible · réessayer" : activeDemands.length ? `${activeDemands.length} demande${activeDemands.length > 1 ? "s" : ""} avec une prime · ${hoursRemaining} h restantes environ` : "Voir les prochains besoins"}</small></span><ArrowRight size={18} aria-hidden="true" />
      </button>

      {listings.length > 0 ? <section className={styles.register} aria-labelledby={`${id}-shelf`}>
        <div className={styles.sectionHeading}><h2 id={`${id}-shelf`}>En vente</h2><button type="button" className={styles.textButton} onClick={() => onViewSales()}>Mon stock en vente<ArrowRight size={15} aria-hidden="true" /></button></div>
        <ul className={styles.shelf}>{listings.slice(0, 3).map(({ listing }) => <li key={listing.id}><button type="button" onClick={() => onViewSales(listing.id)}><Image src={getKqOnlinePackaging(listing.packagingCode)?.image ?? "/placard/equipment-sylvain-v1/packaging-kraft.webp"} alt="" width={58} height={68} /><span><strong>{listing.name}</strong><small>{number(listing.remainingPackets)} paquets · {listing.formatGrams} g</small><b>{formatKqCash(listing.packetPriceCents)}<small> / paquet</small></b></span><ChevronRight size={16} aria-hidden="true" /></button></li>)}</ul>
      </section> : null}

      {activity && (activity.merch.inventory === null || (activity.merch.inventory?.length ?? 0) > 0) ? <Destination href="/arene/placard?view=market&section=management&business=merch" onNavigate={onOpenMerch ?? onOpenBusiness} className={styles.merchShortcut}><ShoppingBag size={22} aria-hidden="true" /><span><strong>Mes produits dérivés</strong><small>{activity.merch.activeUnits === null ? "Stock indisponible · vérifier mon atelier" : `${number(activity.merch.activeUnits)} articles en rayon`}{activity.merch.paused?.length ? ` · ${activity.merch.paused.length} référence${activity.merch.paused.length > 1 ? "s" : ""} hors vitrine` : ""}{activity.merch.soldOut?.length ? ` · ${activity.merch.soldOut.length} épuisée${activity.merch.soldOut.length > 1 ? "s" : ""}` : ""}</small></span><ArrowRight size={18} aria-hidden="true" /></Destination> : null}

      {hasLots || (packagedGrams ?? 0) > 0 ? <details className={styles.analysis} data-stock-details>
        <summary>Où se trouve ma production ?</summary>
        <div className={styles.analysisBody}><KqAllocationBar label="Stock par étape · en grammes" items={[
          { label: "Récoltes", value: rawGrams, displayValue: `${number(rawGrams)} g`, tone: "gold" },
          { label: "Lots préparés", value: preparedGrams, displayValue: `${number(preparedGrams)} g`, tone: "teal" },
          ...(packagedGrams !== undefined ? [{ label: "Conditionné", value: packagedGrams, displayValue: `${number(packagedGrams)} g`, tone: "ink" as const }] : []),
        ]} />{!online ? <p>Stock conditionné indisponible.</p> : null}<button type="button" className={styles.textButton} onClick={onPrepareStock}>Préparer ou vendre un lot<ArrowRight size={15} aria-hidden="true" /></button></div>
      </details> : <details className={styles.analysis}><summary>Comment faire ma première vente ?</summary><ol className={styles.firstSteps}><li>Terminer une culture.</li><li>Ranger la récolte dans <strong>Mes récoltes → Stockage & affinage</strong>, puis {api.isTutorial ? "terminer ses 6 heures d’affinage avec l’horloge fictive de l’essai" : "attendre 6 heures réelles d’affinage, même hors connexion"}.</li><li>Présenter la Fleur d’Arène au jury. Le verdict ouvre la vente ; le stock récolté est conservé.</li><li>Dans <strong>Commerce → Vendre</strong>, choisir le lot et le produit à préparer, puis comparer les circuits : paiement immédiat ou mise en vente en ligne.</li></ol></details>}

      {hasActivity ? <details className={styles.analysis} data-shop-analysis>
        <summary>Rythme et dernières ventes</summary>
        <div className={styles.analysisBody}>
          {online && dashboard ? <section aria-label="Rythme estimé de la boutique"><h2 className={styles.rhythmTitle}>Rythme estimé</h2><dl className={styles.rhythm}><div><dt>Fleurs et extraits · paquets / jour</dt><dd>{number(dashboard.ordersPerDay)}</dd></div><div><dt>Produits dérivés · articles / jour</dt><dd>{activity?.merch.estimatedUnitsPerDay == null ? "—" : number(activity.merch.estimatedUnitsPerDay)}</dd></div></dl><small>Estimations · {number(dashboard.visitorsPerDay)} visites / jour</small><div className={styles.visual}><KqProgressMeter label="Confiance commerciale" value={online.confidence} max={100} valueLabel={`${number(online.confidence)} / 100`} /></div><p className={styles.explanation}>Rythme calculé avec tes prix, ton audience et tes produits actuels. Les ventes ne sont pas garanties.</p></section> : null}
          {recentSales.length ? <section aria-labelledby={`${id}-sales`}><h2 id={`${id}-sales`} className={styles.rhythmTitle}>Dernières ventes</h2><ul className={styles.sales}>{recentSales.map(sale => <li key={sale.id}><span><strong>{sale.name}</strong><small>{number(sale.quantity)} {sale.unitLabel} · {new Date(sale.soldAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small></span><b>{sale.netPayoutCents === null ? "—" : formatKqCash(sale.netPayoutCents)}<small>Versés en trésorerie</small></b></li>)}</ul>{!activity?.receiptsComplete ? <p className={styles.explanation}>Une partie du suivi des ventes est indisponible.</p> : null}<button type="button" className={styles.textButton} onClick={() => onViewSales()}>Mon stock en vente<ArrowRight size={15} aria-hidden="true" /></button></section> : !activity?.receiptsComplete ? <p className={styles.explanation}>Le suivi des ventes est momentanément incomplet.</p> : null}
        </div>
      </details> : null}
    </>}
  </main>;
}
