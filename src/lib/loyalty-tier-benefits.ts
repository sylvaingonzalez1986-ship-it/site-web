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
    relayFreeShippingThresholdEur: number | null;
    homeDeliveryFeeEur: number;
    extraBoosterPacksPerOrder: number;
    birthdayGiftEligible: boolean;
    decemberGiftEligible: boolean;
    privateSalesEligible: boolean;
  }
> = {
  decouverte: {
    discountPercent: 1,
    relayFreeShippingThresholdEur: 69,
    homeDeliveryFeeEur: 2.5,
    extraBoosterPacksPerOrder: 1,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  explorateur: {
    discountPercent: 4,
    relayFreeShippingThresholdEur: 45,
    homeDeliveryFeeEur: 2.5,
    extraBoosterPacksPerOrder: 3,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  connaisseur: {
    discountPercent: 6,
    relayFreeShippingThresholdEur: 30,
    homeDeliveryFeeEur: 2.5,
    extraBoosterPacksPerOrder: 5,
    birthdayGiftEligible: false,
    decemberGiftEligible: false,
    privateSalesEligible: false,
  },
  ambassadeur: {
    discountPercent: 8,
    relayFreeShippingThresholdEur: null,
    homeDeliveryFeeEur: 0,
    extraBoosterPacksPerOrder: 10,
    birthdayGiftEligible: true,
    decemberGiftEligible: false,
    privateSalesEligible: true,
  },
  legende: {
    discountPercent: 10,
    relayFreeShippingThresholdEur: null,
    homeDeliveryFeeEur: 0,
    extraBoosterPacksPerOrder: 20,
    birthdayGiftEligible: true,
    decemberGiftEligible: true,
    privateSalesEligible: true,
  },
};

function formatAmount(value: number): string {
  const safeValue = Number(value.toFixed(2));
  const hasDecimals = !Number.isInteger(safeValue);

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeValue)} EUR`;
}

export function getBadgeTierRelayFreeShippingThreshold(
  badgeId: LoyaltyBadgeId,
): number | null | undefined {
  return BADGE_TIER_BENEFITS[badgeId]?.relayFreeShippingThresholdEur;
}

export function getBadgeRelayFreeShippingThreshold(
  badgeId: LoyaltyBadgeId,
  unlocked: boolean,
): number | null | undefined {
  if (!unlocked) {
    return undefined;
  }

  return getBadgeTierRelayFreeShippingThreshold(badgeId);
}

export function getBadgeTierHomeDeliveryFeeEur(
  badgeId: LoyaltyBadgeId,
): number | undefined {
  return BADGE_TIER_BENEFITS[badgeId]?.homeDeliveryFeeEur;
}

export function getBadgeHomeDeliveryFeeEur(
  badgeId: LoyaltyBadgeId,
  unlocked: boolean,
): number | undefined {
  if (!unlocked) {
    return undefined;
  }

  return getBadgeTierHomeDeliveryFeeEur(badgeId);
}

export function getBadgeTierRelayBenefitLabel(badgeId: LoyaltyBadgeId): string {
  const threshold = getBadgeTierRelayFreeShippingThreshold(badgeId);

  if (threshold === null) {
    return "Point relais offert";
  }

  if (typeof threshold === "number") {
    return `Point relais offert des ${threshold} EUR`;
  }

  return "Point relais au seuil standard";
}

export function getBadgeTierHomeDeliveryBenefitLabel(badgeId: LoyaltyBadgeId): string {
  const fee = getBadgeTierHomeDeliveryFeeEur(badgeId);

  if (typeof fee !== "number") {
    return "Domicile au tarif standard";
  }

  if (fee <= 0) {
    return "Domicile offert";
  }

  return `Domicile a ${formatAmount(fee)}`;
}

export function getCanonicalBadgeBenefitsLines(badgeId: LoyaltyBadgeId): string[] {
  const perks = BADGE_TIER_BENEFITS[badgeId];
  const lines = [
    `${perks.discountPercent}% de reduction permanente`,
    `${perks.extraBoosterPacksPerOrder} pack${perks.extraBoosterPacksPerOrder > 1 ? "s" : ""} booster extra par commande`,
  ];

  lines.splice(
    1,
    0,
    perks.relayFreeShippingThresholdEur === null
      ? "Point relais offert"
      : `Point relais offert des ${perks.relayFreeShippingThresholdEur} EUR`,
    perks.homeDeliveryFeeEur <= 0
      ? "Livraison a domicile offerte"
      : `Livraison a domicile a ${formatAmount(perks.homeDeliveryFeeEur)}`,
  );

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
  return getBadgeRelayFreeShippingThreshold(badgeId, unlocked) === null;
}

export function isBadgeTierEligibleForFreeShipping(
  badgeId: LoyaltyBadgeId,
): boolean {
  return getBadgeRelayFreeShippingThreshold(badgeId, true) === null;
}

export function getBadgeFreeShippingThreshold(
  badgeId: LoyaltyBadgeId,
  unlocked: boolean,
): number | null | undefined {
  return getBadgeRelayFreeShippingThreshold(badgeId, unlocked);
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

