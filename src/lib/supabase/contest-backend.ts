import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { syncKqNotebookRewardsForCustomer } from "@/lib/supabase/kanab-quest-notebook-rewards-backend";
import { syncKqProducerNotebookRewardsForReview } from "@/lib/supabase/kanab-quest-producer-rewards-backend";
import { CONTEST_SCORE_MAX, CONTEST_SCORE_MIN } from "@/lib/contest-score";
import { CANNABIS_TERPENE_CODES, normalizeContestTerpene } from "@/lib/contest-terpenes";
import { selectContestProductTastingEntry } from "@/lib/contest-product-tasting";
import {
  CONTEST_AROMA_TAGS,
  CONTEST_CONSUMPTION_METHODS,
  CONTEST_ENTRY_CATEGORIES,
  CONTEST_ENTRY_TRACKS,
  CONTEST_REVIEW_STATUSES,
  CONTEST_SCORE_CRITERIA,
  type ContestAromaTag,
  type ContestConsumptionMethod,
  type ContestConsumptionCounts,
  type ContestCriterionAverages,
  type ContestEntry,
  type ContestEntryCategory,
  type ContestEntryDetail,
  type ContestEntryInput,
  type ContestEntryRanking,
  type ContestEntryStats,
  type ContestEntrySummary,
  type ContestEntryTrack,
  type ContestFeedItem,
  type ContestLinkedProducer,
  type ContestLinkedProduct,
  type ContestNotebookUnlock,
  type ContestProfileBadge,
  type ContestProfile,
  type ContestProductTastingSummary,
  type ContestPublicTesterProfile,
  type ContestReview,
  type ContestReviewAromaSelection,
  type ContestReviewEligibility,
  type ContestReviewQualityMark,
  type ContestReviewScore,
  type ContestReviewStatus,
  type ContestReviewSubmissionInput,
  type ContestReviewVoteSummary,
  type ContestReviewVoteValue,
  type ContestScoreCriterion,
  type ContestSeason,
  type ContestSeasonInput,
  type ContestTesterLevel,
  type ContestTesterProgress,
  type ContestTesterRankingItem,
  type ContestTesterRankingScope,
} from "@/types/contest";

const SELECT_SEASON_COLUMNS = [
  "id",
  "code",
  "label",
  "year",
  "harvest_start",
  "harvest_end",
  "is_active",
  "is_archived",
  "created_at",
  "updated_at",
].join(",");

const SELECT_ENTRY_COLUMNS = [
  "id",
  "slug",
  "title",
  "product_id",
  "producer_id",
  "season_id",
  "category",
  "track",
  "story",
  "technical_sheet",
  "image_url",
  "gallery_urls",
  "is_published",
  "position",
  "created_at",
  "updated_at",
].join(",");

const SELECT_REVIEW_COLUMNS = [
  "id",
  "entry_id",
  "season_id",
  "customer_id",
  "pseudo_snapshot",
  "consumption_method",
  "consumption_details",
  "comment",
  "status",
  "admin_note",
  "quality_mark",
  "reviewed_by",
  "reviewed_at",
  "created_at",
  "updated_at",
].join(",");

const SCORE_FIELD_BY_CRITERION: Record<ContestScoreCriterion, string> = {
  appearance: "appearance_avg",
  manicure: "manicure_avg",
  drying_curing: "drying_curing_avg",
  cold_aroma: "cold_aroma_avg",
  aroma_intensity: "aroma_intensity_avg",
  aroma_complexity: "aroma_complexity_avg",
  flavor: "flavor_avg",
  smoothness_burn: "smoothness_burn_avg",
  persistence: "persistence_avg",
  overall_impression: "overall_impression_avg",
};

const CONSUMPTION_COUNT_FIELD_BY_METHOD: Record<ContestConsumptionMethod, string> = {
  vaporizer: "vaporizer_review_count",
  joint_no_tobacco: "joint_no_tobacco_review_count",
  joint_with_tobacco: "joint_with_tobacco_review_count",
  water_pipe: "water_pipe_review_count",
  other: "other_review_count",
};

const PSEUDO_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;

const CONTEST_TESTER_LEVELS: ContestTesterLevel[] = [
  { code: "curieux", label: "Curieux", requiredPoints: 0, nextRequiredPoints: 100, rewardPackCount: 0 },
  { code: "gouteur", label: "Gouteur", requiredPoints: 100, nextRequiredPoints: 300, rewardPackCount: 1 },
  { code: "nez-fin", label: "Nez Fin", requiredPoints: 300, nextRequiredPoints: 750, rewardPackCount: 2 },
  { code: "juge-amateur", label: "Juge Amateur", requiredPoints: 750, nextRequiredPoints: 1500, rewardPackCount: 3 },
  {
    code: "testeur-certifie",
    label: "Testeur Certifie",
    requiredPoints: 1500,
    nextRequiredPoints: 3000,
    rewardPackCount: 5,
  },
  {
    code: "maitre-terpene",
    label: "Maitre Terpene",
    requiredPoints: 3000,
    nextRequiredPoints: null,
    rewardPackCount: 8,
  },
];

type ContestBadgeRewardDefinition = {
  id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  boosterPacks: number;
  seasonId?: string | null;
};

const CONTEST_BADGE_REWARDS = {
  firstNotebook: {
    id: "contest-badge-premier-carnet",
    code: "premier-carnet",
    label: "Premier Carnet",
    description: "Fais valider ta première critique dans L'Arène.",
    icon: "book-open",
    boosterPacks: 1,
  },
  regularTaster: {
    id: "contest-badge-gouteur-regulier",
    code: "gouteur-regulier",
    label: "Gouteur Regulier",
    description: "Fais valider 3 critiques concours.",
    icon: "calendar-check",
    boosterPacks: 2,
  },
  marathon: {
    id: "contest-badge-marathon-des-lots",
    code: "marathon-des-lots",
    label: "Marathon des Lots",
    description: "Fais valider 10 critiques concours.",
    icon: "trophy",
    boosterPacks: 4,
  },
  firstTrail: {
    id: "contest-badge-premiere-piste",
    code: "premiere-piste",
    label: "Premiere Piste",
    description: "Trouve ton premier terpene dominant.",
    icon: "sparkles",
    boosterPacks: 1,
  },
  aromaticCombo: {
    id: "contest-badge-combo-aromatique",
    code: "combo-aromatique",
    label: "Combo Aromatique",
    description: "Trouve 3 terpenes corrects dans une meme critique.",
    icon: "blend",
    boosterPacks: 3,
  },
  absoluteNose: {
    id: "contest-badge-nez-absolu",
    code: "nez-absolu",
    label: "Nez Absolu",
    description: "Trouve exactement les terpenes dominants d'une fleur concours.",
    icon: "nose",
    boosterPacks: 3,
  },
  divineNose: {
    id: "contest-badge-nez-divin",
    code: "nez-divin",
    label: "Nez Divin",
    description: "Obtiens Nez Absolu sur 3 critiques.",
    icon: "spark",
    boosterPacks: 6,
  },
  seasonTour: {
    id: "contest-badge-tour-de-saison",
    code: "tour-de-saison",
    label: "Tour de Saison",
    description: "Fais valider 3 critiques sur une meme saison.",
    icon: "route",
    boosterPacks: 2,
  },
  outdoorExpert: {
    id: "contest-badge-expert-outdoor",
    code: "expert-outdoor",
    label: "Expert Outdoor",
    description: "Fais valider 3 critiques sur des lots outdoor.",
    icon: "sun",
    boosterPacks: 1,
  },
  greenhouseExpert: {
    id: "contest-badge-expert-greenhouse",
    code: "expert-greenhouse",
    label: "Expert Greenhouse",
    description: "Fais valider 3 critiques sur des lots greenhouse.",
    icon: "sprout",
    boosterPacks: 1,
  },
  indoorExpert: {
    id: "contest-badge-expert-indoor",
    code: "expert-indoor",
    label: "Expert Indoor",
    description: "Fais valider 3 critiques sur des lots indoor.",
    icon: "lamp",
    boosterPacks: 1,
  },
  usefulReview: {
    id: "contest-badge-critique-utile",
    code: "critique-utile",
    label: "Critique Utile",
    description: "Reçois un marquage utile par moderation.",
    icon: "thumbs-up",
    boosterPacks: 1,
  },
  goldenPen: {
    id: "contest-badge-plume-dor",
    code: "plume-dor",
    label: "Plume d'Or",
    description: "Reçois un marquage excellente par moderation.",
    icon: "pen-line",
    boosterPacks: 3,
  },
  respectedVoice: {
    id: "contest-badge-voix-respectee",
    code: "voix-respectee",
    label: "Voix Respectee",
    description: "Reçois 25 pouces haut sur tes critiques.",
    icon: "message-circle-heart",
    boosterPacks: 2,
  },
  seriousValidator: {
    id: "contest-badge-validateur-serieux",
    code: "validateur-serieux",
    label: "Validateur Serieux",
    description: "Vote sur 25 critiques d'autres testeurs.",
    icon: "badge-check",
    boosterPacks: 1,
  },
} satisfies Record<string, ContestBadgeRewardDefinition>;

const CONTEST_ELIGIBLE_PAYMENT_STATES = ["paid"] as const;
const ADMIN_CONTEST_LIST_DEFAULT_LIMIT = 200;
const ADMIN_CONTEST_LIST_MAX_LIMIT = 500;

export type ContestAdminPaginationInput = {
  limit?: number;
  offset?: number;
};

export type ContestAdminPaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type ContestSeasonRow = Record<string, unknown>;
type ContestEntryRow = Record<string, unknown>;
type ContestReviewRow = Record<string, unknown>;
type ContestShopFlowerRow = Record<string, unknown>;

export const CONTEST_SCHEMA_MISSING_MESSAGE =
  "Le schéma de L'Arène n'est pas encore migré sur ce projet Supabase.";

export class ContestSchemaMissingError extends Error {
  constructor() {
    super(CONTEST_SCHEMA_MISSING_MESSAGE);
    this.name = "ContestSchemaMissingError";
  }
}

type SupabaseContestError = {
  message: string;
  code?: string | null;
};

function isContestSchemaMissingSupabaseError(error: SupabaseContestError | null): boolean {
  if (!error) {
    return false;
  }

  const code = (error.code ?? "").toUpperCase();
  const message = error.message.toLowerCase();

  if (code === "PGRST205" || code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("contest_") &&
    (message.includes("schema cache") ||
      message.includes("column") ||
      message.includes("relation \"public.contest_") ||
      message.includes("relation \"contest_"))
  );
}

export function isContestSchemaMissingError(error: unknown): error is ContestSchemaMissingError {
  return error instanceof ContestSchemaMissingError;
}

