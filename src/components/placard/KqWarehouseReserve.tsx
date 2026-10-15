import { Boxes, Layers3, Package } from "lucide-react";
import { getKqWarehouseDevice, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, KQ_WAREHOUSE_OPTION_FAMILIES } from "@/lib/kanab-quest-warehouse-options";
import type { KqWarehouseSummary } from "@/lib/kanab-quest-warehouse";
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

export function KqWarehouseReserve({ summary }: { summary: KqWarehouseSummary }) {
  const hardware = summary.reserve.map(item => ({ ...item, device: getKqWarehouseDevice(item.code) }));
  const modules = summary.optionReserve.map(item => ({ ...item, option: getKqWarehouseOption(item.code) }));
  const hardwareTotal = hardware.reduce((sum, item) => sum + item.quantity, 0);
  const hardwareRows = DEVICE_GROUPS.map(group => {
    const value = hardware.reduce((sum, item) => sum + (item.device?.kind === group.kind ? item.quantity : 0), 0);
    return { id: group.kind, label: group.label, value, displayValue: `${number(value)} unité${value > 1 ? "s" : ""}`, tone: "green" as const };
  }).filter(row => row.value > 0);
  const moduleRows = KQ_WAREHOUSE_OPTION_FAMILIES.map(family => {
    const value = modules.reduce((sum, item) => sum + (item.option?.family === family.code ? item.quantity : 0), 0);
    return { id: family.code, label: family.label, value, displayValue: `${number(value)} m²`, tone: "amber" as const };
  }).filter(row => row.value > 0);

  return <section className={styles.reserve} aria-label="Matériel et modules en réserve" data-warehouse-reserve>
    <header className={styles.heading}>
      <div><Package size={21} aria-hidden="true" /><h3>Ta réserve</h3></div>
      <p>Ce que tu possèdes est réutilisé avant tout nouvel achat.</p>
    </header>
    <div className={styles.panels}>
      <article className={styles.panel} aria-label="Matériel en réserve">
        <header className={styles.panelHeading}>
          <div><Boxes size={18} aria-hidden="true" /><h4>Matériel disponible</h4></div>
          <strong className={styles.total}>{number(hardwareTotal)} <span>unité{hardwareTotal > 1 ? "s" : ""}</span></strong>
        </header>
        {hardware.length > 0 ? <>
          <WarehouseBars label="Nombre d’équipements en réserve par type" rows={hardwareRows} />
          <details className={styles.details}>
            <summary>Détail du matériel <span>{hardware.length} référence{hardware.length > 1 ? "s" : ""}</span></summary>
            <dl>{hardware.map(item => <div key={item.code}>
              <dt>{item.device?.name ?? item.code}</dt>
              <dd>{number(item.quantity)} <span>unité{item.quantity > 1 ? "s" : ""}</span></dd>
            </div>)}</dl>
          </details>
        </> : <p className={styles.empty}>Aucun équipement en réserve. Le matériel retiré du plan sera conservé ici.</p>}
      </article>
      <article className={styles.panel} aria-label="Modules en réserve">
        <header className={styles.panelHeading}>
          <div><Layers3 size={18} aria-hidden="true" /><h4>Modules disponibles</h4></div>
          <strong className={styles.total}>{moduleRows.length} <span>famille{moduleRows.length > 1 ? "s" : ""}</span></strong>
        </header>
        {modules.length > 0 ? <>
          <p className={styles.caption}>Surface que chaque famille peut équiper. Plusieurs familles peuvent couvrir la même zone.</p>
          <WarehouseBars label="Couverture disponible par famille de modules, en mètres carrés" rows={moduleRows} />
          <details className={styles.details}>
            <summary>Détail des modules <span>{modules.length} référence{modules.length > 1 ? "s" : ""}</span></summary>
            <dl>{modules.map(item => <div key={item.code}>
              <dt>{item.option?.name ?? item.code}</dt>
              <dd>{number(item.quantity)} <span>m²</span></dd>
            </div>)}</dl>
          </details>
        </> : <p className={styles.empty}>Aucun module en réserve. Les modules retirés d’une zone seront conservés ici.</p>}
      </article>
    </div>
  </section>;
}
