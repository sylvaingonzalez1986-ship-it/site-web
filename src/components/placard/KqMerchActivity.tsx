"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqAllocationBar } from "./KqVisuals";
import styles from "./KqMerchActivity.module.css";

const number = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** The same actual inventory is visible in the overview, activity and sales register. */
export function KqMerchActivity({ data, onOpenMerch, compact = false }: {
  data: KqCommerceSnapshot; onOpenMerch?: () => void; compact?: boolean;
}) {
  const { merch } = getKqShopActivity(data);
  const suspended = data.online?.site.active === false;
  const rows = merch.inventory ?? [];
  return <section className={styles.rayon} data-merch-activity data-compact={compact} aria-label="Activité du merch">
    <header className={styles.heading}><div><span><ShoppingBag size={15} aria-hidden="true" />Ta collection CBD</span><h3>Le rayon merch</h3></div>{onOpenMerch ? <button type="button" data-open-merch onClick={onOpenMerch}>Gérer mon merch <ArrowRight size={16} aria-hidden="true" /></button> : null}</header>
    {!merch.available ? <p className={styles.notice}>Le suivi du merch est indisponible. Tes ventes de fleurs restent consultables.</p> : <>
      <dl className={styles.metrics}>
        <div><dt>Articles en rayon</dt><dd>{number(merch.activeUnits)}</dd><small>{merch.activeUnits === null ? "Stock indisponible" : suspended ? "Ventes suspendues" : "Prêts à vendre"}</small></div>
        <div><dt>Articles vendus</dt><dd>{number(merch.unitsSold)}</dd><small>Depuis l’ouverture</small></div>
        <div><dt>Versé en trésorerie</dt><dd>{merch.netRevenueCents === null ? "—" : formatKqCash(merch.netRevenueCents)}</dd><small>Ventes du merch</small></div>
      </dl>
      {rows.length ? <ul className={styles.products}>{rows.map(row => <li key={row.code} data-merch-code={row.code} data-status={row.status}>
        <span className={styles.art} data-art={row.code} aria-hidden="true" />
        <div><strong>{row.product.name}</strong><span>{number(row.quantity)} en stock · {row.priceCents === null ? "Prix indisponible" : formatKqCash(row.priceCents)}</span><small>{row.status === "sold-out" ? "Épuisé · à réapprovisionner" : row.status === "paused" ? "Hors vitrine · à publier" : row.status === "unknown" ? "État indisponible" : suspended ? "En rayon · ventes suspendues" : "En rayon"}</small></div>
      </li>)}</ul> : <p className={styles.notice}>{merch.inventory === null ? "Le détail du stock est indisponible. Retrouve ton atelier pour actualiser le rayon." : "Stickers, affiches, textile… Débloque une collection et prépare ta première série."}</p>}
      {rows.length ? <details className={styles.details}><summary>Stock, rythme et versements</summary>
        {merch.remainingUnits !== null && merch.activeUnits !== null ? <KqAllocationBar label="Répartition des articles en stock" items={[
          { label: "En rayon", value: merch.activeUnits, displayValue: `${number(merch.activeUnits)} articles`, tone: "teal" },
          { label: "Hors vitrine", value: merch.remainingUnits - merch.activeUnits, displayValue: `${number(merch.remainingUnits - merch.activeUnits)} articles`, tone: "gold" },
        ]} emptyLabel="Stock épuisé" /> : <p>Répartition du stock indisponible.</p>}
        <p>{merch.estimatedUnitsPerDay === null ? "Rythme estimé indisponible." : `${number(merch.estimatedUnitsPerDay)} articles / jour estimés au rythme actuel.`} Les ventes dépendent de tes prix, de ton audience et des références exposées. Elles ne sont pas garanties.</p>
        <p>Les versements sont ceux réellement crédités après les retenues de jeu. La fabrication et les collections ont déjà été payées séparément : ce montant n’est pas un bénéfice.</p>
      </details> : null}
    </>}
  </section>;
}
