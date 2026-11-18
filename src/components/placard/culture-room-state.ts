import { getKqCareProduct } from "@/lib/kanab-quest-care";
import { getKqCareProblemPlants } from "@/lib/kanab-quest-care-spatial";
import { getKqCarePresentation, getKqRoomCare } from "@/lib/kanab-quest-care-presentation";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KQ_BUDDIES, KQ_CARDS, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqProductionUnits } from "@/lib/kanab-quest-production-scale";
import { getKqWarehouseServiceZoneQuote, type KqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseActiveRun } from "@/lib/supabase/kanab-quest-warehouse-backend";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import type { KqGrowRoomEvent, KqGrowRoomZone } from "./KqGrowRoomModel";

export function warehouseBay(zone: KqWarehouseZone, plan: Pick<KqWarehouseState, "zones">): KqGrowRoomZone {
  return {
    id: zone.id, kind: "culture", name: getKqZoneIdentity(plan, zone.id)?.label ?? zone.name,
    areaM2: zone.width * zone.height, lightingCode: zone.lightingCode, airCode: zone.airCode,
    optionCodes: zone.optionCodes, supportCode: zone.optionCodes?.find(code => code.startsWith("SIM-SUBSTRATE-")),
    variety: KQ_BUDDIES.find(buddie => buddie.code === zone.buddieCode)?.name,
    status: zone.active ? "idle" : "paused",
  };
}

export type CultureRoomSnapshot = {
  state: KqWarehouseState; revision: number; activeRuns?: KqWarehouseActiveRun[]; stockGrams?: number | null;
  productionReservation?: { zoneId: string } | null;
};

/** Contents are counted per room by the game. Never assign a lot or a weight
 * to a specific shelf unless its location can be established. */
export function getWarehouseRoomZones(plan: KqWarehouseState, runs: readonly KqWarehouseActiveRun[] | undefined,
  reservedZoneId?: string | null, stockGrams?: number | null, current: readonly KqGrowRoomZone[] = []): KqGrowRoomZone[] {
  const cultures = plan.zones.map((zone): KqGrowRoomZone => {
    const bay = warehouseBay(zone, plan);
    const playing = current.find(item => item.id === zone.id);
    if (playing) return { ...playing, ...bay, status: playing.status, variety: playing.variety };
    if (zone.id === reservedZoneId) return { ...bay, status: "reserved" };
    if (!runs && zone.active) return { ...bay, status: "unknown" };
    const run = runs?.find(item => item.zoneId === zone.id);
    if (!run) return bay;
    const action = run.phase === "rolled" ? "Lancer à valider" : run.phase === "resolved" ? "Étape à poursuivre" : undefined;
    const care = run.roomCare;
    return { ...bay, status: "growing", stageIndex: run.stageIndex,
      powered: run.powerOutage === undefined ? undefined : !run.powerOutage,
      variety: KQ_BUDDIES.find(buddie => buddie.code === run.buddieCode)?.name,
      effects: [...(care?.effects ?? []), ...(run.powerOutage ? ["Coupure de courant"] : [])],
      affectedPlants: care?.affectedPlants?.filter(plant => plant.zoneId === zone.id),
      protectedSectors: care?.protectedSectors?.filter(cell => cell.zoneId === zone.id),
      inputSectors: care?.inputSectors?.filter(cell => cell.zoneId === zone.id),
      attention: [care?.attention && `${care.attention} · ${care.vitality}/100`, action].filter(Boolean).join(" · ") || undefined };
  });
  const services = plan.serviceZones ?? [];
  const dryingCount = cultures.filter(zone => zone.status === "growing" && zone.stageIndex === 5).length;
  const dryers = services.filter(zone => zone.kind === "drying").length;
  const stores = services.length - dryers;
  return [...cultures, ...services.map((zone): KqGrowRoomZone => {
    const capacity = getKqWarehouseServiceZoneQuote(zone).capacityGrams.toLocaleString("fr-FR");
    const storage = zone.kind === "storage";
    const knownStock = typeof stockGrams === "number" && Number.isFinite(stockGrams) && stockGrams >= 0;
    const label = storage ? "Stockage" : "Séchoir";
    const contents = storage ? knownStock ? `${stockGrams.toLocaleString("fr-FR")} g en stock dans l’entrepôt` : undefined
      : dryingCount ? `${dryingCount} culture${dryingCount > 1 ? "s" : ""} en séchage dans l’entrepôt` : undefined;
    const allocation = storage && knownStock && stockGrams > 0 && stores > 1 || !storage && dryingCount > 0 && dryers > 1
      ? "Répartition par poste inconnue" : undefined;
    return { id: zone.id, name: `${label} · ${getKqZoneIdentity(plan, zone.id)?.number ?? zone.name}`,
      kind: zone.kind, deviceCode: zone.deviceCode, areaM2: zone.width * zone.height,
      contentState: storage ? !knownStock ? "unknown" : stockGrams === 0 ? "empty" : stores === 1 ? "occupied" : "unknown"
        : dryingCount > 0 && dryers === 1 ? "occupied" : "unknown",
      contentLabel: [contents, allocation, `Capacité du poste · ${capacity} g`].filter(Boolean).join(" · ") };
  })];
}