function failIfError(error: SupabaseContestError | null, context: string): void {
  if (error) {
    if (isContestSchemaMissingSupabaseError(error)) {
      throw new ContestSchemaMissingError();
    }
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toRow(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(toRow(item)));
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalText(value: unknown): string | undefined {
  const text = toText(value).trim();
  return text ? text : undefined;
}

function normalizeAdminContestPagination(input: ContestAdminPaginationInput = {}): {
  limit: number;
  offset: number;
} {
  const requestedLimit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.floor(input.limit)
      : ADMIN_CONTEST_LIST_DEFAULT_LIMIT;
  const requestedOffset =
    typeof input.offset === "number" && Number.isFinite(input.offset)
      ? Math.floor(input.offset)
      : 0;

  return {
    limit: Math.max(1, Math.min(ADMIN_CONTEST_LIST_MAX_LIMIT, requestedLimit)),
    offset: Math.max(0, requestedOffset),
  };
}

export function normalizeContestPublicLimit(value: unknown, fallback: number, max: number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  const requestedLimit = Number.isFinite(numericValue) ? Math.floor(numericValue) : fallback;
  return Math.max(1, Math.min(max, requestedLimit));
}

function buildAdminContestPaginatedResult<T>(
  items: T[],
  total: number | null | undefined,
  pagination: { limit: number; offset: number },
): ContestAdminPaginatedResult<T> {
  const safeTotal = Math.max(items.length, total ?? items.length);
  return {
    items,
    total: safeTotal,
    limit: pagination.limit,
    offset: pagination.offset,
    hasMore: pagination.offset + items.length < safeTotal,
  };
}

function normalizeEmail(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

export function isContestEligiblePaymentState(value: unknown): boolean {
  const paymentState = toText(value).trim();
  return CONTEST_ELIGIBLE_PAYMENT_STATES.some((eligibleState) => eligibleState === paymentState);
}

export function getContestPurchasedProductBaseId(orderItemProductId: string): string {
  return orderItemProductId.trim().split("::", 1)[0]?.trim() ?? "";
}

export function isContestPurchasedProductIdMatch(orderItemProductId: string, contestProductId: string): boolean {
  const safeOrderItemProductId = getContestPurchasedProductBaseId(orderItemProductId);
  const safeContestProductId = contestProductId.trim();

  if (!safeOrderItemProductId || !safeContestProductId) {
    return false;
  }

  return safeOrderItemProductId === safeContestProductId;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }

  return fallback;
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function toMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Number(parsed.toFixed(2));
}

function toIsoString(value: unknown): string {
  const text = toText(value);
  if (!text) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const values = value
    .map((item) => toText(item).trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(values));
}

function toContestCategory(value: unknown): ContestEntryCategory {
  const candidate = toText(value).trim().toLowerCase() as ContestEntryCategory;
  return CONTEST_ENTRY_CATEGORIES.includes(candidate) ? candidate : "outdoor";
}

function toContestTrack(value: unknown): ContestEntryTrack {
  const candidate = toText(value).trim().toLowerCase() as ContestEntryTrack;
  return CONTEST_ENTRY_TRACKS.includes(candidate) ? candidate : "regular";
}

function isConcoursEntryTrack(value: unknown): boolean {
  return toContestTrack(value) === "concours";
}

function toContestConsumptionMethod(value: unknown): ContestConsumptionMethod {
  const candidate = toText(value).trim().toLowerCase() as ContestConsumptionMethod;
  return CONTEST_CONSUMPTION_METHODS.includes(candidate) ? candidate : "other";
}

function toContestReviewStatus(value: unknown): ContestReviewStatus {
  const candidate = toText(value).trim().toLowerCase() as ContestReviewStatus;
  return CONTEST_REVIEW_STATUSES.includes(candidate) ? candidate : "pending";
}

function toContestReviewQualityMark(value: unknown): ContestReviewQualityMark {
  const candidate = toText(value).trim().toLowerCase();
  return candidate === "useful" || candidate === "excellent" ? candidate : "";
}

function toContestReviewVoteValue(value: unknown): ContestReviewVoteValue | null {
  const numeric = Number(value);
  return numeric === 1 || numeric === -1 ? numeric : null;
}

function toContestAromaTag(value: unknown): ContestAromaTag | null {
  const candidate = toText(value).trim().toLowerCase() as ContestAromaTag;
  return CONTEST_AROMA_TAGS.includes(candidate) ? candidate : null;
}

function sanitizePseudo(value: string): string {
  const trimmed = value.trim().slice(0, 24);
  if (!PSEUDO_PATTERN.test(trimmed)) {
    throw new Error("Pseudo invalide. Utilise 3 a 24 caracteres: lettres, chiffres, point, tiret ou underscore.");
  }

  return trimmed;
}

function sanitizeComment(value: string | undefined): string {
  return (value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 2000);
}

function sanitizeConsumptionDetails(value: string | undefined): string {
  return (value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 120);
}

function sanitizeTechnicalSheet(value: unknown): ContestEntry["technicalSheet"] {
  return toObject(value) as ContestEntry["technicalSheet"];
}

function sanitizeStory(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 8000);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const cleaned = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return Array.from(new Set(cleaned));
}

function isPurchasableVariantOption(value: unknown): boolean {
  const option = toObject(value);
  const price = Number(option.price);
  if (option.enabled === false) {
    return false;
  }
  if (Number.isFinite(price) && price < 0) {
    return false;
  }

  const stockQuantity = Number(option.stockQuantity ?? option.stock_quantity);
  if (Number.isFinite(stockQuantity)) {
    return stockQuantity > 0;
  }

  return option.inStock !== false && option.in_stock !== false;
}

function isShopFlowerForSale(product: ContestShopFlowerRow): boolean {
  if (toText(product.category) !== "fleurs") {
    return false;
  }

  const variantOptions = Array.isArray(product.variant_options) ? product.variant_options : [];
  if (variantOptions.length > 0) {
    return variantOptions.some((option) => isPurchasableVariantOption(option));
  }

  if (product.track_stock !== true) {
    return true;
  }

  const stockQuantity = Number(product.stock_quantity);
  return Number.isFinite(stockQuantity) && stockQuantity > 0;
}

function slugifyContestText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

function compareReviewValidationOrder(a: ContestReview, b: ContestReview): number {
  const aTime = Date.parse(a.reviewedAt ?? a.createdAt);
  const bTime = Date.parse(b.reviewedAt ?? b.createdAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id.localeCompare(b.id);
}

function buildEmptyStats(
  entryId: string,
  seasonId: string,
  category: ContestEntryCategory,
  track: ContestEntryTrack,
): ContestEntryStats {
  return {
    entryId,
    seasonId,
    category,
    track,
    approvedReviewCount: 0,
    averageScore: 0,
    criterionAverages: {},
    consumptionCounts: {},
  };
}

function mapSeasonRow(row: ContestSeasonRow): ContestSeason {
  return {
    id: toText(row.id),
    code: toText(row.code),
    label: toText(row.label),
    year: toInteger(row.year, new Date().getFullYear()),
    harvestStart: toOptionalText(row.harvest_start),
    harvestEnd: toOptionalText(row.harvest_end),
    isActive: toBoolean(row.is_active),
    isArchived: toBoolean(row.is_archived),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapEntryRow(row: ContestEntryRow): ContestEntry {
  return {
    id: toText(row.id),
    slug: toText(row.slug),
    title: toText(row.title),
    productId: toText(row.product_id),
    producerId: toOptionalText(row.producer_id),
    seasonId: toText(row.season_id),
    category: toContestCategory(row.category),
    track: toContestTrack(row.track),
    story: toText(row.story),
    technicalSheet: sanitizeTechnicalSheet(row.technical_sheet),
    imageUrl: toText(row.image_url),
    galleryUrls: toStringArray(row.gallery_urls),
    isPublished: toBoolean(row.is_published),
    position: toInteger(row.position, 0),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapProfileRow(row: Record<string, unknown>): ContestProfile {
  return {
    customerId: toText(row.customer_id),
    pseudo: toText(row.pseudo),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapStatsRow(row: Record<string, unknown>): ContestEntryStats {
  const category = toContestCategory(row.category);
  const criterionAverages: ContestCriterionAverages = {};
  for (const criterion of CONTEST_SCORE_CRITERIA) {
    const raw = row[SCORE_FIELD_BY_CRITERION[criterion]];
    if (raw !== null && raw !== undefined && Number.isFinite(Number(raw))) {
      criterionAverages[criterion] = toMoney(raw);
    }
  }

  const consumptionCounts: ContestConsumptionCounts = {};
  for (const method of CONTEST_CONSUMPTION_METHODS) {
    const raw = row[CONSUMPTION_COUNT_FIELD_BY_METHOD[method]];
    const count = toInteger(raw, 0);
    if (count > 0) {
      consumptionCounts[method] = count;
    }
  }

  return {
    entryId: toText(row.entry_id),
    seasonId: toText(row.season_id),
    category,
    track: toContestTrack(row.track),
    approvedReviewCount: toInteger(row.approved_review_count, 0),
    averageScore: toMoney(row.average_score, 0),
    criterionAverages,
    consumptionCounts,
  };
}

function mapRankingRow(row: Record<string, unknown>): ContestEntryRanking {
  return {
    entryId: toText(row.entry_id),
    seasonId: toText(row.season_id),
    category: toContestCategory(row.category),
    track: toContestTrack(row.track),
    approvedReviewCount: toInteger(row.approved_review_count, 0),
    averageScore: toMoney(row.average_score, 0),
    seasonBaselineScore: toMoney(row.season_baseline_score, 0),
    smoothedScore: toMoney(row.smoothed_score, 0),
    isRankEligible: toBoolean(row.is_rank_eligible),
    seasonRankOverall: toInteger(row.season_rank_overall, 0),
    seasonCategoryRank: toInteger(row.season_category_rank, 0),
  };
}

function mapReviewRow(row: ContestReviewRow): ContestReview {
  return {
    id: toText(row.id),
    entryId: toText(row.entry_id),
    seasonId: toText(row.season_id),
    customerId: toText(row.customer_id),
    pseudo: toText(row.pseudo_snapshot),
    consumptionMethod: toContestConsumptionMethod(row.consumption_method),
    consumptionDetails: toOptionalText(row.consumption_details),
    comment: toText(row.comment),
    status: toContestReviewStatus(row.status),
    adminNote: toText(row.admin_note),
    qualityMark: toContestReviewQualityMark(row.quality_mark),
    reviewedBy: toOptionalText(row.reviewed_by) ?? null,
    reviewedAt: toOptionalText(row.reviewed_at) ?? null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    scores: [],
    aromaTags: [],
    terpeneGuesses: [],
  };
}

function mapContestProfileBadgeRow(row: Record<string, unknown>): ContestProfileBadge {
  const badgeRow = toObject(row.contest_badges);
  return {
    id: toInteger(row.id, 0),
    customerId: toText(row.customer_id),
    badgeId: toText(row.badge_id),
    reviewId: toOptionalText(row.review_id) ?? null,
    awardedAt: toIsoString(row.awarded_at),
    rewardPackCount: Math.max(0, toInteger(row.reward_pack_count, 0)),
    rewardClaimedAt: toOptionalText(row.reward_claimed_at) ?? null,
    badge: {
      id: toText(badgeRow.id),
      code: toText(badgeRow.code),
      label: toText(badgeRow.label),
      description: toText(badgeRow.description),
      icon: toText(badgeRow.icon),
      seasonId: toOptionalText(badgeRow.season_id) ?? null,
      isActive: toBoolean(badgeRow.is_active, true),
      createdAt: toIsoString(badgeRow.created_at),
    },
  };
}

function getContestTesterLevel(totalPoints: number): ContestTesterLevel {
  const safePoints = Math.max(0, Math.floor(totalPoints));
  let current = CONTEST_TESTER_LEVELS[0];
  for (const level of CONTEST_TESTER_LEVELS) {
    if (safePoints >= level.requiredPoints) {
      current = level;
    }
  }

  return current;
}

function getNextContestTesterLevel(totalPoints: number): ContestTesterLevel | null {
  const safePoints = Math.max(0, Math.floor(totalPoints));
  return CONTEST_TESTER_LEVELS.find((level) => level.requiredPoints > safePoints) ?? null;
}

function buildContestTesterProgress(input: {
  customerId: string;
  pseudo: string;
  totalPoints: number;
  globalRank?: number | null;
  seasonRank?: number | null;
  selectedSeason?: ContestSeason | null;
}): ContestTesterProgress {
  const totalPoints = Math.max(0, Math.floor(input.totalPoints));
  const currentLevel = getContestTesterLevel(totalPoints);
  const nextLevel = getNextContestTesterLevel(totalPoints);
  const nextRequiredPoints = nextLevel?.requiredPoints ?? currentLevel.requiredPoints;
  const levelSpan = Math.max(1, nextRequiredPoints - currentLevel.requiredPoints);
  const pointsIntoLevel = Math.max(0, totalPoints - currentLevel.requiredPoints);
  const pointsToNextLevel = nextLevel ? Math.max(0, nextLevel.requiredPoints - totalPoints) : 0;
  const progressPercent = nextLevel
    ? Math.max(0, Math.min(100, Math.round((pointsIntoLevel / levelSpan) * 100)))
    : 100;

  return {
    customerId: input.customerId,
    pseudo: input.pseudo,
    totalPoints,
    currentLevel,
    nextLevel,
    pointsIntoLevel,
    pointsToNextLevel,
    progressPercent,
    globalRank: input.globalRank ?? null,
    seasonRank: input.seasonRank ?? null,
    selectedSeason: input.selectedSeason ?? null,
  };
}

function mapTesterRankingRow(
  row: Record<string, unknown>,
  scope: ContestTesterRankingScope,
): ContestTesterRankingItem {
  const totalPoints = scope === "season"
    ? toInteger(row.season_points, 0)
    : toInteger(row.total_points, 0);
  const globalRank = toInteger(row.global_rank, 0) || null;
  const seasonRank = toInteger(row.season_rank, 0) || null;

  return {
    customerId: toText(row.customer_id),
    pseudo: toText(row.pseudo),
    totalPoints,
    seasonPoints: scope === "season" ? totalPoints : undefined,
    rank: scope === "season" ? seasonRank ?? 0 : globalRank ?? 0,
    globalRank,
    seasonRank,
    seasonId: toOptionalText(row.season_id) ?? null,
    approvedReviewCount: toInteger(row.approved_review_count, 0),
    correctTerpeneCount: toInteger(row.correct_terpene_count, 0),
    upvoteCount: toInteger(row.upvote_count, 0),
    downvoteCount: toInteger(row.downvote_count, 0),
    netVoteScore: toInteger(row.net_vote_score, 0),
    latestApprovedAt: toOptionalText(row.latest_approved_at) ?? null,
    level: getContestTesterLevel(totalPoints),
  };
}

async function loadOwnProducerFallback(): Promise<ContestLinkedProducer | null> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("site_content")
    .select("boutique")
    .eq("id", 1)
    .maybeSingle();

  failIfError(result.error, "read site_content own producer");
  const boutique = toObject(toRow(result.data)?.boutique);
  const ownProducer = toObject(boutique.ownProducer);
  const name = toOptionalText(ownProducer.name);
  if (!name) {
    return null;
  }

  return {
    id: toOptionalText(ownProducer.id) ?? "own-producer",
    name,
    image: toOptionalText(ownProducer.image),
    location: toOptionalText(ownProducer.location),
    department: toOptionalText(ownProducer.department),
    region: toOptionalText(ownProducer.region),
    soil: toOptionalText(ownProducer.soil),
  };
}

async function hydrateEntries(rows: ContestEntryRow[]): Promise<ContestEntrySummary[]> {
  const entries = rows.map((row) => mapEntryRow(row));
  if (entries.length === 0) {
    return [];
  }

  const seasonIds = uniqueStrings(entries.map((entry) => entry.seasonId));
  const productIds = uniqueStrings(entries.map((entry) => entry.productId));
  const producerIds = uniqueStrings(entries.map((entry) => entry.producerId));
  const entryIds = uniqueStrings(entries.map((entry) => entry.id));
  const hasFallbackProducer = entries.some((entry) => !entry.producerId);

  const supabase = createSupabaseServiceClient();
  const [seasonResult, productResult, producerResult, statsResult, rankingResult, ownProducer] = await Promise.all([
    supabase.from("contest_seasons").select(SELECT_SEASON_COLUMNS).in("id", seasonIds),
    supabase.from("products").select("id,name,price,image,category,analysis_pdf").in("id", productIds),
    producerIds.length > 0
      ? supabase.from("producers").select("id,name,image,location,department,region,soil").in("id", producerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("contest_entry_stats").select("*").in("entry_id", entryIds),
    supabase.from("contest_rankings_current").select("*").in("entry_id", entryIds),
    hasFallbackProducer ? loadOwnProducerFallback() : Promise.resolve(null),
  ]);

  failIfError(seasonResult.error, "read contest seasons for entries");
  failIfError(productResult.error, "read products for contest entries");
  failIfError(producerResult.error as { message: string } | null, "read producers for contest entries");
  failIfError(statsResult.error, "read contest stats for entries");
  failIfError(rankingResult.error, "read contest rankings for entries");

  const seasonById = new Map<string, ContestSeason>(
    toRowArray(seasonResult.data).map((row) => {
      const season = mapSeasonRow(row);
      return [season.id, season];
    }),
  );

  const productById = new Map<string, ContestLinkedProduct>(
    toRowArray(productResult.data).map((row) => [
      toText(row.id),
      {
        id: toText(row.id),
        name: toText(row.name),
        price: toMoney(row.price, 0),
        image: toText(row.image),
        category: toOptionalText(row.category),
        analysisPdf: toOptionalText(row.analysis_pdf),
      },
    ]),
  );

  const producerById = new Map<string, ContestLinkedProducer>(
    toRowArray(producerResult.data).map((row) => [
      toText(row.id),
      {
        id: toText(row.id),
        name: toText(row.name),
        image: toOptionalText(row.image),
        location: toOptionalText(row.location),
        department: toOptionalText(row.department),
        region: toOptionalText(row.region),
        soil: toOptionalText(row.soil),
      },
    ]),
  );

  const statsByEntryId = new Map<string, ContestEntryStats>(
    toRowArray(statsResult.data).map((row) => {
      const stats = mapStatsRow(row);
      return [stats.entryId, stats];
    }),
  );

  const rankingByEntryId = new Map<string, ContestEntryRanking>(
    toRowArray(rankingResult.data).map((row) => {
      const ranking = mapRankingRow(row);
      return [ranking.entryId, ranking];
    }),
  );

  return entries.map((entry) => ({
    ...entry,
    season: seasonById.get(entry.seasonId),
    product: productById.get(entry.productId),
    producer: entry.producerId ? producerById.get(entry.producerId) : ownProducer ?? undefined,
    stats: statsByEntryId.get(entry.id) ?? buildEmptyStats(entry.id, entry.seasonId, entry.category, entry.track),
    ranking: rankingByEntryId.get(entry.id),
  }));
}

async function hydrateReviews(
  rows: ContestReviewRow[],
  options: { includeEntry?: boolean; includeSeason?: boolean; viewerCustomerId?: string } = {},
): Promise<ContestReview[]> {
  const reviews = rows.map((row) => mapReviewRow(row));
  if (reviews.length === 0) {
    return [];
  }

  const reviewIds = uniqueStrings(reviews.map((review) => review.id));
  const entryIds = uniqueStrings(reviews.map((review) => review.entryId));
  const seasonIds = uniqueStrings(reviews.map((review) => review.seasonId));
  const supabase = createSupabaseServiceClient();

  const safeViewerCustomerId = options.viewerCustomerId?.trim();
  const [scoresResult, aromaResult, terpeneResult, voteSummaryResult, viewerVoteResult, entryResult, seasonResult] = await Promise.all([
    supabase
      .from("contest_review_scores")
      .select("review_id,criterion,score")
      .in("review_id", reviewIds)
      .order("id", { ascending: true }),
    supabase
      .from("contest_review_aroma_tags")
      .select("review_id,tag,custom_label")
      .in("review_id", reviewIds)
      .order("id", { ascending: true }),
    supabase
      .from("contest_review_terpene_guesses")
      .select("review_id,terpene")
      .in("review_id", reviewIds)
      .order("id", { ascending: true }),
    supabase
      .from("contest_review_vote_summary")
      .select("review_id,upvote_count,downvote_count,net_vote_score,is_contested")
      .in("review_id", reviewIds),
    safeViewerCustomerId
      ? supabase
          .from("contest_review_votes")
          .select("review_id,value")
          .in("review_id", reviewIds)
          .eq("voter_customer_id", safeViewerCustomerId)
      : Promise.resolve({ data: [], error: null }),
    options.includeEntry
      ? supabase.from("contest_entries").select("id,slug,title,category,track,image_url").in("id", entryIds)
      : Promise.resolve({ data: [], error: null }),
    options.includeSeason
      ? supabase.from("contest_seasons").select(SELECT_SEASON_COLUMNS).in("id", seasonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  failIfError(scoresResult.error, "read contest review scores");
  failIfError(aromaResult.error, "read contest review aroma tags");
  failIfError(terpeneResult.error, "read contest review terpene guesses");
  failIfError(voteSummaryResult.error, "read contest review vote summary");
  failIfError(viewerVoteResult.error as { message: string } | null, "read contest review viewer votes");
  failIfError(entryResult.error as { message: string } | null, "read contest review entry relations");
  failIfError(seasonResult.error as { message: string } | null, "read contest review season relations");

  const scoresByReviewId = new Map<string, ContestReviewScore[]>();
  for (const rawRow of toRowArray(scoresResult.data)) {
    const reviewId = toText(rawRow.review_id);
    const criterion = toText(rawRow.criterion) as ContestScoreCriterion;
    if (!reviewId || !CONTEST_SCORE_CRITERIA.includes(criterion)) {
      continue;
    }

    const list = scoresByReviewId.get(reviewId) ?? [];
    list.push({
      criterion,
      score: toInteger(rawRow.score, 0),
    });
    scoresByReviewId.set(reviewId, list);
  }

  const aromaByReviewId = new Map<string, ContestReviewAromaSelection[]>();
  for (const rawRow of toRowArray(aromaResult.data)) {
    const reviewId = toText(rawRow.review_id);
    const tag = toContestAromaTag(rawRow.tag);
    if (!reviewId || !tag) {
      continue;
    }

    const list = aromaByReviewId.get(reviewId) ?? [];
    list.push({
      tag,
      customLabel: toOptionalText(rawRow.custom_label),
    });
    aromaByReviewId.set(reviewId, list);
  }

  const terpenesByReviewId = new Map<string, string[]>();
  for (const rawRow of toRowArray(terpeneResult.data)) {
    const reviewId = toText(rawRow.review_id);
    const terpene = normalizeContestTerpene(toText(rawRow.terpene));
    if (!reviewId || !CANNABIS_TERPENE_CODES.has(terpene)) {
      continue;
    }

    const list = terpenesByReviewId.get(reviewId) ?? [];
    if (!list.includes(terpene)) {
      list.push(terpene);
    }
    terpenesByReviewId.set(reviewId, list);
  }

  const voteSummaryByReviewId = new Map<string, ContestReviewVoteSummary>();
  for (const rawRow of toRowArray(voteSummaryResult.data)) {
    const reviewId = toText(rawRow.review_id);
    if (!reviewId) {
      continue;
    }

    voteSummaryByReviewId.set(reviewId, {
      upvoteCount: toInteger(rawRow.upvote_count, 0),
      downvoteCount: toInteger(rawRow.downvote_count, 0),
      netVoteScore: toInteger(rawRow.net_vote_score, 0),
      isContested: toBoolean(rawRow.is_contested),
      viewerVote: null,
    });
  }

  for (const rawRow of toRowArray(viewerVoteResult.data)) {
    const reviewId = toText(rawRow.review_id);
    const viewerVote = toContestReviewVoteValue(rawRow.value);
    if (!reviewId || viewerVote === null) {
      continue;
    }

    const current = voteSummaryByReviewId.get(reviewId) ?? {
      upvoteCount: 0,
      downvoteCount: 0,
      netVoteScore: 0,
      isContested: false,
      viewerVote: null,
    };
    voteSummaryByReviewId.set(reviewId, {
      ...current,
      viewerVote,
    });
  }

  const entryById = new Map<
    string,
    { slug: string; title: string; category: ContestEntryCategory; track: ContestEntryTrack; imageUrl?: string }
  >(
    toRowArray(entryResult.data).map((row) => [
      toText(row.id),
      {
        slug: toText(row.slug),
        title: toText(row.title),
        category: toContestCategory(row.category),
        track: toContestTrack(row.track),
        imageUrl: toOptionalText(row.image_url),
      },
    ]),
  );

  const seasonById = new Map<string, ContestSeason>(
    toRowArray(seasonResult.data).map((row) => {
      const season = mapSeasonRow(row);
      return [season.id, season];
    }),
  );

  return reviews.map((review) => {
    const entry = entryById.get(review.entryId);
    const season = seasonById.get(review.seasonId);

    return {
      ...review,
      scores: scoresByReviewId.get(review.id) ?? [],
      aromaTags: aromaByReviewId.get(review.id) ?? [],
      terpeneGuesses: terpenesByReviewId.get(review.id) ?? [],
      entryTitle: entry?.title,
      entrySlug: entry?.slug,
      entryImageUrl: entry?.imageUrl,
      seasonLabel: season?.label,
      seasonCode: season?.code,
      category: entry?.category,
      track: entry?.track,
      voteSummary: voteSummaryByReviewId.get(review.id) ?? {
        upvoteCount: 0,
        downvoteCount: 0,
        netVoteScore: 0,
        isContested: false,
        viewerVote: null,
      },
    };
  });
}

async function getContestSeasonByCode(code: string): Promise<ContestSeason | null> {
  const safeCode = code.trim().toLowerCase();
  if (!safeCode) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_seasons")
    .select(SELECT_SEASON_COLUMNS)
    .eq("code", safeCode)
    .maybeSingle();

  failIfError(result.error, "read contest season by code");
  const row = toRow(result.data);
  return row ? mapSeasonRow(row) : null;
}

async function getContestEntryRowById(entryId: string): Promise<ContestEntryRow | null> {
  const safeEntryId = entryId.trim();
  if (!safeEntryId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .eq("id", safeEntryId)
    .maybeSingle();

  failIfError(result.error, "read contest entry by id");
  return toRow(result.data);
}

async function getContestReviewRowByEntryAndCustomer(entryId: string, customerId: string): Promise<ContestReviewRow | null> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS)
    .eq("entry_id", entryId)
    .eq("customer_id", customerId)
    .maybeSingle();

  failIfError(result.error, "read contest review by entry and customer");
  return toRow(result.data);
}

async function getPaidContestOrderRowsForCustomer(
  customerId: string,
  customerEmail?: string,
  limit = 200,
): Promise<Array<{ id: string; createdAt: string }>> {
  const supabase = createSupabaseServiceClient();
  const safeCustomerId = customerId.trim();
  const byCustomerIdPromise = supabase
    .from("orders")
    .select("id,created_at")
    .eq("customer_id", safeCustomerId)
    .in("payment_state", [...CONTEST_ELIGIBLE_PAYMENT_STATES])
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(limit);

  const safeCustomerEmail = normalizeEmail(customerEmail);
  const byEmailPromise = safeCustomerEmail
    ? supabase
        .from("orders")
        .select("id,created_at")
        .is("customer_id", null)
        .ilike("customer_email", safeCustomerEmail)
        .in("payment_state", [...CONTEST_ELIGIBLE_PAYMENT_STATES])
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(limit)
    : Promise.resolve({ data: [], error: null } as {
        data: Array<Record<string, unknown>>;
        error: SupabaseContestError | null;
      });

  const [byCustomerIdResult, byEmailResult] = await Promise.all([
    byCustomerIdPromise,
    byEmailPromise,
  ]);

  failIfError(byCustomerIdResult.error, "read paid orders for contest eligibility");
  failIfError(byEmailResult.error, "read paid email orders for contest eligibility");

  const seenIds = new Set<string>();
  const rows: Array<{ id: string; createdAt: string }> = [];
  for (const row of [...toRowArray(byCustomerIdResult.data), ...toRowArray(byEmailResult.data)]) {
    const id = toText(row.id);
    if (!id || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    rows.push({ id, createdAt: toIsoString(row.created_at) });
  }

  return rows;
}

async function getPurchasedContestProductUnlockDates(
  customerId: string,
  customerEmail?: string,
): Promise<Map<string, string>> {
  const paidOrders = await getPaidContestOrderRowsForCustomer(customerId, customerEmail);
  const orderIds = paidOrders.map((order) => order.id);

  if (orderIds.length === 0) {
    return new Map();
  }

  const orderDateById = new Map(paidOrders.map((order) => [order.id, order.createdAt]));
  const productUnlockDateById = new Map<string, string>();
  const supabase = createSupabaseServiceClient();
  const itemsResult = await supabase
    .from("order_items")
    .select("order_id,product_id")
    .in("order_id", orderIds)
    .limit(2000);

  failIfError(itemsResult.error, "read order_items for contest eligibility");

  for (const row of toRowArray(itemsResult.data)) {
    const productId = getContestPurchasedProductBaseId(toText(row.product_id));
    if (!productId) {
      continue;
    }

    const unlockedAt = orderDateById.get(toText(row.order_id)) ?? new Date().toISOString();
    const currentUnlockedAt = productUnlockDateById.get(productId);
    if (!currentUnlockedAt || Date.parse(unlockedAt) > Date.parse(currentUnlockedAt)) {
      productUnlockDateById.set(productId, unlockedAt);
    }
  }

  return productUnlockDateById;
}

async function hasCustomerPurchasedContestProduct(
  customerId: string,
  productId: string,
  customerEmail?: string,
): Promise<boolean> {
  const productUnlockDateById = await getPurchasedContestProductUnlockDates(customerId, customerEmail);
  return productUnlockDateById.has(productId.trim());
}

async function hasCustomerPurchasedAnyProduct(customerId: string, customerEmail?: string): Promise<boolean> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return false;
  }

  const paidOrders = await getPaidContestOrderRowsForCustomer(safeCustomerId, customerEmail, 1);
  return paidOrders.length > 0;
}

async function buildEligibility(
  entry: ContestEntrySummary,
  customerId?: string,
  customerEmail?: string,
): Promise<ContestReviewEligibility> {
  if (!customerId) {
    return { eligible: false, reason: "not_authenticated" };
  }

  const profile = await getContestProfile(customerId);
  if (!profile) {
    return { eligible: false, reason: "missing_profile" };
  }

  const existingReview = await getContestReviewRowByEntryAndCustomer(entry.id, customerId);
  if (existingReview) {
    return { eligible: false, reason: "already_reviewed" };
  }

  const hasPurchased = await hasCustomerPurchasedContestProduct(customerId, entry.productId, customerEmail);
  if (!hasPurchased) {
    return { eligible: false, reason: "not_purchased" };
  }

  return { eligible: true, reason: "ok" };
}

function normalizeSeasonCode(value?: string): string | undefined {
  const safeValue = toOptionalText(value);
  return safeValue ? safeValue.toLowerCase() : undefined;
}

function normalizeCategory(value?: string): ContestEntryCategory | undefined {
  const safeValue = toOptionalText(value);
  if (!safeValue) {
    return undefined;
  }
  const candidate = safeValue.toLowerCase() as ContestEntryCategory;
  return CONTEST_ENTRY_CATEGORIES.includes(candidate) ? candidate : undefined;
}

function normalizeTrack(value?: string): ContestEntryTrack | undefined {
  const safeValue = toOptionalText(value);
  if (!safeValue) {
    return undefined;
  }
  const candidate = safeValue.toLowerCase() as ContestEntryTrack;
  return CONTEST_ENTRY_TRACKS.includes(candidate) ? candidate : undefined;
}

function normalizeReviewStatus(value?: string): ContestReviewStatus | undefined {
  const safeValue = toOptionalText(value);
  if (!safeValue) {
    return undefined;
  }
  const candidate = safeValue.toLowerCase() as ContestReviewStatus;
  return CONTEST_REVIEW_STATUSES.includes(candidate) ? candidate : undefined;
}

function sanitizeAromaSelections(
  values: ContestReviewAromaSelection[],
): ContestReviewAromaSelection[] {
  const normalized: ContestReviewAromaSelection[] = [];
  const seen = new Set<ContestAromaTag>();

  for (const value of values) {
    const tag = toContestAromaTag(value.tag);
    if (!tag || seen.has(tag)) {
      continue;
    }

    const customLabel = tag === "other" ? toOptionalText(value.customLabel)?.slice(0, 80) : undefined;
    if (tag === "other" && !customLabel) {
      continue;
    }

    normalized.push({ tag, customLabel });
    seen.add(tag);
  }

  return normalized;
}

function sanitizeScoreMap(input: Record<ContestScoreCriterion, number>): ContestReviewScore[] {
  const scores: ContestReviewScore[] = [];

  for (const criterion of CONTEST_SCORE_CRITERIA) {
    const raw = input[criterion];
    const score = Number(raw);
    if (!Number.isFinite(score) || score < CONTEST_SCORE_MIN || score > CONTEST_SCORE_MAX) {
      throw new Error(
        `Note invalide pour le critere ${criterion}. Elle doit etre entre ${CONTEST_SCORE_MIN} et ${CONTEST_SCORE_MAX}.`,
      );
    }

    scores.push({ criterion, score: Math.round(score) });
  }

  return scores;
}

function sanitizeTerpeneGuesses(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const terpene = normalizeContestTerpene(toText(value));
    if (!terpene || seen.has(terpene) || !CANNABIS_TERPENE_CODES.has(terpene)) {
      continue;
    }

    seen.add(terpene);
    normalized.push(terpene);
  }

  return normalized;
}

function getDominantTerpeneCodes(technicalSheet: ContestEntry["technicalSheet"]): string[] {
  const dominantTerpenes = Array.isArray(technicalSheet.dominantTerpenes)
    ? technicalSheet.dominantTerpenes
    : [];

  return sanitizeTerpeneGuesses(dominantTerpenes);
}

function isExactTerpeneMatch(expectedTerpenes: string[], guessedTerpenes: string[]): boolean {
  if (expectedTerpenes.length === 0 || expectedTerpenes.length !== guessedTerpenes.length) {
    return false;
  }

  const guessed = new Set(guessedTerpenes);
  return expectedTerpenes.every((terpene) => guessed.has(terpene));
}

async function awardContestBadgeReward(input: {
  customerId: string;
  badge: ContestBadgeRewardDefinition;
  reviewId?: string | null;
}): Promise<boolean> {
  const supabase = createSupabaseServiceClient();

  const badgeUpsert = await supabase.from("contest_badges").upsert(
    {
      id: input.badge.id,
      code: input.badge.code,
      label: input.badge.label,
      description: input.badge.description,
      icon: input.badge.icon,
      season_id: input.badge.seasonId ?? null,
      is_active: true,
    },
    { onConflict: "id" },
  );
  failIfError(badgeUpsert.error, "upsert contest badge reward");

  const badgeInsert = await supabase.from("contest_profile_badges").insert({
    customer_id: input.customerId,
    badge_id: input.badge.id,
    review_id: input.reviewId ?? null,
    reward_pack_count: input.badge.boosterPacks,
  });

  if (badgeInsert.error) {
    if (badgeInsert.error.code === "23505") {
      return false;
    }
    failIfError(badgeInsert.error, "insert contest profile badge reward");
  }

  return true;
}

async function upsertContestTesterPoint(input: {
  customerId: string;
  reviewId?: string | null;
  seasonId?: string | null;
  sourceKey: string;
  reason: string;
  points: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.customerId || !input.sourceKey || input.points === 0) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.from("contest_tester_points").upsert(
    {
      customer_id: input.customerId,
      review_id: input.reviewId ?? null,
      season_id: input.seasonId ?? null,
      source_key: input.sourceKey,
      reason: input.reason,
      points: input.points,
      metadata: input.metadata ?? {},
    },
    { onConflict: "source_key" },
  );
  failIfError(result.error, "upsert contest tester point");
}

async function syncContestTesterPointsForReview(reviewId: string): Promise<void> {
  const safeReviewId = reviewId.trim();
  if (!safeReviewId) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const reviewResult = await supabase
    .from("contest_reviews")
    .select("id,entry_id,season_id,customer_id,status,quality_mark")
    .eq("id", safeReviewId)
    .maybeSingle();

  failIfError(reviewResult.error, "read contest review for points");
  const review = toRow(reviewResult.data);
  if (!review) {
    return;
  }

  const sourcePrefix = `review:${safeReviewId}:`;
  const deleteResult = await supabase
    .from("contest_tester_points")
    .delete()
    .like("source_key", `${sourcePrefix}%`);
  failIfError(deleteResult.error, "reset contest tester points for review");

  if (toContestReviewStatus(review.status) !== "approved") {
    return;
  }

  const customerId = toText(review.customer_id);
  const seasonId = toText(review.season_id);
  const entryId = toText(review.entry_id);
  if (!customerId || !seasonId || !entryId) {
    return;
  }

  const [entryResult, terpeneGuessResult, voteResult] = await Promise.all([
    supabase.from("contest_entries").select("id,track,technical_sheet").eq("id", entryId).maybeSingle(),
    supabase.from("contest_review_terpene_guesses").select("terpene").eq("review_id", safeReviewId),
    supabase.from("contest_review_votes").select("id,value").eq("review_id", safeReviewId),
  ]);
  failIfError(entryResult.error, "read contest entry for points");
  failIfError(terpeneGuessResult.error, "read contest terpene guesses for points");
  failIfError(voteResult.error, "read contest votes for points");

  const entry = toRow(entryResult.data);
  if (!entry) {
    return;
  }

  await upsertContestTesterPoint({
    customerId,
    reviewId: safeReviewId,
    seasonId,
    sourceKey: `${sourcePrefix}approved`,
    reason: "review_approved",
    points: 20,
  });

  const correctTerpenes = isConcoursEntryTrack(entry.track)
    ? getDominantTerpeneCodes(sanitizeTechnicalSheet(entry.technical_sheet))
        .filter((terpene) => uniqueStrings(
          toRowArray(terpeneGuessResult.data).map((row) => normalizeContestTerpene(toText(row.terpene))),
        ).includes(terpene))
        .slice(0, 5)
    : [];

  for (const terpene of correctTerpenes) {
    await upsertContestTesterPoint({
      customerId,
      reviewId: safeReviewId,
      seasonId,
      sourceKey: `${sourcePrefix}terpene:${terpene}`,
      reason: "terpene_match",
      points: 10,
      metadata: { terpene },
    });
  }

  const qualityMark = toContestReviewQualityMark(review.quality_mark);
  if (qualityMark === "useful" || qualityMark === "excellent") {
    await upsertContestTesterPoint({
      customerId,
      reviewId: safeReviewId,
      seasonId,
      sourceKey: `${sourcePrefix}admin-quality:${qualityMark}`,
      reason: `admin_quality_${qualityMark}`,
      points: qualityMark === "excellent" ? 75 : 30,
    });
  }

  for (const vote of toRowArray(voteResult.data)) {
    const voteId = toText(vote.id);
    const value = toContestReviewVoteValue(vote.value);
    if (!voteId || value === null) {
      continue;
    }

    await upsertContestTesterPoint({
      customerId,
      reviewId: safeReviewId,
      seasonId,
      sourceKey: `${sourcePrefix}vote:${voteId}`,
      reason: value === 1 ? "review_upvote_received" : "review_downvote_received",
      points: value === 1 ? 5 : -1,
      metadata: { voteId, value },
    });
  }
}

async function syncContestTesterPointsForCustomer(customerId: string): Promise<void> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const reviewsResult = await supabase
    .from("contest_reviews")
    .select("id")
    .eq("customer_id", safeCustomerId);
  failIfError(reviewsResult.error, "read contest reviews for customer point sync");

  for (const row of toRowArray(reviewsResult.data)) {
    await syncContestTesterPointsForReview(toText(row.id));
  }
}

async function syncContestBadgeRewardsForCustomer(customerId: string): Promise<void> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return;
  }

  await syncContestTesterPointsForCustomer(safeCustomerId);

  const supabase = createSupabaseServiceClient();
  const reviewsResult = await supabase
    .from("contest_reviews")
    .select("id,entry_id,season_id,quality_mark,created_at")
    .eq("customer_id", safeCustomerId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  failIfError(reviewsResult.error, "read approved contest reviews for badges");

  const reviewRows = toRowArray(reviewsResult.data);
  const entryIds = uniqueStrings(reviewRows.map((row) => toOptionalText(row.entry_id)));
  const reviewIds = uniqueStrings(reviewRows.map((row) => toOptionalText(row.id)));

  const [entriesResult, terpeneGuessResult, voteSummaryResult, votesGivenResult, seasonRankingResult] = await Promise.all([
    entryIds.length > 0
      ? supabase.from("contest_entries").select("id,category,track,technical_sheet").in("id", entryIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length > 0
      ? supabase.from("contest_review_terpene_guesses").select("review_id,terpene").in("review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length > 0
      ? supabase.from("contest_review_vote_summary").select("review_id,upvote_count").in("review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("contest_review_votes").select("id,review_id").eq("voter_customer_id", safeCustomerId).limit(1000),
    supabase
      .from("contest_tester_rankings_by_season")
      .select("season_id,season_rank")
      .eq("customer_id", safeCustomerId)
      .lte("season_rank", 10),
  ]);
  failIfError(entriesResult.error, "read contest entries for badge rewards");
  failIfError(terpeneGuessResult.error, "read contest terpene guesses for badge rewards");
  failIfError(voteSummaryResult.error, "read contest vote summary for badge rewards");
  failIfError(votesGivenResult.error, "read contest votes given for badge rewards");
  failIfError(seasonRankingResult.error, "read contest season rankings for badge rewards");

  const entryInfoById = new Map(
    toRowArray(entriesResult.data).map((row) => {
      const entryId = toText(row.id);
      return [
        entryId,
        {
          category: toContestCategory(row.category),
          track: toContestTrack(row.track),
          technicalSheet: sanitizeTechnicalSheet(row.technical_sheet),
        },
      ];
    }),
  );

  const concoursReviewRows = reviewRows.filter((row) => {
    const entryId = toText(row.entry_id);
    const entryInfo = entryInfoById.get(entryId);
    return entryInfo?.track === "concours";
  });
  const concoursReviewIdSet = new Set(concoursReviewRows.map((row) => toText(row.id)).filter(Boolean));
  const nonConcoursReviewIds = uniqueStrings(
    reviewRows
      .filter((row) => !concoursReviewIdSet.has(toText(row.id)))
      .map((row) => toOptionalText(row.id)),
  );

  if (nonConcoursReviewIds.length > 0) {
    const deleteInvalidBadges = await supabase
      .from("contest_profile_badges")
      .delete()
      .eq("customer_id", safeCustomerId)
      .is("reward_claimed_at", null)
      .in("review_id", nonConcoursReviewIds);
    failIfError(deleteInvalidBadges.error, "delete non-concours contest badge rewards");
  }

  const guessedTerpenesByReviewId = new Map<string, string[]>();
  for (const row of toRowArray(terpeneGuessResult.data)) {
    const reviewId = toText(row.review_id);
    const terpene = normalizeContestTerpene(toText(row.terpene));
    if (!reviewId || !terpene) {
      continue;
    }
    const current = guessedTerpenesByReviewId.get(reviewId) ?? [];
    if (!current.includes(terpene)) {
      current.push(terpene);
    }
    guessedTerpenesByReviewId.set(reviewId, current);
  }

  const uniqueReviewedEntryIds = uniqueStrings(concoursReviewRows.map((row) => toOptionalText(row.entry_id)));
  const exactReviewIds: string[] = [];
  const comboReviewIds: string[] = [];
  const correctReviewIds: string[] = [];
  const seasonReviewCount = new Map<string, number>();
  const categoryReviewCount = new Map<ContestEntryCategory, number>();

  for (const row of concoursReviewRows) {
    const entryId = toText(row.entry_id);
    const reviewId = toText(row.id);
    const seasonId = toText(row.season_id);
    const entryInfo = entryInfoById.get(entryId);
    if (!reviewId || !entryInfo) {
      continue;
    }

    if (seasonId) {
      seasonReviewCount.set(seasonId, (seasonReviewCount.get(seasonId) ?? 0) + 1);
    }
    categoryReviewCount.set(entryInfo.category, (categoryReviewCount.get(entryInfo.category) ?? 0) + 1);

    const expectedTerpenes = getDominantTerpeneCodes(entryInfo.technicalSheet);
    const guessedTerpenes = guessedTerpenesByReviewId.get(reviewId) ?? [];
    const correctCount = expectedTerpenes.filter((terpene) => guessedTerpenes.includes(terpene)).length;
    if (correctCount >= 1) {
      correctReviewIds.push(reviewId);
    }
    if (correctCount >= 3) {
      comboReviewIds.push(reviewId);
    }
    if (isExactTerpeneMatch(expectedTerpenes, guessedTerpenes)) {
      exactReviewIds.push(reviewId);
    }
  }

  const upvoteCount = toRowArray(voteSummaryResult.data)
    .filter((row) => concoursReviewIdSet.has(toText(row.review_id)))
    .reduce(
      (sum, row) => sum + toInteger(row.upvote_count, 0),
      0,
    );

  const votesGivenRows = toRowArray(votesGivenResult.data);
  const votedReviewIds = uniqueStrings(votesGivenRows.map((row) => toOptionalText(row.review_id)));
  let votesGivenCount = 0;
  if (votedReviewIds.length > 0) {
    const votedReviewsResult = await supabase
      .from("contest_reviews")
      .select("id,entry_id")
      .in("id", votedReviewIds);
    failIfError(votedReviewsResult.error, "read voted contest reviews for badge rewards");

    const votedReviewRows = toRowArray(votedReviewsResult.data);
    const votedEntryIds = uniqueStrings(votedReviewRows.map((row) => toOptionalText(row.entry_id)));
    const votedEntriesResult = votedEntryIds.length > 0
      ? await supabase.from("contest_entries").select("id,track").in("id", votedEntryIds)
      : { data: [], error: null };
    failIfError(votedEntriesResult.error, "read voted contest entries for badge rewards");

    const concoursVotedEntryIds = new Set(
      toRowArray(votedEntriesResult.data)
        .filter((row) => isConcoursEntryTrack(row.track))
        .map((row) => toText(row.id))
        .filter(Boolean),
    );
    votesGivenCount = votedReviewRows.filter((row) =>
      concoursVotedEntryIds.has(toText(row.entry_id)),
    ).length;
  }

  const firstReviewId = toText(concoursReviewRows[0]?.id);
  const thirdReviewId = toText(concoursReviewRows[2]?.id);
  const tenthReviewId = toText(concoursReviewRows[9]?.id);
  const firstCorrectReviewId = correctReviewIds[0] ?? null;
  const firstComboReviewId = comboReviewIds[0] ?? null;
  const firstExactReviewId = exactReviewIds[0] ?? null;
  const thirdExactReviewId = exactReviewIds[2] ?? null;
  const firstUsefulReviewId =
    toText(concoursReviewRows.find((row) => toContestReviewQualityMark(row.quality_mark) === "useful")?.id) || null;
  const firstExcellentReviewId =
    toText(concoursReviewRows.find((row) => toContestReviewQualityMark(row.quality_mark) === "excellent")?.id) || null;

  if (uniqueReviewedEntryIds.length >= 1) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.firstNotebook,
      reviewId: firstReviewId,
    });
  }

  if (uniqueReviewedEntryIds.length >= 3) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.regularTaster,
      reviewId: thirdReviewId,
    });
  }

  if (uniqueReviewedEntryIds.length >= 10) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.marathon,
      reviewId: tenthReviewId,
    });
  }

  if (correctReviewIds.length >= 1) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.firstTrail,
      reviewId: firstCorrectReviewId,
    });
  }

  if (comboReviewIds.length >= 1) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.aromaticCombo,
      reviewId: firstComboReviewId,
    });
  }

  if (exactReviewIds.length >= 1) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.absoluteNose,
      reviewId: firstExactReviewId,
    });
  }

  if (exactReviewIds.length >= 3) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.divineNose,
      reviewId: thirdExactReviewId,
    });
  }

  if ([...seasonReviewCount.values()].some((count) => count >= 3)) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.seasonTour,
      reviewId: thirdReviewId,
    });
  }

  if ((categoryReviewCount.get("outdoor") ?? 0) >= 3) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.outdoorExpert,
      reviewId: thirdReviewId,
    });
  }

  if ((categoryReviewCount.get("greenhouse") ?? 0) >= 3) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.greenhouseExpert,
      reviewId: thirdReviewId,
    });
  }

  if ((categoryReviewCount.get("indoor") ?? 0) >= 3) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.indoorExpert,
      reviewId: thirdReviewId,
    });
  }

  if (firstUsefulReviewId) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.usefulReview,
      reviewId: firstUsefulReviewId,
    });
  }

  if (firstExcellentReviewId) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.goldenPen,
      reviewId: firstExcellentReviewId,
    });
  }

  if (upvoteCount >= 25) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.respectedVoice,
      reviewId: null,
    });
  }

  if (votesGivenCount >= 25) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.seriousValidator,
      reviewId: null,
    });
  }

  for (const row of toRowArray(seasonRankingResult.data)) {
    const seasonId = toText(row.season_id);
    if (!seasonId) {
      continue;
    }

    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: {
        id: `contest-badge-jury-saisonnier-${seasonId}`,
        code: `jury-saisonnier-${seasonId}`,
        label: "Jury Saisonnier",
        description: "Termine dans le top 10 du classement testeurs de saison.",
        icon: "crown",
        boosterPacks: 10,
        seasonId,
      },
      reviewId: null,
    });
  }
}

