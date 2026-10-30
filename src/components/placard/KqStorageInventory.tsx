"use client";

import { useId } from "react";
import { ArrowRight, Package, PackageCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { getKqStorageInventory, type KqStorageContainerInventory } from "@/lib/kanab-quest-storage";
import { getKqOverflowJuryStage } from "@/lib/kanab-quest-storage-guidance";
import { getKqStorageHarvestOverview } from "@/lib/kanab-quest-harvests";
import { KqAllocationBar } from "./KqVisuals";
import styles from "./KqStorageInventory.module.css";

const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const sameAmount = (left: number, right: number) => Math.abs(left - right) <= Math.max(1, left, right) * 1e-9;

/** Installed containers are usable; an unopened purchase is never free capacity. */
export function KqStorageInventory({ snapshot, selectedFlowerId, onOpenLot }: { snapshot: KqStorageSnapshot | null; selectedFlowerId?: string; onOpenLot?: (flowerId: string) => void }) {
  const id = useId();
  const installed = snapshot && "installedContainers" in snapshot ? snapshot.installedContainers : snapshot?.ownedContainers;
  const catalog = Array.isArray(snapshot?.containers) ? snapshot.containers : [];
  const installedKnown = installed !== undefined && installed !== null && typeof installed === "object" && !Array.isArray(installed) && Object.entries(installed).every(([code, quantity]) => catalog.some(container => container.code === code) && count(quantity));
  const allocationsKnown = Array.isArray(snapshot?.lots) && snapshot.lots.every(lot => Array.isArray(lot.projection?.capacity?.allocations));
  let inventory: KqStorageContainerInventory[] | null = null;
  if (installedKnown && allocationsKnown) {
    try { inventory = getKqStorageInventory(installed, snapshot!.lots.flatMap(lot => lot.projection.capacity!.allocations)); }
    catch { /* An incomplete or inconsistent snapshot must not look like empty storage. */ }
  }
  // usedUnits has different historical meanings and includes packed commerce
  // stock with service zones. Only the explicit server breakdown identifies it.
  const source = snapshot?.stockBreakdown;
  const breakdown = source && [source.bulkUnits, source.bulkProtectedUnits, source.bulkOverflowUnits,
    source.packedUnits, source.packedActiveUnits, source.packedPausedUnits, source.packedOtherUnits].every(amount)
    && count(source.packedPackets)
    && sameAmount(source.bulkUnits, source.bulkProtectedUnits + source.bulkOverflowUnits)
    && sameAmount(source.packedUnits, source.packedActiveUnits + source.packedPausedUnits + source.packedOtherUnits)
    ? source : null;
  const protectedUnits = breakdown?.bulkProtectedUnits ?? null;
  const overflowUnits = breakdown?.bulkOverflowUnits ?? null;
  const overflowStage = getKqOverflowJuryStage(snapshot?.lots ?? [], overflowUnits ?? 0);
  const overflowAdvice = overflowStage === "before-jury" ? "à ranger avant le jury. La vente sera possible après le verdict."
    : overflowStage === "after-jury" ? "à ranger ou à vendre selon les offres disponibles."
      : overflowStage === "mixed" ? "à ranger. Seuls les lots déjà évalués peuvent être vendus, selon les offres disponibles."
        : "à ranger. Vérifie le suivi de chaque lot pour connaître les ventes possibles.";
  const totalUnits = breakdown ? breakdown.bulkUnits + breakdown.packedUnits : null;
  const stockParts = breakdown ? [
    { label: "Vrac en contenants", value: breakdown.bulkProtectedUnits, displayValue: grams(breakdown.bulkProtectedUnits), tone: "teal" as const },
    { label: "Vrac sans contenant", value: breakdown.bulkOverflowUnits, displayValue: grams(breakdown.bulkOverflowUnits), tone: "red" as const },
    { label: "Paquets · annonces actives", value: breakdown.packedActiveUnits, displayValue: grams(breakdown.packedActiveUnits), tone: "gold" as const },
    { label: "Paquets · annonces en pause", value: breakdown.packedPausedUnits, displayValue: grams(breakdown.packedPausedUnits), tone: "ink" as const },
    { label: "Paquets · autres annonces", value: breakdown.packedOtherUnits, displayValue: grams(breakdown.packedOtherUnits), tone: "ink" as const },
  ].filter(part => part.value > 0) : [];
  const rows = installedKnown ? catalog.filter(container => (installed[container.code] ?? 0) > 0) : [];
  const availableCapacity = inventory?.reduce((total, row) => total + row.freeQuantity * row.capacityUnits, 0) ?? null;
  const lotsToStore = getKqStorageHarvestOverview(snapshot).lots.filter(lot => amount(lot.projection.capacity?.overflowUnits) && lot.projection.capacity!.overflowUnits > 0);
  const nextLotToStore = lotsToStore.find(lot => lot.flowerId === selectedFlowerId) ?? lotsToStore[0];
  const uninstalled = installedKnown && snapshot?.installedContainers && snapshot.ownedContainers
    && Object.values(snapshot.ownedContainers).every(count)
    ? Object.entries(snapshot.ownedContainers).reduce((total, [code, quantity]) => total + Math.max(0, quantity - (installed[code] ?? 0)), 0) : null;

  return <section className={styles.inventory} aria-labelledby={`${id}-title`} data-storage-inventory>
    <h3 id={`${id}-title`}>Mon stock et mes contenants</h3>
    <dl className={styles.metrics}>
      <div data-storage-stock="total"><dt><Package size={17} aria-hidden="true" />Stock total</dt><dd>{totalUnits === null ? "—" : grams(totalUnits)}</dd><small>Vrac et paquets encore invendus</small></div>
      <div data-storage-stock="protected"><dt><ShieldCheck size={17} aria-hidden="true" />En contenants</dt><dd>{protectedUnits === null ? "—" : grams(protectedUnits)}</dd><small>Récoltes et produits en vrac</small></div>
      <div data-storage-stock="packed"><dt><PackageCheck size={17} aria-hidden="true" />Emballés</dt><dd>{breakdown ? grams(breakdown.packedUnits) : "—"}</dd><small>{breakdown ? `${breakdown.packedPackets.toLocaleString("fr-FR")} paquet${breakdown.packedPackets > 1 ? "s" : ""} dans Commerce` : "Répartition à confirmer"}</small>
      </div>
    </dl>
    <p className={styles.units}>Volumes en équivalent fleurs.</p>
    {snapshot && !breakdown ? <p className={styles.notice} role="status" data-storage-breakdown-unavailable>La répartition entre vrac et paquets est indisponible. Actualise le stockage pour retrouver les quantités et l’état des annonces.</p> : null}
    {!snapshot ? <p className={styles.notice} role="status">Chargement du stock et des contenants…</p> : <>
      <div className={styles.tableHeading}><h4>Mes contenants</h4><p>{availableCapacity === null ? "Disponibilité à confirmer" : `${grams(availableCapacity)} dans les contenants libres`}</p></div>
      {!installedKnown ? <p className={styles.notice}>L’inventaire des contenants installés est indisponible. Actualise le stockage avant de déplacer un lot.</p>
        : rows.length ? <table className={styles.table}>
          <caption className="sr-only">Quantités installées, occupées et libres pour chaque modèle de contenant</caption>
          <thead><tr><th scope="col">Modèle</th><th scope="col">Installés</th><th scope="col">Occupés</th><th scope="col">Libres</th></tr></thead>
          <tbody>{rows.map(container => {
            const row = inventory?.find(item => item.code === container.code);
            return <tr key={container.code} data-storage-container={container.code}><th scope="row">{container.name}<small>{grams(container.capacityUnits)} par contenant</small></th><td data-label="Installés">{installed[container.code]}</td><td data-label="Occupés">{row?.occupiedQuantity ?? "—"}</td><td data-label="Libres"><strong>{row?.freeQuantity ?? "—"}</strong></td></tr>;
          })}</tbody>
        </table> : <p className={styles.notice}>Aucun contenant installé. Aménage la zone de stockage pour pouvoir ranger tes lots.</p>}
      {installedKnown && !inventory ? <p className={styles.notice}>Les réservations par lot sont incomplètes. Les quantités libres restent à confirmer.</p> : null}
      {uninstalled !== null && uninstalled > 0 ? <p className={styles.notice}>{uninstalled.toLocaleString("fr-FR")} contenant{uninstalled > 1 ? "s achetés restent" : " acheté reste"} à installer dans la zone de stockage.</p> : null}
      <p className={styles.help}>Un contenant est réservé à un seul lot.</p>
    </>}
    {(overflowUnits !== null && overflowUnits > 0) || nextLotToStore ? <div className={styles.overflow} data-storage-stock="overflow"><p><TriangleAlert size={18} aria-hidden="true" /><span><strong>{overflowUnits !== null && overflowUnits > 0 ? `${grams(overflowUnits)} de vrac sans contenant` : "Des lots sont sans contenant · total à confirmer"}</strong> · {overflowAdvice}</span></p>
      {onOpenLot && nextLotToStore ? <div className={styles.quickActions}><button type="button" data-storage-jump={nextLotToStore.flowerId} onClick={() => onOpenLot(nextLotToStore.flowerId)}>{lotsToStore.length === 1 ? "Ranger ce lot" : `Ranger mes ${lotsToStore.length} lots`}<ArrowRight size={17} aria-hidden="true" /></button></div> : null}
    </div> : null}
    {snapshot ? <details className={styles.details} data-storage-inventory-details>
      <summary>Répartition du stock et règles de rangement</summary>
      <div>
        {breakdown && breakdown.packedUnits > 0 ? <ul className={styles.packedDetails} aria-label="État des paquets dans Commerce">
          {breakdown.packedActiveUnits > 0 ? <li data-storage-packed="active"><strong>{grams(breakdown.packedActiveUnits)}</strong> dans des annonces actives</li> : null}
          {breakdown.packedPausedUnits > 0 ? <li data-storage-packed="paused"><strong>{grams(breakdown.packedPausedUnits)}</strong> dans des annonces en pause</li> : null}
          {breakdown.packedOtherUnits > 0 ? <li data-storage-packed="other"><strong>{grams(breakdown.packedOtherUnits)}</strong> dans des annonces fermées ou bloquées</li> : null}
        </ul> : null}
        {stockParts.length > 1 ? <KqAllocationBar label="Répartition du stock invendu" items={stockParts} /> : null}
        <p className={styles.help}>Le stock total inclut le vrac en contenants, le vrac sans contenant et les paquets encore invendus. Tous les volumes sont en équivalent fleurs, y compris les produits transformés.</p>
        <p className={styles.help}>Les paquets occupent de la place dans l’entrepôt, mais aucun bocal, sachet ou fût du tableau. La place restante dans un contenant occupé reste réservée à son lot.</p>
      </div>
    </details> : null}
  </section>;
}
