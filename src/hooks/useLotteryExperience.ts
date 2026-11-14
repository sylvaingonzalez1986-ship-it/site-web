"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type {
  LotteryBurnableRarity,
  LotteryBonusInstance,
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
  bonuses?: LotteryBonusInstance[];
  loyalty?: LoyaltySummary;
  error?: string;
};

type CollectionPayload = LotteryCollectionAlbum & {
  error?: string;
};

type PublicCollectionPreviewPayload = {
  album?: LotteryCollectionAlbum | null;
  config?: LotteryConfig | null;
  error?: string;
};

type LotteryExperienceState = {
  tickets: LotteryTicket[];
  inventory: LotteryInventory | null;
  config: LotteryConfig | null;
  bonuses: LotteryBonusInstance[];
  loyalty: LoyaltySummary;
  ticketsLoaded: boolean;
  ticketsReady: boolean;
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
  const { isAuthenticated, authLoading, user } = useCart();
  const requestId = useRef(0);
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [inventory, setInventory] = useState<LotteryInventory | null>(null);
  const [config, setConfig] = useState<LotteryConfig | null>(null);
  const [bonuses, setBonuses] = useState<LotteryBonusInstance[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [ticketsReady, setTicketsReady] = useState(false);
  const [album, setAlbum] = useState<LotteryCollectionAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const refreshAll = useCallback(async (options?: { silent?: boolean }) => {
    if (authLoading) {
      return;
    }

    const silent = options?.silent === true;
    const currentRequest = ++requestId.current;
    if (!silent) {
      setLoading(true);
    }

    try {
      if (!isAuthenticated) {
        const response = await fetch("/api/public/collection-preview", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as PublicCollectionPreviewPayload | null;
        if (currentRequest !== requestId.current) return;

        if (!response.ok || !payload?.album) {
          throw new Error(payload?.error ?? "Impossible de charger l'album.");
        }

        setTickets([]);
        setInventory(null);
        setBonuses([]);
        setLoyalty(buildEmptyLoyaltySummary());
        setTicketsLoaded(false);
        setTicketsReady(false);
        setConfig(payload.config ?? null);
        setAlbum(payload.album);
        setError(null);
        return;
      }

      const [ticketsResult, collectionResult] = await Promise.allSettled([
        fetch("/api/account/tickets", { cache: "no-store" }),
        fetch("/api/account/collection", { cache: "no-store" }),
      ]);

      const ticketsResponse = ticketsResult.status === "fulfilled" ? ticketsResult.value : null;
      const collectionResponse = collectionResult.status === "fulfilled" ? collectionResult.value : null;
      const ticketsBody = (await ticketsResponse?.json().catch(() => null)) as TicketsPayload | null;
      const collectionBody = (await collectionResponse?.json().catch(() => null)) as CollectionPayload | null;
      if (currentRequest !== requestId.current) return;

      const validTickets = ticketsResponse?.ok && Array.isArray(ticketsBody?.tickets)
        && Number.isFinite(ticketsBody?.loyalty?.spendablePoints)
        && (ticketsBody?.loyalty?.spendablePoints ?? -1) >= 0;
      const validCollection = collectionResponse?.ok && Array.isArray(collectionBody?.pages) && collectionBody?.summary;

      if (validTickets && ticketsBody?.loyalty && ticketsBody.tickets) {
        setTickets(ticketsBody.tickets);
        setInventory(ticketsBody?.inventory ?? null);
        setConfig(ticketsBody?.config ?? null);
        setBonuses(ticketsBody?.bonuses ?? []);
        setLoyalty(ticketsBody.loyalty);
        setTicketsLoaded(true);
        setTicketsReady(true);
      } else {
        // A failed read is not an empty wallet or an empty pack inventory.
        setTicketsReady(false);
      }

      if (validCollection) {
        setAlbum(collectionBody ?? null);
      }

      if (!validTickets) {
        setError(ticketsBody?.error ?? "Impossible de charger tes points et tes boosters. Réessaie.");
      } else if (!validCollection) {
        setError(collectionBody?.error ?? "Impossible de charger l'album.");
      } else {
        setError(null);
      }
    } catch (refreshError) {
      if (currentRequest !== requestId.current) return;
      setTicketsReady(false);
      const message =
        refreshError instanceof Error ? refreshError.message : "Impossible de charger l'experience TCG.";
      setError(message);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    // Reset ownership when the account changes, and ignore late responses from it.
    setTickets([]);
    setInventory(null);
    setBonuses([]);
    setLoyalty(buildEmptyLoyaltySummary());
    setTicketsLoaded(false);
    setTicketsReady(false);
    setAlbum(null);
    void refreshAll();
    return () => { requestId.current += 1; };
  }, [authLoading, refreshAll, user?.id]);

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
    bonuses,
    loyalty,
    ticketsLoaded,
    ticketsReady,
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
