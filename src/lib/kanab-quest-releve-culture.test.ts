import { describe, expect, it, vi } from "vitest";
import { createReleveCultureTransport, getReleveNativeFlowers } from "./kanab-quest-releve-culture";
import { applyKqReleveProductionAction as act, createKqReleveProduction, suggestKqRelevePlan, type KqReleveProductionState } from "./kanab-quest-releve-production";
import { isKqCultureDead } from "./kanab-quest-game";
import { KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_PRODUCTS } from "./kanab-quest-care";
import { getKqHarvestRows } from "./kanab-quest-harvests";

function fixture(count: 1 | 2 = 1) {
  let state = createKqReleveProduction();
  state = act(state, { type: "draft", warehouse: suggestKqRelevePlan(state, count) });
  state = act(state, { type: "save-plan" });
  for (let index = 0; index < 3; index++) state = act(state, { type: "reveal-buddie" });
  state = act(state, { type: "assign", zoneId: "culture-1", buddieCode: "HH2026-005" });
  if (count === 2) state = act(state, { type: "assign", zoneId: "culture-2", buddieCode: "HH2026-010" });
  return act(state, { type: "save-plan" });
}

function port(initial = fixture()) {
  let state = initial;
  const request = createReleveCultureTransport({ getState: () => state, setState: next => { state = next; } });
  return { request, get: () => state, set: (next: KqReleveProductionState) => { state = next; },
    post: async (path: string, body: object) => {
      const response = await request(`/api/arena/placard${path}`, { method: "POST", body: JSON.stringify(body) });
      const payload = await response.json();
      expect(response.ok, payload.error).toBe(true); return payload;
    } };
}

function harvestFixture(count: 1 | 2 = 1) {
  let state = act(fixture(count), { type: "launch" });
  while (state.game!.phase !== "complete") {
    for (const type of ["assist", "roll", "resolve", "advance"] as const) state = act(state, { type });
  }
  return state;
}

