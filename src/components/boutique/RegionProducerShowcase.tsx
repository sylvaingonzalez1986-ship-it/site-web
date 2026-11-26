"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import styles from "./RegionMarket.module.css";
import { ProductCard, type ShopCardOrigin } from "@/components/ProductCard";
import { FranceRegionMap } from "@/components/boutique/FranceRegionMap";
import { ProducerTcgShowcase } from "@/components/boutique/ProducerTcgShowcase";
import { RegionCarouselOverlay } from "@/components/boutique/RegionCarouselOverlay";
import { focusShopResults, hasShopResultsRestore, REGION_RESULTS_ID } from "@/components/boutique/ShopResultsRestore";
import {
  FRENCH_REGION_LABELS,
  type FrenchRegion,
} from "@/data/france-geo";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { shopProductsShortcutLabel } from "@/lib/boutique-helpers";
import { resolveProductProducer } from "@/lib/own-producer";
import type { RegionCatalogue } from "@/lib/region-catalogue";
import { changeShopUrl } from "@/lib/shop-panel-history";
import type { Producer } from "@/types/store";

type RegionProducerShowcaseProps = {
  originFilters: Pick<ShopCardOrigin, "categorie" | "culture">;
  selectedRegion: FrenchRegion | null;
  selectedProducerId: string | null;
  onSelectProducer: (producerId: string | null) => void;
  rotationDay: number;
  catalogue: RegionCatalogue;
  ownProducer: Producer;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
};

const mobileQuery = "(max-width: 640px)";
function subscribeToViewport(update: () => void) {
  const mediaQuery = window.matchMedia(mobileQuery);
  mediaQuery.addEventListener("change", update);
  return () => mediaQuery.removeEventListener("change", update);
}

export function RegionProducerShowcase({
  originFilters,
  selectedRegion,
  selectedProducerId,
  onSelectProducer,
  rotationDay,
  catalogue,
  ownProducer,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId,
}: RegionProducerShowcaseProps) {
  const isMobileViewport = useSyncExternalStore(subscribeToViewport, () => window.matchMedia(mobileQuery).matches, () => false);
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
  const regionOpenerRef = useRef<HTMLElement | SVGElement | null>(null);
  const openedRegionRef = useRef(false);

  const { producerById, producerCountByRegion, selectedProducers, selectedProducts, selectedProductsByProducerId } = catalogue;
  const selectedCount = selectedProducers.length;
  const productCount = selectedProducts.length;
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
      if (region === selectedRegion) return;
      if (!selectedRegion) {
        const active = document.activeElement;
        regionOpenerRef.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
      }
      changeShopUrl({ region, producteur: null }, selectedRegion ? "switch" : "open");

      window.requestAnimationFrame(() => {
        triggerRegionFlight(source);
      });
    },
    [selectedRegion, triggerRegionFlight],
  );

  const closeRegion = useCallback(() => changeShopUrl({ region: null, producteur: null }, "close"), []);

  useEffect(() => {
    if (selectedRegion) {
      openedRegionRef.current = true;
      return;
    }
    if (!openedRegionRef.current) return;
    const opener = regionOpenerRef.current ?? (document.activeElement === document.body
      ? isMobileViewport ? mapContainerRef.current?.querySelector("select") : document.getElementById("boutique-resultats")
      : null);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    regionOpenerRef.current = null;
    openedRegionRef.current = false;
  }, [isMobileViewport, selectedRegion]);

  useEffect(() => {
    if (!selectedRegion || isMobileViewport || hasShopResultsRestore()) {
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

  const origin: ShopCardOrigin | undefined = selectedRegion ? { ...originFilters, surface: "region", selection: "regions", region: selectedRegion } : undefined;
  const productGrid = origin && productCount > 0 ? (
    <div className={styles.productResults}>
      <h4 id={REGION_RESULTS_ID} tabIndex={-1}>Produits · {selectedLabel}</h4>
      <div data-shop-list-view="region" className="region-showcase-grid">
        {selectedProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            origin={origin}
            producer={resolveProductProducer(product, producerById, ownProducer)}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
            tastingSummary={tastingSummariesByProductId[product.id]}
          />
        ))}
      </div>
    </div>
  ) : null;
  const mobileProductsShortcut = productCount > 0 && (
    <button
      type="button"
      data-ui-commerce="primary"
      data-ui-shape="control"
      className="btn-cartoon btn-primary min-h-11 px-3 py-2 text-sm"
      aria-controls={REGION_RESULTS_ID}
      onClick={() => focusShopResults(REGION_RESULTS_ID)}
    >
      {shopProductsShortcutLabel(productCount)}
    </button>
  );

  return (
    <div data-ui-commerce="region-showcase" ref={showcaseRef} className={`region-showcase ${styles.showcase}`}>
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

        {selectedRegion && origin && isMobileViewport ? (
          <RegionCarouselOverlay
            key={selectedRegion}
            origin={origin}
            region={selectedRegion}
            producers={selectedProducers}
            selectedProducerId={selectedProducerId}
            onSelectProducer={onSelectProducer}
            productGrid={productGrid}
            productsShortcut={mobileProductsShortcut}
            productsByProducerId={selectedProductsByProducerId}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
            producerPartnerLabel={producerPartnerLabel}
            producerWebsiteLabel={producerWebsiteLabel}
            tastingSummariesByProductId={tastingSummariesByProductId}
            onClose={closeRegion}
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

      {shouldShowDesktopPanel && origin ? (
        <div className="region-showcase-panel">
          <div className="region-showcase-meta">
            <div>
              <h3 id={productGrid ? undefined : REGION_RESULTS_ID} data-shop-panel-results tabIndex={-1} className="font-display text-3xl text-ink">{selectedLabel}</h3>
              <p className="mt-2 font-handwritten text-2xl text-charcoal">
                {selectedCount} producteur{selectedCount > 1 ? "s" : ""}
              </p>
            </div>
            <div className="region-showcase-actions">
              <button data-ui-commerce="secondary" data-ui-shape="control"
                type="button"
                className="btn-cartoon btn-secondary region-reset-button"
                onClick={closeRegion}
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
              <button data-ui-commerce="secondary" data-ui-shape="control"
                type="button"
                className="btn-cartoon btn-secondary mt-6"
                onClick={closeRegion}
              >
                Retour à la carte
              </button>
            </div>
          ) : (
            <>
              <div ref={cardsSectionRef}>
                <ProducerTcgShowcase
                  origin={origin}
                  selectedProducerId={selectedProducerId}
                  onSelectProducer={onSelectProducer}
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

              {productGrid ?? <p className="mt-4 font-semibold text-charcoal">Aucun produit dans cette région actuellement.</p>}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
