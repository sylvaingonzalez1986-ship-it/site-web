import type { Metadata } from "next";
import Link from "next/link";
import { LoyaltyBadgeSummary } from "@/components/account/LoyaltyBadgeSummary";

export const metadata: Metadata = {
  title: "Programme fidelite",
  description:
    "Decouvre les badges fidelite Les Chanvriers Bretons: seuils, reductions et avantages par palier.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/fidelite",
  },
};

export default function FidelitePage() {
  const nextUrl = "/profil?tab=fidelite";
  const loginHref = `/compte/connexion?next=${encodeURIComponent(nextUrl)}`;
  const registerHref = `/compte/inscription?next=${encodeURIComponent(nextUrl)}`;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container grid gap-6">
        <LoyaltyBadgeSummary
          title="PROGRAMME FIDELITE"
          description="Le principe est simple: 1 EUR depense = 1 point. Plus ton palier monte, plus tes avantages augmentent."
        />

        <article className="cartoon-border bg-cream p-6">
          <h2 className="font-display text-3xl text-ink">Aller plus loin</h2>
          <p className="mt-3 text-sm text-charcoal">
            Connecte-toi pour suivre ta progression en direct, tes points, ton palier actuel et
            tes avantages disponibles.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={loginHref} className="btn-cartoon btn-primary inline-flex h-10 items-center px-4 text-xs">
              Se connecter
            </Link>
            <Link href={registerHref} className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs">
              Creer un compte
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

