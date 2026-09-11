import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { equipKqDurableEquipment, upgradeKqDurableEquipment, purchaseKqDurableEquipment } from "@/lib/supabase/kanab-quest-equipment-backend";

const USER_ID = "11000000-0000-4000-8000-000000000001";

function mockEquipmentOwnership(rows: Array<{ equipment_code: string; purchase_price_cents: number }>) {
  const eq = vi.fn().mockResolvedValue({
    data: rows,
    error: null,
  });
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
    const input = { userId: USER_ID, requestKey: "11000000-0000-4000-8000-000000000002", equipmentCode: "LED-300", expectedLevel: 4 };
    await expect(upgradeKqDurableEquipment(input)).resolves.toMatchObject({ level: 5 });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_upgrade_equipment", {
      p_user_id: USER_ID, p_request_key: input.requestKey, p_equipment_code: "LED-300", p_expected_level: 4,
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

  it("allows the RPC only after ownership has been verified", async () => {
    const database = mockEquipmentOwnership([{ equipment_code: "SECURITY-CAMERA", purchase_price_cents: 6_999 }]);

    await expect(equipKqDurableEquipment({
      userId: USER_ID,
      equipmentCode: "SECURITY-CAMERA",
    })).resolves.toEqual({
      equipmentCode: "SECURITY-CAMERA",
      slot: "security",
      equipped: true,
    });

    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_equip_durable", {
      p_user_id: USER_ID,
      p_equipment_code: "SECURITY-CAMERA",
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
});
