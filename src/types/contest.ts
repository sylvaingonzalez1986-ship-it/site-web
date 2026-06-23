export const CONTEST_ENTRY_CATEGORIES = ["outdoor", "greenhouse", "indoor"] as const;
export type ContestEntryCategory = (typeof CONTEST_ENTRY_CATEGORIES)[number];

export const CONTEST_ENTRY_CATEGORY_LABELS: Record<ContestEntryCategory, string> = {
  outdoor: "Outdoor",
  greenhouse: "Greenhouse",
  indoor: "Indoor",
};

export const CONTEST_ENTRY_TRACKS = ["regular", "concours"] as const;
export type ContestEntryTrack = (typeof CONTEST_ENTRY_TRACKS)[number];

export const CONTEST_ENTRY_TRACK_LABELS: Record<ContestEntryTrack, string> = {
  regular: "Regular",
  concours: "Concours",
};

export const CONTEST_CONSUMPTION_METHODS = [
  "vaporizer",
  "joint_no_tobacco",
  "joint_with_tobacco",
  "water_pipe",
  "other",
] as const;
export type ContestConsumptionMethod = (typeof CONTEST_CONSUMPTION_METHODS)[number];

export const CONTEST_CONSUMPTION_METHOD_LABELS: Record<ContestConsumptionMethod, string> = {
  vaporizer: "Vaporisateur",
  joint_no_tobacco: "Joint sans tabac",
  joint_with_tobacco: "Joint avec tabac",
  water_pipe: "Pipe à eau",
  other: "Autre",
};

export const CONTEST_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ContestReviewStatus = (typeof CONTEST_REVIEW_STATUSES)[number];

export const CONTEST_REVIEW_STATUS_LABELS: Record<ContestReviewStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
};

export const CONTEST_SCORE_CRITERIA = [
  "appearance",
  "manicure",
  "drying_curing",
  "cold_aroma",
  "aroma_intensity",
  "aroma_complexity",
  "flavor",
  "smoothness_burn",
  "persistence",
  "overall_impression",
] as const;
export type ContestScoreCriterion = (typeof CONTEST_SCORE_CRITERIA)[number];

export const CONTEST_SCORE_CRITERION_LABELS: Record<ContestScoreCriterion, string> = {
  appearance: "Aspect visuel",
  manicure: "Manucure",
  drying_curing: "Séchage / curing",
  cold_aroma: "Nez à froid",
  aroma_intensity: "Intensité aromatique",
  aroma_complexity: "Complexité aromatique",
  flavor: "Goût",
  smoothness_burn: "Douceur / combustion",
  persistence: "Persistance",
  overall_impression: "Impression générale",
};

export const CONTEST_AROMA_TAGS = [
  "citrus",
  "tropical_fruit",
  "red_berry",
  "floral",
  "earthy",
  "woody",
  "pine_resin",
  "spicy_pepper",
  "diesel_gas",
  "herbal",
  "sweet_gourmand",
  "other",
] as const;
export type ContestAromaTag = (typeof CONTEST_AROMA_TAGS)[number];

export const CONTEST_AROMA_TAG_LABELS: Record<ContestAromaTag, string> = {
  citrus: "Agrumes",
  tropical_fruit: "Fruits tropicaux",
  red_berry: "Fruits rouges",
  floral: "Floral",
  earthy: "Terreux",
  woody: "Boise",
  pine_resin: "Pin / résineux",
  spicy_pepper: "Épice / poivre",
  diesel_gas: "Diesel / gaz",
  herbal: "Herbacé",
  sweet_gourmand: "Sucré / gourmand",
  other: "Autre",
};

export type ContestSeason = {
  id: string;
  code: string;
  label: string;
  year: number;
  harvestStart?: string;
  harvestEnd?: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContestEntryTechnicalSheet = {
  analysisPdf?: string;
  analysisUrl?: string;
  certificateUrl?: string;
  coaUrl?: string;
  batchLabel?: string;
  harvestLabel?: string;
  genetics?: string;
  cbdPercent?: number;
  thcPercent?: number;
  trimMethod?: string;
  dryingMethod?: string;
  curingMethod?: string;
  variety?: string;
  soil?: string;
  indoorCulture?: string[];
  harvestDate?: string;
  cannabinoidRates?: Array<{
    code: string;
    rate: number;
  }>;
  dominantTerpenes?: string[];
  notes?: string;
  [key: string]: unknown;
};

export type ContestLinkedProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
  analysisPdf?: string;
};

