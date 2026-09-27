import { beforeEach, describe, expect, it, vi } from "vitest";
import productionFixture from "@/test/fixtures/kq-asymmetric-tents.json";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { getKqEquipmentShopSnapshot } from "./kanab-quest-equipment-backend";
import { getKqEnergySnapshot } from "./kanab-quest-energy-backend";
import { startKqPlayerRun } from "./kanab-quest-backend";
import { quoteKqEnergy } from "../kanab-quest-energy";
import { KQ_BUDDIES, startKqGame, type KqGameState } from "../kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "../kanab-quest-persistence";

const userId = "11000000-0000-4000-8000-000000000001";
const input = { buddieCode: KQ_BUDDIES[0].code, deckCodes: [] };
type Row = Record<string, unknown>;

function database(fixture = structuredClone(productionFixture)) {
  const rows: Record<string, Row | Row[]> = {
    kq_equipment_wallets: { cash_cents: 1000000, reputation: 0, production_units: fixture.productionUnits },
    kq_player_equipment: fixture.owned,
    kq_equipment_loadouts: fixture.loadouts,
    lottery_card_collections: { id: "botte", is_active: true },
    kq_culture_token_wallets: { balance: 0 },
  };
  const reads: Array<{ table: string; columns: string }> = [];
  const rpc = vi.fn().mockImplementation(async (name: string) => ({
    error: null,
    data: name === "rpc_kq_commerce_state"
      ? { business: { version: 1, domiciliation: { mode: "home", active: true } } }
      : name === "rpc_kq_energy_snapshot"
        ? { outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [] }
        : { run: { id: "run-compat" }, burnReceipt: null },
  }));
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const query = {
      select: (columns: string) => { reads.push({ table, columns }); return query; },
      eq: () => query, in: () => query, order: () => query, limit: () => query,
      maybeSingle: () => query, single: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null, count: 0 }).then(resolve),
    };
    return query;
  } });
  return { rpc, reads };
}

beforeEach(() => vi.clearAllMocks());

describe("culture compatibility with individually equipped tents", () => {
  it.each(["eco", "balanced", "intensive"] as const)("uses the production fixture from shop through %s quote, launch RPC and saved game", async energyMode => {
    const { rpc, reads } = database();
    const shop = await getKqEquipmentShopSnapshot(userId);
    expect(reads.find(read => read.table === "kq_player_equipment")?.columns).toContain("tent_number");
    expect(reads.find(read => read.table === "kq_equipment_loadouts")?.columns).toContain("tent_number");
    expect(shop.tents).toHaveLength(2);
    expect(shop.tents[0].levels["LED-300"]).toBe(10);
    expect(shop.tents[1].cultureOperationalCodes.sort()).toEqual(["AIR-STARTER", "LED-150-STARTER", "TENT-080-STARTER"]);
    const energy = await getKqEnergySnapshot(userId);
    const expectedEnergyCents = shop.tents.reduce((total, tent) => total + quoteKqEnergy(tent.cultureOperationalCodes, tent.levels, energyMode).totalCents, 0);
    expect(energy.quotes[energyMode].totalCents).toBe(expectedEnergyCents);
    const result = await startKqPlayerRun(userId, { ...input, energyMode, expectedEnergyCents });
    expect(result.state.energy).toEqual(energy.quotes[energyMode]);
    const expectedTents = shop.tents.map(tent => ({ tentNumber: tent.tentNumber, codes: tent.cultureOperationalCodes,
      levels: Object.fromEntries(tent.cultureOperationalCodes.map(code => [code, tent.levels[code] ?? 1])) }));
    // Order is immaterial to SQL, while the frozen state retains its own stable order.
    for (const tent of result.state.equipment!.tents!) {
      const expected = expectedTents.find(item => item.tentNumber === tent.tentNumber)!;
      expect([...tent.codes].sort()).toEqual([...expected.codes].sort());
      expect(tent.levels).toEqual(expected.levels);
    }
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_run_with_heritage", expect.objectContaining({
      p_user_id: userId, p_initial_state: result.state,
    }));
    expect(parseKqGameSave(encodeKqSave(result.state))).toEqual(result.state);
    expect(result.state.equipment!.tents![1].codes).not.toContain("LED-300");
  });

  it("does not overwrite a level or broken state with another copy of the same model", async () => {
    const fixture = structuredClone(productionFixture);
    fixture.owned.push({ tent_number: 2, equipment_code: "LED-300", level: 1, culture_wear_percent: 100, purchase_price_cents: 35900 });
    fixture.loadouts.find(row => row.tent_number === 2 && row.slot === "lighting")!.equipment_code = "LED-300";
    database(fixture);
    const shop = await getKqEquipmentShopSnapshot(userId);
    expect(shop.tents[0].cultureOperationalCodes).toContain("LED-300");
    expect(shop.tents[0].levels["LED-300"]).toBe(10);
    expect(shop.tents[1].cultureOperationalCodes).not.toContain("LED-300");
    expect(shop.tents[1].cultureOperationalCodes).toContain("LED-150-STARTER");
    const energy = await getKqEnergySnapshot(userId);
    const result = await startKqPlayerRun(userId, { ...input, energyMode: "balanced", expectedEnergyCents: energy.quotes.balanced.totalCents });
    expect(result.state.energy).toEqual(energy.quotes.balanced);
    expect(parseKqGameSave(encodeKqSave(result.state))).toEqual(result.state);
  });

  it("rejects an out-of-date client estimate before starting a run", async () => {
    const { rpc } = database();
    const energy = await getKqEnergySnapshot(userId);
    await expect(startKqPlayerRun(userId, { ...input, energyMode: "balanced", expectedEnergyCents: energy.quotes.balanced.totalCents + 1 })).rejects.toThrow("devis");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("keeps one-tent launches compatible", async () => {
    const fixture = structuredClone(productionFixture);
    fixture.productionUnits = 1;
    fixture.owned = fixture.owned.filter(row => row.tent_number === 1);
    fixture.loadouts = fixture.loadouts.filter(row => row.tent_number === 1);
    database(fixture);
    const energy = await getKqEnergySnapshot(userId);
    const result = await startKqPlayerRun(userId, { ...input, expectedEnergyCents: energy.quotes.balanced.totalCents });
    expect(result.state.equipment!.tents).toHaveLength(1);
    expect(result.state.energy).toEqual(energy.quotes.balanced);
    expect(parseKqGameSave(encodeKqSave(result.state))).toEqual(result.state);
  });

  it("accepts historical homogeneous saves and rejects altered tent snapshots", () => {
    const legacy = startKqGame(1, { productionUnits: 2, equipmentCodes: ["LED-300"], equipmentLevels: { "LED-300": 2 }, energyMode: "balanced" });
    expect(legacy.equipment!.tents).toBeUndefined();
    expect(parseKqGameSave(encodeKqSave(legacy))).toEqual(legacy);
    const current = startKqGame(1, { productionUnits: 2, energyMode: "balanced", equipmentTents: [
      { tentNumber: 1, codes: ["LED-300"], levels: { "LED-300": 2 } },
      { tentNumber: 2, codes: ["LED-150-STARTER"], levels: { "LED-150-STARTER": 1 } },
    ] });
    expect(parseKqGameSave(encodeKqSave(current))).toEqual(current);
    const tampered: KqGameState = structuredClone(current);
    tampered.equipment!.tents![0].levels["LED-300"] = 10;
    expect(parseKqGameSave(encodeKqSave(tampered))).toBeNull();
  });
});
