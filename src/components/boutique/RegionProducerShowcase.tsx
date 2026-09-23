"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./RegionMarket.module.css";
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
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { resolveProductProducer } from "@/lib/own-producer";
import { rotateProductsForDay } from "@/lib/product-rotation";
import type { Producer } from "@/types/store";

type RegionProducerShowcaseProps = {
  rotationDay: number;
  producers: Producer[];
  products: Product[];
  ownProducer: Producer;
  ownProducts: Product[];
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
};

export function RegionProducerShowcase({
  rotationDay,
  producers,
  products,
  ownProducer,
  ownProducts,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId,
}: RegionProducerShowcaseProps) {
  const [selectedRegion, setSelectedRegion] = useState<FrenchRegion | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [regionFlight, setRegionFlight] = useState<{
    key: number;
    startX: number;
    startY: number;
    deltaX: number;
    deltaY: number;
  } | null>(null);
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
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

    return new Map([...grouped].map(([producerId, producerProducts]) => [
      producerId,
      rotateProductsForDay(producerProducts, rotationDay, `producer:${producerId}`),
    ]));
  }, [ownProducer.id, ownProducts, products, rotationDay, selectedProducerIds]);

  const selectedProducts = useMemo(() => {
    const partnerProducts = products.filter(
      (product) => product.producerId && selectedProducerIds.has(product.producerId),
    );

    const selection = selectedProducerIds.has(ownProducer.id)
      ? [...partnerProducts, ...ownProducts]
      : partnerProducts;

    return rotateProductsForDay(selection, rotationDay, `region:${selectedRegion}`, { ownProductsFirst: true });
  }, [ownProducer.id, ownProducts, products, rotationDay, selectedProducerIds, selectedRegion]);

  const selectedCount = selectedRegion ? producerCountByRegion[selectedRegion] ?? 0 : 0;
  const selectedLabel = selectedRegion ? FRENCH_REGION_LABELS[selectedRegion] : null;
  const shouldShowDesktopPanel = !isMobileViewport && selectedRegion !== null;

  const scrollToDesktopContent = useCallback(() => {
    if (isMobileViewport || !selectedRegion) {
      return;
    }

    const scrollTarget = selectedCount === 0 ? emptySectionRef.current : cardsSectionRef.current;
    if (!scrollTarget) {
      return;
    }

    const navbar = document.querySelector<HTMLElement>("header[data-tutorial='navbar']");
    const navbarOffset = navbar ? navbar.getBoundingClientRect().height + 12 : 24;
    const top = scrollTarget.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [isMobileViewport, selectedCount, selectedRegion]);

  const triggerRegionFlight = useCallback(
    (source?: { x: number; y: number }) => {
      if (isMobileViewport || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !source || !showcaseRef.current || !mapContainerRef.current) {
        return;
      }

      const showcaseRect = showcaseRef.current.getBoundingClientRect();
      const mapRect = mapContainerRef.current.getBoundingClientRect();

      const startX = mapRect.left - showcaseRect.left + source.x;
      const startY = mapRect.top - showcaseRect.top + source.y;
      const targetX = mapRect.left - showcaseRect.left + mapRect.width * 0.52;
      const targetY =
        mapRect.top -
        showcaseRect.top +
        mapRect.height +
        Math.min(150, Math.max(96, showcaseRect.height * 0.16));

      setRegionFlight({
        key: Date.now(),
        startX,
        startY,
        deltaX: targetX - startX,
        deltaY: targetY - startY,
      });
    },
    [isMobileViewport],
  );

  const handleRegionSelection = useCallback(
    (region: FrenchRegion, source?: { x: number; y: number }) => {
      setSelectedRegion(region);

      window.requestAnimationFrame(() => {
        triggerRegionFlight(source);
      });
    },
    [triggerRegionFlight],
  );

  useEffect(() => {
    if (!selectedRegion || isMobileViewport) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToDesktopContent();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isMobileViewport, scrollToDesktopContent, selectedRegion]);

  useEffect(() => {
    if (!regionFlight) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRegionFlight(null);
    }, 1050);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [regionFlight]);

  return (
    <div ref={showcaseRef} className={`region-showcase ${styles.showcase}`}>
      <div ref={mapContainerRef} className={`region-map-container ${styles.board}`}>
        <div className="region-map-intro">
          <div>
            <p className={styles.kicker}>Le marché · Par région</p>
            <h2 className="section-title region-map-title">La carte des copains.</h2>
            <p className="region-map-subtitle">Choisis une région. Rencontre les artisans qui la font pousser.</p>
          </div>
          <div className={styles.network}>
            <strong>{Object.values(producerCountByRegion).reduce((total, count) => total + count, 0)}</strong>
            <span>producteurs<br />à découvrir</span>
          </div>
        </div>

        <FranceRegionMap
          selectedRegion={selectedRegion}
          onRegionClick={handleRegionSelection}
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
            tastingSummariesByProductId={tastingSummariesByProductId}
            onClose={() => setSelectedRegion(null)}
          />
        ) : null}
      </div>

      {regionFlight ? (
        <div
          key={regionFlight.key}
          className="region-flight"
          style={
            {
              "--region-flight-start-x": `${regionFlight.startX}px`,
              "--region-flight-start-y": `${regionFlight.startY}px`,
              "--region-flight-delta-x": `${regionFlight.deltaX}px`,
              "--region-flight-delta-y": `${regionFlight.deltaY}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span className="region-flight__trail" />
          <span className="region-flight__dot" />
        </div>
      ) : null}

      {shouldShowDesktopPanel ? (
        <div className="region-showcase-panel">
          <div className="region-showcase-meta">
            <div>
              <p className="font-display text-3xl text-ink">{selectedLabel}</p>
              <p className="mt-2 font-handwritten text-2xl text-charcoal">
                {selectedCount} producteur{selectedCount > 1 ? "s" : ""}
              </p>
            </div>
            <div className="region-showcase-actions">
              <button
                type="button"
                className="btn-cartoon btn-secondary region-reset-button"
                onClick={() => setSelectedRegion(null)}
              >
                Retour à la carte
              </button>
            </div>
          </div>

          {selectedCount === 0 ? (
            <div ref={emptySectionRef} className="region-showcase-empty">
              <p className="font-handwritten text-3xl text-charcoal">
                Aucun producteur dans cette région pour le moment… mais ça pousse !
              </p>
              <button
                type="button"
                className="btn-cartoon btn-secondary mt-6"
                onClick={() => setSelectedRegion(null)}
              >
                Retour à la carte
              </button>
            </div>
          ) : (
            <>
              <div ref={cardsSectionRef}>
                <ProducerTcgShowcase
                  rotationDay={rotationDay}
                  className="region-showcase-cards"
                  producers={selectedProducers}
                  products={selectedProducts}
                  productsByProducerId={selectedProductsByProducerId}
                  addButtonLabel={addButtonLabel}
                  lowStockThresholdGrams={lowStockThresholdGrams}
                  producerPartnerLabel={producerPartnerLabel}
                  producerWebsiteLabel={producerWebsiteLabel}
                  tastingSummariesByProductId={tastingSummariesByProductId}
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
                      tastingSummary={tastingSummariesByProductId[product.id]}
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
