import { getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseOption } from "./kanab-quest-warehouse-options";
import { isKqWarehouseCondition, type KqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import type { KqWarehouseSummary } from "./kanab-quest-warehouse";

export type KqWarehouseReserveWearGroup = { quantity: number; wearPercent: number | null };

/** Display only this reserve's quantities; missing condition is never treated as new. */
function reserveWearGroups(kind: "device" | "option", code: string, quantity: number, condition?: KqWarehouseCondition | null): KqWarehouseReserveWearGroup[] {
  const groups = new Map<number, number>();
  for (const asset of condition?.assets ?? []) {
    if (asset.zoneId !== null || asset.kind !== kind || asset.code !== code) continue;
    groups.set(asset.wearPercent, (groups.get(asset.wearPercent) ?? 0) + asset.quantity);
  }
  const tracked = [...groups.values()].reduce((sum, value) => sum + value, 0);
  if (tracked > quantity) return [{ quantity, wearPercent: null }];
  const result: KqWarehouseReserveWearGroup[] = [...groups].sort(([a], [b]) => a - b).map(([wearPercent, count]) => ({ quantity: count, wearPercent }));
  if (tracked < quantity) result.push({ quantity: quantity - tracked, wearPercent: null });
  return result;
}

export function getKqWarehouseReserveView(summary: Pick<KqWarehouseSummary, "reserve" | "optionReserve">, condition?: KqWarehouseCondition | null) {
  const validCondition = isKqWarehouseCondition(condition) ? condition : undefined;
  return {
    hardware: summary.reserve.filter(item => item.quantity > 0).map(item => {
      const device = getKqWarehouseDevice(item.code);
      const tracked = device?.kind === "lighting" || device?.kind === "air";
      return { ...item, device, wearGroups: tracked ? reserveWearGroups("device", item.code, item.quantity, validCondition) : null };
    }),
    modules: summary.optionReserve.filter(item => item.quantity > 0).map(item => ({
      ...item, option: getKqWarehouseOption(item.code), wearGroups: reserveWearGroups("option", item.code, item.quantity, validCondition),
    })),
  };
}
