"use client";

import { useState } from "react";

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
  shipping: CheckoutShippingPayload;
  promoCode?: string;
  lotteryTicketId?: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

export function CheckoutButton({
  amount,
  amountToPay,
  itemsCount,
  items,
  shipping,
  promoCode,
  lotteryTicketId,
  disabled = false,
  onSuccess,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
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
          lotteryTicketId: lotteryTicketId || undefined,
        }),
      });

      const data = (await response.json()) as {
        redirectUrl?: string;
        error?: string;
        message?: string;
        orderId?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Le checkout Viva n est pas configure.");
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setSuccess(data.orderId ? `Commande ${data.orderId} enregistree.` : "Commande enregistree.");
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
        className="btn-cartoon btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Connexion a Viva..."
          : `Payer ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amountToPay)} avec Viva`}
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold text-green-700">{success}</p>}
    </div>
  );
}
