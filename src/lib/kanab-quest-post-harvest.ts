import { getKqWarehouseDevice, type KqWarehouseTier } from "./kanab-quest-warehouse-catalog";
import type { KqWarehouseRunSnapshot, KqWarehouseState } from "./kanab-quest-warehouse";

/** Fictional commercial-quality points out of ten; the jury score is never changed. */
export type KqPostHarvestProfile = {
  dryingQualityBonus: number;
  storageQualityBonus: number;
  climateQualityBonus: number;
  aromaRateFactor: number;
  chemistryRateFactor: number;
};

const qualityByTier = { drying: [0, .35, .7], storage: [0, .3, .6], climate: [.1, .25, .5] } as const;
const retentionByTier = { storage: [0, 25, 45], climate: [10, 25, 40] } as const;
const tierIndex = (tier: KqWarehouseTier | undefined) => tier === "premium" ? 2 : tier === "standard" ? 1 : 0;

/** A fully equipped chain of one tier, before individual container bonuses and ageing. */
export function getKqPostHarvestTierBenefits(tier: KqWarehouseTier) {
  const index = tierIndex(tier), dryingQualityBonus = qualityByTier.drying[index],
    storageQualityBonus = qualityByTier.storage[index], climateQualityBonus = qualityByTier.climate[index];
  return { dryingQualityBonus, storageQualityBonus, climateQualityBonus,
    qualityBonus: Math.round((dryingQualityBonus + storageQualityBonus + climateQualityBonus) * 100) / 100,
    retentionPercent: 100 - Math.ceil((100 - retentionByTier.storage[index]) * (100 - retentionByTier.climate[index]) / 100) };
}

export function getKqPostHarvestDeviceBenefits(code: string, balanceVersion: 1 | 2 = 2): { qualityBonus: number; retentionPercent: number } {
  const device = getKqWarehouseDevice(code);
  const tier = tierIndex(device?.tier);
  if (device?.kind === "drying") return { qualityBonus: balanceVersion === 1 ? tier * 20 / 100 : qualityByTier.drying[tier], retentionPercent: 0 };
  if (device?.kind === "storage") return { qualityBonus: balanceVersion === 1 ? tier * 15 / 100 : qualityByTier.storage[tier], retentionPercent: balanceVersion === 1 ? tier * 20 : retentionByTier.storage[tier] };
  if (device?.kind === "climate" && device.room === "storage") return { qualityBonus: balanceVersion === 1 ? (tier + 1) * 10 / 100 : qualityByTier.climate[tier], retentionPercent: balanceVersion === 1 ? (tier + 1) * 10 : retentionByTier.climate[tier] };
  return { qualityBonus: 0, retentionPercent: 0 };
}

/** Only installed rooms contribute. Extra purchased devices cannot stack bonuses. */
export function getKqWarehousePostHarvestProfile(state: KqWarehouseState, balanceVersion: 1 | 2 = 2): KqPostHarvestProfile {
  let dryingCapacity = 0, dryingQuality = 0, storageCapacity = 0, storageQuality = 0, storageRate = 0;
  for (const zone of state.serviceZones ?? []) {
    const device = getKqWarehouseDevice(zone.deviceCode);
    if (!device?.zoneLayout || device.kind !== zone.kind) continue;
    const capacity = zone.width * zone.height * device.zoneLayout.unitsPerM2 * device.zoneLayout.capacityGramsPerUnit;
    const benefits = getKqPostHarvestDeviceBenefits(device.code, balanceVersion);
    if (zone.kind === "drying") {
      dryingCapacity += capacity;
      dryingQuality += Math.round(benefits.qualityBonus * 100) * capacity;
    } else {
      storageCapacity += capacity;
      storageQuality += Math.round(benefits.qualityBonus * 100) * capacity;
      storageRate += (100 - benefits.retentionPercent) * capacity;
    }
  }
  const climate = storageCapacity > 0 && state.storageClimateCode ? getKqPostHarvestDeviceBenefits(state.storageClimateCode, balanceVersion) : { qualityBonus: 0, retentionPercent: 0 };
  const roomRate = storageCapacity ? Math.ceil(storageRate / storageCapacity) : 100;
  const factor = Math.ceil(roomRate * (100 - climate.retentionPercent) / 100);
  return {
    dryingQualityBonus: dryingCapacity ? Math.round(dryingQuality / dryingCapacity) / 100 : 0,
    storageQualityBonus: storageCapacity ? Math.round(storageQuality / storageCapacity) / 100 : 0,
    climateQualityBonus: climate.qualityBonus,
    aromaRateFactor: factor,
    chemistryRateFactor: factor,
  };
}

/** Drying belongs to the launched crop; storage uses the room available at harvest. */
export function getKqWarehouseRunPostHarvestProfile(run: KqWarehouseRunSnapshot, currentState: KqWarehouseState = run.sourceState): KqPostHarvestProfile {
  return { ...getKqWarehousePostHarvestProfile(currentState),
    dryingQualityBonus: getKqWarehousePostHarvestProfile(run.sourceState, run.postHarvestBalanceVersion === 2 ? 2 : 1).dryingQualityBonus };
}
