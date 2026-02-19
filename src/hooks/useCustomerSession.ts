"use client";

import { useEffect, useState } from "react";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type { CmsOrder } from "@/types/store";
import type { PublicCustomer } from "@/types/customer";
import type { LoyaltySummary } from "@/types/loyalty";

export function useCustomerSession() {
  const [user, setUser] = useState<PublicCustomer | null>(null);
  const [orders, setOrders] = useState<CmsOrder[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(buildEmptyLoyaltySummary());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);

    try {
      const meResponse = await fetch("/api/account/me", { cache: "no-store" });

      if (!meResponse.ok) {
        setUser(null);
        setOrders([]);
        setLoyalty(buildEmptyLoyaltySummary());
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    user,
    orders,
    loyalty,
    loading,
    refresh,
    setUser,
    setOrders,
  };
}
