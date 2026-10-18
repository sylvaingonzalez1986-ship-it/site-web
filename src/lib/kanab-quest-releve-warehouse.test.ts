import { describe, expect, it, vi } from "vitest";
import { createReleveWarehouseTransport } from "./kanab-quest-releve-warehouse";
import { createKqReleveProduction, suggestKqRelevePlan, type KqReleveProductionState } from "./kanab-quest-releve-production";

function fixture(initial = createKqReleveProduction()) {
  let state = initial;
  const publish = vi.fn((next: KqReleveProductionState) => { state = next; });
  const request = createReleveWarehouseTransport({ getState: () => state, setState: publish });
  return { get: () => state, publish, request,
    patch: (body: object) => request("/api/arena/placard/warehouse", { method: "PATCH", body: JSON.stringify(body) }) };
}

describe("La relève — native warehouse transport", () => {
  it("saves the quoted equipment once and returns the updated cash and revision", async () => {
    const farm = fixture();
    const before = structuredClone(farm.get());
    const body = { state: suggestKqRelevePlan(before), expectedRevision: before.revision, expectedCostCents: 89_659 };
    const response = await farm.patch(body);
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.revision).toBe(before.revision + 1);
    expect(saved.cashCents).toBe(110_341);
    expect(saved.state).toEqual(farm.get().warehouse);
    expect(farm.get().draftWarehouse).toEqual(saved.state);
    expect(farm.get().ledger).toContainEqual(expect.objectContaining({ kind: "equipment", amountCents: 89_659, status: "paid" }));
    const committed = structuredClone(farm.get());
    expect((await farm.patch(body)).status).toBe(409);
    expect(farm.get()).toEqual(committed);
    expect(farm.publish).toHaveBeenCalledTimes(1);
  });

  it("rejects stale revisions and stale quotes before publishing any draft or debit", async () => {
    const farm = fixture();
    const before = structuredClone(farm.get());
    const warehouse = suggestKqRelevePlan(before);
    expect((await farm.patch({ state: warehouse, expectedRevision: before.revision + 1, expectedCostCents: 89_659 })).status).toBe(409);
    expect((await farm.patch({ state: warehouse, expectedRevision: before.revision, expectedCostCents: 1 })).status).toBe(409);
    expect(farm.get()).toEqual(before);
    expect(farm.publish).not.toHaveBeenCalled();
  });

  it("rejects a correct quote that exceeds the available budget atomically", async () => {
    const farm = fixture({ ...createKqReleveProduction(), cashCents: 89_658 });
    const before = structuredClone(farm.get());
    const response = await farm.patch({ state: suggestKqRelevePlan(before), expectedRevision: before.revision, expectedCostCents: 89_659 });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Budget");
    expect(farm.get()).toEqual(before);
    expect(farm.publish).not.toHaveBeenCalled();
  });

  it("serves account-shaped read requests locally and never falls back to the real account", async () => {
    const farm = fixture();
    const before = structuredClone(farm.get());
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    try {
      const warehouse = await (await farm.request(new Request("https://releve.invalid/api/arena/placard/warehouse"))).json();
      expect(warehouse.state).toEqual(before.warehouse);
      expect(warehouse.activeRuns).toEqual([]);
      const collection = await (await farm.request("/api/arena/placard/collection")).json();
      expect(collection.collection.inventory).toEqual(before.supportInventory);
      expect(collection.ownedBuddieCodes).toEqual(before.ownedBuddies);
      expect((await farm.request("/api/arena/placard/unhandled", { method: "POST" })).status).toBe(404);
      expect((await farm.request("https://example.com/unhandled")).status).toBe(404);
      expect(network).not.toHaveBeenCalled();
      expect(farm.get()).toEqual(before);
      expect(farm.publish).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
