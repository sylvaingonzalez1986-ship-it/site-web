import { describe, expect, it } from "vitest";
import { canPlayKqCard, getKqHandCodes, isKqCultureDead, KQ_ACTIVE_CARDS } from "./kanab-quest-game";
import { isKqCampaign } from "./kanab-quest-campaign";
import { getKqBuddieRotationRemaining } from "./kanab-quest-buddie-rotation";
import { KQ_SUPPLIER_PAYMENT_TERM_MS } from "./kanab-quest-business";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { applyKqReleveProductionAction as act, createKqReleveExpansion, createKqReleveProduction, getKqReleveHarvests, getKqReleveLaunchIssues, getKqRelevePlanReview, getKqReleveProductionOutstanding, getKqReleveProductionProgress, suggestKqRelevePlan, type KqReleveProductionState } from "./kanab-quest-releve-production";

function planned(cultures: 1 | 2 = 1) {
  let state = createKqReleveProduction();
  state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, cultures) });
  return act(state, { type: "save-plan" });
}
function prepared(cultures: 1 | 2 = 1) {
  let state = planned(cultures);
  for (let index = 0; index < 3; index++) state = act(state, { type: "reveal-buddie" });
  state = act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" });
  if (cultures === 2) state = act(state, { type: "assign", zoneId: "culture-2", buddieCode: "HH2026-010" });
  return act(state, { type: "save-plan" });
}
function completed(cultures: 1 | 2 = 1) {
  let state = act(prepared(cultures), { type: "launch" });
  while (state.game!.phase !== "complete") {
    state = act(state, { type: "assist" });
    state = act(state, { type: "roll" });
    state = act(state, { type: "resolve" });
    if (!isKqCultureDead(state.game!)) state = act(state, { type: "advance" });
  }
  return state;
}

describe("La relève — plans and campaign budget", () => {
  it("starts with a completely empty renovated room and the agreed fictitious budget", () => {
    const state = createKqReleveProduction();
    expect(state.cashCents).toBe(200_000);
    expect(state.warehouse).toMatchObject({ floor: { columns: 10, rows: 10 }, zones: [], serviceZones: [], equipment: [], preparedAreaM2: 0 });
    expect(state.ownedBuddies).toEqual([]);
    expect(state.ledger).toEqual([]);
    expect(getKqReleveProductionProgress("plan", state).complete).toBe(false);
  });

  it.each([[1, 1, 89_659, 11_670], [1, 2, 118_794, 17_620], [2, 1, 124_429, 22_840]] as const)("quotes %s zone(s) of %s m² with current costs and future bills", (cultures, width, cost, commitments) => {
    const state = createKqReleveProduction();
    const review = getKqRelevePlanReview(act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, cultures, width) }));
    expect(review.errors).toEqual([]);
    expect(review.quote?.totalCostCents).toBe(cost);
    expect(review.commitmentsCents).toBe(commitments);
    expect(review.availableCents).toBe(200_000 - cost - commitments);
  });

  it("charges additions once and reuses equipment instead of repurchasing the whole plan", () => {
    let state = planned();
    expect(state.cashCents).toBe(110_341);
    expect(act(state, { type: "save-plan" })).toEqual(state);
    state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, 2) });
    expect(getKqRelevePlanReview(state).quote?.totalCostCents).toBe(34_770);
    state = act(state, { type: "save-plan" });
    expect(state.cashCents).toBe(75_571);
    expect(state.ledger.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(124_429);
    state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state) });
    const review = getKqRelevePlanReview(state);
    expect(review.quote?.totalCostCents).toBe(0);
    expect(review.summary?.reserve.length).toBeGreaterThan(0);
  });

  it("rejects an invalid or unaffordable purchase without touching the saved room or cash", () => {
    const initial = createKqReleveProduction();
    const overlap = suggestKqRelevePlan(initial, 2);
    overlap.zones[1].x = 0;
    const invalid = act(initial, { type: "draft", warehouse: overlap });
    expect(() => act(invalid, { type: "save-plan" })).toThrow();
    const expensive = act({ ...initial, cashCents: 1 }, { type: "draft", warehouse: suggestKqRelevePlan(initial) });
    expect(() => act(expensive, { type: "save-plan" })).toThrow("Budget");
    expect(initial.warehouse.zones).toEqual([]);
    expect(initial.cashCents).toBe(200_000);
  });

  it("keeps the loan dossier separate and only completes it after saving a changed plan", () => {
    let state = createKqReleveExpansion();
    expect(state.cashCents).toBe(500_000);
    expect(getKqReleveProductionProgress("expansion", state).complete).toBe(false);
    state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, 2) });
    state = act(state, { type: "save-plan" });
    expect(getKqReleveProductionProgress("expansion", state).complete).toBe(true);
    expect(state.cashCents).toBe(465_230);
    expect(createKqReleveProduction().cashCents).toBe(200_000);
  });
});

