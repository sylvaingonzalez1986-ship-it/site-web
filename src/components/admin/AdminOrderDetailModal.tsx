"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminInvoiceDownload } from "@/components/admin/AdminInvoiceDownload";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getDeliveryMethodLabel } from "@/lib/shipping";
import type { SwissBitcoinPaymentSummary } from "@/lib/swiss-bitcoin-pay-types";
import { formatPrice } from "@/lib/utils";
import type { CmsOrder, OrderStatus } from "@/types/store";

type AdminOrderDetailModalProps = {
  order: CmsOrder | null;
  bitcoinPayments: SwissBitcoinPaymentSummary[];
  bitcoinHistoryUnavailable?: boolean;
  onBitcoinHistoryRefresh: () => Promise<void>;
  onClose: () => void;
};

const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  pending_payment: "Paiement en attente",
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  cancelled: "Annulée",
};

const paymentStateLabels: Record<CmsOrder["paymentState"], string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échec",
  not_configured: "Validation manuelle",
};

const bitcoinStateLabels: Record<SwissBitcoinPaymentSummary["state"], string> = {
  creating: "Création en cours",
  unknown: "Statut indéterminé",
  pending: "En attente",
  confirming: "Confirmation en cours",
  expired: "Expiré",
  failed: "Échec",
  paid: "Payé",
  review: "À vérifier",
};

function formatPaymentDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("fr-FR") : "Indisponible";
}

function getStatusClass(status: OrderStatus): string {
  switch (status) {
    case "pending_payment":
      return "bg-[#ffe8e8] text-[#7a1010]";
    case "paid":
    case "processing":
      return "bg-[#fff1db] text-[#7c4a00]";
    case "shipped":
      return "bg-[#e8f7f2] text-[#0f5b3f]";
    case "cancelled":
      return "bg-[#ffe8e8] text-[#7a1010]";
    default:
      return "bg-[#f7f4ee] text-ink";
  }
}

function getPaymentStateClass(paymentState: CmsOrder["paymentState"]): string {
  switch (paymentState) {
    case "pending":
      return "bg-[#ffe8e8] text-[#7a1010]";
    case "paid":
      return "bg-[#fff1db] text-[#7c4a00]";
    case "failed":
      return "bg-[#ffe8e8] text-[#7a1010]";
    default:
      return "bg-[#f7f4ee] text-ink";
  }
}

