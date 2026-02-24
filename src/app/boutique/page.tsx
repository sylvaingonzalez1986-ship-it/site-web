"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { ProductQuickViewCarousel } from "@/components/boutique/ProductQuickViewCarousel";
import { categoryLabels, type Product, type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { hasActiveProductPromo } from "@/lib/product-promo";
import type { BoutiqueSection } from "@/types/store";

type Filter = "all" | "promos" | ProductCategory;
type ShowcaseMode = "products" | "neighbors" | "copains";

function isPrintfulProduct(product: Product): boolean {
  return product.id.startsWith("printful-p-") || product.id.startsWith("printful-v-");
}

function normalizeGeoLabel(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesDepartmentCode(label: string, code: string): boolean {
  return (
    label === code ||
    label.startsWith(`${code} `) ||
    label.startsWith(`${code}-`) ||
    label.includes(`(${code})`) ||
    label.endsWith(` ${code}`)
  );
}

function getProductDedupKey(product: Product): string {
  return [
    product.name.trim().toLowerCase(),
    product.category,
    Number(product.price || 0).toFixed(2),
    product.producerId ?? "",
    product.isPack ? "pack" : "single",
  ].join("|");
}

function mergeUniqueProductsById(products: Product[]): Product[] {
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const product of products) {
    if (seen.has(product.id)) {
      continue;
    }
    seen.add(product.id);
    merged.push(product);
  }

  return merged;
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
    () =>
      uniqueProducts.filter(
        (product) => !product.producerId && !isPrintfulProduct(product),
      ),
    [uniqueProducts],
  );

  const partnerProducts = useMemo(
    () =>
      uniqueProducts.filter(
        (product) => product.producerId && !isPrintfulProduct(product),
      ),
    [uniqueProducts],
  );

  const neighborProducerIds = useMemo(() => {
    const ids = new Set<string>();

    for (const producer of store.producers) {
      const region = normalizeGeoLabel(producer.region);
      const department = normalizeGeoLabel(producer.department);
      const isBretagne = region.includes("bretagne");
      const isLoireAtlantique =
        department.includes("loire-atlantique") ||
        department.includes("loire atlantique") ||
        matchesDepartmentCode(department, "44");
      const isMayenne =
        department.includes("mayenne") || matchesDepartmentCode(department, "53");

      if (isBretagne || isLoireAtlantique || isMayenne) {
        ids.add(producer.id);
      }
    }

    return ids;
  }, [store.producers]);

  const voisinProducts = useMemo(
    () =>
      partnerProducts.filter(
        (product) => product.producerId && neighborProducerIds.has(product.producerId),
      ),
    [neighborProducerIds, partnerProducts],
  );

  const copainsProducts = useMemo(
    () =>
      partnerProducts.filter(
        (product) => product.producerId && !neighborProducerIds.has(product.producerId),
      ),
    [neighborProducerIds, partnerProducts],
  );

  const globalAccessoriesProducts = useMemo(
    () => uniqueProducts.filter((product) => product.category === "accessoires"),
    [uniqueProducts],
  );
  const modeProducts = useMemo(() => {
    if (showcaseMode === "neighbors") {
      return voisinProducts;
    }

    if (showcaseMode === "copains") {
      return copainsProducts;
    }

    return ownProducts;
  }, [copainsProducts, ownProducts, showcaseMode, voisinProducts]);

  const availableFilters = useMemo(() => {
    const categoryOrder = Object.keys(categoryLabels) as ProductCategory[];
    const modeCategoryCounts = new Map<ProductCategory, number>();

    for (const product of modeProducts) {
      if (product.category === "accessoires") {
        continue;
      }
      modeCategoryCounts.set(product.category, (modeCategoryCounts.get(product.category) ?? 0) + 1);
    }

    const filters: Filter[] = [];
    const hasPromos = mergeUniqueProductsById([...modeProducts, ...globalAccessoriesProducts]).some((product) =>
      hasActiveProductPromo(product),
    );
    const hasModeProducts = modeProducts.length > 0;

    if (hasModeProducts) {
      filters.push("all");
    }

    if (hasPromos) {
      filters.push("promos");
    }

    for (const category of categoryOrder) {
      if (category === "accessoires") {
        continue;
      }
      if ((modeCategoryCounts.get(category) ?? 0) > 0) {
        filters.push(category);
      }
    }

    if (globalAccessoriesProducts.length > 0) {
      filters.push("accessoires");
    }

    return filters;
  }, [globalAccessoriesProducts, modeProducts]);

  useEffect(() => {
    if (!availableFilters.includes(filter)) {
      setFilter("all");
    }
  }, [availableFilters, filter]);

  const displayedProducts = useMemo(() => {
    // Accessoires stays shared across the 3 top tabs by product decision.
    if (filter === "accessoires") {
      return globalAccessoriesProducts;
    }

    if (filter === "promos") {
      return mergeUniqueProductsById([...modeProducts, ...globalAccessoriesProducts]).filter((product) =>
        hasActiveProductPromo(product),
      );
    }

    if (filter === "all") {
      return modeProducts;
    }

    return modeProducts.filter((item) => item.category === filter);
  }, [filter, globalAccessoriesProducts, modeProducts]);

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
                <div className="grid w-full grid-cols-3 overflow-hidden rounded border-2 border-[#1a1a1a] bg-white">
                  <button
                    type="button"
                    className={`flex min-h-[58px] items-center justify-center px-2 py-3 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] transition-colors md:px-4 md:text-sm md:tracking-[0.1em] ${
                      showcaseMode === "products"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    }`}
                    onClick={() => setShowcaseMode("products")}
                  >
                    <span className="block">Mes produits</span>
                  </button>
                  <button
                    type="button"
                    className={`flex min-h-[58px] items-center justify-center border-l-2 border-[#1a1a1a] px-2 py-3 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] transition-colors md:px-4 md:text-sm md:tracking-[0.1em] ${
                      showcaseMode === "neighbors"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    } ${voisinProducts.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => {
                      if (voisinProducts.length > 0) {
                        setShowcaseMode("neighbors");
                      }
                    }}
                    disabled={voisinProducts.length === 0}
                  >
                    <span className="block">Mes voisins</span>
                  </button>
                  <button
                    type="button"
                    className={`flex min-h-[58px] items-center justify-center border-l-2 border-[#1a1a1a] px-2 py-3 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] transition-colors md:px-4 md:text-sm md:tracking-[0.1em] ${
                      showcaseMode === "copains"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    } ${copainsProducts.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => {
                      if (copainsProducts.length > 0) {
                        setShowcaseMode("copains");
                      }
                    }}
                    disabled={copainsProducts.length === 0}
                  >
                    <span className="block">Les copains de France et de Navarre</span>
                  </button>
                </div>
              </div>
              {availableFilters.length > 1 && (
                <CategoryFilter selected={filter} filters={availableFilters} onChange={setFilter} />
              )}
            </div>
          </div>
        );
      case "products": {
        const isNeighborsMode = showcaseMode === "neighbors";
        const isCopainsMode = showcaseMode === "copains";
        const isPartnerMode = isNeighborsMode || isCopainsMode;
        const hasProducerProducts = displayedProducts.some((product) => Boolean(product.producerId));

        return (
          <div key={section.id} className={spacingClass}>
            {isNeighborsMode && (
              <div className="cartoon-border mb-6 bg-[#d7f0e8] p-8">
                <h2 className="font-display text-4xl text-ink">Mes voisins</h2>
                <p className="mt-3 max-w-3xl text-charcoal">
                  Producteurs bretons et du 44 (parce que c'était la famille avant que Pétain foute le bordel).
                </p>
              </div>
            )}
            {isCopainsMode && (
              <div className="cartoon-border mb-6 bg-yellow p-8">
                <h2 className="font-display text-4xl text-ink">
                  Les copains de France et de Navarre
                </h2>
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

            {isPartnerMode && hasProducerProducts ? (
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
                  : isNeighborsMode
                    ? "Aucun produit voisin pour ce filtre."
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
