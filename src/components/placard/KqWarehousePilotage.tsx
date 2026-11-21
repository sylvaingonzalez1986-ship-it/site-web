import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, BrushCleaning, Check, CircleAlert, Droplets, Factory, Fan, Leaf, Package, Ruler, Shield, Sprout, Wind, Zap } from "lucide-react";
import { KQ_STAGES } from "@/lib/kanab-quest-game";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import type { KqWarehouseSummary } from "@/lib/kanab-quest-warehouse";
import { warehouseCultureStage, type KqWarehouseCultureSummary } from "./KqWarehouseCulture";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import styles from "./KqWarehousePilotage.module.css";

export const WAREHOUSE_MODULES = [
  { id: "production", label: "Cultures", icon: Sprout, room: "culture" },
  { id: "cleaning", label: "Nettoyage", icon: BrushCleaning },
  { id: "security", label: "Sécurité", icon: Shield },
  { id: "ventilation", label: "Ventilation", icon: Fan },
  { id: "irrigation", label: "Irrigation", icon: Droplets },
  { id: "inputs", label: "Intrants", icon: Leaf },
  { id: "drying", label: "Séchage", icon: Wind, room: "drying" },
  { id: "storage", label: "Stockage", icon: Package, room: "storage" },
  { id: "processing", label: "Atelier", icon: Factory, room: "processing" },
] as const;

export type KqWarehouseModule = (typeof WAREHOUSE_MODULES)[number]["id"];
export type KqWarehouseFloorModule = Exclude<KqWarehouseModule, "drying" | "storage" | "processing">;
const MODULE_GUIDE_TARGETS: Partial<Record<KqWarehouseModule, string>> = {
  production: "zones next-open",
  ventilation: "air coverage",
  security: "camera alarm subscription security",
  processing: "trim processing",
};
export type KqWarehouseAlert = {
  id: string;
  level: "urgent" | "soon" | "info";
  title: string;
  detail: string;
  action: string;
  module: KqWarehouseModule;
  zoneId?: string;
};

