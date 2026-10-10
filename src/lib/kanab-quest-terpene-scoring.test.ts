import { describe, expect, it } from "vitest";
import { KQ_STAGES, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqFlower, createKqOpponent, getKqBattleRulesVersion, getKqJuryProgram, getKqJuryScoringCriteria, lockKqBattle, resolveKqBattle, type KqFlowerCard } from "./kanab-quest-battle";
import { getKqJuryAnalysis } from "./kanab-quest-jury-analysis";
import { getKqJuryScoreFromStats } from "./kanab-quest-market";

function completedCulture(rulesVersion: 2 | 3, terpenes = 65, cannabinoidExpression = 70): KqGameState {
  const state = startKqGame(42);
  return {
    ...state,
    rulesVersion,
    phase: "complete",
    quality: 3,
    traits: [],
    usedCards: [],
    situationCodes: ["SIT-001", "SIT-002", "SIT-003", "SIT-004", "SIT-005", "SIT-012"],
    care: { ...state.care!, terpenes, cannabinoidExpression },
    history: KQ_STAGES.map((stage) => ({ stage, situation: "Situation test", dice: [3, 3, 4], total: 2, target: 2, outcome: "success", trait: "Étape réussie" })),
  };
}

function flower(version: 2 | 3, cannabinoids = 70): KqFlowerCard {
  return {
    ...createKqOpponent(21, { rulesVersion: version }),
    stats: { appearance: 70, aroma: 70, vigor: 70, mastery: 70, regularity: 70, ...(version === 3 ? { cannabinoids } : {}) },
  };
}

