import { describe, expect, it } from "vitest";
import { getReleveProductionGuide } from "./arena-releve-production-guide";
import { getReleveLessonGuide } from "./arena-releve-lesson-guide";
import { canPlayKqCard, isKqCultureDead, KQ_ACTIVE_CARDS } from "./kanab-quest-game";
import { applyKqReleveProductionAction as act, createKqReleveExpansion, createKqReleveProduction, getKqReleveHarvests, suggestKqRelevePlan, type KqReleveProductionState } from "./kanab-quest-releve-production";
import { createKqTreasuryTutorial } from "./kanab-quest-treasury-tutorial";

function planned(count: 1 | 2 = 1) {
  let state = createKqReleveProduction();
  state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, count) });
  return act(state, { type: "save-plan" });
}

function launched(count: 1 | 2 = 1) {
  let state = planned(count);
  for (let index = 0; index < 3; index++) state = act(state, { type: "reveal-buddie" });
  state = act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" });
  if (count === 2) state = act(state, { type: "assign", zoneId: "culture-2", buddieCode: "HH2026-010" });
  state = act(state, { type: "save-plan" });
  return act(state, { type: "launch" });
}

function harvested(count: 1 | 2 = 1) {
  let state = launched(count);
  while (state.game!.phase !== "complete") {
    state = act(state, { type: "assist" });
    state = act(state, { type: "roll" });
    state = act(state, { type: "resolve" });
    if (!isKqCultureDead(state.game!)) state = act(state, { type: "advance" });
  }
  return state;
}

const ids = (chapter: Parameters<typeof getReleveProductionGuide>[0], state: KqReleveProductionState) => getReleveProductionGuide(chapter, state).map(step => step.id);

