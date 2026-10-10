import type { projectKqStorageLot } from "@/lib/kanab-quest-storage";
import styles from "./KqWarehouseStorage.module.css";

export function KqStorageStatus({ storage, nowMs, compact = false }: {
  storage?: ReturnType<typeof projectKqStorageLot>; nowMs?: number; compact?: boolean;
}) {
  if (!storage) return null;
  const ready = Number.isFinite(nowMs) ? nowMs! >= Date.parse(storage.readyAt) : storage.stage === "ready";
  const readyDate = new Date(storage.readyAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const Container = compact ? "span" : "div";
  const overflow = storage.capacity?.overflowUnits ?? 0;
  const deadline = storage.capacity?.overflowDeadlineAt;
  const due = deadline ? new Date(deadline).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  return <Container className={styles.status} data-ready={ready} data-curing-status>
    {overflow > 0 ? <strong className={styles.overflowDeadline} data-overflow-deadline>{(overflow / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sans contenant · vente automatique au grossiste le {due}</strong> : null}
    <strong>{ready ? "Curing terminé" : "Curing en cours · grossistes uniquement"}</strong>
    {!compact ? <><progress max={100} value={ready ? 100 : storage.progressPercent} aria-label="Avancement du curing" /><p>{ready ? "Les circuits de vente sont ouverts selon la qualité du lot." : `Prêt le ${readyDate}. Le jury et le duel sont déjà passés.`}</p><small>{storage.methodName} · qualité commerciale {storage.conditionScore.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}/10</small></> : <small>{ready ? storage.methodName : `Prêt le ${readyDate}`}</small>}
  </Container>;
}
