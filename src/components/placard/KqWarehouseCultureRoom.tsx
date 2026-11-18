"use client";

import { useContext, useMemo } from "react";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { QuarterCharacterContext } from "../contest/QuarterCharacterContext";
import { KqGrowRoom, type KqGrowRoomWarehouseEditor } from "./KqGrowRoom";
import type { KqWarehouseCultureSummary } from "./KqWarehouseCulture";
import { getWarehouseRoomZones } from "./culture-room-state";
import type { KqGrowRoomEvent } from "./KqGrowRoomModel";

export function KqWarehouseCultureRoom({ plan, runs, reservedZoneId, onSelect, stockGrams, event, warehouseEditor }: {
  plan: KqWarehouseState; runs: readonly KqWarehouseCultureSummary[]; reservedZoneId?: string; stockGrams?: number | null; event?: KqGrowRoomEvent | null;
  onSelect: (id: string) => void;
  warehouseEditor: KqGrowRoomWarehouseEditor;
}) {
  const character = useContext(QuarterCharacterContext);
  const zones = useMemo(() => getWarehouseRoomZones(plan, runs, reservedZoneId, stockGrams), [plan, runs, reservedZoneId, stockGrams]);
  const affected = useMemo(() => runs.flatMap(run => run.roomCare?.affectedPlants?.filter(p => p.zoneId === run.zoneId) ?? []), [runs]);
  return <KqGrowRoom plan={plan} zones={zones} playerProfile={character} onSelectZone={onSelect} event={event} affectedPlants={affected} warehouseEditor={warehouseEditor} />;
}
