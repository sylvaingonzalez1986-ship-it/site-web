import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { repairKqMachine, equipKqDurableEquipment, upgradeKqDurableEquipment, purchaseKqDurableEquipment, getKqEquipmentShopSnapshot } from "@/lib/supabase/kanab-quest-equipment-backend";

const USER_ID = "11000000-0000-4000-8000-000000000001";

function mockEquipmentOwnership(rows: Array<{ equipment_code: string; purchase_price_cents: number; tent_number?: number }>) {
  let tentNumber = 1;
  const query = {
    eq: vi.fn((key: string, value: unknown) => { if (key === "tent_number") tentNumber = Number(value); return query; }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows.filter(row => (row.tent_number ?? 1) === tentNumber), error: null }).then(resolve),
  };
  const eq = query.eq;
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({
    data: { equipmentCode: "SECURITY-CAMERA", slot: "security", equipped: true },
    error: null,
  });
  createSupabaseServiceClient.mockReturnValue({ from, rpc });
  return { eq, select, from, rpc };
}

describe("Kanab Quest durable equipment installation", () => {
  beforeEach(() => {
    createSupabaseServiceClient.mockReset();
  });

  it("sends only the session owner, expected level and idempotency key to the upgrade transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { level: 5, cashAfterCents: 1000 }, error: null });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const input = { userId: USER_ID, requestKey: "11000000-0000-4000-8000-000000000002", equipmentCode: "LED-300", expectedLevel: 4, tentNumber: 2 };
    await expect(upgradeKqDurableEquipment(input)).resolves.toMatchObject({ level: 5 });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_upgrade_tent_equipment", {
      p_user_id: USER_ID, p_request_key: input.requestKey, p_equipment_code: "LED-300", p_expected_level: 4, p_tent_number: 1,
    });
    rpc.mockResolvedValue({ data: null, error: { message: "equipment_level_changed" } });
    await expect(upgradeKqDurableEquipment(input)).rejects.toThrow("Le niveau a changé");
  });

  it("rejects retired purchases and upgrades before accessing the database", async () => {
    const requestKey = "11000000-0000-4000-8000-000000000002";
    await expect(purchaseKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCodes: ["PRESS-20T"] })).rejects.toThrow("pas disponible");
    await expect(upgradeKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCode: "PRESS-20T", expectedLevel: 1 })).rejects.toThrow("non améliorable");
    await expect(upgradeKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCode: "LED-300", expectedLevel: 10 })).rejects.toThrow("maximal");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("rejects an installation before the RPC when the player does not own the equipment", async () => {
    const database = mockEquipmentOwnership([
      { equipment_code: "TENT-080-STARTER", purchase_price_cents: 0 },
      { equipment_code: "LED-150-STARTER", purchase_price_cents: 0 },
      { equipment_code: "AIR-STARTER", purchase_price_cents: 0 },
    ]);

    await expect(equipKqDurableEquipment({
      userId: USER_ID,
      equipmentCode: "SECURITY-CAMERA",
    })).rejects.toThrow("Cet équipement ne t’appartient pas.");

    expect(database.from).toHaveBeenCalledWith("kq_player_equipment");
    expect(database.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("rejects the removed fence for purchase, installation and upgrade before accessing the database", async () => {
    const requestKey = "11000000-0000-4000-8000-000000000002";
    await expect(purchaseKqDurableEquipment({userId:USER_ID,requestKey,equipmentCodes:["SECURITY-FENCE"]})).rejects.toThrow("pas disponible");
    await expect(equipKqDurableEquipment({userId:USER_ID,equipmentCode:"SECURITY-FENCE"})).rejects.toThrow("plus disponible");
    await expect(upgradeKqDurableEquipment({userId:USER_ID,requestKey,equipmentCode:"SECURITY-FENCE",expectedLevel:1})).rejects.toThrow("non améliorable");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("hides an old owned and installed fence from inventory and future run equipment", async () => {
    const rows: Record<string, unknown> = {
      kq_equipment_wallets: {cash_cents:100000,reputation:0},
      kq_player_equipment: [
        {equipment_code:"SECURITY-FENCE",purchase_price_cents:18000,level:3},
        {equipment_code:"SECURITY-DOG",purchase_price_cents:100000,level:1},
      ],
      kq_equipment_loadouts: [{equipment_code:"SECURITY-FENCE"}],
    };
    createSupabaseServiceClient.mockReturnValue({rpc:vi.fn().mockResolvedValue({error:null}),from:(table:string)=>{
      const query = {select:()=>query,eq:()=>query,order:()=>query,single:()=>query,
        then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:rows[table]??[],error:null,count:0}).then(resolve)};
      return query;
    }});
    const snapshot = await getKqEquipmentShopSnapshot(USER_ID);
    expect(snapshot.ownedCodes).toEqual(["SECURITY-DOG"]);
    expect(snapshot.purchasedCodes).toEqual(["SECURITY-DOG"]);
    expect(snapshot.equippedCodes).toEqual([]);
    expect(snapshot.levels).toEqual({"SECURITY-DOG":1});
    expect(snapshot.catalog.some((item)=>item.code==="SECURITY-FENCE")).toBe(false);
  });

  it("allows the RPC only after ownership has been verified", async () => {
    const database = mockEquipmentOwnership([{ equipment_code: "SECURITY-CAMERA", purchase_price_cents: 6_999 }]);

    await expect(equipKqDurableEquipment({
      userId: USER_ID,
      equipmentCode: "SECURITY-CAMERA",
      tentNumber: 1,
    })).resolves.toEqual({
      equipmentCode: "SECURITY-CAMERA",
      slot: "security",
      equipped: true,
    });

    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_equip_tent_equipment", {
      p_user_id: USER_ID,
      p_equipment_code: "SECURITY-CAMERA",
      p_tent_number: 1,
    });
  });

  it("rejects a purchasable catalog item recorded without a completed purchase", async () => {
    const database = mockEquipmentOwnership([{ equipment_code: "SECURITY-CAMERA", purchase_price_cents: 0 }]);

    await expect(equipKqDurableEquipment({
      userId: USER_ID,
      equipmentCode: "SECURITY-CAMERA",
    })).rejects.toThrow("Cet équipement doit être acheté avant de pouvoir être installé.");

    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("installs an owned culture model globally from another selected tent", async () => {
    const database = mockEquipmentOwnership([{ equipment_code: "LED-300", purchase_price_cents: 35900, tent_number: 1 }]);
    await equipKqDurableEquipment({ userId: USER_ID, equipmentCode: "LED-300", tentNumber: 2 });
    expect(database.eq).toHaveBeenCalledWith("tent_number", 1);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_equip_tent_equipment", { p_user_id: USER_ID, p_equipment_code: "LED-300", p_tent_number: 1 });
  });
  it.each([0, -1, 1.5, 9, NaN])("rejects invalid tent %s before spending", async tentNumber => {
    await expect(purchaseKqDurableEquipment({ userId: USER_ID, requestKey: "11000000-0000-4000-8000-000000000002", equipmentCodes: ["LED-300"], tentNumber })).rejects.toThrow("Tente invalide");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("keeps legacy receipt replay and stale fleet guards for requests without a tent", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { replayed: true }, error: null });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const requestKey = "11000000-0000-4000-8000-000000000002";
    await purchaseKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCodes: ["LED-300"], expectedUnits: 4 });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_purchase_production_equipment", { p_user_id: USER_ID, p_request_key: requestKey, p_equipment_codes: ["LED-300"], p_expected_units: 4 });
    rpc.mockResolvedValue({ data: null, error: { message: "production_units_changed" } });
    await expect(upgradeKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCode: "LED-300", expectedLevel: 1, expectedUnits: 4 })).rejects.toThrow("sélectionner une tente");
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_upgrade_production_equipment", { p_user_id: USER_ID, p_request_key: requestKey, p_equipment_code: "LED-300", p_expected_level: 1, p_expected_units: 4 });
  });

});


