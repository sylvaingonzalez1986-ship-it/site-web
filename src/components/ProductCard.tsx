"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProductAnalysisModal } from "@/components/boutique/ProductAnalysisModal";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";
import { useCart } from "@/context/CartContext";
import { categoryLabels, type Product } from "@/data/products";
import { isRemoteImageUrl } from "@/lib/image-source";
import { isProductInStock } from "@/lib/product-stock";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { formatPrice } from "@/lib/utils";
import type { Producer } from "@/types/store";

type ProductCardProps = {
  product: Product;
  producer?: Producer;
  addButtonLabel?: string;
  onOpenQuickView?: () => void;
};

export function ProductCard({
  product,
  producer,
  addButtonLabel = "Ajouter",
  onOpenQuickView,
}: ProductCardProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const allImages = product.images?.length ? product.images : [product.image];
  const hasPromo = hasActiveProductPromo(product);
  const inStock = isProductInStock(product);
  const requiresVariantChoice = (product.variantOptions?.length ?? 0) > 0;
  const producerLocation = producer
    ? [producer.department, producer.region].filter(Boolean).join(", ") || producer.location
    : "";

  const handleAddToCart = () => {
    if (authLoading) {
      return;
    }

    if (requiresVariantChoice && onOpenQuickView) {
      onOpenQuickView();
      return;
    }

    const added = addToCart(product);
    if (added) {
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
        promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
        className="border-b-2 border-[#1a1a1a]"
        sizes="(max-width: 768px) 94vw, (max-width: 1200px) 45vw, 33vw"
      />

      <div className="p-5">
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
          <h3 className="font-display text-2xl text-ink">{product.name}</h3>
          {!inStock && (
            <span className="pill-cartoon border-[#7f1d1d] bg-[#f8d7da] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#7f1d1d]">
              Rupture
            </span>
          )}
          {product.isPack && (
            <span className="pill-cartoon px-2 py-1 text-[10px] uppercase tracking-[0.1em]">
              Pack
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-charcoal">{product.description}</p>
        {product.analysisPdf && (
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className="mt-3 inline-flex min-h-[38px] items-center rounded-full border-2 border-[#1a1a1a] bg-[#e8f7f2] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0a7b61] transition-colors hover:bg-[#d7f0e8]"
          >
            Analyse
          </button>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          {hasPromo ? (
            <div className="flex flex-col">
              <span className="price-original text-sm">{formatPrice(product.originalPrice)}</span>
              <div className="flex items-end gap-2">
                <span className="price-promo text-lg">{formatPrice(product.price)}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <p className="text-lg font-bold text-ink">{formatPrice(product.price)}</p>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">TTC</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {onOpenQuickView && (
              <button
                type="button"
                onClick={onOpenQuickView}
                className="btn-cartoon btn-secondary inline-flex min-h-[44px] items-center px-4 py-3 text-xs"
              >
                Voir
              </button>
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
    </article>
  );
}
