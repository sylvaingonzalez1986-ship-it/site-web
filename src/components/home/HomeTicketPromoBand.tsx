"use client";

import Link from "next/link";

type HomeTicketPromoBandProps = {
  zIndex?: number;
};

export function HomeTicketPromoBand({ zIndex }: HomeTicketPromoBandProps) {
  return (
    <section
      id="ticket-grattage-home"
      data-tutorial="ticket-promo-band"
      className="section-band bg-cream halftone-overlay paper-grain py-6 md:py-8"
      style={typeof zIndex === "number" ? { zIndex } : undefined}
    >
      <div className="retro-container">
        <div className="cartoon-border-sm bg-[#f7efc9] p-4 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-charcoal">Booster promo</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink md:text-5xl">
            600 euros de bon d&apos;achat a gagner
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-charcoal md:text-base">
            &Agrave; chaque commande pay&eacute;e, tu cumules des packs (1 pack pour 5 &euro; TTC). Retrouve tes boosters
            &agrave; ouvrir dans Mon Album pour tenter le gros lot et d&eacute;crocher d&apos;autres r&eacute;compenses :
            12 bons d&apos;achat de 50 &euro;, &eacute;mis &agrave; raison d&apos;un par mois pendant 12 mois, hors frais de port.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              1 pack / 5 EUR TTC
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              50 EUR / mois x 12
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              Hors frais de port
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              Autres lots a gagner
            </span>
            <Link
              href="/reglement-jeu-promo"
              className="btn-cartoon btn-secondary inline-flex h-9 items-center justify-center px-3 text-xs leading-none"
            >
              Voir le reglement
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
