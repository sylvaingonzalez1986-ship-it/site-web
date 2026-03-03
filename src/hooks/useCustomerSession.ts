"use client";

import { useCart } from "@/context/CartContext";

export function useCustomerSession() {
  const {
    user,
    orders,
    loyalty,
    tickets,
    lotteryInventory,
    lotteryConfig,
    availableTicketCount,
    sessionLoading,
    refreshSession,
    setUser,
    setOrders,
  } = useCart();

  return {
    user,
    orders,
    loyalty,
    tickets,
    lotteryInventory,
    lotteryConfig,
    availableTicketCount,
    loading: sessionLoading,
    refresh: refreshSession,
    setUser,
    setOrders,
  };
}