describe("La relève — real production rules and persistence", () => {
  it("records campaign rotation in the same newest-first zone order as the server", () => {
    const state = act(prepared(2), { type: "launch" });
    expect(state.recentBuddieCodes).toEqual(["HH2026-010", "HH2026-005"]);
    expect(getKqBuddieRotationRemaining("HH2026-020", state.recentBuddieCodes)).toBe(0);
    expect(getKqBuddieRotationRemaining("HH2026-005", state.recentBuddieCodes)).toBe(1);
    expect(getKqBuddieRotationRemaining("HH2026-010", state.recentBuddieCodes)).toBe(2);
  });

  it("requires revealed, distinct and available Buddies and saved assignments", () => {
    let state = planned(2);
    expect(() => act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" })).toThrow();
    for (let index = 0; index < 3; index++) state = act(state, { type: "reveal-buddie" });
    expect(act(state, { type: "reveal-buddie" }).ownedBuddies).toHaveLength(3);
    expect(() => act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-020" })).toThrow("rotation");
    state = act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" });
    expect(() => act(state, { type: "assign", zoneId: "culture-2", buddieCode: "HH2026-005" })).toThrow("déjà affecté");
    expect(getKqReleveLaunchIssues(state).join(" ")).toContain("brouillon");
  });

  it.each([1, 2] as const)("launches %s frozen member(s), invoices supplies per member, and survives a JSON round trip", cultures => {
    const state = act(prepared(cultures), { type: "launch" });
    expect(state.game?.campaign?.members).toHaveLength(cultures);
    expect(isKqCampaign(state.game?.campaign)).toBe(true);
    expect(parseKqGameSave(encodeKqSave(state.game))).toEqual(state.game);
    expect(getKqReleveProductionOutstanding(state).supplierCents).toBe(cultures * 2200);
    expect(state.ledger.find(entry => entry.kind === "supplier")?.dueAt).toBe(new Date(state.clock + KQ_SUPPLIER_PAYMENT_TERM_MS).toISOString());
    expect(act(state, { type: "launch" })).toEqual(state);
    expect(() => act(state, { type: "draft", warehouse: suggestKqRelevePlan(state) })).toThrow("figé");
    const continued = act(JSON.parse(JSON.stringify(state)) as KqReleveProductionState, { type: "roll" });
    expect(continued.game?.phase).toBe("rolled");
    expect(continued.game?.campaign).toEqual(state.game?.campaign);
  });

  it("burns one support for the common campaign and restores inventory and spending at its explicit checkpoint", () => {
    let state = act(prepared(2), { type: "launch" });
    const availableCard = () => getKqHandCodes(state.game!).map(code => KQ_ACTIVE_CARDS.find(item => item.code === code)!).find(item => canPlayKqCard(state.game!, item).allowed);
    for (let index = 0; index < 12 && !availableCard(); index++) {
      if (state.game!.phase === "prepare") state = act(state, { type: "roll" });
      else { state = act(state, { type: "resolve" }); state = act(state, { type: "advance" }); }
    }
    const original = structuredClone(state.checkpoint!);
    const card = availableCard();
    expect(card).toBeDefined();
    state = act(state, { type: "play", code: card!.code });
    expect(state.supportInventory[card!.code]).toBe(original.supportInventory[card!.code] - 1);
    state = act(state, { type: "basic-care" });
    expect(state.cashCents).toBe(original.cashCents - 500);
    expect(() => act(state, { type: "basic-care" })).toThrow();
    state = act(state, { type: "restore-stage" });
    expect(state.game).toEqual(original.game);
    expect(state.cashCents).toBe(original.cashCents);
    expect(state.supportInventory).toEqual(original.supportInventory);
    expect(state.ledger).toEqual(original.ledger);
  });

  it.each([1, 2] as const)("plays all six real stages for %s zone(s), keeps member identity, and charges analysis per harvest", cultures => {
    let state = completed(cultures);
    expect(isKqCultureDead(state.game!)).toBe(false);
    expect(state.game?.history).toHaveLength(6);
    const harvests = getKqReleveHarvests(state);
    expect(harvests).toHaveLength(cultures);
    expect(new Set(harvests.map(item => item.game.varietyCode)).size).toBe(cultures);
    for (const harvest of harvests) {
      expect(harvest.game.harvestGrams).toBeGreaterThan(0);
      expect(parseKqGameSave(encodeKqSave(harvest.game))).toEqual(harvest.game);
    }
    expect(getKqReleveProductionOutstanding(state)).toEqual({ supplierCents: cultures * 2200, energyCents: cultures * 4470, labCents: cultures * 4500, totalCents: cultures * 11170 });
    expect(getKqReleveProductionProgress("culture", state).complete).toBe(false);
    state = act(state, { type: "mark", milestone: "health-read" });
    state = act(state, { type: "mark", milestone: "recap-read" });
    expect(getKqReleveProductionProgress("culture", state).complete).toBe(true);
    expect(() => act(state, { type: "advance" })).toThrow();
  });

  it("can recover a failed cycle explicitly without retaining final invoices or phantom battles", () => {
    let state = act(prepared(), { type: "launch" });
    const launch = structuredClone(state);
    state.game = { ...state.game!, care: { ...state.game!.care!, vitality: 1 }, firstCultureRescue: false };
    state = act(state, { type: "roll" });
    state.game = { ...state.game!, dice: [1, 1, 1] };
    state = act(state, { type: "resolve" });
    expect(isKqCultureDead(state.game!)).toBe(true);
    expect(getKqReleveHarvests(state)).toEqual([]);
    expect(getKqReleveProductionOutstanding(state).labCents).toBe(0);
    state = act(state, { type: "restore-stage" });
    expect(state.game).toEqual(launch.game);
    expect(state.ledger).toEqual(launch.ledger);
  });

  it("resolves a real jury for each distinct flower, keeps harvest lots, and cannot burn or invoice twice", () => {
    let state = completed(2);
    const before = { cash: state.cashCents, ledger: structuredClone(state.ledger), harvests: getKqReleveHarvests(state).map(item => item.game.harvestGrams) };
    for (const harvest of getKqReleveHarvests(state)) {
      const zoneId = harvest.zoneId;
      state = act(state, { type: "duel", zoneId });
      expect(act(state, { type: "duel", zoneId })).toEqual(state);
      state = act(state, { type: "verdict", zoneId });
      expect(state.battles[zoneId].burnedAt).toBeTruthy();
      expect(state.battles[zoneId].playerFlower.status).toBe("burned");
      expect(act(state, { type: "verdict", zoneId })).toEqual(state);
      expect(state.battles[zoneId].rounds).toHaveLength(3);
      for (let index = 0; index < 3; index++) state = act(state, { type: "round", zoneId });
    }
    expect(getKqReleveProductionProgress("jury", state).complete).toBe(true);
    expect(state.cashCents).toBe(before.cash);
    expect(state.ledger).toEqual(before.ledger);
    expect(getKqReleveHarvests(state).map(item => item.game.harvestGrams)).toEqual(before.harvests);
  });
});
