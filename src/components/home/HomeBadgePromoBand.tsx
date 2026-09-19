"use client";

import Link from "@/components/navigation/NavigationLink";
import { Award, Truck } from "lucide-react";
import { LoyaltyBadgeIllustration } from "@/components/account/LoyaltyBadgeIllustration";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import styles from "./HomeEditorialExperience.module.css";

import { useCart } from "@/context/CartContext";

const loyaltyBadges = buildEmptyLoyaltySummary().badges;

type HomeBadgePromoBandProps = {
  zIndex?: number;
};

export function HomeBadgePromoBand({ zIndex }: HomeBadgePromoBandProps) {
  const { isAuthenticated, authLoading } = useCart();
  const badgeCtaHref = !authLoading && isAuthenticated ? "/profil?tab=fidelite" : "/fidelite";

  return (
    <section
      id="badge-fidelite-home"
      data-tutorial="badge-promo-band"
      className="home-editorial-promo home-editorial-promo--badge section-band bg-yellow py-6 md:py-8"
      style={typeof zIndex === "number" ? { zIndex } : undefined}
    >
      <div className="retro-container">
        <div className="home-editorial-promo__panel cartoon-border-sm p-4 md:p-6">
          <p className="home-editorial-promo__eyebrow">
            Badge fidélité
          </p>
          <h2 className="home-editorial-promo__title mt-2 font-display text-3xl text-ink md:text-5xl">
            Ta fidélité a de la valeur.
          </h2>
          <p className="home-editorial-promo__description mt-3 max-w-4xl text-sm leading-relaxed text-charcoal md:text-base">
            Le principe est simple : 1 &euro; d&eacute;pens&eacute; = 1 point. Tu progresses par paliers et tu
            d&eacute;bloques de nouveaux avantages &agrave; chaque niveau.
          </p>

          <ol className={styles.loyaltyTiers} aria-label="Les cinq paliers de fidélité">
            {loyaltyBadges.map((badge) => (
              <li key={badge.id}>
                <LoyaltyBadgeIllustration badgeId={badge.id} unlocked size="md" />
                <span>{badge.label}</span>
              </li>
            ))}
          </ol>

          <div className="home-editorial-promo__benefits mt-4 flex flex-wrap items-center gap-2">
            <span className="pill-cartoon inline-flex items-center gap-1 bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              <Award size={14} className="shrink-0" /> Des remises par palier
            </span>
            <span className="pill-cartoon inline-flex items-center gap-1 bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              <Truck size={14} className="shrink-0" /> Des avantages livraison
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              Jusqu&apos;à Diamant
            </span>
            <Link
              href={badgeCtaHref}
              className="btn-cartoon btn-secondary inline-flex h-9 items-center justify-center px-3 text-xs leading-none"
            >
              Voir les paliers
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
