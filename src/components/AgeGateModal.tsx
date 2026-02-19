"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const AGE_GATE_COOKIE_NAME = "age_verified";
const AGE_GATE_MAX_AGE_SECONDS = 60 * 60 * 24;
const CRAWLER_USER_AGENT_PATTERN =
  /(googlebot|bingbot|duckduckbot|yandex(bot)?|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slurp|applebot)/i;

function hasAgeVerifiedCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .map((cookiePart) => cookiePart.trim())
    .some((cookiePart) => cookiePart === `${AGE_GATE_COOKIE_NAME}=true`);
}

function setAgeVerifiedCookie() {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${AGE_GATE_COOKIE_NAME}=true`,
    `Max-Age=${AGE_GATE_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function isCrawlerUserAgent(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return CRAWLER_USER_AGENT_PATTERN.test(navigator.userAgent);
}

export function AgeGateModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [denied, setDenied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shouldDisplayOnPage =
    pathname === "/" ||
    pathname === "/profil" ||
    pathname.startsWith("/compte") ||
    pathname.startsWith("/application") ||
    pathname.startsWith("/boutique") ||
    pathname.startsWith("/blog");

  useBodyScrollLock(open && shouldDisplayOnPage);

  useEffect(() => {
    setMounted(true);
    if (isCrawlerUserAgent()) {
      setOpen(false);
      return;
    }

    if (hasAgeVerifiedCookie()) {
      setOpen(false);
    }
  }, []);

  if (!mounted || !open || !shouldDisplayOnPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-[#111] text-white">
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="cartoon-border w-full max-w-xl bg-cream p-7 text-ink md:p-9">
          <h2 className="font-display text-4xl leading-tight text-ink">Verification d&apos;age</h2>
          {!denied ? (
            <>
              <p className="mt-4 text-base text-charcoal">
                Ce site est reserve aux personnes majeures. Avez-vous 18 ans ou plus ?
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-12"
                  onClick={() => {
                    setAgeVerifiedCookie();
                    setOpen(false);
                  }}
                >
                  Oui, j&apos;ai 18 ans ou plus
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-12"
                  onClick={() => setDenied(true)}
                >
                  Non
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="font-semibold text-ink">
                Ce site est reserve aux personnes majeures.
              </p>
              <p className="text-sm text-charcoal">
                L&apos;acces au contenu et a l&apos;achat est interdit aux mineurs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
