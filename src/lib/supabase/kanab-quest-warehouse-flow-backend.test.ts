import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { createKqOnlinePreview, type KqOnlineListing } from "@/lib/kanab-quest-online";
import type { KqCommerceState, KqCommerceStock } from "@/lib/kanab-quest-commerce";
import { getKqWarehouseSalesForecast, projectKqWarehouseSalesForecast } from "./kanab-quest-warehouse-flow-backend";

const user = "00000000-0000-4000-8000-000000000001";
const now = "2026-10-12T12:00:00.000Z";
function state(overrides: Partial<KqCommerceState> = {}): KqCommerceState {
  return {
    revision: 1, cashCents: 35_000, reputation: 0, clients: 0, computerOwned: false, internetRenew: false,
    campaign: null, stocks: [], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    wholesale: { capacityEquivalentUnits: 10_000, remainingEquivalentUnits: 10_000, resetsAt: null },
    ...overrides,
  };
}
const stock = (id: string, ratio = 1): KqCommerceStock => ({
  id, flowerId: "flower", name: "Lot", route: ratio > 1 ? "dry-sift" : "raw", batchRoute: "raw", juryScore: 8,
  initialUnits: 1_000, remainingUnits: 1_000, equivalentUnits: 1_000 * ratio, originalUnits: 1_000 * ratio,
  baseUnitCents: 100, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false,
});
const listing = (id: string, ordersPerDay: number): KqOnlineListing => ({
  id, stockId: id, name: "Annonce", route: "raw", formatGrams: 5, packagingCode: "kraft-5", packetPriceCents: 1_000,
  initialPackets: 10, remainingPackets: 10, soldPackets: 0, status: "active", qualityScore: 8, baseUnitCents: 100, createdAt: now,
  offer: { ordersPerDay, referencePacketCents: 1_000, valueRatio: 1, satisfactionScore: 80, satisfaction: "satisfied", visitorsPerDay: 100 },
});

describe("warehouse sales forecast follows real finite demand", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("uses the rolling wholesale capacity and separates its currently exhausted allowance", () => {
    const result = projectKqWarehouseSalesForecast(state({ wholesale: { capacityEquivalentUnits: 10_000, remainingEquivalentUnits: 0, resetsAt: now } }));
    expect(result).toMatchObject({ salesGramsPerDay: 1_000, wholesaleGramsPerDay: 1_000, availableNowGrams: 0, periodHours: 24, basis: "raw-equivalent" });
  });

  it("uses the 12-hour shared shop refill once per account, even with many lots", () => {
    const current = state({
      campaign: { id: "campaign", revision: 1, reputation: 0, clientsStart: 0, event: "normal", internetPaid: false,
        directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0, shopPartnersStart: 4 },
      demand: { serverNow: now, updatedAt: now, onlineDebt: 0, shopDebt: 1, growthResetsAt: null },
    });
    const result = projectKqWarehouseSalesForecast(current);
    expect(result.shopGramsPerDay).toBe(1_000);
    expect(result.availableNowGrams).toBe(1_000);
    expect(projectKqWarehouseSalesForecast({ ...current, stocks: [stock("a"), stock("b"), stock("c")] }).salesGramsPerDay).toBe(result.salesGramsPerDay);
    expect(projectKqWarehouseSalesForecast({ ...current, strength: "merchant" }).shopGramsPerDay).toBe(1_500);
  });

  it("uses each online listing's SQL forecast, finite packets and actual input-mass ratio", () => {
    const online = createKqOnlinePreview(Date.parse(now));
    online.site.active = true;
    online.listings = [listing("flowers", 2), listing("extract", 20), { ...listing("paused", 100), status: "paused" }];
    const result = projectKqWarehouseSalesForecast(state({ online, stocks: [stock("flowers"), stock("extract", 4), stock("paused")] }));
    expect(result.onlineGramsPerDay).toBe(2 * 5 + 10 * 5 * 4);
    expect(result.salesGramsPerDay).toBe(1_210);
    online.site.active = false;
    expect(projectKqWarehouseSalesForecast(state({ online, stocks: [stock("flowers")] })).onlineGramsPerDay).toBe(0);
  });

  it("does not invent online demand from an unlisted stock or missing forecast", () => {
    const online = createKqOnlinePreview(Date.parse(now));
    online.site.active = true;
    online.listings = [{ ...listing("missing", 10), offer: undefined }];
    expect(projectKqWarehouseSalesForecast(state({ online, stocks: [stock("missing")] })).onlineGramsPerDay).toBe(0);
    online.listings = [{ ...listing("unknown-stock", 100), route: "dry-sift" }];
    expect(projectKqWarehouseSalesForecast(state({ online })).onlineGramsPerDay).toBe(0);
  });

  it("retains demand for fully packaged flower and extract lots absent from bulk stock", () => {
    const online = createKqOnlinePreview(Date.parse(now));
    online.site.active = true;
    online.listings = [listing("flowers", 2), { ...listing("extract", 3), route: "dry-sift", equivalentUnitsPerProductUnit: 5 }];
    const result = projectKqWarehouseSalesForecast(state({ online, stocks: [] }));
    expect(result.onlineGramsPerDay).toBe(2 * 5 + 3 * 5 * 5);
    expect(result.salesGramsPerDay).toBe(1_085);
  });

  it("marks historical unbounded commerce unknown instead of claiming zero or infinite demand", () => {
    expect(projectKqWarehouseSalesForecast(state({ wholesale: undefined })).salesGramsPerDay).toBeNull();
  });

  it("reads the authenticated account's commerce snapshot without lot scans or sale commands", async () => {
    mocks.rpc.mockResolvedValue({ data: state(), error: null });
    expect((await getKqWarehouseSalesForecast(user)).salesGramsPerDay).toBe(1_000);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_commerce_state", { p_user_id: user });
  });

  it("rejects invalid identity and unavailable data instead of reporting fabricated demand", async () => {
    await expect(getKqWarehouseSalesForecast("not-a-user")).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "migration missing" } });
    await expect(getKqWarehouseSalesForecast(user)).rejects.toThrow("migration missing");
  });
});
