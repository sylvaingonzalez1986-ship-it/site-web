"use client";

import { useEffect, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getDeliveryMethodLabel } from "@/lib/shipping";
import { formatPrice } from "@/lib/utils";
import type { CmsOrder, OrderStatus } from "@/types/store";

type AdminOrderDetailModalProps = {
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
    case "paid":
    case "processing":
    case "shipped":
      return "bg-[#e8f7f2]";
    case "cancelled":
      return "bg-[#ffe8e8]";
    default:
      return "bg-[#f7f4ee]";
  }
}

export function AdminOrderDetailModal({ order, onClose }: AdminOrderDetailModalProps) {
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  useBodyScrollLock(Boolean(order));

  useEffect(() => {
    if (!order) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [order, onClose]);

  useEffect(() => {
    setInvoiceError(null);
    setInvoiceLoading(false);
  }, [order?.id]);

  if (!order) {
    return null;
  }

  const canDownloadInvoice = isInvoiceEligibleOrder(order);

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

  const downloadInvoice = async () => {
    setInvoiceError(null);
    setInvoiceLoading(true);
    try {
      const invoiceUrl = `/api/admin/orders/${encodeURIComponent(order.id)}/invoice`;
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
        setInvoiceError("Le fichier reçu n'est pas une facture PDF valide.");
        return;
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        setInvoiceError("Facture vide reçue. Réessayez dans quelques secondes.");
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
        `/api/admin/orders/${encodeURIComponent(order.id)}/invoice`,
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer le détail de commande"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détail commande ${order.id}`}
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto cartoon-border bg-cream p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl text-ink">Commande {order.id}</h3>
            <p className="mt-1 text-sm text-charcoal">
              {new Date(order.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className={`pill-cartoon px-3 py-1 ${getStatusClass(order.status)}`}>
            Statut: {orderStatusLabels[order.status]}
          </span>
          <span className="pill-cartoon px-3 py-1">
            Paiement: {paymentStateLabels[order.paymentState]}
          </span>
          <span className="pill-cartoon px-3 py-1">
            Livraison: {getDeliveryMethodLabel(deliveryMethod)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card-cartoon bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Client</p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {order.customerName || "Client non renseigné"}
            </p>
            <p className="text-sm text-ink">{order.customerEmail || "-"}</p>
            {order.customerId && <p className="text-xs text-charcoal">ID: {order.customerId}</p>}
          </div>

          <div className="card-cartoon bg-white p-4">
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
                <div className="grid gap-1 text-sm text-ink md:grid-cols-[minmax(0,1fr)_70px_90px_130px_110px] md:gap-2">
                  <p className="font-semibold md:font-normal">{item.name}</p>
                  <p>{item.quantity}</p>
                  <p>{item.vatRate}%</p>
                  <p>{formatPrice(item.unitPrice)}</p>
                  <p>{formatPrice(item.lineTotal)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#1a1a1a] pt-3 text-sm">
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

        <div className="mt-6">
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
              Facture disponible uniquement pour les commandes payées.
            </p>
          )}
          {invoiceError && (
            <p className="mt-2 text-sm font-semibold text-red-700">{invoiceError}</p>
          )}
        </div>
      </div>
    </div>
  );
}


