import type { projectKqStorageLot } from "@/lib/kanab-quest-storage";
import { getKqStorageJuryStage } from "@/lib/kanab-quest-storage-guidance";
import styles from "./KqWarehouseStorage.module.css";

export function KqStorageStatus({ storage, flowerStatus, nowMs, compact = false }: {
  storage?: ReturnType<typeof projectKqStorageLot>; flowerStatus?: string; nowMs?: number; compact?: boolean;
}) {
  if (!storage) return null;
  const ready = Number.isFinite(nowMs) ? nowMs! >= Date.parse(storage.readyAt) : storage.stage === "ready";
  const readyDate = new Date(storage.readyAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const Container = compact ? "span" : "div";
  const overflow = storage.capacity?.overflowUnits ?? 0;
  const juryStage = getKqStorageJuryStage(flowerStatus);
  const deadline = juryStage === "after-jury" && storage.capacity?.automaticOverflowSale !== false
    && Number.isFinite(Date.parse(storage.capacity?.overflowDeadlineAt ?? "")) ? storage.capacity?.overflowDeadlineAt : null;
  const due = deadline ? new Date(deadline).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  const overflowAction = juryStage === "before-jury" ? "à ranger · vente après le jury"
    : juryStage === "after-jury" ? deadline ? `vente automatique au grossiste le ${due}` : "à ranger ou à vendre selon les offres"
      : "à ranger · passage au jury à vérifier";
  return <Container className={styles.status} data-ready={ready} data-curing-status>
    {overflow > 0 ? <strong className={styles.overflowDeadline} data-overflow-deadline>{(overflow / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sans contenant · {overflowAction}</strong> : null}
    <strong>{ready ? "Affinage terminé" : "Affinage en cours"}</strong>
    {!compact ? <><progress max={100} value={ready ? 100 : storage.progressPercent} aria-label="Avancement de l’affinage" /><p>{ready ? "L’affinage est terminé. Les contenants continuent à préserver la qualité du lot." : `Fin de l’affinage le ${readyDate}, même hors connexion.`}</p><small>{storage.methodName} · qualité actuelle {storage.conditionScore.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}/10</small></> : <small>{ready ? storage.methodName : `Prêt le ${readyDate}`}</small>}
  </Container>;
}
