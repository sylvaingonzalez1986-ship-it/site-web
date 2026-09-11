import { describe, expect, it } from "vitest";
import {
  calculateKqEquipmentQualityBonus,
  calculateKqHarvestGrams,
  KQ_MARKET_ROUTES,
  getKqJuryScoreFromRounds,
  getKqJuryScoreFromStats,
  getKqMarketEquipmentGoal,
  getKqNewlyUnlockedMarketRoutes,
  getKqPinnedRouteLotStatus,
  getKqPinnedRouteFlowerPreview,
  getKqPinnedRouteVerdictStatus,
  getKqNextRouteMasteryGoal,
  getKqRouteExpertiseBonusReputation,
  getKqRouteExpertiseMission,
  getKqRouteExpertiseProgress,
  getKqRoutePlanEquipmentGoal,
  getKqMarketRecommendations,
  getKqMarketQualityBand,
  prioritizeKqPinnedMarketRoute,
  quoteKqMarketRoutes,
} from "@/lib/kanab-quest-market";

describe("Kanab Quest post-harvest market", () => {
  it("turns jury stats and rounds into a stable score out of ten", () => {
    expect(getKqJuryScoreFromStats({ appearance: 80, aroma: 70, vigor: 75, mastery: 85, regularity: 90 })).toBe(8);
    expect(getKqJuryScoreFromRounds([
      { playerScore: 82, opponentScore: 60 },
      { playerScore: 76, opponentScore: 65 },
      { playerScore: 79, opponentScore: 70 },
    ])).toBe(7.9);
    expect(getKqJuryScoreFromRounds([
      { playerScore: 82, opponentScore: 61 },
      { playerScore: 76, opponentScore: 65 },
      { playerScore: 79, opponentScore: 72 },
    ], "opponent")).toBe(6.6);
  });

  it("keeps mediocre flowers out of reputation routes", () => {
    expect(getKqMarketQualityBand(5.2)).toBe("biomass");
    const quotes = quoteKqMarketRoutes({ juryScore: 5.2, harvestGrams: 100, equipmentCodes: ["TENT-080-STARTER"] });
    expect(quotes.find((quote) => quote.route === "biomass")).toMatchObject({ available: true, reputationGain: 0, payoutCents: 3000 });
    expect(quotes.find((quote) => quote.route === "raw")?.available).toBe(false);
    expect(quotes.every((quote) => quote.reputationGain === 0)).toBe(true);
  });

  it("unlocks progressively more valuable transformations with installed equipment", () => {
    const base = quoteKqMarketRoutes({ juryScore: 8.2, harvestGrams: 120, equipmentCodes: ["TENT-080-STARTER"] });
    expect(base.find((quote) => quote.route === "dry-sift")?.available).toBe(false);

    const equipped = quoteKqMarketRoutes({
      juryScore: 8.2,
      harvestGrams: 120,
      equipmentCodes: ["TENT-080-STARTER", "SIFT-TRAY", "PRESS-10T"],
    });
    const drySift = equipped.find((quote) => quote.route === "dry-sift")!;
    const premium = equipped.find((quote) => quote.route === "rosin-premium")!;
    expect(drySift.available).toBe(true);
    expect(drySift.processingCapacityPercent).toBe(35);
    expect(premium.available).toBe(true);
    expect(premium.processingCapacityPercent).toBe(55);
    expect(premium.payoutCents).toBeGreaterThan(drySift.payoutCents);
    expect(premium.reputationGain).toBe(0);
    expect(drySift.reputationGain).toBeGreaterThan(0);
    expect(drySift).toMatchObject({ remainderGrams: 78, remainderDestination: "raw", biomassRemainderGrams: 0 });
    expect(drySift.payoutCents).toBeGreaterThan(base.find((quote) => quote.route === "raw")!.payoutCents);
  });

  it("keeps biomass as the fallback for a remainder that cannot be sold raw", () => {
    const quotes = quoteKqMarketRoutes({
      juryScore: 5.2,
      harvestGrams: 100,
      equipmentCodes: ["SIFT-TRAY"],
    });
    const drySift = quotes.find((quote) => quote.route === "dry-sift")!;
    expect(drySift).toMatchObject({
      available: false,
      remainderGrams: 65,
      remainderDestination: "biomass",
      biomassRemainderGrams: 65,
    });
  });

  it("keeps electrostatic separation as a distinct high-quality dry-sift route", () => {
    const withoutStatic = quoteKqMarketRoutes({
      juryScore: 8.8,
      harvestGrams: 120,
      equipmentCodes: ["SIFT-TRAY"],
    }).find((quote) => quote.route === "static-sift")!;
    expect(withoutStatic.available).toBe(false);

    const withStatic = quoteKqMarketRoutes({
      juryScore: 8.8,
      harvestGrams: 120,
      equipmentCodes: ["SIFT-TRAY", "STATIC-PLASMA"],
    }).find((quote) => quote.route === "static-sift")!;
    expect(withStatic).toMatchObject({ available: true, processingPrecision: 82 });
    expect(withStatic.reputationGain).toBeGreaterThan(0);
  });

  it("requires washing, automated filtration and freeze drying for a signature lot", () => {
    const incomplete = quoteKqMarketRoutes({ juryScore: 9.2, harvestGrams: 150, equipmentCodes: ["FREEZE-DRYER"] });
    expect(incomplete.find((quote) => quote.route === "hash-signature")?.available).toBe(false);
    const complete = quoteKqMarketRoutes({ juryScore: 9.2, harvestGrams: 150, equipmentCodes: ["WASHER-25L", "AUTO-SIEVE", "FREEZE-DRYER"] });
    expect(complete.find((quote) => quote.route === "hash-signature")).toMatchObject({
      available: true,
      processingCapacityPercent: 45,
      processingPrecision: 78,
    });
  });

  it("turns durable cultivation equipment into quality and quantity", () => {
    expect(calculateKqEquipmentQualityBonus(4, 3)).toBe(2);
    const starterYield = calculateKqHarvestGrams({ quality: 10, successfulStages: 4, quantityPercent: 0 });
    const upgradedYield = calculateKqHarvestGrams({ quality: 12, successfulStages: 4, quantityPercent: 70 });
    expect(upgradedYield).toBeGreaterThan(starterYield * 1.6);
  });

  it("recommends only available routes and leaves reputation empty for a weak lot", () => {
    const quotes = quoteKqMarketRoutes({
      juryScore: 5.2,
      harvestGrams: 100,
      equipmentCodes: ["TENT-080-STARTER"],
    });
    const recommendation = getKqMarketRecommendations(quotes);
    expect(recommendation.availableCount).toBe(1);
    expect(recommendation.bestPayout?.route).toBe("biomass");
    expect(recommendation.bestReputation).toBeNull();
    expect(recommendation.rawBaseline).toBeNull();
  });

  it("shows the cash versus reputation tradeoff on a fully equipped signature lot", () => {
    const quotes = quoteKqMarketRoutes({
      juryScore: 9.2,
      harvestGrams: 150,
      equipmentCodes: [
        "TENT-080-STARTER",
        "PRESS-20T",
        "WASHER-25L",
        "AUTO-SIEVE",
        "FREEZE-DRYER",
      ],
    });
    const recommendation = getKqMarketRecommendations(quotes);
    expect(recommendation.bestPayout?.route).toBe("rosin-signature");
    expect(recommendation.bestReputation?.route).toBe("hash-signature");
    expect(recommendation.oneClearWinner).toBe(false);
    expect(recommendation.bestPayout?.payoutCents).toBeGreaterThan(recommendation.rawBaseline!.payoutCents);
  });

  it("lets a signature press execute every lower rosin recipe", () => {
    const rosinQuotes = quoteKqMarketRoutes({
      juryScore: 9.2,
      harvestGrams: 150,
      equipmentCodes: ["PRESS-20T"],
    }).filter((quote) => quote.family === "rosin");
    expect(rosinQuotes.map((quote) => [quote.route, quote.available])).toEqual([
      ["rosin-trial", true],
      ["rosin-selection", true],
      ["rosin-premium", true],
      ["rosin-signature", true],
    ]);
  });

  it("announces only complete market routes after a projected installation", () => {
    expect(getKqNewlyUnlockedMarketRoutes({
      currentUnlocks: ["raw-sale", "ice-water-hash"],
      projectedUnlocks: ["raw-sale", "ice-water-hash", "hash-filtration"],
    }).map((route) => route.code)).toEqual([]);

    expect(getKqNewlyUnlockedMarketRoutes({
      currentUnlocks: ["raw-sale", "ice-water-hash"],
      projectedUnlocks: ["raw-sale", "ice-water-hash", "hash-filtration", "freeze-drying"],
    }).map((route) => [route.code, route.minimumJuryScore])).toEqual([
      ["hash-signature", 8.8],
    ]);

    expect(getKqNewlyUnlockedMarketRoutes({
      currentUnlocks: ["raw-sale"],
      projectedUnlocks: ["raw-sale", "rosin-trial", "rosin-selection", "rosin-premium"],
    }).map((route) => route.code)).toEqual(["rosin-trial", "rosin-selection", "rosin-premium"]);
  });

  it("identifies one clear winner when the same route leads both goals", () => {
    const recommendation = getKqMarketRecommendations(quoteKqMarketRoutes({
      juryScore: 8,
      harvestGrams: 100,
      equipmentCodes: ["TENT-080-STARTER", "SIFT-TRAY"],
    }));
    expect(recommendation.bestPayout?.route).toBe("dry-sift");
    expect(recommendation.bestReputation?.route).toBe("dry-sift");
    expect(recommendation.oneClearWinner).toBe(true);
  });

  it("diagnoses the saved route against the selected lot", () => {
    const readyQuotes = quoteKqMarketRoutes({
      juryScore: 8.8,
      harvestGrams: 100,
      equipmentCodes: ["PRESS-20T"],
    });
    expect(getKqPinnedRouteLotStatus({
      route: "rosin-signature",
      juryScore: 8.8,
      quotes: readyQuotes,
    })).toMatchObject({
      name: "Rosin Signature",
      state: "ready",
      available: true,
      qualityGap: 0,
      missingUnlocks: [],
    });

    expect(getKqPinnedRouteLotStatus({
      route: "rosin-signature",
      juryScore: 8,
      quotes: quoteKqMarketRoutes({ juryScore: 8, harvestGrams: 100, equipmentCodes: ["PRESS-20T"] }),
    })).toMatchObject({ state: "quality", qualityGap: 0.8, missingUnlocks: [] });

    expect(getKqPinnedRouteLotStatus({
      route: "rosin-signature",
      juryScore: 8.8,
      quotes: quoteKqMarketRoutes({ juryScore: 8.8, harvestGrams: 100, equipmentCodes: ["TENT-080-STARTER"] }),
    })).toMatchObject({ state: "equipment", qualityGap: 0, missingUnlocks: ["rosin-signature"] });

    expect(getKqPinnedRouteLotStatus({
      route: "rosin-signature",
      juryScore: 7,
      quotes: quoteKqMarketRoutes({ juryScore: 7, harvestGrams: 100, equipmentCodes: ["TENT-080-STARTER"] }),
    })).toMatchObject({ state: "quality-and-equipment", qualityGap: 1.8, missingUnlocks: ["rosin-signature"] });
    expect(getKqPinnedRouteLotStatus({ route: null, juryScore: 8.8, quotes: readyQuotes })).toBeNull();
  });

  it("moves the saved route first without hiding or reordering the other market choices", () => {
    const quotes = quoteKqMarketRoutes({
      juryScore: 8.8,
      harvestGrams: 100,
      equipmentCodes: ["PRESS-20T"],
    });
    const prioritized = prioritizeKqPinnedMarketRoute(quotes, "rosin-signature");
    expect(prioritized).toHaveLength(quotes.length);
    expect(prioritized[0]?.route).toBe("rosin-signature");
    expect(prioritized.slice(1).map((quote) => quote.route)).toEqual(
      quotes.filter((quote) => quote.route !== "rosin-signature").map((quote) => quote.route),
    );
    expect(prioritizeKqPinnedMarketRoute(quotes, null)).toEqual(quotes);
    expect(prioritizeKqPinnedMarketRoute(quotes, null)).not.toBe(quotes);
  });

  it("estimates whether a Flower profile can reach the saved route before the official jury", () => {
    const ready = getKqPinnedRouteFlowerPreview({
      route: "rosin-signature",
      stats: { appearance: 90, aroma: 88, vigor: 92, mastery: 87, regularity: 88 },
    });
    expect(ready).toMatchObject({
      name: "Rosin Signature",
      estimatedJuryScore: 8.9,
      minimumJuryScore: 8.8,
      qualityGap: 0,
      likelyReady: true,
    });

    expect(getKqPinnedRouteFlowerPreview({
      route: "rosin-signature",
      stats: { appearance: 80, aroma: 80, vigor: 80, mastery: 80, regularity: 80 },
    })).toMatchObject({ estimatedJuryScore: 8, qualityGap: 0.8, likelyReady: false });
    expect(getKqPinnedRouteFlowerPreview({ route: null, stats: {} })).toBeNull();
  });

  it("compares the official jury average with the saved route threshold", () => {
    const rounds = [
      { playerScore: 91, opponentScore: 72 },
      { playerScore: 87, opponentScore: 75 },
      { playerScore: 89, opponentScore: 80 },
    ];
    expect(getKqPinnedRouteVerdictStatus({ route: "rosin-signature", rounds })).toMatchObject({
      name: "Rosin Signature",
      juryScore: 8.9,
      minimumJuryScore: 8.8,
      qualityGap: 0,
      qualified: true,
    });
    expect(getKqPinnedRouteVerdictStatus({
      route: "rosin-signature",
      rounds: rounds.map((round) => ({ ...round, playerScore: 80 })),
    })).toMatchObject({ juryScore: 8, qualityGap: 0.8, qualified: false });
    expect(getKqPinnedRouteVerdictStatus({ route: null, rounds })).toBeNull();
  });

  it("proposes the next unmastered investment tier in the same processing family", () => {
    expect(getKqNextRouteMasteryGoal({
      completedRoute: "dry-sift",
      masteredRoutes: ["dry-sift"],
      ownedCodes: ["SIFT-TRAY"],
    })).toMatchObject({
      route: "static-sift",
      equipmentCode: "STATIC-PLASMA",
      investmentRequired: true,
    });
    expect(getKqNextRouteMasteryGoal({
      completedRoute: "rosin-trial",
      masteredRoutes: ["rosin-trial"],
      ownedCodes: ["PRESS-0600"],
    })).toMatchObject({
      route: "rosin-selection",
      equipmentCode: "PRESS-0600",
      investmentRequired: false,
    });
    expect(getKqNextRouteMasteryGoal({
      completedRoute: "rosin-trial",
      masteredRoutes: ["rosin-trial", "rosin-selection"],
      ownedCodes: ["PRESS-0600"],
    })).toMatchObject({ route: "rosin-premium", equipmentCode: "PRESS-0600" });
    expect(getKqNextRouteMasteryGoal({
      completedRoute: "rosin-signature",
      masteredRoutes: ["rosin-signature"],
      ownedCodes: ["PRESS-0600"],
    })).toBeNull();
  });

  it("turns repeat route sales into four readable expertise milestones", () => {
    expect(getKqRouteExpertiseProgress(0)).toMatchObject({
      tier: { code: "discovery" },
      nextTier: { code: "apprentice", minimumSales: 1 },
      salesToNext: 1,
      progressPercent: 0,
    });
    expect(getKqRouteExpertiseProgress(3)).toMatchObject({
      tier: { code: "confirmed" },
      nextTier: { code: "expert", minimumSales: 6 },
      salesToNext: 3,
      progressPercent: 50,
    });
    expect(getKqRouteExpertiseProgress(9)).toMatchObject({
      tier: { code: "expert" },
      nextTier: { code: "master", minimumSales: 10 },
      salesToNext: 1,
      progressPercent: 90,
    });
    expect(getKqRouteExpertiseProgress(10)).toMatchObject({
      tier: { code: "master" },
      nextTier: null,
      salesToNext: 0,
      progressPercent: 100,
    });
    expect(getKqRouteExpertiseProgress(Number.NaN).saleCount).toBe(0);
    expect(getKqRouteExpertiseBonusReputation("dry-sift", 3)).toBe(5);
    expect(getKqRouteExpertiseBonusReputation("rosin-premium", 6)).toBe(12);
    expect(getKqRouteExpertiseBonusReputation("hash-signature", 10)).toBe(25);
    expect(getKqRouteExpertiseBonusReputation("dry-sift", 4)).toBe(0);
    expect(getKqRouteExpertiseBonusReputation("raw", 3)).toBe(0);
    expect(getKqRouteExpertiseBonusReputation("biomass", 10)).toBe(0);
  });

  it("keeps the closest expertise mission visible and respects a pinned route", () => {
    expect(getKqRouteExpertiseMission({ masteries: [] })).toMatchObject({
      route: "dry-sift",
      source: "nearest",
      targetTier: { code: "apprentice" },
      salesRemaining: 1,
      bonusReputation: 0,
    });
    expect(getKqRouteExpertiseMission({
      masteries: [
        { route: "dry-sift", saleCount: 2 },
        { route: "rosin-trial", saleCount: 1 },
      ],
    })).toMatchObject({
      route: "dry-sift",
      targetTier: { code: "confirmed" },
      salesRemaining: 1,
      bonusReputation: 5,
    });
    expect(getKqRouteExpertiseMission({
      masteries: [{ route: "dry-sift", saleCount: 2 }],
      pinnedRoute: "rosin-premium",
    })).toMatchObject({
      route: "rosin-premium",
      source: "pinned",
      targetTier: { code: "apprentice" },
    });
    expect(getKqRouteExpertiseMission({
      masteries: KQ_MARKET_ROUTES
        .filter((route) => route.family === "hash" || route.family === "rosin")
        .map((route) => ({ route: route.code, saleCount: 10 })),
    })).toBeNull();
  });

  it("turns an expertise mission into a valid persistent route pivot", () => {
    expect(getKqRoutePlanEquipmentGoal({ route: "dry-sift", ownedCodes: [] })).toMatchObject({
      equipmentCode: "SIFT-TRAY",
      investmentRequired: true,
    });
    expect(getKqRoutePlanEquipmentGoal({ route: "rosin-trial", ownedCodes: ["PRESS-0600"] })).toMatchObject({
      equipmentCode: "PRESS-0600",
      investmentRequired: false,
    });
    expect(getKqRoutePlanEquipmentGoal({ route: "hash-signature", ownedCodes: ["WASHER-25L"] })).toMatchObject({
      equipmentCode: "AUTO-SIEVE",
      investmentRequired: true,
    });
    expect(getKqRoutePlanEquipmentGoal({ route: "raw", ownedCodes: [] })).toBeNull();
  });

  it("turns a missing transformation unlock into a concrete shop goal", () => {
    const drySift = quoteKqMarketRoutes({
      juryScore: 8.2,
      harvestGrams: 120,
      equipmentCodes: ["TENT-080-STARTER"],
    }).find((quote) => quote.route === "dry-sift")!;
    expect(drySift.missingUnlocks).toEqual(["dry-sift"]);
    expect(getKqMarketEquipmentGoal({
      quote: drySift,
      ownedCodes: ["TENT-080-STARTER"],
      equippedCodes: ["TENT-080-STARTER"],
      cashCents: 500_000,
    })).toMatchObject({ code: "SIFT-TRAY", kind: "buy", affordable: true });
  });

  it("asks to install an owned machine before proposing another purchase", () => {
    const drySift = quoteKqMarketRoutes({
      juryScore: 8.2,
      harvestGrams: 120,
      equipmentCodes: ["TENT-080-STARTER"],
    }).find((quote) => quote.route === "dry-sift")!;
    expect(getKqMarketEquipmentGoal({
      quote: drySift,
      ownedCodes: ["TENT-080-STARTER", "SIFT-TRAY"],
      equippedCodes: ["TENT-080-STARTER"],
      cashCents: 0,
    })).toMatchObject({ code: "SIFT-TRAY", kind: "install", remainingCents: 0 });
  });

  it("surfaces the prerequisite before an advanced machine", () => {
    const staticSift = quoteKqMarketRoutes({
      juryScore: 9,
      harvestGrams: 120,
      equipmentCodes: ["STATIC-PLASMA"],
    }).find((quote) => quote.route === "static-sift")!;
    expect(staticSift.missingUnlocks).toEqual(["dry-sift"]);
    expect(getKqMarketEquipmentGoal({
      quote: staticSift,
      ownedCodes: ["STATIC-PLASMA"],
      equippedCodes: ["STATIC-PLASMA"],
      cashCents: 0,
    })).toMatchObject({ code: "SIFT-TRAY", kind: "buy", targetEquipmentName: null });

    const onlyStaticMissing = { ...staticSift, missingUnlocks: ["static-sift" as const] };
    expect(getKqMarketEquipmentGoal({
      quote: onlyStaticMissing,
      ownedCodes: [],
      equippedCodes: [],
      cashCents: 0,
    })).toMatchObject({ code: "SIFT-TRAY", kind: "prerequisite", targetEquipmentName: "Séparateur statique Plasmastatic" });
  });
});
