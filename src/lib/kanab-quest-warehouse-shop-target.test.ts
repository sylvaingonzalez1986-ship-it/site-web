import { describe, expect, it } from "vitest";
import { getKqWarehouseDepartment, getKqWarehouseShopTarget } from "./kanab-quest-warehouse-shop-target";
import { getKqEquipmentProgressionStatus, getKqNextEquipmentGoal, KQ_EQUIPMENT_CATALOG } from "./kanab-quest-equipment";

describe("warehouse catalog destinations", () => {
  it("targets current devices and modules without choosing them for the plan", () => {
    expect(getKqWarehouseShopTarget("SIM-DRYING-02")).toMatchObject({ kind: "catalog", department: "drying", code: "SIM-DRYING-02" });
    expect(getKqWarehouseShopTarget("SIM-SECURITY-02")).toMatchObject({ kind: "catalog", department: "security", code: "SIM-SECURITY-02" });
    expect(getKqWarehouseShopTarget("SIM-STORAGE-CLIMATE-02")).toMatchObject({ kind: "storage-climate", code: "SIM-STORAGE-CLIMATE-02" });
  });
  it("keeps machines and computers on their existing purchase screen", () => {
    expect(getKqWarehouseShopTarget("PRESS-0600")).toEqual({ kind: "workshop", code: "PRESS-0600" });
    expect(getKqWarehouseShopTarget("COMPUTER")).toEqual({ kind: "workshop", code: "COMPUTER" });
  });
  it("does not replace an old, retired, or unknown model with a new purchase", () => {
    for (const code of ["SECURITY-CAMERA", "LED-300", "MH-FCE3000", "unknown-device"]) expect(getKqWarehouseShopTarget(code)).toMatchObject({ kind: "unavailable", code });
    expect(getKqWarehouseShopTarget()).toBeNull();
  });
  it("follows the room from which the catalog was opened", () => {
    expect(["culture", "drying", "storage", "processing"].map(room => getKqWarehouseDepartment(room as "culture" | "drying" | "storage" | "processing"))).toEqual(["lighting", "drying", "storage", "workshop"]);
  });
});

describe("workshop investment advice", () => {
  it("recommends a real transformation machine at its existing price", () => {
    const input = { ownedCodes: ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"], cashCents: 10000 };
    expect(getKqNextEquipmentGoal(input)?.equipment.code).toBe("SECURITY-CAMERA");
    const goal = getKqNextEquipmentGoal({ ...input, category: "processing" });
    expect(goal?.equipment.code).toBe("SIFT-TRAY");
    expect(goal?.equipment.priceCents).toBe(55000);
    expect(goal?.remainingCents).toBe(45000);
  });
  it("does not demand obsolete culture models when the workshop is complete", () => {
    const ownedCodes = KQ_EQUIPMENT_CATALOG.filter(item => item.category === "processing").map(item => item.code);
    expect(getKqNextEquipmentGoal({ ownedCodes, cashCents: 0, category: "processing" })).toBeNull();
    expect(getKqEquipmentProgressionStatus(ownedCodes, "processing").catalogComplete).toBe(true);
    expect(getKqEquipmentProgressionStatus(ownedCodes).catalogComplete).toBe(false);
  });
});
