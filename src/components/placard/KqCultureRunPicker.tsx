"use client";

import { useContext, useMemo, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { QuarterCharacterContext } from "../contest/QuarterCharacterContext";
import type { KqRemoteActiveRun } from "@/lib/kanab-quest-api";
import { getKqClientRunZoneId, type KqClientRunSelection } from "@/lib/kanab-quest-client-run-selection";
import { KqGrowRoom } from "./KqGrowRoom";
import { getCultureRoomZones, getWarehouseRoomZones } from "./culture-room-state";
import { useObservedCultureRoom } from "./useObservedCultureRoom";
import styles from "./KanabQuestDicePrototype.module.css";

/** Historical independent runs must be opened explicitly before spending on them. */
export function KqCultureRunPicker({ runs, onOpen }: {
  runs: readonly KqRemoteActiveRun[]; onOpen?: (selection: KqClientRunSelection) => void;
}) {
  const character = useContext(QuarterCharacterContext);
  const observed = useObservedCultureRoom(runs.some(run => !!run.state.warehouse));
  const recent = runs.slice().sort((a, b) => (b.state.warehouse?.revision ?? 0) - (a.state.warehouse?.revision ?? 0))[0];
  const plan = observed?.state ?? recent?.state.warehouse?.sourceState;
  const choices = useMemo(() => runs.flatMap(run => getCultureRoomZones(run.state).map(zone =>
    ({ ...zone, id: plan ? zone.id : `${run.runId}/${zone.id}`, run }))), [runs, plan]);
  const zones = useMemo(() => plan ? getWarehouseRoomZones(plan, observed?.activeRuns, observed?.productionReservation?.zoneId, observed?.stockGrams, choices) : choices, [choices, observed, plan]);
  const affected = useMemo(() => zones.flatMap(zone => zone.affectedPlants ?? []), [zones]);
  const [zoneId, setZoneId] = useState<string>();
  const selected = zones.find(zone => zone.id === zoneId) ?? zones.find(zone => choices.some(choice => choice.id === zone.id)) ?? zones[0];
  const run = choices.find(zone => zone.id === selected?.id)?.run;
  const otherRuns = runs.filter(item => !choices.some(choice => choice.run.runId === item.runId && zones.some(zone => zone.id === choice.id)));
  function resume(item: KqRemoteActiveRun, label: string, zoneId = getKqClientRunZoneId(item)) {
    const selection = { runId: item.runId, zoneId };
    return onOpen ? <button key={item.runId} type="button" onClick={() => onOpen(selection)}>{label}</button>
      : <Link key={item.runId} href={`/arene/placard?view=game&run=${encodeURIComponent(selection.runId)}${zoneId ? `&zone=${encodeURIComponent(zoneId)}` : ""}`}>{label}</Link>;
  }
  return <>
    {selected && <KqGrowRoom plan={plan} zones={zones} affectedPlants={affected} selectedZoneId={selected.id} onSelectZone={setZoneId} playerProfile={character} />}
    {run && selected && <div className={styles.runChoices}>{resume(run, `Reprendre ${selected.variety ?? selected.name}`, run.state.campaign ? selected.id : getKqClientRunZoneId(run))}</div>}
    {otherRuns.length > 0 && <div className={styles.runChoices} aria-label="Cultures hors du plan enregistré">{otherRuns.map(item => resume(item, `Reprendre ${item.state.varietyName} · hors du plan`))}</div>}
  </>;
}
