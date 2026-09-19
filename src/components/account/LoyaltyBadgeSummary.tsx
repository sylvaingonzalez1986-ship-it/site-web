"use client";

import styles from "./LoyaltyBadgeSummary.module.css";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { useCmsStore } from "@/hooks/useCmsStore";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import {
  getBadgeBenefitsText,
  getBadgeDiscountPercent,
  getBadgeTierHomeDeliveryBenefitLabel,
  getBadgeTierRelayBenefitLabel,
  parseBadgeBenefitsLines,
} from "@/lib/loyalty-tier-benefits";

type LoyaltyBadgeSummaryProps = {
  title?: string;
  description?: string;
  headingLevel?: "h1" | "h2";
};

const publicLoyaltySummary = buildEmptyLoyaltySummary();

export function LoyaltyBadgeSummary({
  title = "Les paliers du club",
  description = "1 € dépensé = 1 point. Monte de palier pour débloquer plus d’avantages.",
  headingLevel = "h1",
}: LoyaltyBadgeSummaryProps) {
  const { store } = useCmsStore();
  const profileContent = store.content.profile;
  const Heading = headingLevel;

  return (
    <article className={styles.panel}>
      <Heading className="section-title">{title}</Heading>
      <p className="mt-3 text-sm leading-relaxed text-charcoal md:text-base">{description}</p>

      <div className={styles.grid}>
        {publicLoyaltySummary.badges.map((badge) => {
          const benefits = parseBadgeBenefitsLines(getBadgeBenefitsText(profileContent, badge.id));
          return (
            <section key={badge.id} className={styles.card}>
              <div className={styles.identity}>
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
                  Réduction :{" "}
                  <span className="font-semibold">
                    {getBadgeDiscountPercent(profileContent, badge.id)}%
                  </span>
                </p>
                <p>
                  Livraison :{" "}
                  <span className="font-semibold">
                    {`${getBadgeTierRelayBenefitLabel(badge.id)} / ${getBadgeTierHomeDeliveryBenefitLabel(badge.id)}`}
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
