"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/data/products";
import {
  formatRemainingGrams,
  getSelectableVariantOptions,
  getStockDisplayInfo,
} from "@/lib/product-stock";

type ProductDetailActionsProps = {
  product: Product;
  lowStockThresholdGrams?: number;
};

function buildStockLimitMessage(productName: string, maxAvailable?: number): string {
  if (typeof maxAvailable === "number" && maxAvailable > 0) {
    return `Stock maximum atteint pour ${productName} (${maxAvailable} unite${maxAvailable > 1 ? "s" : ""} disponible${maxAvailable > 1 ? "s" : ""}).`;
  }

  return `Le stock disponible pour ${productName} est atteint.`;
}

export function ProductDetailActions({
  product,
  lowStockThresholdGrams = 0,
}: ProductDetailActionsProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [stockError, setStockError] = useState<string | null>(null);

  const selectableVariants = getSelectableVariantOptions(product);
  const hasVariants = selectableVariants.length > 0;
  const selectedVariant =
    selectableVariants.find((v) => v.id === selectedVariantId) ??
    selectableVariants[0];
  const stockInfo = getStockDisplayInfo(product, lowStockThresholdGrams, selectedVariant?.id);
  const inStock = !stockInfo.isOutOfStock;

  const handleAddToCart = () => {
    if (authLoading || !inStock) return;

    const result = addToCart(product, selectedVariant?.id, qty);
    if (result.ok) {
      setStockError(null);
      setQty(1);
      return;
    }

    if (result.reason === "stock_limit") {
      setStockError(buildStockLimitMessage(product.name, result.maxAvailable));
      return;
    }

    const nextPath =
      typeof window === "undefined"
        ? "/boutique"
        : `${window.location.pathname}${window.location.search}`;
    router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  };

  return (
    <div className="mt-6 space-y-4">
      {hasVariants && (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-charcoal">
            {product.variantLabel?.trim() || "Taille"}
          </label>
          <select
            className="h-10 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm"
            value={selectedVariant?.id ?? ""}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setQty(1);
              setStockError(null);
            }}
          >
            {selectableVariants.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.price.toFixed(2)} €
              </option>
            ))}
          </select>
        </div>
      )}

      {stockInfo.isLowStock && stockInfo.remainingGrams !== null && (
        <div className="rounded border-2 border-[#7f1d1d] bg-[#f8d7da] px-4 py-3 text-sm font-bold text-[#7f1d1d]">
          Plus que {formatRemainingGrams(stockInfo.remainingGrams)} disponible
        </div>
      )}
      {stockError && <p className="text-sm font-semibold text-[#7f1d1d]">{stockError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {inStock && (
          <QuantitySelector
            value={qty}
            onChange={(value) => {
              setQty(value);
              setStockError(null);
            }}
            max={stockInfo.maxPurchasableQty}
          />
        )}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={authLoading || !inStock}
          className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center gap-2 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} /> {inStock ? "Ajouter au panier" : "Rupture de stock"}
        </button>
      </div>
    </div>
  );
}
