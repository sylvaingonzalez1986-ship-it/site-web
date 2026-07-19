"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "@/components/FirstVisitExperience.module.css";

const AGE_VERIFIED_EVENT = "lcb:age-verified";

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
        setError(data?.error ?? "Verification impossible.");
        return;
      }

      window.dispatchEvent(new Event(AGE_VERIFIED_EVENT));
      window.location.assign(nextPath);
    } catch {
      setError("Verification impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-dvh bg-[#254f40] px-4 pb-10 pt-28 md:pt-36">
      <div className={`${styles.dialog} mx-auto`}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Bienvenue chez nous</p>
            <h1 className={styles.title}>Avant d&apos;entrer, une seule question.</h1>
          </div>
          <Image className={styles.heroVisual} src="/mascots/home-welcome.png" alt="" width={150} height={150} priority />
        </div>
        <div className={styles.content}>

          {!denied ? (
            <>
              <p className={styles.intro}>
                Nos produits sont réservés aux adultes. Confirmez simplement que vous avez 18 ans ou plus.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  className={styles.primary}
                  onClick={confirmMajority}
                  disabled={loading}
                >
                  {loading ? "Verification..." : "Oui, j'ai 18 ans ou plus"}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setDenied(true)}
                  disabled={loading}
                >
                  Non
                </button>
              </div>
            </>
          ) : (
            <div className={`${styles.notice} mt-6`}>
              <p className="font-semibold text-ink">
                Ce site est reserve aux personnes majeures.
              </p>
              <p className="mt-2 text-sm text-charcoal">
                Vous ne pouvez pas acceder au contenu CBD tant que vous n&apos;avez pas l&apos;age legal.
              </p>
            </div>
          )}

          {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
