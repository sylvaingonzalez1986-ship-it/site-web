"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import {
  clearPendingVivaPayment,
  readPendingVivaPayment,
  VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY,
  type PendingVivaPayment,
} from "@/lib/pending-viva-payment";
import { formatPrice } from "@/lib/utils";

type PaymentStatus = {
  orderId: string;
  paymentState: "pending" | "paid" | "failed" | "not_configured";
  status: string;
  totalAmount: number;
  canResume: boolean;
};

const PAYMENT_RETURN_PATH_PATTERN =
  /^\/(?:paiement|payment|checkout)(?:\/|$)|^\/(?:success|failure)$/;

export function PendingPaymentRecoveryModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearCart, refreshSession } = useCart();
  const [pendingPayment, setPendingPayment] = useState<PendingVivaPayment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [modifyingCart, setModifyingCart] = useState(false);
  const [modificationError, setModificationError] = useState("");
  const dismissedAttemptIdRef = useRef("");
  const requestInFlightRef = useRef(false);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);

  const checkPendingPayment = useCallback(async () => {
    if (requestInFlightRef.current || PAYMENT_RETURN_PATH_PATTERN.test(pathname)) return;
    const stored = readPendingVivaPayment(window.sessionStorage);
    if (!stored || dismissedAttemptIdRef.current === stored.attemptId) return;

    requestInFlightRef.current = true;
    try {
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(stored.orderId)}/payment-status`,
        { method: "GET", cache: "no-store", credentials: "same-origin" },
      );
      if (response.status === 404) {
        clearPendingVivaPayment(window.sessionStorage, stored.orderId);
        return;
      }
      if (!response.ok) return;

      const status = (await response.json()) as PaymentStatus;
      if (status.paymentState === "paid") {
        clearPendingVivaPayment(window.sessionStorage, stored.orderId);
        clearCart();
        void refreshSession({ silent: true, force: true });
        setPendingPayment(null);
        setPaymentStatus(null);
        return;
      }
      if (!status.canResume) {
        clearPendingVivaPayment(window.sessionStorage, stored.orderId);
        return;
      }

      setPendingPayment(stored);
      setPaymentStatus(status);
    } catch {
      // Keep the local marker: a focus/pageshow event will retry the safe status check.
    } finally {
      requestInFlightRef.current = false;
    }
  }, [clearCart, pathname, refreshSession]);

  useEffect(() => {
    void checkPendingPayment();
    const onPageShow = () => void checkPendingPayment();
    const onFocus = () => void checkPendingPayment();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkPendingPayment();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkPendingPayment]);

  useEffect(() => {
    if (pendingPayment && paymentStatus) primaryActionRef.current?.focus();
  }, [paymentStatus, pendingPayment]);

  if (!pendingPayment || !paymentStatus) return null;

  const close = () => {
    dismissedAttemptIdRef.current = pendingPayment.attemptId;
    setModificationError("");
    setPendingPayment(null);
    setPaymentStatus(null);
  };

  const modifyCart = async () => {
    if (modifyingCart) return;
    setModifyingCart(true);
    setModificationError("");

    try {
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(paymentStatus.orderId)}/cancel-pending-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          credentials: "same-origin",
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Impossible d'annuler cette session de paiement pour le moment.",
        );
      }

      dismissedAttemptIdRef.current = pendingPayment.attemptId;
      clearPendingVivaPayment(window.sessionStorage, paymentStatus.orderId);
      window.sessionStorage.removeItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY);
      setPendingPayment(null);
      setPaymentStatus(null);
      router.push("/boutique");
      window.dispatchEvent(new Event("cart:open"));
    } catch (error) {
      setModificationError(
        error instanceof Error
          ? error.message
          : "Impossible d'annuler cette session de paiement pour le moment.",
      );
    } finally {
      setModifyingCart(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer le rappel de paiement"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-payment-title"
        className="cartoon-border relative z-10 w-full max-w-lg bg-cream p-6 text-center md:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
          Paiement interrompu
        </p>
        <h2 id="pending-payment-title" className="mt-2 font-display text-4xl leading-none text-ink">
          Ta commande n&apos;est pas encore payee
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-charcoal">
          Tu es revenu de Viva avant la confirmation du paiement. La commande {paymentStatus.orderId}
          est toujours en attente : inutile d&apos;en créer une nouvelle.
        </p>
        <div className="cartoon-border-sm mx-auto mt-5 max-w-sm bg-white p-3 text-sm font-bold text-ink">
          Montant a regler : {formatPrice(paymentStatus.totalAmount)}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            ref={primaryActionRef}
            href={`/api/account/orders/${encodeURIComponent(paymentStatus.orderId)}/resume-payment`}
            aria-disabled={modifyingCart}
            onClick={(event) => {
              if (modifyingCart) event.preventDefault();
            }}
            className={`btn-cartoon btn-primary inline-flex min-h-12 items-center justify-center ${
              modifyingCart ? "pointer-events-none opacity-60" : ""
            }`}
          >
            Reprendre et payer
          </a>
          <button
            type="button"
            className="btn-cartoon btn-secondary min-h-12"
            onClick={() => void modifyCart()}
            disabled={modifyingCart}
          >
            {modifyingCart ? "Annulation en cours…" : "Modifier mon panier"}
          </button>
        </div>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-charcoal">
          « Modifier mon panier » annule ce lien de paiement. Tes articles restent dans le panier,
          afin que tu puisses en ajouter puis payer le tout en une seule fois.
        </p>
        {modificationError && (
          <p
            role="alert"
            className="cartoon-border-sm mt-4 bg-red-50 p-3 text-sm font-bold text-red-800"
          >
            {modificationError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold underline">
          <button type="button" onClick={close} disabled={modifyingCart}>
            Fermer pour l&apos;instant
          </button>
          <Link href="/profil?tab=commandes">Voir mes commandes</Link>
        </div>
      </section>
    </div>
  );
}
