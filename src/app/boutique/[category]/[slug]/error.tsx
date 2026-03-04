"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

type ProductErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProductError({ error, reset }: ProductErrorProps) {
  const params = useParams<{ category?: string }>();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const categoryHref =
    typeof params?.category === "string" && params.category.length > 0
      ? `/boutique/${params.category}`
      : "/boutique";

  return (
    <div className="section-band bg-cream halftone-overlay py-8 md:py-12">
      <div className="retro-container">
        <div className="cartoon-panel mx-auto max-w-3xl bg-mint p-6 text-center md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            Produit
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
            Produit introuvable ou erreur de chargement
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal md:text-base">
            La fiche n&apos;a pas pu etre affichee correctement. Tu peux reessayer ou
            revenir a la categorie.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className="btn-cartoon">
              Reessayer
            </button>
            <Link href={categoryHref} className="btn-cartoon btn-secondary">
              Retour a la categorie
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
