import { describe, expect, it } from "vitest";
import { buildKqScenarioPath, KQ_SITUATIONS, KQ_STAGES, resolveKqStage, rollKqDice, startKqGame } from "./kanab-quest-game";
import { createKqBusinessPreview } from "./kanab-quest-business";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

describe("company domicile and culture theft", () => {
  it("gives retired-address cultures the normal risk while preserving historical home odds", () => {
    const harvest = KQ_STAGES.indexOf("Récolte");
    const pool = KQ_SITUATIONS.filter(s => s.stage === "Récolte");
    let home = 0, external = 0;
    for (let seed = 0; seed < 10000; seed++) {
      const atHome = buildKqScenarioPath(seed, [], [], [], "home");
      const elsewhere = buildKqScenarioPath(seed, [], [], [], "external");
      expect(buildKqScenarioPath(seed, [], [], [], "retired")).toEqual(elsewhere);
      if (atHome[harvest] === "SIT-027") home++;
      if (elsewhere[harvest] === "SIT-027") {
        external++;
        expect(atHome[harvest]).toBe("SIT-027");
      }
      expect(atHome.filter((_, i) => i !== harvest)).toEqual(elsewhere.filter((_, i) => i !== harvest));
    }
    expect(external / 10000).toBeCloseTo(1 / pool.length, 1);
    expect(home / external).toBeGreaterThan(1.9);
    expect(home / external).toBeLessThan(2.1);
  });
  it("stores the selected domicile in the culture and its integrity code", () => {
    const state = startKqGame(42, { domiciliation: "home" });
    expect(state.domiciliation).toBe("home");
    expect(parseKqGameSave(encodeKqSave(state))?.domiciliation).toBe("home");
    expect(createKqIntegrityCode({ ...state, domiciliation: "external" })).not.toBe(createKqIntegrityCode(state));
    expect(parseKqGameSave(encodeKqSave({ ...state, domiciliation: "free-protection" }))).toBeNull();
  });
  it("preserves old cultures without inventing a new domicile or rerolling their path", () => {
    const legacy = startKqGame(42);
    expect(legacy.domiciliation).toBeUndefined();
    expect(parseKqGameSave(encodeKqSave(legacy))).toEqual(legacy);
    expect(legacy.situationCodes).toEqual(buildKqScenarioPath(42));
  });
  it("persists the retired rule in a new culture and its integrity signature", () => {
    const state = startKqGame(42, { domiciliation: "retired" });
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(state.situationCodes).toEqual(buildKqScenarioPath(42, [], [], [], "external"));
    expect(createKqIntegrityCode({ ...state, domiciliation: "home" })).not.toBe(createKqIntegrityCode(state));
  });
  it.each(["home", "external"] as const)("retains the frozen %s culture and its resolved history", domiciliation => {
    const state = resolveKqStage(rollKqDice(startKqGame(42, { domiciliation })));
    const saved = encodeKqSave(state);
    const integrity = createKqIntegrityCode(state);
    // A new business snapshot cannot reinterpret an already-started culture.
    expect(createKqBusinessPreview(0).domiciliation.retired).toBe(true);
    const restored = parseKqGameSave(saved)!;
    expect(restored).toEqual(state);
    expect(restored.history).toHaveLength(1);
    expect(createKqIntegrityCode(restored)).toBe(integrity);
  });
});
