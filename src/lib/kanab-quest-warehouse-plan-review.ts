import { KQ_BUDDIES } from "./kanab-quest-game";
import { KQ_WAREHOUSE_UNLIT_CODE, type KqWarehouseQuote, type KqWarehouseServiceZone, type KqWarehouseState, type KqWarehouseZone } from "./kanab-quest-warehouse";
import { getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseAirPlacements, type KqWarehouseAirMount } from "./kanab-quest-warehouse-air";
import { getKqWarehouseOption } from "./kanab-quest-warehouse-options";
import { KQ_WAREHOUSE_STATIONS } from "./kanab-quest-warehouse-stations";
import { KQ_WAREHOUSE_HANDLING } from "./kanab-quest-warehouse-handling";
import { getKqZoneIdentity } from "./kanab-quest-zone-identity";

export function describeKqWarehouseAirMount(mount?: KqWarehouseAirMount, partitions: KqWarehouseState["partitions"] = []) {
  if (!mount) return "Au sol";
  const walls = { north: "Mur sud", south: "Mur nord", east: "Mur ouest", west: "Mur est" };
  const directions = { north: "nord", south: "sud", east: "est", west: "ouest" };
  const partitionIndex = partitions.findIndex(wall => wall.id === mount.partitionId);
  const support = mount.partitionId ? (partitionIndex < 0 ? "Paroi" : `Paroi ${partitionIndex + 1}`) : walls[mount.face];
  return `${support} · prise d’air côté ${directions[mount.face]}`;
}

/** Presentation only: the quote supplied by the existing pricing engine stays authoritative. */
export function getKqWarehousePlanPayment(quote: KqWarehouseQuote | null, cashCents: number, migrationCreditCents: number) {
  if (!quote) return {
    totalCents: null, creditUsedCents: null, payableCents: null,
    cashAfterCents: null, shortfallCents: null, affordable: false,
  };
  const totalCents = quote.totalCostCents;
  const creditUsedCents = Math.min(Math.max(0, migrationCreditCents), totalCents);
  const payableCents = Math.max(0, totalCents - creditUsedCents);
  const shortfallCents = Math.max(0, payableCents - cashCents);
  return {
    totalCents, creditUsedCents, payableCents, shortfallCents,
    cashAfterCents: shortfallCents > 0 ? null : cashCents - payableCents,
    affordable: shortfallCents === 0,
  };
}

type PlanZone = KqWarehouseZone | KqWarehouseServiceZone;
export type KqWarehousePlanZoneChange = {
  id: string;
  label: string;
  previousLabel?: string;
  kind: "Culture" | "Séchage" | "Stockage";
  status: "added" | "changed" | "removed";
  details: string[];
};

const zones = (state: KqWarehouseState): PlanZone[] => [...state.zones, ...(state.serviceZones ?? [])];
const sorted = (codes: string[] = []) => [...codes].sort().join("|");
const inventoryKey = (inventory: KqWarehouseState["equipment"] = []) => [...inventory]
  .sort((a, b) => a.code.localeCompare(b.code)).map(item => `${item.code}:${item.quantity}`).join("|");
const deviceName = (code?: string) => code === KQ_WAREHOUSE_UNLIT_CODE ? "À installer" : code ? getKqWarehouseDevice(code)?.name ?? "Matériel sélectionné" : "Aucune";
const buddieName = (code?: string) => code ? KQ_BUDDIES.find(item => item.code === code)?.name ?? "Buddie sélectionné" : "Aucun";
const moduleNames = (codes: string[] = []) => codes.length ? codes.map(code => getKqWarehouseOption(code)?.name ?? "Module sélectionné").join(", ") : "Aucun";
const area = (zone: PlanZone) => `${zone.width * zone.height} m²`;
const dimensions = (zone: PlanZone) => `${zone.width} × ${zone.height} m`;

function zoneDetails(previous: PlanZone, draft: PlanZone): string[] {
  const details: string[] = [];
  if (previous.name !== draft.name) details.push(`Nom : ${draft.name}`);
  if (previous.x !== draft.x || previous.y !== draft.y) details.push("Position modifiée");
  if (previous.width !== draft.width || previous.height !== draft.height) details.push(`Dimensions : ${dimensions(previous)} → ${dimensions(draft)}`);
  if ("kind" in previous && "kind" in draft) {
    if (previous.kind !== draft.kind) details.push("Usage de la zone modifié");
    if (previous.deviceCode !== draft.deviceCode) details.push(`Matériel : ${deviceName(draft.deviceCode)}`);
  } else if (!("kind" in previous) && !("kind" in draft)) {
    if (previous.lightingCode !== draft.lightingCode) details.push(`Éclairage : ${deviceName(draft.lightingCode)}`);
    if (previous.airCode !== draft.airCode) details.push(`Extraction : ${deviceName(draft.airCode)}`);
    if (sorted(previous.optionCodes) !== sorted(draft.optionCodes)) details.push(`Modules : ${moduleNames(draft.optionCodes)}`);
    if (previous.buddieCode !== draft.buddieCode) details.push(`Buddie : ${buddieName(draft.buddieCode)}`);
    if (previous.active !== draft.active) details.push(draft.active ? "Active à la prochaine culture" : "Inactive à la prochaine culture");
  } else details.push("Usage et matériel modifiés");
  return details;
}