describe("shared installation inventory", () => {
  beforeEach(() => createSupabaseServiceClient.mockReset());
  const requestKey = "11000000-0000-4000-8000-000000000002";

  it("installs the single shared machine from any selected tent", async () => {
    const database = mockEquipmentOwnership([{ equipment_code: "WASHER-25L", purchase_price_cents: 125000, tent_number: 1 }]);
    await equipKqDurableEquipment({ userId: USER_ID, equipmentCode: "WASHER-25L", tentNumber: 8 });
    expect(database.eq).toHaveBeenCalledWith("tent_number", 1);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_equip_tent_equipment", {
      p_user_id: USER_ID, p_equipment_code: "WASHER-25L", p_tent_number: 1,
    });
  });

  it("targets the canonical machine for upgrades and repairs without scaling their price", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await upgradeKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCode: "WASHER-25L", expectedLevel: 3, tentNumber: 8, expectedUnits: 8 });
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_upgrade_tent_equipment", {
      p_user_id: USER_ID, p_request_key: requestKey, p_equipment_code: "WASHER-25L", p_expected_level: 3, p_tent_number: 1,
    });
    await repairKqMachine({ userId: USER_ID, requestKey, equipmentCode: "WASHER-25L", expectedVersion: 4, expectedCostCents: 12500, tentNumber: 8 });
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_repair_tent_machine", {
      p_user_id: USER_ID, p_request_key: requestKey, p_equipment_code: "WASHER-25L", p_expected_version: 4, p_expected_cost_cents: 12500, p_tent_number: 1,
    });
  });

  it("purchases culture and processing equipment in one canonical transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await purchaseKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCodes: ["LED-300", "WASHER-25L"], tentNumber: 8 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_purchase_tent_equipment", {
      p_user_id: USER_ID, p_request_key: requestKey, p_equipment_codes: ["LED-300", "WASHER-25L"], p_tent_number: 1,
    });
    await purchaseKqDurableEquipment({ userId: USER_ID, requestKey, equipmentCodes: ["WASHER-25L"], tentNumber: 8 });
    expect(rpc).toHaveBeenLastCalledWith("rpc_kq_purchase_tent_equipment", {
      p_user_id: USER_ID, p_request_key: requestKey, p_equipment_codes: ["WASHER-25L"], p_tent_number: 1,
    });
  });

  it("returns the canonical shared profile once and excludes stale copies from individual tents", async () => {
    const rows: Record<string, unknown> = {
      kq_equipment_wallets: { cash_cents: 1000000, production_units: 2 },
      kq_player_equipment: [
        { tent_number: 1, equipment_code: "WASHER-25L", purchase_price_cents: 125000, level: 3, wear_cycles: 10, maintenance_version: 6 },
        { tent_number: 2, equipment_code: "WASHER-25L", purchase_price_cents: 125000, level: 9, wear_cycles: 0 },
        { tent_number: 1, equipment_code: "LED-300", purchase_price_cents: 35900, level: 2, culture_wear_percent: 50 },
      ],
      kq_equipment_loadouts: [
        { tent_number: 1, equipment_code: "WASHER-25L" },
        { tent_number: 2, equipment_code: "WASHER-25L" },
        { tent_number: 1, equipment_code: "LED-300" },
      ],
    };
    createSupabaseServiceClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: null }), from: (table: string) => {
      const query = { select: () => query, eq: () => query, order: () => query, single: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null, count: 0 }).then(resolve) };
      return query;
    } });
    const second = await getKqEquipmentShopSnapshot(USER_ID, 2);
    const first = await getKqEquipmentShopSnapshot(USER_ID, 1);
    expect(second.sharedEquipment).toEqual(first.sharedEquipment);
    expect(second.sharedEquipment.equippedCodes).toEqual(["WASHER-25L", "LED-300"]);
    expect(second.sharedEquipment.levels).toEqual({ "WASHER-25L": 3, "LED-300": 2 });
    expect(second.sharedEquipment.maintenance["WASHER-25L"].due).toBe(true);
    expect(second.sharedEquipment.operationalCodes).toEqual(["LED-300", "TENT-080-STARTER", "AIR-STARTER"]);
    expect(second.tents[1].ownedCodes).toEqual(["LED-300"]);
    expect(second.tents[0].maintenance).toEqual({});
    expect(second.tents[0].equippedCodes).toEqual(second.tents[1].equippedCodes);
    expect(second.sharedEquipment.cultureWear["LED-300"].wearPercent).toBe(50);
    expect(second.sharedEquipment.cultureOperationalCodes).toContain("LED-300");
    expect(second.equippedCodes).toEqual(first.equippedCodes);
    expect(second.catalog.find(item => item.code === "WASHER-25L")?.effects.processingCapacity).toBe(57);
  });
});
