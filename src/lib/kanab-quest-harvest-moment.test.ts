import { describe, expect, it } from "vitest";
import type { KqOfficialFlower } from "./kanab-quest-api";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "./kanab-quest-campaign";
import { advanceKqStage, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqHarvestMoment } from "./kanab-quest-harvest-moment";
import { createKqWarehouseStarter, getKqWarehouseQuote } from "./kanab-quest-warehouse";

const complete = (): KqGameState => ({
  ...startKqGame(300), phase: "complete", harvestGrams: 180.5, quality: 9,
});
const flower = (runId: string, quality = 9): KqOfficialFlower => ({
  id: `flower-${runId}`, runId, quality, varietyCode: "HH2026-002", varietyName: "Buddie",
  traits: [], combos: [], stats: {}, status: "available", createdAt: "2026-10-20T12:00:00Z",
  queuedAt: null, lockedAt: null, burnedAt: null,
});

function campaign() {
  const initial = createKqWarehouseStarter();
  const plan = getKqWarehouseQuote({ ...initial, zones: [
    { ...initial.zones[0], id: "a", buddieCode: "HH2026-002" },
    { ...initial.zones[0], id: "b", x: 4, width: 2, buddieCode: "HH2026-003", optionCodes: ["SIM-CLIMATE-03", "SIM-NUTRITION-03"] },
  ] }, initial).nextState;
  const members = getKqCampaignParticipants(plan, 4).map((member, index) => ({ ...member, runId: `run-${index}` }));
  let state: KqGameState = {
    ...startKqGame(300, { varietyCode: members[0].buddieCode, warehouse: members[0].warehouse, cultivationProfile: members[0].cultivationProfile }),
    campaign: { version: 1, id: "campaign", leaderRunId: members[0].runId, members },
  };
  while (state.phase !== "complete") {
    state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] }));
  }
  return state;
}

describe("terminal harvest moment", () => {
  it("does not turn a culture forecast into a harvest result", () => {
    expect(getKqHarvestMoment(startKqGame(300))).toBeNull();
  });

  it("uses terminal quantities without manufacturing official confirmation", () => {
    const result = getKqHarvestMoment(complete(), [flower("older")]);
    expect(result).toMatchObject({
      outcome: "harvest", totalGrams: 180.5, qualityRange: { min: 9, max: 9 }, confirmedFlowers: 0, harvestCount: 1,
    });
  });

  it("accepts official quality only from the exact solo run", () => {
    const result = getKqHarvestMoment(complete(), [flower("older", 18), flower("current", 10)], "current");
    expect(result?.confirmedFlowers).toBe(1);
    expect(result?.qualityRange).toEqual({ min: 10, max: 10 });
    expect(result?.totalGrams).toBe(180.5);
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, -1])("keeps missing or invalid harvest grams unknown: %s", harvestGrams => {
    const result = getKqHarvestMoment({ ...complete(), harvestGrams });
    expect(result).toMatchObject({ outcome: "unknown", totalGrams: null, qualityRange: null, harvestCount: 0 });
  });

  it("does not celebrate a terminal loss even with stale matching flowers", () => {
    const result = getKqHarvestMoment({ ...complete(), cultureDead: true }, [flower("current")], "current");
    expect(result).toMatchObject({ outcome: "dead", totalGrams: 0, qualityRange: null, confirmedFlowers: 0 });
  });

  it("distinguishes a known empty harvest from missing data", () => {
    expect(getKqHarvestMoment({ ...complete(), harvestGrams: 0 })).toMatchObject({ outcome: "empty", totalGrams: 0 });
  });

  it("sums member harvests while showing a range of quality points", () => {
    const state = campaign();
    const own = state.campaign!.members.map(member => getKqCampaignMemberState(state, member));
    const result = getKqHarvestMoment(state, [flower("unrelated", 100), flower("run-0", own[0].quality)]);
    expect(result?.totalGrams).toBe(Math.round(own.reduce((sum, member) => sum + member.harvestGrams!, 0) * 10) / 10);
    expect(result?.qualityRange).toEqual({ min: Math.min(...own.map(member => member.quality)), max: Math.max(...own.map(member => member.quality)) });
    expect(result?.confirmedFlowers).toBe(1);
    expect(result?.harvestCount).toBe(2);
    expect(result?.rows[0].grams).not.toBe(result?.rows[1].grams);
  });

  it("does not present a partial campaign total as a full harvest", () => {
    const state = campaign();
    state.campaign!.members[1].buddieCode = "unknown-buddie";
    const result = getKqHarvestMoment(state);
    expect(result?.totalGrams).toBeNull();
    expect(result?.qualityRange).toBeNull();
    expect(result?.rows[1]).toMatchObject({ grams: null, quality: null });
  });
});
