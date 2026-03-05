"use client";

import Script from "next/script";
import { useMemo } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

function sanitizeMatomoUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/\/$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function MatomoScript() {
  const { consent, hasResponded } = useCookieConsent();
  const matomoUrl = useMemo(
    () => sanitizeMatomoUrl(process.env.NEXT_PUBLIC_MATOMO_URL),
    [],
  );
  const matomoSiteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID?.trim() || "";

  if (!hasResponded || !consent.analytics || !matomoUrl || !matomoSiteId) {
    return null;
  }

  const src = `${matomoUrl}/matomo.js`;
  const trackerUrl = `${matomoUrl}/matomo.php`;

  return (
    <Script id="matomo-analytics" strategy="afterInteractive">
      {`
        var _paq = window._paq = window._paq || [];
        _paq.push(["setDoNotTrack", true]);
        _paq.push(["disableCookies"]);
        _paq.push(["trackPageView"]);
        _paq.push(["enableLinkTracking"]);
        _paq.push(["setTrackerUrl", "${trackerUrl}"]);
        _paq.push(["setSiteId", "${matomoSiteId}"]);
        (function() {
          var g = document.createElement("script");
          var s = document.getElementsByTagName("script")[0];
          g.async = true;
          g.src = "${src}";
          s.parentNode.insertBefore(g, s);
        })();
      `}
    </Script>
  );
}
