import { describe, expect, it } from "vitest";
import {
  buildKqArtworkReviewAssets,
  buildKqArtworkReviewReport,
  getKqArtworkReviewStatus,
  importKqArtworkReviewReport,
  KQ_ARTWORK_REVIEW_ASSETS,
  parseKqArtworkReviewState,
  summarizeKqArtworkReview,
  type KqArtworkReviewState,
} from "@/lib/kanab-quest-artwork-review";
import { KQ_OUTCOME_ARTWORK_ASSETS } from "@/lib/kanab-quest-outcome-artwork";

describe("Kanab Quest artwork review manifest", () => {
  it("includes all 29 stage reactions in the 149-file fallback manifest", () => {
    expect(KQ_ARTWORK_REVIEW_ASSETS).toHaveLength(149);
    expect(new Set(KQ_ARTWORK_REVIEW_ASSETS.map((asset) => asset.code)).size).toBe(149);
    expect(new Set(KQ_ARTWORK_REVIEW_ASSETS.map((asset) => asset.src)).size).toBe(149);
  });

  it("keeps the expected review groups and formats", () => {
    const groupCounts = Object.groupBy(KQ_ARTWORK_REVIEW_ASSETS, (asset) => asset.group);
    expect(groupCounts.support).toHaveLength(32);
    expect(groupCounts.heritage).toHaveLength(12);
    expect(groupCounts.situation).toHaveLength(51);
    expect(groupCounts.reaction).toHaveLength(29);
    expect(groupCounts.equipment).toHaveLength(25);
    expect(groupCounts.support?.every((asset) => asset.format === "portrait")).toBe(true);
    expect(groupCounts.heritage?.every((asset) => asset.format === "portrait")).toBe(true);
    expect(groupCounts.situation?.every((asset) => asset.format === "square")).toBe(true);
    expect(groupCounts.reaction?.every((asset) => asset.format === "square")).toBe(true);
    expect(groupCounts.equipment?.every((asset) => asset.format === "square")).toBe(true);
  });

  it("keeps reactions ordered by stage and verdict in both review catalogues", () => {
    const expected = KQ_OUTCOME_ARTWORK_ASSETS.map((asset) => asset.code);
    for (const assets of [KQ_ARTWORK_REVIEW_ASSETS, buildKqArtworkReviewAssets([])]) {
      expect(assets.filter((asset) => asset.group === "reaction").map((asset) => asset.code)).toEqual(expected);
    }
  });

  it("invalidates a stored approval as soon as its image source changes", () => {
    const asset = KQ_ARTWORK_REVIEW_ASSETS[0];
    expect(getKqArtworkReviewStatus({
      [asset.code]: { status: "approved", src: "/ancienne-image.webp", reviewedAt: "2026-09-01T08:00:00Z" },
    }, asset)).toBe("pending");
    expect(parseKqArtworkReviewState(JSON.stringify({
      [asset.code]: { status: "approved", src: "/ancienne-image.webp", reviewedAt: "2026-09-01T08:00:00Z" },
    }))).toEqual({});
  });

  it("exports and restores only decisions matching the current manifest", () => {
    const reviewedAt = "2026-09-01T08:00:00Z";
    const state = Object.fromEntries(KQ_ARTWORK_REVIEW_ASSETS.map((asset) => [asset.code, {
      status: "approved" as const,
      src: asset.src,
      reviewedAt,
    }])) satisfies KqArtworkReviewState;
    const report = buildKqArtworkReviewReport(state, reviewedAt);
    expect(report.summary).toMatchObject({ approved: 149, pending: 0, rework: 0, readyForLaunch: true });
    const imported = importKqArtworkReviewReport(report);
    expect(imported).toMatchObject({ accepted: 149, staleCodes: [], missingCodes: [], manifestMatches: true });
    expect(summarizeKqArtworkReview(imported.state).readyForLaunch).toBe(true);
  });

  it("replaces the fixed Heritage set with the active producer catalogue", () => {
    const assets = buildKqArtworkReviewAssets([
      { code: "HERITAGE-013", name: "Héritage A", imageUrl: "/heritage-a.webp", producerName: "Ferme A", isActive: true },
      { code: "HERITAGE-014", name: "Héritage B", imageUrl: "/heritage-b.webp", producerName: "Ferme B", isActive: true },
      { code: "HERITAGE-015", name: "Ancienne ferme", imageUrl: "/heritage-c.webp", producerName: "Ferme C", isActive: false },
    ]);
    const heritageAssets = assets.filter((asset) => asset.group === "heritage");
    expect(assets).toHaveLength(139);
    expect(heritageAssets.map((asset) => asset.code)).toEqual(["HERITAGE-013", "HERITAGE-014"]);

    const state = Object.fromEntries(assets.map((asset) => [asset.code, {
      status: "approved" as const,
      src: asset.src,
      reviewedAt: "2026-09-06T12:00:00Z",
    }])) satisfies KqArtworkReviewState;
    const report = buildKqArtworkReviewReport(state, "2026-09-06T12:00:00Z", assets);
    expect(report).toMatchObject({
      schema: "kanab-quest-artwork-review-v3",
      inventory: { total: 139, heritage: 2 },
      summary: { approved: 139, readyForLaunch: true },
    });
  });

  it("never approves a producer fallback when its final card image is missing", () => {
    const assets = buildKqArtworkReviewAssets([
      { code: "HERITAGE-013", name: "Héritage A", imageUrl: "", producerImage: "/producer-a.webp", producerName: "Ferme A", isActive: true },
    ]);
    const heritage = assets.find((asset) => asset.code === "HERITAGE-013")!;
    expect(heritage.placeholder).toBe(true);
    expect(getKqArtworkReviewStatus({
      [heritage.code]: { status: "approved", src: heritage.src, reviewedAt: "2026-09-06T12:00:00Z" },
    }, heritage)).toBe("pending");
  });

  it("keeps a changed imported asset pending and reports the stale decision", () => {
    const asset = KQ_ARTWORK_REVIEW_ASSETS[0];
    const report = buildKqArtworkReviewReport({
      [asset.code]: { status: "approved", src: asset.src, reviewedAt: "2026-09-01T08:00:00Z" },
    });
    const changedReport = {
      ...report,
      assets: report.assets.map((entry) => entry.code === asset.code ? { ...entry, src: "/ancienne-image.webp" } : entry),
    };
    const imported = importKqArtworkReviewReport(changedReport);
    expect(imported.staleCodes).toEqual([asset.code]);
    expect(imported.missingCodes).toEqual([]);
    expect(getKqArtworkReviewStatus(imported.state, asset)).toBe("pending");
  });
});
