"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/utils";

const ProductAnalysisModal = dynamic(
  () => import("@/components/boutique/ProductAnalysisModal").then((mod) => mod.ProductAnalysisModal),
  { ssr: false },
);

const ProductVideoModal = dynamic(
  () => import("@/components/boutique/ProductVideoModal").then((mod) => mod.ProductVideoModal),
  { ssr: false },
);

function buildStockLimitMessage(productName: string, maxAvailable?: number): string {
  if (typeof maxAvailable === "number" && maxAvailable > 0) {
    return `Stock maximum atteint pour ${productName} (${maxAvailable} unite${maxAvailable > 1 ? "s" : ""} disponible${maxAvailable > 1 ? "s" : ""}).`;
  }

  return `Le stock disponible pour ${productName} est atteint.`;
}

type ProductCardActionsProps = {
  product: Product;
  productHref: string;
  addButtonLabel: string;
  inStock: boolean;
  requiresVariantChoice: boolean;
  maxPurchasableQty?: number;
  hasPromo: boolean;
};

export function ProductCardActions({
  product,
  productHref,
  addButtonLabel,
  inStock,
  requiresVariantChoice,
  maxPurchasableQty,
  hasPromo,
}: ProductCardActionsProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [stockError, setStockError] = useState<string | null>(null);

  const handleAddToCart = () => {
    if (authLoading) {
      return;
    }

    if (requiresVariantChoice) {
      router.push(productHref);
      return;
    }

    const result = addToCart(product, undefined, qty);
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
    <>
      {stockError && (
        <p className="mt-3 text-sm font-semibold text-[#7f1d1d]">{stockError}</p>
      )}
      {(product.analysisPdf || product.videoUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {product.analysisPdf && (
            <button
              type="button"
              onClick={() => setAnalysisOpen(true)}
              className="inline-flex min-h-[38px] items-center rounded-full border-2 border-[#1a1a1a] bg-[#e8f7f2] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0a7b61] transition-colors hover:bg-[#d7f0e8]"
            >
              Analyse
            </button>
          )}
          {product.videoUrl && (
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border-2 border-[#d35400] bg-[#fff3e8] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#d35400] transition-colors hover:bg-[#ffe8d0]"
            >
              <span aria-hidden="true">▶</span> Vidéo
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        {hasPromo ? (
          <div className="flex flex-col">
            <span className="price-original text-sm">{formatPrice(product.originalPrice!)}{product.category === "fleurs" && " / g"}</span>
            <div className="flex items-end gap-2">
              <span className="price-promo text-lg">{formatPrice(product.price)}{product.category === "fleurs" && " / g"}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <p className="text-lg font-bold text-ink">{formatPrice(product.price)}{product.category === "fleurs" && " / g"}</p>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={productHref}
            className="btn-cartoon btn-secondary inline-flex min-h-[44px] items-center px-4 py-3 text-xs"
          >
            Voir
          </Link>
          {!requiresVariantChoice && inStock && (
            <QuantitySelector
              value={qty}
              onChange={(value) => {
                setQty(value);
                setStockError(null);
              }}
              max={maxPurchasableQty}
              compact
            />
          )}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={authLoading || !inStock}
            className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center gap-2 px-4 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={15} />{" "}
            {inStock ? (requiresVariantChoice ? "Choisir format" : addButtonLabel) : "Rupture"}
          </button>
        </div>
      </div>

      {product.analysisPdf && (
        <ProductAnalysisModal
          open={analysisOpen}
          productName={product.name}
          analysisUrl={product.analysisPdf}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
      {product.videoUrl && (
        <ProductVideoModal
          open={videoOpen}
          videoUrl={product.videoUrl}
          productName={product.name}
          onClose={() => setVideoOpen(false)}
        />
      )}
    </>
  );
}
