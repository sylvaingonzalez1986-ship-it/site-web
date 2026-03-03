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

let publicStoreCache: PublicStoreResponse | null = null;
let publicStorePromise: Promise<PublicStoreResponse> | null = null;

async function loadPublicStore(): Promise<PublicStoreResponse> {
  if (publicStoreCache) {
    return publicStoreCache;
  }

  if (!publicStorePromise) {
    publicStorePromise = fetch("/api/public/store", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          return defaultPublicStore;
        }

        const data = (await response.json()) as PublicStoreResponse;
        return data;
      })
      .catch(() => defaultPublicStore)
      .then((data) => {
        publicStoreCache = data;
        return data;
      })
      .finally(() => {
        publicStorePromise = null;
      });
  }

  return publicStorePromise;
}

export function useCmsStore() {
  const [store, setStore] = useState<PublicStoreResponse>(publicStoreCache ?? defaultPublicStore);
  const [loading, setLoading] = useState(publicStoreCache === null);

  useEffect(() => {
    let mounted = true;

    if (publicStoreCache) {
      setStore(publicStoreCache);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const load = async () => {
      const data = await loadPublicStore();
      if (mounted) {
        setStore(data);
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { store, loading, setStore };
}
