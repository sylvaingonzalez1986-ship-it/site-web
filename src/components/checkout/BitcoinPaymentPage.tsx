"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrderCashRewardReceipt } from "@/components/checkout/OrderCashReward";
import { ContestBundleRewardReceipt } from "@/components/checkout/ContestBundleReward";
import Link from "@/components/navigation/NavigationLink";
import { useCart } from "@/context/CartContext";
import { consumePaidBitcoinCart } from "@/lib/bitcoin-cart";
import type { SwissBitcoinPaymentStatus } from "@/lib/swiss-bitcoin-pay-types";
import { formatPrice } from "@/lib/utils";

const copy = {
  preparing: ["Préparation du paiement", "Le lien de paiement sera disponible dans un instant."],
  pending: ["En attente de paiement", "Ouvre Swiss Bitcoin Pay pour voir le montant en sats et payer avec ton portefeuille Lightning."],
  confirming: ["Confirmation en cours", "Nous vérifions ton paiement. Attends la confirmation avant de payer à nouveau."],
  paid: ["Paiement confirmé", "Ta commande est payée."],
  expired: ["Lien expiré", "Ce lien de paiement a expiré. Les options disponibles s’affichent ci-dessous."],
  unavailable: ["Paiement indisponible", "Le paiement Bitcoin est temporairement indisponible pour cette commande."],
  review: ["Paiement à vérifier", "Contacte le support avec ta référence de commande avant de payer à nouveau."],
  cancelled: ["Paiement Bitcoin clôturé", "Retrouve le suivi et les options de ta commande dans ton profil."],
} as const;

const actionClass = "btn-cartoon inline-flex min-h-12 max-w-full items-center justify-center px-5 text-center";

