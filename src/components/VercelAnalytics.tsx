"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";

type TutorialEventDetail = {
  event?: string;
  pathname?: string;
  source?: string;
  stepId?: string;
  stepIndex?: number;
  totalSteps?: number;
};

export function VercelAnalytics() {
  const { hasConsent } = useCookieConsent();
  const analyticsAllowed = hasConsent("analytics");

  useEffect(() => {
    if (!analyticsAllowed) {
      return;
    }

    const onTutorial = (event: Event) => {
      const detail = (event as CustomEvent<TutorialEventDetail>).detail;
      const rawEventName = typeof detail?.event === "string" ? detail.event : "tutorial_event";
      const tutorialEventName = rawEventName.startsWith("tutorial_")
        ? rawEventName
        : `tutorial_${rawEventName}`;

      track(tutorialEventName, {
        pathname: typeof detail?.pathname === "string" ? detail.pathname : "/",
        source: typeof detail?.source === "string" ? detail.source : "tutorial",
        stepId: typeof detail?.stepId === "string" ? detail.stepId : "",
        stepIndex: typeof detail?.stepIndex === "number" ? detail.stepIndex : -1,
        totalSteps: typeof detail?.totalSteps === "number" ? detail.totalSteps : -1,
      });
    };

    window.addEventListener("lcb:tutorial", onTutorial as EventListener);
    return () => window.removeEventListener("lcb:tutorial", onTutorial as EventListener);
  }, [analyticsAllowed]);

  if (!analyticsAllowed) {
    return null;
  }

  return <Analytics />;
}
