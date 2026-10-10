import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), energy: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) }) }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: vi.fn() }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
import { handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import { createKqStorageLot, KQ_CURING_DURATION_MS } from "@/lib/kanab-quest-storage";
import { createKqBusinessPreview } from "@/lib/kanab-quest-business";
const user = "00000000-0000-4000-8000-000000000001", stockId = "00000000-0000-4000-8000-000000000002", flowerId = "00000000-0000-4000-8000-000000000003";
const now = Date.parse("2026-10-10T12:00:00Z");
function current() {
  const storageState = createKqStorageLot({ flowerId, harvestedAt: new Date(now - KQ_CURING_DURATION_MS + 60_000).toISOString(),
    baseline: { varietyCode: "KQ-VAR-001", juryScore: 9, aroma: 90, care: { terpenes: 90, cannabinoidExpression: 90, cannabinoidConversion: 5, cannabinoidOxidation: 0 } } });
  return { revision: 3, business: createKqBusinessPreview(now), cashCents: 100000, reputation: 1500, clients: 100,
    computerOwned: true, internetRenew: true, campaign: { id: "cycle", revision: 4, reputation: 1500, clientsStart: 100, event: "normal", internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 },
    stocks: [{ id: stockId, flowerId, name: "Test", route: "raw", batchRoute: "raw", juryScore: 9, initialUnits: 1200, remainingUnits: 1200, equivalentUnits: 1200, originalUnits: 1200, baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storageState, storageRevision: 7 }],
    receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
  };
}
describe("storage-aware server commerce quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: current(), error: null });
    mocks.insert.mockResolvedValue({ error: null }); mocks.energy.mockResolvedValue({ outstandingCents: 0 });
  });
  it("persists the server storage revision and expires before the next storage change", async () => {
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised", units: 100,
      storageRevision: 999, readyAt: "past" });
    expect(result.expiresAt).toBe(new Date(now + 60_000).toISOString());
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ storage_revision: 7, expires_at: result.expiresAt, user_id: user }));
  });
  it("does not persist a refused immature retail quote", async () => {
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "cbd-shop", policy: "advised", units: 100 });
    expect(result.offer.reason).toContain("Curing");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("fails closed if SQL has not supplied the storage migration data", async () => {
    const value = current();
    mocks.rpc.mockResolvedValue({ data: { ...value, stocks: [{ ...value.stocks[0], storageState: null }] }, error: null });
    await expect(handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised" })).rejects.toThrow("storage_migration_required");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
