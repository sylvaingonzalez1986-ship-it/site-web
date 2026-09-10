import { describe, expect, it } from "vitest";
import {
  buildKqPlacardMobileReviewReport,
  getKqPlacardMobileReviewKey,
  importKqPlacardMobileReviewReport,
  KQ_PLACARD_MOBILE_REVIEW_CHECKS,
  KQ_PLACARD_MOBILE_REVIEW_PROFILES,
  parseKqPlacardMobileReviewState,
  summarizeKqPlacardMobileReview,
  type KqPlacardMobileReviewState,
} from "@/lib/kanab-quest-mobile-manual-review";

describe("Placard manual mobile review", () => {
  it("requires ten checks on both iOS and Android physical profiles", () => {
    expect(KQ_PLACARD_MOBILE_REVIEW_PROFILES.map((profile) => profile.code))
      .toEqual(["ios-safari", "android-chrome"]);
    expect(KQ_PLACARD_MOBILE_REVIEW_CHECKS).toHaveLength(10);
    expect(summarizeKqPlacardMobileReview({})).toEqual({
      total: 20,
      passed: 0,
      failed: 0,
      pending: 20,
      approvedProfiles: 0,
      readyForLaunch: false,
    });
  });

  it("becomes launch-ready only when all twenty decisions pass", () => {
    const state = Object.fromEntries(KQ_PLACARD_MOBILE_REVIEW_PROFILES.flatMap((profile) => (
      KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => [
        getKqPlacardMobileReviewKey(profile.code, check.code),
        { status: "passed" as const, reviewedAt: "2026-09-05T12:00:00.000Z" },
      ])
    ))) satisfies KqPlacardMobileReviewState;
    const report = buildKqPlacardMobileReviewReport(state, "2026-09-05T13:00:00.000Z");
    const equipmentCheck = report.profiles[0].checks.find((check) => check.code === "cart-controls");
    const marketCheck = report.profiles[0].checks.find((check) => check.code === "market-controls");
    expect(report.summary).toMatchObject({ passed: 20, approvedProfiles: 2, readyForLaunch: true });
    expect(report).toMatchObject({
      schema: "kanab-quest-mobile-manual-review-v3",
      manifestId: "placard-mobile-manual-2x10-v3",
    });
    expect(equipmentCheck).toMatchObject({
      protocolId: "mobile-equipment-purchase-v1",
      procedure: expect.arrayContaining([
        expect.stringContaining("voile sombre"),
        expect.stringContaining("second débit"),
      ]),
    });
    expect(marketCheck).toMatchObject({
      protocolId: "mobile-market-sale-v2",
      procedure: expect.arrayContaining([
        expect.stringContaining("versement"),
        expect.stringContaining("second crédit"),
      ]),
    });
    expect(importKqPlacardMobileReviewReport(report)).toMatchObject({ restored: 20, missing: 0 });
  });

  it("rejects obsolete reports that predate the complete mobile equipment purchase check", () => {
    expect(() => importKqPlacardMobileReviewReport({
      schema: "kanab-quest-mobile-manual-review-v2",
      manifestId: "placard-mobile-manual-2x10-v2",
      profiles: [],
    })).toThrow("Preuve mobile obsolète");
  });

  it("does not restore a market approval without the current sale protocol", () => {
    const state = Object.fromEntries(KQ_PLACARD_MOBILE_REVIEW_PROFILES.flatMap((profile) => (
      KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => [
        getKqPlacardMobileReviewKey(profile.code, check.code),
        { status: "passed" as const, reviewedAt: "2026-09-05T12:00:00.000Z" },
      ])
    ))) satisfies KqPlacardMobileReviewState;
    const report = buildKqPlacardMobileReviewReport(state);
    const firstMarketCheck = report.profiles[0].checks.find((check) => check.code === "market-controls");
    if (firstMarketCheck) firstMarketCheck.protocolId = null;

    const imported = importKqPlacardMobileReviewReport(report);

    expect(imported).toMatchObject({ restored: 19, missing: 1 });
    expect(imported.state[getKqPlacardMobileReviewKey("ios-safari", "market-controls")]).toBeUndefined();
  });

  it("does not restore an equipment approval without the complete purchase protocol", () => {
    const state = Object.fromEntries(KQ_PLACARD_MOBILE_REVIEW_PROFILES.flatMap((profile) => (
      KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => [
        getKqPlacardMobileReviewKey(profile.code, check.code),
        { status: "passed" as const, reviewedAt: "2026-09-05T12:00:00.000Z" },
      ])
    ))) satisfies KqPlacardMobileReviewState;
    const report = buildKqPlacardMobileReviewReport(state);
    const firstEquipmentCheck = report.profiles[0].checks.find((check) => check.code === "cart-controls");
    if (firstEquipmentCheck) firstEquipmentCheck.protocolId = null;

    const imported = importKqPlacardMobileReviewReport(report);

    expect(imported).toMatchObject({ restored: 19, missing: 1 });
    expect(imported.state[getKqPlacardMobileReviewKey("ios-safari", "cart-controls")]).toBeUndefined();
  });

  it("keeps failed checks blocking and discards unknown stored keys", () => {
    const validKey = getKqPlacardMobileReviewKey("ios-safari", "safe-areas");
    const state = parseKqPlacardMobileReviewState(JSON.stringify({
      [validKey]: { status: "failed", reviewedAt: "2026-09-05T12:00:00.000Z" },
      "private-device:owner": { status: "passed", reviewedAt: "2026-09-05T12:00:00.000Z" },
    }));
    expect(state).toEqual({
      [validKey]: { status: "failed", reviewedAt: "2026-09-05T12:00:00.000Z" },
    });
    expect(summarizeKqPlacardMobileReview(state)).toMatchObject({ failed: 1, readyForLaunch: false });
  });

  it("counts a pending imported decision as missing", () => {
    const report = buildKqPlacardMobileReviewReport({});
    const imported = importKqPlacardMobileReviewReport(report);
    expect(imported).toMatchObject({ restored: 0, missing: 20, state: {} });
  });
});
