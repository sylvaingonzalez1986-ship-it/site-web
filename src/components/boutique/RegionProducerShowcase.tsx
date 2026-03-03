"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { FranceRegionMap } from "@/components/boutique/FranceRegionMap";
import { ProducerTcgShowcase } from "@/components/boutique/ProducerTcgShowcase";
import { RegionCarouselOverlay } from "@/components/boutique/RegionCarouselOverlay";
import {
  FRENCH_REGION_LABELS,
  resolveFrenchRegion,
  type FrenchRegion,
} from "@/data/france-geo";
import type { Product } from "@/data/products";
import { resolveProductProducer } from "@/lib/own-producer";
import type { Producer } from "@/types/store";

type RegionProducerShowcaseProps = {
  producers: Producer[];
  products: Product[];
  ownProducer: Producer;
  ownProducts: Product[];
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
};

export function RegionProducerShowcase({
  producers,
  products,
  ownProducer,
  ownProducts,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
}: RegionProducerShowcaseProps) {
  const [selectedRegion, setSelectedRegion] = useState<FrenchRegion | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const cardsSectionRef = useRef<HTMLDivElement | null>(null);
  const emptySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => {
        mediaQuery.removeEventListener("change", syncViewport);
      };
    }

    legacyMediaQuery.addListener?.(syncViewport);
    return () => {
      legacyMediaQuery.removeListener?.(syncViewport);
    };
  }, []);

  const allProducers = useMemo(() => {
    const seen = new Set<string>();
    const merged: Producer[] = [];

    for (const producer of [ownProducer, ...producers]) {
      if (seen.has(producer.id)) {
        continue;
      }

      seen.add(producer.id);
      merged.push(producer);
    }

    return merged;
  }, [ownProducer, producers]);

  const producerById = useMemo(
    () => new Map(allProducers.map((producer) => [producer.id, producer])),
    [allProducers],
  );

  const producersByRegion = useMemo(() => {
    const grouped = new Map<FrenchRegion, Producer[]>();

    for (const producer of allProducers) {
      const region = resolveFrenchRegion(producer.region);
      if (!region) {
        continue;
      }

      const list = grouped.get(region) ?? [];
      list.push(producer);
      grouped.set(region, list);
    }

    return grouped;
  }, [allProducers]);

  const producerCountByRegion = useMemo(() => {
    const counts: Partial<Record<FrenchRegion, number>> = {};

    for (const [region, regionProducers] of producersByRegion.entries()) {
      counts[region] = regionProducers.length;
    }

    return counts;
  }, [producersByRegion]);

  const selectedProducers = useMemo(
    () => (selectedRegion ? producersByRegion.get(selectedRegion) ?? [] : []),
    [producersByRegion, selectedRegion],
  );

  const selectedProducerIds = useMemo(
    () => new Set(selectedProducers.map((producer) => producer.id)),
    [selectedProducers],
  );

  const selectedProductsByProducerId = useMemo(() => {
    const grouped = new Map<string, Product[]>();

    for (const product of products) {
      if (!product.producerId || !selectedProducerIds.has(product.producerId)) {
        continue;
      }

      const list = grouped.get(product.producerId) ?? [];
      list.push(product);
      grouped.set(product.producerId, list);
    }

    if (selectedProducerIds.has(ownProducer.id) && ownProducts.length > 0) {
      grouped.set(ownProducer.id, ownProducts);
    }

    return grouped;
  }, [ownProducer.id, ownProducts, products, selectedProducerIds]);

  const selectedProducts = useMemo(() => {
    const partnerProducts = products.filter(
      (product) => product.producerId && selectedProducerIds.has(product.producerId),
    );

    if (!selectedProducerIds.has(ownProducer.id)) {
      return partnerProducts;
    }

    return [...partnerProducts, ...ownProducts];
  }, [ownProducer.id, ownProducts, products, selectedProducerIds]);

  const selectedCount = selectedRegion ? producerCountByRegion[selectedRegion] ?? 0 : 0;
  const selectedLabel = selectedRegion ? FRENCH_REGION_LABELS[selectedRegion] : null;
  const shouldShowDesktopPanel = !isMobileViewport && selectedRegion !== null;

  useEffect(() => {
    if (!selectedRegion || isMobileViewport) {
      return;
    }

    const scrollTarget = selectedCount === 0 ? emptySectionRef.current : cardsSectionRef.current;
    if (!scrollTarget) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const navbar = document.querySelector<HTMLElement>("header[data-tutorial='navbar']");
      const navbarOffset = navbar ? navbar.getBoundingClientRect().height + 12 : 24;
      const top = scrollTarget.getBoundingClientRect().top + window.scrollY - navbarOffset;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isMobileViewport, selectedCount, selectedRegion]);

  return (
    <div className="region-showcase">
      <div className="region-map-container cartoon-panel halftone-overlay paper-grain">
        <div className="region-map-intro">
          <p className="section-title region-map-title text-ink">Nos producteurs de France</p>
          <p className="region-map-subtitle font-handwritten text-charcoal">
            Cliquez sur une region pour decouvrir ses artisans
          </p>
        </div>

        <FranceRegionMap
          selectedRegion={selectedRegion}
          onRegionClick={setSelectedRegion}
          producerCountByRegion={producerCountByRegion}
        />

        {selectedRegion ? (
          <RegionCarouselOverlay
            key={selectedRegion}
            open={isMobileViewport}
            region={selectedRegion}
            producers={selectedProducers}
            productsByProducerId={selectedProductsByProducerId}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
            producerPartnerLabel={producerPartnerLabel}
            producerWebsiteLabel={producerWebsiteLabel}
            onClose={() => setSelectedRegion(null)}
          />
        ) : null}
      </div>

      {shouldShowDesktopPanel ? (
        <div className="region-showcase-panel">
          <div className="region-showcase-meta cartoon-border bg-cream">
            <div>
              <p className="font-display text-3xl text-ink">{selectedLabel}</p>
              <p className="mt-2 font-handwritten text-2xl text-charcoal">
                {selectedCount} producteur{selectedCount > 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn-cartoon btn-secondary region-reset-button"
              onClick={() => setSelectedRegion(null)}
            >
              Voir tous les producteurs
            </button>
          </div>

          {selectedCount === 0 ? (
            <div ref={emptySectionRef} className="region-showcase-empty cartoon-panel">
              <p className="font-handwritten text-3xl text-charcoal">
                Aucun producteur dans cette region pour le moment... mais ca pousse !
              </p>
              <button
                type="button"
                className="btn-cartoon btn-secondary mt-6"
                onClick={() => setSelectedRegion(null)}
              >
                Voir tous les producteurs
              </button>
            </div>
          ) : (
            <>
              <div ref={cardsSectionRef}>
                <ProducerTcgShowcase
                  className="region-showcase-cards"
                  producers={selectedProducers}
                  products={selectedProducts}
                  productsByProducerId={selectedProductsByProducerId}
                  addButtonLabel={addButtonLabel}
                  lowStockThresholdGrams={lowStockThresholdGrams}
                  producerPartnerLabel={producerPartnerLabel}
                  producerWebsiteLabel={producerWebsiteLabel}
                />
              </div>

              {selectedProducts.length > 0 ? (
                <div className="region-showcase-grid">
                  {selectedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      producer={resolveProductProducer(product, producerById, ownProducer)}
                      addButtonLabel={addButtonLabel}
                      lowStockThresholdGrams={lowStockThresholdGrams}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
