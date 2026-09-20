import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { getKqEquipmentShopSnapshot, replaceKqCultureEquipment, equipKqDurableEquipment } from "./kanab-quest-equipment-backend";
import { getKqEnergySnapshot } from "./kanab-quest-energy-backend";
import { startKqGame } from "../kanab-quest-game";
import { quoteKqEnergy } from "../kanab-quest-energy";
const userId = "11000000-0000-4000-8000-000000000001";
const input = { userId, requestKey: "11000000-0000-4000-8000-000000000002", equipmentCode: "LED-300", expectedVersion: 10, expectedCostCents: 35900 };
function snapshotDb() {
  const data: Record<string, unknown> = {
    kq_equipment_wallets: { cash_cents: 100000, reputation: 0, chanvrier: { strength: "handyperson" } },
    kq_player_equipment: [
      { equipment_code: "TENT-120", purchase_price_cents: 19900, level: 5, culture_wear_percent: 100, culture_wear_version: 60 },
      { equipment_code: "LED-300", purchase_price_cents: 35900, level: 10, culture_wear_percent: 100, culture_wear_version: 10 },
      { equipment_code: "AIR-EC6", purchase_price_cents: 14900, level: 3, culture_wear_percent: 71, culture_wear_version: 20 },
      { equipment_code: "SOLAR-BACKUP", purchase_price_cents: 114900, level: 1, culture_wear_percent: 100, culture_wear_version: 30 },
      { equipment_code: "PRESS-0600", purchase_price_cents: 85000, level: 1, wear_cycles: 10, maintenance_version: 10 },
    ],
    kq_equipment_loadouts: ["TENT-120", "LED-300", "AIR-EC6", "SOLAR-BACKUP", "PRESS-0600"].map(equipment_code => ({ equipment_code })),
  };
  const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null, data: name === "rpc_kq_energy_snapshot" ? { outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [] } : null }));
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const query = { select: () => query, eq: () => query, order: () => query, single: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: data[table] ?? [], error: null, count: 0 }).then(resolve) };
    return query;
  } });
  return rpc;
}
describe("culture equipment backend", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps physical inventory but removes broken bonuses and preserves processing maintenance", async () => {
    snapshotDb(); const shop = await getKqEquipmentShopSnapshot(userId);
    expect(shop.equippedCodes).toContain("LED-300"); expect(shop.ownedCodes).toContain("LED-300");
    expect(shop.cultureOperationalCodes).toEqual(["AIR-EC6", "PRESS-0600", "TENT-080-STARTER", "LED-150-STARTER"]);
    expect(shop.operationalCodes).toEqual(["AIR-EC6", "TENT-080-STARTER", "LED-150-STARTER"]);
    expect(shop.cultureWear?.["LED-300"]).toMatchObject({ conditionPercent: 0, due: true, replacementCents: 68210, version: 10 });
    expect(shop.maintenance?.["PRESS-0600"]).toMatchObject({ due: true, repairCents: 0 });
    expect(shop.cultureWear?.["PRESS-0600"]).toBeUndefined();
  });
  it("quotes the same effective installation used by the next culture", async () => {
    snapshotDb(); const energy = await getKqEnergySnapshot(userId); const shop = await getKqEquipmentShopSnapshot(userId);
    const state = startKqGame(1, { equipmentCodes: shop.cultureOperationalCodes, equipmentLevels: shop.levels, energyMode: "intensive" });
    expect(energy.quotes.intensive).toEqual(state.energy);
    expect(energy.quotes.eco).toEqual(quoteKqEnergy(shop.cultureOperationalCodes!, shop.levels, "eco"));
    expect(energy.quotes.intensive.solarPercent).toBe(0);
    expect(energy.cultureEquipmentCodes).toContain("LED-300");
  });
  it("sends expected price and version to the authoritative replacement transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { paidCents: 35900, level: 1, replayed: false }, error: null }); mocks.client.mockReturnValue({ rpc });
    await expect(replaceKqCultureEquipment(input)).resolves.toMatchObject({ paidCents: 35900 });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_replace_culture_equipment", { p_user_id: userId, p_equipment_code: "LED-300", p_request_key: input.requestKey, p_expected_version: 10, p_expected_cost_cents: 35900 });
  });
  it.each(["LED-150-STARTER", "SECURITY-DOG", "PRESS-0600", "constructor"])("rejects replacement of excluded equipment %s", async equipmentCode => {
    await expect(replaceKqCultureEquipment({ ...input, equipmentCode })).rejects.toThrow("Remplacement invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([NaN, -1, 1.2])("rejects invalid confirmed version %s", async expectedVersion => {
    await expect(replaceKqCultureEquipment({ ...input, expectedVersion })).rejects.toThrow("Remplacement invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([
    ["culture_equipment_condition_changed", "L’état ou le prix a changé"],
    ["culture_equipment_insufficient_cash", "Trésorerie insuffisante"],
    ["culture_equipment_active_run", "Termine la culture"],
  ])("explains %s without exposing database internals", async (code, explanation) => {
    mocks.client.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: code } }) });
    await expect(replaceKqCultureEquipment(input)).rejects.toThrow(explanation);
  });
  it("refuses reinstalling a broken purchase", async () => {
    const rpc = snapshotDb();
    await expect(equipKqDurableEquipment({ userId, equipmentCode: "LED-300" })).rejects.toThrow("fin de vie");
    expect(rpc).not.toHaveBeenCalled();
  });
});
