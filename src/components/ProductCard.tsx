import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
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

const IMAGE_SIZES = "(max-width: 1024px) 46vw, 31vw";

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
          <details className={styles.tasting}>
            <summary className={styles.tastingSummary}>
              <span className={styles.tastingHeading}>
                <span className={styles.tastingIcon}>
                  <Star size={15} fill="currentColor" aria-hidden="true" />
                </span>
                <span className={styles.tastingTitle}>Notes du Carnet</span>
              </span>
              <span className={styles.tastingMetrics}>
                {tastingEntry.stats.approvedReviewCount > 0 ? <>
                  <span className={styles.tastingAverage}><strong>{formatContestAverage(tastingEntry.stats.averageScore)}</strong> / {CONTEST_SCORE_MAX}</span>
                  <span className={styles.tastingCount}>{tastingEntry.stats.approvedReviewCount} avis</span>
                </> : <span className={styles.tastingCount}>Aucun avis publié</span>}
              </span>
              <ChevronDown size={18} aria-hidden="true" className={styles.tastingChevron} />
            </summary>

            <div className={styles.tastingBody}>
              <p className={styles.tastingLot}>
                Lot {tastingEntry.season?.label ?? tastingEntry.title} · avis publiés après modération.
              </p>

              {tastingCriteria.length > 0 ? (
                <dl className={styles.tastingCriteria}>
                  {tastingCriteria.map(({ criterion, score }) => (
                    <div key={criterion} className={styles.criterion}>
                      <dt>
                        {CONTEST_SCORE_CRITERION_LABELS[criterion]}
                      </dt>
                      <dd>
                        {formatContestAverage(score)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {tastingSummary.reviews.length > 0 ? (
                <div className={styles.tastingReviews}>
                  {tastingSummary.reviews.map((review) => (
                    <article key={review.id} className={styles.review}>
                      <div className={styles.reviewHeading}>
                        <strong>
                          {review.pseudo}
                        </strong>
                        <span>
                          {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                        </span>
                      </div>
                      <p className={styles.reviewDate}>
                        {formatContestDate(review.reviewedAt ?? review.createdAt)}
                      </p>
                      <p className={styles.reviewComment} data-empty={!review.comment.trim() || undefined}>
                        {review.comment.trim() || "Pas de commentaire rédigé."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              <Link
                href={`${productHref}#avis-degustation`}
                className={styles.tastingLink}
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
