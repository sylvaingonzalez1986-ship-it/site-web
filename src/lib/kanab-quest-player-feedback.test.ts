import { describe, expect, it } from "vitest";
import { canPlayKqCard, KQ_CARDS, playKqCard, rollKqDice } from "./kanab-quest-game";
import { createKqWorkshop } from "./kanab-quest-workshops";
import { startKqTrialCulture } from "./kanab-quest-trial";
import { getKqPersonalCultureSummary, getKqPersonalJurySummary, getKqPlayerCardChoices, getKqPlayerCardPermission } from "./kanab-quest-player-feedback";

const inventory = Object.fromEntries(KQ_CARDS.map(card => [card.code, 3]));
const card = (code: string) => KQ_CARDS.find(item => item.code === code)!;
const round = (code: string, playerScore: number, opponentScore: number, winner: "player" | "opponent" = playerScore >= opponentScore ? "player" : "opponent") => ({ code, label: code, playerScore, opponentScore, winner });

describe("playable card presentation", () => {
  it("moves legal preparations first while preserving every card and the hand", () => {
    const game = startKqTrialCulture();
    const before = structuredClone(game);
    const summary = getKqPlayerCardChoices(game, inventory);
    expect(summary.choices[0].card.code).toBe("BOTTE-005");
    expect(summary.choices[0].allowed).toBe(true);
    expect(summary.choices.map(choice => choice.card.code).sort()).toEqual([...game.handCodes!].sort());
    expect(summary.choices.map(choice => choice.allowed)).toEqual([...summary.choices.map(choice => choice.allowed)].sort((a, b) => Number(b) - Number(a)));
    expect(summary.playableCount).toBe(summary.choices.filter(choice => choice.allowed).length);
    expect(game).toEqual(before);
  });

  it("counts distinct choices rather than copies and excludes depleted stock", () => {
    const game = { ...startKqTrialCulture(), handCodes: ["BOTTE-005", "BOTTE-005"], deckCodes: ["BOTTE-005", "BOTTE-005"] };
    expect(getKqPlayerCardChoices(game, inventory).playableCount).toBe(1);
    const depleted = getKqPlayerCardChoices(game, { ...inventory, "BOTTE-005": 0 });
    expect(depleted.playableCount).toBe(0);
    expect(depleted.choices[0].reason).toBe("Aucune copie restante.");
    expect(depleted.label).toBe("Aucune préparation jouable");
  });

  it("preserves engine reasons for XP, timing and an already used preparation", () => {
    const game = startKqTrialCulture();
    expect(getKqPlayerCardPermission({ ...game, xp: 0 }, card("BOTTE-005"), 3).reason).toBe("Il faut 1 XP.");
    expect(getKqPlayerCardPermission(rollKqDice(game), card("BOTTE-005"), 3)).toEqual(canPlayKqCard(rollKqDice(game), card("BOTTE-005")));
    const played = playKqCard(game, "BOTTE-005");
    expect(getKqPlayerCardChoices(played, inventory).playableCount).toBe(0);
  });

  it("includes only the identified PBI reserve and checks its real remaining copies", () => {
    const base = startKqTrialCulture();
    const game = { ...base, stageIndex: 2, phase: "rolled" as const, handCodes: [], dice: [1, 2, 3] as [number, number, number], xp: 10, revealedPest: "aphids" as const };
    expect(getKqPlayerCardChoices({ ...game, revealedPest: null }, inventory).playableCount).toBe(0);
    expect(getKqPlayerCardChoices(game, inventory).choices.find(choice => choice.card.code === "BOTTE-002")?.allowed).toBe(true);
    expect(getKqPlayerCardChoices(game, { ...inventory, "BOTTE-002": 0 }).playableCount).toBe(0);
    expect(getKqPlayerCardChoices({ ...game, dice: [6, 6, 6] }, inventory).playableCount).toBe(0);
  });

  it("never advertises a playable card after the result is resolved", () => {
    const summary = getKqPlayerCardChoices({ ...startKqTrialCulture(), phase: "resolved" }, inventory);
    expect(summary.playableCount).toBe(0);
    expect(summary.label).toBe("Étape terminée");
    expect(summary.choices.every(choice => choice.reason === "L’étape est déjà terminée.")).toBe(true);
  });
});

describe("personal outcome summaries", () => {
  it("uses actual jury scores and a signed decimal margin without a record claim", () => {
    const rounds = [round("Visuel", 90, 80), round("Arômes", 72, 77), round("Technique", 85.5, 86)];
    const result = getKqPersonalJurySummary(rounds)!;
    expect(result.strongest.map(item => item.code)).toEqual(["Visuel"]);
    expect(result.weakest.map(item => item.code)).toEqual(["Arômes"]);
    expect(result.closest.code).toBe("Technique");
    expect(result.margin).toBe(-0.5);
    expect(result.wins).toBe(1);
    expect(result).not.toHaveProperty("record");
    expect(rounds[2].playerScore).toBe(85.5);
  });

  it("keeps equal notes and the real tie-break winner without inventing a weak criterion", () => {
    const result = getKqPersonalJurySummary([round("Visuel", 80, 80, "opponent"), round("Arômes", 80, 70), round("Technique", 80, 90)])!;
    expect(result.even).toBe(true);
    expect(result.strongest).toHaveLength(3);
    expect(result.weakest).toHaveLength(3);
    expect(result.margin).toBe(0);
    expect(result.closest.winner).toBe("opponent");
  });

  it("does not summarize missing or invalid verdicts", () => {
    expect(getKqPersonalJurySummary([])).toBeNull();
    expect(getKqPersonalJurySummary([round("Visuel", 80, 70)])).toBeNull();
    expect(getKqPersonalJurySummary([round("Visuel", NaN, 70), round("Arômes", 70, 75), round("Technique", 80, 75)])).toBeNull();
  });

  it("summarizes completed culture history and leaves a live culture untouched", () => {
    expect(getKqPersonalCultureSummary(startKqTrialCulture())).toBeNull();
    const game = createKqWorkshop("jury").game!;
    const summary = getKqPersonalCultureSummary(game)!;
    expect(summary.stages).toBe(6);
    expect(summary.successful).toBe(game.history.filter(stage => ["success", "critical"].includes(stage.outcome)).length);
    expect(summary.critical).toBe(game.history.filter(stage => stage.outcome === "critical").length);
    expect(summary.zero).toBe(game.history.filter(stage => stage.total === 0).length);
    if (summary.weakest) expect(game.history).toContain(summary.weakest);
  });

  it("reports only stages actually played in a failed culture, including rescued zeros", () => {
    const base = createKqWorkshop("jury").game!;
    const game = { ...base, cultureDead: true, history: base.history.slice(0, 3).map((stage, index) => ({ ...stage, outcome: "failure" as const, total: 0, ...(index === 0 ? { rescued: true } : {}) })) };
    expect(getKqPersonalCultureSummary(game)).toMatchObject({ stages: 3, successful: 0, critical: 0, zero: 3 });
  });
});
