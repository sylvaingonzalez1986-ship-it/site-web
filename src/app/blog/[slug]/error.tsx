"use client";

import Link from "next/link";
import { useEffect } from "react";

type BlogErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BlogPostError({ error, reset }: BlogErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="section-band bg-cream halftone-overlay py-8 md:py-12">
      <div className="retro-container">
        <div className="cartoon-panel mx-auto max-w-3xl bg-mint p-6 text-center md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            Blog
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
            Article introuvable ou erreur de chargement
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal md:text-base">
            L&apos;article n&apos;a pas pu etre charge. Tu peux relancer la page ou revenir a
            la liste des articles.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className="btn-cartoon">
              Reessayer
            </button>
            <Link href="/blog" className="btn-cartoon btn-secondary">
              Retour au blog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
