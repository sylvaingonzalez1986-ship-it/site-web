"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/navigation/NavigationLink";
import { Plus } from "lucide-react";
import { ProductAnalysisModal } from "@/components/boutique/ProductAnalysisModal";
import { NotebookQuantityBonusPreview } from "@/components/contest/NotebookQuantityBonus";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";
import { normalizeAnalysisUrl } from "@/lib/product-analysis-url";
import type { Product } from "@/data/products";
import {
  formatRemainingGrams,
  getPublicVariantOptions,
  getStockDisplayInfo,
  isVariantOptionPurchasable,
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
  const { addToCart, cartLoading } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [showMobileAction, setShowMobileAction] = useState(false);
  const variantId = useId();
  const closeAnalysis = useCallback(() => setAnalysisOpen(false), []);

  const hasVariants = Boolean(product.variantOptions?.length);
  const publicVariants = getPublicVariantOptions(product);
  const selectableVariants = publicVariants.filter(isVariantOptionPurchasable);
  const selectedVariant =
    selectableVariants.find((v) => v.id === selectedVariantId) ??
    selectableVariants[0];
  const stockInfo = getStockDisplayInfo(product, lowStockThresholdGrams, selectedVariant?.id);
  const inStock = hasVariants ? Boolean(selectedVariant) : !stockInfo.isOutOfStock;
  const analysisUrl = normalizeAnalysisUrl(product.analysisPdf);

  useEffect(() => {
    if (!addButtonRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setShowMobileAction(!entry.isIntersecting), { threshold: 0 });
    observer.observe(addButtonRef.current);
    return () => observer.disconnect();
  }, []);

  const handleAddToCart = () => {
    if (cartLoading || !inStock) return;

    setAdded(false);
    const result = addToCart(product, selectedVariant?.id, qty);
    if (result.ok) {
      setStockError(null);
      setAdded(true);
      setQty(1);
      return;
    }

    if (result.reason === "stock_limit") {
      setStockError(buildStockLimitMessage(product.name, result.maxAvailable));
      return;
    }

    setStockError("Ce format n’est plus disponible. Choisis un autre produit ou format.");
  };

  return (
    <div data-ui-commerce="order-panel" data-ui-shape="panel" ref={panelRef} className={styles.panel}>
      <p className={styles.heading}>Choisir et commander</p>
      <div className="space-y-4">
      {publicVariants.length > 0 && (
        <div>
          <label htmlFor={variantId} className="mb-1 block text-sm font-bold text-charcoal">
            {product.variantLabel?.trim() || "Taille"}
          </label>
          <select
            id={variantId}
            className={styles.select}
            value={selectedVariant?.id ?? ""}
            disabled={!selectedVariant}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setQty(1);
              setStockError(null);
            }}
          >
            {!selectedVariant && <option value="">Aucun format en stock</option>}
            {publicVariants.map((option) => {
              const available = isVariantOptionPurchasable(option);
              return (
                <option key={option.id} value={option.id} disabled={!available}>
                  {option.label} — {formatPrice(option.price)}{available ? "" : " (rupture)"}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {stockInfo.isLowStock && stockInfo.remainingGrams !== null && (
        <div data-ui-commerce="stock-alert" data-ui-shape="panel" className={styles.alert}>
          Plus que {formatRemainingGrams(stockInfo.remainingGrams)} disponible
        </div>
      )}
      {added && <p role="status" className="mt-2 text-xs font-semibold text-teal">Ajouté au panier. <button type="button" className="underline min-h-11" onClick={() => window.dispatchEvent(new Event("shop:open-cart"))}>Voir mon panier</button></p>}
      {stockError && <p role="alert" className="text-sm font-semibold text-[#7f1d1d]">{stockError}</p>}

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
        <button data-ui-commerce="primary" data-ui-shape="control"
          ref={addButtonRef}
          type="button"
          onClick={handleAddToCart}
          disabled={cartLoading || !inStock}
          className={`btn-cartoon btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${styles.add}`}
        >
          <Plus size={16} /> {inStock ? "Ajouter au panier" : "Rupture de stock"}
        </button>
      </div>

      {inStock && product.category === "fleurs" && !product.isPack && !product.variantOptions?.length
        && typeof product.weightGrams === "number" && product.weightGrams > 0 ? <NotebookQuantityBonusPreview
          productId={product.id}
          grams={qty * product.weightGrams}
        /> : null}

      {analysisUrl ? (
        <>
          <a data-ui-commerce="secondary" data-ui-shape="control"
            href={analysisUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setAnalysisOpen(true);
            }}
            className={`btn-cartoon btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-xs ${styles.analysis}`}
          >
            📄 Voir l&apos;analyse laboratoire
          </a>
          <Link
            href="/analyse-laboratoire-cbd"
            className="inline-flex min-h-11 items-center px-2 text-xs font-bold underline hover:text-ink"
          >
            Comment lire ce document ?
          </Link>
          <ProductAnalysisModal
            open={analysisOpen}
            productName={product.name}
            analysisUrl={analysisUrl}
            onClose={closeAnalysis}
          />
        </>
      ) : <p className="text-sm text-charcoal">Aucune analyse de laboratoire publiée pour cette référence.</p>}
      </div>
      {showMobileAction && inStock && typeof document !== "undefined" && createPortal(
        <div data-ui-commerce="product-mobile" className={styles.mobileAction} aria-label="Commander ce produit">
          <div><span>{selectedVariant?.label || product.name}</span><strong>{formatPrice(selectedVariant?.price ?? product.price)} TTC</strong></div>
          <button data-ui-commerce="mobile-control" data-ui-shape="control" type="button" onClick={() => {
            panelRef.current?.scrollIntoView({ block: "center" });
            const target = hasVariants ? panelRef.current?.querySelector("select") : addButtonRef.current;
            target?.focus({ preventScroll: true });
          }}>{hasVariants ? "Choisir le format" : "Commander"}</button>
        </div>, document.body,
      )}
    </div>
  );
}
