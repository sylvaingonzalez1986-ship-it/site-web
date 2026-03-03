"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { categoryLabels, type Product } from "@/data/products";
import { isRemoteImageUrl } from "@/lib/image-source";
import {
  formatRemainingGrams,
  getStockDisplayInfo,
  isProductInStock,
} from "@/lib/product-stock";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { Producer } from "@/types/store";

const ProductAnalysisModal = dynamic(
  () => import("@/components/boutique/ProductAnalysisModal").then((mod) => mod.ProductAnalysisModal),
  { ssr: false },
);

const ProductVideoModal = dynamic(
  () => import("@/components/boutique/ProductVideoModal").then((mod) => mod.ProductVideoModal),
  { ssr: false },
);

const categorySlugs: Record<string, string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

type ProductCardProps = {
  product: Product;
  producer?: Producer;
  addButtonLabel?: string;
  lowStockThresholdGrams?: number;
  imagePriority?: boolean;
};

function buildStockLimitMessage(productName: string, maxAvailable?: number): string {
  if (typeof maxAvailable === "number" && maxAvailable > 0) {
    return `Stock maximum atteint pour ${productName} (${maxAvailable} unite${maxAvailable > 1 ? "s" : ""} disponible${maxAvailable > 1 ? "s" : ""}).`;
  }

  return `Le stock disponible pour ${productName} est atteint.`;
}

export function ProductCard({
  product,
  producer,
  addButtonLabel = "Ajouter",
  lowStockThresholdGrams = 0,
  imagePriority = false,
}: ProductCardProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [stockError, setStockError] = useState<string | null>(null);
  const allImages = product.images?.length ? product.images : [product.image];
  const hasPromo = hasActiveProductPromo(product);
  const inStock = isProductInStock(product);
  const requiresVariantChoice = (product.variantOptions?.length ?? 0) > 0;
  const stockInfo = getStockDisplayInfo(product, lowStockThresholdGrams);
  const producerLocation = producer
    ? [producer.department, producer.region].filter(Boolean).join(", ") || producer.location
    : "";
  const productHref = `/boutique/${categorySlugs[product.category] ?? `${product.category}-cbd`}/${product.id}`;

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
    <article className="product-card group card-cartoon overflow-hidden bg-cream">
      <ProductImageCarousel
        images={allImages}
        alt={product.name}
        badge={product.badge}
        bonusPoints={product.bonusPoints}
        promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
        priority={imagePriority}
        className="border-b-2 border-[#1a1a1a]"
        sizes="(max-width: 768px) 94vw, (max-width: 1200px) 45vw, 33vw"
      />

      <div className="product-card-body p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
          {categoryLabels[product.category]}
        </p>
        {producer && (
          <div className="cartoon-border mt-3 flex items-center gap-2 bg-yellow px-3 py-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
              <Image
                src={producer.image}
                alt={producer.name}
                fill
                sizes="32px"
                unoptimized={isRemoteImageUrl(producer.image)}
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">{producer.name}</p>
              <p className="truncate text-[11px] text-charcoal">{producerLocation}</p>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <h3 className="font-display text-2xl text-ink">
            <Link href={productHref} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          {!inStock && (
            <span className="pill-cartoon border-[#7f1d1d] bg-[#f8d7da] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#7f1d1d]">
              Rupture
            </span>
          )}
          {inStock && stockInfo.isLowStock && stockInfo.remainingGrams !== null && (
            <span className="pill-cartoon border-[#7f1d1d] bg-[#f8d7da] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#7f1d1d]">
              Plus que {formatRemainingGrams(stockInfo.remainingGrams)}
            </span>
          )}
          {product.isPack && (
            <span className="pill-cartoon px-2 py-1 text-[10px] uppercase tracking-[0.1em]">
              Pack
            </span>
          )}
        </div>
        <div className="product-card-description mt-2">{product.description}</div>
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
              <span className="price-original text-sm">{formatPrice(product.originalPrice)}{product.category === "fleurs" && " / g"}</span>
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
                max={stockInfo.maxPurchasableQty}
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
    </article>
  );
}
