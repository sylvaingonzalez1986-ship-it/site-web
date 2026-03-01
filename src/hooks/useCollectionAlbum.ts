"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LotteryCollectionAlbum } from "@/types/lottery";

type UseCollectionAlbumReturn = {
  album: LotteryCollectionAlbum | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  claimPageReward: (cardRarity: string, rewardDefinitionId: string) => Promise<{ claimId: string }>;
  burnDuplicates: (
    cardRarity: string,
    instanceIds: string[],
    rewardDefinitionId: string,
  ) => Promise<{ claimId: string }>;
};

export function useCollectionAlbum(): UseCollectionAlbumReturn {
  const [album, setAlbum] = useState<LotteryCollectionAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAlbum = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/account/collection", { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${response.status}`);
      }
      const data: LotteryCollectionAlbum = await response.json();
      setAlbum(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Impossible de charger la collection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbum();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchAlbum]);

  const claimPageReward = useCallback(
    async (cardRarity: string, rewardDefinitionId: string) => {
      const response = await fetch("/api/account/collection/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardRarity, rewardDefinitionId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${response.status}`);
      }
      const result = await response.json();
      // Refresh album state after claim
      await fetchAlbum();
      return result as { claimId: string };
    },
    [fetchAlbum],
  );

  const burnDuplicates = useCallback(
    async (cardRarity: string, instanceIds: string[], rewardDefinitionId: string) => {
      const response = await fetch("/api/account/collection/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardRarity, instanceIds, rewardDefinitionId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${response.status}`);
      }
      const result = await response.json();
      // Refresh album state after burn
      await fetchAlbum();
      return result as { claimId: string };
    },
    [fetchAlbum],
  );

  return { album, loading, error, refresh: fetchAlbum, claimPageReward, burnDuplicates };
}
