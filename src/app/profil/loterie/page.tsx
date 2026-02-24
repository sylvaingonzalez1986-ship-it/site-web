"use client";

import Link from "next/link";

export default function ProfilLoteriePage() {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-3xl">
        <div className="cartoon-border bg-cream p-8 text-center">
          <h1 className="font-display text-4xl text-ink">Ticket de grattage</h1>
          <p className="mt-3 text-sm text-charcoal">
            Cette section est disponible directement dans ton profil.
          </p>
          <Link href="/profil" className="btn-cartoon btn-primary mt-5 inline-flex min-h-[44px] items-center px-4">
            Retour au profil
          </Link>
        </div>
      </div>
    </section>
  );
}