const area = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} m²`;
export const warehouseMass = (grams: number) => grams >= 1_000
  ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
  : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;

export function WarehouseModules({ id, active, disabled, onOpen }: { id: string; active: KqWarehouseModule; disabled: boolean; onOpen: (module: KqWarehouseModule) => void }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = WAREHOUSE_MODULES.length;
    const next = event.key === "ArrowRight" ? (index + 1) % count : event.key === "ArrowLeft" ? (index + count - 1) % count
      : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onOpen(WAREHOUSE_MODULES[next].id);
    buttons.current[next]?.focus();
  }
  return <nav className={styles.modules} aria-label="Activités de l’entrepôt" role="tablist">
    {WAREHOUSE_MODULES.map((item, index) => <button type="button" role="tab" key={item.id}
      ref={node => { buttons.current[index] = node; }} id={`${id}-${item.id}-tab`} aria-controls={`${id}-module-panel`}
      aria-selected={active === item.id} tabIndex={active === item.id ? 0 : -1} disabled={disabled}
      data-warehouse-module={item.id} data-warehouse-room={"room" in item ? item.room : undefined} data-warehouse-action={item.id === "cleaning" ? "cleaning" : undefined}
      data-sylvain-target={active === item.id ? undefined : MODULE_GUIDE_TARGETS[item.id] ?? item.id}
      onClick={() => onOpen(item.id)} onKeyDown={event => onKeyDown(event, index)}>
      <item.icon size={18} aria-hidden="true" /> <span>{item.label}</span>
    </button>)}
  </nav>;
}

export function WarehouseMetrics({ summary, count, stock, stockFree, disabled, onSurface, onProduction, onStorage, onCosts }: {
  summary: KqWarehouseSummary;
  count: number;
  stock: number | null | undefined;
  stockFree: number | null;
  disabled: boolean;
  onSurface: () => void;
  onProduction: () => void;
  onStorage: () => void;
  onCosts: () => void;
}) {
  const metrics = [
    { id: "surface", label: "Surface aménagée", value: `${summary.allocatedAreaM2} / ${area(summary.totalAreaM2)}`, note: `${area(summary.activeAreaM2)} de culture active`, icon: Ruler, action: onSurface },
    { id: "production", label: "Cultures en cours", value: count, note: count === 0 ? "Aucun cycle lancé" : "Voir les étapes", icon: Sprout, action: onProduction },
    { id: "storage", label: "Récoltes en stock", value: typeof stock === "number" ? warehouseMass(stock) : "Indisponible", note: stockFree === null ? "Capacité libre à établir" : `${warehouseMass(stockFree)} de place libre`, icon: Package, action: onStorage },
    { id: "costs", label: "Charges / cycle", value: formatKqCash(summary.operatingCostCents), note: "Énergie et fournitures estimées", icon: Zap, action: onCosts },
  ];
  return <div className={styles.metrics} aria-label="Synthèse de l’entrepôt">
    {metrics.map(metric => <button type="button" data-warehouse-metric={metric.id} key={metric.id} disabled={disabled} onClick={metric.action}>
      <span className={styles.metricLabel}><metric.icon size={15} aria-hidden="true" />{metric.label}</span>
      <strong>{metric.value}</strong><small>{metric.note}</small><ArrowRight className={styles.metricArrow} size={15} aria-hidden="true" />
    </button>)}
  </div>;
}

const alertLabels = { urgent: "À traiter", soon: "À prévoir", info: "Information" } as const;

export function WarehousePriorities({ alerts, ready, disabled, nextAction, onOpen }: {
  alerts: KqWarehouseAlert[]; ready: boolean; disabled: boolean; nextAction?: ReactNode; onOpen: (alert: KqWarehouseAlert) => void;
}) {
  const item = (alert: KqWarehouseAlert) => <li key={alert.id} data-warehouse-alert={alert.id} data-level={alert.level}>
    <div><small>{alertLabels[alert.level]}</small><strong>{alert.title}</strong><p>{alert.detail}</p></div>
    <button type="button" className={styles.control} disabled={disabled} onClick={() => onOpen(alert)}>{alert.action}<ArrowRight size={15} aria-hidden="true" /></button>
  </li>;
  return <section aria-label="Priorités" className={styles.contextSection}>
    <h3>Priorités</h3>
    {alerts.length ? <><ul className={styles.alertList}>{alerts.slice(0, 2).map(item)}</ul>
      {alerts.length > 2 && <details><summary>{alerts.length - 2} autre{alerts.length > 3 ? "s" : ""} priorité{alerts.length > 3 ? "s" : ""}</summary><ul className={styles.alertList}>{alerts.slice(2).map(item)}</ul></details>}</>
      : <p className={styles.health}>{ready ? <Check size={19} aria-hidden="true" /> : <CircleAlert size={19} aria-hidden="true" />}{ready ? "Aucune intervention à prévoir." : "Aucune alerte relevée sur le plan. Consulte les modules pour les échéances."}</p>}
    {nextAction}
  </section>;
}

export function WarehouseSurface({ summary, onOpen }: { summary: KqWarehouseSummary; onOpen: (module: KqWarehouseModule) => void }) {
  const stations = summary.allocatedAreaM2 - summary.cultureAreaM2 - summary.dryingAreaM2 - summary.storageAreaM2;
  return <section className={styles.contextSection} aria-label="Occupation de l’entrepôt">
    <h3>Surface au sol</h3>
    <KqAllocationBar label={`${area(summary.totalAreaM2)} au total`} items={[
      { label: "Culture", value: summary.cultureAreaM2, displayValue: area(summary.cultureAreaM2), tone: "teal", onSelect: () => onOpen("production") },
      { label: "Séchage", value: summary.dryingAreaM2, displayValue: area(summary.dryingAreaM2), tone: "gold", onSelect: () => onOpen("drying") },
      { label: "Stockage", value: summary.storageAreaM2, displayValue: area(summary.storageAreaM2), tone: "ink", onSelect: () => onOpen("storage") },
      ...(stations > 0 ? [{ label: "Postes et manutention", value: stations, displayValue: area(stations), tone: "red" as const }] : []),
      { label: "Sol libre", value: summary.freeAreaM2, displayValue: area(summary.freeAreaM2), tone: "ink", muted: true },
    ]} />
    <p>{area(summary.allocatedAreaM2)} aménagés, dont {area(summary.activeAreaM2)} de culture active.</p>
  </section>;
}

export function WarehouseProduction({ runs, lots, selectedZoneId, labelZone, onSelectZone, onSelectLot, official, children }: {
  runs: readonly KqWarehouseCultureSummary[]; lots?: KqStorageSnapshot["lots"]; selectedZoneId: string | null;
  labelZone: (id: string) => string; onSelectZone: (id: string) => void; onSelectLot: (id: string) => void; official?: boolean; children?: ReactNode;
}) {
  const curing = lots?.filter(lot => lot.projection.stage === "curing") ?? [];
  return <section className={styles.contextSection} aria-label="Étapes de production" data-warehouse-production
    data-sylvain-run={official && runs.length > 0 ? runs[0].runId : undefined} data-sylvain-target={official && runs.length > 0 ? "next" : undefined} tabIndex={-1}>
    <h3>Étapes de production</h3>
    {runs.length === 0 && curing.length === 0 && <p>Aucune étape en cours dans cet entrepôt.</p>}
    {runs.length + curing.length > 0 && <ul className={styles.timeline}>
      {runs.map(run => <li key={run.runId}>
        <KqProgressMeter label={run.zoneId ? labelZone(run.zoneId) : "Culture"} value={run.stageIndex + 1} max={KQ_STAGES.length}
          valueLabel={warehouseCultureStage(run)} hint={`Étape ${run.stageIndex + 1} sur ${KQ_STAGES.length}`} />
        {run.zoneId && <button type="button" data-warehouse-stage-zone={run.zoneId} className={styles.control} aria-pressed={selectedZoneId === run.zoneId}
          onClick={() => onSelectZone(run.zoneId!)}>Localiser<ArrowRight size={14} aria-hidden="true" /></button>}
      </li>)}
      {curing.map(lot => <li key={lot.flowerId}>
        {Number.isFinite(lot.projection.progressPercent) ? <KqProgressMeter label={`${lot.varietyName} · Affinage`} value={lot.projection.progressPercent} max={100}
          valueLabel={`${lot.projection.progressPercent.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`} tone="gold" /> : <strong>{lot.varietyName} · Affinage</strong>}
        {Number.isFinite(Date.parse(lot.projection.readyAt)) && <time dateTime={lot.projection.readyAt}>Prêt le {new Date(lot.projection.readyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>}
        <button type="button" className={styles.control} onClick={() => onSelectLot(lot.flowerId)}>Suivre le lot<ArrowRight size={14} aria-hidden="true" /></button>
      </li>)}
    </ul>}
    {children}
  </section>;
}
