"use client";

import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { useCmsStore } from "@/hooks/useCmsStore";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import {
  getBadgeBenefitsText,
  getBadgeDiscountPercent,
  isBadgeTierEligibleForFreeShipping,
  parseBadgeBenefitsLines,
} from "@/lib/loyalty-tier-benefits";

type LoyaltyBadgeSummaryProps = {
  title?: string;
  description?: string;
};

const publicLoyaltySummary = buildEmptyLoyaltySummary();

export function LoyaltyBadgeSummary({
  title = "Resume des badges",
  description = "1 EUR depense = 1 point. Monte de palier pour debloquer plus d'avantages.",
}: LoyaltyBadgeSummaryProps) {
  const { store } = useCmsStore();
  const profileContent = store.content.profile;

  return (
    <article className="cartoon-border bg-cream p-6 md:p-8">
      <h1 className="section-title">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal md:text-base">{description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {publicLoyaltySummary.badges.map((badge) => {
          const benefits = parseBadgeBenefitsLines(getBadgeBenefitsText(profileContent, badge.id));
          return (
            <section key={badge.id} className="card-cartoon bg-white p-4">
              <div className="flex items-center gap-3">
                <LoyaltyBadgeIllustration badgeId={badge.id} unlocked size="md" />
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-charcoal">
                    {badge.label}
                  </p>
                  <p className="text-xs text-charcoal">{badge.minPoints}+ points</p>
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-xs text-ink">
                <p>
                  Reduction:{" "}
                  <span className="font-semibold">
                    {getBadgeDiscountPercent(profileContent, badge.id)}%
                  </span>
                </p>
                <p>
                  Livraison:{" "}
                  <span className="font-semibold">
                    {isBadgeTierEligibleForFreeShipping(badge.id) ? "Offerte" : "Standard"}
                  </span>
                </p>
              </div>

              {benefits.length > 0 && (
                <ul className="mt-3 grid gap-1 text-xs leading-relaxed text-charcoal">
                  {benefits.slice(0, 3).map((benefit, index) => (
                    <li key={`${badge.id}-public-benefit-${index}`}>- {benefit}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

