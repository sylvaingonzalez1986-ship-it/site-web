"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Camera, Check, Clock3, Megaphone, Package, PackageOpen, Paintbrush, ReceiptText, ShoppingBag, Sparkles, Target, TrendingUp, Users, Zap } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqOnlinePackaging, KQ_ONLINE_MARKETING_MISSIONS } from "@/lib/kanab-quest-online";
import { KQ_MARKETING_CAMPAIGNS } from "@/lib/kanab-quest-marketing";
import { getKqShopDashboard, getKqShopStrategyPlans, type KqShopStrategyPlan } from "@/lib/kanab-quest-shop-strategy";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { getKqStudioLevels } from "@/lib/kanab-quest-studio";
import { KqMerchActivity } from "./KqMerchActivity";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import styles from "./KqShopTycoon.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = {
  data: KqCommerceSnapshot;
  now: number;
  busy: boolean;
  onAsk: Ask;
  onDevelop: (section: "marketing" | "site" | "brand" | "merch") => void;
  view: "activity" | "pricing";
  listingId: string;
  onSelectListing: (id: string) => void;
  onOpenPricing: () => void;
  onPrepareStock?: () => void;
  onViewSales?: () => void;
};
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const timestamp = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const days = (value: number | null) => value === null ? "Pas de débit" : `${number(value)} j`;

function MarketLink({ children, section, onNavigate, className }: { children: React.ReactNode; section: "sales" | "dashboard"; onNavigate?: () => void; className: string }) {
  return <Link prefetch={false} className={className} href={`/arene/placard?view=market&section=${section}`} onClick={event => {
    if (onNavigate) { event.preventDefault(); onNavigate(); }
  }}>{children}</Link>;
}