async function upsertContestTesterPointForReviewVote(input: {
  reviewId: string;
  reviewCustomerId: string;
  seasonId: string;
  entryId: string;
  voteId: string;
  value: ContestReviewVoteValue;
}): Promise<void> {
  const entryRow = await getContestEntryRowById(input.entryId);
  if (!entryRow || !isConcoursEntryTrack(entryRow.track)) {
    return;
  }

  await upsertContestTesterPoint({
    customerId: input.reviewCustomerId,
    reviewId: input.reviewId,
    seasonId: input.seasonId,
    sourceKey: `review:${input.reviewId}:vote:${input.voteId}`,
    reason: input.value === 1 ? "review_upvote_received" : "review_downvote_received",
    points: input.value === 1 ? 5 : -1,
    metadata: { voteId: input.voteId, value: input.value },
  });
}

async function awardContestVoteReceivedBadgeIfEligible(customerId: string): Promise<void> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_tester_rankings_global")
    .select("upvote_count")
    .eq("customer_id", safeCustomerId)
    .maybeSingle();
  failIfError(result.error, "read contest upvote count for badge reward");

  if (toInteger(toRow(result.data)?.upvote_count, 0) >= 25) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.respectedVoice,
      reviewId: null,
    });
  }
}

async function countConcoursReviewsVotedByCustomer(customerId: string): Promise<number> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return 0;
  }

  const supabase = createSupabaseServiceClient();
  const votesResult = await supabase
    .from("contest_review_votes")
    .select("review_id")
    .eq("voter_customer_id", safeCustomerId)
    .limit(1000);
  failIfError(votesResult.error, "read contest votes given for badge reward");

  const votedReviewIds = uniqueStrings(toRowArray(votesResult.data).map((row) => toOptionalText(row.review_id)));
  if (votedReviewIds.length === 0) {
    return 0;
  }

  const reviewsResult = await supabase
    .from("contest_reviews")
    .select("id,entry_id")
    .eq("status", "approved")
    .in("id", votedReviewIds);
  failIfError(reviewsResult.error, "read voted contest reviews for badge reward");

  const reviewRows = toRowArray(reviewsResult.data);
  const entryIds = uniqueStrings(reviewRows.map((row) => toOptionalText(row.entry_id)));
  if (entryIds.length === 0) {
    return 0;
  }

  const entriesResult = await supabase
    .from("contest_entries")
    .select("id")
    .eq("track", "concours")
    .in("id", entryIds);
  failIfError(entriesResult.error, "read voted contest entries for badge reward");

  const concoursEntryIds = new Set(toRowArray(entriesResult.data).map((row) => toText(row.id)).filter(Boolean));
  return reviewRows.filter((row) => concoursEntryIds.has(toText(row.entry_id))).length;
}

