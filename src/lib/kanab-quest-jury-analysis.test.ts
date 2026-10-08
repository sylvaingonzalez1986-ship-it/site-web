import { describe, expect, it } from "vitest";
import { createKqOpponent, getKqJuryProgram, getKqJuryScoringCriteria, invertKqBattlePerspective, lockKqBattle, resolveKqBattle, type KqBattleRound, type KqFlowerCard } from "./kanab-quest-battle";
import { getKqJuryAnalysis } from "./kanab-quest-jury-analysis";

const round = (code: string, playerScore: number, opponentScore: number, winner: "player" | "opponent" = playerScore > opponentScore ? "player" : "opponent"): KqBattleRound => ({ code, label: code, explanation: "", playerScore, opponentScore, winner });
const scores = [round("visual-impact", 90, 91), round("blind-aroma", 60, 50), round("technical-jury", 85, 95)];
const stats = (overrides: Partial<KqFlowerCard["stats"]> = {}): KqFlowerCard["stats"] => ({ appearance: 70, aroma: 70, vigor: 70, mastery: 70, regularity: 70, ...overrides });

describe("jury analysis grounded in the recorded round", () => {
  it("focuses the nearest lost round rather than the lowest absolute score", () => {
    const analysis = getKqJuryAnalysis({ rounds: scores })!;
    expect(analysis.wins).toBe(1);
    expect(analysis.focus).toMatchObject({ code: "visual-impact", margin: -1, tied: false });
    expect(analysis.summary).toContain("90 contre 91");
    expect(analysis.summary).toContain("1 point de retard");
    expect(analysis.focus.reason).toContain("Impossible d’identifier");
    expect(analysis.focus.criteria.map(item => [item.stat, item.weightPercent])).toEqual([["appearance", 65], ["vigor", 35]]);
    expect(analysis.focus.criteria.every(item => item.weightedGap === null)).toBe(true);
    expect(analysis.limits.join(" ")).toContain("statistiques complètes");
    expect(analysis.recommendations[0].title).toContain("Repère");
  });

  it("shows actual weighted contributions and can select the secondary criterion as the useful lever", () => {
    const analysis = getKqJuryAnalysis({
      rounds: [round("visual-impact", 72, 76.2), round("blind-aroma", 50, 70), round("technical-jury", 85, 80)],
      playerStats: stats({ appearance: 80, vigor: 60 }), opponentStats: stats({ appearance: 81, vigor: 70 }),
    })!;
    expect(analysis.focus.criteria).toMatchObject([
      { stat: "appearance", playerValue: 80, opponentValue: 81, weightedGap: -0.65 },
      { stat: "vigor", playerValue: 60, opponentValue: 70, weightedGap: -3.5 },
    ]);
    expect(analysis.facts.join(" ")).toContain("73");
    expect(analysis.facts.join(" ")).toContain("77,15");
    expect(analysis.recommendations[0]).toMatchObject({ stat: "vigor", title: "Consolider le début de culture" });
    expect(analysis.recommendations[0].explanation).toContain("Germination, Enracinement et Croissance");
    expect(analysis.focus.reason).toContain("Vigueur (35 %)");
    expect(analysis.focus.reason).toContain("60 contre 70");
    expect(analysis.focus.reason).toContain("3,5 points");
  });

  it("explains a lost tie without claiming a score deficit or guaranteed future win", () => {
    const analysis = getKqJuryAnalysis({ rounds: [round("visual-impact", 70, 70), round("blind-aroma", 60, 65), round("technical-jury", 70, 65)], playerStats: stats(), opponentStats: stats() })!;
    expect(analysis.focus).toMatchObject({ code: "visual-impact", margin: 0, tied: true });
    expect(analysis.title).toContain("À comprendre");
    expect(analysis.facts.join(" ")).toContain("départage du jury");
    expect(analysis.facts.join(" ")).not.toContain("retard");
    expect(analysis.focus.reason).toContain("aucun déficit");
    expect(analysis.limits.join(" ")).toContain("sans garantir la victoire");
  });

  it("distinguishes the jury variation from a statistical disadvantage", () => {
    const analysis = getKqJuryAnalysis({ rounds: [round("visual-impact", 68, 72), round("blind-aroma", 60, 70), round("technical-jury", 70, 65)], playerStats: stats(), opponentStats: stats() })!;
    expect(analysis.focus.criteria.every(item => item.weightedGap === 0)).toBe(true);
    expect(analysis.facts.join(" ")).toContain("Tes critères ne sont pas inférieurs");
  });

  it("uses the narrowest victory when every round was won", () => {
    const analysis = getKqJuryAnalysis({ rounds: [round("visual-impact", 95, 94), round("blind-aroma", 60, 50), round("technical-jury", 75, 70)] })!;
    expect(analysis.wins).toBe(3);
    expect(analysis.focus.code).toBe("visual-impact");
    expect(analysis.title).toContain("À consolider");
  });

  it("does not invent criteria for unknown historical scenarios", () => {
    const analysis = getKqJuryAnalysis({ rounds: [round("legacy-jury", 70, 71), round("blind-aroma", 90, 75), round("technical-jury", 80, 95)], playerStats: stats(), opponentStats: stats() })!;
    expect(analysis.focus.criteria).toEqual([]);
    expect(analysis.recommendations).toEqual([]);
    expect(analysis.limits.join(" ")).toContain("ancienne manche");
    expect(getKqJuryScoringCriteria("legacy-jury")).toBeNull();
  });

  it("does not attribute incompatible or partial flower snapshots to a real result", () => {
    const rounds = [round("visual-impact", 70, 71), round("blind-aroma", 65, 75), round("technical-jury", 80, 70)];
    const mismatched = getKqJuryAnalysis({ rounds, playerStats: stats({ appearance: 99, vigor: 99 }), opponentStats: stats() })!;
    expect(mismatched.focus.criteria.every(item => item.weightedGap === null)).toBe(true);
    expect(mismatched.limits.join(" ")).toContain("ne reconstituent pas");
    expect(mismatched.facts.join(" ")).not.toContain("Avant la variation");
    const incomplete = getKqJuryAnalysis({ rounds, playerStats: { appearance: 70 }, opponentStats: stats() })!;
    expect(incomplete.focus.criteria[1].playerValue).toBeNull();
    expect(incomplete.focus.criteria.every(item => item.weightedGap === null)).toBe(true);
  });

  it("checks the actual integer variation and rounding, not just a loose score interval", () => {
    const analysis = getKqJuryAnalysis({ rounds: [round("visual-impact", 70.4, 71), round("blind-aroma", 50, 60), round("technical-jury", 80, 70)], playerStats: stats(), opponentStats: stats() })!;
    expect(analysis.limits.join(" ")).toContain("ne reconstituent pas");
  });

  it("rejects unfinished, nonfinite or internally contradictory verdicts", () => {
    expect(getKqJuryAnalysis({ rounds: scores.slice(0, 2) })).toBeNull();
    expect(getKqJuryAnalysis({ rounds: [...scores, scores[0]] })).toBeNull();
    expect(getKqJuryAnalysis({ rounds: [round("visual-impact", NaN, 90), ...scores.slice(1)] })).toBeNull();
    expect(getKqJuryAnalysis({ rounds: [round("visual-impact", 80, 90, "player"), ...scores.slice(1)] })).toBeNull();
  });

  it("keeps all fifteen current scenarios and both battle perspectives compatible with engine scores", () => {
    const seen = new Set<string>();
    const player = { ...createKqOpponent(1), id: "player", stats: stats({ appearance: 68.1, aroma: 72.3, vigor: 61.7, mastery: 69.9, regularity: 75.4 }) };
    const opponent = { ...createKqOpponent(2), id: "opponent", stats: stats({ appearance: 72.2, aroma: 73.4, vigor: 76.8, mastery: 64.1, regularity: 70.6 }) };
    for (let seed = 0; seed < 50; seed++) {
      const verdict = resolveKqBattle(lockKqBattle(player, opponent, seed), seed);
      verdict.rounds.forEach(item => seen.add(item.code));
      for (const perspective of [verdict, invertKqBattlePerspective(verdict)]) {
        const analysis = getKqJuryAnalysis({ rounds: perspective.rounds, playerStats: perspective.playerFlower.stats, opponentStats: perspective.opponentFlower.stats })!;
        expect(analysis.limits.join(" ")).not.toContain("ne reconstituent pas");
        expect(analysis.focus.criteria.map(item => item.weightPercent)).toEqual([65, 35]);
        expect(analysis.focus.criteria.every(item => item.weightedGap !== null)).toBe(true);
      }
    }
    expect(seen.size).toBe(15);
  });

  it("preserves the exact previous scoring and random adjustment for a known jury program", () => {
    const player = { ...createKqOpponent(1), stats: stats({ appearance: 68.1, aroma: 72.3, vigor: 61.7, regularity: 75.4 }) };
    const opponent = { ...createKqOpponent(2), stats: stats({ appearance: 72.2, aroma: 73.4, vigor: 76.8, regularity: 70.6 }) };
    const originalNoise = (seed: number, salt: number) => { const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453; return Math.floor((x - Math.floor(x)) * 7) - 3; };
    expect(getKqJuryProgram(0).map(item => item.code)).toEqual(["visual-impact", "jar-opening", "lot-harmony"]);
    const expectedPairs = [["appearance", "vigor"], ["aroma", "regularity"], ["regularity", "appearance"]] as const;
    const verdict = resolveKqBattle(lockKqBattle(player, opponent, 0), 0);
    for (const [index, [primary, secondary]] of expectedPairs.entries()) {
      expect(verdict.rounds[index].playerScore).toBe(Math.round((player.stats[primary] * 0.65 + player.stats[secondary] * 0.35 + originalNoise(0, 10 + index)) * 10) / 10);
      expect(verdict.rounds[index].opponentScore).toBe(Math.round((opponent.stats[primary] * 0.65 + opponent.stats[secondary] * 0.35 + originalNoise(0, 20 + index)) * 10) / 10);
    }
  });
});
