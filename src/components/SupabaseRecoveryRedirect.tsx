"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const RESET_PASSWORD_PATH = "/compte/reinitialiser-mot-de-passe";

function hasRecoveryMarker(url: URL): boolean {
  return (
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    url.searchParams.get("type") === "recovery" ||
    url.hash.includes("type=recovery") ||
    url.hash.includes("access_token=")
  );
}

export function SupabaseRecoveryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === RESET_PASSWORD_PATH) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    if (!hasRecoveryMarker(currentUrl)) {
      return;
    }

    const targetUrl = new URL(RESET_PASSWORD_PATH, currentUrl.origin);
    for (const [key, value] of currentUrl.searchParams.entries()) {
      targetUrl.searchParams.set(key, value);
    }

    const nextPath = `${currentUrl.pathname}${currentUrl.search}`;
    if (nextPath && nextPath !== "/" && !targetUrl.searchParams.has("next")) {
      targetUrl.searchParams.set("next", currentUrl.pathname);
    }

    targetUrl.hash = currentUrl.hash;
    window.location.replace(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
  }, [pathname]);

  return null;
}
