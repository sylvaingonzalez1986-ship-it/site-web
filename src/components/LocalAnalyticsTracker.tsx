"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";

type TutorialEventDetail = {
  event?: string;
  pathname?: string;
  source?: string;
  stepId?: string;
  stepIndex?: number;
  totalSteps?: number;
};

function postAnalyticsEvent(input: {
  eventName: string;
  pathname: string;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    eventName: input.eventName,
    pathname: input.pathname,
    source: input.source,
    metadata: input.metadata ?? {},
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  };

  const body = JSON.stringify(payload);
  const url = "/api/analytics/events";

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(url, blob);
    if (sent) {
      return;
    }
  }

  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  });
}

function LocalAnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastViewKeyRef = useRef<string>("");
  const { hasConsent } = useCookieConsent();
  const analyticsAllowed = hasConsent("analytics");

  useEffect(() => {
    if (!analyticsAllowed) {
      lastViewKeyRef.current = "";
    }
  }, [analyticsAllowed]);

  useEffect(() => {
    if (!analyticsAllowed) {
      return;
    }
    if (!pathname) {
      return;
    }
    if (pathname.startsWith("/admin")) {
      return;
    }

    const search = searchParams?.toString();
    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (lastViewKeyRef.current === fullPath) {
      return;
    }
    lastViewKeyRef.current = fullPath;

    postAnalyticsEvent({
      eventName: "page_view",
      pathname,
      source: "web",
      metadata: {
        search: search || "",
      },
    });
  }, [analyticsAllowed, pathname, searchParams]);

  useEffect(() => {
    if (!analyticsAllowed) {
      return;
    }

    // Future third-party scripts must follow the same gating:
    // analytics tools => hasConsent("analytics")
    // marketing tools => hasConsent("marketing")
    const onTutorial = (event: Event) => {
      const detail = (event as CustomEvent<TutorialEventDetail>).detail;
      const rawEventName = typeof detail?.event === "string" ? detail.event : "tutorial_event";
      const tutorialEventName = rawEventName.startsWith("tutorial_")
        ? rawEventName
        : `tutorial_${rawEventName}`;

      postAnalyticsEvent({
        eventName: tutorialEventName,
        pathname:
          typeof detail?.pathname === "string" && detail.pathname.startsWith("/")
            ? detail.pathname
            : pathname || "/",
        source: typeof detail?.source === "string" ? detail.source : "tutorial",
        metadata: {
          stepId: detail?.stepId ?? "",
          stepIndex: typeof detail?.stepIndex === "number" ? detail.stepIndex : -1,
          totalSteps: typeof detail?.totalSteps === "number" ? detail.totalSteps : -1,
        },
      });
    };

    window.addEventListener("lcb:tutorial", onTutorial as EventListener);
    return () => window.removeEventListener("lcb:tutorial", onTutorial as EventListener);
  }, [analyticsAllowed, pathname]);

  return null;
}

export function LocalAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <LocalAnalyticsTrackerInner />
    </Suspense>
  );
}