async function awardContestVotesGivenBadgeIfEligible(customerId: string): Promise<void> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return;
  }

  const votesGivenCount = await countConcoursReviewsVotedByCustomer(safeCustomerId);
  if (votesGivenCount >= 25) {
    await awardContestBadgeReward({
      customerId: safeCustomerId,
      badge: CONTEST_BADGE_REWARDS.seriousValidator,
      reviewId: null,
    });
  }
}

async function ensureUniqueContestEntrySlug(candidateSlug: string, ignoreEntryId?: string): Promise<string> {
  const baseSlug = slugifyContestText(candidateSlug);
  if (!baseSlug) {
    throw new Error("Slug de lot invalide.");
  }

  const supabase = createSupabaseServiceClient();
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    const result = await supabase
      .from("contest_entries")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    failIfError(result.error, "check unique contest entry slug");
    const existingId = toOptionalText(toRow(result.data)?.id);
    if (!existingId || existingId === ignoreEntryId) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function loadProductForContestEntry(productId: string): Promise<ContestLinkedProduct & { producerId?: string }> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("products")
    .select("id,name,price,image,category,analysis_pdf,producer_id")
    .eq("id", productId)
    .maybeSingle();

  failIfError(result.error, "read product for contest entry");
  const row = toRow(result.data);
  if (!row) {
    throw new Error("Produit introuvable pour ce lot premium.");
  }

  return {
    id: toText(row.id),
    name: toText(row.name),
    price: toMoney(row.price, 0),
    image: toText(row.image),
    category: toOptionalText(row.category),
    analysisPdf: toOptionalText(row.analysis_pdf),
    producerId: toOptionalText(row.producer_id),
  };
}

