"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { categoryLabels, type Product, type ProductCategory } from "@/data/products";
import { resolveProductProducer, sortOwnProductsFirst } from "@/lib/own-producer";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { mergeUniqueProductsById } from "@/lib/boutique-helpers";
import type { BoutiqueSection, Producer, PublicStoreResponse } from "@/types/store";

const RegionProducerShowcase = dynamic(
  () => import("@/components/boutique/RegionProducerShowcase").then((mod) => mod.RegionProducerShowcase),
  { ssr: false },
);

const ProducerTcgModal = dynamic(
  () => import("@/components/boutique/ProducerTcgModal").then((mod) => mod.ProducerTcgModal),
  { ssr: false },
);

type Filter = "all" | "promos" | ProductCategory;
type ShowcaseMode = "products" | "neighbors" | "copains" | "regions";

type BoutiquePageClientProps = {
  boutique: PublicStoreResponse["content"]["boutique"];
  producers: Producer[];
  ownProducer: Producer;
  ownProducts: Product[];
  partnerProducts: Product[];
  voisinProducts: Product[];
  copainsProducts: Product[];
  globalAccessoriesProducts: Product[];
  boutiqueSections: BoutiqueSection[];
};

export function BoutiquePageClient({
  boutique,
  producers,
  ownProducer,
  ownProducts,
  partnerProducts,
  voisinProducts,
  copainsProducts,
  globalAccessoriesProducts,
  boutiqueSections,
}: BoutiquePageClientProps) {
  const loading = false;
  const [filter, setFilter] = useState<Filter>("all");
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>("products");
  const [selectedOwnProducerId, setSelectedOwnProducerId] = useState<string | null>(null);

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

  const effectiveFilter: Filter = availableFilters.includes(filter) ? filter : "all";

  const displayedProducts = useMemo(() => {
    if (effectiveFilter === "accessoires") {
      return sortOwnProductsFirst(globalAccessoriesProducts);
    }

    if (effectiveFilter === "promos") {
      return sortOwnProductsFirst(
        mergeUniqueProductsById([...modeProducts, ...globalAccessoriesProducts]).filter((product) =>
          hasActiveProductPromo(product),
        ),
      );
    }

    if (effectiveFilter === "all") {
      return modeProducts;
    }

    return modeProducts.filter((item) => item.category === effectiveFilter);
  }, [effectiveFilter, globalAccessoriesProducts, modeProducts]);

  const displayedOwnProducts = useMemo(
    () => displayedProducts.filter((product) => !product.producerId),
    [displayedProducts],
  );

  const producersById = useMemo(
    () => new Map(producers.map((producer) => [producer.id, producer])),
    [producers],
  );

  const ownProductsByProducerId = useMemo(
    () => new Map([[ownProducer.id, displayedOwnProducts]]),
    [displayedOwnProducts, ownProducer.id],
  );

  const renderBoutiqueSection = (section: BoutiqueSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-8";

    switch (section.type) {
      case "header":
        return (
          <div key={section.id} className={`cartoon-border bg-cream p-8 ${spacingClass}`}>
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">{boutique.eyebrow}</p>
            <h1 className="section-title mt-5 text-center text-ink">Chanvre Naturel</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
              {boutique.description}
            </p>
            <div className="mt-6">
              <div className="mx-auto mb-5 w-full max-w-3xl">
                <div className="grid w-full grid-cols-2 overflow-hidden rounded border-2 border-[#1a1a1a] bg-white sm:grid-cols-4">
                  <button
                    type="button"
                    data-tutorial="tab-mes-produits"
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
                    data-tutorial="tab-mes-voisins"
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
                    data-tutorial="tab-les-copains"
                    className={`flex min-h-[58px] items-center justify-center border-t-2 border-[#1a1a1a] px-2 py-3 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] transition-colors sm:border-t-0 sm:border-l-2 md:px-4 md:text-sm md:tracking-[0.1em] ${
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
                  <button
                    type="button"
                    className={`flex min-h-[58px] items-center justify-center border-l-2 border-t-2 border-[#1a1a1a] px-2 py-3 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] transition-colors sm:border-t-0 md:px-4 md:text-sm md:tracking-[0.1em] ${
                      showcaseMode === "regions"
                        ? "bg-[#0a7b61] text-white"
                        : "text-ink hover:bg-[#f2ede2]"
                    }`}
                    onClick={() => setShowcaseMode("regions")}
                  >
                    <span className="block">Par region</span>
                  </button>
                </div>
              </div>
              {showcaseMode !== "regions" && availableFilters.length > 1 && (
                <CategoryFilter selected={effectiveFilter} filters={availableFilters} onChange={setFilter} />
              )}
            </div>
          </div>
        );
      case "products": {
        if (showcaseMode === "regions") {
          return (
            <div key={section.id} className={spacingClass}>
              <RegionProducerShowcase
                producers={producers}
                products={partnerProducts}
                ownProducer={ownProducer}
                ownProducts={ownProducts}
                addButtonLabel={boutique.addButtonLabel}
                lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
              />
            </div>
          );
        }

        const isNeighborsMode = showcaseMode === "neighbors";
        const isCopainsMode = showcaseMode === "copains";
        const isPartnerMode = isNeighborsMode || isCopainsMode;
        const hasProducerProducts = displayedProducts.some((product) => Boolean(product.producerId));
        const showOwnProducerCard =
          showcaseMode === "products" && displayedOwnProducts.length > 0;

        return (
          <div key={section.id} className={spacingClass}>
            {isNeighborsMode && (
              <div className="cartoon-border mb-6 bg-[#d7f0e8] p-8">
                <h2 className="font-display text-4xl text-ink">Mes voisins</h2>
                <p className="mt-3 max-w-3xl text-charcoal">
                  Producteurs bretons et du 44. Parce que oui, Nantes fait partie de la Bretagne historique et que sans un mar&eacute;chal s&eacute;nile, ce d&eacute;partement serait toujours breton.
                </p>
              </div>
            )}
            {isCopainsMode && (
              <div className="cartoon-border mb-6 bg-yellow p-8">
                <h2 className="font-display text-4xl text-ink">
                  Les copains de France et de Navarre
                </h2>
                <p className="mt-3 max-w-3xl text-charcoal">
                  Il existe de nombreux talents et de superbes produits partout en France. D&eacute;couvrez ici ceux de quelques producteurs qui partagent nos valeurs.
                </p>
              </div>
            )}

            {effectiveFilter === "promos" && displayedProducts.length > 0 && (
              <div className="cartoon-border mb-6 bg-[#d35400] p-5 text-white">
                <h3 className="font-display text-3xl text-white">Promotions en cours</h3>
                <p className="mt-2 text-sm text-white/95">
                  Retrouve ici toutes les offres actives, y compris les packs promo.
                </p>
              </div>
            )}

            {isPartnerMode && hasProducerProducts ? (
              <ProducerBar
                producers={producers}
                products={displayedProducts}
                addButtonLabel={boutique.addButtonLabel}
                lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                producerPartnerLabel={boutique.producerPartnerLabel}
                producerWebsiteLabel={boutique.producerWebsiteLabel}
              />
            ) : (
              <>
                {showOwnProducerCard && (
                  <div className="mb-6 flex justify-center md:justify-start">
                    <ProducerTcgCard
                      producer={ownProducer}
                      isSelected={selectedOwnProducerId === ownProducer.id}
                      imagePriority
                      onClick={() =>
                        setSelectedOwnProducerId((current) =>
                          current === ownProducer.id ? null : ownProducer.id,
                        )
                      }
                    />
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      producer={resolveProductProducer(product, producersById, ownProducer)}
                      addButtonLabel={boutique.addButtonLabel}
                      lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                      imagePriority={index === 0}
                    />
                  ))}
                </div>

                <ProducerTcgModal
                  open={showOwnProducerCard && selectedOwnProducerId !== null}
                  producers={[ownProducer]}
                  selectedProducerId={selectedOwnProducerId}
                  productsByProducerId={ownProductsByProducerId}
                  addButtonLabel={boutique.addButtonLabel}
                  lowStockThresholdGrams={boutique.lowStockThresholdGrams}
                  producerPartnerLabel={boutique.ownProducerLabel}
                  producerWebsiteLabel={boutique.producerWebsiteLabel}
                  onClose={() => setSelectedOwnProducerId(null)}
                  onSelectProducer={setSelectedOwnProducerId}
                />
              </>
            )}

            {displayedProducts.length === 0 && !loading && (
              <div className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
                {effectiveFilter === "promos"
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
    </section>
  );
}
