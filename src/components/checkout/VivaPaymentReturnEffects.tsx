"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import Link from "@/components/navigation/NavigationLink";
import { useCart } from "@/context/CartContext";
import { consumePaidBitcoinCart } from "@/lib/bitcoin-cart";
import { clearPendingVivaPayment } from "@/lib/pending-viva-payment";

type VivaPaymentReturnEffectsProps = {
  clearCart?: boolean;
  bitcoinOrderId?: string;
  pollPayment?: boolean;
  statusUnavailable?: boolean;
};

export function VivaPaymentReturnEffects({
  clearCart: shouldClearCart = false,
  bitcoinOrderId,
  pollPayment = false,
  statusUnavailable = false,
}: VivaPaymentReturnEffectsProps) {
  const { cartLoading, clearCart, items, refreshSession } = useCart();
  const processed = useRef(false);
  const router = useRouter();
  const refreshRef = useRef(router.refresh);
  const [waitExpired, setWaitExpired] = useState(false);
  const [checking, startChecking] = useTransition();
  useEffect(() => { refreshRef.current = router.refresh; }, [router]);

  useEffect(() => {
    if (processed.current || (shouldClearCart && bitcoinOrderId && cartLoading)) return;
    if (shouldClearCart) {
      if (bitcoinOrderId) consumePaidBitcoinCart(bitcoinOrderId, items, clearCart);
      else clearCart();
      clearPendingVivaPayment(window.sessionStorage);
      processed.current = true;
    }

    void refreshSession({ silent: true, force: true });
  }, [bitcoinOrderId, cartLoading, clearCart, items, refreshSession, shouldClearCart]);

  useEffect(() => {
    if (!pollPayment) return;
    let refreshCount = 0;
    const intervalId = window.setInterval(() => {
      refreshCount += 1;
      refreshRef.current();
      if (refreshCount >= 10) {
        window.clearInterval(intervalId);
        setWaitExpired(true);
      }
    }, 2_000);
    return () => window.clearInterval(intervalId);
  }, [pollPayment]);

  if ((!pollPayment || !waitExpired) && !statusUnavailable) return null;

  return (
    <div className="mt-5 border-2 border-[#6f4b00] bg-[#fff5da] p-4 text-sm text-[#6f4b00]">
      <p role="status">{statusUnavailable ? "Le statut de ta commande n’est pas disponible pour le moment." : "La confirmation prend plus de temps que prévu."} Ne repasse pas de commande : tu peux vérifier son statut ou la retrouver dans ton profil.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-cartoon btn-secondary min-h-12" disabled={checking} aria-busy={checking} onClick={() => startChecking(() => router.refresh())}>
          {checking ? "Vérification…" : "Vérifier le statut"}
        </button>
        <Link href="/profil?tab=commandes" className="btn-cartoon btn-secondary inline-flex min-h-12 items-center">Voir mes commandes</Link>
      </div>
    </div>
  );
}
