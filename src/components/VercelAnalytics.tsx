"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { track } from "@vercel/analytics/react";
import { useEffect } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { detectAiReferral } from "@/lib/ai-referral";

const protectNewsletterLinks: BeforeSend = (event) => {
  try {
    return new URL(event.url).pathname.startsWith("/newsletter/") ? null : event;
  } catch { return null; }
};

function AiReferralTracker() {
  useEffect(() => {
    const source = detectAiReferral(window.location.href, document.referrer);
    if (!source) return;

    track("ai_referral", {
      source,
      landingPath: window.location.pathname,
    });
  }, []);

  return null;
}

export function VercelAnalytics() {
  const { hasConsent } = useCookieConsent();
  const analyticsAllowed = hasConsent("analytics");

  if (!analyticsAllowed) {
    return null;
  }

  return (
    <>
      <Analytics beforeSend={protectNewsletterLinks} />
      <AiReferralTracker />
    </>
  );
}
