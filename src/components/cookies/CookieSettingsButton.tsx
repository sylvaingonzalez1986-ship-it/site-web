"use client";

import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";

export function CookieSettingsButton({ className }: { className?: string }) {
  const { openSettings } = useCookieConsent();
  return <button type="button" className={className ?? "btn-cartoon btn-secondary inline-flex min-h-12 items-center justify-center px-4"} onClick={openSettings}>Gérer mes cookies</button>;
}
