"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { ProductQuickViewCarousel } from "@/components/boutique/ProductQuickViewCarousel";
import { type Product, type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { hasActiveProductPromo } from "@/lib/product-promo";
import type { BoutiqueSection } from "@/types/store";

type Filter = "all" | "promos" | ProductCategory;
type ShowcaseMode = "products" | "copains";

function getProductDedupKey(product: Product): string {
  return [
    product.name.trim().toLowerCase(),
    product.category,
    Number(product.price || 0).toFixed(2),
    product.producerId ?? "",
    product.isPack ? "pack" : "single",
  ].join("|");
}

export default function BoutiquePage() {
  const { store, loading } = useCmsStore();
  const boutique = store.content.boutique;
  const [filter, setFilter] = useState<Filter>("all");
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>("products");
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);
  const [quickViewSourceProducts, setQuickViewSourceProducts] = useState<Product[]>([]);

  const uniqueProducts = useMemo(() => {
    const seenKeys = new Set<string>();
    const nextProducts: Product[] = [];

    for (const product of store.products) {
      const key = getProductDedupKey(product);
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      nextProducts.push(product);
    }

    return nextProducts;
  }, [store.products]);

  const ownProducts = useMemo(
    () => uniqueProducts.filter((product) => !product.producerId),
    [uniqueProducts],
  );

  const promoProducts = useMemo(
    () => uniqueProducts.filter((product) => hasActiveProductPromo(product)),
    [uniqueProducts],
  );

  const filteredOwnProducts = useMemo(
    () =>
      filter === "all"
        ? ownProducts
        : filter === "promos"
          ? ownProducts.filter((item) => hasActiveProductPromo(item))
        : ownProducts.filter((item) => item.category === filter),
    [filter, ownProducts],
  );

  const partnerProducts = useMemo(
    () => uniqueProducts.filter((product) => product.producerId),
    [uniqueProducts],
  );

  const filteredPartnerProducts = useMemo(
    () =>
      filter === "all"
        ? partnerProducts
        : filter === "promos"
          ? partnerProducts.filter((item) => hasActiveProductPromo(item))
          : partnerProducts.filter((item) => item.category === filter),
    [filter, partnerProducts],
  );

  const producersById = useMemo(
    () => new Map(store.producers.map((producer) => [producer.id, producer])),
    [store.producers],
  );

  const boutiqueSections = useMemo(
    () => store.sections.boutique.filter((section) => section.visible),
    [store.sections.boutique],
  );

  const openQuickView = (productId: string, sourceProducts: Product[]) => {
    setQuickViewProductId(productId);
    setQuickViewSourceProducts(sourceProducts);
  };

  const closeQuickView = () => {
    setQuickViewProductId(null);
    setQuickViewSourceProducts([]);
  };

  const renderBoutiqueSection = (section: BoutiqueSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-8";

    switch (section.type) {
      case "header":
        return (
          <div key={section.id} className={`cartoon-border bg-cream p-8 ${spacingClass}`}>
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">{boutique.eyebrow}</p>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
              {boutique.description}
            </p>
            <div className="mt-6">
              <div className="mx-auto mb-5 w-full max-w-3xl">
                <div className="inline-flex w-full overflow-hidden rounded border-2 border-[#1a1a1a] bg-white">
                  <button
                    type="button"
                    className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors ${
                      showcaseMode === "products"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    }`}
                    onClick={() => setShowcaseMode("products")}
                  >
                    Nos produits
                  </button>
                  <button
                    type="button"
                    className={`flex-1 border-l-2 border-[#1a1a1a] px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors ${
                      showcaseMode === "copains"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    } ${partnerProducts.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => {
                      if (partnerProducts.length > 0) {
                        setShowcaseMode("copains");
                      }
                    }}
                    disabled={partnerProducts.length === 0}
                  >
                    Le coin des copains
                  </button>
                </div>
              </div>
              <CategoryFilter selected={filter} onChange={setFilter} />
            </div>
          </div>
        );
      case "products": {
        const displayedProducts = showcaseMode === "products"
          ? filter === "promos"
            ? promoProducts
            : filteredOwnProducts
          : filteredPartnerProducts;
        const isCopainsMode = showcaseMode === "copains";

        return (
          <div key={section.id} className={spacingClass}>
            {isCopainsMode && (
              <div className="cartoon-border mb-6 bg-yellow p-8">
                <h2 className="font-display text-4xl text-ink">{boutique.copainsSectionTitle}</h2>
                <p className="mt-3 max-w-3xl text-charcoal">{boutique.copainsSectionDescription}</p>
              </div>
            )}

            {filter === "promos" && displayedProducts.length > 0 && (
              <div className="cartoon-border mb-6 bg-[#d35400] p-5 text-white">
                <h3 className="font-display text-3xl text-white">Promotions en cours</h3>
                <p className="mt-2 text-sm text-white/95">
                  Retrouve ici toutes les offres actives, y compris les packs promo.
                </p>
              </div>
            )}

            {isCopainsMode ? (
              <ProducerBar
                producers={store.producers}
                products={displayedProducts}
                addButtonLabel={boutique.addButtonLabel}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
                onOpenQuickView={openQuickView}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    producer={product.producerId ? producersById.get(product.producerId) : undefined}
                    addButtonLabel={boutique.addButtonLabel}
                    onOpenQuickView={() => openQuickView(product.id, displayedProducts)}
                  />
                ))}
              </div>
            )}

            {displayedProducts.length === 0 && !loading && (
              <div className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
                {filter === "promos"
                  ? "Aucune promotion en cours."
                  : isCopainsMode
                    ? "Aucun produit partenaire pour ce filtre."
                    : boutique.emptyMessage}
              </div>
            )}
          </div>
        );
      }
      case "copains":
        return null;
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="card"
            className={spacingClass}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        {boutiqueSections.map((section, index) => renderBoutiqueSection(section, index))}
      </div>
      <ProductQuickViewCarousel
        productId={quickViewProductId}
        products={quickViewSourceProducts}
        producersById={producersById}
        addButtonLabel={boutique.addButtonLabel}
        onChangeProductId={setQuickViewProductId}
        onClose={closeQuickView}
      />
    </section>
  );
}
