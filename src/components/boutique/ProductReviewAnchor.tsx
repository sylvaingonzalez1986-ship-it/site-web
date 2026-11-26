"use client";

import { useEffect } from "react";

export function ProductReviewAnchor({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const key = "shop:review-anchor";
      const stored = sessionStorage.getItem(key);
      if (!stored) return;
      sessionStorage.removeItem(key);
      const [source, at] = JSON.parse(stored);
      if (typeof source !== "string" || typeof at !== "number" || Date.now() - at > 60_000 ||
          location.hash || source === location.pathname || !source.startsWith("/boutique/") ||
          source.split("/").at(-1) !== productId) return;
      history.replaceState(history.state, "", location.pathname + location.search + "#avis-degustation");
      document.getElementById("avis-degustation")?.scrollIntoView();
    } catch {
      // The canonical page also works when the browser disallows storage.
    }
  }, [productId]);
  return null;
}
