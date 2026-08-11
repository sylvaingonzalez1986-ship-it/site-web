"use client";

import { useState } from "react";
import { track } from "@vercel/analytics/react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { saveCartToSession, type StoredCartLine } from "@/lib/cart-session-storage";
import {
  savePendingVivaPayment,
  VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY,
} from "@/lib/pending-viva-payment";
import { formatPrice } from "@/lib/utils";

type CheckoutItemPayload = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type CheckoutShippingPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  deliveryMethod?: "home" | "relay";
  deliveryFeeEur?: number;
  relayId?: string;
  relayName?: string;
  relayAddress?: string;
  relayPostalCode?: string;
  relayCity?: string;
  relayCountry?: string;
};

type CheckoutButtonProps = {
  amount: number;
  amountToPay: number;
  itemsCount: number;
  items: CheckoutItemPayload[];
  cartSnapshot: StoredCartLine[];
  shipping: CheckoutShippingPayload;
  promoCode?: string;
  lotteryRewardClaimId?: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

export function CheckoutButton({
  amount,
  amountToPay,
  itemsCount,
  items,
  cartSnapshot,
  shipping,
  promoCode,
  lotteryRewardClaimId,
  disabled = false,
  onSuccess,
}: CheckoutButtonProps) {
  const { hasConsent } = useCookieConsent();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCheckout = async () => {
    saveCartToSession(window.sessionStorage, cartSnapshot);
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (hasConsent("analytics")) {
      track("checkout_payment_clicked", {
        amount: amountToPay,
        itemsCount,
        deliveryMethod: shipping.deliveryMethod ?? "home",
      });
    }

    try {
      const attemptSignature = JSON.stringify({
        items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        shipping,
        promoCode: promoCode || null,
        lotteryRewardClaimId: lotteryRewardClaimId || null,
        amountToPay,
      });
      let checkoutAttemptId = "";
      try {
        const stored = JSON.parse(
          window.sessionStorage.getItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY) ?? "null",
        ) as { signature?: string; attemptId?: string } | null;
        if (stored?.signature === attemptSignature && stored.attemptId) {
          checkoutAttemptId = stored.attemptId;
        }
      } catch {
        window.sessionStorage.removeItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY);
      }
      if (!checkoutAttemptId) {
        checkoutAttemptId = window.crypto.randomUUID();
        window.sessionStorage.setItem(
          VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY,
          JSON.stringify({ signature: attemptSignature, attemptId: checkoutAttemptId }),
        );
      }

      const response = await fetch("/api/checkout/viva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "checkout",
          amount,
          itemsCount,
          items,
          shippingName: shipping.name,
          shippingEmail: shipping.email,
          shippingPhone: shipping.phone,
          shippingAddress: shipping.address,
          shippingCity: shipping.city,
          shippingPostalCode: shipping.postalCode,
          shippingCountry: shipping.country,
          deliveryMethod: shipping.deliveryMethod,
          deliveryFeeEur: shipping.deliveryFeeEur,
          relayId: shipping.relayId,
          relayName: shipping.relayName,
          relayAddress: shipping.relayAddress,
          relayPostalCode: shipping.relayPostalCode,
          relayCity: shipping.relayCity,
          relayCountry: shipping.relayCountry,
          promoCode: promoCode || undefined,
          lotteryRewardClaimId: lotteryRewardClaimId || undefined,
          checkoutAttemptId,
        }),
      });

      const data = (await response.json()) as {
        redirectUrl?: string;
        error?: string;
        message?: string;
        orderId?: string;
        resumed?: boolean;
        code?: string;
      };

      if (!response.ok) {
        if (data.code === "checkout_attempt_completed") {
          window.sessionStorage.removeItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY);
        }
        if (hasConsent("analytics")) {
          track("checkout_payment_error", { status: response.status });
        }
        throw new Error(data.error ?? "Le checkout Viva n est pas configure.");
      }

      if (data.redirectUrl) {
        if (data.orderId) {
          savePendingVivaPayment(window.sessionStorage, {
            attemptId: checkoutAttemptId,
            orderId: data.orderId,
          });
        }
        if (hasConsent("analytics")) {
          track("checkout_payment_redirected", { resumed: data.resumed === true });
        }
        window.location.href = data.redirectUrl;
        return;
      }

      setSuccess(data.orderId ? `Commande ${data.orderId} enregistrée.` : "Commande enregistrée.");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading || itemsCount === 0 || disabled}
        aria-busy={loading}
        className="btn-cartoon btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Preparation du paiement securise..."
          : `Payer ${formatPrice(amountToPay)}`}
      </button>
      <p className="mt-2 text-center text-xs font-semibold leading-relaxed text-charcoal">
        En cliquant, tu confirmes une commande avec obligation de paiement. Paiement securise
        traite par Viva.
      </p>
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold text-green-700">{success}</p>}
    </div>
  );
}
