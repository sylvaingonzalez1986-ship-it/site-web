import { describe, expect, it } from "vitest";
import {
  KQ_EQUIPMENT_CATALOG,
  KQ_STARTING_EQUIPMENT_CODES,
} from "@/lib/kanab-quest-equipment";
import { startKqGame } from "@/lib/kanab-quest-game";
import { getKqMarketRunSummary, mapKqMarketSaleReceipt } from "@/lib/supabase/kanab-quest-market-backend";

const receipt = {
  receiptId: "receipt-1",
  flowerId: "flower-1",
  route: "dry-sift" as const,
  payoutCents: 12_000,
  reputationGain: 4,
  cashAfterCents: 8_500,
  reputationAfter: 18,
  replayed: false,
};

describe("Kanab Quest market sale receipt", () => {
  it("preserves a signed loss and the server's zero floor in the receipt", () => {
    expect(mapKqMarketSaleReceipt({
      ...receipt, reputationGain: -2, reputationAfter: 0,
    }, [...KQ_STARTING_EQUIPMENT_CODES])).toMatchObject({
      reputationGain: -2, reputationAfter: 0,
    });
  });
  it("carries the cultivation system into the commercial lot without changing its score", () => {
    const run = startKqGame(91, { deckCodes: ["BOTTE-009", "BOTTE-017"] });
    expect(getKqMarketRunSummary(run, 7)).toMatchObject({
      cultureSystemCode: "BOTTE-009",
      cultureSystemName: "Sol vivant",
      cultureSystemTechnique: "Écosystème organique biologiquement actif",
    });
    expect(getKqMarketRunSummary(run, 7).harvestGrams).toBeGreaterThan(0);
  });

  it("adds the next compatible investment without altering the atomic receipt", () => {
    expect(mapKqMarketSaleReceipt(receipt, [...KQ_STARTING_EQUIPMENT_CODES])).toMatchObject({
      ...receipt,
      nextEquipmentGoal: {
        code: "SECURITY-CAMERA",
        priceCents: 6_999,
        remainingCents: 0,
        progressPercent: 100,
        affordable: true,
      },
    });
  });

  it("returns an explicit completed workshop when every item is owned", () => {
    expect(mapKqMarketSaleReceipt(
      { ...receipt, replayed: true },
      KQ_EQUIPMENT_CATALOG.map((equipment) => equipment.code),
    )).toMatchObject({
      replayed: true,
      nextEquipmentGoal: null,
      equipmentProgression: { catalogComplete: true, alternativeCount: 0 },
    });
  });

  it("distinguishes optional lower models from a fully acquired catalog", () => {
    const ownedCodes = KQ_EQUIPMENT_CATALOG
      .filter((equipment) => equipment.code !== "TENT-120")
      .map((equipment) => equipment.code);
    expect(mapKqMarketSaleReceipt(receipt, ownedCodes)).toMatchObject({
      nextEquipmentGoal: null,
      equipmentProgression: {
        catalogComplete: false,
        progressionComplete: true,
        remainingCount: 1,
        alternativeCount: 1,
      },
    });
  });

  it("turns a completed pinned route into a durable mastery and a next tier", () => {
    expect(mapKqMarketSaleReceipt({
      ...receipt,
      routeMastery: {
        matchedPlan: true,
        firstMastery: false,
        routeSales: 6,
        expertiseBonusReputation: 12,
        masteredAt: "2026-09-04T12:00:00.000Z",
        masteredRoutes: ["dry-sift"],
      },
    }, [...KQ_STARTING_EQUIPMENT_CODES, "SIFT-TRAY"])).toMatchObject({
      routeMastery: {
        matchedPlan: true,
        firstMastery: false,
        routeSales: 6,
        expertiseBonusReputation: 12,
        masteredRoutes: ["dry-sift"],
      },
      nextRouteGoal: {
        route: "static-sift",
        equipmentCode: "STATIC-PLASMA",
        investmentRequired: true,
      },
    });
  });

  it("does not replace the normal progression when a sale misses the pinned route", () => {
    expect(mapKqMarketSaleReceipt({
      ...receipt,
      routeMastery: {
        matchedPlan: false,
        firstMastery: true,
        routeSales: 1,
        masteredAt: "2026-09-04T12:00:00.000Z",
        masteredRoutes: ["dry-sift"],
      },
    }, [...KQ_STARTING_EQUIPMENT_CODES, "SIFT-TRAY"])).toMatchObject({
      routeMastery: { matchedPlan: false },
      nextRouteGoal: null,
    });
  });
});