async function ensureContestSeasonExists(seasonId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_seasons")
    .select("id")
    .eq("id", seasonId)
    .maybeSingle();

  failIfError(result.error, "read contest season for entry");
  if (!result.data) {
    throw new Error("Saison de recolte introuvable.");
  }
}

function getShopFlowerImage(product: ContestShopFlowerRow): string {
  return toOptionalText(product.image) ?? toStringArray(product.images)[0] ?? "/product_flower.jpg";
}

function buildShopFlowerTechnicalSheet(product: ContestShopFlowerRow): ContestEntry["technicalSheet"] {
  return {
    variety: toOptionalText(product.name) ?? toText(product.id),
  };
}

async function ensureRegularContestEntriesForShopFlowers(season: ContestSeason | null): Promise<void> {
  if (!season) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const productsResult = await supabase
    .from("products")
    .select([
      "id",
      "name",
      "category",
      "culture_type",
      "image",
      "images",
      "producer_id",
      "description",
      "track_stock",
      "stock_quantity",
      "variant_options",
      "position",
    ].join(","))
    .eq("category", "fleurs")
    .order("position", { ascending: true });

  failIfError(productsResult.error, "read shop flowers for regular contest sync");

  const flowersForSale = toRowArray(productsResult.data).filter((product) => isShopFlowerForSale(product));
  if (flowersForSale.length === 0) {
    return;
  }

  const productIds = uniqueStrings(flowersForSale.map((product) => toOptionalText(product.id)));
  if (productIds.length === 0) {
    return;
  }

  const existingResult = await supabase
    .from("contest_entries")
    .select("id,product_id,is_published")
    .eq("season_id", season.id)
    .eq("track", "regular")
    .in("product_id", productIds);

  failIfError(existingResult.error, "read existing regular contest entries for shop flowers");

  const existingRows = toRowArray(existingResult.data);
  const existingProductIds = new Set(existingRows.map((row) => toText(row.product_id)).filter(Boolean));
  const unpublishedEntryIds = uniqueStrings(
    existingRows
      .filter((row) => row.is_published !== true)
      .map((row) => toOptionalText(row.id)),
  );

  if (unpublishedEntryIds.length > 0) {
    const publishResult = await supabase
      .from("contest_entries")
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .in("id", unpublishedEntryIds);
    failIfError(publishResult.error, "publish regular contest entries for shop flowers");
  }

  const rowsToInsert: ContestEntryRow[] = [];
  for (const product of flowersForSale) {
    const productId = toText(product.id);
    if (!productId || existingProductIds.has(productId)) {
      continue;
    }

    const title = (toOptionalText(product.name) ?? productId).slice(0, 160);
    const imageUrl = getShopFlowerImage(product);
    const galleryUrls = uniqueStrings([imageUrl, ...toStringArray(product.images)]);
    const productSlug = slugifyContestText(productId || title);
    const seasonSlug = slugifyContestText(season.code || season.id);
    const slug = await ensureUniqueContestEntrySlug(`regular-${seasonSlug}-${productSlug || title}`);
    const id = `contest-entry-regular-${seasonSlug || slugifyContestText(season.id)}-${productSlug || slug}`;

    rowsToInsert.push({
      id,
      slug,
      title: title.length >= 3 ? title : `Fleur ${productId}`.slice(0, 160),
      product_id: productId,
      producer_id: toOptionalText(product.producer_id) ?? null,
      season_id: season.id,
      category: normalizeCategory(toOptionalText(product.culture_type)) ?? "outdoor",
      track: "regular",
      story: sanitizeStory(toOptionalText(product.description)),
      technical_sheet: buildShopFlowerTechnicalSheet(product),
      image_url: imageUrl,
      gallery_urls: galleryUrls,
      is_published: true,
      position: toInteger(product.position, rowsToInsert.length),
    });
  }

  if (rowsToInsert.length === 0) {
    return;
  }

  const insertResult = await supabase
    .from("contest_entries")
    .upsert(rowsToInsert, { onConflict: "id" });
  failIfError(insertResult.error, "sync regular contest entries for shop flowers");
}

export function parseContestReviewStatus(value: string | null): ContestReviewStatus | undefined {
  return normalizeReviewStatus(value ?? undefined);
}

