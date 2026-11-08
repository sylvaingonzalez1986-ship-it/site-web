"use client";

import { ArrowRight } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqAllocationBar } from "./KqVisuals";
import { KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import styles from "./KqMerchActivity.module.css";

const number = (value: number | null) => value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** The same actual inventory is visible in the overview, activity and sales register. */
export function KqMerchActivity({ data, onOpenMerch, compact = false }: {
  data: KqCommerceSnapshot; onOpenMerch?: () => void; compact?: boolean;
}) {
  const { merch } = getKqShopActivity(data);
  const suspended = data.online?.site.active === false;
  const rows = merch.inventory ?? [];
  return <section className={styles.rayon} data-merch-activity data-compact={compact} aria-label="Activité des produits dérivés">
    <header className={styles.heading}><div><h3>Les produits dérivés</h3></div>{onOpenMerch ? <button type="button" data-open-merch onClick={onOpenMerch}>Gérer mes produits dérivés <ArrowRight size={16} aria-hidden="true" /></button> : null}</header>
    {!merch.available ? <p className={styles.notice}>Le suivi des produits dérivés est indisponible. Tes ventes de fleurs restent consultables.</p> : <>
      <dl className={styles.metrics}>
        <div><dt>Articles en rayon</dt><dd>{number(merch.activeUnits)}</dd><small>{merch.activeUnits === null ? "Stock indisponible" : suspended ? "Ventes suspendues" : "Prêts à vendre"}</small></div>
        <div><dt>Articles vendus</dt><dd>{number(merch.unitsSold)}</dd><small>Depuis l’ouverture</small></div>
        <div><dt>Versé en trésorerie</dt><dd>{merch.netRevenueCents === null ? "—" : formatKqCash(merch.netRevenueCents)}</dd><small>Ventes de produits dérivés</small></div>
      </dl>
      {rows.length ? <ul className={styles.products}>{rows.map(row => <li key={row.code} data-merch-code={row.code} data-status={row.status}>
        <span className={styles.art} data-art={row.code} aria-hidden="true" />
        <div><strong>{row.product.name}</strong><span>{number(row.quantity)} en stock · {row.priceCents === null ? "Prix indisponible" : formatKqCash(row.priceCents)}</span><small>{row.status === "sold-out" ? "Épuisé · à réapprovisionner" : row.status === "paused" ? "Hors vitrine · à publier" : row.status === "unknown" ? "État indisponible" : suspended ? "En rayon · ventes suspendues" : "En rayon"}</small></div>
      </li>)}</ul> : <p className={styles.notice}>{merch.inventory === null ? "Le détail du stock est indisponible. Retrouve ton atelier pour actualiser le rayon." : "Stickers, affiches, textile… Débloque une collection et prépare ta première série."}</p>}
      {rows.length ? <details className={styles.details} tabIndex={-1}><summary>Stock, rythme et versements</summary>
        {merch.remainingUnits !== null && merch.activeUnits !== null ? <KqAllocationBar label="Répartition des articles en stock" items={[
          { label: "En rayon", value: merch.activeUnits, displayValue: `${number(merch.activeUnits)} articles`, tone: "teal" },
          { label: "Hors vitrine", value: merch.remainingUnits - merch.activeUnits, displayValue: `${number(merch.remainingUnits - merch.activeUnits)} articles`, tone: "gold" },
        ]} emptyLabel="Stock épuisé" /> : <p>Répartition du stock indisponible.</p>}
        <KqHelpGrid items={[
          { art: "commerce" as const, label: "Rythme estimé", value: merch.estimatedUnitsPerDay === null ? "Indisponible" : `${number(merch.estimatedUnitsPerDay)} articles / jour`, detail: "Prix, audience et vitrine. Ventes non garanties." },
          { art: "help-accounts" as const, label: "Versements", value: "Réellement crédités", detail: "Après les retenues de jeu." },
        ]} /><KqHelpNote>Fabrication et collections payées séparément : les versements ne sont pas un bénéfice.</KqHelpNote>
      </details> : null}
    </>}
  </section>;
}
