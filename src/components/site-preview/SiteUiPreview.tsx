"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSiteUiVariants, SITE_UI_COOKIE, type SiteUiVariant } from "@/lib/site-ui-preview";
import styles from "./SiteUiPreview.module.css";

export function SiteUiPreview({ initialVariant, enabled }: { initialVariant: SiteUiVariant; enabled: boolean }) {
  const pathname = usePathname();
  const [variant, setVariant] = useState(initialVariant);
  const ui = getSiteUiVariants(pathname, enabled ? variant : "quartier");
  useLayoutEffect(() => {
    document.documentElement.dataset.siteUi = ui.content;
    document.documentElement.dataset.siteNavigationUi = ui.navigation;
  }, [ui.content, ui.navigation]);

  const changeVariant = (next: SiteUiVariant) => {
    document.cookie = `${SITE_UI_COOKIE}=${next}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setVariant(next);
  };

  if (!enabled || !ui.allowPreview) return null;
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
