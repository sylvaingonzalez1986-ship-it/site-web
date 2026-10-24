"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SITE_UI_COOKIE, type SiteUiVariant } from "@/lib/site-ui-preview";
import styles from "./SiteUiPreview.module.css";

export function SiteUiPreview({ initialVariant }: { initialVariant: SiteUiVariant }) {
  const pathname = usePathname();
  const [variant, setVariant] = useState(initialVariant);
  const excluded = /^\/(?:arene|bete-de-concours|admin|dev)(?:\/|$)/.test(pathname);
  const navigationExcluded = /^\/(?:admin|dev)(?:\/|$)/.test(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.siteUi = excluded ? "original" : variant;
    document.documentElement.dataset.siteNavigationUi = navigationExcluded ? "original" : variant;
  }, [excluded, navigationExcluded, variant]);

  const changeVariant = (next: SiteUiVariant) => {
    document.cookie = `${SITE_UI_COOKIE}=${next}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setVariant(next);
  };

  if (excluded) return null;
  return <details className={styles.preview} data-site-ui-preview>
    <summary>Essai des contours</summary>
    <div className={styles.panel}>
      <p>Comparer les boutons et les cadres</p>
      <div role="group" aria-label="Style des contours">
        <button type="button" aria-pressed={variant === "original"} onClick={() => changeVariant("original")}>Original</button>
        <button type="button" aria-pressed={variant === "quartier"} onClick={() => changeVariant("quartier")}>Style du jeu</button>
      </div>
    </div>
  </details>;
}
