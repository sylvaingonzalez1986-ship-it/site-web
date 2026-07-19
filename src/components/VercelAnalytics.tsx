"use client";

import { Analytics } from "@vercel/analytics/next";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";

export function VercelAnalytics() {
  const { hasConsent } = useCookieConsent();
  const analyticsAllowed = hasConsent("analytics");

  if (!analyticsAllowed) {
    return null;
  }

  return <Analytics />;
}
