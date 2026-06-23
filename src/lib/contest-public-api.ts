import type {
  ContestEntryDetail,
  ContestNotebookUnlock,
  ContestProfile,
  ContestProfileBadge,
  ContestPublicTesterProfile,
  ContestReview,
  ContestTesterProgress,
  ContestTesterRankingItem,
} from "@/types/contest";

export type PublicContestProfile = Omit<ContestProfile, "customerId">;
export type PublicContestTesterProgress = Omit<ContestTesterProgress, "customerId">;
export type PublicContestProfileBadge = Omit<ContestProfileBadge, "customerId" | "reviewId">;
export type PublicContestTesterRankingItem = Omit<ContestTesterRankingItem, "customerId">;
export type PublicContestReview = Omit<ContestReview, "customerId" | "adminNote" | "reviewedBy">;
export type ViewerContestReview = Omit<ContestReview, "customerId" | "reviewedBy">;
export type PublicContestNotebookUnlock = Omit<ContestNotebookUnlock, "review"> & {
  review?: ViewerContestReview;
};
export type PublicContestEntryDetail = Omit<
  ContestEntryDetail,
  "reviews" | "viewerProfile" | "viewerReview" | "viewerBadges"
> & {
  reviews: PublicContestReview[];
  viewerProfile: PublicContestProfile | null;
  viewerReview: ViewerContestReview | null;
  viewerBadges: PublicContestProfileBadge[];
};
export type PublicContestTesterProfile = Omit<
  ContestPublicTesterProfile,
  "profile" | "progress" | "badges" | "rankings" | "reviews"
> & {
  profile: PublicContestProfile;
  progress: PublicContestTesterProgress;
  badges: PublicContestProfileBadge[];
  rankings: {
    global?: PublicContestTesterRankingItem | null;
    season?: PublicContestTesterRankingItem | null;
  };
  reviews: PublicContestReview[];
};

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const safe = { ...value };
  for (const key of keys) {
    delete (safe as Partial<T>)[key];
  }
  return safe as Omit<T, K>;
}

export function sanitizePublicContestProfile(profile: ContestProfile): PublicContestProfile {
  return omitKeys(profile, ["customerId"]);
}

export function sanitizePublicContestProgress(progress: ContestTesterProgress): PublicContestTesterProgress {
  return omitKeys(progress, ["customerId"]);
}

export function sanitizePublicContestBadge(badge: ContestProfileBadge): PublicContestProfileBadge {
  return omitKeys(badge, ["customerId", "reviewId"]);
}

export function sanitizePublicContestRankingItem(item: ContestTesterRankingItem): PublicContestTesterRankingItem {
  return omitKeys(item, ["customerId"]);
}

export function sanitizePublicContestReview(review: ContestReview): PublicContestReview {
  return omitKeys(review, ["customerId", "adminNote", "reviewedBy"]);
}

export function sanitizeViewerContestReview(review: ContestReview): ViewerContestReview {
  return omitKeys(review, ["customerId", "reviewedBy"]);
}

export function sanitizePublicContestNotebookUnlock(unlock: ContestNotebookUnlock): PublicContestNotebookUnlock {
  return {
    ...unlock,
    review: unlock.review ? sanitizeViewerContestReview(unlock.review) : undefined,
  };
}

export function sanitizePublicContestEntryDetail(detail: ContestEntryDetail): PublicContestEntryDetail {
  return {
    ...detail,
    reviews: detail.reviews.map(sanitizePublicContestReview),
    viewerProfile: detail.viewerProfile ? sanitizePublicContestProfile(detail.viewerProfile) : null,
    viewerReview: detail.viewerReview ? sanitizeViewerContestReview(detail.viewerReview) : null,
    viewerBadges: detail.viewerBadges.map(sanitizePublicContestBadge),
  };
}

export function sanitizePublicContestTesterProfile(profile: ContestPublicTesterProfile): PublicContestTesterProfile {
  return {
    ...profile,
    profile: sanitizePublicContestProfile(profile.profile),
    progress: sanitizePublicContestProgress(profile.progress),
    badges: profile.badges.map(sanitizePublicContestBadge),
    rankings: {
      global: profile.rankings.global ? sanitizePublicContestRankingItem(profile.rankings.global) : null,
      season: profile.rankings.season ? sanitizePublicContestRankingItem(profile.rankings.season) : null,
    },
    reviews: profile.reviews.map(sanitizePublicContestReview),
  };
}
