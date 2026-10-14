"use client";

import Link from "next/link";
import { useId } from "react";
import { ArrowRight, Check, Clock3, Globe2, Leaf, PackageOpen, RefreshCw, Sprout, Star, Store, TrendingUp, Truck } from "lucide-react";
import { KQ_FLAVORS } from "@/lib/kanab-quest-buddie-flavors";
import { getKqCommerceStockQuality, isKqCommerceStockMature, type KqCommerceSnapshot, type KqSalesChannel } from "@/lib/kanab-quest-commerce";
import { getKqCustomerDemandFlavorMatch, getKqOnlineFlowerReferenceCents, type KqCustomerDemandRequest } from "@/lib/kanab-quest-customer-demand";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KqBuddieFlavors } from "./KqBuddieFlavors";
import styles from "./KqCustomerDemandDashboard.module.css";

const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const profileName = (request: KqCustomerDemandRequest) => request.flavorCodes.map(code => KQ_FLAVORS[code].label).join(" · ");
const percent = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const circuits = [
  { code: "online", name: "En ligne", icon: Globe2, description: "Ton prix reste libre" },
  { code: "cbd-shop", name: "Shops", icon: Store, description: "Reprise professionnelle" },
  { code: "wholesale", name: "Grossistes", icon: Truck, description: "Du volume, à tarif réduit" },
] as const;