export function AdminOrderDetailModal({
  order, onClose, bitcoinPayments, bitcoinHistoryUnavailable = false, onBitcoinHistoryRefresh,
}: AdminOrderDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const recoveryFeedbackRef = useRef<HTMLParagraphElement>(null);
  const [recoveringInvoice, setRecoveringInvoice] = useState(false);
  const [invoiceFeedback, setInvoiceFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const orderId = order?.id;
  useBodyScrollLock(Boolean(orderId));

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        );
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [orderId, onClose]);

  if (!order) {
    return null;
  }

  const canDownloadInvoice = isInvoiceEligibleOrder(order);
  const isBitcoinOrder = order.paymentProvider === "swiss_bitcoin_pay" || Boolean(order.swissBitcoinCardStartedAt);
  const canRecoverInvoice = bitcoinPayments.some(({ state, invoiceId }) => state === "unknown" && !invoiceId);

  const attachInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (recoveringInvoice) return;
    const invoiceId = String(new FormData(event.currentTarget).get("invoiceId") ?? "").trim();
    setRecoveringInvoice(true);
    setInvoiceFeedback(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/bitcoin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "Le rattachement de la facture a échoué.");
      }
      setInvoiceFeedback({ message: "Facture rattachée. L’historique est en cours d’actualisation.", error: false });
      await onBitcoinHistoryRefresh();
      setInvoiceFeedback({ message: "Facture rattachée.", error: false });
      recoveryFeedbackRef.current?.focus();
    } catch (reason) {
      setInvoiceFeedback({
        message: reason instanceof Error ? reason.message : "Le rattachement de la facture a échoué.",
        error: true,
      });
    } finally {
      setRecoveringInvoice(false);
    }
  };

  const hasShippingInfo = Boolean(
    order.shippingAddress ||
      order.shippingCity ||
      order.shippingPostalCode ||
      order.shippingCountry ||
      order.shippingPhone,
  );
  const deliveryMethod = order.deliveryMethod === "relay" ? "relay" : "home";
  const subTotal = Number(order.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const deliveryFee = Number.isFinite(order.deliveryFee)
    ? Number((order.deliveryFee ?? 0).toFixed(2))
    : 0;
  const discountAmount = Number.isFinite(order.discountAmount)
    ? Number((order.discountAmount ?? 0).toFixed(2))
    : Math.max(Number((subTotal - Math.max(order.totalAmount - deliveryFee, 0)).toFixed(2)), 0);
  const preDiscountSubTotal = Number((subTotal + Math.max(discountAmount, 0)).toFixed(2));
  const totalHt = Number.isFinite(order.totalHt)
    ? Number(order.totalHt.toFixed(2))
    : Number((order.totalAmount - (order.totalVat ?? 0)).toFixed(2));
  const totalVat = Number.isFinite(order.totalVat) ? Number(order.totalVat.toFixed(2)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer le détail de commande"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Détail commande ${order.id}`}
        className="admin-order-dialog relative z-10 max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto overscroll-contain cartoon-border bg-cream sm:max-h-[94dvh]"
      >
        <div className="admin-order-dialog-header sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#003f30]/20 bg-cream p-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">Détail de commande</p>
            <h3 className="mt-1 break-all font-display text-xl text-ink sm:text-2xl">{order.id}</h3>
            <p className="mt-1 text-sm text-charcoal">
              {new Date(order.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 text-sm [&>span]:max-w-full [&>span]:break-words">
            <span className={`pill-cartoon px-3 py-1 ${getStatusClass(order.status)}`}>
              Statut: {orderStatusLabels[order.status]}
            </span>
            <span className={`pill-cartoon px-3 py-1 ${getPaymentStateClass(order.paymentState)}`}>
              {order.paymentProvider === "swiss_bitcoin_pay" ? "Bitcoin (Lightning)" : "Paiement"} : {paymentStateLabels[order.paymentState]}
            </span>
            <span className="pill-cartoon px-3 py-1">
              Livraison: {getDeliveryMethodLabel(deliveryMethod)}
            </span>
            {order.trackingNumber && (
              <span className="pill-cartoon px-3 py-1">
                Suivi: {order.trackingNumber}
              </span>
            )}
          </div>

          {order.paymentReviewRequired && (
            <div className="mt-4 border-2 border-red-700 bg-red-50 p-4 text-sm text-red-900" role="alert">
              <p className="font-bold">Vérification manuelle du paiement requise</p>
              <p className="mt-1">
                Vérifie le paiement et la commande avant expédition.
              </p>
              {order.paymentReviewReason && (
                <p className="mt-2 break-words font-mono text-xs">{order.paymentReviewReason}</p>
              )}
            </div>
          )}

          {(isBitcoinOrder || bitcoinPayments.length > 0) && (
            <section className="mt-6 border-t border-[#003f30]/20 pt-4">
              <h4 className="font-display text-xl text-ink">Historique Swiss Bitcoin Pay</h4>
              <p className="mt-1 text-sm text-charcoal">Total de la commande TTC {formatPrice(order.totalAmount)}</p>
              {order.swissBitcoinCardStartedAt && (
                <p className="mt-1 text-sm text-charcoal">
                  Bascule vers la carte engagée le {formatPaymentDate(order.swissBitcoinCardStartedAt)}.
                </p>
              )}
              {order.swissBitcoinArchiveRequestedAt && !order.archivedAt && order.paymentState !== "paid" && (
                <p className="mt-2 text-sm font-semibold text-ink">
                  Retrait demandé le {formatPaymentDate(order.swissBitcoinArchiveRequestedAt)}. La commande reste visible jusqu’à la vérification de l’expiration du lien.
                </p>
              )}
              {bitcoinPayments.length === 0 && (
                <p className="mt-2 text-sm text-charcoal">
                  {bitcoinHistoryUnavailable ? "L’historique est momentanément indisponible." : "Aucune tentative chargée."}
                </p>
              )}
              <ul className="divide-y divide-[#003f30]/20">
                {bitcoinPayments.map((payment) => {
                  const details = [
                    ["Identifiant de la facture", payment.invoiceId ?? "Indisponible"],
                    ["Montant attendu", formatPrice(payment.expectedEurMinor / 100)],
                    ["Montant payé vérifié", payment.paidSats === null
                      ? "Indisponible" : `${payment.paidSats.toLocaleString("fr-FR")} sats`],
                    ["Statut du prestataire", payment.providerStatus ?? "Indisponible"],
                    ["Créée le", formatPaymentDate(payment.createdAt)],
                    ["Expiration", formatPaymentDate(payment.expiresAt)],
                    ["Paiement confirmé le", formatPaymentDate(payment.paidAt)],
                    ["Dernière vérification", formatPaymentDate(payment.lastCheckedAt)],
                    ...(payment.issue ? [["Anomalie", payment.issue]] : []),
                  ];
                  return (
                    <li key={payment.id} className="py-3">
                      <h5 className="font-bold text-ink">{bitcoinStateLabels[payment.state]}</h5>
                      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                        {details.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="font-semibold text-charcoal">{label}</dt>
                            <dd className="break-words text-ink">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ul>
              {canRecoverInvoice && (
                <form className="mt-3 grid gap-2 border-t border-[#003f30]/20 pt-3" onSubmit={attachInvoice}>
                  <label className="grid gap-1 text-sm font-semibold text-ink">
                    Identifiant de la facture Swiss Bitcoin Pay retrouvée
                    <input
                      type="text"
                      name="invoiceId"
                      required
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={36}
                      pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                      className="min-h-11 min-w-0 border border-ink bg-white px-3"
                    />
                  </label>
                  <button type="submit" className="btn-cartoon btn-secondary min-h-11 justify-self-start" disabled={recoveringInvoice}>
                    {recoveringInvoice ? "Vérification de la facture…" : "Vérifier et rattacher la facture"}
                  </button>
                </form>
              )}
              {invoiceFeedback && (
                <p role={invoiceFeedback.error ? "alert" : "status"} tabIndex={-1} ref={recoveryFeedbackRef} className="mt-2 text-sm font-bold text-ink">
                  {invoiceFeedback.message}
                </p>
              )}
              <div className="mt-3 border-t border-[#003f30]/20 pt-3">
                <h5 className="font-bold text-ink">Rapprochement financier</h5>
                <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-3">
                  <div><dt>Conversion</dt><dd>Indisponible</dd></div>
                  <div><dt>Frais</dt><dd>Indisponibles</dd></div>
                  <div><dt>Virement</dt><dd>Indisponible</dd></div>
                </dl>
              </div>
            </section>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="card-cartoon min-w-0 break-words bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Client</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {order.customerName || "Client non renseigné"}
              </p>
              <p className="text-sm text-ink">{order.customerEmail || "-"}</p>
              {order.customerId && <p className="text-xs text-charcoal">ID: {order.customerId}</p>}
            </div>

            <div className="card-cartoon min-w-0 break-words bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Livraison</p>
              {hasShippingInfo ? (
                <>
                  {order.shippingAddress && <p className="mt-2 text-sm text-ink">{order.shippingAddress}</p>}
                  <p className="text-sm text-ink">
                    {[order.shippingPostalCode, order.shippingCity, order.shippingCountry]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  {order.shippingPhone && <p className="text-sm text-ink">{order.shippingPhone}</p>}
                </>
              ) : (
                <p className="mt-2 text-sm text-charcoal">Infos de livraison indisponibles.</p>
              )}
              {deliveryMethod === "relay" && order.relayId && (
                <div className="mt-3 rounded-[10px] border border-[#1a1a1a] bg-[#f7f4ee] p-2">
                  <p className="text-xs font-semibold text-ink">
                    Point Relais: {order.relayName || order.relayId}
                  </p>
                  <p className="text-xs text-charcoal">
                    {[order.relayAddress, order.relayPostalCode, order.relayCity, order.relayCountry]
                      .filter(Boolean)
                      .join(", ")}
                    </p>
                  </div>
              )}
              {order.trackingNumber && (
                <p className="mt-3 text-sm text-ink">Numero de suivi : {order.trackingNumber}</p>
              )}
            </div>
          </div>

          <div className="mt-6 card-cartoon bg-white p-4">
            <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_70px_90px_130px_110px] md:gap-2 text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
              <p>Produit</p>
              <p>Qte</p>
              <p>TVA</p>
              <p>Prix unitaire</p>
              <p>Total</p>
            </div>
            <div className="mt-2 grid gap-3">
              {order.items.map((item, index) => (
                <div
                  key={`${order.id}-line-${index}`}
                  className="rounded-[12px] border border-[#1a1a1a] p-3 md:rounded-none md:border-0 md:p-0"
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-ink md:grid-cols-[minmax(0,1fr)_70px_90px_130px_110px] md:gap-2">
                    <p className="col-span-2 break-words font-semibold md:col-span-1 md:font-normal">{item.name}</p>
                    <p><span className="block text-xs text-charcoal md:hidden">Quantité</span>{item.quantity}</p>
                    <p><span className="block text-xs text-charcoal md:hidden">TVA</span>{item.vatRate}%</p>
                    <p><span className="block text-xs text-charcoal md:hidden">Prix unitaire</span>{formatPrice(item.unitPrice)}</p>
                    <p className="font-semibold md:font-normal"><span className="block text-xs font-normal text-charcoal md:hidden">Total</span>{formatPrice(item.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-[#1a1a1a] pt-3 text-sm [&>div]:gap-3 [&>div>span:first-child]:min-w-0 [&>div>span:first-child]:break-words [&>div>span:last-child]:shrink-0">
              {discountAmount > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Sous-total TTC (avant remise)</span>
                    <span>{formatPrice(preDiscountSubTotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>
                      Remise
                      {order.promoCode ? ` (${order.promoCode})` : ""}
                    </span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Sous-total TTC (après remise)</span>
                    <span>{formatPrice(subTotal)}</span>
                  </div>
                </>
              )}
              {discountAmount <= 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span>Sous-total TTC</span>
                  <span>{formatPrice(subTotal)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span>Livraison</span>
                <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Offerte"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Total HT</span>
                <span>{formatPrice(totalHt)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Total TVA</span>
                <span>{formatPrice(totalVat)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base font-bold text-ink">
                <span>Total TTC</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          <AdminInvoiceDownload orderId={order.id} eligible={canDownloadInvoice} />
        </div>
      </div>
    </div>
  );
}


