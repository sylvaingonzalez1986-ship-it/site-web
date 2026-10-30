"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { getKqAdvertisingMultiplier } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { estimateKqOnlineOffer, getKqOnlineSaleableHours, type KqOnlineListing } from "@/lib/kanab-quest-online";
import { getKqShopStrategyPlans } from "@/lib/kanab-quest-shop-strategy";
import { KqAllocationBar } from "./KqVisuals";
import styles from "./KqListingPricing.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** The only price editor: suggested prices and free entry share one confirmation. */
export function KqListingPricing({ listing, data, busy, onAsk, onCancel }: {
  listing: KqOnlineListing; data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; onCancel: () => void;
}) {
  const id = useId();
  const [price, setPrice] = useState((listing.packetPriceCents / 100).toFixed(2));
  const plans = useMemo(() => getKqShopStrategyPlans(data, listing.id), [data, listing.id]);
  const cents = Math.round(Number(price.replace(",", ".")) * 100);
  const valid = price.trim() !== "" && Number.isSafeInteger(cents) && cents >= 1 && cents <= 1_000_000;
  const online = data.online!;
  const plan = valid ? plans.find(item => item.packetPriceCents === cents) : undefined;
  const forecast = valid ? estimateKqOnlineOffer({
    listingId: listing.id, quality: listing.qualityScore, route: listing.route, varietyCode: listing.varietyCode,
    customerDemand: data.customerDemand, baseUnitCents: listing.baseUnitCents, formatGrams: listing.formatGrams,
    packagingCode: listing.packagingCode, packetPriceCents: cents, reputation: data.reputation, clients: data.clients,
    online, activeListingCount: Math.max(1, online.listings.filter(item => item.status === "active").length),
    advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)),
  }) : null;
  const running = listing.status === "active" && online.site.active && listing.qualityScore >= 5.8;
  const saleableHours = getKqOnlineSaleableHours(listing.qualityScore, listing.packagingCode);
  const risk = running && forecast && (forecast.ordersPerDay <= 0 || listing.remainingPackets / forecast.ordersPerDay * 24 > saleableHours);
  const changed = cents !== listing.packetPriceCents;

  return <form className={styles.editor} aria-label={`Prix de ${listing.name}`} onSubmit={event => {
    event.preventDefault();
    if (!valid || !changed || busy) return;
    onAsk("Modifier le prix de l’annonce", `« ${listing.name} » : ${formatKqCash(listing.packetPriceCents)} → ${formatKqCash(cents)} TTC le paquet de ${listing.formatGrams} g (${formatKqCash(Math.round(cents / listing.formatGrams))}/g). Le nouveau prix s’applique aux prochaines commandes. La progression vers la prochaine commande repart de zéro ; les ventes déjà passées gardent leur prix. Les estimations ne garantissent aucune vente.`, { action: "online", command: "update-listing", payload: { listingId: listing.id, packetPriceCents: cents } }, 0);
  }}>
    <h4>Choisir mon prix</h4>
    {plans.length ? <div className={styles.plans} role="group" aria-label="Stratégies de prix proposées">{plans.map(item => <button key={item.code} type="button" aria-pressed={plan?.code === item.code} disabled={busy} onClick={() => setPrice((item.packetPriceCents / 100).toFixed(2))}>
      <span>{item.name}{plan?.code === item.code ? <Check size={16} aria-hidden="true" /> : null}</span>
      <strong>{formatKqCash(item.packetPriceCents)}<small> / paquet</small></strong>
      <small>{item.description}</small>
    </button>)}</div> : null}
    <label className={styles.price} htmlFor={`${id}-price`}>Prix TTC par paquet (€)<input id={`${id}-price`} type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" required value={price} onChange={event => setPrice(event.target.value)} disabled={busy} aria-describedby={`${id}-effect`} autoFocus /><small>{valid ? `${formatKqCash(Math.round(cents / listing.formatGrams))}/g TTC · tu peux ajuster librement les prix proposés.` : "Saisis un montant entre 0,01 € et 10 000 €."}</small></label>
    {forecast ? <div className={styles.forecast} aria-live="polite" aria-atomic="true">
      <dl><div><dt>{running ? "Commandes estimées / jour réel" : "Commandes en cours"}</dt><dd>{running ? number(forecast.ordersPerDay) : "À l’arrêt"}</dd></div><div><dt>Contribution estimée / paquet</dt><dd>{formatKqCash(forecast.netBeforeProductionCents)}</dd></div><div><dt>Satisfaction estimée</dt><dd>{number(forecast.satisfaction)} / 100</dd></div></dl>
      <p>{forecast.priceLabel} {running ? "La demande est partagée entre tes annonces." : "Le changement de prix ne réactive ni l’annonce ni le site."}</p>
      {risk ? <p className={styles.risk}><Clock3 size={17} aria-hidden="true" />À ce rythme, des paquets risquent de passer sous le seuil de qualité avant d’être vendus.</p> : null}
      <details className={styles.details}><summary>{plan && running ? "Projection sur 7 jours et frais" : "Frais et limites de l’estimation"}</summary>
        {plan && running ? <><KqAllocationBar label={`Tes ${number(listing.remainingPackets)} paquets après 7 jours réels · estimation`} items={[
          { label: "Vendus", value: plan.projectedPackets, displayValue: `≈ ${number(plan.projectedPackets)}`, tone: "teal" },
          { label: "Restants, encore vendables", value: Math.max(0, plan.remainingPackets - plan.atRiskPackets), displayValue: `≈ ${number(Math.max(0, plan.remainingPackets - plan.atRiskPackets))}`, tone: "gold" },
          { label: "Restants, qualité trop basse", value: plan.atRiskPackets, displayValue: `≈ ${number(plan.atRiskPackets)}`, tone: "red" },
        ]} /><p>Contribution estimée sur cette période : <strong>{formatKqCash(Math.round(plan.projectedContributionCents))}</strong>, avant culture et charges fixes.</p></> : null}
        <dl className={styles.breakdown}><div><dt>TVA de jeu estimée / paquet</dt><dd>−{formatKqCash(Math.round(cents / 6))}</dd></div><div><dt>Frais du site / paquet</dt><dd>−{formatKqCash(forecast.feeCents)}</dd></div><div><dt>Emballage déjà acheté / paquet</dt><dd>−{formatKqCash(forecast.packagingCostCents)}</dd></div></dl>
        <p>La contribution déduit TVA, frais et emballage ; elle ne déduit ni la culture ni les charges fixes. Ce n’est ni un bénéfice ni le versement en trésorerie. Les projections conservent l’audience et la confiance actuelles, tiennent compte du stock, du vieillissement et de la fin des campagnes, sans nouvelle campagne ni renouvellement d’hébergement.</p>
      </details>
    </div> : null}
    <p id={`${id}-effect`} className={styles.effect}>La progression vers la prochaine commande repart de zéro. Les ventes déjà passées gardent leur prix.</p>
    <div className={styles.actions}><button className={styles.apply} disabled={busy || !valid || !changed}>{!changed ? "Prix actuel" : "Appliquer ce prix"}<ArrowRight size={16} aria-hidden="true" /></button><button type="button" disabled={busy} onClick={onCancel}>Fermer</button></div>
  </form>;
}
