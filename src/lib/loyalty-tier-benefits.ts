import type { LoyaltyBadgeId } from "@/types/loyalty";
import type { SiteContent } from "@/types/store";

export type LoyaltyBenefitsContentKey =
  | "decouverteBenefits"
  | "explorateurBenefits"
  | "connaisseurBenefits"
  | "ambassadeurBenefits"
  | "legendeBenefits";

export type LoyaltyDiscountContentKey =
  | "decouverteDiscountPercent"
  | "explorateurDiscountPercent"
  | "connaisseurDiscountPercent"
  | "ambassadeurDiscountPercent"
  | "legendeDiscountPercent";

export const LOYALTY_TIER_DISCOUNT_OPTIONS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const;

export const LOYALTY_TIER_BENEFITS_FIELDS: Array<{
  id: LoyaltyBadgeId;
  adminLabel: string;
  contentKey: LoyaltyBenefitsContentKey;
  discountKey: LoyaltyDiscountContentKey;
}> = [
  {
    id: "decouverte",
    adminLabel: "Bronze (Decouverte)",
    contentKey: "decouverteBenefits",
    discountKey: "decouverteDiscountPercent",
  },
  {
    id: "explorateur",
    adminLabel: "Argent (Explorateur)",
    contentKey: "explorateurBenefits",
    discountKey: "explorateurDiscountPercent",
  },
  {
    id: "connaisseur",
    adminLabel: "Or (Connaisseur)",
    contentKey: "connaisseurBenefits",
    discountKey: "connaisseurDiscountPercent",
  },
  {
    id: "ambassadeur",
    adminLabel: "Platine (Ambassadeur)",
    contentKey: "ambassadeurBenefits",
    discountKey: "ambassadeurDiscountPercent",
  },
  {
    id: "legende",
    adminLabel: "Diamant (Legende)",
    contentKey: "legendeBenefits",
    discountKey: "legendeDiscountPercent",
  },
];

export function getBadgeBenefitsText(
  profileContent: SiteContent["profile"],
  badgeId: LoyaltyBadgeId,
): string {
  const field = LOYALTY_TIER_BENEFITS_FIELDS.find((item) => item.id === badgeId);
  if (!field) {
    return "";
  }

  return profileContent[field.contentKey] ?? "";
}

export function parseBadgeBenefitsLines(rawBenefits: string): string[] {
  return rawBenefits
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

export function sanitizeLoyaltyTierDiscountPercent(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const rounded = Math.round(parsed);
  return Math.max(0, Math.min(30, rounded));
}

export function getBadgeDiscountPercent(
  profileContent: SiteContent["profile"],
  badgeId: LoyaltyBadgeId,
): number {
  const field = LOYALTY_TIER_BENEFITS_FIELDS.find((item) => item.id === badgeId);
  if (!field) {
    return 0;
  }

  return sanitizeLoyaltyTierDiscountPercent(profileContent[field.discountKey]);
}

export function isBadgeEligibleForFreeShipping(
  badgeId: LoyaltyBadgeId,
  unlocked: boolean,
): boolean {
  if (!unlocked) {
    return false;
  }

  return isBadgeTierEligibleForFreeShipping(badgeId);
}

export function isBadgeTierEligibleForFreeShipping(
  badgeId: LoyaltyBadgeId,
): boolean {
  return badgeId !== "decouverte";
}



