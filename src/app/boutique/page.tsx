"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CustomSection } from "@/components/CustomSection";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBar } from "@/components/boutique/ProducerBar";
import { type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { hasActiveProductPromo } from "@/lib/product-promo";
import type { BoutiqueSection } from "@/types/store";

type Filter = "all" | "promos" | ProductCategory;

export default function BoutiquePage() {
  const { store, loading } = useCmsStore();
  const boutique = store.content.boutique;
  const [filter, setFilter] = useState<Filter>("all");

  const ownProducts = useMemo(
    () => store.products.filter((product) => !product.producerId),
    [store.products],
  );

  const promoProducts = useMemo(
    () => store.products.filter((product) => hasActiveProductPromo(product)),
    [store.products],
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
    () => store.products.filter((product) => product.producerId),
    [store.products],
  );

  const producersById = useMemo(
    () => new Map(store.producers.map((producer) => [producer.id, producer])),
    [store.producers],
  );

  const boutiqueSections = useMemo(
    () => store.sections.boutique.filter((section) => section.visible),
    [store.sections.boutique],
  );

  const renderBoutiqueSection = (section: BoutiqueSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-8";

    switch (section.type) {
      case "header":
        return (
          <div key={section.id} className={`cartoon-border bg-cream p-8 ${spacingClass}`}>
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">{boutique.eyebrow}</p>
            <h1 className="section-title mt-5 text-ink">{boutique.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
              {boutique.description}
            </p>
            <div className="mt-6">
              <CategoryFilter selected={filter} onChange={setFilter} />
            </div>
          </div>
        );
      case "products": {
        const displayedProducts = filter === "promos" ? promoProducts : filteredOwnProducts;

        return (
          <div key={section.id} className={spacingClass}>
            {filter === "promos" && displayedProducts.length > 0 && (
              <div className="cartoon-border mb-6 bg-[#d35400] p-5 text-white">
                <h3 className="font-display text-3xl text-white">Promotions en cours</h3>
                <p className="mt-2 text-sm text-white/95">
                  Retrouve ici toutes les offres actives, y compris les packs promo.
                </p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  producer={product.producerId ? producersById.get(product.producerId) : undefined}
                  addButtonLabel={boutique.addButtonLabel}
                />
              ))}
            </div>
            {displayedProducts.length === 0 && !loading && (
              <div className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
                {filter === "promos" ? "Aucune promotion en cours." : boutique.emptyMessage}
              </div>
            )}
          </div>
        );
      }
      case "copains":
        if (filter === "promos" || partnerProducts.length === 0) {
          return null;
        }

        return (
          <div key={section.id} className={spacingClass}>
            <div className="cartoon-border bg-yellow p-8">
              <h2 className="font-display text-4xl text-ink">
                {boutique.copainsSectionTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-charcoal">
                {boutique.copainsSectionDescription}
              </p>
            </div>
            <ProducerBar
              producers={store.producers}
              products={partnerProducts}
              addButtonLabel={boutique.addButtonLabel}
              producerPartnerLabel={boutique.producerPartnerLabel}
              producerWebsiteLabel={boutique.producerWebsiteLabel}
            />
          </div>
        );
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