export function KqShopTycoon({ data, now, busy, view, listingId, onSelectListing, onOpenPricing, onAsk, onDevelop, onPrepareStock, onViewSales }: Props) {
  const id = useId();
  const [strategy, setStrategy] = useState<KqShopStrategyPlan["code"]>("balance");
  const online = data.online;
  const dashboard = getKqShopDashboard(data);
  const activity = getKqShopActivity(data);
  if (!online || !dashboard) return null;
  const listings = online.listings.filter(listing => listing.status === "active" && listing.remainingPackets > 0 && listing.qualityScore >= 5.8);
  const selectedListing = listings.find(listing => listing.id === listingId) ?? listings[0];
  const plans = selectedListing ? getKqShopStrategyPlans(data, selectedListing.id) : [];
  const plan = plans.find(item => item.code === strategy) ?? plans[0];
  const activeMission = online.marketing.active;
  const mission = (activeMission?.version === 2 ? KQ_MARKETING_CAMPAIGNS : KQ_ONLINE_MARKETING_MISSIONS).find(item => item.code === activeMission?.code);
  const preparing = activeMission?.version === 2 && Date.parse(activeMission.launchesAt) > now;
  const remainingHours = activeMission ? Math.max(0, Math.ceil((Date.parse(activeMission.endsAt) - now) / 3600000)) : 0;
  const latestSales = activity.receipts.slice(0, 3);
  const merchInRayon = (activity.merch.activeUnits ?? 0) > 0;
  const hasMerch = (activity.merch.inventory?.length ?? 0) > 0;
  const merchUnknown = activity.merch.available && activity.merch.activeUnits === null;
  const studio = getKqStudioLevels(online);
  const merchPriority = !listings.length && online.site.active && (hasMerch || merchUnknown);
  const priority = merchPriority && merchUnknown ? {
    title: "Vérifie ta collection",
    description: "Le stock ou son état en vitrine n’est pas confirmé. Retrouve ton atelier avant de choisir la suite.",
  } : merchPriority ? {
    title: activity.merch.soldOut?.length ? "Prépare la prochaine série" : merchInRayon ? "Fais vivre ta collection" : "Expose ta collection",
    description: activity.merch.soldOut?.length ? "Une référence est épuisée. Choisis les articles à refabriquer et le budget à engager." : merchInRayon ? "Tes articles sont en vente. Compare leurs prix et leur rythme dans l’atelier merch." : "Des articles sont en stock, hors vitrine. Publie les références que tu souhaites vendre.",
  } : dashboard.bottleneck;
  function pilot(nextId?: string) {
    if (nextId) onSelectListing(nextId);
    onOpenPricing();
  }
  return <div className={styles.tycoon} data-shop-activity>
    <section hidden={view !== "activity"} className={styles.cockpit} aria-label="Pilotage de la boutique">
      <div className={styles.scene} data-running={online.site.active}>
        <Image className={styles.sceneArt} src="/placard/channel-online-sylvain-v2.webp" alt="" fill sizes="(max-width: 760px) 100vw, 740px" />
        <div className={styles.sceneCopy}>
          <span className={styles.status}><span className={styles.statusDot} />{online.site.active ? "Boutique ouverte · ventes automatiques" : "Boutique en pause"}</span>
          <h3>{!online.site.active ? <>Reprends<br />les ventes.</> : !listings.length && merchUnknown ? <>Retrouve<br /><em>ta collection.</em></> : !listings.length && !merchInRayon ? <>Prépare ton<br /><em>prochain rayon.</em></> : <>Tes ventes<br /><em>au quotidien.</em></>}</h3>
          {!online.site.active ? <p>Tes paquets sont conservés. Réactive ton site pour reprendre les commandes.</p> : null}
          {!online.site.active ? <button type="button" className={styles.goldButton} onClick={() => onDevelop("site")}>Réactiver mon site <ArrowRight size={16} aria-hidden="true" /></button>
            : merchPriority ? <button type="button" data-open-merch className={styles.goldButton} onClick={() => onDevelop("merch")}>Gérer ma collection <ArrowRight size={16} aria-hidden="true" /></button>
              : listings.length ? <button type="button" className={styles.goldButton} onClick={() => pilot()}>Piloter mes prix <ArrowRight size={16} aria-hidden="true" /></button>
              : <MarketLink className={styles.goldButton} section="sales" onNavigate={onPrepareStock}>Approvisionner le rayon <ArrowRight size={16} aria-hidden="true" /></MarketLink>}
        </div>
        <div className={styles.equipment} aria-label="Équipement de la boutique">
          <button type="button" onClick={() => onDevelop("brand")} data-owned={studio.photography > 0}><Camera size={15} aria-hidden="true" />Photo <span>Niv. {studio.photography}/3</span></button>
          <button type="button" onClick={() => onDevelop("brand")} data-owned={studio.branding > 0}><Paintbrush size={15} aria-hidden="true" />Marque <span>Niv. {studio.branding}/3</span></button>
          <button type="button" onClick={() => onDevelop("brand")} data-owned={studio.editorial > 0}><ReceiptText size={15} aria-hidden="true" />Récits <span>Niv. {studio.editorial}/3</span></button>
        </div>
      </div>

      <div className={styles.pulse}>
        <div className={styles.sectionTitle}><span className={styles.kicker}><BarChart3 size={15} aria-hidden="true" />Le rythme de tes rayons</span><span className={styles.estimate}>Estimations / jour réel</span></div>
        <ol className={styles.flow} aria-label="Rythme estimé par rayon">
          <li><Users size={21} aria-hidden="true" /><div><strong>{number(dashboard.visitorsPerDay)}</strong><span>visiteurs / jour</span></div></li>
          <li><Package size={21} aria-hidden="true" /><div><strong>{number(dashboard.ordersPerDay)}</strong><span>paquets / jour</span></div></li>
          <li><ShoppingBag size={21} aria-hidden="true" /><div><strong>{activity.merch.estimatedUnitsPerDay === null ? "—" : number(activity.merch.estimatedUnitsPerDay)}</strong><span>articles merch / jour</span></div></li>
        </ol>
        <details className={styles.explanation}><summary>Lire les estimations</summary><p>Les deux rayons utilisent ton audience avec leurs propres règles de conversion. Les campagnes ciblées concernent les récoltes et leurs extraits. Les commandes ne sont pas garanties.</p><p>Contribution des paquets estimée : {formatKqCash(Math.round(dashboard.contributionPerDayCents))} / jour après TVA, frais et emballage, avant culture et charges fixes.</p></details>
        <div className={styles.vitals}>
          <span><Users size={15} aria-hidden="true" /><strong>{number(online.followers)}</strong> abonnés</span>
          <span><Sparkles size={15} aria-hidden="true" /><strong>{number(online.confidence)}/100</strong> confiance</span>
          <span><ReceiptText size={15} aria-hidden="true" /><strong>{number(online.stats.orders)}</strong> paquets vendus</span>
          <span><ShoppingBag size={15} aria-hidden="true" /><strong>{activity.merch.unitsSold === null ? "—" : number(activity.merch.unitsSold)}</strong> articles vendus</span>
        </div>
      </div>
    </section>

    <div hidden={view !== "activity"} className={styles.operations}>
      <div className={styles.rayons}>
      {!listings.length && hasMerch ? <KqMerchActivity data={data} onOpenMerch={() => onDevelop("merch")} /> : null}
      <section className={styles.shelf} aria-labelledby={`${id}-shelf`}>
        <div className={styles.sectionTitle}><div><h3 id={`${id}-shelf`}>Fleurs et extraits</h3></div><span className={styles.stockBadge}><Package size={15} aria-hidden="true" />{dashboard.remainingPackets} paquets en vente</span></div>
        {listings.length ? <div className={styles.products}>{listings.slice(0, 3).map(listing => {
          const estimate = dashboard.listings.find(item => item.listing.id === listing.id);
          return <button type="button" key={listing.id} className={styles.product} onClick={() => pilot(listing.id)} aria-label={`Piloter ${listing.name}`}>
            <span className={styles.packetCount}>×{listing.remainingPackets}</span>
            <Image src={getKqOnlinePackaging(listing.packagingCode)?.image ?? "/placard/equipment-sylvain-v1/packaging-kraft.webp"} width={100} height={100} alt="" />
            <strong>{listing.name}</strong><small>{listing.formatGrams} g · qualité {number(listing.qualityScore)}/10</small>
            <span className={styles.priceTag}>{formatKqCash(listing.packetPriceCents)}<ArrowRight size={14} aria-hidden="true" /></span>
            <small>{estimate ? `${number(estimate.ordersPerDay)} paquet / jour estimé` : "Estimation indisponible"}</small>
          </button>;
        })}</div> : <div className={styles.empty}><PackageOpen size={36} aria-hidden="true" /><strong>{online.listings.length ? "Aucune annonce en vente." : "Les étagères attendent ta récolte."}</strong><p>Prépare des paquets de 5 ou 10 g, choisis ton prix et laisse les ventes se faire au fil du temps.</p></div>}
        <div className={styles.shelfFooter}><MarketLink className={styles.textButton} section="sales" onNavigate={onPrepareStock}>Approvisionner <ArrowRight size={15} aria-hidden="true" /></MarketLink><MarketLink className={styles.textButton} section="dashboard" onNavigate={onViewSales}>{listings.length > 3 ? `Gérer les ${listings.length} annonces` : "Gérer mes annonces"}<ArrowRight size={15} aria-hidden="true" /></MarketLink></div>
      </section>
      {listings.length || !hasMerch ? <KqMerchActivity data={data} onOpenMerch={() => onDevelop("merch")} /> : null}
      </div>

      <aside className={styles.manager} aria-label="Priorités de la boutique">
        <div className={styles.priority}><span className={styles.kicker}><Target size={16} aria-hidden="true" />Ton prochain mouvement</span><h3>{priority.title}</h3>{merchPriority ? <button type="button" data-open-merch className={styles.textButton} onClick={() => onDevelop("merch")}>Ouvrir l’atelier merch <ArrowRight size={15} aria-hidden="true" /></button> : <span className={styles.coverage}><Package size={15} aria-hidden="true" />Stock de paquets au rythme actuel <strong>{days(dashboard.stockDays)}</strong></span>}<details className={styles.explanation}><summary>Pourquoi cette priorité ?</summary><p>{priority.description}</p></details></div>
        <div className={styles.campaign}><button type="button" className={styles.campaignAction} onClick={() => onDevelop("marketing")}>
          <span className={styles.kicker}><Megaphone size={16} aria-hidden="true" />{preparing ? "Campagne récolte en préparation" : activeMission ? "Campagne récolte en cours" : "Communication des récoltes"}</span>
          <strong>{mission?.name ?? "Ta prochaine campagne"}</strong>
          <span>{activeMission ? "Voir la campagne" : "Préparer une campagne"}<ArrowRight size={15} aria-hidden="true" /></span>
        </button>{activeMission ? <KqProgressMeter label={activeMission.version === 2 ? "Commandes satisfaisantes" : "Avancement"} value={activeMission.version === 2 ? activeMission.results.satisfiedOrders : Math.max(0, now - Date.parse(activeMission.startedAt))} max={activeMission.version === 2 ? activeMission.goalOrders : Date.parse(activeMission.endsAt) - Date.parse(activeMission.startedAt)} valueLabel={activeMission.version === 2 ? `${activeMission.results.satisfiedOrders} / ${activeMission.goalOrders}` : `Encore ${remainingHours} h`} hint={remainingHours ? `Bilan dans ${remainingHours} h` : "Bilan en cours"} /> : null}</div>
      </aside>
    </div>

    <section hidden={view !== "pricing"} className={styles.strategy} aria-label="Stratégie commerciale">
      <div className={styles.sectionTitle}><div><h3>Choisir le prix de tes paquets</h3></div><span className={styles.horizon}><Clock3 size={14} aria-hidden="true" />Projection sur 7 jours réels</span></div>
      {selectedListing && plan ? <>
        <div className={styles.lotPicker}><label htmlFor={`${id}-listing`}>Lot à piloter<select id={`${id}-listing`} aria-label="Lot à piloter" disabled={busy} value={selectedListing.id} onChange={event => onSelectListing(event.target.value)}>{listings.map(listing => <option key={listing.id} value={listing.id}>{listing.name} · {listing.formatGrams} g</option>)}</select></label><span>Prix actuel<strong>{formatKqCash(selectedListing.packetPriceCents)}</strong></span><span>Stock disponible<strong>{selectedListing.remainingPackets} paquets</strong></span></div>
        <div className={styles.plans} role="group" aria-label="Choisir une stratégie de prix">{plans.map((item, index) => {
          const selected = item.code === plan.code;
          const Icon = index === 0 ? Zap : index === 1 ? Target : Sparkles;
          return <div key={item.code} className={styles.planOption} data-selected={selected}><button type="button" className={styles.plan} aria-pressed={selected} disabled={busy} onClick={() => setStrategy(item.code)}>
            <span className={styles.planHeading}><Icon size={18} aria-hidden="true" /><strong>{item.name}</strong><span className={styles.radio} aria-hidden="true">{selected ? <Check size={12} /> : null}</span></span>
            <span className={styles.planPrice}>{formatKqCash(item.packetPriceCents)}<small> / paquet</small></span>
            <span className={styles.planDescription}>{item.description}</span>
            <span className={styles.planMetric}><span>Débit estimé</span><strong>{number(item.ordersPerDay)} / jour</strong></span>
            <span className={styles.planMetric}><span>Contribution / paquet*</span><strong>{formatKqCash(item.contributionPerPacketCents)}</strong></span>
          </button><div className={styles.planMeter}><KqProgressMeter label="Satisfaction estimée" value={item.satisfactionScore} max={100} valueLabel={`${number(item.satisfactionScore)} / 100`} tone={item.satisfactionScore >= 75 ? "teal" : "gold"} /></div></div>;
        })}</div>
        <div className={styles.forecast} aria-live="polite" aria-atomic="true">
          <div className={styles.forecastHeading}><TrendingUp size={22} aria-hidden="true" /><div><strong>Si tu choisis « {plan.name} »</strong><small>Projection limitée par le stock et sa durée de vente.</small></div></div>
          <div className={styles.stockForecast}><KqAllocationBar label={`Tes ${number(selectedListing.remainingPackets)} paquets après 7 jours · estimation`} items={[
            { label: "Vendus", value: plan.projectedPackets, displayValue: `≈ ${number(plan.projectedPackets)}`, tone: "teal" },
            { label: "Restants, encore vendables", value: Math.max(0, plan.remainingPackets - plan.atRiskPackets), displayValue: `≈ ${number(Math.max(0, plan.remainingPackets - plan.atRiskPackets))}`, tone: "gold" },
            { label: "Restants, qualité trop basse", value: plan.atRiskPackets, displayValue: `≈ ${number(plan.atRiskPackets)}`, tone: "red" },
          ]} /><div className={styles.forecastTotal}><span>Contribution estimée*</span><strong>{formatKqCash(Math.round(plan.projectedContributionCents))}</strong><small>Avant culture et charges fixes</small></div></div>
          {plan.atRiskPackets > 0 ? <p className={styles.risk}><Clock3 size={16} aria-hidden="true" />Environ {number(plan.atRiskPackets)} paquets risquent de passer sous le seuil de qualité avant d’être vendus sur cette période.</p> : null}
          <div className={styles.apply}><p>{!online.site.active ? "Réactive le site pour reprendre les ventes." : plan.current ? "Ce prix est déjà appliqué à ton annonce." : "Le prix change pour les prochaines ventes. La progression vers la prochaine commande repart de zéro : choisis ton cap avant de l’appliquer."}</p><button type="button" className={styles.goldButton} disabled={busy || !online.site.active || plan.current} onClick={() => onAsk(`Appliquer la stratégie ${plan.name.toLocaleLowerCase("fr-FR")}`, `« ${selectedListing.name} » : ${formatKqCash(selectedListing.packetPriceCents)} → ${formatKqCash(plan.packetPriceCents)} TTC le paquet de ${selectedListing.formatGrams} g. La progression vers la prochaine commande repart de zéro ; les ventes passées restent inchangées. La projection sur 7 jours est indicative et ne garantit aucune vente.`, { action: "online", command: "update-listing", payload: { listingId: selectedListing.id, packetPriceCents: plan.packetPriceCents } }, 0)}>{plan.current ? <><Check size={16} aria-hidden="true" />Prix appliqué</> : <>Appliquer ce prix <ArrowRight size={16} aria-hidden="true" /></>}</button></div>
        </div>
      </> : <div className={styles.emptyStrategy}><Target size={28} aria-hidden="true" /><p>Le banc d’essai s’active avec une annonce en vente. Tu pourras comparer trois stratégies sur tes propres produits.</p><MarketLink className={styles.textButton} section="sales" onNavigate={onPrepareStock}>Préparer mon premier lot <ArrowRight size={15} aria-hidden="true" /></MarketLink></div>}
      <details className={styles.footnote}><summary>Calcul et limites de la projection</summary><p>Contribution après TVA, frais de vente et emballage, avant culture et charges fixes : ce n’est pas le bénéfice ni le versement en trésorerie. Projection à audience et confiance constantes, sans nouvelle campagne ni renouvellement d’hébergement. Le stock, son vieillissement et la fin des campagnes en cours sont pris en compte ; la demande reste partagée entre tes annonces.</p></details>
    </section>

    <details hidden={view !== "activity"} className={styles.activity} aria-labelledby={`${id}-activity`}>
      <summary id={`${id}-activity`}><ReceiptText size={18} aria-hidden="true" /><strong>Dernières commandes</strong><span>{latestSales[0] ? `Dernière vente : ${timestamp(latestSales[0].soldAt)}` : "En attente de la première vente"}</span></summary>
      {latestSales.length ? <ol className={styles.receipts}>{latestSales.map(sale => <li key={sale.id}><span className={styles.receiptIcon}><ShoppingBag size={18} aria-hidden="true" /></span><div><strong>{sale.quantity} × {sale.name}</strong><span>{sale.kind === "merch" ? "Merch" : sale.formatGrams === null ? "Fleurs" : `${sale.formatGrams} g · Fleurs`} · <time dateTime={sale.soldAt}>{timestamp(sale.soldAt)}</time></span></div><span className={styles.receiptAmount}>{sale.netPayoutCents === null ? "—" : `+${formatKqCash(sale.netPayoutCents)}`}<small>versés en trésorerie</small></span></li>)}</ol> : <div className={styles.firstOrder}><ReceiptText size={25} aria-hidden="true" /><p>{activity.receiptsComplete ? "Tes prochaines ventes de fleurs et de merch apparaîtront ici." : "L’historique complet des deux rayons est momentanément indisponible."}</p></div>}
      <MarketLink className={styles.textButton} section="dashboard" onNavigate={onViewSales}>Ouvrir le registre des ventes <ArrowRight size={15} aria-hidden="true" /></MarketLink>
    </details>
  </div>;
}