/** Identify edits by persistent zone IDs, including removed zones whose numbers may be reused. */
export function getKqWarehousePlanChanges(previousState: KqWarehouseState, draftState: KqWarehouseState) {
  const previousZones = zones(previousState);
  const draftZones = zones(draftState);
  const previousById = new Map(previousZones.map(zone => [zone.id, zone]));
  const draftIds = new Set(draftZones.map(zone => zone.id));
  const zoneChanges: KqWarehousePlanZoneChange[] = [];
  for (const zone of draftZones) {
    const previous = previousById.get(zone.id);
    const details = previous ? zoneDetails(previous, zone) : [area(zone), ...("kind" in zone
      ? [`Matériel : ${deviceName(zone.deviceCode)}`]
      : [`Éclairage : ${deviceName(zone.lightingCode)}`, ...(draftState.airPlacements ? [] : [`Extraction : ${deviceName(zone.airCode)}`]),
        ...(zone.optionCodes?.length ? [`Modules : ${moduleNames(zone.optionCodes)}`] : []),
        ...(zone.buddieCode ? [`Buddie : ${buddieName(zone.buddieCode)}`] : [])])];
    if (previous && !details.length) continue;
    const label = getKqZoneIdentity(draftState, zone.id)?.label ?? zone.name;
    const previousLabel = previous ? getKqZoneIdentity(previousState, zone.id)?.label : undefined;
    zoneChanges.push({
      id: zone.id, label, ...(previousLabel && previousLabel !== label ? { previousLabel } : {}),
      kind: "kind" in zone ? zone.kind === "drying" ? "Séchage" : "Stockage" : "Culture",
      status: previous ? "changed" : "added", details,
    });
  }
  for (const zone of previousZones) {
    if (draftIds.has(zone.id)) continue;
    zoneChanges.push({
      id: zone.id, label: getKqZoneIdentity(previousState, zone.id)?.label ?? zone.name,
      kind: "kind" in zone ? zone.kind === "drying" ? "Séchage" : "Stockage" : "Culture",
      status: "removed", details: ["Matériel conservé en réserve"],
    });
  }
  const otherChanges: string[] = [];
  if (draftState.airPlacements) {
    const previousAir = getKqWarehouseAirPlacements(previousState);
    if (!previousState.airPlacements) otherChanges.push("Passage au placement individuel des extracteurs");
    const byId = new Map(previousAir.map(item => [item.id, item]));
    for (const item of draftState.airPlacements) {
      const before = byId.get(item.id);
      const location = `colonne ${item.x + 1}, ligne ${item.y + 1}`;
      if (!before || before.x !== item.x || before.y !== item.y || before.code !== item.code
        || before.mount?.face !== item.mount?.face || before.mount?.partitionId !== item.mount?.partitionId) {
        otherChanges.push(`${deviceName(item.code)} · ${location}${item.mount || before?.mount ? " · " + describeKqWarehouseAirMount(item.mount, draftState.partitions) : ""}`);
      }
      byId.delete(item.id);
    }
    for (const item of byId.values()) otherChanges.push(`${deviceName(item.code)} retiré · colonne ${item.x + 1}, ligne ${item.y + 1}`);
  }
  const oldStations = new Map(previousState.stationPlacements?.map(station => [station.id, station]));
  for (const item of draftState.handlingPlacements ?? []) {
    const old = previousState.handlingPlacements?.find(previous => previous.code === item.code);
    if (!old || old.x !== item.x || old.y !== item.y) otherChanges.push(`${KQ_WAREHOUSE_HANDLING[item.code].name} · colonne ${item.x + 1}, ligne ${item.y + 1}`);
  }
  for (const station of draftState.stationPlacements ?? []) {
    const previous = oldStations.get(station.id);
    if (!previous || previous.code !== station.code || previous.x !== station.x || previous.y !== station.y) {
      otherChanges.push(`${KQ_WAREHOUSE_STATIONS[station.code].name} · colonne ${station.x + 1}, ligne ${station.y + 1}`);
    }
    oldStations.delete(station.id);
  }
  for (const station of oldStations.values()) otherChanges.push(`${KQ_WAREHOUSE_STATIONS[station.code].name} remis en réserve · colonne ${station.x + 1}, ligne ${station.y + 1}`);
  const previousPartitions = previousState.partitions ?? [];
  const draftPartitions = draftState.partitions ?? previousPartitions;
  const previousPartitionsById = new Map(previousPartitions.map(partition => [partition.id, partition]));
  const draftPartitionIds = new Set(draftPartitions.map(partition => partition.id));
  const axisLabel = (axis: "x" | "y") => axis === "x" ? "horizontale" : "verticale";
  draftPartitions.forEach((partition, index) => {
    const previous = previousPartitionsById.get(partition.id);
    const label = `Paroi ${index + 1}`;
    if (!previous) { otherChanges.push(`${label} ajoutée : ${partition.length} m, ${axisLabel(partition.axis)}`); return; }
    if (previous.length !== partition.length) otherChanges.push(`${label} : longueur ${previous.length} → ${partition.length} m`);
    if (previous.axis !== partition.axis) otherChanges.push(`${label} tournée : ${axisLabel(previous.axis)} → ${axisLabel(partition.axis)}`);
    if (previous.x !== partition.x || previous.y !== partition.y) otherChanges.push(`${label} déplacée`);
  });
  previousPartitions.forEach((partition, index) => {
    if (!draftPartitionIds.has(partition.id)) otherChanges.push(`Paroi ${index + 1} retirée : ${partition.length} m`);
  });
  if (previousState.storageClimateCode !== draftState.storageClimateCode) otherChanges.push(`Climatisation du stockage : ${deviceName(draftState.storageClimateCode)}`);
  if (previousState.serviceZones === undefined && draftState.serviceZones !== undefined) otherChanges.push("Le séchage et le stockage seront répartis dans les zones du plan.");
  if (inventoryKey(previousState.equipment) !== inventoryKey(draftState.equipment)) otherChanges.push("Inventaire des appareils modifié");
  if (inventoryKey(previousState.optionInventory) !== inventoryKey(draftState.optionInventory)) otherChanges.push("Inventaire des modules modifié");
  return { zoneChanges, otherChanges };
}
