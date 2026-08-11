"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { clearPendingVivaPayment } from "@/lib/pending-viva-payment";

type VivaPaymentReturnEffectsProps = {
  clearCart?: boolean;
  pollPayment?: boolean;
};

export function VivaPaymentReturnEffects({
  clearCart: shouldClearCart = false,
  pollPayment = false,
}: VivaPaymentReturnEffectsProps) {
  const { clearCart, refreshSession } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (shouldClearCart) {
      clearCart();
      clearPendingVivaPayment(window.sessionStorage);
    }

    void refreshSession({ silent: true, force: true });
  }, [clearCart, refreshSession, shouldClearCart]);

  useEffect(() => {
    if (!pollPayment) return;
    let refreshCount = 0;
    const intervalId = window.setInterval(() => {
      refreshCount += 1;
      router.refresh();
      if (refreshCount >= 10) {
        window.clearInterval(intervalId);
      }
    }, 2_000);
    return () => window.clearInterval(intervalId);
  }, [pollPayment, router]);

  return null;
}
