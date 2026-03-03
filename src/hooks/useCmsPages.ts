"use client";

import { useEffect, useMemo, useState } from "react";
import { isCmsPagesEnabledClient } from "@/lib/cms-pages-feature";
import type { CmsPage } from "@/types/cms-pages";

let cmsPagesCache: CmsPage[] | null = null;
let cmsPagesPromise: Promise<CmsPage[]> | null = null;

async function loadCmsPages(): Promise<CmsPage[]> {
  if (cmsPagesCache) {
    return cmsPagesCache;
  }

  if (!cmsPagesPromise) {
    cmsPagesPromise = fetch("/api/public/pages", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }

        const data = (await response.json()) as { pages?: CmsPage[] };
        return Array.isArray(data.pages) ? data.pages : [];
      })
      .catch(() => [])
      .then((pages) => {
        cmsPagesCache = pages;
        return pages;
      })
      .finally(() => {
        cmsPagesPromise = null;
      });
  }

  return cmsPagesPromise;
}

export function useCmsPages() {
  const [pages, setPages] = useState<CmsPage[]>(cmsPagesCache ?? []);
  const [loading, setLoading] = useState(false);
  const enabled = useMemo(() => isCmsPagesEnabledClient(), []);

  useEffect(() => {
    if (!enabled) {
      setPages([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    if (cmsPagesCache) {
      setPages(cmsPagesCache);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);

    const load = async () => {
      const data = await loadCmsPages();
      if (mounted) {
        setPages(data);
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { pages, loading, enabled };
}
