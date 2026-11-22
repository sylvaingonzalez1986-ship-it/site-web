"use client";

import { useContext, useMemo, useState } from "react";
import type { KqGameState } from "@/lib/kanab-quest-game";
import { getKqCareProduct } from "@/lib/kanab-quest-care";
import type { KqCareSector } from "@/lib/kanab-quest-care-spatial";
import { QuarterCharacterContext } from "../contest/QuarterCharacterContext";
import { KqGrowRoom } from "./KqGrowRoom";
import type { KqGrowRoomEvent } from "./KqGrowRoomModel";
import { getCultureRoomAction, getCultureRoomZones, getWarehouseRoomZones } from "./culture-room-state";
import { useObservedCultureRoom } from "./useObservedCultureRoom";
import styles from "./KanabQuestDicePrototype.module.css";

export type CareSectorSelection = { code: string; eligible: KqCareSector[]; busy: boolean; error: string; attempted?: KqCareSector; choose: (cell: KqCareSector) => void; cancel: () => void };

export function KqCultureRoom({ state, initialZoneId, freshHarvest = false, observe = false, treatment }: {
  state: KqGameState; initialZoneId?: string; freshHarvest?: boolean; observe?: boolean;
  treatment?: CareSectorSelection | null;
}) {
  const character = useContext(QuarterCharacterContext);
  const savedPlan = state.warehouse?.sourceState ?? state.campaign?.members[0]?.warehouse.sourceState;
  const shouldRead = !!savedPlan && observe && state.phase !== "complete";
  const observed = useObservedCultureRoom(shouldRead);
  const [cue, setCue] = useState<(KqGrowRoomEvent & { label: string }) | "harvest" | null>(freshHarvest ? "harvest" : null);
  const plan = treatment || (cue && cue !== "harvest" && cue.target) ? savedPlan : observed?.state ?? savedPlan;
  const productCode = treatment?.code;
  const product = productCode ? getKqCareProduct(productCode) : undefined;
  const cultures = useMemo(() => getCultureRoomZones(state), [state]);
  const zones = useMemo(() => plan ? getWarehouseRoomZones(plan, observed?.activeRuns,
    observed?.productionReservation?.zoneId ?? state.warehouse?.productionReservedZoneId, observed?.stockGrams, cultures) : cultures,
    [plan, cultures, observed, state.warehouse?.productionReservedZoneId]);
  const [choice, setChoice] = useState(initialZoneId);
  const affectedPlants = useMemo(() => zones.flatMap(zone => zone.affectedPlants ?? []), [zones]);
  const selected = zones.find(zone => zone.id === choice) ?? zones.find(zone => zone.id === cultures[0]?.id) ?? zones[0];
  const selectedCrop = cultures.find(zone => zone.id === selected?.id) ?? cultures[0];
  const dryers = zones.filter(zone => zone.kind === "drying");
  const dryer = selected?.kind === "drying" ? selected : dryers.length === 1 ? dryers[0] : undefined;
  const stores = zones.filter(zone => zone.kind === "storage");
  const store = selected?.kind === "storage" ? selected : stores.length === 1 ? stores[0] : undefined;
  const [previous, setPrevious] = useState(state);
  const event = cue === "harvest" ? selectedCrop ? { id: "harvest", zoneId: (store ?? selectedCrop).id, gesture: store ? "store" as const : "harvest" as const, label: "Récolte enregistrée" } : null : cue;
  if (previous !== state) {
    setPrevious(state);
    const action = getCultureRoomAction(previous, state);
    const target = action?.gesture === "dry" ? dryer : state.stageIndex === 5 && action?.gesture !== "dice" ? dryer ?? selectedCrop : selectedCrop;
    if (action?.target) setChoice(action.target.zoneId);
    if (action && target) setCue({
      ...action, zoneId: action.target?.zoneId ?? target.id,
      id: [state.stageIndex, state.phase, state.usedCards.length, state.care?.applications.length, state.care?.lastBasicCareStage, state.rollNonce].join("/"),
    });
    else if (previous.stageIndex !== state.stageIndex || previous.seed !== state.seed || previous.phase !== state.phase) setCue(null);
  }
  if (!selected) return null;
  return <section aria-label="Salle de culture" tabIndex={-1} data-culture-room>
    {treatment && <div className={styles.roomTreatment} data-pbi-instructions>
      <strong>{product?.name} · 1 m²</strong>
      <span role="status">{treatment.busy ? "Intervention en cours…" : treatment.error || (product?.kind === "input" ? "Touche la case où ton personnage doit appliquer cet intrant." : "Touche la case à protéger. La croix sur une plante signale un foyer.")}</span>
      {treatment.error && treatment.attempted && <button type="button" disabled={treatment.busy} onClick={() => treatment.choose(treatment.attempted!)}>Vérifier le dépôt</button>}
      <button type="button" disabled={treatment.busy} onClick={treatment.cancel}>{treatment.error ? "Retour aux soins" : "Annuler"}</button>
    </div>}
    <KqGrowRoom plan={plan} zones={zones} affectedPlants={affectedPlants} pbiTargeting={treatment ? { eligible: treatment.eligible, onSelect: treatment.choose, busy: treatment.busy || !!treatment.error } : null} selectedZoneId={selected.id} onSelectZone={id => {
      setChoice(id);
      setCue(null);
    }} playerProfile={character} event={event} />
    <div className={styles.roomReceipt} role="status">{event?.label}</div>
    {shouldRead && !observed && <p className={styles.roomScope}>Aménagement enregistré au lancement de la culture.</p>}
    {state.campaign && cultures.length > 1 && <p className={styles.roomScope}>Le lancer est commun aux {cultures.length} cultures. Les produits s’appliquent sur la case choisie. L’entretien concerne tout l’entrepôt.</p>}
  </section>;
}
