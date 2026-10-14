import { describe, expect, it } from "vitest";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { getKqCampaignMemberState, getKqCampaignParticipants, isKqCampaign, type KqCampaign } from "./kanab-quest-campaign";
import { createKqWarehouseStarter, getKqWarehouseQuote } from "./kanab-quest-warehouse";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

function fixture() {
  const initial = createKqWarehouseStarter();
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
  it("retains each zone's quality advantage and harvest without stacking it on replay", () => {
    const { state, members } = fixture();
    let leader = state;
    while (leader.phase !== "complete") leader = { ...advanceKqStage(resolveKqStage({ ...leader, phase: "rolled", dice: [6, 6, 6] })), campaign: state.campaign };
    const own = getKqCampaignMemberState(leader, members[1]);
    expect(own.history).toEqual(leader.history);
    expect(own.care).toEqual(leader.care);
    expect(own.quality - leader.quality).toBe(2);
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
  });
});