export async function getContestSeasons(): Promise<ContestSeason[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_seasons")
    .select(SELECT_SEASON_COLUMNS)
    .order("is_active", { ascending: false })
    .order("is_archived", { ascending: true })
    .order("year", { ascending: false })
    .order("harvest_end", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  failIfError(result.error, "read contest seasons");
  return toRowArray(result.data).map((row) => mapSeasonRow(row));
}

export async function resolveContestSeason(code?: string): Promise<ContestSeason | null> {
  const normalizedCode = normalizeSeasonCode(code);
  if (normalizedCode) {
    return getContestSeasonByCode(normalizedCode);
  }

  const seasons = await getContestSeasons();
  return seasons.find((season) => season.isActive && !season.isArchived) ?? seasons[0] ?? null;
}

export async function getPublicContestEntries(input: {
  seasonCode?: string;
  category?: string;
  track?: string;
} = {}): Promise<{ entries: ContestEntrySummary[]; selectedSeason: ContestSeason | null }> {
  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const category = normalizeCategory(input.category);
  const track = normalizeTrack(input.track);

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .eq("is_published", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (selectedSeason) {
    query = query.eq("season_id", selectedSeason.id);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (track) {
    query = query.eq("track", track);
  }

  const result = await query;
  failIfError(result.error, "read public contest entries");

  return {
    entries: await hydrateEntries(toRowArray(result.data)),
    selectedSeason,
  };
}

export async function getAdminContestEntries(
  input: ContestAdminPaginationInput = {},
): Promise<ContestAdminPaginatedResult<ContestEntrySummary>> {
  await ensureRegularContestEntriesForShopFlowers(await resolveContestSeason());

  const pagination = normalizeAdminContestPagination(input);
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS, { count: "exact" })
    .order("is_published", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  failIfError(result.error, "read admin contest entries");
  const entries = await hydrateEntries(toRowArray(result.data));
  return buildAdminContestPaginatedResult(entries, result.count, pagination);
}

export async function getContestProductTastingSummary(
  productId: string,
): Promise<ContestProductTastingSummary | null> {
  const safeProductId = productId.trim();
  if (!safeProductId) {
    return null;
  }

  const [summary] = await getContestProductTastingSummaries([safeProductId], 6);
  return summary ?? null;
}

export async function getContestProductTastingSummaries(
  productIds: string[],
  reviewLimitPerProduct = 2,
): Promise<ContestProductTastingSummary[]> {
  const entries = await getContestProductTastingEntries(productIds);
  if (entries.length === 0) {
    return [];
  }

  const safeReviewLimit = Math.max(0, Math.min(6, Math.floor(reviewLimitPerProduct)));
  if (safeReviewLimit === 0) {
    return entries.map((entry) => ({ entry, reviews: [] }));
  }

  const supabase = createSupabaseServiceClient();
  const reviewsResult = await supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS)
    .in("entry_id", entries.map((entry) => entry.id))
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  failIfError(reviewsResult.error, "read approved contest reviews by products");
  const reviews = await hydrateReviews(toRowArray(reviewsResult.data), {
    includeEntry: true,
    includeSeason: true,
  });
  const reviewsByEntryId = new Map<string, ContestReview[]>();

  for (const review of reviews) {
    const entryReviews = reviewsByEntryId.get(review.entryId) ?? [];
    if (entryReviews.length < safeReviewLimit) {
      entryReviews.push(review);
      reviewsByEntryId.set(review.entryId, entryReviews);
    }
  }

  return entries.map((entry) => ({
    entry,
    reviews: reviewsByEntryId.get(entry.id) ?? [],
  }));
}

export async function getContestProductTastingEntries(
  productIds: string[],
): Promise<ContestEntrySummary[]> {
  const safeProductIds = uniqueStrings(productIds);
  if (safeProductIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const entriesResult = await supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .in("product_id", safeProductIds)
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(1000);

  failIfError(entriesResult.error, "read public contest entries by products");
  const entries = await hydrateEntries(toRowArray(entriesResult.data));
  const entriesByProductId = new Map<string, ContestEntrySummary[]>();

  for (const entry of entries) {
    const productEntries = entriesByProductId.get(entry.productId) ?? [];
    productEntries.push(entry);
    entriesByProductId.set(entry.productId, productEntries);
  }

  return safeProductIds.flatMap((productId) => {
    const entry = selectContestProductTastingEntry(entriesByProductId.get(productId) ?? []);
    return entry ? [entry] : [];
  });
}

export async function getContestEntryDetailBySlug(
  slug: string,
  customerId?: string,
  customerEmail?: string,
): Promise<ContestEntryDetail | null> {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .eq("slug", safeSlug)
    .eq("is_published", true)
    .maybeSingle();

  failIfError(result.error, "read public contest entry by slug");
  const row = toRow(result.data);
  if (!row) {
    return null;
  }

  const [entry] = await hydrateEntries([row]);
  if (!entry) {
    return null;
  }

  const approvedReviewsResult = await supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS)
    .eq("entry_id", entry.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(40);

  failIfError(approvedReviewsResult.error, "read approved contest reviews by entry");
  const reviews = (await hydrateReviews(toRowArray(approvedReviewsResult.data), {
    includeEntry: true,
    includeSeason: true,
    viewerCustomerId: customerId,
  })).sort(compareReviewValidationOrder);

  const viewerProfile = customerId ? await getContestProfile(customerId) : null;
  const viewerReviewRow = customerId
    ? await getContestReviewRowByEntryAndCustomer(entry.id, customerId)
    : null;
  const viewerReview = viewerReviewRow
    ? (await hydrateReviews([viewerReviewRow], { includeEntry: true, includeSeason: true, viewerCustomerId: customerId }))[0] ?? null
    : null;
  const viewerBadges = customerId ? await getContestProfileBadges(customerId, { syncRewards: false }) : [];
  const eligibility =
    viewerReview
      ? { eligible: false, reason: "already_reviewed" as const }
      : await buildEligibility(entry, customerId, customerEmail);

  return {
    entry,
    reviews,
    viewerProfile,
    viewerReview,
    viewerBadges,
    eligibility,
  };
}

export async function getContestProfileBadges(
  customerId: string,
  options: { syncRewards?: boolean } = {},
): Promise<ContestProfileBadge[]> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return [];
  }

  if (options.syncRewards === true) {
    await syncContestBadgeRewardsForCustomer(safeCustomerId);
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_profile_badges")
    .select("id,customer_id,badge_id,review_id,awarded_at,reward_pack_count,reward_claimed_at,contest_badges(id,code,label,description,icon,season_id,is_active,created_at)")
    .eq("customer_id", safeCustomerId)
    .order("awarded_at", { ascending: false });

  failIfError(result.error, "read contest profile badges");
  return toRowArray(result.data).map((row) => mapContestProfileBadgeRow(row));
}

export async function claimContestBadgeReward(input: {
  customerId: string;
  badgeId: string;
}): Promise<{ badgeId: string; grantedPacks: number }> {
  const safeCustomerId = input.customerId.trim();
  const requestedBadge = input.badgeId.trim();

  if (!safeCustomerId || !requestedBadge) {
    throw new Error("Badge concours invalide.");
  }

  await syncContestBadgeRewardsForCustomer(safeCustomerId);

  const supabase = createSupabaseServiceClient();
  const badgeResult = await supabase
    .from("contest_badges")
    .select("id,code")
    .or(`id.eq.${requestedBadge},code.eq.${requestedBadge}`)
    .maybeSingle();
  failIfError(badgeResult.error, "read contest badge before claim");
  const badge = toRow(badgeResult.data);
  const badgeId = toText(badge?.id);
  if (!badgeId) {
    throw new Error("Badge concours invalide.");
  }

  const profileBadgeResult = await supabase
    .from("contest_profile_badges")
    .select("review_id")
    .eq("customer_id", safeCustomerId)
    .eq("badge_id", badgeId)
    .maybeSingle();
  failIfError(profileBadgeResult.error, "read contest profile badge before claim");

  const profileBadgeReviewId = toOptionalText(toRow(profileBadgeResult.data)?.review_id);
  if (profileBadgeReviewId) {
    const reviewResult = await supabase
      .from("contest_reviews")
      .select("entry_id")
      .eq("id", profileBadgeReviewId)
      .maybeSingle();
    failIfError(reviewResult.error, "read contest badge review before claim");

    const badgeEntryId = toText(toRow(reviewResult.data)?.entry_id);
    const badgeEntryRow = badgeEntryId ? await getContestEntryRowById(badgeEntryId) : null;
    if (!badgeEntryRow || !isConcoursEntryTrack(badgeEntryRow.track)) {
      throw new Error("Ce badge ne donne des boosters que sur une variete concours.");
    }
  }

  const result = await supabase.rpc("rpc_claim_contest_badge_reward", {
    p_customer_id: safeCustomerId,
    p_badge_id: badgeId,
  });

  if (result.error) {
    const message = result.error.message || "Recompense impossible a reclamer.";
    if (message.includes("badge_not_unlocked")) {
      throw new Error("Ce badge n'est pas encore debloque.");
    }
    if (message.includes("reward_already_claimed")) {
      throw new Error("Cette recompense a deja ete reclamee.");
    }
    if (message.includes("reward_not_claimable")) {
      throw new Error("Ce badge ne donne pas de recompense a reclamer.");
    }
    if (message.includes("customer_not_found")) {
      throw new Error("Client introuvable.");
    }
    throw new Error(`[supabase:rpc_claim_contest_badge_reward] ${message}`);
  }

  return {
    badgeId,
    grantedPacks: Math.max(0, toInteger(result.data, 0)),
  };
}

export async function getContestProfile(customerId: string): Promise<ContestProfile | null> {
  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_profiles")
    .select("customer_id,pseudo,created_at,updated_at")
    .eq("customer_id", safeCustomerId)
    .maybeSingle();

  failIfError(result.error, "read contest profile");
  const row = toRow(result.data);
  return row ? mapProfileRow(row) : null;
}

export async function getContestReviewForCustomer(
  entryId: string,
  customerId: string,
): Promise<ContestReview | null> {
  const reviewRow = await getContestReviewRowByEntryAndCustomer(entryId.trim(), customerId.trim());
  if (!reviewRow) {
    return null;
  }

  const hydrated = await hydrateReviews([reviewRow], {
    includeEntry: true,
    includeSeason: true,
    viewerCustomerId: customerId,
  });
  return hydrated[0] ?? null;
}

async function getPurchasedContestNotebookUnlocks(input: {
  productUnlockDates: Map<string, string>;
  selectedSeason: ContestSeason | null;
}): Promise<ContestNotebookUnlock[]> {
  const productIds = [...input.productUnlockDates.keys()];
  if (productIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .eq("is_published", true)
    .in("product_id", productIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (input.selectedSeason) {
    query = query.eq("season_id", input.selectedSeason.id);
  }

  const result = await query;
  failIfError(result.error, "read purchased contest notebook unlocks");

  return toRowArray(result.data).map((row) => {
    const entry = mapEntryRow(row);
    return {
      entryId: entry.id,
      reviewId: null,
      status: null,
      unlockedAt: input.productUnlockDates.get(entry.productId) ?? entry.updatedAt,
      source: "purchase",
    };
  });
}

export async function getContestNotebookUnlocks(input: {
  customerId?: string | null;
  customerEmail?: string;
  seasonCode?: string;
}): Promise<ContestNotebookUnlock[]> {
  const safeCustomerId = input.customerId?.trim();
  if (!safeCustomerId) {
    return [];
  }

  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const supabase = createSupabaseServiceClient();
  const purchasedProductUnlockDates = await getPurchasedContestProductUnlockDates(
    safeCustomerId,
    input.customerEmail,
  );
  const purchasedProductIds = [...purchasedProductUnlockDates.keys()];

  let query = supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS)
    .eq("customer_id", safeCustomerId)
    .order("created_at", { ascending: false });

  if (selectedSeason) {
    query = query.eq("season_id", selectedSeason.id);
  }

  const purchasedUnlocksPromise =
    purchasedProductIds.length > 0
      ? getPurchasedContestNotebookUnlocks({
          productUnlockDates: purchasedProductUnlockDates,
          selectedSeason,
        })
      : Promise.resolve([] as ContestNotebookUnlock[]);

  const [result, purchasedUnlocks] = await Promise.all([query, purchasedUnlocksPromise]);
  failIfError(result.error, "read contest notebook unlocks");

  const reviews = await hydrateReviews(toRowArray(result.data), {
    includeEntry: false,
    includeSeason: false,
    viewerCustomerId: safeCustomerId,
  });

  const unlockByEntryId = new Map<string, ContestNotebookUnlock>(
    purchasedUnlocks.map((unlock) => [unlock.entryId, unlock]),
  );

  for (const review of reviews) {
    unlockByEntryId.set(review.entryId, {
      entryId: review.entryId,
      reviewId: review.id,
      status: review.status,
      unlockedAt: review.createdAt,
      review,
      source: "review",
    });
  }

  return [...unlockByEntryId.values()].sort((a, b) => {
    const bTime = Date.parse(b.unlockedAt);
    const aTime = Date.parse(a.unlockedAt);
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return a.entryId.localeCompare(b.entryId);
  });
}

export async function upsertContestProfile(input: {
  customerId: string;
  pseudo: string;
}): Promise<ContestProfile> {
  const pseudo = sanitizePseudo(input.pseudo);
  const safeCustomerId = input.customerId.trim();
  if (!safeCustomerId) {
    throw new Error("Compte client introuvable.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_profiles")
    .upsert(
      {
        customer_id: safeCustomerId,
        pseudo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    )
    .select("customer_id,pseudo,created_at,updated_at")
    .single();

  if (result.error) {
    if (result.error.code === "23505" || result.error.message.toLowerCase().includes("pseudo")) {
      throw new Error("Ce pseudo est deja utilise.");
    }
    throw new Error(`[supabase:upsert contest profile] ${result.error.message}`);
  }

  const row = toRow(result.data);
  if (!row) {
    throw new Error("Profil degustateur introuvable apres enregistrement.");
  }

  return mapProfileRow(row);
}

export async function submitContestReview(input: {
  customerId: string;
  customerEmail?: string;
  payload: ContestReviewSubmissionInput;
}): Promise<ContestReview> {
  const safeCustomerId = input.customerId.trim();
  if (!safeCustomerId) {
    throw new Error("Compte client introuvable.");
  }

  const safeEntryId = input.payload.entryId.trim();
  if (!safeEntryId) {
    throw new Error("Lot premium introuvable.");
  }

  const entryRow = await getContestEntryRowById(safeEntryId);
  if (!entryRow) {
    throw new Error("Lot premium introuvable.");
  }

  const entry = mapEntryRow(entryRow);
  if (!entry.isPublished) {
    throw new Error("Ce lot premium n'est pas disponible.");
  }

  const profile = await getContestProfile(safeCustomerId);
  if (!profile) {
    throw new Error("Pseudo degustateur requis avant de publier un avis.");
  }

  const existingReview = await getContestReviewRowByEntryAndCustomer(entry.id, safeCustomerId);
  if (existingReview) {
    throw new Error("Un avis existe deja pour ce lot.");
  }

  const hasPurchased = await hasCustomerPurchasedContestProduct(
    safeCustomerId,
    entry.productId,
    input.customerEmail,
  );
  if (!hasPurchased) {
    throw new Error("Achat requis pour noter ce lot.");
  }

  const scores = sanitizeScoreMap(input.payload.scores);
  const aromaTags = sanitizeAromaSelections(Array.isArray(input.payload.aromaTags) ? input.payload.aromaTags : []);
  const terpeneGuesses = isConcoursEntryTrack(entry.track)
    ? sanitizeTerpeneGuesses(input.payload.terpeneGuesses)
    : [];
  const comment = sanitizeComment(input.payload.comment);
  const consumptionMethod = toContestConsumptionMethod(input.payload.consumptionMethod);
  const consumptionDetails = sanitizeConsumptionDetails(input.payload.consumptionDetails);

  const supabase = createSupabaseServiceClient();
  const atomicInsert = await supabase.rpc("rpc_create_contest_review_atomic", {
    p_entry_id: entry.id,
    p_season_id: entry.seasonId,
    p_customer_id: safeCustomerId,
    p_pseudo_snapshot: profile.pseudo,
    p_consumption_method: consumptionMethod,
    p_consumption_details: consumptionDetails,
    p_comment: comment,
    p_scores: scores,
    p_aroma_tags: aromaTags,
    p_terpene_guesses: terpeneGuesses,
  });
  failIfError(atomicInsert.error, "create contest review atomically");
  const reviewId = toText(atomicInsert.data);
  const reviewRow = await getContestReviewRowByEntryAndCustomer(entry.id, safeCustomerId);
  if (!reviewId || !reviewRow || toText(reviewRow.id) !== reviewId) {
    throw new Error("Avis introuvable apres creation.");
  }

  const hydrated = await hydrateReviews([reviewRow], {
    includeEntry: true,
    includeSeason: true,
    viewerCustomerId: safeCustomerId,
  });
  const createdReview = hydrated[0];
  if (!createdReview) {
    throw new Error("Avis introuvable apres hydratation.");
  }

  return createdReview;
}

export async function updateContestReview(input: {
  customerId: string;
  customerEmail?: string;
  payload: ContestReviewSubmissionInput;
}): Promise<ContestReview> {
  const safeCustomerId = input.customerId.trim();
  if (!safeCustomerId) {
    throw new Error("Compte client introuvable.");
  }

  const safeEntryId = input.payload.entryId.trim();
  if (!safeEntryId) {
    throw new Error("Lot premium introuvable.");
  }

  const entryRow = await getContestEntryRowById(safeEntryId);
  if (!entryRow) {
    throw new Error("Lot premium introuvable.");
  }

  const entry = mapEntryRow(entryRow);
  if (!entry.isPublished) {
    throw new Error("Ce lot premium n'est pas disponible.");
  }

  const profile = await getContestProfile(safeCustomerId);
  if (!profile) {
    throw new Error("Pseudo degustateur requis avant de modifier un avis.");
  }

  const existingReview = await getContestReviewRowByEntryAndCustomer(entry.id, safeCustomerId);
  if (!existingReview) {
    throw new Error("Aucun avis a modifier pour ce lot.");
  }

  if (toContestReviewStatus(existingReview.status) !== "pending") {
    throw new Error("Seuls les avis encore en attente de moderation peuvent etre modifies.");
  }

  const hasPurchased = await hasCustomerPurchasedContestProduct(
    safeCustomerId,
    entry.productId,
    input.customerEmail,
  );
  if (!hasPurchased) {
    throw new Error("Achat requis pour modifier ce lot.");
  }

  const scores = sanitizeScoreMap(input.payload.scores);
  const aromaTags = sanitizeAromaSelections(Array.isArray(input.payload.aromaTags) ? input.payload.aromaTags : []);
  const terpeneGuesses = isConcoursEntryTrack(entry.track)
    ? sanitizeTerpeneGuesses(input.payload.terpeneGuesses)
    : [];
  const comment = sanitizeComment(input.payload.comment);
  const consumptionMethod = toContestConsumptionMethod(input.payload.consumptionMethod);
  const consumptionDetails = sanitizeConsumptionDetails(input.payload.consumptionDetails);
  const reviewId = toText(existingReview.id);
  const supabase = createSupabaseServiceClient();

  const atomicUpdate = await supabase.rpc("rpc_update_contest_review_atomic", {
    p_review_id: reviewId,
    p_customer_id: safeCustomerId,
    p_pseudo_snapshot: profile.pseudo,
    p_consumption_method: consumptionMethod,
    p_consumption_details: consumptionDetails,
    p_comment: comment,
    p_scores: scores,
    p_aroma_tags: aromaTags,
    p_terpene_guesses: terpeneGuesses,
  });
  failIfError(atomicUpdate.error, "update contest review atomically");
  const reviewRow = await getContestReviewRowByEntryAndCustomer(entry.id, safeCustomerId);
  if (!reviewRow || toText(atomicUpdate.data) !== reviewId) {
    throw new Error("Avis introuvable apres modification.");
  }

  const hydrated = await hydrateReviews([reviewRow], {
    includeEntry: true,
    includeSeason: true,
    viewerCustomerId: safeCustomerId,
  });
  const updatedReview = hydrated[0];
  if (!updatedReview) {
    throw new Error("Avis introuvable apres hydratation.");
  }

  return updatedReview;
}

export async function voteContestReview(input: {
  reviewId: string;
  voterCustomerId: string;
  voterEmail?: string;
  value: ContestReviewVoteValue;
}): Promise<{ reviewId: string; voteSummary: ContestReviewVoteSummary }> {
  const safeReviewId = input.reviewId.trim();
  const safeVoterCustomerId = input.voterCustomerId.trim();
  const value = toContestReviewVoteValue(input.value);
  if (!safeReviewId || !safeVoterCustomerId || value === null) {
    throw new Error("Vote invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const reviewResult = await supabase
    .from("contest_reviews")
    .select("id,customer_id,status,entry_id,season_id")
    .eq("id", safeReviewId)
    .maybeSingle();
  failIfError(reviewResult.error, "read contest review before vote");

  const review = toRow(reviewResult.data);
  if (!review) {
    throw new Error("Critique introuvable.");
  }
  if (toContestReviewStatus(review.status) !== "approved") {
    throw new Error("Seules les critiques approuvees peuvent etre validees par vote.");
  }

  const reviewCustomerId = toText(review.customer_id);
  if (reviewCustomerId === safeVoterCustomerId) {
    throw new Error("Impossible de voter sur sa propre critique.");
  }
  const reviewEntryId = toText(review.entry_id);
  const reviewSeasonId = toText(review.season_id);

  const hasPurchased = await hasCustomerPurchasedAnyProduct(safeVoterCustomerId, input.voterEmail);
  if (!hasPurchased) {
    throw new Error("Vote reserve aux clients ayant deja achete.");
  }

  const voteResult = await supabase
    .from("contest_review_votes")
    .upsert(
      {
        review_id: safeReviewId,
        voter_customer_id: safeVoterCustomerId,
        value,
      },
      { onConflict: "review_id,voter_customer_id" },
    )
    .select("id,value")
    .single();

  if (voteResult.error) {
    const message = voteResult.error.message || "Vote impossible.";
    if (message.includes("contest_review_vote_own_review")) {
      throw new Error("Impossible de voter sur sa propre critique.");
    }
    if (message.includes("contest_review_vote_purchase_required")) {
      throw new Error("Vote reserve aux clients ayant deja achete.");
    }
    if (message.includes("contest_review_vote_review_not_approved")) {
      throw new Error("Seules les critiques approuvees peuvent etre validees par vote.");
    }
    throw new Error(`[supabase:vote contest review] ${message}`);
  }

  const vote = toRow(voteResult.data);
  const voteId = toText(vote?.id);
  if (voteId && reviewCustomerId && reviewEntryId && reviewSeasonId) {
    await upsertContestTesterPointForReviewVote({
      reviewId: safeReviewId,
      reviewCustomerId,
      seasonId: reviewSeasonId,
      entryId: reviewEntryId,
      voteId,
      value,
    });
  }
  await awardContestVoteReceivedBadgeIfEligible(reviewCustomerId);
  await awardContestVotesGivenBadgeIfEligible(safeVoterCustomerId);

  const summaryResult = await supabase
    .from("contest_review_vote_summary")
    .select("review_id,upvote_count,downvote_count,net_vote_score,is_contested")
    .eq("review_id", safeReviewId)
    .maybeSingle();
  failIfError(summaryResult.error, "read contest review vote summary after vote");

  const summary = toRow(summaryResult.data);
  return {
    reviewId: safeReviewId,
    voteSummary: {
      upvoteCount: toInteger(summary?.upvote_count, 0),
      downvoteCount: toInteger(summary?.downvote_count, 0),
      netVoteScore: toInteger(summary?.net_vote_score, 0),
      isContested: toBoolean(summary?.is_contested),
      viewerVote: value,
    },
  };
}

export async function getContestFeed(input: {
  seasonCode?: string;
  category?: string;
  track?: string;
  limit?: number;
  viewerCustomerId?: string;
} = {}): Promise<{ items: ContestFeedItem[]; selectedSeason: ContestSeason | null }> {
  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const category = normalizeCategory(input.category);
  const track = normalizeTrack(input.track);

  const limit = normalizeContestPublicLimit(input.limit, 12, 30);
  const supabase = createSupabaseServiceClient();

  let entryQuery = supabase
    .from("contest_entries")
    .select("id")
    .eq("is_published", true);

  if (selectedSeason) {
    entryQuery = entryQuery.eq("season_id", selectedSeason.id);
  }
  if (category) {
    entryQuery = entryQuery.eq("category", category);
  }
  if (track) {
    entryQuery = entryQuery.eq("track", track);
  }

  const entryResult = await entryQuery;
  failIfError(entryResult.error, "read contest feed entries");
  const entryIds = uniqueStrings(
    toRowArray(entryResult.data).map((row) => toOptionalText(row.id)),
  );

  if (entryIds.length === 0) {
    return { items: [], selectedSeason };
  }

  const reviewResult = await supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS)
    .in("entry_id", entryIds)
    .eq("status", "approved")
    .neq("comment", "")
    .order("reviewed_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit * 2, limit), 40));

  failIfError(reviewResult.error, "read contest feed reviews");
  const hydrated = await hydrateReviews(toRowArray(reviewResult.data), {
    includeEntry: true,
    includeSeason: true,
    viewerCustomerId: input.viewerCustomerId,
  });

  const items = hydrated
    .sort(compareReviewValidationOrder)
    .filter((review) => review.comment.trim().length > 0 && review.entrySlug && review.entryTitle && review.seasonCode && review.seasonLabel && review.category)
    .map((review) => ({
      reviewId: review.id,
      entryId: review.entryId,
      entrySlug: review.entrySlug!,
      entryTitle: review.entryTitle!,
      entryImageUrl: review.entryImageUrl,
      seasonCode: review.seasonCode!,
      seasonLabel: review.seasonLabel!,
      category: review.category!,
      track: review.track,
      pseudo: review.pseudo,
      comment: review.comment,
      excerpt: review.comment.length > 180 ? `${review.comment.slice(0, 177)}...` : review.comment,
      consumptionMethod: review.consumptionMethod,
      scores: review.scores,
      aromaTags: review.aromaTags,
      voteSummary: review.voteSummary,
      createdAt: review.createdAt,
      validatedAt: review.reviewedAt ?? review.createdAt,
    }))
    .slice(0, limit);

  return { items, selectedSeason };
}

export async function getContestRankings(input: {
  seasonCode?: string;
  category?: string;
  track?: string;
  limit?: number;
} = {}): Promise<{ entries: ContestEntrySummary[]; selectedSeason: ContestSeason | null }> {
  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const category = normalizeCategory(input.category);
  const track = normalizeTrack(input.track);

  const limit = normalizeContestPublicLimit(input.limit, 20, 50);
  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("contest_rankings_current")
    .select("*")
    .eq("is_rank_eligible", true)
    .limit(limit);

  if (selectedSeason) {
    query = query.eq("season_id", selectedSeason.id);
  }
  if (category) {
    query = query.eq("category", category);
    query = query.order("season_category_rank", { ascending: true });
  } else {
    query = query.order("season_rank_overall", { ascending: true });
  }
  if (track) {
    query = query.eq("track", track);
  }

  const rankingResult = await query;
  failIfError(rankingResult.error, "read contest rankings");
  const rankingRows = toRowArray(rankingResult.data);
  const entryIds = uniqueStrings(rankingRows.map((row) => toOptionalText(row.entry_id)));

  if (entryIds.length === 0) {
    return { entries: [], selectedSeason };
  }

  const entriesResult = await supabase
    .from("contest_entries")
    .select(SELECT_ENTRY_COLUMNS)
    .in("id", entryIds);

  failIfError(entriesResult.error, "read ranked contest entries");
  const entries = await hydrateEntries(toRowArray(entriesResult.data));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  const orderedEntries = rankingRows
    .map((row) => entryById.get(toText(row.entry_id)))
    .filter((entry): entry is ContestEntrySummary => Boolean(entry));

  return {
    entries: orderedEntries,
    selectedSeason,
  };
}

export async function getContestTesterRankings(input: {
  scope?: ContestTesterRankingScope;
  seasonCode?: string;
  limit?: number;
} = {}): Promise<{
  items: ContestTesterRankingItem[];
  scope: ContestTesterRankingScope;
  selectedSeason: ContestSeason | null;
}> {
  const scope: ContestTesterRankingScope = input.scope === "global" ? "global" : "season";
  const selectedSeason = scope === "season" ? await resolveContestSeason(input.seasonCode) : null;
  const limit = normalizeContestPublicLimit(input.limit, 20, 100);
  const supabase = createSupabaseServiceClient();

  if (scope === "global") {
    const result = await supabase
      .from("contest_tester_rankings_global")
      .select("*")
      .order("global_rank", { ascending: true })
      .limit(limit);
    failIfError(result.error, "read global contest tester rankings");
    return {
      items: toRowArray(result.data).map((row) => mapTesterRankingRow(row, "global")),
      scope,
      selectedSeason,
    };
  }

  let query = supabase
    .from("contest_tester_rankings_by_season")
    .select("*")
    .order("season_rank", { ascending: true })
    .limit(limit);

  if (selectedSeason) {
    query = query.eq("season_id", selectedSeason.id);
  }

  const result = await query;
  failIfError(result.error, "read season contest tester rankings");
  return {
    items: toRowArray(result.data).map((row) => mapTesterRankingRow(row, "season")),
    scope,
    selectedSeason,
  };
}

export async function getContestTesterProgress(input: {
  customerId: string;
  seasonCode?: string;
}): Promise<ContestTesterProgress | null> {
  const safeCustomerId = input.customerId.trim();
  if (!safeCustomerId) {
    return null;
  }

  const profile = await getContestProfile(safeCustomerId);
  if (!profile) {
    return null;
  }

  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const supabase = createSupabaseServiceClient();
  const [globalResult, seasonResult] = await Promise.all([
    supabase
      .from("contest_tester_rankings_global")
      .select("*")
      .eq("customer_id", safeCustomerId)
      .maybeSingle(),
    selectedSeason
      ? supabase
          .from("contest_tester_rankings_by_season")
          .select("*")
          .eq("customer_id", safeCustomerId)
          .eq("season_id", selectedSeason.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  failIfError(globalResult.error, "read contest tester global progress");
  failIfError(seasonResult.error as { message: string } | null, "read contest tester season progress");

  const globalRow = toRow(globalResult.data);
  const seasonRow = toRow(seasonResult.data);
  return buildContestTesterProgress({
    customerId: profile.customerId,
    pseudo: profile.pseudo,
    totalPoints: toInteger(globalRow?.total_points, 0),
    globalRank: toInteger(globalRow?.global_rank, 0) || null,
    seasonRank: toInteger(seasonRow?.season_rank, 0) || null,
    selectedSeason,
  });
}

export async function getPublicContestTesterProfile(input: {
  pseudo: string;
  seasonCode?: string;
  limit?: number;
}): Promise<ContestPublicTesterProfile | null> {
  const safePseudo = input.pseudo.trim().slice(0, 24);
  if (!safePseudo) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const profileResult = await supabase
    .from("contest_profiles")
    .select("customer_id,pseudo,created_at,updated_at")
    .ilike("pseudo", safePseudo)
    .maybeSingle();
  failIfError(profileResult.error, "read public contest tester profile");

  const profileRow = toRow(profileResult.data);
  if (!profileRow) {
    return null;
  }

  const profile = mapProfileRow(profileRow);

  const selectedSeason = await resolveContestSeason(input.seasonCode);
  const limit = normalizeContestPublicLimit(input.limit, 20, 50);
  const [globalResult, seasonResult, badges, reviewResult] = await Promise.all([
    supabase
      .from("contest_tester_rankings_global")
      .select("*")
      .eq("customer_id", profile.customerId)
      .maybeSingle(),
    selectedSeason
      ? supabase
          .from("contest_tester_rankings_by_season")
          .select("*")
          .eq("customer_id", profile.customerId)
          .eq("season_id", selectedSeason.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getContestProfileBadges(profile.customerId, { syncRewards: false }),
    supabase
      .from("contest_reviews")
      .select(SELECT_REVIEW_COLUMNS)
      .eq("customer_id", profile.customerId)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  failIfError(globalResult.error, "read public contest tester global ranking");
  failIfError(seasonResult.error as { message: string } | null, "read public contest tester season ranking");
  failIfError(reviewResult.error, "read public contest tester reviews");

  const globalRow = toRow(globalResult.data);
  const seasonRow = toRow(seasonResult.data);
  const reviews = await hydrateReviews(toRowArray(reviewResult.data), {
    includeEntry: true,
    includeSeason: true,
  });

  return {
    profile,
    progress: buildContestTesterProgress({
      customerId: profile.customerId,
      pseudo: profile.pseudo,
      totalPoints: toInteger(globalRow?.total_points, 0),
      globalRank: toInteger(globalRow?.global_rank, 0) || null,
      seasonRank: toInteger(seasonRow?.season_rank, 0) || null,
      selectedSeason,
    }),
    badges,
    rankings: {
      global: globalRow ? mapTesterRankingRow(globalRow, "global") : null,
      season: seasonRow ? mapTesterRankingRow(seasonRow, "season") : null,
    },
    reviews,
  };
}

export async function getAdminContestReviews(
  input: { status?: ContestReviewStatus } & ContestAdminPaginationInput = {},
): Promise<ContestAdminPaginatedResult<ContestReview>> {
  const pagination = normalizeAdminContestPagination(input);
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("contest_reviews")
    .select(SELECT_REVIEW_COLUMNS, { count: "exact" });

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const result = await query
    .order("created_at", { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);
  failIfError(result.error, "read admin contest reviews");
  const reviews = await hydrateReviews(toRowArray(result.data), {
    includeEntry: true,
    includeSeason: true,
  });
  return buildAdminContestPaginatedResult(reviews, result.count, pagination);
}

export async function moderateContestReview(input: {
  reviewId: string;
  status: Exclude<ContestReviewStatus, "pending">;
  adminNote?: string;
  qualityMark?: ContestReviewQualityMark;
  reviewedBy: string;
}): Promise<void> {
  const safeReviewId = input.reviewId.trim();
  if (!safeReviewId) {
    throw new Error("Avis introuvable.");
  }

  if (input.status !== "approved" && input.status !== "rejected") {
    throw new Error("Statut de moderation invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_reviews")
    .update({
      status: input.status,
      admin_note: (input.adminNote ?? "").trim().slice(0, 500),
      quality_mark: input.status === "approved" ? toContestReviewQualityMark(input.qualityMark) : "",
      reviewed_by: input.reviewedBy.trim().slice(0, 120),
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeReviewId)
    .select("id,customer_id")
    .maybeSingle();

  failIfError(result.error, "moderate contest review");
  const moderatedReview = toRow(result.data);
  if (moderatedReview) {
    await syncContestTesterPointsForReview(safeReviewId);
    if (input.status === "approved") {
      const customerId = toText(moderatedReview.customer_id);
      await syncContestBadgeRewardsForCustomer(customerId);
      await syncKqNotebookRewardsForCustomer(customerId);
      await syncKqProducerNotebookRewardsForReview({ customerId, reviewId: safeReviewId });
    }
  }
}

export async function createContestSeason(input: ContestSeasonInput): Promise<ContestSeason> {
  const code = slugifyContestText(input.code);
  if (!code || code.length < 3) {
    throw new Error("Code de saison invalide.");
  }

  const label = (input.label ?? "").trim().slice(0, 120);
  if (label.length < 3) {
    throw new Error("Libelle de saison invalide.");
  }

  const year = toInteger(input.year, 0);
  if (year < 2020 || year > 2100) {
    throw new Error("Annee de saison invalide.");
  }

  const isActive = input.isActive === true;
  const isArchived = input.isArchived === true && !isActive;
  const id = `contest-season-${code}`;
  const supabase = createSupabaseServiceClient();

  if (isActive) {
    const resetResult = await supabase
      .from("contest_seasons")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .neq("id", id);
    failIfError(resetResult.error, "reset active contest seasons");
  }

  const insertResult = await supabase
    .from("contest_seasons")
    .insert({
      id,
      code,
      label,
      year,
      harvest_start: toOptionalText(input.harvestStart) ?? null,
      harvest_end: toOptionalText(input.harvestEnd) ?? null,
      is_active: isActive,
      is_archived: isArchived,
    })
    .select(SELECT_SEASON_COLUMNS)
    .single();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      throw new Error("Une saison avec ce code existe deja.");
    }
    throw new Error(`[supabase:create contest season] ${insertResult.error.message}`);
  }

  const row = toRow(insertResult.data);
  if (!row) {
    throw new Error("Saison introuvable apres creation.");
  }

  return mapSeasonRow(row);
}

export async function createContestEntry(input: ContestEntryInput): Promise<ContestEntrySummary> {
  const title = (input.title ?? "").trim().slice(0, 160);
  if (title.length < 3) {
    throw new Error("Titre de lot invalide.");
  }

  const category = normalizeCategory(input.category);
  if (!category) {
    throw new Error("Categorie de lot invalide.");
  }
  const track = normalizeTrack(input.track) ?? "regular";

  const product = await loadProductForContestEntry(input.productId.trim());
  await ensureContestSeasonExists(input.seasonId.trim());
  const slug = await ensureUniqueContestEntrySlug(input.slug ?? title);
  const imageUrl = toOptionalText(input.imageUrl) ?? product.image;
  const galleryUrls = uniqueStrings([imageUrl, ...(Array.isArray(input.galleryUrls) ? input.galleryUrls : [])]);
  const producerId = toOptionalText(input.producerId) ?? product.producerId;
  const id = `contest-entry-${crypto.randomUUID()}`;

  const supabase = createSupabaseServiceClient();
  const insertResult = await supabase
    .from("contest_entries")
    .insert({
      id,
      slug,
      title,
      product_id: product.id,
      producer_id: producerId ?? null,
      season_id: input.seasonId.trim(),
      category,
      track,
      story: sanitizeStory(input.story),
      technical_sheet: sanitizeTechnicalSheet(input.technicalSheet),
      image_url: imageUrl,
      gallery_urls: galleryUrls,
      is_published: input.isPublished === true,
      position: toInteger(input.position, 0),
    })
    .select(SELECT_ENTRY_COLUMNS)
    .single();

  failIfError(insertResult.error, "create contest entry");
  const row = toRow(insertResult.data);
  if (!row) {
    throw new Error("Lot premium introuvable apres creation.");
  }

  const [entry] = await hydrateEntries([row]);
  if (!entry) {
    throw new Error("Lot premium introuvable apres hydratation.");
  }

  return entry;
}

export async function updateContestEntry(entryId: string, input: Partial<ContestEntryInput>): Promise<ContestEntrySummary> {
  const safeEntryId = entryId.trim();
  if (!safeEntryId) {
    throw new Error("Lot introuvable.");
  }

  const currentRow = await getContestEntryRowById(safeEntryId);
  if (!currentRow) {
    throw new Error("Lot introuvable.");
  }

  const current = mapEntryRow(currentRow);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.title === "string") {
    const title = input.title.trim().slice(0, 160);
    if (title.length < 3) {
      throw new Error("Titre de lot invalide.");
    }
    patch.title = title;
  }

  if (typeof input.slug === "string") {
    patch.slug = await ensureUniqueContestEntrySlug(input.slug, safeEntryId);
  }

  if (typeof input.productId === "string") {
    const product = await loadProductForContestEntry(input.productId.trim());
    patch.product_id = product.id;
    if (!("imageUrl" in input) && !current.imageUrl) {
      patch.image_url = product.image;
    }
    if (!("producerId" in input)) {
      patch.producer_id = product.producerId ?? null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "producerId")) {
    patch.producer_id = toOptionalText(input.producerId) ?? null;
  }

  if (typeof input.seasonId === "string") {
    await ensureContestSeasonExists(input.seasonId.trim());
    patch.season_id = input.seasonId.trim();
  }

  if (typeof input.category === "string") {
    const category = normalizeCategory(input.category);
    if (!category) {
      throw new Error("Categorie de lot invalide.");
    }
    patch.category = category;
  }

  if (typeof input.track === "string") {
    const track = normalizeTrack(input.track);
    if (!track) {
      throw new Error("Categorie Regular/Concours invalide.");
    }
    patch.track = track;
  }

  if (typeof input.story === "string") {
    patch.story = sanitizeStory(input.story);
  }

  if (input.technicalSheet !== undefined) {
    patch.technical_sheet = sanitizeTechnicalSheet(input.technicalSheet);
  }

  if (typeof input.imageUrl === "string") {
    patch.image_url = toOptionalText(input.imageUrl) ?? current.imageUrl;
  }

  if (Array.isArray(input.galleryUrls)) {
    const imageUrl = toOptionalText((patch.image_url as string | undefined) ?? current.imageUrl) ?? current.imageUrl;
    patch.gallery_urls = uniqueStrings([imageUrl, ...input.galleryUrls]);
  }

  if (typeof input.isPublished === "boolean") {
    patch.is_published = input.isPublished;
  }

  if (typeof input.position === "number") {
    patch.position = Math.max(0, Math.floor(input.position));
  }

  const supabase = createSupabaseServiceClient();
  const updateResult = await supabase
    .from("contest_entries")
    .update(patch)
    .eq("id", safeEntryId)
    .select(SELECT_ENTRY_COLUMNS)
    .single();

  failIfError(updateResult.error, "update contest entry");
  const row = toRow(updateResult.data);
  if (!row) {
    throw new Error("Lot premium introuvable apres mise a jour.");
  }

  const [entry] = await hydrateEntries([row]);
  if (!entry) {
    throw new Error("Lot premium introuvable apres hydratation.");
  }

  return entry;
}

export async function deleteContestEntry(entryId: string): Promise<ContestEntrySummary | null> {
  const safeEntryId = entryId.trim();
  if (!safeEntryId) {
    throw new Error("Lot introuvable.");
  }

  const currentRow = await getContestEntryRowById(safeEntryId);
  if (!currentRow) {
    return null;
  }

  const [entry] = await hydrateEntries([currentRow]);
  if (!entry) {
    throw new Error("Lot premium introuvable apres hydratation.");
  }

  const supabase = createSupabaseServiceClient();
  const reviewsResult = await supabase
    .from("contest_reviews")
    .select("id,customer_id")
    .eq("entry_id", safeEntryId);
  failIfError(reviewsResult.error, "read contest reviews before entry delete");

  const reviewRows = toRowArray(reviewsResult.data);
  const reviewIds = uniqueStrings(reviewRows.map((row) => toOptionalText(row.id)));
  const customerIds = uniqueStrings(reviewRows.map((row) => toOptionalText(row.customer_id)));

  const voteRows =
    reviewIds.length > 0
      ? await supabase.from("contest_review_votes").select("voter_customer_id").in("review_id", reviewIds)
      : { data: [], error: null };
  failIfError(voteRows.error, "read contest review voters before entry delete");

  const voterIds = uniqueStrings(toRowArray(voteRows.data).map((row) => toOptionalText(row.voter_customer_id)));
  const affectedCustomerIds = uniqueStrings([...customerIds, ...voterIds]);

  // Notebook rewards use restrictive foreign keys so that normal application
  // flows cannot erase their history accidentally. An explicit admin entry
  // deletion is the exception: detach the bookkeeping rows first while keeping
  // any booster entitlement that has already been granted to the customer.
  const deleteNotebookFlowerGrants = await supabase
    .from("kq_notebook_flower_reward_grants")
    .delete()
    .eq("entry_id", safeEntryId);
  failIfError(deleteNotebookFlowerGrants.error, "delete notebook flower grants for contest entry");

  const deleteProducerRewardEntries = await supabase
    .from("kq_producer_reward_entries")
    .delete()
    .eq("entry_id", safeEntryId);
  failIfError(deleteProducerRewardEntries.error, "delete producer reward links for contest entry");

  if (reviewIds.length > 0) {
    const deletePoints = await supabase.from("contest_tester_points").delete().in("review_id", reviewIds);
    failIfError(deletePoints.error, "delete contest tester points for entry");
  }

  if (affectedCustomerIds.length > 0) {
    const deleteUnclaimedBadges = await supabase
      .from("contest_profile_badges")
      .delete()
      .is("reward_claimed_at", null)
      .in("customer_id", affectedCustomerIds);
    failIfError(deleteUnclaimedBadges.error, "delete unclaimed contest profile badges for affected customers");
  }

  const deleteResult = await supabase
    .from("contest_entries")
    .delete()
    .eq("id", safeEntryId)
    .select("id")
    .maybeSingle();
  failIfError(deleteResult.error, "delete contest entry");

  if (!toRow(deleteResult.data)) {
    return null;
  }

  for (const customerId of affectedCustomerIds) {
    await syncContestBadgeRewardsForCustomer(customerId);
  }

  return entry;
}
