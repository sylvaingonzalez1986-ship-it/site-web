import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), warehouse: vi.fn(), shop: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./kanab-quest-warehouse-backend", () => ({ getKqWarehouseRunSnapshot: mocks.warehouse }));
vi.mock("./kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.shop }));
vi.mock("./kanab-quest-backend", () => ({ getKqPlayerActiveRun: mocks.run }));

import { getKqEnergySnapshot } from "./kanab-quest-energy-backend";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, KQ_WAREHOUSE_SIMULATION } from "../kanab-quest-warehouse";
import { quoteKqEnergy, quoteKqTentEnergy, quoteKqDogCare, type KqEnergySummary } from "../kanab-quest-energy";
import { startKqGame } from "../kanab-quest-game";
import { getKqCampaignParticipants, getKqCampaignTotals } from "../kanab-quest-campaign";

const userId = "11000000-0000-4000-8000-000000000001";
const tents = [{ tentNumber: 1, cultureOperationalCodes: ["LED-300", "AIR-EC6", "SOLAR-BACKUP"], levels: { "LED-300": 8, "AIR-EC6": 3, "SOLAR-BACKUP": 1 } }];
const profiles = tents.map(tent => ({ tentNumber: tent.tentNumber, codes: tent.cultureOperationalCodes, levels: tent.levels }));
function emptySummary(): KqEnergySummary { return { outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [] }; }

