import { describe, expect, it } from "vitest";
import {
  sanitizePublicContestEntryDetail,
  sanitizePublicContestNotebookUnlock,
  sanitizePublicContestReview,
  sanitizePublicContestTesterProfile,
  sanitizeViewerContestReview,
} from "@/lib/contest-public-api";
import type {
  ContestEntryDetail,
  ContestNotebookUnlock,
  ContestProfileBadge,
  ContestPublicTesterProfile,
  ContestReview,
  ContestTesterRankingItem,
} from "@/types/contest";

const baseReview: ContestReview = {
  id: "review-1",
  entryId: "entry-1",
  seasonId: "season-1",
  customerId: "customer-1",
  pseudo: "tester",
  consumptionMethod: "vaporizer",
  consumptionDetails: "",
  comment: "Avis publie.",
  status: "approved",
  adminNote: "note interne",
  qualityMark: "",
  reviewedBy: "admin@example.test",
  reviewedAt: "2026-06-01T10:00:00.000Z",
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
  scores: [],
  aromaTags: [],
  terpeneGuesses: [],
};

const baseRanking: ContestTesterRankingItem = {
  customerId: "customer-1",
  pseudo: "tester",
  totalPoints: 100,
  rank: 1,
  globalRank: 1,
  seasonRank: 1,
  seasonId: "season-1",
  approvedReviewCount: 2,
  correctTerpeneCount: 1,
  upvoteCount: 3,
  downvoteCount: 0,
  netVoteScore: 3,
  latestApprovedAt: "2026-06-01T10:00:00.000Z",
  level: {
    code: "confirmed",
    label: "Confirme",
    requiredPoints: 100,
    rewardPackCount: 0,
  },
};

const baseBadge: ContestProfileBadge = {
  id: 1,
  customerId: "customer-1",
  badgeId: "badge-1",
  reviewId: "review-1",
  awardedAt: "2026-06-01T10:00:00.000Z",
  rewardPackCount: 1,
  rewardClaimedAt: null,
};

describe("contest-public-api", () => {
  it("removes internal review fields from public reviews", () => {
    const sanitized = sanitizePublicContestReview(baseReview);

    expect(sanitized).toMatchObject({
      id: "review-1",
      pseudo: "tester",
      comment: "Avis publie.",
    });
    expect(sanitized).not.toHaveProperty("customerId");
    expect(sanitized).not.toHaveProperty("adminNote");
    expect(sanitized).not.toHaveProperty("reviewedBy");
  });

  it("keeps moderation notes only on the viewer review", () => {
    const sanitizedViewerReview = sanitizeViewerContestReview(baseReview);

    expect(sanitizedViewerReview.adminNote).toBe("note interne");
    expect(sanitizedViewerReview).not.toHaveProperty("customerId");
    expect(sanitizedViewerReview).not.toHaveProperty("reviewedBy");

    const detail: ContestEntryDetail = {
      entry: {
        id: "entry-1",
        slug: "lot-1",
        title: "Lot 1",
        productId: "product-1",
        seasonId: "season-1",
        category: "outdoor",
        track: "concours",
        story: "",
        technicalSheet: {},
        imageUrl: "/product.jpg",
        galleryUrls: [],
        isPublished: true,
        position: 0,
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        stats: {
          approvedReviewCount: 1,
          averageScore: 8,
          criterionAverages: {},
          consumptionCounts: {},
        },
      },
      reviews: [baseReview],
      viewerProfile: null,
      viewerReview: baseReview,
      viewerBadges: [baseBadge],
      eligibility: { eligible: false, reason: "already_reviewed" },
    };

    const sanitizedDetail = sanitizePublicContestEntryDetail(detail);

    expect(sanitizedDetail.reviews[0]).not.toHaveProperty("adminNote");
    expect(sanitizedDetail.viewerReview?.adminNote).toBe("note interne");
    expect(sanitizedDetail.viewerReview).not.toHaveProperty("customerId");
    expect(sanitizedDetail.viewerBadges[0]).not.toHaveProperty("reviewId");
  });

  it("sanitizes notebook unlock reviews before client serialization", () => {
    const unlock: ContestNotebookUnlock = {
      entryId: "entry-1",
      reviewId: "review-1",
      status: "rejected",
      unlockedAt: "2026-06-01T10:00:00.000Z",
      review: baseReview,
      source: "review",
    };

    const sanitized = sanitizePublicContestNotebookUnlock(unlock);

    expect(sanitized.review?.adminNote).toBe("note interne");
    expect(sanitized.review).not.toHaveProperty("customerId");
    expect(sanitized.review).not.toHaveProperty("reviewedBy");
  });

  it("removes customer identifiers from public tester profiles", () => {
    const profile: ContestPublicTesterProfile = {
      profile: {
        customerId: "customer-1",
        pseudo: "tester",
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
      progress: {
        customerId: "customer-1",
        pseudo: "tester",
        totalPoints: 100,
        currentLevel: baseRanking.level,
        nextLevel: null,
        pointsIntoLevel: 0,
        pointsToNextLevel: 0,
        progressPercent: 100,
        globalRank: 1,
        seasonRank: 1,
        selectedSeason: null,
      },
      badges: [baseBadge],
      rankings: {
        global: baseRanking,
        season: baseRanking,
      },
      reviews: [baseReview],
    };

    const sanitized = sanitizePublicContestTesterProfile(profile);

    expect(sanitized.profile).not.toHaveProperty("customerId");
    expect(sanitized.progress).not.toHaveProperty("customerId");
    expect(sanitized.badges[0]).not.toHaveProperty("customerId");
    expect(sanitized.badges[0]).not.toHaveProperty("reviewId");
    expect(sanitized.rankings.global).not.toHaveProperty("customerId");
    expect(sanitized.rankings.season).not.toHaveProperty("customerId");
    expect(sanitized.reviews[0]).not.toHaveProperty("customerId");
    expect(sanitized.reviews[0]).not.toHaveProperty("adminNote");
  });
});
