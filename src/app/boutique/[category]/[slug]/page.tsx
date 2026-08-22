import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/JsonLd";
import { ProductDetailActions } from "@/components/boutique/ProductDetailActions";
import { ProductImageGallery } from "@/components/boutique/ProductImageGallery";
import { ProductTastingBadge, ProductTastingSection } from "@/components/boutique/ProductTastingSection";
import { ProductCultureBadge } from "@/components/ProductCultureBadge";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer } from "@/lib/own-producer";
import { isProductTastingStorefrontEnabled } from "@/lib/product-tasting-feature";
import { getSiteUrl } from "@/lib/site-url";
import { isRemoteImageUrl } from "@/lib/image-source";
import { isProductCultureModeEligible, type Product } from "@/data/products";
import { getContestProductTastingSummary, isContestSchemaMissingError } from "@/lib/contest-backend";
import { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import {
  sanitizePublicContestProductTastingSummary,
  type PublicContestProductTastingSummary,
} from "@/lib/contest-public-api";
import styles from "./ProductDetailPage.module.css";

export const revalidate = 120;

const categorySlugMap: Record<string, { slug: string; label: string }> = {
  fleurs: { slug: "fleurs-cbd", label: "Fleurs CBD" },
  resines: { slug: "resines-cbd", label: "Résines CBD" },
  huiles: { slug: "huiles-cbd", label: "Huiles CBD" },
  "e-liquide": { slug: "e-liquide-cbd", label: "E-liquides CBD" },
  cosmetiques: { slug: "cosmetiques-cbd", label: "Cosmétiques CBD" },
  alimentaire: { slug: "tisane-cbd", label: "Tisane CBD" },
  miam: { slug: "miam-cbd", label: "Miam CBD" },
  accessoires: { slug: "accessoires-cbd", label: "Accessoires CBD" },
};

type ProductPageProps = {
  params: Promise<{ category: string; slug: string }>;
};

type SiblingProduct = { id: string; name: string; category: string };

type FindProductResult = {
  product: Product;
  producer?: { name: string };
  prevProduct: SiblingProduct | null;
  nextProduct: SiblingProduct | null;
  currentIndex: number;
  totalInCategory: number;
  lowStockThresholdGrams: number;
};

async function findProduct(
  slug: string,
): Promise<FindProductResult | null> {
  const store = await readPublicStoreByBackend();
  const product = store.products.find((p) => p.id === slug);
  if (!product) return null;

  const producer = product.producerId
    ? store.producers.find((pr) => pr.id === product.producerId)
    : getOwnProducer(store.content.boutique);

  // Build same-category product list (deduplicated, stable order)
  const seen = new Set<string>();
  const sameCategoryProducts: SiblingProduct[] = [];
  for (const p of store.products) {
    if (p.category === product.category && !seen.has(p.id)) {
      seen.add(p.id);
      sameCategoryProducts.push({ id: p.id, name: p.name, category: p.category });
    }
  }

  const idx = sameCategoryProducts.findIndex((p) => p.id === product.id);
  const total = sameCategoryProducts.length;

  const prevProduct = total > 1
    ? sameCategoryProducts[(idx - 1 + total) % total]
    : null;
  const nextProduct = total > 1
    ? sameCategoryProducts[(idx + 1) % total]
    : null;

  return {
    product,
    producer,
    prevProduct,
    nextProduct,
    currentIndex: idx,
    totalInCategory: total,
    lowStockThresholdGrams: store.content.boutique.lowStockThresholdGrams,
  };
}

async function findProductTastingSummary(
  productId: string,
): Promise<PublicContestProductTastingSummary | null> {
  if (!isProductTastingStorefrontEnabled() || !isContestFeatureEnabledServer()) {
    return null;
  }

  try {
    const summary = await getContestProductTastingSummary(productId);
    return summary ? sanitizePublicContestProductTastingSummary(summary) : null;
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return null;
    }

    // The tasting module enriches the product page but must never prevent a purchase.
    console.error("Unable to load product tasting summary", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await findProduct(slug);

  if (!result) {
    return {
      title: "Produit introuvable",
      robots: { index: false, follow: false },
    };
  }

  const { product, producer } = result;
  const baseUrl = getSiteUrl();
  const catInfo = categorySlugMap[product.category];
  const canonicalUrl = `${baseUrl}/boutique/${catInfo?.slug ?? product.category}/${product.id}`;
  const brandName = producer?.name ?? "Les Chanvriers Bretons";

  const title = `${product.name} | ${catInfo?.label ?? "CBD"} — ${brandName}`;
  const description =
    product.description.length > 120
      ? `${product.description.slice(0, 117)}...`
      : product.description;
  const metaDescription = `${product.name} — ${description} Producteur ou marque : ${brandName}. Consultez l'origine, la composition, les formats et l'analyse disponible.`;

  const imageUrl = product.images?.[0] ?? product.image;
  const ogImage = isRemoteImageUrl(imageUrl)
    ? imageUrl
    : `${baseUrl}${imageUrl}`;

  return {
    title,
    description: metaDescription.slice(0, 160),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description: metaDescription.slice(0, 160),
      url: canonicalUrl,
      type: "website",
      images: [{ url: ogImage, alt: `${product.name} — ${brandName}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription.slice(0, 160),
      images: [ogImage],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [result, tastingSummary] = await Promise.all([
    findProduct(slug),
    findProductTastingSummary(slug),
  ]);

  if (!result) {
    notFound();
  }

  const {
    product,
    producer,
    prevProduct,
    nextProduct,
    currentIndex,
    totalInCategory,
    lowStockThresholdGrams,
  } = result;
  const baseUrl = getSiteUrl();
  const catInfo = categorySlugMap[product.category];
  const categorySlug = catInfo?.slug ?? `${product.category}-cbd`;
  const categoryLabel = catInfo?.label ?? "CBD";
  const canonicalUrl = `${baseUrl}/boutique/${categorySlug}/${product.id}`;

  const prevHref = prevProduct
    ? `/boutique/${categorySlugMap[prevProduct.category]?.slug ?? `${prevProduct.category}-cbd`}/${prevProduct.id}`
    : null;
  const nextHref = nextProduct
    ? `/boutique/${categorySlugMap[nextProduct.category]?.slug ?? `${nextProduct.category}-cbd`}/${nextProduct.id}`
    : null;

  const allImages = product.images?.length ? product.images : [product.image];
  const brandName = producer?.name ?? "Les Chanvriers Bretons";
  const showCultureBadge =
    isProductCultureModeEligible(product.category) && Boolean(product.cultureMode);

  return (
    <section className={styles.page} data-world="market">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "Boutique CBD", url: `${baseUrl}/boutique` },
          { name: categoryLabel, url: `${baseUrl}/boutique/${categorySlug}` },
          { name: product.name, url: canonicalUrl },
        ]}
      />
      <ProductJsonLd
        product={product}
        producer={producer}
        aggregateRating={tastingSummary && tastingSummary.entry.stats.approvedReviewCount > 0 ? {
          ratingValue: tastingSummary.entry.stats.averageScore,
          ratingCount: tastingSummary.entry.stats.approvedReviewCount,
          bestRating: 100,
        } : undefined}
      />

      <div className="retro-container">
        {/* Breadcrumb navigation */}
        <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
          <Link href="/">
            Accueil
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/boutique">
            Le Marché
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/boutique/${categorySlug}`}>
            {categoryLabel}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <article className={styles.shell}>
          <div className={styles.grid}>
            {/* Product images */}
            <div className={styles.gallery}>
              <ProductImageGallery
                images={allImages}
                videoUrl={product.videoUrl}
                productName={`${product.name} — ${producer?.name ?? "Les Chanvriers Bretons"}`}
                badge={product.badge}
                bonusPoints={product.bonusPoints}
              />
            </div>

            {/* Product info */}
            <div className={styles.info}>
              <p className={styles.eyebrow}>{categoryLabel} · Sélection du Marché</p>
              <h1 className={styles.title}>
                {product.name}
              </h1>

              {(producer || showCultureBadge) && (
                <div className={styles.meta}>
                  {producer && (
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-charcoal">
                      Par{" "}
                      <span className="text-ink">
                        {brandName}
                      </span>
                    </p>
                  )}
                  {showCultureBadge && (
                    <ProductCultureBadge
                      cultureMode={product.cultureMode!}
                      className="text-xs md:text-sm"
                    />
                  )}
                </div>
              )}

              <div className={styles.pricePanel}>
                <span className={styles.price}>
                  {product.price.toFixed(2)} €{product.category === "fleurs" && " / g"}
                </span>
                {product.originalPrice &&
                  product.originalPrice > product.price && (
                    <span className="text-lg font-bold text-charcoal line-through">
                      {product.originalPrice.toFixed(2)} €{product.category === "fleurs" && " / g"}
                    </span>
                  )}
                {product.promoPercent && product.promoPercent > 0 && (
                  <span className="border-2 border-ink bg-yellow px-2 py-1 text-xs font-black uppercase text-ink">
                    -{product.promoPercent}%
                  </span>
                )}
              </div>

              <p className={styles.description}>
                {product.description}
              </p>

              {tastingSummary ? <ProductTastingBadge summary={tastingSummary} /> : null}


              <ProductDetailActions
                product={product}
                lowStockThresholdGrams={lowStockThresholdGrams}
              />

              <div className={styles.backLinks}>
                <Link
                  href={`/boutique/${categorySlug}`}
                  className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs"
                >
                  ← Retour {categoryLabel}
                </Link>
                <Link
                  href="/boutique"
                  className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs"
                >
                  Toute la boutique
                </Link>
              </div>
            </div>
          </div>
        </article>

        {tastingSummary ? (
          <ProductTastingSection
            summary={tastingSummary}
            showArenaLink={!isContestBetaAccessRestrictedServer()}
          />
        ) : null}

        {/* Prev / Next same-category navigation */}
        {totalInCategory > 1 && (
          <nav className={styles.pager} aria-label="Autres produits de la même catégorie">
            {prevHref ? (
              <Link
                href={prevHref}
                className="btn-cartoon btn-secondary inline-flex h-10 items-center gap-2 px-4 text-xs"
                title={prevProduct!.name}
              >
                ‹ Précédent
              </Link>
            ) : (
              <span />
            )}
            <span className={styles.pagerCount}>
              {currentIndex + 1} / {totalInCategory} — même catégorie
            </span>
            {nextHref ? (
              <Link
                href={nextHref}
                className="btn-cartoon btn-secondary inline-flex h-10 items-center gap-2 px-4 text-xs"
                title={nextProduct!.name}
              >
                Suivant ›
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
