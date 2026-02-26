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
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-charcoal">Ticket de grattage</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-ink md:text-5xl">
            1 an de conso a gagner
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-charcoal md:text-base">
            &Agrave; chaque commande pay&eacute;e, tu cumules des tickets (1 ticket pour 20 &euro; TTC). Retrouve tes tickets
            &agrave; gratter dans ton profil pour tenter le gros lot et d&eacute;crocher d&apos;autres r&eacute;compenses : r&eacute;ductions,
            grammes offerts et surprises.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              1 ticket / 20 EUR TTC
            </span>
            <span className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.06em] text-ink">
              1 an de conso
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
