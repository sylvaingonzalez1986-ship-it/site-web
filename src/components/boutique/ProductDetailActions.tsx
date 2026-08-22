"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProductAnalysisModal } from "@/components/boutique/ProductAnalysisModal";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/data/products";
import {
  formatRemainingGrams,
  getSelectableVariantOptions,
  getStockDisplayInfo,
} from "@/lib/product-stock";
import styles from "./ProductDetailActions.module.css";

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
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const closeAnalysis = useCallback(() => setAnalysisOpen(false), []);

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
    <div className={styles.panel}>
      <p className={styles.heading}>Choisir et commander</p>
      <div className="space-y-4">
      {hasVariants && (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-charcoal">
            {product.variantLabel?.trim() || "Taille"}
          </label>
          <select
            className={styles.select}
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
        <div className={styles.alert}>
          Plus que {formatRemainingGrams(stockInfo.remainingGrams)} disponible
        </div>
      )}
      {stockError && <p className="text-sm font-semibold text-[#7f1d1d]">{stockError}</p>}

      <div className={styles.controls}>
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
          className={`btn-cartoon btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${styles.add}`}
        >
          <Plus size={16} /> {inStock ? "Ajouter au panier" : "Rupture de stock"}
        </button>
      </div>

      {product.analysisPdf && (
        <>
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className={`btn-cartoon btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-xs ${styles.analysis}`}
          >
            📄 Voir l&apos;analyse laboratoire
          </button>
          <Link
            href="/analyse-laboratoire-cbd"
            className="inline-flex min-h-11 items-center px-2 text-xs font-bold underline hover:text-ink"
          >
            Comment lire ce document ?
          </Link>
          <ProductAnalysisModal
            open={analysisOpen}
            productName={product.name}
            analysisUrl={product.analysisPdf}
            onClose={closeAnalysis}
          />
        </>
      )}
      </div>
    </div>
  );
}
