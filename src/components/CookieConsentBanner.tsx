"use client";

import Link from "next/link";
import { useState } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

export function CookieConsentBanner() {
  const {
    hasResponded,
    preferencesOpen,
    openPreferences,
    closePreferences,
    acceptAll,
    rejectAll,
    updateConsent,
    consent,
  } = useCookieConsent();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(consent.analytics);

  if (hasResponded && !preferencesOpen) {
    return null;
  }

  return (
    <div className="safe-area-x fixed inset-x-0 bottom-0 z-[120] p-3 md:p-5">
      <aside className="retro-container">
        <div className="cartoon-border bg-cream p-4 shadow-[4px_4px_0_var(--ink)] md:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-charcoal">
            Cookies
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink md:text-base">
            Nous utilisons des cookies pour mesurer l&apos;audience du site.{" "}
            <Link href="/politique-cookies" className="underline">
              En savoir plus
            </Link>
            .
          </p>

          {preferencesOpen ? (
            <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-white p-3 text-sm md:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">Personnaliser mes cookies</p>
                  <p className="mt-1 text-xs text-charcoal">Les cookies necessaires restent actifs.</p>
                </div>
                <button type="button" className="btn-cartoon btn-secondary h-8 px-3 text-xs" onClick={closePreferences}>
                  Fermer
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <label className="flex items-center justify-between rounded border border-[#1a1a1a] bg-[#f7f4ee] px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">Necessaires</span>
                  <span className="text-xs font-bold text-ink">Toujours actifs</span>
                </label>

                <label className="flex items-center justify-between rounded border border-[#1a1a1a] bg-white px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">Analytics</span>
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                    aria-label="Activer les cookies analytics"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-9 px-3 text-xs"
                  onClick={() => updateConsent({ analytics: analyticsEnabled })}
                >
                  Enregistrer mes preferences
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-cartoon btn-secondary h-9 px-3 text-xs" onClick={rejectAll}>
              Tout refuser
            </button>
            <button type="button" className="btn-cartoon btn-primary h-9 px-3 text-xs" onClick={acceptAll}>
              Tout accepter
            </button>
            <button type="button" className="h-9 px-3 text-xs font-semibold uppercase tracking-[0.09em] text-charcoal underline" onClick={openPreferences}>
              Personnaliser
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
