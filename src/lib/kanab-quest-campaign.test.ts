import { describe, expect, it } from "vitest";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { getKqCampaignMemberState, getKqCampaignParticipants, getKqCampaignWarehouse, isKqCampaign, type KqCampaign } from "./kanab-quest-campaign";
import { createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqWarehouseRunPostHarvestProfile } from "./kanab-quest-post-harvest";

function fixture() {
  const initial = { ...createKqWarehouseStarter(), optionInventory: [{ code: "SIM-CLIMATE-03", quantity: 2 }] };
  const plan = getKqWarehouseQuote({ ...initial, zones: [
    { ...initial.zones[0], id: "a", buddieCode: "HH2026-002" },
    { ...initial.zones[0], id: "b", x: 4, width: 2, buddieCode: "HH2026-003", optionCodes: ["SIM-CLIMATE-03", "SIM-NUTRITION-03"] },
  ] }, initial).nextState;
  const members = getKqCampaignParticipants(plan, 4).map((member, index) => ({ ...member,
    runId: `40000000-0000-4000-8000-00000000000${index + 1}` }));
  const campaign: KqCampaign = { version: 1, id: "50000000-0000-4000-8000-000000000001", leaderRunId: members[0].runId, members };
  const state = { ...startKqGame(300, { varietyCode: members[0].buddieCode, warehouse: members[0].warehouse,
    cultivationProfile: members[0].cultivationProfile }), campaign };
  return { state, members, campaign };
}