describe("La relève — guidance follows the player's production state", () => {
  it("guides drawing, native equipment and the cost dashboard without editing the farm", () => {
    let state = createKqReleveProduction();
    const empty = structuredClone(state);
    expect(ids("plan", state)).toContain("plan:draw-culture");
    expect(getReleveProductionGuide("plan", state).find(step => step.id === "plan:trace-culture")?.kind).toBe("element");
    expect(state).toEqual(empty);
    state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state) });
    expect(ids("plan", state)).toContain("plan:configure");
    expect(ids("plan", state)).toContain("plan:save");
    expect(getReleveProductionGuide("plan", state).find(step => step.id === "plan:quote")?.selector).toBe("[data-warehouse-quote-details] > summary");
    const beforeQuote = structuredClone(state);
    state = act(state, { type: "mark", milestone: "quote-read" });
    expect(state.cashCents).toBe(beforeQuote.cashCents);
    expect(state.draftWarehouse).toEqual(beforeQuote.draftWarehouse);
    expect(ids("plan", state)).not.toContain("plan:quote");
    state = act(state, { type: "save-plan" });
    expect(ids("plan", state)).toContain("plan:dashboard");
    expect(ids("plan", state)).toContain("plan:charges");
    state = act(state, { type: "mark", milestone: "charges-read" });
    expect(ids("plan", state)).not.toContain("plan:charges");
    expect(ids("plan", state)).not.toContain("plan:draw-culture");
  });

  it("keeps the real equipment editor and quote accessible when the budget is insufficient", () => {
    let state = createKqReleveProduction();
    state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state) });
    state.cashCents = 1;
    const before = structuredClone(state);
    expect(ids("plan", state)).toContain("plan:configure");
    expect(ids("plan", state)).toContain("plan:quote");
    expect(state).toEqual(before);
    // Availability of the native save button is determined by its real quote;
    // the guide must not bypass the same budget check when a save is attempted.
    expect(() => act(state, { type: "save-plan" })).toThrow();
  });

  it("treats the already installed expansion dossier as a new comparison", () => {
    const state = createKqReleveExpansion();
    expect(ids("expansion", state)).toContain("expansion:draw-culture");
    expect(ids("plan", state)).not.toContain("plan:draw-culture");
    const draft = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, 2) });
    expect(ids("expansion", draft)).toContain("expansion:configure");
    expect(ids("expansion", draft)).toContain("expansion:save");
    expect(ids("expansion", act(draft, { type: "save-plan" }))).not.toContain("expansion:draw-culture");
  });

  it("reveals all cards, teaches the profile, and assigns distinct available Buddies", () => {
    let state = planned(2);
    expect(ids("buddies", state)).toContain("buddies:pack");
    expect(getReleveProductionGuide("buddies", state).find(step => step.id === "buddies:pack-reveal")?.text).toBe("Révéler la carte");
    for (let index = 0; index < 3; index++) state = act(state, { type: "reveal-buddie" });
    expect(ids("buddies", state)).toContain("buddies:profile");
    expect(getReleveProductionGuide("buddies", state).find(step => step.id === "buddies:choose-profile")?.selector).toBe("[data-buddie-variety-choose]");
    expect(getReleveProductionGuide("buddies", state).at(-1)?.selector).toBe('[data-warehouse-buddie-card="HH2026-005"]');
    const rotated = { ...state, recentBuddieCodes: ["HH2026-005"] };
    expect(getReleveProductionGuide("buddies", rotated).at(-1)?.selector).toBe('[data-warehouse-buddie-card="HH2026-010"]');
    state = act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" });
    expect(ids("buddies", state)).toContain("buddies:save");
    state = act(state, { type: "save-plan" });
    expect(getReleveProductionGuide("buddies", state).at(-1)?.selector).toBe('[data-warehouse-buddie-card="HH2026-010"]');
    state = act(state, { type: "assign", zoneId: "culture-2", buddieCode: "HH2026-010" });
    expect(ids("buddies", state)).toContain("buddies:save");
    expect(getReleveProductionGuide("buddies", state).some(step => step.selector?.includes("HH2026-020"))).toBe(false);
  });

  it("never advances dice or spends money simply by computing the guide", () => {
    const state = launched();
    const snapshot = structuredClone(state);
    expect(ids("culture", state)).toContain("culture:health");
    expect(ids("culture", state)).toContain("culture:roll-0");
    getReleveProductionGuide("culture", state);
    expect(state).toEqual(snapshot);
  });

  it("guides the actual deck and Heritage choices before launch without spending copies or cash", () => {
    let state = planned();
    const cash = state.cashCents, stock = structuredClone(state.supportInventory);
    expect(ids("launch", state)).toEqual(["launch:confirm-start", "launch:deck-open", "launch:deck", "launch:deck-keep", "launch:heritage-open", "launch:heritage", "launch:heritage-keep", "launch:start"]);
    state = act(state, { type: "deck", codes: [...state.deckCodes, "BOTTE-032"] });
    expect(ids("launch", state)).toEqual(["launch:confirm-start", "launch:heritage-open", "launch:heritage", "launch:heritage-keep", "launch:start"]);
    state = act(state, { type: "heritage-choice", code: "HERITAGE-007" });
    expect(ids("launch", state)).toEqual(["launch:confirm-start", "launch:start"]);
    expect(state.cashCents).toBe(cash);
    expect(state.supportInventory).toEqual(stock);
    expect(state.game).toBeNull();
  });

  it("keeps confirmation above other choices and recommends only an affordable available support", () => {
    let state = launched();
    let found = false;
    for (let stage = 0; stage < 6 && !found; stage++) {
      for (const phase of ["prepare", "rolled"]) {
        if (phase === "rolled") state = act(state, { type: "roll" });
        const steps = getReleveProductionGuide("culture", state);
        expect(steps[0].id).toBe("culture:confirm-card");
        const suggested = steps.find(step => step.id.includes(":card-"));
        if (suggested) {
          const code = suggested.selector!.match(/data-action-card="([^"]+)"/)![1];
          const card = KQ_ACTIVE_CARDS.find(item => item.code === code)!;
          expect(canPlayKqCard(state.game!, card).allowed).toBe(true);
          expect(state.supportInventory[code]).toBeGreaterThan(0);
          state = act(state, { type: "play", code });
          expect(getReleveProductionGuide("culture", state).some(step => step.id === suggested.id)).toBe(false);
          found = true;
          break;
        }
      }
      if (!found) {
        state = act(state, { type: "assist" });
        state = act(state, { type: "resolve" });
        state = act(state, { type: "advance" });
      }
    }
    expect(found).toBe(true);
  });

  it("offers care for low vitality, but cannot repeat an already paid care at the same stage", () => {
    let state = launched();
    state.game!.care!.vitality = 60;
    expect(ids("culture", state)).toContain("culture:care-open-0");
    expect(ids("culture", state)).toContain("culture:care-0");
    state = act(state, { type: "basic-care" });
    expect(ids("culture", state)).not.toContain("culture:care-0");
    expect(ids("culture", state)).toContain("culture:roll-0");
  });

  it("follows roll, resolution, next stage and recovery without a dead end", () => {
    let state = launched();
    state = act(state, { type: "roll" });
    expect(ids("culture", state)).toContain("culture:resolve-0");
    expect(ids("culture", state)).not.toContain("culture:roll-0");
    state = act(state, { type: "resolve" });
    expect(ids("culture", state)).toContain("culture:advance-0");
    state = act(state, { type: "advance" });
    expect(ids("culture", state)).toContain("culture:roll-1");
    state.game!.cultureDead = true;
    expect(ids("culture", state)).toEqual(["culture:retry"]);
  });

  it.each([1, 2] as const)("can finish all six stages for %s zone(s) by following the suggested controls", count => {
    let state = launched(count);
    for (let actionCount = 0; actionCount < 100 && state.game!.phase !== "complete"; actionCount++) {
      const next = getReleveProductionGuide("culture", state).find(step => !step.id.includes(":confirm-card") && !step.id.includes(":care-open-") && !step.id.includes(":hand-open-"));
      expect(next).toBeDefined();
      const id = next!.id;
      if (id === "culture:health") state = act(state, { type: "mark", milestone: "health-read" });
      else if (id.includes(":care-")) state = act(state, { type: "basic-care" });
      else if (id.includes(":card-")) state = act(state, { type: "play", code: next!.selector!.match(/data-action-card="([^"]+)"/)![1] });
      else if (id.includes(":roll-")) state = act(state, { type: "roll" });
      else if (id.includes(":resolve-")) state = act(state, { type: "resolve" });
      else if (id.includes(":advance-")) state = act(state, { type: "advance" });
      else if (id.includes(":heritage-")) state = act(state, { type: "heritage" });
      else throw new Error(`Unexpected guidance: ${id}`);
      expect(isKqCultureDead(state.game!)).toBe(false);
    }
    expect(state.game!.phase).toBe("complete");
    expect(state.game!.history).toHaveLength(6);
    expect(getKqReleveHarvests(state)).toHaveLength(count);
  });

  it("points to the real campaign recap, native training confirmation and verdict analysis for each harvest", () => {
    let state = harvested(2);
    expect(ids("culture", state)).toContain("culture:recap");
    for (const harvest of getKqReleveHarvests(state)) {
      const zoneId = harvest.zoneId;
      expect(ids("jury", state)).toEqual(["jury:confirm-training", "jury:confirm-verdict", "jury:return-jury", `jury:present-${zoneId}`]);
      state = act(state, { type: "duel", zoneId });
      expect(ids("jury", state)).toEqual(["jury:confirm-training", "jury:confirm-verdict", "jury:return-jury", `jury:verdict-${zoneId}`]);
      state = act(state, { type: "verdict", zoneId });
      for (let round = 1; round <= 3; round++) {
        expect(ids("jury", state)).toContain(`jury:analysis-${zoneId}`);
        expect(ids("jury", state)).toContain(`jury:close-verdict-${zoneId}`);
        state = act(state, { type: "round", zoneId });
      }
    }
    expect(ids("jury", state)).toEqual([]);
  });
});

