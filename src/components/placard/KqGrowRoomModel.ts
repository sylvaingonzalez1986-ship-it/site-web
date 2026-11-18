import { KQ_STAGES } from "@/lib/kanab-quest-game";
import type { KqCareSector } from "@/lib/kanab-quest-care-spatial";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseOption } from "@/lib/kanab-quest-warehouse-options";

export type KqGrowRoomZone = {
  id: string;
  name: string;
  kind?: "culture" | "drying" | "storage";
  deviceCode?: string;
  contentLabel?: string;
  contentState?: "occupied" | "empty" | "unknown";
  stageIndex?: number | null;
  status?: "idle" | "growing" | "complete" | "dead" | "paused" | "reserved" | "unknown";
  variety?: string;
  lightingCode?: string;
  powered?: boolean;
  airCode?: string;
  supportCode?: string;
  optionCodes?: readonly string[];
  effects?: readonly string[];
  affectedPlants?: readonly KqAffectedPlant[];
  protectedSectors?: readonly KqCareSector[];
  inputSectors?: readonly KqCareSector[];
  attention?: string;
  areaM2?: number;
};

export type KqGrowRoomEvent = {
  id: string | number;
  zoneId: string;
  gesture: "inspect" | "water" | "tend" | "harvest" | "repair" | "card" | "dice" | "dry" | "store" | "pbi" | "sweep" | "spread" | "pour";
  target?: KqCareSector;
};

export function growRoomGestureDuration(gesture: KqGrowRoomEvent["gesture"]) {
  switch (gesture) {
    case "sweep": return 3.2;
    case "spread": case "pour": return 2.2;
    case "harvest": case "dry": return 1.48;
    case "store": return 1.28;
    default: return 1.08;
  }
}

export type KqAffectedPlant = KqCareSector & { slot: 0 | 1 | 2 | 3; label?: string };
export type KqPbiTargeting = { eligible: readonly KqCareSector[]; onSelect: (target: KqCareSector) => void; busy?: boolean };
export const roomSectorKey = (sector: KqCareSector) => [sector.zoneId, sector.x, sector.y].join(":");
export function growRoomDeckHeight(zone?: KqGrowRoomZone) {
  const support = zone?.supportCode ?? zone?.optionCodes?.find(code => code.includes("SUBSTRATE"));
  return support?.endsWith("02") ? .27 : .075;
}

export const BAY_WIDTH = 254;
export const ROOM_HEIGHT = 258;
export const END_WALL = 100;
export const PAGE_SIZE = 3;
export const bayOrigin = (index: number) => 22 + index * BAY_WIDTH;

export function plantStage(zone: KqGrowRoomZone) {
  if (zone.status === "dead") return "dead";
  if (zone.status === "complete") return "complete";
  if (zone.status === "idle" || zone.status === "reserved" || zone.status === "paused") return "empty";
  return typeof zone.stageIndex === "number" && KQ_STAGES[zone.stageIndex] ? zone.stageIndex : "empty";
}

export function zoneStatus(zone: KqGrowRoomZone) {
  if (zone.kind === "drying" || zone.kind === "storage") return zone.contentLabel || (zone.kind === "drying" ? "Séchoir" : "Stockage");
  if (zone.status === "dead") return "Culture perdue";
  if (zone.status === "complete") return "Culture terminée";
  if (zone.status === "reserved") return "Production autonome";
  if (zone.status === "unknown") return "État de culture indisponible";
  if (zone.status === "paused") return "Zone en pause";
  const stage = plantStage(zone);
  if (typeof stage === "number") return KQ_STAGES[stage];
  return zone.status === "growing" ? "Culture en cours" : "Zone au repos";
}

export function roomEquipmentName(code: string) {
  return getKqWarehouseDevice(code)?.name ?? getKqWarehouseOption(code)?.name ?? getKqEquipmentDefinition(code)?.name ?? code;
}

export function plantSeed(text: string) {
  let seed = 0;
  for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return seed;
}
