import { describe, expect, it } from "vitest";
import { canPlayKqCard, KQ_CARDS, playKqCard, rollKqDice, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqCareState } from "./kanab-quest-care";
import { getKqTurnPreview } from "./kanab-quest-turn-preview";
import { createKqWorkshop } from "./kanab-quest-workshops";
import { startKqTrialCulture } from "./kanab-quest-trial";
import { getKqPersonalCultureSummary, getKqPersonalJurySummary, getKqPlayerCardChoices, getKqPlayerCardPermission } from "./kanab-quest-player-feedback";

const inventory = Object.fromEntries(KQ_CARDS.map(card => [card.code, 3]));
const card = (code: string) => KQ_CARDS.find(item => item.code === code)!;
const round = (code: string, playerScore: number, opponentScore: number, winner: "player" | "opponent" = playerScore >= opponentScore ? "player" : "opponent") => ({ code, label: code, playerScore, opponentScore, winner });

function position(cardCodes: string[], overrides: Partial<KqGameState> = {}): KqGameState {
  return {
    ...startKqGame(91, { rulesVersion: 3 }),
    situationCodes: ["SIT-001", "SIT-002", "SIT-003", "SIT-004", "SIT-005", "SIT-006"],
    deckCodes: cardCodes, handCodes: cardCodes, xp: 0, ...overrides,
  };
}

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
    expect(depleted.label).toBe("Aucune carte jouable");
  });

  it("preserves engine reasons for XP, timing and an already used preparation", () => {
    const game = startKqTrialCulture();
    expect(getKqPlayerCardPermission({ ...game, xp: 0 }, card("BOTTE-005"), 3).reason).toBe("Il faut 1 XP.");
    expect(getKqPlayerCardPermission(rollKqDice(game), card("BOTTE-005"), 3)).toEqual(canPlayKqCard(rollKqDice(game), card("BOTTE-005")));
    const played = playKqCard(game, "BOTTE-005");
    expect(getKqPlayerCardChoices(played, inventory).playableCount).toBe(0);
  });

  it("reveals another card blocker hidden behind the engine XP check, without changing legality", () => {
    const cases: [KqGameState, string, string][] = [
      [position(["BOTTE-024"]), "BOTTE-024", "À jouer après les dés."],
      [position(["BOTTE-003"]), "BOTTE-003", "Cette carte ne répond pas à la Situation."],
      [position(["BOTTE-024"], { phase: "rolled", dice: [4, 4, 4] }), "BOTTE-024", "Il faut un Danger à corriger."],
      [position(["BOTTE-005"], { preparationPlayed: true }), "BOTTE-005", "Une préparation a déjà été jouée."],
    ];
    for (const [state, code, reason] of cases) {
      const before = structuredClone(state);
      expect(canPlayKqCard(state, card(code))).toEqual({ allowed: false, reason: `Il faut ${card(code).xpCost} XP.` });
      expect(getKqPlayerCardPermission(state, card(code), 1)).toEqual({ allowed: false, reason });
      expect(getKqPlayerCardChoices(state, inventory).choices.find(choice => choice.card.code === code)).toMatchObject({ allowed: false, reason });
      expect(state).toEqual(before);
    }
    expect(getKqPlayerCardPermission(position(["BOTTE-005"]), card("BOTTE-005"), 1)).toEqual({ allowed: false, reason: "Il faut 1 XP." });
  });

  it("shows missing physical stock before an active card's XP or timing, but preserves completed-stage context", () => {
    const state = position(["BOTTE-024"]);
    expect(getKqPlayerCardPermission(state, card("BOTTE-024"), 0)).toEqual({ allowed: false, reason: "Aucune copie restante." });
    for (const phase of ["resolved", "complete"] as const) {
      expect(getKqPlayerCardPermission({ ...state, phase }, card("BOTTE-024"), 0)).toEqual({ allowed: false, reason: "L’étape est déjà terminée." });
    }
  });

  it("keeps historical PBI card counts without exposing that reserve in new cultures", () => {
    const base = startKqTrialCulture("balanced", 2, 2);
    const game = { ...base, stageIndex: 2, phase: "rolled" as const, handCodes: [], dice: [1, 2, 3] as [number, number, number], xp: 10, revealedPest: "aphids" as const };
    expect(getKqPlayerCardChoices({ ...game, revealedPest: null }, inventory).playableCount).toBe(0);
    expect(getKqPlayerCardChoices(game, inventory).choices.find(choice => choice.card.code === "BOTTE-002")?.allowed).toBe(true);
    expect(getKqPlayerCardChoices(game, { ...inventory, "BOTTE-002": 0 }).playableCount).toBe(0);
    expect(getKqPlayerCardChoices({ ...game, dice: [6, 6, 6] }, inventory).playableCount).toBe(0);
    expect(getKqPlayerCardChoices({ ...game, rulesVersion: 3 }, inventory).choices).toEqual([]);
  });

  it("never advertises a playable card after the result is resolved", () => {
    const summary = getKqPlayerCardChoices({ ...startKqTrialCulture(), phase: "resolved" }, inventory);
    expect(summary.playableCount).toBe(0);
    expect(summary.label).toBe("Étape terminée");
    expect(summary.choices.every(choice => choice.reason === "L’étape est déjà terminée.")).toBe(true);
  });

  it("labels distinct playable options without implying multiple preparations may be played", () => {
    const state = position(["BOTTE-005", "BOTTE-005", "BOTTE-017"], { xp: 2 });
    expect(getKqPlayerCardChoices(state, inventory).label).toBe("2 cartes jouables");
    expect(getKqPlayerCardChoices({ ...state, xp: 1 }, inventory).label).toBe("1 carte jouable");
    const played = playKqCard(state, "BOTTE-005");
    expect(getKqPlayerCardChoices(played, inventory)).toMatchObject({
      playableCount: 0, explanation: "Ta préparation est déjà jouée pour cette étape. Tu peux lancer les dés sans jouer de carte.",
    });
  });

  it("finds the exact smallest XP gap among cards actually usable now, excluding cheaper wrong incidents and unavailable stock", () => {
    const state = position(["BOTTE-003", "BOTTE-005", "BOTTE-017", "BOTTE-027"]);
    const stock = { ...inventory, "BOTTE-005": 0 };
    const beforeState = structuredClone(state);
    const beforeStock = { ...stock };
    // The engine's first reason is XP even for the cheaper, incompatible card.
    expect(canPlayKqCard(state, card("BOTTE-003")).reason).toBe("Il faut 1 XP.");
    expect(getKqPlayerCardChoices(state, stock).explanation).toBe("Il te manque 2 XP pour jouer au moins une carte adaptée maintenant. Tu peux lancer les dés sans jouer de carte.");
    expect(getKqPlayerCardChoices({ ...state, xp: 1 }, stock).explanation).toContain("Il te manque 1 XP");
    expect(getKqPlayerCardChoices({ ...state, xp: 2 }, stock).playableCount).toBe(1);
    expect(state).toEqual(beforeState);
    expect(stock).toEqual(beforeStock);
  });

  it("explains reactions before the dice without promising that the roll will make them playable", () => {
    const state = position(["BOTTE-024"]);
    expect(getKqPlayerCardChoices(state, inventory).explanation).toBe("Les cartes restantes se jouent après les dés, si leurs conditions sont réunies. Tu peux lancer les dés sans jouer de carte.");
    expect(getKqPlayerCardChoices({ ...state, xp: 10 }, inventory).explanation).toBe(getKqPlayerCardChoices(state, inventory).explanation);
    expect(getKqPlayerCardChoices({ ...state, phase: "rolled", dice: [4, 4, 4] }, inventory).explanation).not.toContain("Il te manque");
  });

  it("does not present XP as a remedy for missed timing, an incompatible incident, unsuitable dice or a spent epic", () => {
    const cases: [KqGameState, string][] = [
      [position(["BOTTE-005"], { phase: "rolled", dice: [1, 4, 5] }), "Les cartes restantes se jouent avant les dés."],
      [position(["BOTTE-003"]), "Tes préparations restantes ne répondent pas à cet incident."],
      [position(["BOTTE-024"], { phase: "rolled", dice: [4, 4, 4] }), "Les conditions des cartes restantes ne sont pas réunies."],
      [position(["BOTTE-039"], { phase: "rolled", dice: [1, 2, 4], usedCards: ["BOTTE-040"] }), "Les conditions des cartes restantes ne sont pas réunies."],
    ];
    for (const [state, message] of cases) {
      const summary = getKqPlayerCardChoices(state, inventory);
      expect(summary.playableCount).toBe(0);
      expect(summary.explanation).toContain(message);
      expect(summary.explanation).not.toMatch(/Il te manque|gagnerais/);
    }
  });

  it("prioritizes the already-used reaction over an apparent XP shortage", () => {
    const state = position(["BOTTE-006"], { stageIndex: 2, phase: "rolled", dice: [2, 4, 5], reactionPlayed: true });
    expect(getKqPlayerCardChoices(state, inventory).explanation).toBe("Ta réaction est déjà jouée pour cette étape. Consulte le bilan avant de valider.");
  });

  it("distinguishes exhausted stock, consumed deck copies, an empty hand and an empty deck", () => {
    const state = position(["BOTTE-005", "BOTTE-017"]);
    expect(getKqPlayerCardChoices(state, {}).explanation).toContain("Tu n’as plus de copie en stock des cartes de cette main.");
    expect(getKqPlayerCardChoices({ ...state, usedCards: [...state.deckCodes] }, inventory).explanation).toContain("Toutes les cartes d’action de ce deck ont déjà été utilisées.");
    expect(getKqPlayerCardChoices({ ...state, usedCards: ["BOTTE-005"] }, { "BOTTE-005": 3, "BOTTE-017": 0 }).explanation).toContain("Les copies de cette main sont épuisées ou déjà utilisées.");
    expect(getKqPlayerCardChoices({ ...state, handCodes: [] }, inventory).explanation).toContain("Aucune carte d’action dans cette main.");
    expect(getKqPlayerCardChoices(position([]), inventory).explanation).toContain("Ce deck ne contient aucune carte d’action disponible.");
  });

  it("uses the actual conditional XP gain from visible dice, including sparks and current XP", () => {
    const state = position(["BOTTE-006"], { stageIndex: 2, phase: "rolled", dice: [2, 4, 6], care: createKqCareState() });
    const before = structuredClone(state);
    expect(getKqTurnPreview(state)).toMatchObject({ dead: false, xpGain: 3, xpAfter: 3 });
    expect(getKqPlayerCardChoices(state, inventory).explanation).toBe("Il te manque 2 XP pour jouer au moins une carte adaptée maintenant. En validant ce résultat, tu gagnerais 3 XP (3 XP au total).");
    expect(getKqPlayerCardChoices({ ...state, xp: 1 }, inventory).explanation).toBe("Il te manque 1 XP pour jouer au moins une carte adaptée maintenant. En validant ce résultat, tu gagnerais 3 XP (4 XP au total).");
    const danger = { ...state, dice: [1, 4, 6] as [number, number, number] };
    expect(getKqTurnPreview(danger)).toMatchObject({ dead: false, xpGain: 2, dangerBlocksSuccess: true });
    expect(getKqPlayerCardChoices(danger, inventory).explanation).toContain("Un Danger maintient ce résultat fragile. En validant ce résultat, tu gagnerais 2 XP (2 XP au total).");
    expect(state).toEqual(before);
  });

  it("does not promise XP without a visible validation result or when validation would kill the culture", () => {
    const state = position(["BOTTE-006"], { stageIndex: 2, phase: "rolled", dice: [2, 2, 2], care: { ...createKqCareState(), vitality: 10 } });
    expect(getKqTurnPreview(state)?.dead).toBe(true);
    const death = getKqPlayerCardChoices(state, inventory).explanation;
    expect(death).toContain("En validant ce résultat, la culture serait perdue sans récolte.");
    expect(death).not.toMatch(/gagnerais|Consulte le bilan avant de valider/);
    const unknown = getKqPlayerCardChoices({ ...state, dice: null }, inventory).explanation;
    expect(unknown).not.toMatch(/gagnerais|ne rapporte pas d’XP/);
  });

  it("keeps first-culture rescue visible before the actual surviving validation gain", () => {
    const state = position(["BOTTE-006"], { stageIndex: 2, phase: "rolled", dice: [2, 2, 2], care: { ...createKqCareState(), vitality: 10 }, firstCultureRescue: true });
    expect(getKqTurnPreview(state)).toMatchObject({ dead: false, rescued: true, xpGain: 1 });
    const explanation = getKqPlayerCardChoices(state, inventory).explanation;
    expect(explanation).toBe("Il te manque 2 XP pour jouer au moins une carte adaptée maintenant. En validant ce résultat, ton secours de première culture serait utilisé. En validant ce résultat, tu gagnerais 1 XP (1 XP au total).");
  });

  it("keeps resolved and completed results independent of hypothetical gains or exhausted copies", () => {
    for (const phase of ["resolved", "complete"] as const) {
      const summary = getKqPlayerCardChoices(position(["BOTTE-005"], { phase, xp: 0, preparationPlayed: true }), {});
      expect(summary).toMatchObject({ playableCount: 0, label: "Étape terminée", explanation: "Les cartes restent consultables. Les prochains choix apparaîtront à l’étape suivante." });
    }
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
