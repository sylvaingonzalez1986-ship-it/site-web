"use client";

import { BrickWall, Package, Sprout, Wind } from "lucide-react";
import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { KQ_WAREHOUSE_CATALOG } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseDimensions } from "@/lib/kanab-quest-warehouse";
import { KqWarehousePlanQuote } from "../KqWarehousePlanQuote";
import type { useInteriorWarehouse } from "./useInteriorWarehouse";
import type { InteriorObject } from "./interior-types";
import styles from "./InteriorExperience.module.css";

export type WarehouseBuildCell = { x: number; y: number };
type Warehouse = ReturnType<typeof useInteriorWarehouse>;
const CHOICES = [
  { kind: "culture", label: "Culture", detail: "Une case de culture", Icon: Sprout },
  { kind: "storage", label: "Stockage", detail: "Bocaux et réserves", Icon: Package },
  { kind: "drying", label: "Séchage", detail: "Matériel de séchage", Icon: Wind },
  { kind: "partition", label: "Paroi", detail: "Construire mètre par mètre", Icon: BrickWall },
] as const;

function OpenActivity({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  const navigate = useDialogNavigation();
  return <button type="button" onClick={() => navigate(onOpen)}>{children}</button>;
}

export function WarehouseBuildMenu({ open, cell, selected, warehouse, onClose, onNavigate, onReload }: {
  open: boolean; cell: WarehouseBuildCell | null; selected?: InteriorObject; warehouse: Warehouse;
  onClose: () => void; onNavigate: (href: string) => void; onReload: () => void;
}) {
  const { snapshot, draft, item, pending, dirty, uncertain, conflict } = warehouse;
  const frozen = pending || uncertain || conflict;
  const partition = draft?.partitions?.find(partition => partition.id === warehouse.selectedId);
  const removing = dirty && !item && selected?.kind === "partition";
  const dimensions = getKqWarehouseDimensions(snapshot?.state);
  const title = dirty ? removing ? "Retirer la paroi" : item?.kind === "partition" ? "Construire une paroi" : "Aménager la case"
    : selected ? selected.label : cell ? `Aménager · colonne ${cell.x + 1}, ligne ${cell.y + 1}` : "Choisir un aménagement";
  const kind = item?.kind;
  const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === (kind === "culture" ? "lighting" : kind) && device.purchasable !== false);

  return <AppDialog open={open} onClose={onClose} title={title} className={`${styles.dialog} ${styles.buildDialog}`} dialogProps={{ "data-warehouse-build-menu": true, "data-build-mode": dirty ? "preview" : selected ? "occupied" : "choose" }}>
    {!dirty && !selected && cell && <>
      <p>Cette case mesure 1 m × 1 m. Choisis ce que tu veux y installer.</p>
      <div className={styles.buildChoices}>
        {CHOICES.map(({ kind, label, detail, Icon }) => <button key={kind} type="button" data-build-choice={kind} disabled={!snapshot || pending || warehouse.loading || !!warehouse.lockReason()} onClick={() => {
          if (kind === "partition") warehouse.addPartition(cell);
          else {
            const device = KQ_WAREHOUSE_CATALOG.find(device => device.kind === (kind === "culture" ? "lighting" : kind) && device.purchasable !== false);
            if (device) warehouse.add(kind, 1, 1, device.code, cell);
          }
        }}><Icon size={30} aria-hidden="true" /><strong>{label}</strong><span>{detail}</span></button>)}
      </div>
      {warehouse.lockReason() && <p>{warehouse.lockReason()}</p>}
    </>}
    {!dirty && selected && <div className={styles.buildActions}>
      <p>{selected.detail ?? "Cet emplacement est déjà aménagé."}</p>
      {selected.href && <OpenActivity onOpen={() => onNavigate(selected.href!)}>Ouvrir les actions</OpenActivity>}
      {selected.movable && <>
        <button type="button" disabled={!!warehouse.lockReason(selected.id)} data-build-edit onClick={() => warehouse.begin(selected.id)}>{selected.kind === "partition" ? "Modifier la paroi" : "Déplacer / tourner"}</button>
        {selected.kind === "partition" ? <button type="button" disabled={!!warehouse.lockReason(selected.id)} data-build-remove-wall onClick={() => warehouse.removePartition(selected.id)}>Retirer cette paroi</button>
          : <OpenActivity onOpen={() => onNavigate(`/arene/placard?view=workshop&zone=${encodeURIComponent(selected.id)}`)}>Équiper ou retirer la zone</OpenActivity>}
        {warehouse.lockReason(selected.id) && <p>{warehouse.lockReason(selected.id)}</p>}
      </>}
    </div>}
    {!dirty && <OpenActivity onOpen={() => onNavigate("/arene/placard?view=workshop&catalog=equipment&equipment=SIM-AIR-01")}>Choisir un ventilateur sur le plan</OpenActivity>}
    {dirty && <>
      {partition ? <>
        <p>La paroi passe au milieu des cases. Laisse une ouverture d’au moins un mètre pour entrer dans chaque pièce.</p>
        <div className={styles.wallLength}>
          <button type="button" aria-label="Raccourcir la paroi d’un mètre" disabled={frozen || partition.length <= 1} onClick={() => warehouse.updatePartition({ length: partition.length - 1 })}>− 1 m</button>
          <output data-build-wall-length>{partition.length} m</output>
          <button type="button" aria-label="Allonger la paroi d’un mètre" disabled={frozen || partition.length >= (partition.axis === "x" ? dimensions.columns : dimensions.rows)} onClick={() => warehouse.updatePartition({ length: partition.length + 1 })}>+ 1 m</button>
        </div>
        <div className={styles.buildActions}><button type="button" disabled={frozen} data-build-rotate onClick={() => warehouse.updatePartition({ axis: partition.axis === "x" ? "y" : "x" })}>Tourner 90°</button><button type="button" disabled={frozen} onClick={onClose}>Choisir une autre case</button></div>
      </> : item ? <>
        <p>{item.name} · {item.width} × {item.depth} m. L’aperçu montre l’emplacement avant confirmation.</p>
        <label>{kind === "culture" ? "Éclairage" : "Matériel"}<select aria-label="Matériel de la case" value={item.deviceCode ?? ""} disabled={frozen} onChange={event => warehouse.changeDevice(event.target.value)}>{devices.map(device => <option key={device.code} value={device.code}>{device.name}</option>)}</select></label>
        <div className={styles.buildActions}><button type="button" disabled={frozen} data-build-rotate onClick={() => warehouse.place(item.x, item.z, ((item.rotation + 90) % 360) as 0 | 90 | 180 | 270)}>Tourner 90°</button><button type="button" disabled={frozen} onClick={onClose}>Choisir une autre case</button></div>
      </> : removing ? <p>Cette paroi sera retirée du plan. Les zones et leur matériel seront conservés.</p> : null}
      {!!warehouse.validation.length && <p className={styles.error} role="alert" data-build-invalid>{warehouse.validation[0]}</p>}
      {snapshot && draft && <KqWarehousePlanQuote compact previousState={snapshot.state} draftState={draft} quote={warehouse.quote} cashCents={snapshot.cashCents} migrationCreditCents={snapshot.migrationCreditCents ?? 0}>
        <button type="button" data-interior-save disabled={pending || conflict || !warehouse.quote || !warehouse.payment.affordable} onClick={async () => { if (await warehouse.save()) onClose(); }}>{pending ? "Enregistrement…" : uncertain ? "Vérifier / réessayer" : removing ? "Confirmer le retrait" : "Confirmer l’aménagement"}</button>
        <button type="button" disabled={pending || uncertain} data-build-cancel onClick={() => { warehouse.cancel(); onClose(); }}>Annuler l’aperçu</button>
      </KqWarehousePlanQuote>}
    </>}
    {warehouse.error && <p className={styles.error} role="alert">{warehouse.error}</p>}
    {(conflict || uncertain) && <><p>L’aperçu est conservé. Vérifie le plan enregistré avant de continuer.</p><button type="button" disabled={pending} onClick={onReload}>Recharger le plan enregistré</button></>}
  </AppDialog>;
}