export type ContestLinkedProducer = {
  id: string;
  name: string;
  image?: string;
  location?: string;
  department?: string;
  region?: string;
  soil?: string;
};

export type ContestEntry = {
  id: string;
  slug: string;
  title: string;
  productId: string;
  producerId?: string;
  seasonId: string;
  category: ContestEntryCategory;
  track: ContestEntryTrack;
  story: string;
  technicalSheet: ContestEntryTechnicalSheet;
  imageUrl: string;
  galleryUrls: string[];
  isPublished: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  season?: ContestSeason;
  product?: ContestLinkedProduct;
  producer?: ContestLinkedProducer;
};

export type ContestCriterionAverages = Partial<Record<ContestScoreCriterion, number>>;
export type ContestConsumptionCounts = Partial<Record<ContestConsumptionMethod, number>>;

export type ContestEntryStats = {
  entryId: string;
  seasonId: string;
  category: ContestEntryCategory;
  track: ContestEntryTrack;
  approvedReviewCount: number;
  averageScore: number;
  criterionAverages: ContestCriterionAverages;
  consumptionCounts: ContestConsumptionCounts;
};

export type ContestEntryRanking = {
  entryId: string;
  seasonId: string;
  category: ContestEntryCategory;
  track: ContestEntryTrack;
  approvedReviewCount: number;
  averageScore: number;
  seasonBaselineScore: number;
  smoothedScore: number;
  isRankEligible: boolean;
  seasonRankOverall: number;
  seasonCategoryRank: number;
};

export type ContestEntrySummary = ContestEntry & {
  stats: ContestEntryStats;
  ranking?: ContestEntryRanking;
};

export type ContestProfile = {
  customerId: string;
  pseudo: string;
  createdAt: string;
  updatedAt: string;
};

export type ContestTesterPointReason =
  | "review_approved"
  | "terpene_match"
  | "review_upvote_received"
  | "review_downvote_received"
  | "admin_quality_useful"
  | "admin_quality_excellent"
  | "manual_adjustment";

export type ContestTesterPointLedgerItem = {
  id: number;
  customerId: string;
  reviewId?: string | null;
  seasonId?: string | null;
  reason: ContestTesterPointReason | string;
  points: number;
  createdAt: string;
};

export type ContestTesterLevel = {
  code: string;
  label: string;
  requiredPoints: number;
  nextRequiredPoints?: number | null;
  rewardPackCount: number;
};

export type ContestTesterProgress = {
  customerId: string;
  pseudo: string;
  totalPoints: number;
  currentLevel: ContestTesterLevel;
  nextLevel?: ContestTesterLevel | null;
  pointsIntoLevel: number;
  pointsToNextLevel: number;
  progressPercent: number;
  globalRank?: number | null;
  seasonRank?: number | null;
  selectedSeason?: ContestSeason | null;
};

