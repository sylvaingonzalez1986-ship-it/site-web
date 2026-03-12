import Image from "next/image";
import Link from "next/link";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";
import { ProductCardActions } from "@/components/ProductCardActions";
import { ProductCultureBadge } from "@/components/ProductCultureBadge";
import {
  categoryLabels,
  isProductCultureModeEligible,
  type Product,
} from "@/data/products";
import {
  formatRemainingGrams,
  getStockDisplayInfo,
  isProductInStock,
} from "@/lib/product-stock";
import { hasActiveProductPromo } from "@/lib/product-promo";
import type { Producer } from "@/types/store";

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

const IMAGE_SIZES = "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 31vw";

type ProductCardProps = {
  product: Product;
  producer?: Producer;
  addButtonLabel?: string;
  lowStockThresholdGrams?: number;
  imagePriority?: boolean;
};

export function ProductCard({
  product,
  producer,
  addButtonLabel = "Ajouter",
  lowStockThresholdGrams = 0,
  imagePriority = false,
}: ProductCardProps) {
  const allImages = product.images?.length ? product.images : [product.image];
  const firstImage = allImages[0];
  const hasMultipleImages = allImages.length > 1;
  const hasPromo = hasActiveProductPromo(product);
  const inStock = isProductInStock(product);
  const requiresVariantChoice = (product.variantOptions?.length ?? 0) > 0;
  const stockInfo = getStockDisplayInfo(product, lowStockThresholdGrams);
  const producerLocation = producer
    ? [producer.department, producer.region].filter(Boolean).join(", ") || producer.location
    : "";
  const productHref = `/boutique/${categorySlugs[product.category] ?? `${product.category}-cbd`}/${product.id}`;
  const showCultureBadge =
    isProductCultureModeEligible(product.category) && Boolean(product.cultureMode);

  const safeBonusPoints =
    Number.isFinite(Number(product.bonusPoints)) && Number(product.bonusPoints) > 0
      ? Math.floor(Number(product.bonusPoints))
      : 0;

  return (
    <article className="product-card group card-cartoon overflow-hidden bg-cream">
      {/* Multi-image: carousel (client), Single-image: static Image (server) */}
      {hasMultipleImages ? (
        <ProductImageCarousel
          images={allImages}
          alt={product.name}
          badge={product.badge}
          bonusPoints={product.bonusPoints}
          promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
          priority={imagePriority}
          className="border-b-2 border-[#1a1a1a]"
          sizes={IMAGE_SIZES}
        />
      ) : (
        <div className="relative aspect-square overflow-hidden border-b-2 border-[#1a1a1a]">
          <Image
            src={firstImage}
            alt={product.name}
            fill
            sizes={IMAGE_SIZES}
            priority={imagePriority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {product.badge && (
            <span className="absolute left-3 top-3 z-10 border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-1 text-xs font-bold uppercase tracking-wide">
              {product.badge}
            </span>
          )}
          {hasPromo && (
            <span className="promo-banner absolute right-3 top-3 z-10 px-3 py-1 text-xs">
              Moins {product.promoPercent}%
            </span>
          )}
          {safeBonusPoints > 0 && (
            <span className="pill-cartoon absolute bottom-3 left-3 z-10 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-bold text-ink">
              +{safeBonusPoints} pts {"\u2605"}
            </span>
          )}
        </div>
      )}

      <div className="product-card-body p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
            {categoryLabels[product.category]}
          </p>
          {showCultureBadge && (
            <ProductCultureBadge
              cultureMode={product.cultureMode!}
              className="text-[10px] md:text-[11px]"
            />
          )}
        </div>
        {producer && (
          <div className="cartoon-border mt-3 flex items-center gap-2 bg-yellow px-3 py-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
              <Image
                src={producer.image}
                alt={producer.name}
                fill
                sizes="32px"
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

        <ProductCardActions
          product={product}
          productHref={productHref}
          addButtonLabel={addButtonLabel}
          inStock={inStock}
          requiresVariantChoice={requiresVariantChoice}
          maxPurchasableQty={stockInfo.maxPurchasableQty}
          hasPromo={hasPromo}
        />
      </div>
    </article>
  );
}
