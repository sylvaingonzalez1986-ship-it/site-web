"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-mint text-ink antialiased">
        <div className="section-band bg-mint paper-grain py-10 md:py-16">
          <div className="retro-container">
            <div className="cartoon-panel mx-auto max-w-3xl bg-cream p-6 text-center md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
                Incident
              </p>
              <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
                Une erreur globale est survenue
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-charcoal md:text-base">
                L&apos;incident a ete capture pour diagnostic. Tu peux retenter le chargement
                ou revenir a l&apos;accueil.
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
      </body>
    </html>
  );
}