export type ContestBadge = {
  id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  seasonId?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ContestProfileBadge = {
  id: number;
  customerId: string;
  badgeId: string;
  reviewId?: string | null;
  awardedAt: string;
  rewardPackCount: number;
  rewardClaimedAt?: string | null;
  badge?: ContestBadge;
};

export type ContestRewardUnlockStatus = "unlocked" | "claimed" | "expired";

export type ContestReward = {
  id: string;
  code: string;
  label: string;
  description: string;
  requiredPoints: number;
  rewardType: string;
  isActive: boolean;
  createdAt: string;
};

export type ContestRewardUnlock = {
  id: number;
  customerId: string;
  rewardId: string;
  status: ContestRewardUnlockStatus;
  unlockedAt: string;
  claimedAt?: string | null;
  reward?: ContestReward;
};

export type ContestReviewQualityMark = "" | "useful" | "excellent";

export type ContestReviewVoteValue = -1 | 1;

export type ContestReviewVoteSummary = {
  upvoteCount: number;
  downvoteCount: number;
  netVoteScore: number;
  isContested: boolean;
  viewerVote?: ContestReviewVoteValue | null;
};

export type ContestReviewScore = {
  criterion: ContestScoreCriterion;
  score: number;
};

export type ContestReviewAromaSelection = {
  tag: ContestAromaTag;
  customLabel?: string;
};

export type ContestReview = {
  id: string;
  entryId: string;
  seasonId: string;
  customerId: string;
  pseudo: string;
  consumptionMethod: ContestConsumptionMethod;
  consumptionDetails?: string;
  comment: string;
  status: ContestReviewStatus;
  adminNote: string;
  qualityMark: ContestReviewQualityMark;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scores: ContestReviewScore[];
  aromaTags: ContestReviewAromaSelection[];
  terpeneGuesses: string[];
  entryTitle?: string;
  entrySlug?: string;
  entryImageUrl?: string;
  seasonLabel?: string;
  seasonCode?: string;
  category?: ContestEntryCategory;
  track?: ContestEntryTrack;
  voteSummary?: ContestReviewVoteSummary;
};

export type ContestTesterRankingScope = "global" | "season";

export type ContestTesterRankingItem = {
  customerId: string;
  pseudo: string;
  totalPoints: number;
  seasonPoints?: number;
  rank: number;
  globalRank?: number | null;
  seasonRank?: number | null;
  seasonId?: string | null;
  approvedReviewCount: number;
  correctTerpeneCount: number;
  upvoteCount: number;
  downvoteCount: number;
  netVoteScore: number;
  latestApprovedAt?: string | null;
  level: ContestTesterLevel;
};

export type ContestPublicTesterProfile = {
  profile: ContestProfile;
  progress: ContestTesterProgress;
  badges: ContestProfileBadge[];
  rankings: {
    global?: ContestTesterRankingItem | null;
    season?: ContestTesterRankingItem | null;
  };
  reviews: ContestReview[];
};

export type ContestReviewEligibilityReason =
  | "ok"
  | "not_authenticated"
  | "missing_profile"
  | "entry_unavailable"
  | "already_reviewed"
  | "not_purchased";

export type ContestReviewEligibility = {
  eligible: boolean;
  reason: ContestReviewEligibilityReason;
};

export type ContestEntryDetail = {
  entry: ContestEntrySummary;
  reviews: ContestReview[];
  viewerProfile: ContestProfile | null;
  viewerReview: ContestReview | null;
  viewerBadges: ContestProfileBadge[];
  eligibility: ContestReviewEligibility;
};

export type ContestNotebookUnlock = {
  entryId: string;
  reviewId?: string | null;
  status?: ContestReviewStatus | null;
  unlockedAt: string;
  review?: ContestReview;
  source: "purchase" | "review";
};

export type ContestFeedItem = {
  reviewId: string;
  entryId: string;
  entrySlug: string;
  entryTitle: string;
  entryImageUrl?: string;
  seasonCode: string;
  seasonLabel: string;
  category: ContestEntryCategory;
  track?: ContestEntryTrack;
  pseudo: string;
  comment: string;
  excerpt: string;
  consumptionMethod: ContestConsumptionMethod;
  scores: ContestReviewScore[];
  aromaTags: ContestReviewAromaSelection[];
  voteSummary?: ContestReviewVoteSummary;
  createdAt: string;
  validatedAt?: string | null;
};

export type ContestSeasonInput = {
  code: string;
  label: string;
  year: number;
  harvestStart?: string;
  harvestEnd?: string;
  isActive?: boolean;
  isArchived?: boolean;
};

export type ContestEntryInput = {
  slug?: string;
  title: string;
  productId: string;
  producerId?: string;
  seasonId: string;
  category: ContestEntryCategory;
  track?: ContestEntryTrack;
  story?: string;
  technicalSheet?: ContestEntryTechnicalSheet;
  imageUrl?: string;
  galleryUrls?: string[];
  isPublished?: boolean;
  position?: number;
};

export type ContestReviewSubmissionInput = {
  entryId: string;
  consumptionMethod: ContestConsumptionMethod;
  consumptionDetails?: string;
  comment?: string;
  scores: Record<ContestScoreCriterion, number>;
  aromaTags: ContestReviewAromaSelection[];
  terpeneGuesses?: string[];
};
