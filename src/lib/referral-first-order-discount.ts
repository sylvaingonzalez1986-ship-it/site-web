export const REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT = 10;
export const REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_CODE = "AUTO-FILLEUL-10";

type ReferralFirstOrderDiscountEligibilityInput = {
  referredByCode?: string;
  referralRewardedAt?: string;
  hasPaidOrder: boolean;
  hasManualDiscount: boolean;
};

export function isReferralFirstOrderDiscountEligible(
  input: ReferralFirstOrderDiscountEligibilityInput,
): boolean {
  const hasReferralBinding = Boolean(input.referredByCode?.trim());
  if (!hasReferralBinding) {
    return false;
  }

  if (Boolean(input.referralRewardedAt)) {
    return false;
  }

  if (input.hasPaidOrder) {
    return false;
  }

  if (input.hasManualDiscount) {
    return false;
  }

  return true;
}

export function computeReferralFirstOrderDiscountAmount(
  subtotalAfterBadge: number,
  discountPercent = REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
): number {
  if (!Number.isFinite(subtotalAfterBadge) || subtotalAfterBadge <= 0) {
    return 0;
  }

  const boundedPercent = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(100, discountPercent))
    : REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT;
  return Number(((subtotalAfterBadge * boundedPercent) / 100).toFixed(2));
}
