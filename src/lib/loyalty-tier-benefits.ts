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

const BADGE_TIER_BENEFITS: Record<
  LoyaltyBadgeId,
  {
    discountPercent: number;
    freeShipping: boolean;
    extraBoosterPacksPerOrder: number;
    birthdayGiftEligible: boolean;
    decemberGiftEligible: boolean;
    privateSalesEligible: boolean;
  }
> = {
  decouverte: {
    discountPercent: 1,
    freeShipping: false,
    extraBoosterPacksPerOrder: 1,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  explorateur: {
    discountPercent: 4,
    freeShipping: true,
    extraBoosterPacksPerOrder: 3,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  connaisseur: {
    discountPercent: 6,
    freeShipping: true,
    extraBoosterPacksPerOrder: 5,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  ambassadeur: {
    discountPercent: 8,
    freeShipping: true,
    extraBoosterPacksPerOrder: 10,
    birthdayGiftEligible: true,
    decemberGiftEligible: false,
    privateSalesEligible: true,
  },
  legende: {
    discountPercent: 10,
    freeShipping: true,
    extraBoosterPacksPerOrder: 20,
    birthdayGiftEligible: true,
    decemberGiftEligible: true,
    privateSalesEligible: true,
  },
};

export function getCanonicalBadgeBenefitsLines(badgeId: LoyaltyBadgeId): string[] {
  const perks = BADGE_TIER_BENEFITS[badgeId];
  const lines = [
    `${perks.discountPercent}% de reduction permanente`,
    `${perks.extraBoosterPacksPerOrder} pack${perks.extraBoosterPacksPerOrder > 1 ? "s" : ""} booster extra par commande`,
  ];

  if (perks.freeShipping) {
    lines.splice(1, 0, "Livraison offerte");
  }

  if (perks.birthdayGiftEligible) {
    lines.push("1 cadeau d'anniversaire pour toute commande passee le mois de ton anniversaire");
  }

  if (perks.decemberGiftEligible) {
    lines.push("1 cadeau de Noel pour toute commande passee au mois de decembre");
  }

  if (perks.privateSalesEligible) {
    lines.push("Acces aux ventes privees");
  }

  return lines;
}

export function getBadgeBenefitsText(
  _profileContent: SiteContent["profile"],
  badgeId: LoyaltyBadgeId,
): string {
  return getCanonicalBadgeBenefitsLines(badgeId).join("\n");
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
  _profileContent: SiteContent["profile"],
  badgeId: LoyaltyBadgeId,
): number {
  return BADGE_TIER_BENEFITS[badgeId]?.discountPercent ?? 0;
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
  return BADGE_TIER_BENEFITS[badgeId]?.freeShipping ?? false;
}

export function getBadgeExtraBoosterPacksPerOrder(badgeId: LoyaltyBadgeId): number {
  return BADGE_TIER_BENEFITS[badgeId]?.extraBoosterPacksPerOrder ?? 0;
}

export function hasBadgeBirthdayGiftBenefit(badgeId: LoyaltyBadgeId): boolean {
  return BADGE_TIER_BENEFITS[badgeId]?.birthdayGiftEligible ?? false;
}

export function hasBadgeDecemberGiftBenefit(badgeId: LoyaltyBadgeId): boolean {
  return BADGE_TIER_BENEFITS[badgeId]?.decemberGiftEligible ?? false;
}

export function hasBadgePrivateSalesBenefit(badgeId: LoyaltyBadgeId): boolean {
  return BADGE_TIER_BENEFITS[badgeId]?.privateSalesEligible ?? false;
}

