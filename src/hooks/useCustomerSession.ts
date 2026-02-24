"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type { CmsOrder } from "@/types/store";
import type { PublicCustomer } from "@/types/customer";
import type { LotteryConfig, LotteryTicket } from "@/types/lottery";
import type { LoyaltySummary } from "@/types/loyalty";

export function useCustomerSession() {
  const pathname = usePathname();
  const [user, setUser] = useState<PublicCustomer | null>(null);
  const [orders, setOrders] = useState<CmsOrder[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [lotteryConfig, setLotteryConfig] = useState<LotteryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
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
          config?: LotteryConfig | null;
        };
        setTickets(ticketsData.tickets ?? []);
        setLotteryConfig(ticketsData.config ?? null);
      } else {
        setTickets([]);
        setLotteryConfig(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
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
    lotteryConfig,
    availableTicketCount: tickets.filter((ticket) => ticket.status === "available").length,
    loading,
    refresh,
    setUser,
    setOrders,
  };
}
