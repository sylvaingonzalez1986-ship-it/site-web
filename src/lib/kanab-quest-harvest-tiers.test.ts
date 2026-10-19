import { describe, expect, it } from "vitest";
import { getKqHarvestTier, getKqHarvestTierProgress, type KqHarvestTierContext } from "./kanab-quest-harvest-tiers";
import { advanceKqStage, getKqRunProjection, playKqCard, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqFlower, createKqOpponent, lockKqBattle } from "./kanab-quest-battle";
import { createKqIntegrityCode, encodeKqSave, parseKqBattleSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqHeritageEffectTemplate } from "./kanab-quest-heritage";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";

const qualified: KqHarvestTierContext = { harvestTierVersion: 2, successfulStages: 4, criticalStages: 2 };

function completedCulture(): KqGameState {
  let state = startKqGame(42, { deckCodes: [], equipmentCodes: [] });
  while (state.phase !== "complete") {
    state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [4, 5, 6] }));
  }
  return state;
}

describe("versioned harvest distinctions", () => {
  it.each([
    [0, "Récolte artisanale"], [7, "Récolte artisanale"],
    [8, "Belle pousse"], [13, "Belle pousse"],
    [14, "Qualité concours"], [19, "Qualité concours"],
    [20, "Fleur exceptionnelle"], [25, "Fleur exceptionnelle"],
    [26, "Fleur légendaire"],
  ])("classifies quality %s on the new scale", (quality, expected) => {
    expect(getKqHarvestTier(Number(quality), qualified)).toBe(expected);
  });

  it("keeps the original scale when the harvest version is absent", () => {
    expect([0, 6, 10, 14].map(quality => getKqHarvestTier(quality))).toEqual([
      "Récolte artisanale", "Belle pousse", "Qualité concours", "Fleur légendaire",
    ]);
    expect(getKqHarvestTierProgress(14).legendaryRequirements).toBeNull();
  });

  it("requires both performance conditions, even far above 26 quality", () => {
    expect(getKqHarvestTier(40, { ...qualified, successfulStages: 3 })).toBe("Fleur exceptionnelle");
    expect(getKqHarvestTier(40, { ...qualified, criticalStages: 1 })).toBe("Fleur exceptionnelle");
    expect(getKqHarvestTier(40, { harvestTierVersion: 2 })).toBe("Fleur exceptionnelle");
    expect(getKqHarvestTier(40, { ...qualified, successfulStages: 99 })).toBe("Fleur exceptionnelle");
    expect(getKqHarvestTier(40, { ...qualified, criticalStages: 5 })).toBe("Fleur exceptionnelle");
    expect(getKqHarvestTier(40, { ...qualified, successfulStages: 4.5 })).toBe("Fleur exceptionnelle");
  });

  it("uses the journal over supplied counters and keeps an unmet goal visible", () => {
    const result = getKqHarvestTierProgress(26, {
      ...qualified,
      history: Array.from({ length: 6 }, () => ({ outcome: "fragile" as const })),
    });
    expect(result).toMatchObject({
      tier: "Fleur exceptionnelle", nextTier: "Fleur légendaire", qualityToNextTier: 0,
      successfulStages: 0, criticalStages: 0,
      legendaryRequirements: { qualityMet: true, successfulStagesMet: false, criticalStagesMet: false, met: false },
    });
  });

  it("counts a critical toward both the successful and critical stage requirements", () => {
    expect(getKqHarvestTier(26, { harvestTierVersion: 2, history: [
      { outcome: "critical" }, { outcome: "critical" }, { outcome: "success" },
      { outcome: "success" }, { outcome: "fragile" }, { outcome: "failure" },
    ] })).toBe("Fleur légendaire");
  });

  it("projects the score and remaining conditions without promoting a weak high-score culture", () => {
    const finished = completedCulture();
    const state = { ...finished, quality: 26, history: finished.history.map(entry => ({ ...entry, outcome: "fragile" as const })) };
    expect(getKqRunProjection(state)).toMatchObject({
      projectedQuality: 26, tier: "Fleur exceptionnelle", nextTier: "Fleur légendaire",
      qualityToNextTier: 0, successfulStages: 0, criticalStages: 0, remainingStages: 0,
      legendaryRequirements: { qualityMet: true, successfulStagesMet: false, criticalStagesMet: false },
    });
    expect(getKqRunProjection({ ...finished, quality: 26 })).toMatchObject({
      tier: "Fleur légendaire", nextTier: null, legendaryRequirements: { met: true },
    });
    expect(getKqRunProjection({ ...state, cultureDead: true, harvestGrams: 0 })).toMatchObject({
      tier: "Culture morte", nextTier: null, legendaryRequirements: null,
    });
  });

  it("starts new cultures on v2 and preserves that version through save and completion", () => {
    const state = completedCulture();
    expect(state.harvestTierVersion).toBe(2);
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    const legacy = { ...state };
    delete legacy.harvestTierVersion;
    const restored = parseKqGameSave(encodeKqSave(legacy))!;
    expect(restored).toEqual(legacy);
    expect(restored).not.toHaveProperty("harvestTierVersion");
    expect(getKqRunProjection(restored).tier).toBe("Fleur légendaire");
    expect(getKqRunProjection(state).tier).toBe("Qualité concours");
    expect(createKqIntegrityCode(state)).not.toBe(createKqIntegrityCode(legacy));
    expect(createKqIntegrityCode(restored)).toBe(createKqIntegrityCode(legacy));
  });

  it.each([null, 1, 3, "2"])("rejects unsupported harvest version %s", version => {
    expect(parseKqGameSave(encodeKqSave({ ...startKqGame(42), harvestTierVersion: version }))).toBeNull();
  });

  it("freezes Flower evidence without changing jury statistics or historical distinctions", () => {
    const state = { ...completedCulture(), quality: 26 };
    const flower = createKqFlower(state);
    expect(flower).toMatchObject({ harvestTierVersion: 2, successfulStages: 6, criticalStages: 6, tier: "Fleur légendaire" });
    const legacy = { ...state };
    delete legacy.harvestTierVersion;
    const historical = createKqFlower(legacy);
    expect(historical).not.toHaveProperty("harvestTierVersion");
    expect(historical).not.toHaveProperty("successfulStages");
    expect(historical.stats).toEqual(flower.stats);
    expect(createKqFlower({ ...state, quality: 14 }).tier).toBe("Qualité concours");
    expect(createKqFlower({ ...legacy, quality: 14 }).tier).toBe("Fleur légendaire");
  });

  it("round-trips new Flower evidence and rejects impossible legendary snapshots", () => {
    const battle = lockKqBattle(createKqFlower({ ...completedCulture(), quality: 26 }), createKqOpponent(42), 42);
    expect(parseKqBattleSave(encodeKqSave(battle))).toEqual(battle);
    for (const changed of [{ criticalStages: 1 }, { successfulStages: 3 }, { criticalStages: 7 }, { harvestTierVersion: 3 }, { criticalStages: undefined }]) {
      expect(parseKqBattleSave(encodeKqSave({ ...battle, playerFlower: { ...battle.playerFlower, ...changed } }))).toBeNull();
    }
  });

  it("saves the real seven-point harvest combo and its 41-point completed Flower", () => {
    const starter = createKqWarehouseStarter();
    const warehouse = getKqWarehouseQuote({ ...starter, zones: starter.zones.map(zone => ({
      ...zone, lightingCode: "SIM-LIGHT-03", airCode: "SIM-AIR-03",
      optionCodes: ["SIM-CLIMATE-03", "SIM-HYGIENE-03"],
    })) }, starter).nextState;
    let state = startKqGame(42, {
      warehouse: getKqWarehouseRunSnapshot(warehouse),
      deckCodes: ["BOTTE-016", "BOTTE-032", "BOTTE-041"],
      heritageCard: { ...getKqHeritageEffectTemplate("critical-quality-boost"), code: "HERITAGE-999" },
    });
    state.situationCodes[4] = "SIT-005";
    state.situationCodes[5] = "SIT-006";
    expect(state.quality).toBe(8);
    while (state.phase !== "complete") {
      if (state.stageIndex === 4) {
        state = playKqCard(state, "BOTTE-032");
        state = playKqCard({ ...state, phase: "rolled", dice: [2, 4, 5] }, "BOTTE-041");
        expect(state.dice).toEqual([6, 4, 5]);
      } else {
        if (state.stageIndex === 5) state = playKqCard(state, "BOTTE-016");
        state = { ...state, phase: "rolled", dice: [4, 5, 6] };
      }
      const resolved = resolveKqStage(state);
      expect(parseKqGameSave(encodeKqSave(resolved))).toEqual(resolved);
      state = advanceKqStage(resolved);
    }
    expect(state.history.map(entry => entry.qualityDelta)).toEqual([5, 5, 5, 5, 7, 6]);
    expect(state.quality).toBe(41);
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(createKqFlower(state)).toMatchObject({ tier: "Fleur légendaire", successfulStages: 6, criticalStages: 6 });
    expect(parseKqGameSave(encodeKqSave({ ...state, history: state.history.map((entry, index) => index === 4 ? { ...entry, qualityDelta: 8 } : entry) }))).toBeNull();
  });
});
