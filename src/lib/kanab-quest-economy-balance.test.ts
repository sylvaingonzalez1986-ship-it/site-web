import { describe, expect, it } from "vitest";
import {
  buildKqEconomyBalanceReport,
  getKqEquipmentInvestmentProgress,
  getKqEquipmentPaybackScenarios,
  getKqEquipmentSaleFundingProjection,
  KQ_MARKET_ROUTE_MINIMUM_LOADOUTS,
  KQ_PLAYER_PAYBACK_REFERENCE,
} from "@/lib/kanab-quest-economy-balance";
import { KQ_MARKET_ROUTE_CODES } from "@/lib/kanab-quest-market";

describe("Kanab Quest economy balance report", () => {
  it("turns a machine chain into a concrete savings goal", () => {
    expect(getKqEquipmentInvestmentProgress({ investmentCents: 1_000_000, cashCents: 350_000 })).toEqual({
      targetCents: 1_000_000,
      availableCents: 350_000,
      remainingCents: 650_000,
      affordable: false,
      progressPercent: 35,
    });
    expect(getKqEquipmentInvestmentProgress({ investmentCents: 100_000, cashCents: 150_000 })).toMatchObject({
      remainingCents: 0,
      affordable: true,
      progressPercent: 100,
    });
  });

  it("shows how one sale advances a pinned equipment route", () => {
    expect(getKqEquipmentSaleFundingProjection({
      investmentCents: 100_000,
      cashBeforeCents: 35_000,
      payoutCents: 20_000,
    })).toMatchObject({
      before: { remainingCents: 65_000, progressPercent: 35, affordable: false },
      after: { remainingCents: 45_000, progressPercent: 55, affordable: false },
      contributionCents: 20_000,
      newlyAffordable: false,
      comparableSalesRemaining: 3,
    });
    expect(getKqEquipmentSaleFundingProjection({
      investmentCents: 50_000,
      cashBeforeCents: 35_000,
      payoutCents: 20_000,
    })).toMatchObject({
      contributionCents: 15_000,
      newlyAffordable: true,
      comparableSalesRemaining: 0,
      after: { affordable: true, progressPercent: 100 },
    });
  });

  it("projects every route from its minimum compatible loadout", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100 });
    expect(report.projections.map((projection) => projection.route)).toEqual([...KQ_MARKET_ROUTE_CODES]);
    expect(report.projections.find((projection) => projection.route === "hash-signature")?.equipmentCodes)
      .toEqual(["WASHER-25L", "AUTO-SIEVE", "FREEZE-DRYER"]);
    expect(Object.keys(KQ_MARKET_ROUTE_MINIMUM_LOADOUTS).sort())
      .toEqual([...KQ_MARKET_ROUTE_CODES].sort());
  });

  it("uses raw flower as the comparison once the jury unlocks it", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100 });
    expect(report.baselineRoute).toBe("raw");
    expect(report.baselinePayoutCents).toBeGreaterThan(0);
    expect(report.projections.find((projection) => projection.route === "rosin-premium")?.comparisonDeltaCents)
      .toBeGreaterThan(0);
  });

  it("falls back to biomass when a weak lot cannot be sold raw", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 4.5, harvestGrams: 100 });
    expect(report.baselineRoute).toBe("biomass");
    expect(report.projections.find((projection) => projection.route === "raw")?.available).toBe(false);
    expect(report.projections.filter((projection) => projection.route !== "biomass" && projection.route !== "raw")
      .every((projection) => projection.status === "unavailable")).toBe(true);
  });

  it("keeps every unlocked transformation financially useful at signature quality", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100 });
    expect(report.signals.dominated).toBe(0);
    expect(report.signals.tooFast).toBe(0);
    expect(report.signals.balanced + report.signals.slowOrExcessive).toBe(8);
    expect(report.projections.find((projection) => projection.route === "dry-sift")?.comparisonDeltaCents)
      .toBeGreaterThan(0);
    expect(report.projections.find((projection) => projection.route === "hash-signature")?.paybackHarvests)
      .toBeGreaterThanOrEqual(3);
  });

  it("shows one-time expertise reputation at sales 3, 6 and 10", () => {
    const thirdSale = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100, routeSaleCount: 3 });
    const fourthSale = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100, routeSaleCount: 4 });
    const sixthSale = buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100, routeSaleCount: 6 });
    const drySiftAtThree = thirdSale.projections.find((projection) => projection.route === "dry-sift");
    const rawAtThree = thirdSale.projections.find((projection) => projection.route === "raw");

    expect(thirdSale.expertise.milestones.map((milestone) => [milestone.saleCount, milestone.bonusReputation]))
      .toEqual([[3, 5], [6, 12], [10, 25]]);
    expect(drySiftAtThree?.expertiseBonusReputation).toBe(5);
    expect(drySiftAtThree?.totalReputationGain).toBe((drySiftAtThree?.reputationGain ?? 0) + 5);
    expect(rawAtThree?.expertiseBonusReputation).toBe(0);
    expect(fourthSale.expertise.activeBonusReputation).toBe(0);
    expect(sixthSale.expertise.activeBonusReputation).toBe(12);
  });

  it("does not let an expertise milestone hide mediocre or poor quality in the admin projection", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 7.5, harvestGrams: 100, routeSaleCount: 10 });
    expect(report.projections.find((row) => row.route === "dry-sift")).toMatchObject({
      reputationGain: 0, expertiseBonusReputation: 0, totalReputationGain: 0,
    });
    expect(report.projections.find((row) => row.route === "rosin-selection")).toMatchObject({
      reputationGain: -4, expertiseBonusReputation: 0, totalReputationGain: -4,
    });
  });

  it("tracks the real-world price anchors for every purchasable item", () => {
    const report = buildKqEconomyBalanceReport({ juryScore: 8, harvestGrams: 120 });
    expect(report.priceAnchors.totalCount).toBe(19);
    expect(report.priceAnchors.alignedCount).toBe(report.priceAnchors.totalCount);
    expect(report.priceAnchors.items.every((item) => item.deviationPercent === 0)).toBe(true);
    expect(report.priceAnchors.checkedAt).toBe("2026-09-01");
    expect(report.priceAnchors.items.every((item) => item.sourceUrl.startsWith("https://"))).toBe(true);
    expect(report.priceAnchors.items.some((item) => item.priceKind === "promotion")).toBe(true);
  });

  it("offers player-facing payback scenarios for every machine that opens a processing route", () => {
    expect(KQ_PLAYER_PAYBACK_REFERENCE).toEqual({ juryScore: 8.8, harvestGrams: 100 });
    expect(getKqEquipmentPaybackScenarios("PRESS-20T").map((projection) => projection.route))
      .toEqual(["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"]);
    expect(getKqEquipmentPaybackScenarios("AUTO-SIEVE").map((projection) => projection.route))
      .toEqual(["hash-signature"]);
    expect(getKqEquipmentPaybackScenarios("WASHER-75G").map((projection) => projection.route))
      .toEqual(["ice-water-hash", "hash-signature"]);
    expect(getKqEquipmentPaybackScenarios("TSS-225")[0]?.projectedEquipmentCodes)
      .toContain("TSS-225");
    expect(getKqEquipmentPaybackScenarios("LED-300")).toEqual([]);
    expect(getKqEquipmentPaybackScenarios("PRESS-20T")[0]?.paybackHarvests).toBeGreaterThan(0);
  });

  it("hides a lower model when the player already owns its superior replacement", () => {
    expect(getKqEquipmentPaybackScenarios("WASHER-25L", { ownedCodes: ["WASHER-75G"] })).toEqual([]);
    expect(getKqEquipmentPaybackScenarios("PRESS-2T", { ownedCodes: ["PRESS-10T"] })).toEqual([]);
  });

  it("personalizes the remaining investment and accepts a superior owned machine", () => {
    const scenario = getKqEquipmentPaybackScenarios("AUTO-SIEVE", {
      ownedCodes: ["WASHER-75G"],
      cartCodes: ["FREEZE-DRYER"],
    })[0];
    expect(scenario.projectedEquipmentCodes).toEqual(["WASHER-75G", "AUTO-SIEVE", "FREEZE-DRYER"]);
    expect(scenario.projectedEquipmentCodes).not.toContain("WASHER-25L");
    expect(scenario.remainingEquipmentCodes).toEqual(["AUTO-SIEVE", "FREEZE-DRYER"]);
    expect(scenario.cartEquipmentCodes).toEqual(["FREEZE-DRYER"]);
    expect(scenario.missingAfterCartCodes).toEqual(["AUTO-SIEVE"]);
    expect(scenario.remainingInvestmentCents).toBe(1_249_000);
    expect(scenario.missingAfterCartCents).toBe(499_500);
    expect(scenario.personalizedPaybackHarvests).toBeGreaterThan(0);
  });

  it("marks a complete owned processing chain as ready without inventing a new cost", () => {
    const scenario = getKqEquipmentPaybackScenarios("AUTO-SIEVE", {
      ownedCodes: ["WASHER-75G", "AUTO-SIEVE", "FREEZE-DRYER"],
    })[0];
    expect(scenario.remainingEquipmentCodes).toEqual([]);
    expect(scenario.remainingInvestmentCents).toBe(0);
    expect(scenario.personalizedPaybackHarvests).toBe(0);
  });
});
