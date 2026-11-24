"use client";

import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics/react";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { getConsentFromCookie } from "@/components/cookies/cookie-consent-utils";
import { detectAiReferral } from "@/lib/ai-referral";
import { getShopListFilters, isLocalShopMeasurementHost } from "@/lib/shop-measurement";
import { installShopMeasurementPreview } from "@/lib/shop-measurement-preview";
import { protectVercelAnalyticsUrls } from "@/lib/vercel-analytics-privacy";

const shopMeasurementPreview = process.env.NODE_ENV === "development"
  && process.env.NEXT_PUBLIC_SHOP_MEASUREMENT_PREVIEW === "1";

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

function LocalShopMeasurement() {
  const pathname = usePathname();
  const params = useSearchParams();
  const viewKey = JSON.stringify(getShopListFilters(params ?? new URLSearchParams()));
  useEffect(() => {
    if (!pathname || !isLocalShopMeasurementHost(window.location.hostname)) return;
    return installShopMeasurementPreview(() => getConsentFromCookie()?.categories.analytics === true);
  }, [pathname, viewKey]);

  return null;
}

export function VercelAnalytics() {
  const { hasConsent } = useCookieConsent();
  const analyticsAllowed = hasConsent("analytics");

  if (!analyticsAllowed) {
    return null;
  }

  if (shopMeasurementPreview) {
    return <Suspense fallback={null}><LocalShopMeasurement /></Suspense>;
  }

  return (
    <>
      <Analytics beforeSend={protectVercelAnalyticsUrls} />
      <AiReferralTracker />
    </>
  );
}
