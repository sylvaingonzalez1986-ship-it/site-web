"use client";

import { BrickWall, Fan, Package, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { KQ_WAREHOUSE_CATALOG } from "@/lib/kanab-quest-warehouse-catalog";
import type { KqWarehousePartition, KqWarehouseServiceZone, KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import styles from "./KqWarehouse.module.css";

export type WarehouseCellKind = "culture" | "storage" | "drying" | "partition";
const CHOICES = [
  { kind: "culture", label: "Culture", detail: "Plantes et éclairage", Icon: Sprout },
  { kind: "storage", label: "Stockage", detail: "Bocaux et réserves", Icon: Package },
  { kind: "drying", label: "Séchage", detail: "Filets et matériel", Icon: Fan },
  { kind: "partition", label: "Paroi", detail: "Créer des pièces", Icon: BrickWall },
] as const;

export function KqWarehouseCellMenu({ cell, kind, zone, partition, removing, disabled, error, review, dimensions, onClose, onChoose, onUpdateZone, onUpdatePartition, onMove, onRemove }: {
  cell: { x: number; y: number } | null;
  kind?: WarehouseCellKind;
  zone?: KqWarehouseZone | KqWarehouseServiceZone;
  partition?: KqWarehousePartition;
  removing?: boolean;
  disabled: boolean;
  error: string;
  review?: ReactNode;
  dimensions: { columns: number; rows: number };
  onClose: () => void;
  onChoose: (kind: WarehouseCellKind) => void;
  onUpdateZone: (patch: Partial<KqWarehouseZone & KqWarehouseServiceZone>) => void;
  onUpdatePartition: (patch: Partial<Pick<KqWarehousePartition, "x" | "y" | "axis" | "length">>) => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  const deviceKind = kind === "culture" ? "lighting" : kind;
  const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === deviceKind && device.purchasable !== false);
  return <AppDialog open={!!cell} onClose={onClose} title={removing ? "Retirer la paroi" : kind === "partition" ? "Aménager une paroi" : kind ? "Aménager la case" : "Choisir un aménagement"}
    className={styles.zoneDialog} bodyClassName={styles.cellMenu} dialogProps={{ "data-warehouse-cell-menu": true, "data-cell-menu-mode": kind ? "preview" : "choose" }}>
    {cell && <p>Colonne {cell.x + 1}, ligne {cell.y + 1} · {zone ? `${zone.width} × ${zone.height} m` : "Case de 1 m × 1 m"}</p>}
    {!kind && <div className={styles.cellChoices}>{CHOICES.map(({ kind, label, detail, Icon }) => <button type="button" className={styles.secondary} key={kind} data-warehouse-cell-choice={kind} disabled={disabled} onClick={() => onChoose(kind)}>
      <Icon size={28} aria-hidden="true" /><strong>{label}</strong><span>{detail}</span>
    </button>)}</div>}
    {zone && <>
      <label className={styles.field}>{kind === "culture" ? "Éclairage" : "Matériel"}<select aria-label="Matériel de la case" disabled={disabled} value={"kind" in zone ? zone.deviceCode : zone.lightingCode} onChange={event => onUpdateZone("kind" in zone ? { deviceCode: event.target.value } : { lightingCode: event.target.value })}>
        {devices.map(device => <option key={device.code} value={device.code}>{device.name}</option>)}
      </select></label>
      <details><summary>Agrandir cette zone</summary><div className={styles.dimensions}>
        <label className={styles.field}>Largeur (m)<input type="number" min="1" max={dimensions.columns - zone.x} step="1" value={zone.width} disabled={disabled} onChange={event => onUpdateZone({ width: Number(event.target.value) })} /></label>
        <label className={styles.field}>Profondeur (m)<input type="number" min="1" max={dimensions.rows - zone.y} step="1" value={zone.height} disabled={disabled} onChange={event => onUpdateZone({ height: Number(event.target.value) })} /></label>
      </div></details>
      <button type="button" className={styles.secondary} disabled={disabled} onClick={onMove}>Déplacer sur le plan</button>
    </>}
    {partition && <>
      <p>La paroi passe au milieu des cases. Laisse une ouverture pour entrer dans chaque pièce.</p>
      <div className={styles.cellWallLength}>
        <button type="button" className={styles.secondary} aria-label="Raccourcir la paroi d’un mètre" disabled={disabled || partition.length <= 1} onClick={() => onUpdatePartition({ length: partition.length - 1 })}>− 1 m</button>
        <output data-warehouse-wall-length>{partition.length} m</output>
        <button type="button" className={styles.secondary} aria-label="Allonger la paroi d’un mètre" disabled={disabled || partition.length >= (partition.axis === "x" ? dimensions.columns - partition.x : dimensions.rows - partition.y)} onClick={() => onUpdatePartition({ length: partition.length + 1 })}>+ 1 m</button>
      </div>
      <p>{partition.axis === "x" ? "Horizontale" : "Verticale"}</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.secondary} data-warehouse-wall-rotate disabled={disabled} onClick={() => onUpdatePartition({ axis: partition.axis === "x" ? "y" : "x" })}>Tourner 90°</button>
        <button type="button" className={styles.secondary} disabled={disabled} onClick={onMove}>Déplacer sur le plan</button>
        <button type="button" className={styles.danger} data-warehouse-wall-remove disabled={disabled} onClick={onRemove}>Retirer la paroi</button>
      </div>
    </>}
    {removing && <p>La paroi sera retirée après confirmation.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {review}
  </AppDialog>;
}
