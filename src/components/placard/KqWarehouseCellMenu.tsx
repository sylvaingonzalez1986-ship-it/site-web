"use client";

import type { ReactNode } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import type { KqWarehousePartition } from "@/lib/kanab-quest-warehouse";
import styles from "./KqWarehouse.module.css";

export function KqWarehouseCellMenu({ cell, partition, removing, disabled, error, review, dimensions, onClose, onUpdatePartition, onMove, onRemove }: {
  cell: { x: number; y: number } | null;
  partition?: KqWarehousePartition;
  removing?: boolean;
  disabled: boolean;
  error: string;
  review?: ReactNode;
  dimensions: { columns: number; rows: number };
  onClose: () => void;
  onUpdatePartition: (patch: Partial<Pick<KqWarehousePartition, "x" | "y" | "axis" | "length">>) => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  return <AppDialog open={!!cell} onClose={onClose} title={removing ? "Retirer la paroi" : "Aménager une paroi"}
    className={styles.zoneDialog} bodyClassName={styles.cellMenu} dialogProps={{ "data-warehouse-cell-menu": true, "data-cell-menu-mode": "preview" }}>
    {cell && <p>Colonne {cell.x + 1}, ligne {cell.y + 1}</p>}
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
