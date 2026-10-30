import { getKqEquipmentDefinition, isKqProcessingEquipment } from "./kanab-quest-equipment";
import { getKqWarehouseDevice, KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, type KqWarehouseOptionFamily } from "./kanab-quest-warehouse-options";

export type KqWarehouseDepartment = KqWarehouseOptionFamily | "lighting" | "air" | "drying" | "storage" | "workshop";
export type KqWarehouseShopTarget =
  | { kind: "catalog"; code: string; name: string; department: KqWarehouseDepartment }
  | { kind: "storage-climate"; code: string; name: string }
  | { kind: "workshop"; code: string }
  | { kind: "unavailable"; code: string; name?: string };

/** Resolve actual catalog identities only. An old culture model is not an equivalent new purchase. */
export function getKqWarehouseShopTarget(code?: string | null): KqWarehouseShopTarget | null {
  if (!code) return null;
  if (code === "COMPUTER" || isKqProcessingEquipment(code)) return { kind: "workshop", code };
  const option = getKqWarehouseOption(code);
  if (option) return { kind: "catalog", code, name: option.name, department: option.family };
  const device = getKqWarehouseDevice(code) ?? KQ_WAREHOUSE_CATALOG.find(item => item.legacyCode === code);
  if (device?.purchasable !== false) {
    if (device?.kind === "processing" && device.legacyCode) return { kind: "workshop", code: device.legacyCode };
    if (device?.kind === "climate" && device.room === "storage") return { kind: "storage-climate", code: device.code, name: device.name };
    if (device && (device.kind === "lighting" || device.kind === "air" || ((device.kind === "drying" || device.kind === "storage") && device.zoneLayout))) {
      return { kind: "catalog", code: device.code, name: device.name, department: device.kind };
    }
  }
  return { kind: "unavailable", code, name: device?.name ?? getKqEquipmentDefinition(code)?.name };
}

export function getKqWarehouseDepartment(room: "culture" | "drying" | "storage" | "processing"): KqWarehouseDepartment {
  return room === "culture" ? "lighting" : room === "processing" ? "workshop" : room;
}