describe("La relève — bank guidance follows the real lesson progress", () => {
  const create = () => createKqTreasuryTutorial({ now: () => Date.parse("2026-10-16T12:00:00Z") });
  const post = async (sandbox: ReturnType<typeof create>, path: string, body: object) => {
    const response = await sandbox.request(path, { method: "POST", body: JSON.stringify(body) });
    expect(response.ok).toBe(true);
    return response.json();
  };

  it("changes from contract to deposit, withdrawal and completion only after their recorded actions", async () => {
    const sandbox = create();
    const guidance = () => getReleveLessonGuide("bank", sandbox.progress("bank")).map(step => step.id);
    expect(guidance()).toContain("bank:contract");
    expect(guidance()).not.toContain("bank:deposit");
    const bank = await (await sandbox.request("/api/arena/placard/bank")).json();
    await post(sandbox, "/api/arena/placard/bank", { action: "borrow", requestKey: crypto.randomUUID(), quoteId: bank.offer.quoteId, amountCents: 100000, expectedRateBps: bank.offer.rateBps });
    expect(guidance()).toContain("bank:deposit");
    expect(guidance()).not.toContain("bank:contract");
    await post(sandbox, "/api/arena/chanvrier/savings", { action: "deposit", amountCents: 10000, requestKey: crypto.randomUUID() });
    expect(guidance()).toContain("bank:withdraw");
    expect(guidance()).not.toContain("bank:deposit");
    await post(sandbox, "/api/arena/chanvrier/savings", { action: "withdraw", amountCents: 5000, requestKey: crypto.randomUUID() });
    expect(guidance()).toEqual(["bank:complete"]);
  });

  it("moves from the purchase to its sale, then to crypto without proposing a duplicate order", async () => {
    const sandbox = create();
    const guidance = () => getReleveLessonGuide("investments", sandbox.progress("investments")).map(step => step.id);
    expect(guidance()).toContain("investments:buy-stock");
    const bought = await post(sandbox, "/api/arena/placard/stocks", { action: "preview", side: "buy", assetId: "AAPL", amountCents: 10000 });
    await post(sandbox, "/api/arena/placard/stocks", { action: "confirm", orderId: bought.orderId });
    expect(guidance()).toContain("investments:positions");
    expect(guidance()).not.toContain("investments:buy-stock");
    const sold = await post(sandbox, "/api/arena/placard/stocks", { action: "preview", side: "sell", assetId: "AAPL", quantity: "1" });
    await post(sandbox, "/api/arena/placard/stocks", { action: "confirm", orderId: sold.orderId });
    expect(guidance()).toContain("investments:crypto-tab");
    expect(guidance()).not.toContain("investments:sell");
    const cryptoOrder = await post(sandbox, "/api/arena/placard/crypto", { action: "preview", side: "buy", assetId: 1, amountCents: 10000 });
    await post(sandbox, "/api/arena/placard/crypto", { action: "confirm", orderId: cryptoOrder.orderId });
    expect(guidance()).toEqual(["investments:complete"]);
  });
});
