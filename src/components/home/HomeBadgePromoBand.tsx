"use client";

import Link from "next/link";
import { Award, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";

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
      className="section-band bg-yellow halftone-overlay paper-grain py-6 md:py-8"
      style={typeof zIndex === "number" ? { zIndex } : undefined}
    >
      <div className="retro-container">
        <div className="cartoon-border-sm bg-[#f8e3bd] p-4 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-charcoal">
            Badge fidelite
          </p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink md:text-5xl">
            Plus tu commandes, plus tu b&eacute;n&eacute;ficies d&apos;avantages.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-charcoal md:text-base">
            Le principe est simple : 1 &euro; d&eacute;pens&eacute; = 1 point. Tu progresses par paliers et tu
            d&eacute;bloques de nouveaux avantages &agrave; chaque niveau.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill-cartoon inline-flex items-center gap-1 bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              <Award size={14} className="shrink-0" /> Bronze 2%
            </span>
            <span className="pill-cartoon inline-flex items-center gap-1 bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              <Truck size={14} className="shrink-0" /> Argent: livraison offerte
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              Jusqu&apos;a Diamant: 10%
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
