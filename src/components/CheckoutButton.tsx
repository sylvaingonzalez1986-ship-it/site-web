"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@vercel/analytics/react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { saveCartToSession, type StoredCartLine } from "@/lib/cart-session-storage";
import {
  savePendingVivaPayment,
  VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY,
} from "@/lib/pending-viva-payment";
import { formatPrice } from "@/lib/utils";
import { createClientRequestKey } from "@/lib/client-request-key";
import { saveBitcoinCart } from "@/lib/bitcoin-cart";

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
  validateDelivery: () => boolean;
  onSuccess?: () => void;
};

type PaymentMethod = "card" | "bitcoin_lightning";
type BitcoinAvailability = "loading" | "enabled" | "disabled" | "error";

const bitcoinAvailabilityCopy = {
  loading: "Vérification de la disponibilité de Bitcoin…",
  enabled: "Swiss Bitcoin Pay affiche le montant en sats avant le paiement.",
  disabled: "Le paiement Bitcoin est actuellement désactivé.",
  error: "La disponibilité de Bitcoin n’a pas pu être vérifiée.",
} satisfies Record<BitcoinAvailability, string>;

const bitcoinResumePattern = /^\/checkout\/bitcoin\/[\w-]{1,120}$/;
const cardResumePattern = /^\/api\/account\/orders\/[\w-]{1,120}\/resume-payment$/;

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
  validateDelivery,
  onSuccess,
}: CheckoutButtonProps) {
  const { hasConsent } = useCookieConsent();
  const methodName = useId();
  const checkoutRequest = useRef<AbortController | null>(null);
  const [bitcoinAvailability, setBitcoinAvailability] = useState<BitcoinAvailability>("loading");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const amountInCents = Math.round(amountToPay * 100);
  const hasPayableAmount = Number.isSafeInteger(amountInCents) && amountInCents > 0;
  const paymentMethod = hasPayableAmount &&
    (selectedMethod !== "bitcoin_lightning" || bitcoinAvailability === "enabled") ? selectedMethod : null;
  const canSubmit = !loading && itemsCount > 0 && !disabled && Boolean(paymentMethod);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/checkout/bitcoin", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { enabled?: boolean };
        if (typeof data.enabled !== "boolean") throw new Error();
        if (!controller.signal.aborted) setBitcoinAvailability(data.enabled ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!controller.signal.aborted) setBitcoinAvailability("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => checkoutRequest.current?.abort(), []);

  const handleCheckout = async () => {
    if (checkoutRequest.current || !canSubmit || !paymentMethod) return;
    setError(null);
    setResumeUrl(null);
    setSuccess(null);
    if (!validateDelivery()) return;
    const controller = new AbortController();
    checkoutRequest.current = controller;
    setLoading(true);
    if (hasConsent("analytics")) {
      track("checkout_payment_clicked", {
        amount: amountToPay,
        itemsCount,
        deliveryMethod: shipping.deliveryMethod ?? "home",
      });
    }

    try {
      saveCartToSession(window.sessionStorage, cartSnapshot);
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
      const startNewAttempt = () => {
        const attemptId = createClientRequestKey();
        window.sessionStorage.setItem(
          VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY,
          JSON.stringify({ signature: attemptSignature, attemptId }),
        );
        return attemptId;
      };
      if (!checkoutAttemptId) checkoutAttemptId = startNewAttempt();

      const checkoutPayload = {
        action: "checkout",
        paymentMethod,
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
      };
      const sendAttempt = async (attemptId: string) => {
        const response = await fetch("/api/checkout/viva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...checkoutPayload, checkoutAttemptId: attemptId }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          redirectUrl?: string;
          error?: string;
          orderId?: string;
          resumed?: boolean;
          code?: string;
          resumeUrl?: string;
        };
        return { response, data };
      };

      let { response, data } = await sendAttempt(checkoutAttemptId);
      let restarted = false;
      let busyRetries = 0;
      while (response.status === 409) {
        if (data.code === "checkout_attempt_archived" && !restarted) {
          checkoutAttemptId = startNewAttempt();
          restarted = true;
        } else if (data.code === "checkout_attempt_busy" && busyRetries < 2) {
          busyRetries += 1;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 3_000));
        } else {
          break;
        }
        controller.signal.throwIfAborted();
        ({ response, data } = await sendAttempt(checkoutAttemptId));
      }

      if (!response.ok) {
        if (response.status === 409 && data.code === "checkout_method_conflict") {
          if (data.resumeUrl && (bitcoinResumePattern.test(data.resumeUrl) || cardResumePattern.test(data.resumeUrl))) {
            setResumeUrl(data.resumeUrl);
          }
          setError(data.error ?? "Un paiement est déjà en cours avec l’autre moyen de paiement.");
          return;
        }
        if (data.code === "checkout_attempt_completed" || data.code === "checkout_attempt_archived") {
          window.sessionStorage.removeItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY);
        }
        if (hasConsent("analytics")) {
          track("checkout_payment_error", { status: response.status });
        }
        throw new Error(data.error ?? "Le paiement est temporairement indisponible.");
      }

      if (data.redirectUrl) {
        const isBitcoinCheckout = data.redirectUrl.startsWith("/checkout/bitcoin/");
        if (isBitcoinCheckout !== (paymentMethod === "bitcoin_lightning")) {
          if (data.orderId) {
            const orderPath = encodeURIComponent(data.orderId);
            setResumeUrl(isBitcoinCheckout
              ? `/checkout/bitcoin/${orderPath}` : `/api/account/orders/${orderPath}/resume-payment`);
          }
          setError("Un paiement est déjà en cours avec l’autre moyen de paiement.");
          return;
        }
        if (data.orderId && isBitcoinCheckout) {
          saveBitcoinCart(data.orderId, checkoutAttemptId, cartSnapshot);
        } else if (data.orderId) {
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
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      checkoutRequest.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const selectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
    setResumeUrl(null);
  };
  const bitcoinDescriptionId = `${methodName}-bitcoin`;
  const paymentDescriptionId = `${methodName}-information`;

  return (
    <div>
      <fieldset
        data-checkout-payment-methods
        tabIndex={-1}
        className="mb-3 grid gap-1"
        disabled={loading || !hasPayableAmount}
        aria-describedby={paymentDescriptionId}
      >
        <legend className="mb-1 text-sm font-bold text-ink">Choisis ton moyen de paiement</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="radio"
            name={methodName}
            value="card"
            checked={paymentMethod === "card"}
            onChange={() => selectMethod("card")}
          />
          Carte bancaire (Viva)
        </label>
        <label className={`flex min-h-11 items-center gap-2 text-sm font-semibold text-ink ${bitcoinAvailability === "enabled" ? "cursor-pointer" : "cursor-not-allowed"}`}>
          <input
            type="radio"
            name={methodName}
            value="bitcoin_lightning"
            checked={paymentMethod === "bitcoin_lightning"}
            disabled={bitcoinAvailability !== "enabled"}
            aria-describedby={bitcoinDescriptionId}
            onChange={() => selectMethod("bitcoin_lightning")}
          />
          Bitcoin — Lightning
        </label>
        <p id={bitcoinDescriptionId} role="status" className="text-xs text-charcoal">
          {bitcoinAvailabilityCopy[bitcoinAvailability]}
        </p>
      </fieldset>
      <button data-ui-commerce="primary" data-ui-shape="control"
        type="button"
        onClick={handleCheckout}
        disabled={!canSubmit}
        aria-busy={loading}
        aria-describedby={paymentDescriptionId}
        className="btn-cartoon btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Préparation du paiement…"
          : `Payer ${formatPrice(amountToPay)}`}
      </button>
      <p id={paymentDescriptionId} className="mt-2 text-center text-xs font-semibold leading-relaxed text-charcoal">
        {!hasPayableAmount
          ? "Le total doit être supérieur à 0 € pour lancer un paiement. Vérifie le récapitulatif."
          : paymentMethod
          ? "En cliquant, tu confirmes une commande avec obligation de paiement."
          : "Sélectionne un moyen de paiement pour continuer."}
      </p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      {resumeUrl && (
        <a
          href={resumeUrl}
          className="btn-cartoon btn-secondary mt-2 inline-flex min-h-11 items-center text-center"
        >
          {bitcoinResumePattern.test(resumeUrl) ? "Reprendre le paiement Bitcoin" : "Reprendre le paiement par carte"}
        </a>
      )}
      {success && <p role="status" className="mt-2 text-sm font-semibold text-green-700">{success}</p>}
    </div>
  );
}
