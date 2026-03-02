"use client";

import { useCallback, useEffect, useState } from "react";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type {
  LotteryBurnableRarity,
  LotteryCollectionAlbum,
  LotteryCollectionPageRarity,
  LotteryConfig,
  LotteryDuplicateBurnChoice,
  LotteryInventory,
  LotteryRewardClaim,
  LotteryTicket,
  ScratchResult,
} from "@/types/lottery";
import type { LoyaltySummary } from "@/types/loyalty";

type TicketsPayload = {
  tickets?: LotteryTicket[];
  inventory?: LotteryInventory | null;
  config?: LotteryConfig | null;
  loyalty?: LoyaltySummary;
  error?: string;
};

type CollectionPayload = LotteryCollectionAlbum & {
  error?: string;
};

type LotteryExperienceState = {
  tickets: LotteryTicket[];
  inventory: LotteryInventory | null;
  config: LotteryConfig | null;
  loyalty: LoyaltySummary;
  album: LotteryCollectionAlbum | null;
  loading: boolean;
  error: string | null;
  acting: boolean;
  refreshAll: (options?: { silent?: boolean }) => Promise<void>;
  purchasePacksWithPoints: (packCount: number) => Promise<number>;
  openPack: (ticketId: string) => Promise<ScratchResult>;
  claimPageReward: (
    pageRarity: LotteryCollectionPageRarity,
    rewardDefinitionId: string,
  ) => Promise<LotteryRewardClaim>;
  burnDuplicates: (
    rarity: LotteryBurnableRarity,
    instanceIds: string[],
    rewardChoice: LotteryDuplicateBurnChoice,
  ) => Promise<LotteryRewardClaim>;
};

export function useLotteryExperience(): LotteryExperienceState {
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [inventory, setInventory] = useState<LotteryInventory | null>(null);
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [album, setAlbum] = useState<LotteryCollectionAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const refreshAll = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const [ticketsResponse, collectionResponse] = await Promise.all([
        fetch("/api/account/tickets", { cache: "no-store" }),
        fetch("/api/account/collection", { cache: "no-store" }),
      ]);

      const ticketsBody = (await ticketsResponse.json().catch(() => null)) as TicketsPayload | null;
      const collectionBody = (await collectionResponse.json().catch(() => null)) as CollectionPayload | null;

      if (!ticketsResponse.ok && !collectionResponse.ok) {
        throw new Error(
          ticketsBody?.error ?? collectionBody?.error ?? "Impossible de charger l'experience TCG.",
        );
      }

      if (ticketsResponse.ok) {
        setTickets(ticketsBody?.tickets ?? []);
        setInventory(ticketsBody?.inventory ?? null);
        setConfig(ticketsBody?.config ?? null);
        setLoyalty(ticketsBody?.loyalty ?? buildEmptyLoyaltySummary());
      }

      if (collectionResponse.ok) {
        setAlbum(collectionBody ?? null);
      }

      if (!ticketsResponse.ok) {
        setError(ticketsBody?.error ?? "Impossible de charger les boosters.");
        setLoyalty(buildEmptyLoyaltySummary());
      } else if (!collectionResponse.ok) {
        setError(collectionBody?.error ?? "Impossible de charger l'album.");
      }
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : "Impossible de charger l'experience TCG.";
      setError(message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const openPack = useCallback(
    async (ticketId: string): Promise<ScratchResult> => {
      setActing(true);
      try {
        const response = await fetch(`/api/account/tickets/${encodeURIComponent(ticketId)}/scratch`, {
          method: "POST",
        });

        const payload = (await response.json()) as ScratchResult & { error?: string };
        if (!response.ok || !payload.ticketId) {
          throw new Error(payload.error ?? "Impossible d'ouvrir ce pack.");
        }

        setTickets((current) =>
          current.map((ticket) =>
            ticket.id === payload.ticketId
              ? {
                  ...ticket,
                  status: "scratched",
                  cardDefinitionId: payload.card.id,
                  cardRarity: payload.card.rarity,
                  scratchedAt: payload.scratchedAt,
                  card: payload.card,
                  cards: payload.cards,
                }
              : ticket,
          ),
        );

        void refreshAll({ silent: true });
        return payload;
      } finally {
        setActing(false);
      }
    },
    [refreshAll],
  );

  const purchasePacksWithPoints = useCallback(
    async (packCount: number): Promise<number> => {
      setActing(true);
      try {
        const response = await fetch("/api/account/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packCount }),
        });

        const payload = (await response.json()) as { granted?: number; error?: string };
        if (!response.ok || !Number.isInteger(payload.granted)) {
          throw new Error(payload.error ?? "Achat packs impossible.");
        }

        await refreshAll({ silent: true });
        return Math.max(0, payload.granted ?? 0);
      } finally {
        setActing(false);
      }
    },
    [refreshAll],
  );

  const claimPageReward = useCallback(
    async (pageRarity: LotteryCollectionPageRarity, rewardDefinitionId: string): Promise<LotteryRewardClaim> => {
      setActing(true);
      try {
        const response = await fetch("/api/account/collection/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageRarity, rewardDefinitionId }),
        });

        const payload = (await response.json()) as { claim?: LotteryRewardClaim; error?: string };
        if (!response.ok || !payload.claim) {
          throw new Error(payload.error ?? "Reclamation impossible.");
        }

        await refreshAll({ silent: true });
        return payload.claim;
      } finally {
        setActing(false);
      }
    },
    [refreshAll],
  );

  const burnDuplicates = useCallback(
    async (
      rarity: LotteryBurnableRarity,
      instanceIds: string[],
      rewardChoice: LotteryDuplicateBurnChoice,
    ): Promise<LotteryRewardClaim> => {
      setActing(true);
      try {
        const response = await fetch("/api/account/collection/burn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rarity, instanceIds, rewardChoice }),
        });

        const payload = (await response.json()) as { claim?: LotteryRewardClaim; error?: string };
        if (!response.ok || !payload.claim) {
          throw new Error(payload.error ?? "Recyclage impossible.");
        }

        await refreshAll({ silent: true });
        return payload.claim;
      } finally {
        setActing(false);
      }
    },
    [refreshAll],
  );

  return {
    tickets,
    inventory,
    config,
    loyalty,
    album,
    loading,
    error,
    acting,
    refreshAll,
    purchasePacksWithPoints,
    openPack,
    claimPageReward,
    burnDuplicates,
  };
}
