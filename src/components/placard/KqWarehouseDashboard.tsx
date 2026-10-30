"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ChevronDown, Coins, Package, Ruler, Sprout } from "lucide-react";
import type { KqWarehouseQuote, KqWarehouseSummary } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { WarehouseBars, WarehouseStackedBar } from "./KqWarehouseCharts";
import { KqWarehouseCosts } from "./KqWarehouseCosts";
import { KqWarehouseReserve } from "./KqWarehouseReserve";
import styles from "./KqWarehouseDashboard.module.css";

const TABS = [
  { id: "performance", label: "Performances", icon: BarChart3 },
  { id: "costs", label: "Coûts", icon: Coins },
  { id: "reserve", label: "Réserve", icon: Package },
] as const;
const mass = (grams: number) => grams >= 1_000 ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg` : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const area = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} m²`;
export type KqWarehouseDashboardTab = (typeof TABS)[number]["id"];

export function KqWarehouseDashboard({ summary, installedSummary, condition, projectedCondition, quote, dirty, migrationCreditCents, storageCapacity, storageReserved, reservedHarvest, salesGramsPerDay, open, onOpenChange, tab: controlledTab, onTabChange }: {
  summary: KqWarehouseSummary;
  installedSummary?: KqWarehouseSummary;
  condition?: KqWarehouseCondition | null;
  projectedCondition?: KqWarehouseCondition | null;
  quote: KqWarehouseQuote | null;
  dirty: boolean;
  migrationCreditCents: number;
  storageCapacity: number;
  storageReserved: number | null | undefined;
  reservedHarvest: number;
  salesGramsPerDay: number | null | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tab?: KqWarehouseDashboardTab;
  onTabChange?: (tab: KqWarehouseDashboardTab) => void;
}) {
  const id = useId();
  const [localTab, setLocalTab] = useState<KqWarehouseDashboardTab>("performance");
  const [localOpen, setLocalOpen] = useState(false);
  const tab = controlledTab ?? localTab;
  const expanded = open ?? localOpen;
  const reservePreviewOnly = dirty && !installedSummary;
  function setTab(value: KqWarehouseDashboardTab) {
    if (controlledTab === undefined) setLocalTab(value);
    onTabChange?.(value);
  }
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const storageKnown = typeof storageReserved === "number";
  const occupied = storageKnown ? Math.max(0, storageReserved) : 0;
  const available = storageKnown ? Math.max(0, storageCapacity - occupied - reservedHarvest) : null;
  const storageShortage = storageKnown ? Math.max(0, occupied + Math.max(reservedHarvest, summary.estimatedHarvestGrams) - storageCapacity) : 0;
  const currentOverflow = storageKnown ? Math.max(0, occupied + reservedHarvest - storageCapacity) : 0;
  const dryingShortage = Math.max(0, summary.estimatedHarvestGrams - summary.dryingCapacityGrams);
  const capacityOccupied = Math.min(storageCapacity, occupied);
  const capacityReserved = Math.min(Math.max(0, storageCapacity - occupied), reservedHarvest);

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    setTab(TABS[target].id);
    buttons.current[target]?.focus();
  }

  return <details className={styles.dashboard} data-warehouse-forecast data-warehouse-dashboard open={expanded} onToggle={event => {
    const nextOpen = event.currentTarget.open;
    if (open === undefined) setLocalOpen(nextOpen);
    if (nextOpen !== expanded) onOpenChange?.(nextOpen);
  }}>
    <summary className={styles.heading}><BarChart3 size={23} aria-hidden="true" /><span><strong>Ton entrepôt en chiffres</strong><small>Performances, coûts et réserve</small></span><ChevronDown className={styles.chevron} size={20} aria-hidden="true" /></summary>
    <div className={styles.body}>
      <div className={styles.tabs} role="tablist" aria-label="Bilan de l’entrepôt">{TABS.map((item, index) => <button key={item.id} ref={node => { buttons.current[index] = node; }} type="button" role="tab" id={`${id}-${item.id}-tab`} aria-controls={`${id}-${item.id}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => navigateTabs(event, index)} onClick={() => setTab(item.id)} data-warehouse-summary-tab={item.id}><item.icon size={17} aria-hidden="true" />{item.label}</button>)}</div>
      {dirty && <p className={styles.draft}>{tab === "reserve" && installedSummary ? "Ta réserve actuelle reste inchangée tant que le plan n’est pas enregistré." : "Aperçu avec tes modifications. Enregistre le plan pour les appliquer."}</p>}
      <div role="tabpanel" id={`${id}-performance-panel`} aria-labelledby={`${id}-performance-tab`} hidden={tab !== "performance"} tabIndex={0}>
        <div className={styles.panels}>
          <article className={styles.panel}>
            <header className={styles.panelHeading}><Sprout size={19} aria-hidden="true" /><h3>Récolte et séchage</h3></header>
            <p className={styles.caption}>Une récolte complète, pour {area(summary.activeAreaM2)} de culture active.</p>
            <WarehouseBars label="Récolte estimée et capacité de séchage, à la même échelle" rows={[
              { id: "harvest", label: "Récolte estimée", value: summary.estimatedHarvestGrams, displayValue: mass(summary.estimatedHarvestGrams), tone: "green" },
              { id: "drying", label: "Capacité de séchage", value: summary.dryingCapacityGrams, displayValue: mass(summary.dryingCapacityGrams), tone: "amber" },
            ]} />
            <p className={dryingShortage > 0 ? styles.warning : styles.status}>{dryingShortage > 0 ? `Il manque ${mass(dryingShortage)} de capacité pour sécher toute la récolte à la fois.` : summary.estimatedHarvestGrams > 0 ? "Toute la récolte peut sécher en une fois." : "Active une zone de culture pour estimer ta récolte."}</p>
          </article>
          <article className={styles.panel} data-warning={storageShortage > 0} data-warehouse-storage-free-grams={available ?? undefined}>
            <header className={styles.panelHeading}><Package size={19} aria-hidden="true" /><h3>Place en stockage</h3></header>
            <p className={styles.storageTotal}><strong>{available === null ? "À établir" : mass(available)}</strong><span>{available === null ? `Occupation inconnue · capacité ${mass(storageCapacity)}` : `libres sur ${mass(storageCapacity)}`}</span></p>
            {available !== null ? <WarehouseStackedBar label="Répartition de la capacité de stockage" segments={[
              { id: "occupied", label: "Contenants occupés", value: capacityOccupied, displayValue: mass(capacityOccupied), note: occupied > capacityOccupied ? `${mass(occupied)} à stocker au total, dont ${mass(occupied - capacityOccupied)} hors capacité.` : "Un contenant entamé occupe toute sa capacité.", tone: "slate" },
              { id: "reserved", label: "Réservé aux cultures", value: capacityReserved, displayValue: mass(capacityReserved), note: reservedHarvest > capacityReserved ? `${mass(reservedHarvest)} réservés au total, dont ${mass(reservedHarvest - capacityReserved)} hors capacité.` : undefined, tone: "amber" },
              { id: "free", label: "Place libre", value: available, displayValue: mass(available), tone: "green" },
            ]} /> : <p className={styles.status}>L’occupation du stock n’est pas disponible pour le moment.</p>}
            {storageShortage > 0 && <p className={styles.warning}>{currentOverflow > 0 ? `Il manque ${mass(currentOverflow)} pour les lots et les cultures déjà réservés.` : `Il manquerait ${mass(storageShortage)} de stockage pour accueillir une récolte complète.`}</p>}
          </article>
          <article className={`${styles.panel} ${styles.surface}`}>
            <header className={styles.panelHeading}><Ruler size={19} aria-hidden="true" /><h3>Surface · {area(summary.totalAreaM2)}</h3></header>
            <WarehouseStackedBar label="Répartition de la surface au sol" segments={[
              { id: "culture", label: "Culture", value: summary.cultureAreaM2, displayValue: area(summary.cultureAreaM2), tone: "green" },
              { id: "drying", label: "Séchage", value: summary.dryingAreaM2, displayValue: area(summary.dryingAreaM2), tone: "amber" },
              { id: "storage", label: "Stockage", value: summary.storageAreaM2, displayValue: area(summary.storageAreaM2), tone: "blue" },
              { id: "free", label: "Libre", value: summary.freeAreaM2, displayValue: area(summary.freeAreaM2), tone: "slate" },
            ]} />
          </article>
        </div>
        <div className={styles.outlets}><p><strong>Débouchés sur 24 h</strong><span>{typeof salesGramsPerDay === "number" ? `Potentiel de vente : ${mass(salesGramsPerDay)}, selon ta clientèle et ton stock prêt à vendre.` : "Les ventes dépendent de ta clientèle et de ton stock prêt à vendre."}</span></p><Link href="/arene/placard?view=market">Voir le marché <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
      <div role="tabpanel" id={`${id}-costs-panel`} aria-labelledby={`${id}-costs-tab`} hidden={tab !== "costs"} tabIndex={0}><KqWarehouseCosts summary={summary} quote={quote} dirty={dirty} migrationCreditCents={migrationCreditCents} /></div>
      <div role="tabpanel" id={`${id}-reserve-panel`} aria-labelledby={`${id}-reserve-tab`} hidden={tab !== "reserve"} tabIndex={0}>
        {reservePreviewOnly && <p className={styles.draft}>{quote ? "La réserve enregistrée n’est pas disponible dans cette vue. Les quantités ci-dessous sont un aperçu du plan." : "La réserve enregistrée n’est pas disponible dans cette vue. Corrige le plan pour prévisualiser la réserve après installation."}</p>}
        {(!reservePreviewOnly || quote) && <KqWarehouseReserve summary={installedSummary ?? summary} condition={reservePreviewOnly ? projectedCondition : condition} mode={reservePreviewOnly ? "preview" : "current"} />}
        {dirty && installedSummary && <details className={styles.reserveProjection} data-warehouse-reserve-projection><summary>Après installation du plan<ChevronDown size={18} aria-hidden="true" /></summary>{quote ? <KqWarehouseReserve summary={summary} condition={projectedCondition} mode="preview" /> : <p className={styles.draft} data-warehouse-reserve-preview-unavailable>Corrige le plan pour prévisualiser la réserve après installation.</p>}</details>}
      </div>
    </div>
  </details>;
}
