import { describe, expect, it } from "vitest";
import {
  auditKqEquipmentCatalog,
  buildKqEquipmentGoalReceipt,
  buildKqEquipmentHudSummary,
  getKqEquipmentCartTotal,
  getKqEquipmentDefinition,
  getKqEquipmentImpactLabels,
  getKqEquipmentProgressionStatus,
  getKqNextEquipmentGoal,
  getKqEquipmentRequirementState,
  isKqEquipmentImmediatelyPurchasable,
  isKqEquipmentSuperseded,
  KQ_EQUIPMENT_CATALOG,
  KQ_STARTING_EQUIPMENT_CODES,
  projectKqEquipmentLoadout,
  summarizeKqEquipmentLoadout,
  sortKqEquipmentCatalog,
  validateKqEquipmentCart,
} from "@/lib/kanab-quest-equipment";

const ALIGNED_DATABASE_CATALOG = KQ_EQUIPMENT_CATALOG.map((equipment) => ({
  code: equipment.code,
  price_cents: equipment.priceCents,
  is_purchasable: equipment.purchasable,
  is_active: true,
}));

describe("Kanab Quest durable equipment", () => {
  it("keeps equipment codes unique and prices valid", () => {
    const codes = KQ_EQUIPMENT_CATALOG.map((equipment) => equipment.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(KQ_EQUIPMENT_CATALOG.every((equipment) => equipment.priceCents >= 0)).toBe(true);
    expect(KQ_EQUIPMENT_CATALOG.filter((equipment) => !equipment.purchasable).map((equipment) => equipment.code))
      .toEqual([...KQ_STARTING_EQUIPMENT_CODES]);
  });

  it("calculates a cart without double-charging duplicate durable equipment", () => {
    expect(getKqEquipmentCartTotal(["TENT-120", "AIR-EC6", "TENT-120"])).toBe(34_800);
  });

  it("reports missing compatibility requirements", () => {
    const led = getKqEquipmentDefinition("LED-500")!;
    expect(getKqEquipmentRequirementState({ equipment: led, ownedCodes: [] }).compatible).toBe(false);
    expect(getKqEquipmentRequirementState({ equipment: led, ownedCodes: ["AIR-EC6"] }).compatible).toBe(true);
  });

  it("validates owned items and available cash", () => {
    const validation = validateKqEquipmentCart({
      cartCodes: ["TENT-120", "PRESS-2T"],
      ownedCodes: ["TENT-120"],
      cashCents: 20_000,
    });
    expect(validation.totalCents).toBe(819_400);
    expect(validation.errors).toHaveLength(2);
  });

  it("warns when a cart competes for one loadout slot or replaces installed gear", () => {
    const validation = validateKqEquipmentCart({
      cartCodes: ["TENT-120", "TENT-150"],
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      equippedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 100_000,
    });
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toContain("Tente : 2 articles partagent cet emplacement ; un seul pourra être installé à la fois.");
    expect(validation.warnings.some((warning) => warning.includes("remplacera Tente de départ 90 × 90"))).toBe(true);
  });

  it("summarizes only the installed loadout", () => {
    const summary = summarizeKqEquipmentLoadout(["TENT-120", "LED-300", "AIR-EC6", "SIFT-TRAY"]);
    expect(summary.quantityPercent).toBe(70);
    expect(summary.qualityMaxBonus).toBe(2);
    expect(summary.regularityPercent).toBe(6);
    expect(summary.powerWatts).toBe(518);
    expect(summary.processingPrecision).toBe(82);
    expect(summary.processingCapacityPercent).toBe(35);
    expect(summary.unlocks).toContain("dry-sift");
  });

  it("projects slot replacements without stacking impossible bonuses", () => {
    const projection = projectKqEquipmentLoadout({
      equippedCodes: ["TENT-120", "LED-300", "AIR-EC6"],
      candidateCodes: ["TENT-150"],
      ownedCodes: ["TENT-120", "LED-300", "AIR-EC6"],
    });
    expect(projection.equipmentCodes).toContain("TENT-150");
    expect(projection.equipmentCodes).not.toContain("TENT-120");
    expect(projection.quantityPercent).toBe(120);
    expect(projection.ambiguousSlots).toEqual([]);
  });

  it("keeps ambiguous or blocked cart choices out of projected bonuses", () => {
    const projection = projectKqEquipmentLoadout({
      equippedCodes: ["TENT-120", "LED-300"],
      candidateCodes: ["TENT-150", "TENT-120", "AUTO-SIEVE"],
      ownedCodes: ["TENT-120", "LED-300"],
    });
    expect(projection.quantityPercent).toBe(70);
    expect(projection.ambiguousSlots).toEqual(["tent"]);
    expect(projection.blockedCodes).toEqual(["AUTO-SIEVE"]);
  });

  it("keeps processing tiers inside the intended progression capacities", () => {
    expect(getKqEquipmentDefinition("PRESS-0600")?.effects.processingCapacity).toBe(20);
    expect(getKqEquipmentDefinition("PRESS-2T")?.effects.processingCapacity).toBe(35);
    expect(getKqEquipmentDefinition("PRESS-10T")?.effects.processingCapacity).toBe(55);
    expect(getKqEquipmentDefinition("PRESS-20T")?.effects.processingCapacity).toBe(90);
    expect(getKqEquipmentDefinition("WASHER-25L")?.effects.processingCapacity).toBe(45);
    expect(getKqEquipmentDefinition("WASHER-75G")?.effects.processingCapacity).toBe(80);
    expect(getKqEquipmentDefinition("TSS-225")?.effects.processingCapacity).toBe(100);
  });

  it("separates purchased equipment from the supplied starter kit for the home HUD", () => {
    const summary = buildKqEquipmentHudSummary({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES, "TENT-120", "SIFT-TRAY"],
      equippedCodes: ["LED-150-STARTER", "AIR-STARTER", "TENT-120"],
    });
    expect(summary.purchased.map((equipment) => equipment.code)).toEqual(["TENT-120", "SIFT-TRAY"]);
    expect(summary.purchased.find((equipment) => equipment.code === "TENT-120")?.equipped).toBe(true);
    expect(summary.purchased.find((equipment) => equipment.code === "SIFT-TRAY")?.equipped).toBe(false);
    expect(summary.installed.map((equipment) => equipment.code)).toEqual(["LED-150-STARTER", "AIR-STARTER", "TENT-120"]);
  });

  it("suggests the nearest compatible unlock as the next durable goal", () => {
    const starterGoal = getKqNextEquipmentGoal({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 4_250,
    });
    expect(starterGoal?.equipment.code).toBe("SECURITY-CAMERA");
    expect(starterGoal?.progressPercent).toBe(61);
    expect(starterGoal?.remainingCents).toBe(2_749);
    expect(starterGoal?.affordable).toBe(false);

    const nextGoal = getKqNextEquipmentGoal({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES, "SECURITY-CAMERA"],
      cashCents: 9_000,
    });
    expect(nextGoal?.equipment.code).toBe("AIR-EC6");
    expect(nextGoal?.progressPercent).toBe(60);
    expect(nextGoal?.remainingCents).toBe(5_900);
    expect(nextGoal?.affordable).toBe(false);

    const climateGoal = getKqNextEquipmentGoal({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES, "SECURITY-CAMERA", "AIR-EC6"],
      cashCents: 15_000,
    });
    expect(climateGoal?.equipment.code).toBe("CLIMATE-SMART");
    expect(climateGoal?.affordable).toBe(true);
  });

  it("orders the shop around progression while keeping explicit price sorts", () => {
    const ownedCodes = [...KQ_STARTING_EQUIPMENT_CODES];
    const progression = sortKqEquipmentCatalog({
      equipment: KQ_EQUIPMENT_CATALOG,
      ownedCodes,
      cashCents: 35_000,
      recommendedCode: "SECURITY-CAMERA",
    });
    expect(progression[0]?.code).toBe("SECURITY-CAMERA");
    expect(progression.findIndex((equipment) => equipment.code === "AIR-EC6"))
      .toBeLessThan(progression.findIndex((equipment) => equipment.code === "LED-300"));

    const descending = sortKqEquipmentCatalog({
      equipment: KQ_EQUIPMENT_CATALOG,
      ownedCodes,
      cashCents: 35_000,
      sort: "price-desc",
    });
    expect(descending[0]?.code).toBe("STATIC-PLASMA");
  });

  it("recognizes only compatible, unowned equipment inside the current budget", () => {
    expect(isKqEquipmentImmediatelyPurchasable({
      equipment: getKqEquipmentDefinition("AIR-EC6")!,
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 35_000,
    })).toBe(true);
    expect(isKqEquipmentImmediatelyPurchasable({
      equipment: getKqEquipmentDefinition("CLIMATE-SMART")!,
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 35_000,
    })).toBe(false);
    expect(isKqEquipmentImmediatelyPurchasable({
      equipment: getKqEquipmentDefinition("PRESS-0600")!,
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 35_000,
    })).toBe(false);
  });

  it("does not suggest an incompatible shortcut or an already complete catalog", () => {
    const withoutWasher = getKqNextEquipmentGoal({
      ownedCodes: KQ_EQUIPMENT_CATALOG
        .filter((equipment) => equipment.code !== "FREEZE-DRYER" && !["WASHER-25L", "WASHER-75G", "TSS-225"].includes(equipment.code))
        .map((equipment) => equipment.code),
      cashCents: 500_000,
    });
    expect(withoutWasher?.equipment.code).toBe("WASHER-25L");

    expect(getKqNextEquipmentGoal({
      ownedCodes: KQ_EQUIPMENT_CATALOG.map((equipment) => equipment.code),
      cashCents: 500_000,
    })).toBeNull();
  });

  it("does not present a lower model as progress after a superior model is owned", () => {
    expect(isKqEquipmentSuperseded("TENT-120", ["TENT-150"])).toBe(true);
    expect(isKqEquipmentSuperseded("TENT-150", ["TENT-120"])).toBe(false);
    expect(isKqEquipmentSuperseded("PRESS-0600", ["PRESS-20T"])).toBe(true);

    const everythingExceptTheDowngrade = KQ_EQUIPMENT_CATALOG
      .filter((equipment) => equipment.code !== "TENT-120")
      .map((equipment) => equipment.code);
    everythingExceptTheDowngrade.push("TENT-150");
    expect(getKqNextEquipmentGoal({
      ownedCodes: everythingExceptTheDowngrade,
      cashCents: 10_000_000,
    })).toBeNull();
    expect(getKqEquipmentProgressionStatus(everythingExceptTheDowngrade)).toEqual({
      catalogComplete: false,
      progressionComplete: true,
      remainingCount: 1,
      alternativeCount: 1,
    });
  });

  it("makes professional rosin presses cumulatively unlock lower recipes", () => {
    expect(getKqEquipmentDefinition("PRESS-2T")?.unlocks).toEqual(["rosin-trial", "rosin-selection"]);
    expect(getKqEquipmentDefinition("PRESS-10T")?.unlocks).toEqual(["rosin-trial", "rosin-selection", "rosin-premium"]);
    expect(getKqEquipmentDefinition("PRESS-20T")?.unlocks).toEqual(["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"]);
  });

  it("translates every purchase into concrete workshop and market impacts", () => {
    expect(getKqEquipmentImpactLabels(getKqEquipmentDefinition("PRESS-10T")!)).toEqual([
      "Capacité de transformation 55 %",
      "Précision de transformation 92 %",
      "Débloque : Rosin d’essai",
      "Débloque : Rosin Sélection",
      "Débloque : Rosin Premium",
    ]);
    expect(getKqEquipmentImpactLabels(getKqEquipmentDefinition("SOLAR-BACKUP")!)).toEqual([
      "Facture −20 %",
      "Débloque : Secours contre les coupures",
    ]);
  });

  it("builds a compact next-goal contract for sale receipts", () => {
    expect(buildKqEquipmentGoalReceipt({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES],
      cashCents: 8_500,
    })).toMatchObject({
      code: "SECURITY-CAMERA",
      priceCents: 6_999,
      remainingCents: 0,
      progressPercent: 100,
      affordable: true,
    });
    expect(buildKqEquipmentGoalReceipt({
      ownedCodes: KQ_EQUIPMENT_CATALOG.map((equipment) => equipment.code),
      cashCents: 500_000,
    })).toBeNull();
  });

  it("anchors every catalog item to a dated, verifiable real product", () => {
    expect(KQ_EQUIPMENT_CATALOG.every((equipment) => (
      equipment.realWorldAnchor.referencePriceCents > 0
      && equipment.realWorldAnchor.checkedAt === "2026-09-01"
      && equipment.realWorldAnchor.sourceUrl.startsWith("https://")
      && equipment.realWorldAnchor.seller.length > 0
    ))).toBe(true);
    expect(KQ_EQUIPMENT_CATALOG.filter((equipment) => equipment.purchasable)
      .every((equipment) => equipment.priceCents === equipment.realWorldAnchor.referencePriceCents)).toBe(true);
  });

  it("audits both the source-backed catalog and the database checkout prices", () => {
    expect(auditKqEquipmentCatalog(ALIGNED_DATABASE_CATALOG)).toMatchObject({
      sourcesReady: true,
      databaseReady: true,
      sourceCount: 15,
      purchasableCount: 12,
      mismatchedCodes: [],
    });
    expect(auditKqEquipmentCatalog(ALIGNED_DATABASE_CATALOG.map((row) => (
      row.code === "LED-300" ? { ...row, price_cents: row.price_cents - 1 } : row
    )))).toMatchObject({
      sourcesReady: true,
      databaseReady: false,
      mismatchedCodes: ["LED-300"],
    });
  });
});
