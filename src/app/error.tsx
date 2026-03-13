"use client";

import Link from "next/link";
import { useEffect } from "react";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // Sentry captures this error automatically via the global error boundary
  }, [error]);

  return (
    <div className="section-band bg-mint paper-grain py-10 md:py-16">
      <div className="retro-container">
        <div className="cartoon-panel mx-auto max-w-3xl bg-cream p-6 text-center md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            Oups
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
            Une erreur a interrompu la page
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal md:text-base">
            Le site a rencontre un probleme inattendu. Tu peux relancer le chargement
            ou revenir vers une page stable.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className="btn-cartoon">
              Reessayer
            </button>
            <Link href="/" className="btn-cartoon btn-secondary">
              Retour a l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
