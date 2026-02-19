"use client";

import { useEffect, useState } from "react";
import { defaultStore } from "@/data/default-store";
import type { PublicStoreResponse } from "@/types/store";

const defaultPublicStore: PublicStoreResponse = {
  content: defaultStore.content,
  sections: defaultStore.sections,
  products: [],
  blog: [],
  producers: [],
  updatedAt: defaultStore.updatedAt,
};

export function useCmsStore() {
  const [store, setStore] = useState<PublicStoreResponse>(defaultPublicStore);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/public/store", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as PublicStoreResponse;
        if (mounted) {
          setStore(data);
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
  }, []);

  return { store, loading, setStore };
}