export function getCultureRoomZones(state: KqGameState): KqGrowRoomZone[] {
  const health = getKqCarePresentation(state);
  const care = state.care && { ...state.care, problems: state.care.problems.map(problem => {
    if (problem.plants) return problem;
    const plants = getKqCareProblemPlants(state, problem);
    return plants.length ? { ...problem, plants } : problem;
  }) };
  const effects: string[] = [];
  if (state.powerOutage && state.phase !== "complete") effects.push("Coupure de courant");
  for (const code of state.playedThisStage) {
    const card = KQ_CARDS.find(item => item.code === code);
    if (card && card.timing === "before-roll" && state.phase === "prepare") effects.push(card.name);
  }
  function condition(zoneId?: string): Partial<KqGrowRoomZone> {
    const observed = care && getKqRoomCare(health.stageIndex, care, zoneId);
    return {
      status: state.cultureDead ? "dead" : state.phase === "complete" ? "complete" : "growing",
      stageIndex: health.stageIndex, variety: state.varietyName, powered: !state.powerOutage,
      effects: [...(observed?.effects ?? []), ...effects], affectedPlants: observed?.affectedPlants, protectedSectors: observed?.protectedSectors, inputSectors: observed?.inputSectors,
      attention: state.phase !== "complete" && observed?.attention ? `${observed.attention} · ${observed.vitality}/100` : undefined,
    };
  }
  if (state.campaign) return state.campaign.members.map(member => {
    const zone = member.warehouse.zones.find(item => item.id === member.zoneId)!;
    return { ...warehouseBay(zone, member.warehouse.sourceState), ...condition(zone.id),
      variety: KQ_BUDDIES.find(item => item.code === member.buddieCode)?.name };
  });
  if (state.warehouse?.zones.length) {
    const snapshot = state.warehouse;
    return snapshot.zones.map(zone => ({ ...warehouseBay(zone, snapshot.sourceState), ...condition(zone.id) }));
  }
  const tents = state.equipment?.tents ?? Array.from({ length: getKqProductionUnits(state.equipment?.productionUnits) },
    (_, i) => ({ tentNumber: i + 1, codes: state.equipment?.codes ?? [] }));
  return tents.map(tent => ({
    ...condition(), id: `tent-${tent.tentNumber}`, name: `Tente ${tent.tentNumber}`,
    lightingCode: tent.codes.find(code => getKqEquipmentDefinition(code)?.slot === "lighting"),
    airCode: tent.codes.find(code => getKqEquipmentDefinition(code)?.slot === "air"),
  }));
}

/** Compare accepted snapshots only. Resuming a saved stage presents its resting pose. */
export function getCultureRoomAction(before: KqGameState, after: KqGameState): Pick<KqGrowRoomEvent, "gesture" | "target"> & { label: string } | null {
  if (before.seed !== after.seed || before.startedAt !== after.startedAt || before.campaign?.id !== after.campaign?.id) return null;
  if (after.cultureDead) return null;
  if (before.stageIndex === 4 && after.stageIndex === 5) return { gesture: "dry", label: "Passage au séchage" };
  if (after.usedCards.length > before.usedCards.length) {
    const code = after.usedCards.at(-1);
    const card = KQ_CARDS.find(item => item.code === code);
    if (!card) return null;
    const gesture = card.code === "BOTTE-005" || card.code === "BOTTE-024" ? "water"
      : card.category === "equipment" ? "repair" : card.code === "BOTTE-015" ? "tend" : "card";
    return { gesture, label: card.name };
  }
  if (after.care && before.care) {
    if (after.care.applications.length > before.care.applications.length) {
      const app = after.care.applications.at(-1)!;
      const product = getKqCareProduct(app.productCode);
      if (!product) return null;
      const gesture = product.kind === "pbi" ? "pbi" : product.code === "CARE-VERMICOMPOST" ? "spread" : "pour";
      return { gesture, target: app.target, label: app.target
        ? `${product.name} · 1 m² traité, case ${app.target.x + 1}, ${app.target.y + 1}` : product.name };
    }
    if (after.care.lastBasicCareStage !== before.care.lastBasicCareStage && after.care.lastBasicCareStage !== null)
      return { gesture: "sweep", label: "Entretien payé · balayage de l’allée" };
  }
  if (before.phase === "prepare" && after.phase === "rolled" && before.stageIndex === after.stageIndex)
    return { gesture: "dice", label: `Lancer enregistré · ${after.dice?.join(" · ")}` };
  if (before.stageIndex === 4 && before.phase === "rolled" && after.phase === "resolved")
    return { gesture: "harvest", label: "Étape de récolte validée" };
  return null;
}