describe("versioned aromatic and cannabinoid scoring", () => {
  it("keeps old Flower snapshots on their exact five-stat calculation", () => {
    const legacy = createKqFlower(completedCulture(2));
    expect(legacy.rulesVersion).toBeUndefined();
    expect(legacy.stats).toEqual({ appearance: 65.2, aroma: 72.7, vigor: 73.6, mastery: 90, regularity: 90 });
    expect(Object.keys(legacy.stats)).toHaveLength(5);
  });

  it("reads terpene expression from care and uses it to develop the aromatic score", () => {
    const low = createKqFlower(completedCulture(3, 45));
    const high = createKqFlower(completedCulture(3, 85));
    expect(low.rulesVersion).toBe(3);
    expect(Object.keys(low.stats)).toHaveLength(6);
    expect(low.stats).not.toHaveProperty("terpenes");
    expect({ ...low.stats, aroma: undefined }).toEqual({ ...high.stats, aroma: undefined });
    expect(low.stats.aroma).toBe(51.9);
    expect(high.stats.aroma).toBe(81.9);
    expect(createKqFlower({ ...completedCulture(3, 45), quality: 20 }).stats.cannabinoids).toBe(70);
    expect(createKqFlower(completedCulture(3, 99, -100)).stats.cannabinoids).toBe(35);
    expect(createKqFlower(completedCulture(3, 99, 200)).stats.cannabinoids).toBe(99);
    expect(createKqFlower({ ...completedCulture(3, 200), quality: 99 }).stats.aroma).toBe(99);
    expect(() => createKqFlower({ ...completedCulture(3), care: undefined })).toThrow("suivi des terpènes");
    expect(() => createKqFlower(completedCulture(3, NaN))).toThrow("suivi des terpènes");
  });

  it("does not reward a negative aromatic trait or a renamed trait under new rules", () => {
    const current = completedCulture(3);
    expect(createKqFlower({ ...current, traits: ["Arômes dissipés"] }).stats.aroma).toBe(createKqFlower(current).stats.aroma);
    expect(createKqFlower({ ...current, traits: ["Arômes merveilleux"] }).stats.aroma).toBe(createKqFlower(current).stats.aroma);
    const old = completedCulture(2);
    expect(createKqFlower({ ...old, traits: ["Arômes dissipés"] }).stats.aroma).toBe(createKqFlower(old).stats.aroma + 4);
    const preserved = { ...current, situationCodes: [...current.situationCodes.slice(0, 5), "SIT-006"] };
    expect(createKqFlower(preserved).stats.aroma).toBe(createKqFlower(current).stats.aroma + 1);
    const failed = { ...preserved, history: preserved.history.map((entry, index) => index === 5 ? { ...entry, outcome: "failure" as const } : entry) };
    expect(createKqFlower({ ...failed, traits: ["Arômes préservés"] }).stats.aroma).toBe(createKqFlower(failed).stats.aroma);
  });

  it("creates the additional bot statistic only for an explicitly new contest", () => {
    expect(createKqOpponent(42).stats.cannabinoids).toBeUndefined();
    expect(createKqOpponent(42, { rulesVersion: 2 }).stats.cannabinoids).toBeUndefined();
    const current = createKqOpponent(42, { rulesVersion: 3 });
    expect(current.rulesVersion).toBe(3);
    expect(current.stats.cannabinoids).toBeGreaterThanOrEqual(35);
    expect(current.stats.cannabinoids).toBeLessThanOrEqual(99);
    expect(current.stats.cannabinoids).toBe(current.cannabinoidReport?.score);
    expect(current.cannabinoidReport?.simulated).toBe(true);
  });

  it("versions all five aromatic rounds without changing archived definitions", () => {
    const codes = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const program = getKqJuryProgram(seed, [], 3);
      expect(program).toHaveLength(3);
      codes.add(program[1].code);
      expect(getKqJuryScoringCriteria(program[1].code)?.some((entry) => entry.stat === "aroma")).toBe(true);
      expect(getKqJuryScoringCriteria(program[1].code)?.map((entry) => String(entry.stat))).not.toContain("terpenes");
    }
    expect(codes.size).toBe(5);
    expect(getKqJuryScoringCriteria("terpene-table")).toEqual([{ stat: "aroma", weight: 0.65 }, { stat: "mastery", weight: 0.35 }]);
    expect(getKqJuryScoringCriteria("terpene-table-v3")).toEqual([{ stat: "aroma", weight: 0.65 }, { stat: "mastery", weight: 0.35 }]);
    expect(getKqJuryProgram(4, ["terpene-table"], 3)[1].code).not.toBe("terpene-table-v3");
  });

  it("uses the common legacy program for mixed generations or incomplete new snapshots", () => {
    const current = flower(3, 99), legacy = flower(2);
    const seed = 4;
    expect(getKqBattleRulesVersion(current, legacy)).toBe(2);
    expect(getKqBattleRulesVersion(legacy, current)).toBe(2);
    expect(getKqBattleRulesVersion(current, { ...current, stats: { ...current.stats, cannabinoids: NaN } })).toBe(2);
    expect(getKqBattleRulesVersion(current, { ...current, rulesVersion: 2 })).toBe(2);
    const mixed = resolveKqBattle(lockKqBattle(current, legacy, seed), seed);
    const old = resolveKqBattle(lockKqBattle(legacy, legacy, seed), seed);
    expect(mixed.rounds).toEqual(old.rounds);
    expect(mixed.rounds[1].code).toBe("terpene-table");
  });

  it("counts the resulting aromatic note only once and never re-adds its terpene index", () => {
    const seed = 4, opponent = flower(3);
    const low = resolveKqBattle(lockKqBattle(flower(3, 50), opponent, seed), seed);
    const high = resolveKqBattle(lockKqBattle(flower(3, 90), opponent, seed), seed);
    expect(high.rounds[1].code).toBe("terpene-table-v3");
    expect(high.rounds).toEqual(low.rounds);
    const developed = createKqFlower(completedCulture(3, 90));
    const weak = createKqFlower(completedCulture(3, 50));
    const developedResult = resolveKqBattle(lockKqBattle(developed, opponent, seed), seed);
    const weakResult = resolveKqBattle(lockKqBattle(weak, opponent, seed), seed);
    expect(developedResult.rounds[1].playerScore - weakResult.rounds[1].playerScore).toBeCloseTo(19.5);
    expect(developedResult.rounds[0]).toEqual(weakResult.rounds[0]);
    expect(developedResult.rounds[2]).toEqual(weakResult.rounds[2]);
    expect(resolveKqBattle(high, seed + 1)).toBe(high);
  });

  it("explains the criterion from the saved code and does not reinterpret a legacy table", () => {
    const rounds = [
      { code: "visual-impact", label: "Visuel", explanation: "", playerScore: 90, opponentScore: 70, winner: "player" as const },
      { code: "terpene-table-v3", label: "Table des terpènes", explanation: "", playerScore: 70, opponentScore: 76.5, winner: "opponent" as const },
      { code: "technical-jury", label: "Technique", explanation: "", playerScore: 90, opponentScore: 70, winner: "player" as const },
    ];
    const analysis = getKqJuryAnalysis({ rounds, playerStats: flower(3, 70).stats, opponentStats: { ...flower(3, 80).stats, aroma: 80 } })!;
    expect(analysis.focus.criteria[0]).toMatchObject({ stat: "aroma", label: "Terpènes et arômes", weightPercent: 65, weightedGap: -6.5 });
    expect(analysis.recommendations[0].stat).toBe("aroma");
    expect(analysis.recommendations[0].explanation).toContain("deuxième pondération");
    expect(analysis.limits.join(" ")).not.toContain("ne reconstituent pas");
    const legacyAnalysis = getKqJuryAnalysis({ rounds: rounds.map((round) => ({ ...round, code: round.code.replace(/-v3$/, "") })), playerStats: flower(3, 70).stats, opponentStats: flower(3, 80).stats })!;
    expect(legacyAnalysis.focus.criteria[0].stat).toBe("aroma");
  });

  it("keeps one aromatic axis in market estimates without counting terpene expression twice", () => {
    expect(getKqJuryScoreFromStats(flower(2).stats)).toBe(7);
    expect(getKqJuryScoreFromStats(flower(3).stats)).toBe(7);
    expect(getKqJuryScoreFromStats(flower(3, 50).stats)).toBe(6.7);
    expect(getKqJuryScoreFromStats(flower(3, 90).stats)).toBe(7.3);
    expect(getKqJuryScoreFromStats({ ...flower(3).stats, aroma: 80 })).toBe(7.2);
    expect(getKqJuryScoreFromStats({ ...flower(3).stats, terpenes: 99 })).toBe(7);
    expect(getKqJuryScoreFromStats({ ...flower(2).stats, terpenes: NaN })).toBe(7);
    expect(getKqJuryScoreFromStats({ ...flower(2).stats, terpenes: 999 })).toBe(7);
    expect(getKqJuryScoreFromStats({})).toBe(0);
  });

  it("records simulated profiles without rewarding a cultivar's concentration or THC content", () => {
    const first = createKqFlower({ ...completedCulture(3), varietyCode: "HH2026-001" });
    const second = createKqFlower({ ...completedCulture(3), varietyCode: "HH2026-002" });
    expect(first.cannabinoidReport?.rates).not.toEqual(second.cannabinoidReport?.rates);
    expect(first.cannabinoidReport?.simulated).toBe(true);
    expect(first.stats.cannabinoids).toBe(second.stats.cannabinoids);
    expect(first.stats.cannabinoids).toBe(first.cannabinoidReport?.score);
    expect(first.stats).toEqual(second.stats);
    expect(getKqJuryScoreFromStats(first.stats)).toBe(getKqJuryScoreFromStats(second.stats));
  });

  it("compares profile fidelity in the third jury group without changing the aromatic round", () => {
    const seed = 0, opponent = flower(3);
    const low = resolveKqBattle(lockKqBattle(flower(3, 50), opponent, seed), seed);
    const high = resolveKqBattle(lockKqBattle(flower(3, 90), opponent, seed), seed);
    expect(high.rounds).toHaveLength(3);
    expect(high.rounds[2].code).toBe("cannabinoid-fidelity-v3");
    expect(high.rounds[2].playerScore - low.rounds[2].playerScore).toBeCloseTo(26);
    expect(high.rounds.slice(0, 2)).toEqual(low.rounds.slice(0, 2));
    const analysis = getKqJuryAnalysis({
      rounds: [
        { ...high.rounds[0], playerScore: 90, opponentScore: 70, winner: "player" },
        { ...high.rounds[1], playerScore: 90, opponentScore: 70, winner: "player" },
        { ...high.rounds[2], playerScore: 57, opponentScore: 63.5, winner: "opponent" },
      ], playerStats: flower(3, 50).stats, opponentStats: flower(3, 60).stats,
    })!;
    expect(analysis.recommendations[0].stat).toBe("cannabinoids");
    expect(analysis.recommendations[0].explanation).toContain("aucun bonus");
    expect(analysis.focus.criteria[0]).toMatchObject({ stat: "cannabinoids", weightPercent: 65, weightedGap: -6.5 });
  });
});
