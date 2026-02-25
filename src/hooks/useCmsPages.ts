"use client";

import { useEffect, useMemo, useState } from "react";
import { isCmsPagesEnabledClient } from "@/lib/cms-pages-feature";
import type { CmsPage } from "@/types/cms-pages";

export function useCmsPages() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(false);
  const enabled = useMemo(() => isCmsPagesEnabledClient(), []);

  useEffect(() => {
    if (!enabled) {
      setPages([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const load = async () => {
      try {
        const response = await fetch("/api/public/pages", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { pages?: CmsPage[] };
        if (mounted) {
          setPages(Array.isArray(data.pages) ? data.pages : []);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { pages, loading, enabled };
}
