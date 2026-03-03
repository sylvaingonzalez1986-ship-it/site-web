import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/JsonLd";
import { ProductDetailActions } from "@/components/boutique/ProductDetailActions";
import { ProductImageGallery } from "@/components/boutique/ProductImageGallery";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";
import { isRemoteImageUrl } from "@/lib/image-source";
import type { Product } from "@/data/products";

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

  const title = `${product.name} | ${catInfo?.label ?? "CBD"} Naturel Direct Producteur Breton`;
  const description =
    product.description.length > 120
      ? `${product.description.slice(0, 117)}...`
      : product.description;
  const metaDescription = `${product.name} — ${description} ${brandName}. CBD naturel breton, direct producteur, livraison rapide en France.`;

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
      images: [{ url: ogImage, alt: `${product.name} – CBD naturel direct producteur breton` }],
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
  const result = await findProduct(slug);

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

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "Boutique CBD", url: `${baseUrl}/boutique` },
          { name: categoryLabel, url: `${baseUrl}/boutique/${categorySlug}` },
          { name: product.name, url: canonicalUrl },
        ]}
      />
      <ProductJsonLd product={product} />

      <div className="retro-container">
        {/* Breadcrumb navigation */}
        <nav
          className="mb-6 text-sm text-charcoal"
          aria-label="Fil d'Ariane"
        >
          <Link href="/" className="hover:text-ink underline">
            Accueil
          </Link>
          {" > "}
          <Link href="/boutique" className="hover:text-ink underline">
            Boutique
          </Link>
          {" > "}
          <Link
            href={`/boutique/${categorySlug}`}
            className="hover:text-ink underline"
          >
            {categoryLabel}
          </Link>
          {" > "}
          <span className="font-bold text-ink">{product.name}</span>
        </nav>

        <div className="cartoon-border bg-cream p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Product images */}
            <ProductImageGallery
              images={allImages}
              videoUrl={product.videoUrl}
              productName={`${product.name} — ${categoryLabel} CBD bio breton`}
              badge={product.badge}
              bonusPoints={product.bonusPoints}
            />

            {/* Product info */}
            <div className="flex flex-col">
              <h1 className="font-display text-3xl text-ink md:text-4xl">
                {product.name}
              </h1>

              {producer && (
                <p className="mt-2 text-sm text-charcoal">
                  Par{" "}
                  <span className="font-semibold text-ink">
                    {brandName}
                  </span>
                </p>
              )}

              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-display text-3xl text-ink">
                  {product.price.toFixed(2)} €{product.category === "fleurs" && " / g"}
                </span>
                {product.originalPrice &&
                  product.originalPrice > product.price && (
                    <span className="text-lg text-charcoal line-through">
                      {product.originalPrice.toFixed(2)} €{product.category === "fleurs" && " / g"}
                    </span>
                  )}
                {product.promoPercent && product.promoPercent > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">
                    -{product.promoPercent}%
                  </span>
                )}
              </div>

              {product.variantOptions && product.variantOptions.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-ink">
                    {product.variantLabel ?? "Options"} :
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.variantOptions
                      .filter((v) => v.enabled !== false)
                      .map((variant) => (
                        <span
                          key={variant.id}
                          className="rounded-full border border-[#1a1a1a] bg-mint px-3 py-1 text-xs font-medium text-ink"
                        >
                          {variant.label} — {variant.price.toFixed(2)} €
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <p className="mt-6 text-base leading-relaxed text-charcoal">
                {product.description}
              </p>

              {product.analysisPdf && (
                <a
                  href={product.analysisPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-cartoon btn-secondary mt-4 inline-flex h-10 w-fit items-center gap-2 px-4 text-xs"
                >
                  📄 Voir l&apos;analyse laboratoire
                </a>
              )}

              <ProductDetailActions
                product={product}
                lowStockThresholdGrams={lowStockThresholdGrams}
              />

              <div className="mt-6 flex flex-wrap gap-3">
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
        </div>

        {/* Prev / Next same-category navigation */}
        {totalInCategory > 1 && (
          <div className="cartoon-border mt-6 flex items-center justify-between bg-cream px-4 py-3">
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
            <span className="text-xs font-semibold text-charcoal">
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
          </div>
        )}
      </div>
    </section>
  );
}
