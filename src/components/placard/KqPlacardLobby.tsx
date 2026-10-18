"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getKqNextEquipmentGoal } from "@/lib/kanab-quest-equipment";
import { getKqPlacardNextAction } from "@/lib/kanab-quest-hub";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay } from "@/lib/kanab-quest-storage-refresh";
import { ArenaLearningLauncher } from "../contest/ArenaLearningLauncher";
import { useKqTentSelection } from "./KqTentSelector";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqPlacardMap, type PlacardMapOpen } from "./KqPlacardMap";
import styles from "./KqPlacardLobby.module.css";

type LobbySnapshot = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  productionUnits?: number;
  ownedCodes: string[];
  cashCents: number;
};

export function KqPlacardLobby({ onOpen, onOpenCollection, highlightedBuilding }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  highlightedBuilding?: string | null;
}) {
  const api = useKqTutorialApi();
  const tentNumber = useKqTentSelection();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/arena/placard/equipment?tentNumber=${tentNumber}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Résumé indisponible");
        const data = await response.json() as LobbySnapshot;
        if (typeof data.activeRun !== "boolean" || !Array.isArray(data.ownedCodes) || !Number.isFinite(data.cashCents) || !Number.isFinite(data.readyLotCount) || !Number.isFinite(data.availableFlowerCount)) throw new Error("Résumé incomplet");
        if (!controller.signal.aborted) { setSnapshot(data); setError(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [revision, tentNumber]);

  useEffect(() => {
    const controller = new AbortController();
    let latest: KqStorageSnapshot | null = null;
    let received = 0;
    const refresh = async () => {
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Stockage indisponible");
        const data = await response.json() as KqStorageSnapshot;
        if (!Array.isArray(data.lots) || typeof data.serverNow !== "string" || !Number.isFinite(Date.parse(data.serverNow)) || data.lots.some(lot => {
          const projection = lot?.projection;
          const capacity = projection?.capacity;
          return !projection || typeof projection.nextChangeAt !== "string"
            || (capacity != null && (!Number.isFinite(capacity.overflowUnits) || capacity.overflowUnits < 0
              || (capacity.overflowDeadlineAt != null && (typeof capacity.overflowDeadlineAt !== "string" || !Number.isFinite(Date.parse(capacity.overflowDeadlineAt))))));
        })) throw new Error("Résumé du stockage incomplet");
        if (controller.signal.aborted) return;
        latest = data;
        received = performance.now();
        setStorage(data);
      } catch {
        if (controller.signal.aborted) return;
        latest = null;
        setStorage(null);
      }
    };
    const polling = startArenaVisiblePolling(refresh, () => getKqStorageRefreshDelay(latest, performance.now() - received));
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); };
  }, [api]);

  const nextGoal = snapshot ? getKqNextEquipmentGoal({ ownedCodes: snapshot.ownedCodes, cashCents: snapshot.cashCents, productionUnits: 1 }) : null;
  const nextAction = snapshot ? getKqPlacardNextAction({ ...snapshot, equipmentGoalAffordable: nextGoal?.affordable ?? false }) : null;
  const exposedLots = storage?.lots.filter(lot => (lot.projection.capacity?.overflowUnits ?? 0) > 0) ?? [];
  const overflowUnits = exposedLots.reduce((total, lot) => total + lot.projection.capacity!.overflowUnits, 0);
  const deadline = exposedLots.map(lot => lot.projection.capacity?.overflowDeadlineAt).filter((date): date is string => Boolean(date)).sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const deadlineLabel = deadline ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(deadline)) : null;
  const recommended = overflowUnits > 0 ? "harvests" : nextAction?.destination === "shop" ? "workshop" : nextAction?.destination;
  const tents = snapshot ? getKqProductionUnits(snapshot.productionUnits) : null;

  return <main className={styles.lobby} data-placard-lobby>
    {overflowUnits > 0 ? <section className={styles.nextAction} aria-label="À faire maintenant" data-priority="storage">
      <span className={styles.guidePortrait} aria-hidden="true"><Image src="/sylvain.png" alt="" width={88} height={88} /></span>
      <div><span>Récolte à protéger</span><p>{(overflowUnits / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sans contenant</p><small>{deadlineLabel ? `Prochaine vente automatique au grossiste : le ${deadlineLabel} (heure de Paris).` : "Ce surplus est en attente de stockage. Ouvre tes récoltes pour connaître son échéance."}</small></div>
      <button type="button" onClick={() => onOpen("harvests", { harvestSection: "storage" })}>Protéger ma récolte<ArrowRight size={17} aria-hidden="true" /></button>
    </section> : nextAction ? <section className={styles.nextAction} aria-label="À faire maintenant">
      <span className={styles.guidePortrait} aria-hidden="true"><Image src="/sylvain.png" alt="" width={88} height={88} /></span>
      <div><span>À faire maintenant</span><p>{nextAction.title}</p></div>
      <button type="button" onClick={() => onOpen(nextAction.destination === "shop" ? "workshop" : nextAction.destination, nextAction.destination === "shop" ? { catalog: true, equipmentCode: nextGoal?.equipment.code } : undefined)}>{nextAction.buttonLabel}<ArrowRight size={17} aria-hidden="true" /></button>
    </section> : !error ? <div className={styles.loading} role="status">Ton quartier se prépare…</div> : null}
    <KqPlacardMap onOpen={onOpen} onOpenCollection={onOpenCollection} activeRun={snapshot?.activeRun} cashCents={snapshot?.cashCents ?? null} tents={tents} readyLotCount={snapshot?.readyLotCount} availableFlowerCount={snapshot?.availableFlowerCount} recommended={recommended} highlightedBuilding={highlightedBuilding} />
    <div className={styles.learning} data-placard-learning-entry><ArenaLearningLauncher className={styles.learningButton} /></div>
    {error ? <p className={styles.status} role="status">Ton résumé est indisponible. Les activités restent accessibles. <button type="button" onClick={() => { setError(false); setRevision(value => value + 1); }}>Réessayer</button></p> : null}
  </main>;
}
