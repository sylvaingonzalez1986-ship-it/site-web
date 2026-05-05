"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

type VivaPaymentReturnEffectsProps = {
  clearCart?: boolean;
};

export function VivaPaymentReturnEffects({
  clearCart: shouldClearCart = false,
}: VivaPaymentReturnEffectsProps) {
  const { clearCart, refreshSession } = useCart();

  useEffect(() => {
    if (shouldClearCart) {
      clearCart();
    }

    void refreshSession({ silent: true, force: true });
  }, [clearCart, refreshSession, shouldClearCart]);

  return null;
}