describe("energy backend across the physical warehouse transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: emptySummary(), error: null });
    mocks.warehouse.mockResolvedValue(null);
    mocks.run.mockResolvedValue(null);
    mocks.shop.mockResolvedValue({ cashCents: 35_000, strength: null, tents, equipmentScopeVersion: 2, productionUnits: 1,
      equippedCodes: profiles[0].codes, cultureOperationalCodes: profiles[0].codes, cultureWear: {},
      sharedEquipment: { equippedCodes: ["PRESS-0600"], maintenance: { "PRESS-0600": { remaining: 1 } } },
    });
  });

  it("quotes physical power at the captured tariff without adding consumables or legacy level/solar modifiers", async () => {
    const starter = createKqWarehouseStarter();
    const paid = getKqWarehouseQuote({ ...starter,
      zones: [...starter.zones, { ...starter.zones[0], id: "stopped", name: "Zone en pause", x: 1, width: 3, active: false }],
    }, starter).nextState;
    const warehouse = getKqWarehouseRunSnapshot(paid, 4);
    mocks.warehouse.mockResolvedValue(warehouse);
    const result = await getKqEnergySnapshot(userId);
    expect(result.warehouse).toEqual(warehouse);
    expect(result.quotes.balanced).toMatchObject({ mode: "balanced", solarPercent: 0, tariffCentsPerKwh: KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh,
      totalWattHours: warehouse.energyKwh * 1_000, totalCents: warehouse.energyCostCents,
    });
    expect(result.quotes.balanced.totalWattHours).toBe(150 * KQ_WAREHOUSE_SIMULATION.equivalentLightingHours + 35 * KQ_WAREHOUSE_SIMULATION.equivalentAirHours);
    expect(result.quotes.eco).toEqual(result.quotes.balanced);
    expect(result.quotes.intensive).toEqual(result.quotes.balanced);
    expect(result.quotes.balanced.totalCents + warehouse.consumablesCostCents).toBe(warehouse.operatingCostCents);
    expect(warehouse.consumablesCostCents).toBe(KQ_WAREHOUSE_SIMULATION.consumablesCentsPerM2);
    expect(result.maintenanceDueNext).toEqual([]);
    expect(result.cultureEquipmentCodes).toEqual([]);
    const started = startKqGame(9, { warehouse, energyMode: "intensive", equipmentCodes: profiles[0].codes, equipmentLevels: profiles[0].levels });
    expect(result.quotes.balanced).toEqual(started.energy);
    expect(mocks.warehouse).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it("preserves a historical run's mode, per-tent billing and existing maintenance when it has no warehouse snapshot", async () => {
    const result = await getKqEnergySnapshot(userId);
    expect(result.warehouse).toBeUndefined();
    expect(result.quotes.eco).toEqual(quoteKqTentEnergy(profiles, "eco", "tent"));
    expect(result.quotes.intensive).toEqual(quoteKqTentEnergy(profiles, "intensive", "tent"));
    expect(result.quotes.intensive.totalCents).toBeGreaterThan(result.quotes.eco.totalCents);
    expect(result.quotes.balanced.tariffCentsPerKwh).toBe(30);
    expect(result.cultureEquipmentCodes).toEqual(profiles[0].codes);
    expect(result.maintenanceDueNext).toHaveLength(1);
    const historical = startKqGame(9, { equipmentTents: profiles, equipmentScope: "tent", energyMode: "eco" });
    expect(historical.energy).toEqual(result.quotes.eco);
    expect(historical.warehouse).toBeUndefined();
  });

  it("quotes all assigned campaign zones together and excludes unassigned zones", async () => {
    const starter = createKqWarehouseStarter();
    const paid = getKqWarehouseQuote({ ...starter, zones: [
      { ...starter.zones[0], id: "a", buddieCode: "HH2026-002" },
      { ...starter.zones[0], id: "b", x: 3, width: 2, buddieCode: "HH2026-003" },
      { ...starter.zones[0], id: "unassigned", x: 6 },
    ] }, starter).nextState;
    const members = getKqCampaignParticipants(paid, 4);
    const totals = getKqCampaignTotals(members);
    mocks.warehouse.mockResolvedValue(getKqWarehouseRunSnapshot(paid, 4));
    const result = await getKqEnergySnapshot(userId, { campaign: true });
    expect(result.warehouse?.activeAreaM2).toBe(3);
    expect(result.warehouse?.consumablesCostCents).toBe(totals.consumablesCostCents);
    expect(result.quotes.balanced.totalCents).toBe(totals.energyCostCents);
    expect(result.quotes.balanced.totalCents).toBeLessThan(getKqWarehouseRunSnapshot(paid, 4).energyCostCents);
  });

  it("keeps the completed campaign's frozen quote instead of quoting a newly edited floor plan", async () => {
    const starter = createKqWarehouseStarter();
    const paid = getKqWarehouseQuote({ ...starter, zones: [
      { ...starter.zones[0], id: "a", buddieCode: "HH2026-002" },
      { ...starter.zones[0], id: "b", x: 3, buddieCode: "HH2026-003" },
    ] }, starter).nextState;
    const members = getKqCampaignParticipants(paid, 4).map((member, index) => ({ ...member, runId: `run-${index}` }));
    const state = startKqGame(9, { warehouse: members[0].warehouse, varietyCode: members[0].buddieCode });
    state.campaign = { version: 1, id: "campaign", leaderRunId: members[0].runId, members };
    mocks.run.mockResolvedValue({ runId: members[0].runId, state });
    const result = await getKqEnergySnapshot(userId, { campaign: true, runId: members[0].runId });
    expect(result.quotes.balanced.totalCents).toBe(getKqCampaignTotals(members).energyCostCents);
    expect(mocks.warehouse).not.toHaveBeenCalled();
  });

  it("keeps unpaid historical invoices and their original tariff after conversion", async () => {
    const historicalQuote = quoteKqEnergy(["LED-300"], { "LED-300": 8 }, "intensive");
    const summary: KqEnergySummary = {
      outstandingCents: 1234, invoiceCount: 1, bestGramsPerKwh: 1.5,
      dogCare: quoteKqDogCare(9),
      invoices: [{ runId: "historical-run", createdAt: "2026-10-10T12:00:00Z", totalCents: historicalQuote.totalCents,
        remainingCents: 1234, harvestGrams: 110, quote: historicalQuote,
        dogCare: { cycle: 10, foodCents: 800, vetCents: 4000, totalCents: 4800, paidCents: 0 } }],
    };
    const before = structuredClone(summary);
    mocks.rpc.mockResolvedValue({ data: summary, error: null });
    mocks.warehouse.mockResolvedValue(getKqWarehouseRunSnapshot(createKqWarehouseStarter(), 2));
    const result = await getKqEnergySnapshot(userId);
    expect(result.invoices).toEqual(before.invoices);
    expect(result.dogCare).toBeNull();
    expect(result.outstandingCents).toBe(1234);
    expect(result.quotes.balanced.tariffCentsPerKwh).toBe(25);
    expect(result.invoices[0].quote.tariffCentsPerKwh).toBe(30);
    expect(summary).toEqual(before);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_energy_snapshot", { p_user_id: userId });
  });

  it("does not silently offer legacy prices when the physical installation cannot be read", async () => {
    mocks.warehouse.mockRejectedValue(new Error("[supabase:warehouse] invalid_snapshot"));
    await expect(getKqEnergySnapshot(userId)).rejects.toThrow("invalid_snapshot");
  });

  it("quotes only a free selected zone and does not attach another run's supplier invoice", async () => {
    const state = createKqWarehouseStarter();
    const zoneId = state.zones[0].id;
    const warehouse = getKqWarehouseRunSnapshot(state, 4, zoneId);
    mocks.warehouse.mockResolvedValue(warehouse);
    mocks.rpc.mockResolvedValue({ error: null, data: { ...emptySummary(), supplierInvoice: { runId: "other" } } });
    const result = await getKqEnergySnapshot(userId, { zoneId });
    expect(mocks.warehouse).toHaveBeenCalledWith(userId, zoneId);
    expect(result.warehouse).toEqual(warehouse);
    expect(result.supplierInvoice).toBeNull();
  });

  it("uses the selected run's frozen installation and exact supplier invoice among several", async () => {
    const warehouse = getKqWarehouseRunSnapshot(createKqWarehouseStarter(), 2, "starter");
    const state = startKqGame(9, { warehouse });
    const ownInvoice = { id: "invoice-own", runId: "run-own", issuedAt: "now", dueAt: "later", amountCents: 800, remainingCents: 800 };
    const otherInvoice = { ...ownInvoice, id: "invoice-other", runId: "run-other", amountCents: 1600 };
    mocks.run.mockResolvedValue({ runId: "run-own", state });
    mocks.rpc.mockResolvedValue({ error: null, data: { ...emptySummary(), supplierInvoice: otherInvoice, supplierInvoices: [otherInvoice, ownInvoice] } });
    const result = await getKqEnergySnapshot(userId, { runId: "run-own" });
    expect(mocks.warehouse).not.toHaveBeenCalled();
    expect(result.quotes.balanced).toEqual(state.energy);
    expect(result.supplierInvoice).toEqual(ownInvoice);
    expect(result.supplierInvoices).toHaveLength(2);
  });

  it("does not substitute a new global quote for an inaccessible requested run", async () => {
    await expect(getKqEnergySnapshot(userId, { runId: "foreign-run" })).rejects.toThrow("introuvable");
    expect(mocks.warehouse).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
