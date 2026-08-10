import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Star } from "lucide-react";
import styles from "@/components/ProductCard.module.css";
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
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import {
  formatContestAverage,
  formatContestDate,
  getContestReviewAverage,
} from "@/lib/contest-ui";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import {
  CONTEST_SCORE_CRITERIA,
  CONTEST_SCORE_CRITERION_LABELS,
} from "@/types/contest";
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
  tastingSummary?: PublicContestProductTastingSummary;
};

export function ProductCard({
  product,
  producer,
  addButtonLabel = "Ajouter",
  lowStockThresholdGrams = 0,
  imagePriority = false,
  tastingSummary,
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
  const tastingEntry = tastingSummary?.entry;
  const tastingCriteria = tastingEntry
    ? CONTEST_SCORE_CRITERIA.flatMap((criterion) => {
        const score = tastingEntry.stats.criterionAverages[criterion];
        return typeof score === "number" ? [{ criterion, score }] : [];
      }).slice(0, 4)
    : [];

  const safeBonusPoints =
    Number.isFinite(Number(product.bonusPoints)) && Number(product.bonusPoints) > 0
      ? Math.floor(Number(product.bonusPoints))
      : 0;

  return (
    <article className={`product-card group ${styles.card}`} data-world="market">
      {/* Multi-image: carousel (client), Single-image: static Image (server) */}
      {hasMultipleImages ? (
        <ProductImageCarousel
          images={allImages}
          alt={product.name}
          badge={product.badge}
          bonusPoints={product.bonusPoints}
          promoText={hasPromo ? `Moins ${product.promoPercent}%` : undefined}
          priority={imagePriority}
          className={styles.media}
          sizes={IMAGE_SIZES}
        />
      ) : (
        <div className={styles.media}>
          <Image
            src={firstImage}
            alt={product.name}
            fill
            sizes={IMAGE_SIZES}
            priority={imagePriority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {product.badge && (
            <span className="absolute left-3 top-4 z-10 border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-1 text-xs font-black uppercase tracking-wide">
              {product.badge}
            </span>
          )}
          {hasPromo && (
            <span className="promo-banner absolute right-3 top-3 z-10 px-3 py-1 text-xs">
              Moins {product.promoPercent}%
            </span>
          )}
          {safeBonusPoints > 0 && (
            <span className="absolute bottom-3 left-3 z-10 border-2 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-black uppercase text-ink">
              +{safeBonusPoints} pts {"\u2605"}
            </span>
          )}
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.categoryRow}>
          <p className={styles.category}>
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
          <div className={styles.producer}>
            <div className={styles.producerImage}>
              <Image
                src={producer.image}
                alt={producer.name}
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-ink">{producer.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-charcoal">{producerLocation}</p>
            </div>
          </div>
        )}
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            <Link href={productHref} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          {!inStock && (
            <span className={`${styles.status} bg-[#f8d7da] text-[#7f1d1d]`}>
              Rupture
            </span>
          )}
          {inStock && stockInfo.isLowStock && stockInfo.remainingGrams !== null && (
            <span className={`${styles.status} bg-[#f8d7da] text-[#7f1d1d]`}>
              Plus que {formatRemainingGrams(stockInfo.remainingGrams)}
            </span>
          )}
          {product.isPack && (
            <span className={`${styles.status} bg-yellow text-ink`}>
              Pack
            </span>
          )}
        </div>
        <div className={styles.description}>{product.description}</div>

        {tastingSummary && tastingEntry ? (
          <details className={`group/tasting ${styles.tasting}`}>
            <summary className={`${styles.tastingSummary} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={styles.tastingIcon}>
                  <Star size={15} fill="currentColor" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-black uppercase tracking-[0.09em] text-charcoal">
                    Notes et avis vérifiés
                  </span>
                  <span className="mt-0.5 block text-xs font-black text-ink">
                    {tastingEntry.stats.approvedReviewCount > 0
                      ? `${formatContestAverage(tastingEntry.stats.averageScore)} / ${CONTEST_SCORE_MAX} · ${tastingEntry.stats.approvedReviewCount} avis`
                      : "Aucun avis publié"}
                  </span>
                </span>
              </span>
              <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open/tasting:rotate-180" />
            </summary>

            <div className={styles.tastingBody}>
              <p className="text-[11px] leading-relaxed text-charcoal">
                Lot {tastingEntry.season?.label ?? tastingEntry.title} · avis publiés après modération.
              </p>

              {tastingCriteria.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {tastingCriteria.map(({ criterion, score }) => (
                    <div key={criterion} className={`flex items-center justify-between gap-3 px-2.5 py-2 ${styles.criterion}`}>
                      <span className="text-[11px] font-bold text-charcoal">
                        {CONTEST_SCORE_CRITERION_LABELS[criterion]}
                      </span>
                      <span className="shrink-0 border border-[#1a1a1a] bg-yellow px-2 py-0.5 text-[10px] font-black text-ink">
                        {formatContestAverage(score)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {tastingSummary.reviews.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {tastingSummary.reviews.map((review) => (
                    <article key={review.id} className={`p-2.5 ${styles.review}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-ink">
                          {review.pseudo}
                        </span>
                        <span className="shrink-0 text-[10px] font-black text-ink">
                          {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-charcoal">
                        {formatContestDate(review.reviewedAt ?? review.createdAt)}
                      </p>
                      <p className={`mt-2 line-clamp-3 text-xs leading-relaxed text-charcoal ${review.comment.trim() ? "" : "italic"}`}>
                        {review.comment.trim() || "Pas de commentaire rédigé."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              <Link
                href={`${productHref}#avis-degustation`}
                className="btn-cartoon btn-secondary mt-3 inline-flex min-h-10 w-full items-center justify-center px-3 text-[11px]"
              >
                Lire les avis sur la fiche
              </Link>
            </div>
          </details>
        ) : null}

        <div className={styles.actions}>
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
      </div>
    </article>
  );
}
