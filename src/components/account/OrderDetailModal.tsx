"use client";

import { useEffect, useState } from "react";
import { OrderCashRewardReceipt } from "@/components/checkout/OrderCashReward";
import { ContestBundleRewardReceipt } from "@/components/checkout/ContestBundleReward";
import { AppDialog } from "@/components/ui/AppDialog";
import { formatPrice } from "@/lib/utils";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import type { CmsOrder, OrderStatus } from "@/types/store";

type OrderDetailModalProps = {
  order: CmsOrder | null;
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

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    setInvoiceError(null);
    setInvoiceLoading(false);
  }, [order?.id]);

  if (!order) {
    return null;
  }

  const canDownloadInvoice = isInvoiceEligibleOrder(order);
  const subTotal = Number(order.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const deliveryFee = Number.isFinite(order.deliveryFee)
    ? Number((order.deliveryFee ?? 0).toFixed(2))
    : 0;
  const discountAmount = Number.isFinite(order.discountAmount)
    ? Number((order.discountAmount ?? 0).toFixed(2))
    : Math.max(Number((subTotal - Math.max(order.totalAmount - deliveryFee, 0)).toFixed(2)), 0);
  const hasShippingInfo = Boolean(
    order.shippingAddress ||
      order.shippingCity ||
      order.shippingPostalCode ||
      order.shippingCountry ||
      order.shippingPhone,
  );

  const downloadInvoice = async () => {
    setInvoiceError(null);
    setInvoiceLoading(true);

    try {
      const invoiceUrl = `/api/account/orders/${encodeURIComponent(order.id)}/invoice`;
      const response = await fetch(invoiceUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          setInvoiceError(data.error ?? "Impossible de télécharger la facture.");
        } catch {
          setInvoiceError("Impossible de télécharger la facture.");
        }
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/pdf")) {
        setInvoiceError("Le fichier recu n'est pas une facture PDF valide.");
        return;
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        setInvoiceError("Facture vide recue. Reessayez dans quelques secondes.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `facture-${order.id}.pdf`;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      window.open(
        `/api/account/orders/${encodeURIComponent(order.id)}/invoice`,
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <AppDialog open onClose={onClose} title={`Commande ${order.id}`} label={`Détail commande ${order.id}`} bodyClassName="p-4 sm:p-6 md:p-8">
        <p className="text-sm text-charcoal">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span data-ui-account="order-status" data-ui-shape="panel" className={`pill-cartoon px-3 py-1 ${getStatusClass(order.status)}`}>
            Statut: {orderStatusLabels[order.status]}
          </span>
          <span data-ui-account="order-status" data-ui-shape="panel" className={`pill-cartoon px-3 py-1 ${getPaymentStateClass(order.paymentState)}`}>
            Paiement: {paymentStateLabels[order.paymentState]}
          </span>
        </div>

        <OrderCashRewardReceipt orderId={order.id} paymentState={order.paymentState} />
        <ContestBundleRewardReceipt orderId={order.id} paymentState={order.paymentState} />

        {hasShippingInfo && (
          <div data-ui-account="fill-ffffff" data-ui-shape="panel" className="mt-6 card-cartoon bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
              Livraison
            </p>
            {order.shippingAddress && <p className="mt-2 text-sm text-ink">{order.shippingAddress}</p>}
            <p className="text-sm text-ink">
              {[order.shippingPostalCode, order.shippingCity, order.shippingCountry]
                .filter(Boolean)
                .join(" ")}
            </p>
            {order.shippingPhone && <p className="text-sm text-ink">{order.shippingPhone}</p>}
          </div>
        )}

        <div data-ui-account="fill-ffffff" data-ui-shape="panel" className="mt-6 card-cartoon bg-white p-4">
          <div className="hidden grid-cols-[minmax(0,1fr)_50px_80px_80px] gap-2 text-xs font-bold uppercase tracking-[0.08em] text-charcoal sm:grid">
            <p>Produit</p>
            <p>Qte</p>
            <p>P.U.</p>
            <p>Total</p>
          </div>
          <div className="mt-2 grid gap-2">
            {order.items.map((item, index) => (
              <div key={`${order.id}-line-${index}`} className="grid grid-cols-2 gap-2 border-b border-ink/15 py-3 text-sm text-ink sm:grid-cols-[minmax(0,1fr)_50px_80px_80px] sm:border-0 sm:py-0">
                <p className="col-span-2 min-w-0 break-words font-semibold sm:col-span-1">{item.name}</p>
                <p><span className="sm:hidden">Quantité : </span>{item.quantity}</p>
                <p><span className="sm:hidden">Prix unitaire : </span>{formatPrice(item.unitPrice)}</p>
                <p className="col-span-2 font-bold sm:col-span-1"><span className="sm:hidden">Total : </span>{formatPrice(item.lineTotal)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#1a1a1a] pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Sous-total</span>
              <span>{formatPrice(subTotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span>
                  Remise
                  {order.promoCode ? ` (${order.promoCode}` : ""}
                  {order.discountPercent ? ` - ${order.discountPercent}%` : ""}
                  {order.promoCode ? ")" : ""}
                </span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span>Livraison</span>
              <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Offerte"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-bold text-ink">
              <span>Total</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {order.paymentState !== "paid" &&
            order.status !== "cancelled" &&
            !order.archivedAt &&
            order.vivaOrderCode && (
              <div data-ui-account="fill-fff5da" data-ui-shape="panel" className="mb-4 card-cartoon bg-[#fff5da] p-4">
                <p className="text-sm font-bold text-ink">Cette commande attend encore son paiement.</p>
                <p className="mt-1 text-sm text-charcoal">
                  Reprends la session existante : ne cree pas une nouvelle commande.
                </p>
                <a
                  href={`/api/account/orders/${encodeURIComponent(order.id)}/resume-payment`}
                  className="btn-cartoon btn-primary mt-3 inline-flex"
                >
                  Reprendre le paiement
                </a>
              </div>
            )}
          <button
            type="button"
            className="btn-cartoon btn-primary"
            disabled={!canDownloadInvoice || invoiceLoading}
            onClick={downloadInvoice}
          >
            {invoiceLoading ? "Téléchargement..." : "Télécharger la facture"}
          </button>
          {!canDownloadInvoice && (
            <p className="mt-2 text-sm text-charcoal">
              Facture disponible uniquement pour les commandes payees.
            </p>
          )}
          {invoiceError && (
            <p className="mt-2 text-sm font-semibold text-red-700">{invoiceError}</p>
          )}
        </div>
    </AppDialog>
  );
}