describe("shared decisions with different zone equipment", () => {
  it("excludes a preassigned commercial zone without changing the paid plan or old campaigns", () => {
    const { campaign, state } = fixture();
    const plan = structuredClone(campaign.members[0].warehouse.sourceState);
    const before = structuredClone(plan);
    const participants = getKqCampaignParticipants(plan, 4, undefined, "b");
    expect(participants.map(member => member.zoneId)).toEqual(["a"]);
    expect(plan).toEqual(before);
    expect(participants[0].warehouse.sourceState).toEqual(before);
    expect(participants[0].warehouse.productionReservedZoneId).toBe("b");
    const reservedCampaign = { ...campaign, members: participants.map(member => ({ ...member, runId: campaign.leaderRunId })) };
    expect(isKqCampaign(reservedCampaign)).toBe(true);
    const saved = { ...state, warehouse: reservedCampaign.members[0].warehouse, campaign: reservedCampaign };
    expect(parseKqGameSave(encodeKqSave(saved))).toEqual(saved);
    expect(getKqCampaignWarehouse(participants)?.activeAreaM2).toBe(1);
    expect(isKqCampaign(campaign)).toBe(true);
    expect(getKqCampaignParticipants(plan, 4, undefined, null)).toHaveLength(2);
    const missingReservation = structuredClone(reservedCampaign);
    delete missingReservation.members[0].warehouse.productionReservedZoneId;
    expect(isKqCampaign(missingReservation)).toBe(false);
  });

  it("rejects inconsistent or nonexistent frozen reservations and participating reserved zones", () => {
    const { campaign } = fixture();
    const source = campaign.members[0].warehouse.sourceState;
    expect(() => getKqCampaignParticipants(source, 4, undefined, "unknown")).toThrow("réservation");
    for (const id of ["unknown", "a", "b"]) {
      const changed = structuredClone(campaign);
      changed.members[0].warehouse.productionReservedZoneId = id;
      expect(isKqCampaign(changed)).toBe(false);
    }
  });

  it("keeps the frozen station allocation in a campaign preview when another active zone is excluded", () => {
    const zone = createKqWarehouseStarter().zones[0];
    const plan = getKqWarehouseQuote({ ...createKqWarehouseEmpty(), zones: [
      { ...zone, id: "staff", width: 4, height: 8 },
      { ...zone, id: "player", x: 9, y: 5, buddieCode: "HH2026-002" },
    ], stationPlacements: [{ id: "water", code: "SIM-WATER-03", x: 4, y: 4 },
      { id: "hygiene", code: "SIM-HYGIENE-03", x: 5, y: 9 }] }).nextState;
    const participants = getKqCampaignParticipants(plan, 1, undefined, "staff");
    expect(participants).toHaveLength(1);
    const run = participants[0].warehouse;
    expect(run.sourceState.stationService?.player).toMatchObject({ waterAreaM2: 0, hygieneAreaM2: 1 });
    expect(run).toMatchObject({ estimatedHarvestGrams: 187.5, consumablesCostCents: 2460, qualityBonus: 3 });
    expect(getKqCampaignWarehouse(participants)).toMatchObject({
      estimatedHarvestGrams: run.estimatedHarvestGrams, qualityBonus: run.qualityBonus,
      consumablesCostCents: run.consumablesCostCents, operatingCostCents: run.operatingCostCents,
    });
  });

  it("retains each zone's quality advantage and harvest without stacking it on replay", () => {
    const { state, members } = fixture();
    let leader = state;
    while (leader.phase !== "complete") leader = { ...advanceKqStage(resolveKqStage({ ...leader, phase: "rolled", dice: [6, 6, 6] })), campaign: state.campaign };
    const own = getKqCampaignMemberState(leader, members[1]);
    expect(own.history).toEqual(leader.history);
    expect(own.care).toEqual(leader.care);
    expect(own.quality - leader.quality).toBe(3);
    expect(own.harvestGrams).toBeGreaterThan(leader.harvestGrams!);
    expect(own.harvestGrams).toBeLessThanOrEqual(members[1].warehouse.estimatedHarvestGrams);
    expect(own.energy!.totalCents).not.toBe(leader.energy!.totalCents);
    expect(getKqCampaignMemberState(own, members[1])).toEqual(own);
    expect(getKqCampaignMemberState(own, members[0])).toEqual(leader);
    expect(parseKqGameSave(encodeKqSave(own))).toEqual(own);
  });

  it("never turns a failed common cycle into a crop through better equipment", () => {
    const { state, members } = fixture();
    const dead = resolveKqStage({ ...state, phase: "rolled", dice: [1, 1, 1], care: { ...state.care!, vitality: 1 } });
    const own = getKqCampaignMemberState(dead, members[1]);
    expect(own.cultureDead).toBe(true);
    expect(own.harvestGrams).toBe(0);
    expect(own.quality).toBe(dead.quality);
    expect(own.energy!.totalCents).toBeGreaterThan(0);
    expect(parseKqGameSave(encodeKqSave(own))).toEqual(own);
  });

  it("rejects a missing or duplicated participant and different frozen plans", () => {
    const { campaign } = fixture();
    expect(isKqCampaign(campaign)).toBe(true);
    expect(isKqCampaign({ ...campaign, members: campaign.members.slice(0, 1) })).toBe(false);
    expect(isKqCampaign({ ...campaign, members: [campaign.members[0], campaign.members[0]] })).toBe(false);
    const changed = structuredClone(campaign);
    changed.members[1].warehouse.sourceState.zones[0].name = "Changed after launch";
    expect(isKqCampaign(changed)).toBe(false);
    const mixedBalance = structuredClone(campaign);
    const member = mixedBalance.members[1];
    member.warehouse = getKqWarehouseRunSnapshot(member.warehouse.sourceState, 4, member.zoneId, 1);
    expect(isKqCampaign(mixedBalance)).toBe(false);
    const mixedClimate = structuredClone(campaign);
    const climateMember = mixedClimate.members[1];
    climateMember.warehouse = getKqWarehouseRunSnapshot(climateMember.warehouse.sourceState, 4, climateMember.zoneId, 2, 1);
    expect(isKqCampaign(mixedClimate)).toBe(false);
    const mixedPostHarvest = structuredClone(campaign);
    const harvestMember = mixedPostHarvest.members[1];
    harvestMember.warehouse = getKqWarehouseRunSnapshot(harvestMember.warehouse.sourceState, 4, harvestMember.zoneId, 2, 2, 1);
    expect(isKqCampaign(mixedPostHarvest)).toBe(false);
  });

  it("keeps historical campaign summaries on the original balance", () => {
    const { members } = fixture();
    const oldMembers = members.map(member => ({ ...member,
      warehouse: getKqWarehouseRunSnapshot(member.warehouse.sourceState, 4, member.zoneId, 1) }));
    const oldSummary = getKqCampaignWarehouse(oldMembers)!;
    expect(oldSummary).not.toHaveProperty("balanceVersion");
    expect(oldSummary.qualityBonus).toBe(1);
    expect(oldSummary.estimatedHarvestGrams).toBe(765);
    const current = getKqCampaignWarehouse(members)!;
    expect(current.balanceVersion).toBe(2);
    expect(current.qualityBonus).toBe(3);
    expect(current.estimatedHarvestGrams).toBe(780);
  });

  it("preserves historical climate charges and drying tiers in a campaign aggregate", () => {
    const { campaign } = fixture(), room = campaign.members[0].warehouse.sourceState;
    const equipped = getKqWarehouseQuote({ ...room, storageClimateCode: "SIM-STORAGE-CLIMATE-03",
      serviceZones: room.serviceZones!.map(zone => zone.kind === "drying" ? { ...zone, deviceCode: "SIM-DRYING-03" } : zone) }, room).nextState;
    const historical = { ...campaign, members: campaign.members.map(member => ({ ...member,
      warehouse: getKqWarehouseRunSnapshot(equipped, 4, member.zoneId, 2, 1, 1) })) };
    expect(isKqCampaign(historical)).toBe(true);
    const aggregate = getKqCampaignWarehouse(historical.members)!;
    expect(aggregate.climateBillingVersion).toBeUndefined();
    expect(aggregate.postHarvestBalanceVersion).toBeUndefined();
    expect(aggregate.energyCostCents).toBe(getKqWarehouseRunSnapshot(equipped, 4, undefined, 2, 1, 1).energyCostCents);
    expect(getKqWarehouseRunPostHarvestProfile(aggregate).dryingQualityBonus).toBe(.4);
    const current = getKqCampaignWarehouse(getKqCampaignParticipants(equipped, 4))!;
    expect(current.climateBillingVersion).toBe(2);
    expect(current.postHarvestBalanceVersion).toBe(2);
    expect(current.energyCostCents).toBeLessThan(aggregate.energyCostCents);
    expect(getKqWarehouseRunPostHarvestProfile(current).dryingQualityBonus).toBe(.7);
  });
});