export function BitcoinPaymentPage({ orderId }: { orderId: string }) {
  const { cartLoading, items, clearCart, refreshSession } = useCart();
  const endpoint = `/api/checkout/bitcoin/${encodeURIComponent(orderId)}`;
  const orderPath = `/checkout/bitcoin/${encodeURIComponent(orderId)}`;
  const [payment, setPayment] = useState<SwissBitcoinPaymentStatus | null>(null);
  const [accessError, setAccessError] = useState<401 | 404 | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<{ controller: AbortController; interactive: boolean } | null>(null);
  const completedOrder = useRef(false);
  const shouldPoll = !accessError && (!payment || Boolean(payment.resumeCardUrl) || ["preparing", "pending", "confirming"].includes(payment.state));
  const canCheck = !accessError && payment?.state !== "paid" && payment?.state !== "cancelled";

  const requestStatus = useCallback(async (action?: "retry" | "card", manual = false) => {
    const interactive = Boolean(action || manual);
    if (inFlight.current && (!interactive || inFlight.current.interactive)) return;
    inFlight.current?.controller.abort();
    const controller = new AbortController();
    inFlight.current = { controller, interactive };
    if (interactive) {
      setBusy(true);
      setError("");
    }
    try {
      const response = await fetch(endpoint, action ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
        signal: controller.signal,
      } : { cache: "no-store", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 404) {
        setAccessError(response.status);
        setPayment(null);
        setError("");
        return;
      }
      const data = await response.json().catch(() => null) as
        (SwissBitcoinPaymentStatus & { redirectUrl?: string; error?: string }) | null;
      if (controller.signal.aborted) return;
      const unavailable = "Le statut est temporairement indisponible. Réessaie dans un instant.";
      if (!response.ok) {
        setError(data?.error || unavailable);
        return;
      }
      if (action === "card" && data?.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      if (!data || data.orderId !== orderId || !Object.hasOwn(copy, data.state)) {
        setError(unavailable);
        return;
      }
      setPayment(data);
      setError("");
    } catch {
      if (!controller.signal.aborted) {
        setError("La vérification du paiement a échoué. Réessaie dans un instant.");
      }
    } finally {
      if (inFlight.current?.controller === controller) {
        inFlight.current = null;
        if (interactive) setBusy(false);
      }
    }
  }, [endpoint, orderId]);

  useEffect(() => {
    void requestStatus();
    return () => {
      inFlight.current?.controller.abort();
      inFlight.current = null;
    };
  }, [requestStatus]);

  useEffect(() => {
    if (!shouldPoll) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void requestStatus();
        checks += 1;
      }
      if (checks >= 36) window.clearInterval(timer);
    }, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [requestStatus, shouldPoll]);

  useEffect(() => {
    if (payment?.state !== "paid" || cartLoading || completedOrder.current) return;
    completedOrder.current = true;
    consumePaidBitcoinCart(orderId, items, clearCart);
    void refreshSession({ silent: true, force: true });
  }, [cartLoading, clearCart, items, orderId, payment?.state, refreshSession]);

  const expiresAt = payment?.state === "pending" && payment.expiresAt
    ? new Date(payment.expiresAt) : null;
  const checkoutUrl = !error
    ? payment?.resumeCardUrl ?? (payment?.state === "pending" ? payment.checkoutUrl : undefined)
    : undefined;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-16">
      <div className="retro-container">
        <div data-ui-commerce="site-paper" data-ui-shape="panel" className="cartoon-border mx-auto max-w-xl bg-cream p-5 sm:p-8">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Paiement Bitcoin (Lightning)</h1>
          {payment && (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-charcoal">Commande</dt>
                <dd className="break-all font-bold text-ink">{orderId}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-charcoal">Total TTC</dt>
                <dd className="text-xl font-extrabold text-ink">{formatPrice(payment.totalAmount)}</dd>
              </div>
            </dl>
          )}
          <div role="status" className="mt-5 text-charcoal">
            {payment && (
              <>
                <h2 className="font-display text-2xl text-ink">
                  {payment.resumeCardUrl ? "En attente de paiement par carte" : copy[payment.state][0]}
                </h2>
                <p className="mt-1">{payment.resumeCardUrl
                  ? "Le paiement par carte est disponible pour cette commande."
                  : copy[payment.state][1]}</p>
              </>
            )}
            {accessError === 401 && <p>Connecte-toi pour consulter ce paiement.</p>}
            {accessError === 404 && <p>Ce paiement est introuvable pour ton compte.</p>}
            {!payment && !accessError && !error && <p>Chargement du paiement…</p>}
          </div>
          {expiresAt && Number.isFinite(expiresAt.getTime()) && (
            <p className="mt-2 text-sm text-charcoal">
              Lien valable jusqu’au <time dateTime={payment?.expiresAt}>{expiresAt.toLocaleString("fr-FR")}</time>.
            </p>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {accessError === 401 && (
              <Link href={`/compte/connexion?next=${encodeURIComponent(orderPath)}`} className={`${actionClass} btn-primary`}>
                Se connecter
              </Link>
            )}
            {checkoutUrl && (
              <a href={checkoutUrl} className={`${actionClass} btn-primary`}>
                {payment?.resumeCardUrl ? "Reprendre le paiement par carte" : "Ouvrir Swiss Bitcoin Pay"}
              </a>
            )}
            {payment?.canRetry && !error && (
              <button type="button" className={`${actionClass} btn-primary`} disabled={busy} onClick={() => void requestStatus("retry")}>
                Demander un nouveau lien Bitcoin
              </button>
            )}
            {payment?.canPayByCard && !error && (
              <button type="button" className={`${actionClass} btn-secondary`} disabled={busy} onClick={() => void requestStatus("card")}>
                Payer par carte bancaire
              </button>
            )}
            {canCheck && (
              <button type="button" className={`${actionClass} btn-secondary`} disabled={busy} onClick={() => void requestStatus(undefined, true)}>
                {busy ? "Vérification…" : "Actualiser le statut"}
              </button>
            )}
            <Link href="/profil?tab=commandes" className={`${actionClass} btn-secondary`}>Mes commandes</Link>
          </div>
          {payment?.state === "paid" && (
            <>
              <OrderCashRewardReceipt orderId={orderId} paymentState="paid" />
              <ContestBundleRewardReceipt orderId={orderId} paymentState="paid" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
