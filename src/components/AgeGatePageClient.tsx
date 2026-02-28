"use client";

import { useState } from "react";

function sanitizeNextPath(value: string | null): string {
  if (!value) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

type AgeGatePageClientProps = {
  nextPathParam: string | null;
};

export function AgeGatePageClient({ nextPathParam }: AgeGatePageClientProps) {
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = sanitizeNextPath(nextPathParam);

  const confirmMajority = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/age-gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Vérification impossible.");
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError("Vérification impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8 md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
            Verification obligatoire
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">
            Avez-vous 18 ans ou plus ?
          </h1>

          {!denied ? (
            <>
              <p className="mt-4 max-w-2xl text-base text-charcoal">
                L&apos;acces a ce site est reserve aux personnes majeures.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-12 px-5"
                  onClick={confirmMajority}
                  disabled={loading}
                >
                  {loading ? "Vérification..." : "Oui, j'ai 18 ans ou plus"}
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-12 px-5"
                  onClick={() => setDenied(true)}
                  disabled={loading}
                >
                  Non
                </button>
              </div>
            </>
          ) : (
            <div className="mt-6 card-cartoon bg-white p-5">
              <p className="font-semibold text-ink">
                Ce site est reserve aux personnes majeures.
              </p>
              <p className="mt-2 text-sm text-charcoal">
                Vous ne pouvez pas acceder au contenu CBD tant que vous n&apos;avez pas l&apos;age legal.
              </p>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
