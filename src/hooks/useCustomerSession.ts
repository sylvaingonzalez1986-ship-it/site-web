"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type { CmsOrder } from "@/types/store";
import type { PublicCustomer } from "@/types/customer";
import type { LotteryConfig, LotteryInventory, LotteryTicket } from "@/types/lottery";
import type { LoyaltySummary } from "@/types/loyalty";

export function useCustomerSession() {
  const REFRESH_COOLDOWN_MS = 30_000;
  const pathname = usePathname();
  const lastRefreshAtRef = useRef(0);
  const [user, setUser] = useState<PublicCustomer | null>(null);
  const [orders, setOrders] = useState<CmsOrder[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [lotteryInventory, setLotteryInventory] = useState<LotteryInventory | null>(null);
  const [lotteryConfig, setLotteryConfig] = useState<LotteryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const silent = options?.silent === true;
    const force = options?.force === true;
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < REFRESH_COOLDOWN_MS) {
      return;
    }
    lastRefreshAtRef.current = now;

    if (!silent) {
      setLoading(true);
    }

    try {
      const meResponse = await fetch("/api/account/me", { cache: "no-store" });

      if (!meResponse.ok) {
        setUser(null);
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
        setTickets([]);
        setLotteryInventory(null);
        setLotteryConfig(null);
        return;
      }

      const meData = (await meResponse.json()) as { user: PublicCustomer };
      setUser(meData.user);

      const ordersResponse = await fetch("/api/account/orders", { cache: "no-store" });
      if (ordersResponse.ok) {
        const ordersData = (await ordersResponse.json()) as {
          orders: CmsOrder[];
          loyalty?: LoyaltySummary;
        };
        setOrders(ordersData.orders);
        setLoyalty(ordersData.loyalty ?? buildEmptyLoyaltySummary());
      } else {
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
      }

      const ticketsResponse = await fetch("/api/account/tickets", { cache: "no-store" });
      if (ticketsResponse.ok) {
        const ticketsData = (await ticketsResponse.json()) as {
          tickets?: LotteryTicket[];
          inventory?: LotteryInventory | null;
          config?: LotteryConfig | null;
        };
        setTickets(ticketsData.tickets ?? []);
        setLotteryInventory(ticketsData.inventory ?? null);
        setLotteryConfig(ticketsData.config ?? null);
      } else {
        setTickets([]);
        setLotteryInventory(null);
        setLotteryConfig(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh({ force: true });
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void refresh({ silent: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return {
    user,
    orders,
    loyalty,
    tickets,
    lotteryInventory,
    lotteryConfig,
    availableTicketCount: tickets.filter((ticket) => ticket.status === "available").length,
    loading,
    refresh,
    setUser,
    setOrders,
  };
}
