import { KQ_BUDDIES, getKqRunProjection, isKqCultureDead, type KqGameState } from "./kanab-quest-game";
import { getKqBuddieCultivationProfile, isKqBuddieCultivationProfile, type KqBuddieCultivationProfile } from "./kanab-quest-buddie-cultivation";
import { getKqWarehouseRunSnapshot, isKqWarehouseRunSnapshot, type KqWarehouseRunSnapshot, type KqWarehouseState } from "./kanab-quest-warehouse";
import { quoteKqWarehouseEnergy } from "./kanab-quest-warehouse-run";
import type { KqWarehouseCondition } from "./kanab-quest-warehouse-condition";

export type KqCampaignParticipant = {
  zoneId: string;
  buddieCode: string;
  warehouse: KqWarehouseRunSnapshot;
  cultivationProfile: KqBuddieCultivationProfile;
};
export type KqCampaignMember = KqCampaignParticipant & { runId: string };
export type KqCampaign = { version: 1; id: string; leaderRunId: string; members: KqCampaignMember[] };

/** All assigned active zones join together. The order does not depend on UI selection. */
export function getKqCampaignParticipants(state: KqWarehouseState, revision: number, condition?: KqWarehouseCondition): KqCampaignParticipant[] {
  return state.zones.filter(zone => zone.active && zone.buddieCode)
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map(zone => ({ zoneId: zone.id, buddieCode: zone.buddieCode!,
      warehouse: getKqWarehouseRunSnapshot(state, revision, zone.id, 2, 2, 2, condition),
      cultivationProfile: getKqBuddieCultivationProfile(zone.buddieCode!),
    }));
}

export function getKqCampaignTotals(members: readonly KqCampaignParticipant[]) {
  return members.reduce((total, member) => ({
    areaM2: total.areaM2 + member.warehouse.activeAreaM2,
    energyCostCents: total.energyCostCents + member.warehouse.energyCostCents,
    consumablesCostCents: total.consumablesCostCents + member.warehouse.consumablesCostCents,
    estimatedHarvestGrams: Math.round((total.estimatedHarvestGrams
      + member.warehouse.estimatedHarvestGrams * member.cultivationProfile.yieldFactor) * 10) / 10,
  }), { areaM2: 0, energyCostCents: 0, consumablesCostCents: 0, estimatedHarvestGrams: 0 });
}

/** Display-only aggregate. Every member keeps its own authoritative V2 snapshot. */
export function getKqCampaignWarehouse(members: readonly KqCampaignParticipant[]): KqWarehouseRunSnapshot | null {
  if (!members.length) return null;
  const included = new Set(members.map(member => member.zoneId));
  const first = members[0].warehouse;
  return getKqWarehouseRunSnapshot({ ...first.sourceState,
    zones: first.sourceState.zones.map(zone => ({ ...zone, active: included.has(zone.id) })),
  }, first.revision, undefined, first.balanceVersion ?? 1, first.climateBillingVersion ?? 1, first.postHarvestBalanceVersion ?? 1, first.cultureEquipment);
}

/** Project one shared decision journal without replaying dice, cards or care.
 * The zone's identity, equipment and genetic potential remain frozen. */
export function getKqCampaignMemberState(state: KqGameState, member: KqCampaignMember): KqGameState {
  const buddie = KQ_BUDDIES.find(item => item.code === member.buddieCode);
  if (!buddie) throw new Error("Buddie de campagne inconnu.");
  const dead = isKqCultureDead(state);
  const own: KqGameState = {
    ...state,
    varietyCode: member.buddieCode, varietyName: buddie.name,
    warehouse: member.warehouse, cultivationProfile: member.cultivationProfile,
    energy: quoteKqWarehouseEnergy(member.warehouse),
    quality: dead ? state.quality : state.quality - (state.warehouse?.qualityBonus ?? 0) + (member.warehouse.qualityBonus ?? 0),
  };
  if (state.phase === "complete" && !dead) {
    const beforeHarvest = { ...own, phase: "resolved" as const,
      quality: own.quality - (state.equipmentQualityBonus ?? 0) };
    delete beforeHarvest.harvestGrams;
    delete beforeHarvest.equipmentQualityBonus;
    const projection = getKqRunProjection(beforeHarvest);
    own.quality = projection.projectedQuality;
    own.equipmentQualityBonus = projection.equipmentQualityBonus;
    own.harvestGrams = projection.harvestGrams;
  }
  return own;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Validate the immutable manifest, including its agreement with the saved floor plan. */
export function isKqCampaign(value: unknown): value is KqCampaign {
  if (!record(value) || value.version !== 1 || typeof value.id !== "string" || !uuid.test(value.id)
    || typeof value.leaderRunId !== "string" || !uuid.test(value.leaderRunId)
    || !Array.isArray(value.members) || !value.members.length || value.members.length > 52) return false;
  const runs = new Set<string>(), zones = new Set<string>(), buddies = new Set<string>();
  let source: string | undefined, revision: number | undefined, balanceVersion: number | undefined,
    climateBillingVersion: number | undefined, postHarvestBalanceVersion: number | undefined, condition: string | undefined;
  for (const member of value.members) {
    if (!record(member) || typeof member.runId !== "string" || !uuid.test(member.runId)
      || typeof member.zoneId !== "string" || typeof member.buddieCode !== "string"
      || !isKqWarehouseRunSnapshot(member.warehouse) || member.warehouse.version !== 2
      || member.warehouse.zoneId !== member.zoneId || member.warehouse.zones[0]?.buddieCode !== member.buddieCode
      || !isKqBuddieCultivationProfile(member.cultivationProfile)
      || member.cultivationProfile.buddieCode !== member.buddieCode
      || runs.has(member.runId) || zones.has(member.zoneId) || buddies.has(member.buddieCode)) return false;
    const ownSource = JSON.stringify(member.warehouse.sourceState);
    const ownBalance = member.warehouse.balanceVersion ?? 1;
    const ownClimateBilling = member.warehouse.climateBillingVersion ?? 1;
    const ownPostHarvestBalance = member.warehouse.postHarvestBalanceVersion ?? 1;
    const ownCondition = JSON.stringify(member.warehouse.cultureEquipment ?? null);
    if (source !== undefined && (source !== ownSource || revision !== member.warehouse.revision || balanceVersion !== ownBalance
      || climateBillingVersion !== ownClimateBilling || postHarvestBalanceVersion !== ownPostHarvestBalance || condition !== ownCondition)) return false;
    source = ownSource; revision = member.warehouse.revision; balanceVersion = ownBalance;
    climateBillingVersion = ownClimateBilling; postHarvestBalanceVersion = ownPostHarvestBalance;
    condition = ownCondition;
    runs.add(member.runId); zones.add(member.zoneId); buddies.add(member.buddieCode);
  }
  const members = value.members as KqCampaignMember[];
  const expected = members[0].warehouse.sourceState.zones.filter(zone => zone.active && zone.buddieCode);
  return runs.has(value.leaderRunId) && members[0].runId === value.leaderRunId
    && expected.length === members.length && expected.every(zone => zones.has(zone.id))
    && members.every((member, index) => index === 0 || members[index - 1].zoneId < member.zoneId);
}