function timeLeft(remainingMs: number) {
  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
  if (!minutes) return "Période terminée";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""} restantes` : `${minutes} min restantes`;
}

function DemandCard({ request, data, now, expired, busy, onChooseLot, onOpenCulture, onOpenListings }: {
  request: KqCustomerDemandRequest; data: KqCommerceSnapshot; now: number; expired: boolean; busy: boolean;
  onChooseLot: (id: string, channel: KqSalesChannel) => void; onOpenCulture?: () => void; onOpenListings: () => void;
}) {
  const circuit = circuits.find(item => item.code === request.channel)!;
  const Icon = circuit.icon;
  const online = request.channel === "online";
  const basePrice = online ? getKqOnlineFlowerReferenceCents(request.minimumQuality) : request.channel === "cbd-shop" ? 300 : 210;
  const bonusPrice = Math.round(basePrice * (1 + request.bonusPercent / 100));
  const fulfilled = request.remainingUnits <= 0;
  const active = !expired && !fulfilled;
  const match = (varietyCode?: string) => getKqCustomerDemandFlavorMatch(request, varietyCode);
  const matchingStocks = data.stocks.filter(stock => stock.route === "raw" && stock.remainingUnits > 0 && match(stock.varietyCode).matchedFlavorCount > 0)
    .sort((a, b) => match(b.varietyCode).matchedFlavorCount - match(a.varietyCode).matchedFlavorCount);
  const readyStocks = matchingStocks.filter(stock => getKqCommerceStockQuality(stock) >= request.minimumQuality
    && isKqCommerceStockMature(stock, now) && !(stock.storage?.capacity?.overflowUnits ?? 0)
    && (!online || stock.remainingUnits >= 50)
    && (!stock.processingReadyAt || Date.parse(stock.processingReadyAt) <= now));
  const readyUnits = readyStocks.reduce((sum, stock) => sum + stock.remainingUnits, 0);
  const rawLots = data.rawLots.filter(lot => lot.harvestGrams > 0 && match(lot.varietyCode).matchedFlavorCount > 0)
    .sort((a, b) => match(b.varietyCode).matchedFlavorCount - match(a.varietyCode).matchedFlavorCount);
  const rawUnits = rawLots.reduce((sum, lot) => sum + Math.round(lot.harvestGrams * 10), 0);
  const waitingUnits = matchingStocks.reduce((sum, stock) => sum + stock.remainingUnits, 0) - readyUnits;
  const choice = readyStocks[0] ?? matchingStocks[0];
  const rawChoice = rawLots[0];
  const packagedUnits = online ? (data.online?.listings ?? []).filter(listing => listing.route === "raw" && listing.remainingPackets > 0
    && listing.qualityScore >= request.minimumQuality && ["active", "paused", "closed"].includes(listing.status)
    && match(listing.varietyCode).matchedFlavorCount > 0).reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams * 10, 0) : 0;
  const spentUnits = Math.max(0, request.capacityUnits - request.remainingUnits);
  return <article className={styles.card} data-channel={request.channel} data-active={active}>
    <header className={styles.circuit}><span className={styles.circuitIcon}><Icon size={23} aria-hidden="true" /></span><div><h3>{circuit.name}</h3><small>{circuit.description}</small></div><span className={styles.bonus}>{active ? `Jusqu’à +${request.bonusPercent} %` : expired ? "Terminée" : "Satisfaite"}</span></header>
    <div className={styles.variety}><span className={styles.eyebrow}>Arômes recherchés</span><h4>{profileName(request)}</h4><KqBuddieFlavors flavorCodes={request.flavorCodes} /></div>
    <div className={styles.price}><span>{online ? "Repère avec les deux arômes" : "Tarif avec les deux arômes"}</span><strong>{formatKqCash(active ? bonusPrice : basePrice)}<small>/g</small></strong><small>Base : {formatKqCash(basePrice)}/g{active ? ` · jusqu’à +${request.bonusPercent} %` : " · tarif habituel"}</small></div>
    <p className={styles.matchScale}>Aucun arôme : tarif normal.<br />Un arôme : +{active ? percent(request.bonusPercent / 2) : "0"} %. Deux : +{active ? request.bonusPercent : "0"} %.</p>
    <dl className={styles.conditions}><div><dt><Star size={15} aria-hidden="true" />Qualité pour le bonus</dt><dd>{request.minimumQuality.toLocaleString("fr-FR")}/10</dd></div><div><dt><PackageOpen size={15} aria-hidden="true" />{online ? "Demande restante estimée" : "Volume encore bonifié"}</dt><dd>{grams(request.remainingUnits)}</dd></div></dl>
    <progress className={styles.quota} value={Math.min(spentUnits, request.capacityUnits)} max={Math.max(1, request.capacityUnits)} aria-label={`${grams(request.remainingUnits)} encore bonifiés sur ${grams(request.capacityUnits)}`} />
    {online ? <p className={styles.volumeNote}>Volume indicatif, sans vente garantie. Le prix accepté revient au repère habituel après ce volume.</p> : null}
    <div className={styles.stock} data-ready={readyUnits > 0 || packagedUnits > 0}><span>{readyUnits > 0 || packagedUnits > 0 ? <Check size={17} aria-hidden="true" /> : <Leaf size={17} aria-hidden="true" />}<strong>{readyUnits > 0 ? `${grams(readyUnits)} en vrac compatibles` : packagedUnits > 0 ? "Des paquets correspondent à ce profil" : "Aucun lot prêt pour ce profil"}</strong></span>{readyStocks[0] ? <small>{readyStocks[0].name} · {match(readyStocks[0].varietyCode).matchedFlavorCount} arôme{match(readyStocks[0].varietyCode).matchedFlavorCount > 1 ? "s" : ""} commun{match(readyStocks[0].varietyCode).matchedFlavorCount > 1 ? "s" : ""}{active ? ` · +${percent(match(readyStocks[0].varietyCode).bonusPercent)} %` : ""}</small> : null}{packagedUnits > 0 ? <small>{grams(packagedUnits)} déjà conditionnés. Vérifie le prix et l’état de tes annonces.</small> : null}{rawUnits > 0 || waitingUnits > 0 ? <small>{rawUnits > 0 ? `${grams(rawUnits)} de récolte à préparer.` : ""} {waitingUnits > 0 ? `${grams(waitingUnits)} à vérifier : maturité, qualité, quantité ou stockage.` : ""}</small> : readyUnits === 0 && packagedUnits === 0 ? <small>Tes autres lots restent vendables au tarif habituel.</small> : null}</div>
    <div className={styles.action}>{choice || rawChoice ? <button type="button" disabled={busy} onClick={() => onChooseLot(choice?.id ?? `raw:${rawChoice.flowerId}`, request.channel)}>{readyUnits > 0 ? online ? "Préparer une annonce" : "Voir l’offre pour mon lot" : rawChoice && !choice ? "Préparer cette récolte" : "Voir mon lot"}<ArrowRight size={17} aria-hidden="true" /></button> : packagedUnits > 0 ? <button type="button" disabled={busy} onClick={onOpenListings}>Voir mes annonces<ArrowRight size={17} aria-hidden="true" /></button> : <Link prefetch={false} href="/arene/placard?view=game" onClick={event => { if (onOpenCulture) { event.preventDefault(); onOpenCulture(); } }}><Sprout size={17} aria-hidden="true" />Voir mes cultures<ArrowRight size={17} aria-hidden="true" /></Link>}</div>
  </article>;
}

export function KqCustomerDemandDashboard({ data, now, busy = false, onChooseLot, onOpenCulture, onOpenListings, onBrowseLots, onRetry }: {
  data: KqCommerceSnapshot | null; now?: number; busy?: boolean;
  onChooseLot: (id: string, channel: KqSalesChannel) => void; onOpenCulture?: () => void; onOpenListings: () => void; onBrowseLots: () => void; onRetry: () => void;
}) {
  const id = useId();
  const demand = data?.customerDemand;
  if (!data || !demand) return <section className={styles.dashboard} aria-labelledby={`${id}-title`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}><TrendingUp size={17} aria-hidden="true" />Les envies des clients</span><h2 id={`${id}-title`}>Demandes du moment</h2><p>Retrouve ici les profils recherchés en ligne, par les shops et les grossistes.</p></div></header>
    <div className={styles.unavailable} role="status"><Clock3 size={28} aria-hidden="true" /><div><h3>Les demandes sont momentanément indisponibles</h3><p>Tu peux continuer à vendre ta production et consulter tes ventes. Réessaie pour retrouver les envies des clients et leurs bonus.</p><div className={styles.recoveryActions}><button type="button" disabled={busy} onClick={onRetry}><RefreshCw size={17} aria-hidden="true" />{busy ? "Actualisation…" : "Réessayer"}</button><button type="button" disabled={busy} onClick={onBrowseLots}>Vendre ma production<ArrowRight size={17} aria-hidden="true" /></button></div></div></div>
  </section>;
  const current = Math.max(Date.parse(demand.serverNow), now ?? Date.parse(demand.serverNow));
  const expired = current >= Date.parse(demand.endsAt);
  return <section className={styles.dashboard} aria-labelledby={`${id}-title`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}><TrendingUp size={17} aria-hidden="true" />Les envies des clients</span><h2 id={`${id}-title`}>Demandes du moment</h2><p>Un arôme recherché : un bonus. Deux : le meilleur prix. Tes autres récoltes restent vendables.</p><button type="button" className={styles.browse} disabled={busy} onClick={onBrowseLots}><PackageOpen size={16} aria-hidden="true" />Voir tous mes lots à vendre<ArrowRight size={15} aria-hidden="true" /></button></div><span className={styles.timer}><Clock3 size={18} aria-hidden="true" /><strong>{timeLeft(Date.parse(demand.endsAt) - current)}</strong><small>Les envies changent toutes les 72 h réelles</small></span></header>
    <div className={styles.cards}>{circuits.map(circuit => {
      const request = demand.requests.find(item => item.channel === circuit.code);
      return request ? <DemandCard key={request.id} request={request} data={data} now={current} expired={expired} busy={busy} onChooseLot={onChooseLot} onOpenCulture={onOpenCulture} onOpenListings={onOpenListings} /> : null;
    })}</div>
    <p className={styles.rules}>Bonus sur les fleurs entières mûres à la qualité demandée, dans la limite du volume indiqué. Toutes les variétés restent vendables selon les conditions habituelles de chaque circuit. Prix TTC avant les frais du jeu.</p>
    <div className={styles.references} aria-label="Prix de référence des fleurs indoor"><span>Repères en ligne · prix libre</span><strong>7 €/g <small>bonne qualité</small></strong><strong>8 €/g <small>premium · 8,5/10</small></strong><strong>10 €/g <small>exceptionnel · 9,5/10</small></strong></div>
    {demand.upcoming.length > 0 && !expired ? <section className={styles.upcoming} aria-labelledby={`${id}-next`}><header><Clock3 size={18} aria-hidden="true" /><h3 id={`${id}-next`}>Prépare la prochaine période</h3><span>Dans {timeLeft(Date.parse(demand.endsAt) - current).replace(" restantes", "")}</span></header><div className={styles.nextCards}>{demand.upcoming.map(request => <div key={request.id}><span>{circuits.find(circuit => circuit.code === request.channel)?.name} · jusqu’à +{request.bonusPercent} %</span><strong>{profileName(request)}</strong><KqBuddieFlavors flavorCodes={request.flavorCodes} compact /><small>Qualité minimale {request.minimumQuality.toLocaleString("fr-FR")}/10</small></div>)}</div></section> : <p className={styles.nextNotice}><Clock3 size={15} aria-hidden="true" />La prochaine sélection est annoncée 24 h avant la fin de cette période.</p>}
  </section>;
}