describe("native culture transport for La relève", () => {
  it("provides the player bootstrap contract without any network fallback", async () => {
    const sandbox = port();
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    try {
      const before = structuredClone(sandbox.get());
      const snapshot = await (await sandbox.request("/api/arena/placard/bootstrap")).json();
      expect(snapshot.collection.ownerFound).toBe(true);
      expect(snapshot.collection.inventory).toEqual(before.supportInventory);
      expect(snapshot.heritage.cards).toHaveLength(2);
      expect(snapshot.playerSession.activeRun).toBeNull();
      expect(await (await sandbox.request("/api/arena/placard/equipment")).json()).toEqual({ routePlan: null, strength: null });
      expect((await sandbox.request("https://example.com/unhandled")).status).toBe(404);
      expect(network).not.toHaveBeenCalled(); expect(sandbox.get()).toEqual(before);
    } finally { network.mockRestore(); }
  });

  it("starts the actual selected deck including duplicate copies with the quoted charges", async () => {
    const sandbox = port();
    const energy = await (await sandbox.request("/api/arena/placard/energy?campaign=true")).json();
    const result = await sandbox.post("/runs", { campaign: true, deckCodes: ["BOTTE-005", "BOTTE-005"], heritageCode: "HERITAGE-007", expectedEnergyCents: energy.quotes.balanced.totalCents, requestKey: "start" });
    expect(result.state.deckCodes).toEqual(["BOTTE-005", "BOTTE-005"]);
    expect(result.state.campaign.members).toHaveLength(1);
    const before = structuredClone(sandbox.get());
    await sandbox.post("/runs", { requestKey: "start" });
    expect(sandbox.get()).toEqual(before);
  });

  it("charges native basic care once, keeps vitality unchanged until resolution and preserves the ledger", async () => {
    const sandbox = port(act(fixture(), { type: "launch" }));
    const before = structuredClone(sandbox.get());
    const runId = before.game!.campaign!.leaderRunId;
    const result = await sandbox.post(`/runs/${runId}/care`, { action: "basic", basicPriceCents: KQ_BASIC_CARE_PRICE_CENTS, requestKey: "care-1" });
    expect(result.chargedCents).toBe(KQ_BASIC_CARE_PRICE_CENTS);
    expect(result.cashCents).toBe(before.cashCents - KQ_BASIC_CARE_PRICE_CENTS);
    expect(result.state.care.vitality).toBe(before.game!.care!.vitality);
    expect(sandbox.get().ledger.at(-1)?.kind).toBe("care");
    const replay = await sandbox.post(`/runs/${runId}/care`, { action: "basic", basicPriceCents: KQ_BASIC_CARE_PRICE_CENTS, requestKey: "care-1" });
    expect(replay.replayed).toBe(true); expect(sandbox.get().cashCents).toBe(result.cashCents);
  });

  it("serves native product inventory and purchases atomically", async () => {
    const sandbox = port(act(fixture(), { type: "launch" }));
    const product = KQ_CARE_PRODUCTS[0], before = sandbox.get().cashCents;
    const result = await sandbox.post("/care", { productCode: product.code, quantity: 2, requestKey: "product-1" });
    expect(result.inventory).toContainEqual({ productCode: product.code, quantity: 2 });
    expect(result.cashCents).toBe(before - product.priceCents * 2);
    await sandbox.post("/care", { productCode: product.code, quantity: 2, requestKey: "product-1" });
    expect(sandbox.get().careInventory[product.code]).toBe(2);
  });

  it("keeps harvest invoices and the native reserve, jury receipt and reward after six turns", async () => {
    const sandbox = port(act(fixture(), { type: "launch" }));
    const runId = sandbox.get().game!.campaign!.leaderRunId;
    while (sandbox.get().game!.phase !== "complete") {
      sandbox.set(act(sandbox.get(), { type: "assist" }));
      await sandbox.post(`/runs/${runId}/actions`, { action: "roll" });
      await sandbox.post(`/runs/${runId}/actions`, { action: "resolve" });
      expect(isKqCultureDead(sandbox.get().game!)).toBe(false);
      await sandbox.post(`/runs/${runId}/actions`, { action: "advance" });
    }
    expect(sandbox.get().ledger.some(row => row.kind === "lab")).toBe(true);
    const flower = getReleveNativeFlowers(sandbox.get())[0];
    expect(flower.status).toBe("available");
    expect(flower.storage?.stage).toBe("curing");
    const early = await sandbox.request("/api/arena/placard/bot-battles", { method: "POST", body: JSON.stringify({ flowerId: flower.id }) });
    expect(early.status).toBe(400);
    expect(await early.json()).toMatchObject({ error: expect.stringContaining("affinage") });
    sandbox.set(act(sandbox.get(), { type: "mature" }));
    const result = await sandbox.post("/bot-battles", { flowerId: flower.id });
    expect(result.status).toBe("verdict"); expect(result.rounds).toHaveLength(3);
    expect(result.opponentFlower.ownerName).toContain("Sylvain");
    expect(getReleveNativeFlowers(sandbox.get())[0].status).toBe("burned");
    const after = structuredClone(sandbox.get());
    await sandbox.post("/bot-battles", { flowerId: flower.id });
    expect(sandbox.get()).toEqual(after);
    expect(after.revealedRounds["culture-1"]).toBe(0);
  });

  it("resumes a saved locked battle through the native verdict route without awarding twice", async () => {
    const sandbox = port(act(act(harvestFixture(), { type: "mature" }), { type: "duel", zoneId: "culture-1" }));
    const battleId = sandbox.get().battles["culture-1"].id;
    const result = await sandbox.post(`/battles/${encodeURIComponent(battleId)}/verdict`, {});
    expect(result.battleId).toBe(battleId);
    expect(result.status).toBe("verdict");
    expect(result.rounds).toHaveLength(3);
    expect(result.completedChallenges).toEqual([]);
    expect(result.rankProfile.wins + result.rankProfile.losses).toBe(1);
    expect(sandbox.get().milestones).toContain("jury-ranked:culture-1");
    const after = structuredClone(sandbox.get());
    expect((await sandbox.post(`/battles/${encodeURIComponent(battleId)}/verdict`, {})).replayed).toBe(true);
    expect(sandbox.get()).toEqual(after);
  });

  it("keeps both judged lots and waiting Flowers visible in the native harvest overview without mutating production", async () => {
    const sandbox = port(harvestFixture(2));
    const flowers = getReleveNativeFlowers(sandbox.get());
    const earlyStorage = await (await sandbox.request("/api/arena/placard/storage")).json();
    expect(earlyStorage.lots).toHaveLength(2);
    expect(earlyStorage.lots.every((row: { flowerStatus: string; projection: { stage: string } }) => row.flowerStatus === "available" && row.projection.stage === "curing")).toBe(true);
    sandbox.set(act(sandbox.get(), { type: "mature" }));
    await sandbox.post("/bot-battles", { flowerId: flowers[0].id });
    const before = structuredClone(sandbox.get());
    const storage = await (await sandbox.request("/api/arena/placard/storage")).json();
    expect(storage.lots).toHaveLength(2);
    expect(storage.lots[0].harvestGrams).toBeGreaterThan(0);
    expect(storage.lots[0].projection.stage).toBe("ready");
    const rows = getKqHarvestRows(getReleveNativeFlowers(sandbox.get()), storage);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.state)).toContain("jury");
    expect(rows.map(row => row.state)).toContain("ready");
    expect(sandbox.get()).toEqual(before);
  });

  it("rejects an aborted mutation before changing the exercise", async () => {
    const sandbox = port();
    const before = structuredClone(sandbox.get());
    const controller = new AbortController(); controller.abort();
    await expect(sandbox.request("/api/arena/placard/care", { method: "POST", signal: controller.signal,
      body: JSON.stringify({ productCode: KQ_CARE_PRODUCTS[0].code }) })).rejects.toMatchObject({ name: "AbortError" });
    expect(sandbox.get()).toEqual(before);
  });

  it("assigns a harvested variety to installed containers before jury without resetting curing or another lot", async () => {
    const sandbox = port(harvestFixture(2));
    const before = await (await sandbox.request("/api/arena/placard/storage")).json();
    const target = before.lots[0], other = before.lots[1];
    const request = { action: "place", flowerId: target.flowerId, containerCode: "GLASS-1L", requestKey: "place-before-jury" };
    const placed = await sandbox.post("/storage", request);
    expect(placed.lots[0].projection.readyAt).toBe(target.projection.readyAt);
    expect(placed.lots[0].projection.stage).toBe("curing");
    expect(placed.lots[0].projection.capacity.allocations.every((row: { containerCode: string }) => row.containerCode === "GLASS-1L")).toBe(true);
    expect(placed.lots[1]).toEqual(other);
    const saved = structuredClone(sandbox.get());
    await sandbox.post("/storage", request);
    expect(sandbox.get()).toEqual(saved);
    const invalid = await sandbox.request("/api/arena/placard/storage", { method: "POST", body: JSON.stringify({ ...request, containerCode: "CANNATROL", requestKey: "uninstalled" }) });
    expect(invalid.status).toBe(400);
    expect(sandbox.get()).toEqual(saved);
  });
});
