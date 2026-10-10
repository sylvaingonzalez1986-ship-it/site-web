"use client";

import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { getKqNextEquipmentGoal } from "@/lib/kanab-quest-equipment";
import { getKqPlacardNextAction } from "@/lib/kanab-quest-hub";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import { useKqTentSelection } from "./KqTentSelector";
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

export function KqPlacardLobby({ onOpen, onOpenCollection }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
}) {
  const tentNumber = useKqTentSelection();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
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

  const nextGoal = snapshot ? getKqNextEquipmentGoal({ ownedCodes: snapshot.ownedCodes, cashCents: snapshot.cashCents, productionUnits: 1 }) : null;
  const nextAction = snapshot ? getKqPlacardNextAction({ ...snapshot, equipmentGoalAffordable: nextGoal?.affordable ?? false }) : null;
  const recommended = nextAction?.destination === "shop" ? "workshop" : nextAction?.destination;
  const tents = snapshot ? getKqProductionUnits(snapshot.productionUnits) : null;

  return <main className={styles.lobby} data-placard-lobby>
    <header className={styles.header}>
      <Link className={styles.back} href="/arene"><ArrowLeft size={18} aria-hidden="true" /> Retour à l’Arène</Link>
    </header>
    <KqPlacardMap onOpen={onOpen} onOpenCollection={onOpenCollection} activeRun={snapshot?.activeRun} cashCents={snapshot?.cashCents ?? null} tents={tents} readyLotCount={snapshot?.readyLotCount} availableFlowerCount={snapshot?.availableFlowerCount} recommended={recommended} />
    {error ? <p className={styles.status} role="status">Ton résumé est indisponible. Les activités restent accessibles. <button type="button" onClick={() => { setError(false); setRevision(value => value + 1); }}>Réessayer</button></p> : null}
  </main>;
}
