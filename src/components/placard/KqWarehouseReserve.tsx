import { Boxes, ChevronDown, Layers3, Package } from "lucide-react";
import type { KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTION_FAMILIES } from "@/lib/kanab-quest-warehouse-options";
import type { KqWarehouseSummary } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { getKqWarehouseReserveView, type KqWarehouseReserveWearGroup } from "@/lib/kanab-quest-warehouse-reserve-view";
import { WarehouseBars } from "./KqWarehouseCharts";
import styles from "./KqWarehouseReserve.module.css";

const DEVICE_GROUPS: { kind: KqWarehouseDevice["kind"]; label: string }[] = [
  { kind: "lighting", label: "Éclairage" },
  { kind: "air", label: "Extraction" },
  { kind: "climate", label: "Climat" },
  { kind: "drying", label: "Séchage" },
  { kind: "storage", label: "Stockage" },
  { kind: "processing", label: "Transformation" },
];

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const units = (quantity: number, module: boolean) => module ? `${number(quantity)} m²` : `${number(quantity)} appareil${quantity > 1 ? "s" : ""}`;

function WearGroups({ groups, module = false }: { groups: KqWarehouseReserveWearGroup[] | null; module?: boolean }) {
  if (groups === null) return <p className={styles.wearNote}>Disponible · usure non suivie pour cet équipement.</p>;
  return <ul className={styles.wearGroups} aria-label="Usure du matériel disponible">{groups.map(group => <li key={group.wearPercent ?? "unknown"} data-warehouse-reserve-wear={group.wearPercent ?? "unknown"}>
    {groups.length > 1 && <span>{units(group.quantity, module)} · </span>}
    {group.wearPercent === null ? "Usure à vérifier" : `Usure : ${number(group.wearPercent)} %`}
  </li>)}</ul>;
}

export function KqWarehouseReserve({ summary, condition, mode = "current" }: { summary: KqWarehouseSummary; condition?: KqWarehouseCondition | null; mode?: "current" | "preview" }) {
  const { hardware, modules } = getKqWarehouseReserveView(summary, condition);
  const hardwareTotal = hardware.reduce((sum, item) => sum + item.quantity, 0);
  const hardwareRows = DEVICE_GROUPS.map(group => {
    const value = hardware.reduce((sum, item) => sum + (item.device?.kind === group.kind ? item.quantity : 0), 0);
    return { id: group.kind, label: group.label, value, displayValue: units(value, false), tone: "green" as const };
  }).filter(row => row.value > 0);
  const moduleRows = KQ_WAREHOUSE_OPTION_FAMILIES.map(family => {
    const value = modules.reduce((sum, item) => sum + (item.option?.family === family.code ? item.quantity : 0), 0);
    return { id: family.code, label: family.label, value, displayValue: `${number(value)} m²`, tone: "amber" as const };
  }).filter(row => row.value > 0);

  return <section className={styles.reserve} aria-label={mode === "current" ? "Matériel et modules actuellement en réserve" : "Aperçu du matériel et des modules après installation"} data-warehouse-reserve data-warehouse-reserve-mode={mode}>
    <header className={styles.heading}>
      <div><Package size={21} aria-hidden="true" /><h3>{mode === "current" ? "Ma réserve actuelle" : "Réserve après installation"}</h3></div>
      <p>{mode === "current" ? "Matériel possédé, disponible pour tes zones. Il est réutilisé avant tout achat et conserve son usure." : "Aperçu du devis : ces changements s’appliqueront après l’enregistrement du plan."}</p>
    </header>
    <div className={styles.panels}>
      <article className={styles.panel} aria-label="Appareils en réserve">
        <header className={styles.panelHeading}>
          <div><Boxes size={18} aria-hidden="true" /><h4>Appareils</h4></div>
          <strong className={styles.total}>{number(hardwareTotal)} <span>disponible{hardwareTotal > 1 ? "s" : ""}</span></strong>
        </header>
        {hardware.length > 0 ? <>
          <ul className={styles.register}>{hardware.map(item => <li key={item.code} data-warehouse-reserve-model={item.code}>
            <div className={styles.modelHeading}><strong>{item.device?.name ?? item.code}</strong><span>{units(item.quantity, false)}</span></div>
            <WearGroups groups={item.wearGroups} />
          </li>)}</ul>
          <details className={styles.details}><summary>Répartition par type<ChevronDown size={17} aria-hidden="true" /></summary><WarehouseBars label="Nombre d’appareils en réserve par type" rows={hardwareRows} /></details>
        </> : <p className={styles.empty}>{mode === "current" ? "Aucun appareil en réserve. Tu peux conserver ici le matériel retiré d’une zone." : "Aucun appareil ne restera en réserve après installation."}</p>}
      </article>
      <article className={styles.panel} aria-label="Modules en réserve">
        <header className={styles.panelHeading}>
          <div><Layers3 size={18} aria-hidden="true" /><h4>Modules au m²</h4></div>
          <strong className={styles.total}>{moduleRows.length} <span>famille{moduleRows.length > 1 ? "s" : ""}</span></strong>
        </header>
        {modules.length > 0 ? <>
          <ul className={styles.register}>{modules.map(item => <li key={item.code} data-warehouse-reserve-model={item.code}>
            <div className={styles.modelHeading}><strong>{item.option?.name ?? item.code}</strong><span>{units(item.quantity, true)}</span></div>
            <WearGroups groups={item.wearGroups} module />
          </li>)}</ul>
          <p className={styles.caption}>Chaque famille peut équiper la même zone. Leurs surfaces ne s’additionnent pas.</p>
          <details className={styles.details}><summary>Couverture par famille<ChevronDown size={17} aria-hidden="true" /></summary><WarehouseBars label="Couverture disponible par famille de modules, en mètres carrés" rows={moduleRows} /></details>
        </> : <p className={styles.empty}>{mode === "current" ? "Aucun module en réserve. Tu peux conserver ici les modules retirés d’une zone." : "Aucun module ne restera en réserve après installation."}</p>}
      </article>
    </div>
  </section>;
}
